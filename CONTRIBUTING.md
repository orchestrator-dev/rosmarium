# Contributing to Rosmarium CMS

Welcome to Rosmarium CMS! We're building a modern, extensible AI-first content management system and we are thrilled you're interested in contributing.

## Before you start

- Check open issues before starting work to ensure no one else is already working on the same problem.
- Discuss significant changes in an issue first so we can align on the approach before you write code.
- Read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

**Prerequisites:**
- Node.js 22 LTS
- pnpm 9+
- Python 3.12
- uv
- Docker or Podman
- Ollama (optional, for local embeddings)

**Step by step:**
```bash
git clone https://github.com/orchestrator-dev/rosmarium.git
cd rosmarium
pnpm install
cp .env.example .env
pnpm infra:up
pnpm infra:init
pnpm db:migrate
pnpm db:seed
```

**Running the services:**
- **rosmarium-server**: `pnpm --filter @rosmarium-cms/server dev`
- **rosmarium-ai-worker**: `pnpm worker:dev`

**Running tests:**
- Server: `pnpm --filter @rosmarium-cms/server test`
- AI worker: `pnpm worker:test`

## Branch and commit conventions

- Branch naming:
  - Feature branches: `feat/<scope>/<short-description>`
  - Fix branches: `fix/<scope>/<short-description>`
  - Chore branches: `chore/<scope>/<short-description>`
- Commit format (Conventional Commits): `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`
  - Scopes: `server`, `admin`, `ai-worker`, `cli`, `types`, `sdk`, `deploy`, `docs`
- PR rules: Every PR must reference an issue or milestone task.
- **Never commit directly to main or develop.** Always use a feature branch and submit a PR.

## Where things live

| Package | What it does | Language |
|---|---|---|
| `rosmarium-server` | CMS API, GraphQL, Auth, Assets | TypeScript |
| `rosmarium-admin` | Admin UI | TypeScript/React |
| `rosmarium-ai-worker` | AI pipeline, embeddings, RAG | Python |
| `rosmarium-cli` | Developer CLI | Go |
| `packages/types` | Shared TypeScript types | TypeScript |
| `packages/sdk` | API client | TypeScript |

## Adding a new content type

To add a new content type, refer to the `/new-content-type` workflow in `.agent/workflows/`.

We use a registry pattern for content types. When adding a new content type, you define its schema and register it with the core service. It then automatically becomes available via the API, the database layer, and the Admin UI without needing ad-hoc routing.

## Working on the AI worker

- **Python 3.12 and uv are required.**
- Run `pnpm worker:typecheck` for mypy type checking.
- Run `pnpm worker:lint` for ruff linting.
- Never call real OpenAI/Cohere/Ollama APIs in tests. Always mock them to ensure tests are fast and deterministic.

## Submitting a PR

- Your PR description must include: What changed, Why, and How to test.
- CI must pass entirely before your code can be reviewed.
- Breaking API changes require a `BREAKING CHANGE:` footer in the commit message.

## Getting help

- Open a GitHub Discussion for questions or architectural discussions.
- Open an Issue for bug reports or feature requests.
- Tag maintainers only for security issues.
