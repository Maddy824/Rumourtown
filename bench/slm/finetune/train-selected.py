"""Train with mlx-lm's public training function; snapshot exact epoch boundaries.
Only invoked by train.sh on the GPU host. Importing/compiling this file loads no model.
Validation callback sees iteration-1 (before the next update), unlike save_every.
"""
import json
from pathlib import Path
import sys


def main(config_path):
    import types
    import numpy as np
    import yaml
    import mlx.core as mx
    from mlx.utils import tree_flatten
    from mlx_lm import lora
    from mlx_lm.utils import load
    from mlx_lm.tuner.callbacks import TrainingCallback
    from mlx_lm.tuner.datasets import load_dataset

    config = yaml.safe_load(Path(config_path).read_text())
    args = types.SimpleNamespace(**(lora.CONFIG_DEFAULTS | config))
    np.random.seed(args.seed)
    mx.random.seed(args.seed)
    model, tokenizer = load(args.model)
    train, valid, _ = load_dataset(args, tokenizer)
    out = Path(args.adapter_path)
    out.mkdir(parents=True, exist_ok=True)

    class Snapshot(TrainingCallback):
        def on_val_loss_report(self, info):
            # Methods §5 development-only selection; these loss diagnostics never see confirmation.
            with (out.parent / 'validation.jsonl').open('a') as f:
                f.write(json.dumps(info) + '\n')

        def on_train_loss_report(self, info):
            iteration = info['iteration']
            if iteration % config['save_every'] == 0:
                mx.save_safetensors(str(out / f'epoch-{iteration // config["save_every"]}.safetensors'), dict(tree_flatten(model.trainable_parameters())))

    lora.train_model(args, model, train, valid, Snapshot())
    # The trainer evaluates before its final update; save the actual final epoch separately.
    mx.save_safetensors(str(out / f'epoch-{config["iters"] // config["save_every"]}.safetensors'), dict(tree_flatten(model.trainable_parameters())))


if __name__ == '__main__':
    main(sys.argv[1])
