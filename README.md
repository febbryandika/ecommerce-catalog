# E-commerce Catalog

A product catalog where admins manage inventory and customers browse, add to cart, and save
to a wishlist. Product pages are server-rendered for SEO.

> **Status: Phase 5 — product images.** The toolchain, app shell, catalog schema,
> email/password auth, the admin catalog and image upload to Cloudflare R2 are in place:
> `/admin/products` lists, creates, edits, publishes and deletes products, each with one
> uploaded image. The AI description editor, the public catalog, cart and wishlist still
> render placeholders.

## Tech stack

| Area    | Choice                                                 |
| ------- | ------------------------------------------------------ |
| App     | Next.js 16 (App Router) · React 19 · TypeScript · pnpm |
| UI      | Tailwind CSS v4 · shadcn/ui (Radix primitives)         |
| Data    | PostgreSQL · Drizzle ORM · drizzle-kit                 |
| Auth    | Better Auth (email + password, `role` field)           |
| Storage | Cloudflare R2 via `@aws-sdk/client-s3`                 |
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

## Accounts and roles

Sign up at `/signup`. Every account is created with the `customer` role — `role` is declared
`input: false` in the Better Auth config, so a client cannot assign itself `admin` at signup
(there is an end-to-end test that attempts exactly that). Admins are promoted by hand:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
```

`src/proxy.ts` bounces anonymous visitors away from `/admin/*`, but it is only a cookie-presence
check for routing convenience — it cannot see the role. Authorization is enforced separately,
via `requireRole('admin')`: `src/app/admin/layout.tsx` redirects a signed-in customer back to
the catalog, and every admin Server Action re-checks the role independently, so a forged cookie
or a direct action call still gets nothing.

## Product images

One image per product, uploaded from the admin form to Cloudflare R2.

Set up a bucket before the upload works:

1. Create an R2 bucket, then enable its public **r2.dev** URL (or attach a custom domain).
2. Create an R2 **API token** scoped to _Object Read & Write_ on that bucket.
3. Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and
   `R2_PUBLIC_URL` in `.env`, then **restart the dev server** — `next.config.ts` reads
   `R2_PUBLIC_URL` at boot to build `images.remotePatterns`, so an edit alone will not take.

The file is POSTed to `/api/upload`, which re-checks `requireRole('admin')` itself — `proxy.ts`
matches `/admin/:path*` only and never sees this route. It accepts JPEG, PNG and WebP up to 5 MB,
validated server-side regardless of the input's `accept` attribute, and stores each object under
a fresh cuid2 key so two uploads can never collide. Uploads go **through** the app rather than
via presigned direct-to-R2 URLs, which keeps the credentials server-side; they never reach the
browser bundle.

Two limits worth knowing rather than discovering:

- Replacing or deleting a product leaves its old object in the bucket. There is no cleanup job
  and no lifecycle rule — acceptable at this scale, but it is a real cost over time.
- `pnpm test:e2e` **skips** the upload round-trip test when `R2_BUCKET` is unset. The
  authorization and validation tests still run; only the live bucket write is gated.

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
| `pnpm db:seed`     | Seed the 5 catalog categories (idempotent)      |

`typecheck` runs `next typegen` first because Next 16 generates `next-env.d.ts` and the typed
route helpers (`PageProps`, `LayoutProps`) into `.next/types` — neither is committed, so a bare
`tsc --noEmit` would fail on a fresh clone.

Playwright needs its browser once: `pnpm exec playwright install chromium`.

`playwright.config.ts` loads `.env` itself — the upload suite promotes its own throwaway
account to admin over the same database the app uses, the way an admin is made by hand.

## Testing

```bash
pnpm test                     # Vitest, scoped to src/**/*.test.ts
pnpm test:e2e                 # Playwright, scoped to e2e/
```
