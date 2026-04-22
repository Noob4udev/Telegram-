# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- `artifacts/web` — Telegram Mass Reporter web app (Express + Vite + Drizzle, PostgreSQL).
  - `pnpm --filter @workspace/web run dev` — dev server (port 5000)
  - `pnpm --filter @workspace/web run build` — production build to `dist/`
  - `pnpm --filter @workspace/web run start` — run production bundle
  - `pnpm --filter @workspace/web run db:push` — push Drizzle schema

## Render Deployment

The repo root contains a `render.yaml` Blueprint that provisions:

- A free PostgreSQL database (`tg-reporter-db`)
- A Node web service that installs the monorepo with pnpm, builds `@workspace/web`, runs `drizzle-kit push`, and serves the bundled Express app

Required env vars are auto-wired by the blueprint:

- `DATABASE_URL` — from the managed database
- `SESSION_SECRET` — auto-generated
- `NODE_ENV=production`, `NODE_VERSION=22`

To deploy: push the repo to GitHub, then on Render choose **New → Blueprint** and point it at the repo. Render will detect `render.yaml` and provision everything automatically.
