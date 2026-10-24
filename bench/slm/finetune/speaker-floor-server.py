"""Opt-in GPU wrapper around installed mlx-lm 0.32.2; never imported by prepare.

Keep the stock seeded, non-batched server path. Instrument stream_generate's
native counters and provide controlled empty-cache / exact ledger-prefix cases.
No vendor files or general benchmark providers are modified.
"""
import copy
import json
import os
from pathlib import Path
import time

from speaker_floor_common import common_prefix, messages_for_model


def main():
    from importlib.metadata import version
    if version('mlx-lm') != '0.32.2':
        raise RuntimeError('Reinspect server instrumentation before changing mlx-lm version')
    import mlx.core as mx
    import mlx_lm.server as server
    from mlx_lm.models.cache import make_prompt_cache

    mode = os.environ['SF_CACHE_MODE']
    gemma = os.environ.get('SF_GEMMA') == '1'
    telemetry = Path(os.environ['SF_TELEMETRY'])
    original_tokenize = server.ResponseGenerator._tokenize
    original_serve = server.ResponseGenerator._serve_single
    original_stream = server.stream_generate
    active = {}

    def tokenize(self, tokenizer, request, args):
        request = copy.deepcopy(request)
        request.messages = messages_for_model(request.messages, gemma)
        return original_tokenize(self, tokenizer, request, args)

    def measured_stream(*args, **kwargs):
        last = None
        iterator = original_stream(*args, **kwargs)
        try:
            for last in iterator:
                yield last
        finally:
            iterator.close()
            if last is not None:
                active.update(promptTokens=last.prompt_tokens, outputTokens=last.generation_tokens,
                              prefillTps=last.prompt_tps, decodeTps=last.generation_tps,
                              prefillSeconds=last.prompt_tokens / last.prompt_tps,
                              decodeSeconds=last.generation_tokens / last.generation_tps,
                              peakMemoryGB=last.peak_memory)

    def serve(self, request_tuple, stream):
        queue, request, args = request_tuple
        active.clear()
        key = (args.chat_template_kwargs or {}).get('speaker_floor_key')
        if not key or args.seed is None:
            queue.put(ValueError('Speaker-floor requests require a key and seed'))
            return
        active.update(key=key, cacheMode=mode, seed=args.seed, cachedTokens=0)
        start = time.perf_counter()
        try:
            # No reuse between probes, personas, ledgers, weights or resumed runs.
            self.prompt_cache.trim_to(n_sequences=0)
            tokenizer = self.model_provider.tokenizer
            prompt = tokenize(self, tokenizer, request, args)[0]
            active['fullPromptTokens'] = len(prompt)
            if mode == 'ledger':
                # Replace the FIRST user turn, before Gemma's system merge. The
                # common token prefix contains persona+ledger and role delimiters,
                # but no previous dialogue or question. Trim a boundary token.
                alternate = copy.deepcopy(request)
                first_user = next(m for m in alternate.messages if m['role'] == 'user')
                first_user['content'] = '\u0000speaker-floor prefix boundary'
                other = tokenize(self, tokenizer, alternate, args)[0]
                n = max(0, common_prefix(prompt, other) - 1)
                if n < 1 or n >= len(prompt):
                    raise ValueError('No valid ledger prefix')
                cache = make_prompt_cache(self.model_provider.model)
                warm_start = time.perf_counter()
                # generate_step speculatively evaluates the next token before
                # yielding, even with max_tokens=1. Populate ONLY the prefix via
                # forward calls, otherwise a hidden sampled token contaminates KV
                # (and LFM's non-trimmable convolution state).
                with mx.stream(stream):
                    for offset in range(0, n, self.cli_args.prefill_step_size):
                        tokens = mx.array(prompt[offset:min(n, offset + self.cli_args.prefill_step_size)])[None]
                        self.model_provider.model(tokens, cache=cache)
                        mx.eval([c.state for c in cache])
                elapsed = time.perf_counter() - warm_start
                active['prefixPreparation'] = {'tokens': n, 'prefillTps': n / elapsed,
                                               'seconds': elapsed, 'discardedSampleTokens': 0}
                self.prompt_cache.insert_cache(self.model_provider.model_key, prompt[:n], cache)
                active['cachedTokens'] = n
                del cache
            # Stock implementation reseeds AFTER prefix preparation. Thus cache
            # preparation cannot consume the evaluated answer's sampling stream.
            turn_start = time.perf_counter()
            original_serve(self, request_tuple, stream)
            active['turnSeconds'] = time.perf_counter() - turn_start
            if active.get('promptTokens') != len(prompt) - active['cachedTokens']:
                active['error'] = 'Cache reuse did not match the requested prefix'
        except Exception as error:
            active['error'] = type(error).__name__
            queue.put(error)
        finally:
            active['requestSecondsIncludingPrefix'] = time.perf_counter() - start
            with telemetry.open('a') as f:
                f.write(json.dumps(active) + '\n')

    server.ResponseGenerator._tokenize = tokenize
    server.ResponseGenerator._serve_single = serve
    server.stream_generate = measured_stream
    server.main()


if __name__ == '__main__':
    main()
