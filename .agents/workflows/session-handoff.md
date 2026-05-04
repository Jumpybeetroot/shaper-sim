# Session Handoff Workflow

## When to handoff

At the end of a significant work session, before closing.

## How to handoff

1. Update `memory-bank/activeContext.md`:
   - Current focus
   - Recent changes
   - Blockers
   - Next steps

2. Update `memory-bank/progress.md`:
   - Completed work
   - Remaining work
   - Known issues
   - Last verified commands

3. Update `memory-bank/handoff.md`:
   - Read order for new session
   - Current safety/operational posture
   - Immediate next action

4. If durable knowledge was discovered:
   - Update `memory-bank/decisions.md`
   - Promote to relevant `wiki/` page
   - Append `wiki/log.md`

5. Commit and push all changes

## Rules

- Keep handoff concise and actionable
- Include exact file paths and commands
- Do not store secrets or credentials
