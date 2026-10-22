#!/bin/bash
# CPU: --prepare-only | --check. GPU: --launch (only after the existing GPU run ends).
# Resume repeats --launch with identical settings. Missing data/changed settings stop the run.
set -euo pipefail
cd "$(dirname "$0")/../../.."
exec node --experimental-strip-types bench/slm/finetune/confirmation.ts "$@"
