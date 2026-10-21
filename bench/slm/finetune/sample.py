"""Batched teacher sampling with mlx-lm: k samples per prompt at temperature 0.7.

    ~/.venvs/rt-mlx/bin/python bench/slm/finetune/sample.py <hf-model> <prompts.jsonl> <samples.jsonl> [k] [batch]

Appends {"probeId", "sample", "text"} rows and resumes by generating only missing samples.
On GPU memory pressure it halves the batch and retries.
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
    have: dict[str, set[int]] = {}
    if out.exists():
        for line in out.read_text().splitlines():
            if line.strip():
                row = json.loads(line)
                have.setdefault(row["probeId"], set()).add(row["sample"])
    model, tokenizer = load(model_id)
    sampler = make_sampler(temp=0.7, top_p=0.9)
    # Only the samples each probe is missing, so an interrupted run never leaves a probe half-sampled.
    jobs = [(p["probeId"], i, tokenizer.apply_chat_template(p["messages"], add_generation_prompt=True))
            for p in prompts for i in range(k) if i not in have.get(p["probeId"], set())]
    start, offset, done = time.time(), 0, 0
    with out.open("a") as handle:
        while offset < len(jobs):
            chunk = jobs[offset:offset + batch]
            mx.random.seed(7 + offset)
            try:
                response = batch_generate(model, tokenizer, [tokens for _, _, tokens in chunk], max_tokens=160, sampler=sampler)
            except RuntimeError as error:
                # Metal reports memory pressure from other GPU users as a failed command buffer: back off, retry.
                if "Insufficient Memory" not in str(error) or batch == 1:
                    raise
                mx.clear_cache()
                batch = max(1, batch // 2)
                print(f"out of GPU memory; batch now {batch}", flush=True)
                time.sleep(20)
                continue
            for (probe_id, i, _), text in zip(chunk, response.texts):
                handle.write(json.dumps({"probeId": probe_id, "sample": i, "text": text}) + "\n")
            handle.flush()
            offset += len(chunk)
            done += len(chunk)
            print(f"{offset}/{len(jobs)} samples, {done / (time.time() - start):.1f}/s", flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3], *(int(a) for a in sys.argv[4:6]))
