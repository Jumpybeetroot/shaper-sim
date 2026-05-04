# Memory Bank Update Workflow

## When to update

After completing significant work (features, bug fixes, architecture changes, decisions).

## What to update

1. `memory-bank/activeContext.md` — current focus, recent changes, blockers, next steps
2. `memory-bank/progress.md` — completed work, remaining work, known issues
3. `memory-bank/decisions.md` — major technical or product decisions

## How to update

1. Read current state of target files
2. Append or merge new information
3. Keep entries concise and actionable
4. Do not overwrite unrelated content
5. Commit and push after changes

## Promotion to wiki

If a decision is durable project knowledge:
1. Create or update relevant `wiki/` page
2. Append `wiki/log.md` with dated entry
3. Link from `wiki/index.md`
