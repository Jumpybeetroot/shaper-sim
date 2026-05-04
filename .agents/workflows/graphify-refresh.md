# Graphify Refresh Workflow

## When to refresh

After modifying code files, especially:
- Adding/removing modules
- Changing imports or dependencies
- Refactoring architecture
- Adding new components or libraries

## How to refresh

1. Check if Graphify is available:
   ```bash
   python -m graphify --help
   ```

2. If available, update the graph:
   ```bash
   python -m graphify update .
   ```

3. Review output:
   - `graphify-out/GRAPH_REPORT.md` — god nodes, community structure
   - `graphify-out/graph.json` — full graph data

4. Update `memory-bank/progress.md` with refresh status

## If Graphify is not available

Record the blocker in `memory-bank/progress.md` and continue working.
