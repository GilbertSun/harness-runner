# Harness Runner

Benchmark platform for comparing autonomous agents across a shared task, profile, and evaluation flow.

## Apps

- `apps/api`: Fastify API for registry management, suite orchestration, and run playback.
- `apps/worker`: worker process that picks queued runs and executes agent adapters.
- `apps/web`: Next.js UI for registry, runs, and compare views.
- `packages/core`: shared domain model, event schema, and storage contracts.

## Local development

1. Install dependencies with `pnpm install`.
2. Start the API: `pnpm --filter @harness-runner/api dev`
3. Start the worker: `pnpm --filter @harness-runner/worker dev`
4. Start the web UI: `pnpm --filter @harness-runner/web dev`

The default persistence layer is file-backed and writes to `.data/`. The storage contract is structured so a Postgres-backed implementation can replace it later without changing the API surface.
