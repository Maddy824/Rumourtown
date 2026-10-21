"""Batched teacher sampling with mlx-lm: k samples per prompt at temperature 0.7.

    ~/.venvs/rt-mlx/bin/python bench/slm/finetune/sample.py <hf-model> <prompts.jsonl> <samples.jsonl> [k] [batch]

Appends {"probeId", "sample", "text"} rows and skips probes already sampled, so it resumes.
"""
import json
import sys
import time
from pathlib import Path

import mlx.core as mx
from mlx_lm import load
from mlx_lm.generate import batch_generate
from mlx_lm.sample_utils import make_sampler


def main(model_id: str, prompts_path: str, out_path: str, k: int = 8, batch: int = 32) -> None:
    prompts = [json.loads(line) for line in Path(prompts_path).read_text().splitlines() if line.strip()]
    out = Path(out_path)
    done = set()
    if out.exists():
        done = {json.loads(line)["probeId"] for line in out.read_text().splitlines() if line.strip()}
    todo = [p for p in prompts if p["probeId"] not in done]
    model, tokenizer = load(model_id)
    sampler = make_sampler(temp=0.7, top_p=0.9)
    jobs = [(p["probeId"], i, tokenizer.apply_chat_template(p["messages"], add_generation_prompt=True)) for p in todo for i in range(k)]
    start = time.time()
    with out.open("a") as handle:
        for offset in range(0, len(jobs), batch):
            chunk = jobs[offset:offset + batch]
            mx.random.seed(7 + offset)
            response = batch_generate(model, tokenizer, [tokens for _, _, tokens in chunk], max_tokens=160, sampler=sampler)
            for (probe_id, i, _), text in zip(chunk, response.texts):
                handle.write(json.dumps({"probeId": probe_id, "sample": i, "text": text}) + "\n")
            handle.flush()
            rate = (offset + len(chunk)) / (time.time() - start)
            print(f"{offset + len(chunk)}/{len(jobs)} samples, {rate:.1f}/s", flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3], *(int(a) for a in sys.argv[4:6]))
