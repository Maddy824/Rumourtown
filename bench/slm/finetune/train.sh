#!/bin/bash
# Existing positional arguments remain valid. Checkpoints are selected by the confirmation
# driver on root-disjoint validation Q with fidelity/leakage guards (methods §5).
set -euo pipefail
cd "$(dirname "$0")/../../.."
MODEL=$1 NAME=$2 SET=$3
shift 3
EPOCHS=2
if [[ ${1:-} != --* && -n ${1:-} ]]; then EPOCHS=$1; shift; fi
SEED=7 DATA_ROOT=bench/slm/data/finetune OUT_ROOT=bench/slm/results/finetune
while (($#)); do
  case $1 in
    --seed) SEED=$2;;
    --data-root) DATA_ROOT=$2;;
    --out-root) OUT_ROOT=$2;;
    *) echo "Unknown training flag $1" >&2; exit 1;;
  esac
  shift 2
done
PY=${RT_MLX_PYTHON:-$HOME/.venvs/rt-mlx/bin/python}
DATA=$DATA_ROOT/$SET OUT=$OUT_ROOT/$NAME
# Validate before any model import. All roots and counts must be present, not guessed.
N=$(python3 bench/slm/finetune/check-data.py "$DATA")
mkdir -p "$OUT"
# mlx-lm drops an incomplete batch. Confirmation data is a multiple of four.
EPOCH_ITERS=$(( N / 4 )) ITERS=$(( (N / 4) * EPOCHS ))
LAYERS=$($PY -c 'import json,sys; from huggingface_hub import snapshot_download; from pathlib import Path; print(json.loads((Path(snapshot_download(sys.argv[1],allow_patterns=["config.json"]))/"config.json").read_text())["num_hidden_layers"])' "$MODEL")
cat > "$OUT/lora.yaml" <<YAML
model: $MODEL
train: true
data: $DATA
fine_tune_type: lora
num_layers: $LAYERS
batch_size: 4
iters: $ITERS
learning_rate: 1.0e-4
steps_per_report: $EPOCH_ITERS
steps_per_eval: $EPOCH_ITERS
val_batches: -1
save_every: $EPOCH_ITERS
max_seq_length: 4608
mask_prompt: true
grad_checkpoint: true
seed: $SEED
adapter_path: $OUT/adapter
lora_parameters:
  keys: ["self_attn.q_proj", "self_attn.k_proj", "self_attn.v_proj", "self_attn.o_proj"]
  rank: 8
  scale: 20.0
  dropout: 0.05
YAML
# Resume at the run boundary. Partial runs are retrained deterministically; a complete
# run is reused only by the driver after checking the input/config fingerprint.
$PY bench/slm/finetune/train-selected.py "$OUT/lora.yaml" 2>&1 | tee "$OUT/train.log"
for epoch in $(seq 1 "$EPOCHS"); do
  CHECKPOINT=$OUT/epoch-$epoch
  mkdir -p "$CHECKPOINT/adapter"
  cp "$OUT/adapter/adapter_config.json" "$CHECKPOINT/adapter/adapter_config.json"
  cp "$OUT/adapter/epoch-$epoch.safetensors" "$CHECKPOINT/adapter/adapters.safetensors"
  $PY -m mlx_lm.fuse --model "$MODEL" --adapter-path "$CHECKPOINT/adapter" --save-path "$CHECKPOINT/fused"
done
# Preserve the historical fused path for run-study.sh. The confirmation driver explicitly
# evaluates both epoch paths and records its guarded validation selection before testing.
$PY -m mlx_lm.fuse --model "$MODEL" --adapter-path "$OUT/adapter" --save-path "$OUT/fused"
$PY bench/slm/finetune/to-peft.py "$OUT/adapter" "$OUT/peft" "$MODEL"
echo "fused model in $OUT/fused; epoch checkpoints in $OUT/epoch-*/fused"
