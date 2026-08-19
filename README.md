# E-commerce Catalog

[![CI](https://github.com/febbryandika/ecommerce-catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/febbryandika/ecommerce-catalog/actions/workflows/ci.yml)

A product catalog where admins manage inventory and customers browse, add to cart, and save
to a wishlist. Product pages are server-rendered for SEO.

> **Status: Phase 7 — AI description editor.** The toolchain, app shell, catalog schema,
> email/password auth, the admin catalog, image upload to Cloudflare R2 and the demo seed are
> in place: `/admin/products` lists, creates, edits, publishes and deletes products, each with
> one uploaded image, and `pnpm db:seed` fills the catalog with 31 products and two demo
> accounts. Product descriptions are now edited in TipTap, with marketing copy streaming in
> live from Claude and sanitised on save. The public catalog, cart and wishlist still render
> placeholders.

## Demo accounts

`pnpm db:seed` creates both. They are demo credentials, published on purpose — do not reuse
this password anywhere that matters.

| Role     | Email                       | Password            |
| -------- | --------------------------- | ------------------- |
| Admin    | `demo-admin@example.com`    | `demo-password-123` |
| Customer | `demo-customer@example.com` | `demo-password-123` |

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
pnpm db:seed                  # 5 categories, 31 products, 2 demo accounts
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

## Seed data

`pnpm db:seed` fills an empty database with something worth looking at — 5 categories, 31
products with real names and whole-yen prices, and the two demo accounts above. Stock is varied
deliberately: one product is out of stock and two sit in low single digits, so those states have
something to render. Five products carry full multi-paragraph descriptions, and one is left
unpublished so the admin list shows a draft while the public grid filters it out.

It is **idempotent**. Products conflict on `slug` and existing rows are left alone, which means a
re-run costs nothing and — deliberately — does not overwrite anything you changed while poking
at the demo. It seeds no cart or wishlist rows: a fresh visitor should find both empty.

Product photos are not committed. Drop them in `seed/images/`, named after each product's slug —
`seed/images/README.md` lists every expected filename. The script uploads what it finds to R2
under a stable `seed/<slug>` key, so a photo is uploaded exactly once no matter how often you
re-run; to replace one, delete the object from the bucket first. A missing file is not an error,
just a product with no image, and every one of them is named in the summary line.

Without `R2_*` set the image step skips itself entirely and the seed still runs end to end —
the same gate `pnpm test:e2e` uses for its upload round-trip. Products seeded that way keep a
null `image_url`, and a later run with R2 configured fills it in.

Two things the script does that the app cannot:

- It writes the `user` and `account` rows directly, hashing the password with Better Auth's own
  scrypt. There is no HTTP request that can create an **admin** — `role` is declared
  `input: false`, so `/api/auth/sign-up/email` silently rewrites it to `customer`. This is the
  same promote-by-SQL route documented under "Accounts and roles".
- It talks to Postgres in plain SQL rather than through Drizzle. `pnpm db:seed` runs the script
  on bare Node type-stripping with no bundler, so tsconfig `paths` do not resolve and
  `src/db/schema.ts` — which imports `./auth-schema` without a file extension — cannot be
  loaded. Every import in `scripts/seed.ts` is a package specifier for that reason.

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
| `pnpm db:seed`     | Seed the demo catalog and accounts (idempotent) |

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

CI runs `lint → typecheck → format:check → vitest → playwright` on every pull request and on
`main`, against a Postgres service container. It deliberately sets no `R2_*` variables: the
upload round-trip test skips itself, and a build with them absent is what proves the S3 client
in `src/lib/r2.ts` is constructed lazily rather than at module load.
