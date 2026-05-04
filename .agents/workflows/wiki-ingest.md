# Wiki Ingest Workflow

## When to ingest

When durable project knowledge is discovered:
- Architecture decisions
- Design patterns
- Implementation gotchas
- External reference material

## How to ingest

1. Create or update relevant `wiki/` page:
   - `wiki/concepts/` — concept explanations
   - `wiki/entities/` — key entities (components, libraries, patterns)
   - `wiki/syntheses/` — cross-cutting analysis

2. Add dated entry to `wiki/log.md`:
   ```markdown
   ## [YYYY-MM-DD] ingest | Description
   ```

3. Update `wiki/index.md` if adding new page

4. Link from relevant `memory-bank/` files

## Rules

- Keep entries source-backed with file paths, commands, test results
- Do not store secrets, credentials, or raw private data
- Do not duplicate Memory Bank content — link to it instead
