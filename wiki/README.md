# Wiki

The wiki is the curated durable archive for this project. It answers: **What durable source-backed knowledge have we preserved?**

## Structure

| Directory | Purpose |
|-----------|---------|
| `sources/` | Immutable source/session material |
| `concepts/` | Concept explanations and relationships |
| `entities/` | Key entities (components, libraries, patterns) |
| `syntheses/` | Cross-cutting analysis and synthesis pages |
| `questions/` | Open questions and research notes |

## Files

| File | Purpose |
|------|---------|
| `index.md` | Navigation and entry point |
| `log.md` | Dated operation log |

## Usage

- For historical, decision, source-backed, or "what did we decide before?" tasks, read `index.md` and `log.md` first
- Search or query `wiki/` before searching raw transcripts
- Durable decisions from `memory-bank/decisions.md` should be promoted here

## Rules

- Keep entries source-backed with file paths, commands, test results
- Do not store secrets, credentials, or raw private data
- Use `log.md` entries in format: `## [YYYY-MM-DD] operation | Description`
