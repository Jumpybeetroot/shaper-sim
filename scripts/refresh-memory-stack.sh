#!/usr/bin/env bash
set -euo pipefail

printf '\n== Refreshing Memory Stack ==\n'

if python -m graphify --help >/dev/null 2>&1; then
  echo "Refreshing Graphify graph with python -m graphify update ."
  python -m graphify update . || true
elif command -v graphify >/dev/null 2>&1; then
  echo "Refreshing Graphify graph with graphify update ."
  graphify update . || true
else
  echo "Skipping Graphify: graphify command not found."
fi

if command -v llmwiki >/dev/null 2>&1; then
  echo "Syncing/building llm-wiki..."
  llmwiki sync || true
  llmwiki all || true
else
  echo "Skipping llm-wiki: llmwiki command not found."
fi

echo "Refresh complete. Review graphify-out/GRAPH_REPORT.md, wiki/log.md, and memory-bank/progress.md."
