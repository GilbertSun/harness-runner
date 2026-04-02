# Harness Runner

Benchmark platform for comparing autonomous agents across a shared task, profile, and evaluation flow.

## Apps

- `apps/api`: Fastify API for registry management, suite orchestration, and run playback.
- `apps/worker`: worker process that picks queued runs and executes agent adapters.
- `apps/web`: Next.js UI for registry, runs, and compare views.
- `packages/core`: shared domain model, event schema, and storage contracts.

## Local development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in the local machine paths or endpoints you actually have.
3. Start the API: `pnpm --filter @harness-runner/api dev`
4. Start the worker: `pnpm --filter @harness-runner/worker dev`
5. Start the web UI: `pnpm --filter @harness-runner/web dev`

## Local agent configuration

`apps/api` and `apps/worker` load `.env` and `.env.local` from the workspace root.

- `CODEX_COMMAND`: absolute path or command name for Codex CLI
- `CLAUDE_CODE_COMMAND`: absolute path or command name for Claude Code CLI
- `DEERFLOW_ENDPOINT`: optional DeerFlow HTTP endpoint; leave unset if DeerFlow is not deployed
- `NEXT_PUBLIC_API_URL`: optional web app API base URL

When `DEERFLOW_ENDPOINT` is not configured, DeerFlow will not be seeded into the local registry.

The default persistence layer is file-backed and writes to `.data/`. The storage contract is structured so a Postgres-backed implementation can replace it later without changing the API surface.
