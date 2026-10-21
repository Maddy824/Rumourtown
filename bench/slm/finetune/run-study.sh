#!/bin/zsh
# The fine-tuning study end to end, after sample.py has written data/finetune/samples.jsonl:
# filter, train each student and condition, then evaluate base and tuned models on the held-out splits
# through one mlx-lm server, so only the adapter differs between a base and its tuned model.
#   bench/slm/finetune/run-study.sh [eval-limit]
set -uo pipefail
cd "$(dirname "$0")/../../.."
LIMIT=${1:-240}
PY=~/.venvs/rt-mlx/bin/python
OUT=bench/slm/results/finetune
PORT=8765
mkdir -p $OUT
log() { echo "=== $* $(date +%H:%M)"; }

log filter
node --experimental-strip-types bench/slm/finetune/make-data.ts filter || exit 1
cat bench/slm/data/finetune/stats.json
# The same accepted, on-act replies in the live /play format, for a Workers AI adapter.
node --experimental-strip-types bench/slm/finetune/game-format.ts --set act || log "game-format conversion failed"

# Student, run name, training set. The deployable Workers AI student first.
RUNS=(
  "mlx-community/Llama-3.2-3B-Instruct llama3b-act act"
  "mlx-community/Qwen3-0.6B-bf16 qwen06b-act act"
  "mlx-community/Qwen3-0.6B-bf16 qwen06b-verifier verifier"
  "mlx-community/Qwen3-0.6B-bf16 qwen06b-unfiltered unfiltered"
  "mlx-community/Llama-3.2-1B-Instruct-bf16 llama1b-act act"
  "mlx-community/Llama-3.2-3B-Instruct llama3b-act-game act-game"
)
for spec in "${RUNS[@]}"; do
  set -- ${=spec}
  if [ -d $OUT/$2/fused ]; then log "skip trained $2"; continue; fi
  log "train $2"
  bench/slm/finetune/train.sh $1 $2 $3 3 2>&1 | grep -E "training|Iter|val|tensors|fused|Error|error" | tail -8
done

serve() {
  pkill -f "mlx_lm.server" 2>/dev/null; sleep 1
  ($PY -m mlx_lm.server --host 127.0.0.1 --port $PORT --model $1 > $OUT/server.log 2>&1 &)
  for i in {1..120}; do curl -s 127.0.0.1:$PORT/v1/models >/dev/null 2>&1 && return 0; sleep 2; done
  return 1
}
evaluate() { # model-path label strategies
  for split in test-seed test-mechanism; do
    local dir=$OUT/eval/$2/$split
    local flag=(--out $dir); [ -d $dir ] && flag=(--resume $dir)
    node --experimental-strip-types bench/slm/run.ts --models "mlx:$1" --strategies $3 --split $split --limit $LIMIT --concurrency 1 $flag 2>&1 | tail -1
  done
}

EVALS=(
  "mlx-community/Llama-3.2-3B-Instruct llama3b-base grounded,best-of"
  "$PWD/$OUT/llama3b-act/fused llama3b-act grounded"
  "mlx-community/Qwen3-0.6B-bf16 qwen06b-base grounded,best-of"
  "$PWD/$OUT/qwen06b-act/fused qwen06b-act grounded"
  "$PWD/$OUT/qwen06b-verifier/fused qwen06b-verifier grounded"
  "$PWD/$OUT/qwen06b-unfiltered/fused qwen06b-unfiltered grounded"
  "mlx-community/Llama-3.2-1B-Instruct-bf16 llama1b-base grounded,best-of"
  "$PWD/$OUT/llama1b-act/fused llama1b-act grounded"
)
for spec in "${EVALS[@]}"; do
  set -- ${=spec}
  if [[ $1 == /* && ! -d $1 ]]; then log "skip eval $2 (not trained)"; continue; fi
  log "eval $2"
  serve $1 || { log "server failed for $2"; continue; }
  evaluate $1 $2 $3
done
pkill -f "mlx_lm.server" 2>/dev/null
node --experimental-strip-types bench/slm/rescore.ts $OUT/eval/* 2>&1 | tail -2
log "study done"
