#!/bin/zsh
# LoRA fine-tune one student on the verifier-filtered data, then fuse it for Ollama evaluation.
#   bench/slm/finetune/train.sh <hf-model-id> <run-name> <set: unfiltered|verifier|act> [epochs]
set -euo pipefail
cd "$(dirname "$0")/../../.."
MODEL=$1 NAME=$2 SET=$3 EPOCHS=${4:-3}
PY=~/.venvs/rt-mlx/bin/python
DATA=bench/slm/data/finetune/$SET
OUT=bench/slm/results/finetune/$NAME
mkdir -p $OUT
N=$(wc -l < $DATA/train.jsonl | tr -d ' ')
ITERS=$(( (N * EPOCHS + 3) / 4 ))
LAYERS=$($PY -c "import json,huggingface_hub as h; print(json.load(open(h.snapshot_download('$MODEL', allow_patterns=['config.json'])+'/config.json'))['num_hidden_layers'])")
cat > $OUT/lora.yaml <<YAML
model: $MODEL
train: true
data: $DATA
fine_tune_type: lora
num_layers: $LAYERS
batch_size: 4
iters: $ITERS
learning_rate: 1.0e-4
steps_per_report: 20
steps_per_eval: 100
val_batches: -1
save_every: 1000
max_seq_length: 4608
mask_prompt: true
grad_checkpoint: true
seed: 7
adapter_path: $OUT/adapter
lora_parameters:
  keys: ["self_attn.q_proj", "self_attn.k_proj", "self_attn.v_proj", "self_attn.o_proj"]
  rank: 8
  scale: 20.0
  dropout: 0.05
YAML
echo "training $MODEL on $N examples for $ITERS iterations ($EPOCHS epochs, $LAYERS layers)"
$PY -m mlx_lm.lora -c $OUT/lora.yaml 2>&1 | tee $OUT/train.log
$PY bench/slm/finetune/to-peft.py $OUT/adapter $OUT/peft $MODEL
# Base and fine-tuned models go through the same fuse/import path so only the adapter differs.
$PY -m mlx_lm.fuse --model $MODEL --adapter-path $OUT/adapter --save-path $OUT/fused 2>&1 | tail -1
echo "fused model in $OUT/fused"
