"""CPU-only tests. Fake model/server objects never import an ML runtime."""
import importlib.util
import json
import os
from pathlib import Path
from queue import Queue
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

from speaker_floor_common import atomic_json, digest, latest_jsonl, messages_for_model


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


controller = module('floor', 'speaker-floor.py')


class FloorTests(unittest.TestCase):
    def test_imports_do_not_load_gpu_modules(self):
        self.assertFalse(any(k == 'mlx' or k.startswith('mlx.') for k in sys.modules))

    def test_gemma_preserves_system_and_first_user_without_mutation(self):
        original = [{'role': 'system', 'content': 'Ledger'}, {'role': 'user', 'content': 'Question'}, {'role': 'assistant', 'content': 'Answer'}]
        converted = messages_for_model(original, True)
        self.assertEqual(converted[0], {'role': 'user', 'content': 'Ledger\n\nQuestion'})
        self.assertEqual(original[0]['role'], 'system')
        self.assertEqual(messages_for_model(original), original)
        with self.assertRaises(ValueError):
            messages_for_model(original[:1], True)

    def test_guards_fallback_and_ties(self):
        base = dict(macroQ=.3, macroF=.9, leakage=.1)
        candidate = lambda epoch, q, f=.9, leak=.1: dict(epoch=epoch, model=str(epoch), score=dict(macroQ=q, macroF=f, leakage=leak))
        result = controller.choose(base, [candidate(1, .9, .8), candidate(2, .4)])
        self.assertEqual(result['epoch'], 2)
        self.assertTrue(result['guardPassed'])
        result = controller.choose(base, [candidate(2, .4), candidate(1, .4)])
        self.assertEqual(result['epoch'], 1)
        result = controller.choose(base, [candidate(1, .9, leak=.2), candidate(2, .4, .5)])
        self.assertEqual(result['epoch'], 1)
        self.assertFalse(result['guardPassed'])

    def test_torn_tail_and_latest_error(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'rows.jsonl'
            p.write_bytes(b'{"key":"a","status":"error"}\n{"key":"a","status":"ok"}\n{"torn"')
            self.assertEqual(latest_jsonl(p), [dict(key='a', status='ok')])
            self.assertTrue(p.read_bytes().endswith(b'\n'))
            p.write_text('not json\n')
            with self.assertRaises(ValueError):
                latest_jsonl(p)

    def test_training_resume_checks_artifacts_without_command(self):
        with tempfile.TemporaryDirectory() as d, patch.object(controller, 'OUT', Path(d)):
            run = Path(d) / 'runs/test'
            run.mkdir(parents=True)
            (run / 'weights').write_text('complete')
            atomic_json(run / 'training-complete.json', {'artifactHashes': {'weights': digest(run / 'weights')}})
            with patch.object(controller, 'command') as command:
                controller.train({'label': 'test'})
                command.assert_not_called()
            (run / 'weights').write_text('changed')
            with self.assertRaises(ValueError):
                controller.train({'label': 'test'})

    def test_failure_continues_next_model_and_offline_env(self):
        with tempfile.TemporaryDirectory() as d, patch.object(controller, 'OUT', Path(d)), patch.dict(os.environ):
            prepared = {'models': [dict(label='bad', status='ready', snapshot='local'), dict(label='good', status='ready', snapshot='local')]}
            atomic_json(Path(d) / 'prepared.json', prepared)
            def choose(model, _):
                self.assertEqual(os.environ['HF_HUB_OFFLINE'], '1')
                if model['label'] == 'bad':
                    raise RuntimeError('expected failure')
                return 'local-fused'
            with patch.object(controller, 'check'), patch.object(controller, 'validate_model'), patch.object(controller, 'source_hashes', return_value={}), patch.object(controller, 'summary'), \
                 patch.object(controller, 'selected', side_effect=choose), patch.object(controller, 'evaluation') as evaluate, \
                 patch.object(controller.subprocess, 'check_output', return_value=''):
                self.assertFalse(controller.launch(240))
                self.assertEqual(evaluate.call_count, 15)  # 3 templates + 2 arms x 3 splits x 2 caches
                self.assertEqual(json.loads((Path(d) / 'errors.json').read_text()), {'bad': 'expected failure'})
                self.assertFalse(controller.launch(240))  # same frozen plan resumes
                with self.assertRaises(ValueError):
                    controller.launch(241)

    def test_ac_and_adapter_ratings_are_not_reported_as_device_power(self):
        with patch.object(controller.subprocess, 'check_output', return_value=b'"ExternalConnected" = Yes\n"Watts" = 96\n"Voltage" = 12000\n"InstantAmperage" = 1000'):
            self.assertIsNone(controller.power_reading()['watts'])
        with patch.object(controller.subprocess, 'check_output', return_value=b'"ExternalConnected" = No\n"Voltage" = 12000\n"InstantAmperage" = -1000'):
            self.assertEqual(controller.power_reading()['watts'], 12)
        with patch.object(controller.subprocess, 'check_output', return_value=b'"ExternalConnected" = Yes\n"PowerTelemetryData" = {"SystemLoad"=46017,"SystemLoadAccumulatorCount"=126302,"SystemPowerIn"=52418}'):
            self.assertEqual(controller.power_reading(), dict(watts=46.017, source='ioreg SystemLoad (mW / 1000)', publicationCount=126302))

    def test_server_ledger_cache_contains_prefix_only_and_reseeds_answer(self):
        wrapper = module('floor_server', 'speaker-floor-server.py')
        class Array(list):
            def __getitem__(self, key): return self if key is None else super().__getitem__(key)
        class Context:
            def __enter__(self): return self
            def __exit__(self, *_): pass
        class Cache:
            def __init__(self): self.state = []
        class LRU:
            def trim_to(self, **_): self.tokens = []; self.cache = None
            def insert_cache(self, _, tokens, cache): self.tokens = tokens; self.cache = cache
        seeds = []
        mx = types.ModuleType('mlx.core')
        mx.array, mx.eval, mx.stream = Array, lambda _: None, lambda _: Context()
        mx.random = types.SimpleNamespace(seed=seeds.append)
        server = types.ModuleType('mlx_lm.server')
        class Generator:
            def _tokenize(self, tokenizer, request, args):
                return list('|'.join(m['content'] for m in request.messages).encode()), None, None, None, None
            def _serve_single(self, request, stream):
                _, req, args = request
                tokens = self._tokenize(None, req, args)[0]
                cached = self.prompt_cache.tokens
                self_test.assertEqual(self.prompt_cache.cache[0].state, cached)
                self_test.assertNotIn('Question', bytes(cached).decode())
                mx.random.seed(args.seed)
                iterator = server.stream_generate(prompt=tokens[len(cached):])
                try: next(iterator)
                finally: iterator.close()
        server.ResponseGenerator = Generator
        def stream_generate(**kwargs):
            n = len(kwargs['prompt'])
            yield types.SimpleNamespace(prompt_tokens=n, generation_tokens=2, prompt_tps=10, generation_tps=5, peak_memory=.1)
        server.stream_generate = stream_generate
        self_test = self
        with tempfile.TemporaryDirectory() as d:
            telemetry = Path(d) / 'telemetry.jsonl'
            def run():
                g = Generator()
                def model(tokens, cache): cache[0].state.extend(tokens)
                g.model_provider = types.SimpleNamespace(tokenizer=None, model=model, model_key='fixed')
                g.prompt_cache = LRU()
                g.cli_args = types.SimpleNamespace(prefill_step_size=4)
                req = types.SimpleNamespace(messages=[dict(role='system', content='Ledger'), dict(role='user', content='Question')])
                args = types.SimpleNamespace(seed=7, chat_template_kwargs={'speaker_floor_key': 'request1'})
                g._serve_single((Queue(), req, args), None)
            server.main = run
            mlx = types.ModuleType('mlx'); mlx.core = mx
            mlx_lm = types.ModuleType('mlx_lm'); mlx_lm.server = server
            cache_module = types.ModuleType('mlx_lm.models.cache'); cache_module.make_prompt_cache = lambda _: [Cache()]
            with patch.dict(sys.modules, {'mlx': mlx, 'mlx.core': mx, 'mlx_lm': mlx_lm, 'mlx_lm.server': server, 'mlx_lm.models.cache': cache_module}), \
                 patch('importlib.metadata.version', return_value='0.32.2'), \
                 patch.dict(os.environ, SF_CACHE_MODE='ledger', SF_GEMMA='1', SF_TELEMETRY=str(telemetry)):
                wrapper.main()
            row = json.loads(telemetry.read_text())
            self.assertNotIn('error', row)
            self.assertGreater(row['cachedTokens'], 0)
            self.assertEqual(row['prefixPreparation']['discardedSampleTokens'], 0)
            self.assertEqual(row['promptTokens'] + row['cachedTokens'], row['fullPromptTokens'])
            self.assertEqual(seeds, [7])


if __name__ == '__main__':
    unittest.main()
