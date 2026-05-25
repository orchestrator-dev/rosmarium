# Task Completion Checklist

Run these before considering any coding task done:

## TypeScript (cortex-server)
```sh
pnpm --filter @cortex-cms/server typecheck   # must pass 0 errors
pnpm --filter @cortex-cms/server test        # must pass
```

## Python (cortex-ai-worker)
```sh
cd apps/cortex-ai-worker
uv run mypy src/           # must pass clean (37+ source files)
uv run ruff check src/ tests/
uv run pytest              # all tests pass
```

## Database migrations (when adding columns/indexes)
```sh
pnpm db:migrate            # apply pending migrations
```

## Admin UI changes — mandatory
After ANY admin UI change: run `/verify-ui` (use Playwright MCP to verify end-to-end).  
Never skip this for UI changes.

## Commit message format
```
feat(<scope>): <description>
```
Scope examples: `server`, `ai-worker`, `server,ai-worker`, `admin`
