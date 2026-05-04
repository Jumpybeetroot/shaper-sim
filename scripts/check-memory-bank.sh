#!/usr/bin/env bash
set -euo pipefail

required=(
  AGENTS.md
  memory-bank/projectbrief.md
  memory-bank/productContext.md
  memory-bank/activeContext.md
  memory-bank/systemPatterns.md
  memory-bank/techContext.md
  memory-bank/progress.md
  memory-bank/decisions.md
  memory-bank/handoff.md
  wiki/index.md
  wiki/log.md
  raw/README.md
  .graphifyignore
  .llmwikiignore
)

missing=0
for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "missing: $file"
    missing=1
  fi
done

if [[ "$missing" -eq 0 ]]; then
  echo "Memory Bank scaffold looks complete."
else
  echo "Memory Bank scaffold is incomplete."
  exit 1
fi
