"""Convert an mlx-lm LoRA adapter into the PEFT layout Workers AI accepts.

Workers AI wants exactly `adapter_config.json` and `adapter_model.safetensors`, rank <= 32, an
unquantised base and `model_type` in the config. mlx-lm stores lora_a as (in, r) and lora_b as
(r, out) with y += scale * x @ a @ b; PEFT stores lora_A.weight (r, in) and lora_B.weight (out, r)
with scaling = alpha / r. So A = a.T, B = b.T and alpha = scale * r.

    ~/.venvs/rt-mlx/bin/python bench/slm/finetune/to-peft.py <mlx-adapter-dir> <out-dir> <base-hf-id>
"""
import json
import sys
from pathlib import Path

import mlx.core as mx


def main(src: str, out: str, base: str) -> None:
    src_dir, out_dir = Path(src), Path(out)
    config = json.loads((src_dir / "adapter_config.json").read_text())
    lora = config["lora_parameters"]
    rank, scale = int(lora["rank"]), float(lora["scale"])
    if rank > 32:
        raise SystemExit(f"rank {rank} is above the Workers AI limit of 32")
    weights = mx.load(str(src_dir / "adapters.safetensors"))
    peft, targets = {}, set()
    for key, value in weights.items():
        module, kind = key.rsplit(".", 1)
        if kind not in ("lora_a", "lora_b"):
            raise SystemExit(f"unexpected adapter tensor {key}")
        targets.add(module.rsplit(".", 1)[1])
        name = "lora_A" if kind == "lora_a" else "lora_B"
        peft[f"base_model.model.{module}.{name}.weight"] = mx.array(value.T).astype(mx.float16)
    out_dir.mkdir(parents=True, exist_ok=True)
    mx.save_safetensors(str(out_dir / "adapter_model.safetensors"), peft, metadata={"format": "pt"})
    model_type = "gemma" if "gemma" in base.lower() else "mistral" if "mistral" in base.lower() else "llama"
    (out_dir / "adapter_config.json").write_text(json.dumps({
        "base_model_name_or_path": base, "peft_type": "LORA", "task_type": "CAUSAL_LM",
        "r": rank, "lora_alpha": scale * rank, "lora_dropout": float(lora.get("dropout", 0.0)),
        "target_modules": sorted(targets), "bias": "none", "fan_in_fan_out": False,
        "inference_mode": True, "model_type": model_type,
    }, indent=2))
    size = (out_dir / "adapter_model.safetensors").stat().st_size
    print(f"{len(peft)} tensors, targets {sorted(targets)}, rank {rank}, alpha {scale * rank}, {size / 1e6:.1f} MB")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
