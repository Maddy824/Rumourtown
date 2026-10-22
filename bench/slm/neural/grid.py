"""Explicit trainable manifests and opt-in grid training (design §3, §8).

The default command reads config/data only. --execute is required to load weights.
"""
import argparse
import json
import math
from pathlib import Path
import numpy as np
from .common import atomic_json, canonical, checkpoint_manifest, digest, file_hash, jsonl

EXPECTED = {'attention': {4: 1146880, 8: 2293760, 16: 4587520},
            'mlp': {4: 1376256, 16: 5505024}, 'both': {4: 2523136, 16: 10092544},
            'output': {4: 611840, 16: 2447360}, 'norm': {0: 65536}}


def cells():
    return ([{'placement': p, 'depth': d, 'rank': r, 'seed': 7}
             for p in ('attention', 'mlp', 'both') for d in ('all', 'bottom', 'top') for r in (4, 16)] +
            [{'placement': 'norm', 'depth': 'all', 'rank': 0, 'seed': 7},
             *[{'placement': 'output', 'depth': 'all', 'rank': r, 'seed': 7} for r in (4, 16)],
             {'placement': 'attention', 'depth': 'all', 'rank': 8, 'seed': 7}])


def cell_name(cell):
    return f'{cell["placement"]}-{cell["depth"]}-r{cell["rank"]}-s{cell["seed"]}'


