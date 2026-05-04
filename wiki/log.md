# Wiki Log

## [2026-05-04] init | Memory stack bootstrap

Initialized Memory Bank + wiki + raw scaffold per global bootstrap guide (`C:\Users\Beetroot\.agents\docs\AI_MEMORY_STACK_BOOTSTRAP.md`).

**Files created:**
- `memory-bank/` — 9 files (projectbrief, productContext, activeContext, systemPatterns, techContext, progress, decisions, handoff, README)
- `wiki/` — index.md, log.md, README.md, plus directory scaffold
- `raw/` — README.md, sources/
- `scripts/` — check-memory-bank.sh, refresh-memory-stack.sh
- `.agents/` — rules/memory-stack.md, workflows/
- `.codex/README.md`, `.opencode/README.md`
- `.graphifyignore`, `.llmwikiignore`
- `docs/MEMORY_STACK.md`

**Sources used:**
- `README.md` — project overview and features
- `AGENT.md` — critical architecture gotchas
- `shaper-sim-react/src/types.ts` — AppState interface
- `shaper-sim-react/package.json` — dependencies and scripts
- `implementation_plan.md` — speed simulation architecture

**Verification:**
- Graphify: not available (python -m graphify not found)
- llm-wiki: not available (llmwiki command not found)
- Memory Bank scaffold: complete

## [2026-05-04] cleanup | Legacy memory tool references

Removed stale references to the old external memory tool from repo/global agent state. Use Memory Bank and the global bootstrap guide for memory workflow going forward.

**Verification:**
- Scoped cleanup scan across this repo, `.agents`, `.codex`, `.claude`, `.kimi`, and Antigravity brain state found zero remaining matching text files.
- Process scan found zero remaining processes from the removed tool path.
