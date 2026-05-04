# Memory Stack Documentation

## Overview

This project uses a three-layer memory system:

- **Memory Bank** (`memory-bank/`) — current operating memory
- **Graphify** (`graphify-out/`) — codebase structure map
- **Wiki** (`wiki/` + `raw/`) — durable source-backed knowledge

## Quick Start

### For agents

1. Read `memory-bank/projectbrief.md` to understand the project
2. Read `memory-bank/activeContext.md` for current state
3. Read `memory-bank/progress.md` for what's done and remaining
4. Read `AGENT.md` for project-specific gotchas

### For humans

1. Read `memory-bank/projectbrief.md` for project overview
2. Read `memory-bank/progress.md` for current status
3. Read `wiki/index.md` for durable knowledge

## Files

### Memory Bank

| File | Purpose |
|------|---------|
| `projectbrief.md` | What this project is |
| `productContext.md` | Users, workflows, goals |
| `activeContext.md` | Current focus, state, blockers |
| `systemPatterns.md` | Architecture patterns |
| `techContext.md` | Tech stack and commands |
| `progress.md` | Completed and remaining work |
| `decisions.md` | Decision records |
| `handoff.md` | Session handoff guide |

### Wiki

| File | Purpose |
|------|---------|
| `index.md` | Navigation |
| `log.md` | Operation log |
| `concepts/` | Concept explanations |
| `entities/` | Key entities |
| `syntheses/` | Cross-cutting analysis |
| `questions/` | Open questions |

### Scripts

| File | Purpose |
|------|---------|
| `check-memory-bank.sh` | Verify scaffold completeness |
| `refresh-memory-stack.sh` | Refresh Graphify and llm-wiki |

## Rules

- Keep files short, current, and actionable
- Do not store secrets, credentials, or raw private data
- Do not duplicate Graphify output into Memory Bank
- Do not use Memory Bank as transcript dump
- Update after significant work
