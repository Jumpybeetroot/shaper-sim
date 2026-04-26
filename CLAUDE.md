# AI Agent Instructions

## Mandatory Workflow
Any AI agent working in this repository MUST follow this workflow for saving changes:
1. Whenever you modify, create, or delete a file, you must immediately commit the changes.
2. The commit message should briefly describe what was changed (e.g., `wip: AI auto-save - [description]`).
3. After every change, you MUST push to the WIP GitHub branch (`wip-local-testing`).

**Commands to run after making changes:**
```bash
git add .
git commit -m "wip: AI auto-save - [description]"
git push origin wip-local-testing
```
Do NOT wait for the user to ask you to commit. Do it automatically as part of your task completion.
