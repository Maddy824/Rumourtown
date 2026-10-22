#!/bin/zsh
# Safe default: config/data manifests only. Add --execute to load and train later.
set -euo pipefail
cd "$(dirname "$0")/../../.."
exec ~/.venvs/rt-mlx/bin/python -m bench.slm.neural.grid "$@"
