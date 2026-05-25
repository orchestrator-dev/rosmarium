# Suggested Commands

## Root (run from `/home/manu/lab/rosmarium`)
```sh
pnpm dev                   # start all apps in dev mode (Turborepo)
pnpm build                 # build all apps
pnpm test                  # run all tests
pnpm typecheck             # typecheck all TS apps
pnpm lint                  # lint all
pnpm db:generate           # drizzle-kit generate (server only)
pnpm db:migrate            # drizzle-kit migrate (server only)
pnpm db:seed               # seed database
pnpm db:studio             # drizzle-kit studio
pnpm infra:up              # start infra containers (podman compose / docker compose)
pnpm infra:down            # stop infra
pnpm infra:reset           # stop + remove volumes
pnpm infra:init            # init profile (first time setup)
pnpm infra:logs            # follow container logs
pnpm infra:psql            # open psql shell in rosmarium-postgres container
```

## Per-app (filter syntax)
```sh
pnpm --filter @rosmarium-cms/server typecheck
pnpm --filter @rosmarium-cms/server test
pnpm --filter @rosmarium-cms/server db:migrate
```

## rosmarium-server dev (standalone)
```sh
cd apps/rosmarium-server
pnpm dev        # tsx watch --env-file=../../.env src/index.ts
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest run
```

## rosmarium-ai-worker (Python / uv)
```sh
cd apps/rosmarium-ai-worker
uv run uvicorn rosmarium_ai_worker.main:app --reload --port 8001
uv run pytest                          # run all tests
uv run pytest tests/test_search.py     # specific test file
uv run mypy src/                       # type check
uv run ruff check src/ tests/          # lint
uv run ruff format src/ tests/         # format
```

## Worker type check alias (from MASTER_PROMPT)
```sh
pnpm worker:typecheck   # equivalent: cd apps/rosmarium-ai-worker && uv run mypy src/
```
(Note: verify exact script in ai-worker package.json if this alias doesn't exist at root level)