def module_manifest(config, placement, depth, rank):
    if config['model_type'] != 'qwen3' or config.get('attention_bias') or config.get('mlp_bias'):
        raise ValueError('Grid count contract requires bias-free Qwen3')
    L, h, m = config['num_hidden_layers'], config['hidden_size'], config['intermediate_size']
    hd = config['head_dim']
    q, kv = config['num_attention_heads']*hd, config['num_key_value_heads']*hd
    if depth not in ('all', 'bottom', 'top') or L % 2:
        raise ValueError('Invalid depth')
    if placement not in EXPECTED or rank not in EXPECTED[placement]:
        raise ValueError('Unsupported placement/rank')
    if placement in ('norm', 'output') and depth != 'all':
        raise ValueError('Controls require all depth')
    indices = list(range(L)) if depth == 'all' else list(range(L//2)) if depth == 'bottom' else list(range(L//2, L))
    shapes, modules = {}, []
    def linear(path, input_dim, output_dim):
        modules.append({'path': path, 'input': input_dim, 'output': output_dim})
        shapes[path+'.lora_a'], shapes[path+'.lora_b'] = [input_dim, rank], [rank, output_dim]
    for l in indices:
        base = f'model.layers.{l}.'
        if placement in ('attention', 'both'):
            for name, a, b in (('q_proj', h, q), ('k_proj', h, kv), ('v_proj', h, kv), ('o_proj', q, h)):
                linear(base+'self_attn.'+name, a, b)
        if placement in ('mlp', 'both'):
            for name, a, b in (('gate_proj', h, m), ('up_proj', h, m), ('down_proj', m, h)):
                linear(base+'mlp.'+name, a, b)
        if placement == 'norm':
            for name, dim in (('input_layernorm', h), ('post_attention_layernorm', h),
                              ('self_attn.q_norm', hd), ('self_attn.k_norm', hd)):
                shapes[base+name+'.weight'] = [dim]
    if placement == 'norm':
        shapes['model.norm.weight'] = [h]
    if placement == 'output':
        linear('lm_head', h, config['vocab_size'])
    # §3 r(d_in+d_out); q is not square. Norms include q/k RMSNorm and final RMSNorm.
    count = sum(math.prod(s) for s in shapes.values())
    expected = EXPECTED[placement][rank]//(2 if depth != 'all' else 1)
    if count != expected:
        raise ValueError(f'Design §3 count mismatch: {count} != {expected}')
    return {'placement': placement, 'depth': depth, 'rank': rank, 'block_indices_zero_based': indices,
            'modules': modules, 'tensors': dict(sorted(shapes.items())), 'count': count, 'expected_count': expected,
            'scale': 20., 'peft_alpha': 20*rank, 'dropout': .05,
            'input_embeddings_frozen': True}


def _resolve(model, path):
    current = model
    for part in path.split('.'):
        current = current[int(part)] if part.isdigit() else getattr(current, part)
    return current


def configure(model, manifest):
    """Check actual unquantized tensor dimensions, then exact trainable names/shapes."""
    import mlx.nn as nn
    from mlx_lm.tuner.lora import LoRALinear
    from mlx.utils import tree_flatten, tree_unflatten
    model.freeze()
    if manifest['placement'] == 'output':
        if isinstance(model.model.embed_tokens, nn.QuantizedEmbedding):
            raise ValueError('Output-only control requires the unquantized saved base')
        head = nn.Linear(model.args.hidden_size, model.args.vocab_size, bias=False)
        head.weight = model.model.embed_tokens.weight
        head.freeze()
        model.lm_head = head
        model.args.tie_word_embeddings = False  # input embedding remains unchanged and frozen.
    modules = []
    for spec in manifest['modules']:
        module = _resolve(model, spec['path'])
        if isinstance(module, nn.QuantizedLinear) or list(module.weight.shape) != [spec['output'], spec['input']]:
            raise ValueError(f'Actual linear dimensions differ: {spec["path"]}')
        adapter = LoRALinear.from_base(module, r=manifest['rank'], scale=20., dropout=.05)
        modules.append((spec['path'], adapter))
    if modules:
        model.update_modules(tree_unflatten(modules))
    if manifest['placement'] == 'norm':
        for name in manifest['tensors']:
            _resolve(model, name.rsplit('.', 1)[0]).unfreeze(keys=['weight'])
    observed = {name: list(value.shape) for name, value in tree_flatten(model.trainable_parameters())}
    if observed != manifest['tensors']:
        raise ValueError(f'Trainable tensors differ from expected manifest: {set(observed)^set(manifest["tensors"])}')
    return observed


def training_plan(data_path, cell, config):
    n = sum(1 for _ in jsonl(data_path))
    if not n:
        raise ValueError('Empty training set')
    return {**module_manifest(config, cell['placement'], cell['depth'], cell['rank']),
            'seed': cell['seed'], 'data_hash': file_hash(data_path), 'config_hash': digest(config),
            'source_hash': file_hash(__file__), 'examples': n, 'batch_size': 4, 'epochs': 2,
            'updates': 2*math.ceil(n/4), 'learning_rate': 1e-4, 'optimizer': 'Adam',
            'max_seq_length': 4608, 'mask_prompt': True, 'data_order': 'file order, twice, last batch retained'}


def train_cell(model_dir, data_path, out, plan):
    """Called only behind --execute. Training has no cell-specific stopping/search (§3)."""
    import time
    import mlx.core as mx
    import mlx.nn as nn
    import mlx.optimizers as optim
    from mlx.utils import tree_flatten
    from mlx_lm import load
    directory = Path(out)
    if (directory / 'train.jsonl').exists():
        raise ValueError('Partial grid training exists; use a fresh run directory (no silent restart)')
    model, tokenizer = load(str(model_dir))
    model.freeze()
    mx.random.seed(plan['seed'])
    observed = configure(model, plan)
    atomic_json(directory / 'trainable.json', {'tensors': observed, 'count': sum(math.prod(s) for s in observed.values())})
    # Hash the frozen checkpoint and sources; loading did not authorize any training before assertion.
    atomic_json(directory / 'checkpoint.json', checkpoint_manifest(model_dir, data_paths=[data_path], config=plan))
    data = []
    for row in jsonl(data_path):
        messages = row['messages']
        if messages[-1]['role'] != 'assistant':
            raise ValueError('Training examples must end with assistant target')
        ids = tokenizer.apply_chat_template(messages, return_dict=False, enable_thinking=False)
        prefix = tokenizer.apply_chat_template(messages[:-1], return_dict=False, add_generation_prompt=True, enable_thinking=False)
        if ids[:len(prefix)] != prefix:
            raise ValueError('Chat prefix mismatch in masked training data')
        ids = ids[:plan['max_seq_length']]
        if len(prefix) >= len(ids):
            raise ValueError('Training truncation removed the target')
        data.append((ids, len(prefix)))
    def loss_fn(model, ids, offset, length):
        logits = model(ids[:, :-1])
        position = mx.arange(1, ids.shape[1])[None, :]
        mask = (position >= offset[:, None]) & (position < length[:, None])
        loss = nn.losses.cross_entropy(logits, ids[:, 1:]).astype(mx.float32)
        return mx.sum(loss*mask)/mx.sum(mask)
    step = nn.value_and_grad(model, loss_fn)
    optimizer = optim.Adam(learning_rate=plan['learning_rate'])
    model.train()
    update = 0
    with (directory / 'train.jsonl').open('x') as log:
        for epoch in range(2):
            for start in range(0, len(data), 4):
                batch = data[start:start+4]
                length = np.array([len(ids) for ids, _ in batch], np.int32)
                padded = np.zeros((len(batch), int(length.max())), np.int32)
                for i, (ids, _) in enumerate(batch):
                    padded[i, :len(ids)] = ids
                before = dict(tree_flatten(model.trainable_parameters()))
                began = time.perf_counter()
                loss, grads = step(model, mx.array(padded), mx.array([o for _, o in batch]), mx.array(length))
                optimizer.update(model, grads)
                after = dict(tree_flatten(model.trainable_parameters()))
                norm = mx.sqrt(sum(mx.sum((after[k].astype(mx.float32)-v.astype(mx.float32))**2) for k, v in before.items()))
                mx.eval(model.parameters(), optimizer.state, loss, norm)
                update += 1
                log.write(canonical({'update': update, 'epoch': epoch+1, 'loss': float(loss.item()),
                                     'update_norm': float(norm.item()), 'seconds': time.perf_counter()-began,
                                     'peak_memory_bytes': mx.get_peak_memory(), 'batch_rows': list(range(start, start+len(batch)))})+'\n')
                log.flush()
    if update != plan['updates']:
        raise AssertionError('Fixed-update contract violated')
    weights = dict(tree_flatten(model.trainable_parameters()))
    mx.save_safetensors(str(directory / 'adapters.safetensors'), weights)
    atomic_json(directory / 'adapter_config.json', {'neural_grid': True, 'manifest': plan,
                                                   'base_model': str(model_dir), 'format': 'explicit tensors'})
    atomic_json(directory / 'complete.json', {'updates': update, 'adapter_hash': file_hash(directory / 'adapters.safetensors')})


def load_grid_adapter(model, directory):
    """Norm/output controls require this explicit loader, not mlx_lm.load_adapters."""
    import mlx.core as mx
    directory = Path(directory)
    saved = json.loads((directory / 'adapter_config.json').read_text())
    configure(model, saved['manifest'])
    weights = mx.load(str(directory / 'adapters.safetensors'))
    if {k: list(v.shape) for k, v in weights.items()} != saved['manifest']['tensors']:
        raise ValueError('Saved grid adapter tensor mismatch')
    model.load_weights(list(weights.items()), strict=False)
    model.eval()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--data', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--model', help='Local unquantized model path; needed only with --execute')
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--cells', help='Comma-separated names from the manifest; default all 22')
    parser.add_argument('--seed', type=int, default=7, choices=(7, 17, 29))
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    all_cells = [{**c, 'seed': args.seed} for c in cells()]
    selected = all_cells if not args.cells else [c for c in all_cells if cell_name(c) in args.cells.split(',')]
    if args.cells and len(selected) != len(args.cells.split(',')):
        raise ValueError('Unknown/duplicate cell names')
    if args.seed != 7 and len(selected) != 2:
        raise ValueError('Repeat seeds require the two development-selected cells explicitly')
    plans = {cell_name(c): training_plan(args.data, c, config) for c in selected}
    out = Path(args.out)
    if args.execute and (not args.model or json.loads((Path(args.model)/'config.json').read_text()) != config):
        raise ValueError('--execute requires matching local model/config')
    # Manifests written for every cell before the first checkpoint is loaded.
    for name, plan in plans.items():
        path = out/name/'manifest.json'
        if path.exists() and json.loads(path.read_text()) != plan:
            raise ValueError('Existing grid plan differs')
        atomic_json(path, plan)
    atomic_json(out/'grid.json', {'cells': plans, 'execute': args.execute, 'exploratory': args.seed == 7})
    if args.execute:
        for name, plan in plans.items():
            completion = out/name/'complete.json'
            if completion.exists():
                complete = json.loads(completion.read_text())
                if complete['updates'] != plan['updates'] or complete['adapter_hash'] != file_hash(out/name/'adapters.safetensors'):
                    raise ValueError('Completed grid cell checksum/update mismatch')
            else:
                train_cell(args.model, args.data, out/name, plan)
    print(f'{len(plans)} cell manifests; execute={args.execute}')


if __name__ == '__main__':
    main()
