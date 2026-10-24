#!/bin/bash
# Preparation/check are CPU-only. Only --launch may use the GPU.
set -euo pipefail
cd "$(dirname "$0")/../../.."
export PYTHONDONTWRITEBYTECODE=1 TOKENIZERS_PARALLELISM=false
export USE_TORCH=0 USE_TF=0
exec "${RT_MLX_PYTHON:-$HOME/.venvs/rt-mlx/bin/python}" bench/slm/finetune/speaker-floor.py "$@"
