#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Count lines in repository files, excluding common generated/vendor folders.
TOTAL_LINES="$(
  rg --files \
    -g '!node_modules/**' \
    -g '!dist/**' \
    -g '!.git/**' \
    -g '!coverage/**' \
    -g '!build/**' \
    -g '!public/**' \
    -g '!*lock*.json' \
    | xargs wc -l \
    | awk 'END { print $1 }'
)"

echo "Total lines of code (repo files): $TOTAL_LINES"
