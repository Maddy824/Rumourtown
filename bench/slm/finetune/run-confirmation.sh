#!/bin/bash
# CPU: --prepare-only | --check. GPU: --launch (only after the existing GPU run ends).
# Resume repeats --launch with identical settings. Missing data/changed settings stop the run.
set -euo pipefail
cd "$(dirname "$0")/../../.."
# Explicit data selection opts into the separate v2 Qwen seed-7 controller.
# Keep the legacy module and its source fingerprint byte-identical for default resumes.
for arg in "$@"; do
  if [[ $arg == --data-dir ]]; then
    exec node --experimental-strip-types bench/slm/finetune/launch-filter-v2.ts "$@"
  fi
done
exec node --experimental-strip-types bench/slm/finetune/confirmation.ts "$@"
