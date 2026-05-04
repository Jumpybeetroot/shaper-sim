# Project Agent Contract

This repository uses a three-layer project memory system:

- `memory-bank/` is the current operating memory: what the project is, what is in progress, what changed recently, and what to do next.
- `graphify-out/` is the structural map: codebase relationships, architecture hubs, dependency paths, and cross-file connections.
- `wiki/` plus `raw/` is the curated durable archive: source-backed project knowledge, decisions, concepts, entities, and synthesis pages.

## Start-of-task protocol

For every non-trivial task, read these first:

1. `memory-bank/projectbrief.md`
2. `memory-bank/activeContext.md`
3. `memory-bank/progress.md`

Then route by task type:

- Architecture, refactor, dependency, unfamiliar-code, or "what connects X to Y?" tasks:
  - Read `memory-bank/systemPatterns.md`
  - Read `memory-bank/techContext.md`
  - Read `graphify-out/GRAPH_REPORT.md` if it exists
  - Use focused Graphify queries rather than loading `graphify-out/graph.json` into context

- Product, UX, requirements, or operator-workflow tasks:
  - Read `memory-bank/productContext.md`

- Historical, decision, source-backed, or "what did we decide before?" tasks:
  - Read `wiki/index.md`
  - Read `wiki/log.md`
  - Search or query `wiki/` before searching raw transcripts

## Tool ownership

- Memory Bank owns current working state.
- Graphify owns repo/code/docs structure.
- llm-wiki owns durable knowledge and source/session archive output.

Do not duplicate Graphify's graph into Memory Bank. Link to Graphify output instead.
Do not use Memory Bank as a transcript dump. Keep files short, current, and actionable.
Do not let generated llm-wiki pages overwrite curated Memory Bank files.

## End-of-task protocol

After significant work:

1. Update `memory-bank/activeContext.md` with current focus, recent changes, blockers, and next steps.
2. Update `memory-bank/progress.md` with completed work, remaining work, known issues, and last verified commands.
3. Add major technical or product decisions to `memory-bank/decisions.md`.
4. If the decision is durable project knowledge, promote it to a relevant `wiki/` page and append `wiki/log.md`.
5. For architecture or dependency changes, refresh Graphify output when appropriate.

## Safety and privacy

Never write secrets, API keys, credentials, access tokens, private customer data, or raw proprietary dumps into:

- `AGENTS.md`
- `memory-bank/`
- `wiki/`
- `raw/`
- `graphify-out/`
- `.agents/`
- `.codex/`
- `.opencode/`

Use `.gitignore`, `.graphifyignore`, and `.llmwikiignore` aggressively.

## Graphify

This project has a Graphify knowledge graph at `graphify-out/`.

Rules:

- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure.
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files.
- For cross-module relationship questions, prefer:
  - `python -m graphify query "<question>"`
  - `python -m graphify path "<A>" "<B>"`
  - `python -m graphify explain "<concept>"`
- After modifying code files, run `python -m graphify update .` to keep the graph current.
