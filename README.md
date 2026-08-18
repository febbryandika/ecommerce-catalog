# E-commerce Catalog

A product catalog where admins manage inventory and customers browse, add to cart, and save
to a wishlist. Product pages are server-rendered for SEO.

> **Status: Phase 1 — project setup.** The toolchain, folder skeleton and app shell are in
> place. Routes render placeholders; there is no database schema, auth or business logic yet.

## Tech stack

| Area    | Choice                                                 |
| ------- | ------------------------------------------------------ |
| App     | Next.js 16 (App Router) · React 19 · TypeScript · pnpm |
| UI      | Tailwind CSS v4 · shadcn/ui (Radix primitives)         |
| Data    | PostgreSQL · Drizzle ORM · drizzle-kit                 |
| Quality | ESLint · Prettier · Vitest · Playwright                |

## Local setup

```bash
pnpm install
cp .env.example .env          # then fill in the blanks
docker compose up -d          # Postgres 16 on localhost:5437
pnpm db:migrate
pnpm dev                      # http://localhost:3000
```

Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`.

Postgres is published on **5437** rather than the default 5432 to avoid colliding with other
local databases. `DATABASE_URL` in `.env.example` already matches.

## Scripts

| Script             | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `pnpm dev`         | Dev server                                      |
| `pnpm build`       | Production build                                |
| `pnpm start`       | Serve the production build                      |
| `pnpm lint`        | ESLint (flat config; `next lint` is gone in 16) |
| `pnpm typecheck`   | `next typegen` then `tsc --noEmit`              |
| `pnpm format`      | Prettier write · `format:check` to verify       |
| `pnpm test`        | Vitest unit tests                               |
| `pnpm test:e2e`    | Playwright E2E                                  |
| `pnpm db:generate` | Generate migrations from `src/db/schema.ts`     |
| `pnpm db:migrate`  | Apply migrations                                |
| `pnpm db:seed`     | Seed categories, products and demo accounts     |

`typecheck` runs `next typegen` first because Next 16 generates `next-env.d.ts` and the typed
route helpers (`PageProps`, `LayoutProps`) into `.next/types` — neither is committed, so a bare
`tsc --noEmit` would fail on a fresh clone.

Playwright needs its browser once: `pnpm exec playwright install chromium`.

## Testing

```bash
pnpm test                     # Vitest, scoped to src/**/*.test.ts
pnpm test:e2e                 # Playwright, scoped to e2e/
```
