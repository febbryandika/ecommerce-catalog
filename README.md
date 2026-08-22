# E-commerce Catalog

[![CI](https://github.com/febbryandika/ecommerce-catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/febbryandika/ecommerce-catalog/actions/workflows/ci.yml)

**Live demo: https://ecommerce-catalog-mauve-six.vercel.app**

A product catalog where admins manage inventory and customers browse, add to cart, and save
to a wishlist. Product pages are server-rendered for SEO.

> **Status: Phase 12 — deployed.** Everything through the public catalog is in place: the
> toolchain and app shell, the schema and migrations, email/password auth with roles, the admin
> catalog with image upload to Cloudflare R2, TipTap descriptions with marketing copy streaming
> in live from Claude and sanitised on save, the server-rendered grid with search, category
> filter and pagination, product detail pages with `generateMetadata`, and a cart and wishlist
> persisted per user with optimistic updates. Loading, error and empty states, the accessibility
> pass and the test suite have landed on top of that, and the app now runs on Vercel against a
> Neon database. What remains is the screenshots below, and product photography for the seed
> catalogue — the demo currently renders its 31 products without images.

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

Or, to go straight to a green test run on a clean clone:

```bash
pnpm install
pnpm test:all                 # writes .env, starts Postgres, runs both suites
```

`pnpm test:all` creates `.env` from `.env.example` with a generated `BETTER_AUTH_SECRET` **only
if `.env` does not already exist** — it will never overwrite real keys. `ANTHROPIC_API_KEY` and
`R2_*` are left blank, and the two tests that need them skip themselves.

Generate `BETTER_AUTH_SECRET` by hand with `openssl rand -base64 32` if you prefer.

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

| Script                 | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `pnpm dev`             | Dev server                                      |
| `pnpm build`           | Production build                                |
| `pnpm start`           | Serve the production build                      |
| `pnpm lint`            | ESLint (flat config; `next lint` is gone in 16) |
| `pnpm typecheck`       | `next typegen` then `tsc --noEmit`              |
| `pnpm format`          | Prettier write · `format:check` to verify       |
| `pnpm test`            | Vitest unit tests                               |
| `pnpm test:coverage`   | Vitest with a coverage report                   |
| `pnpm test:e2e`        | Playwright E2E                                  |
| `pnpm test:e2e:strict` | Playwright with no retries — flake audit        |
| `pnpm test:all`        | Everything, from a clean clone                  |
| `pnpm db:generate`     | Generate migrations from `src/db/schema.ts`     |
| `pnpm db:migrate`      | Apply migrations                                |
| `pnpm db:seed`         | Seed the demo catalog and accounts (idempotent) |

`typecheck` runs `next typegen` first because Next 16 generates `next-env.d.ts` and the typed
route helpers (`PageProps`, `LayoutProps`) into `.next/types` — neither is committed, so a bare
`tsc --noEmit` would fail on a fresh clone.

Playwright needs its browser once: `pnpm exec playwright install chromium`.

`playwright.config.ts` loads `.env` itself — the upload suite promotes its own throwaway
account to admin over the same database the app uses, the way an admin is made by hand.

## Deployment

Vercel, with a Neon Postgres database in `ap-southeast-1` and the functions pinned to `sin1`
beside it — the grid and detail pages query per request, so a cross-ocean hop would land on
every render. Hobby allows exactly one region.

`vercel.json` carries the whole configuration:

```json
{
  "buildCommand": "pnpm db:migrate && pnpm build",
  "ignoreCommand": "[ \"$VERCEL_ENV\" = production ] && exit 1 || exit 0"
}
```

Migrations run as part of the build rather than by hand, so a failed migration fails the deploy.
The `ignoreCommand` is inverted by Vercel's convention — **exit 0 skips the build, exit 1
proceeds** — so anything that is not `VERCEL_ENV=production` is skipped, and a pull request
branch can never run `drizzle-kit` against the production database. CI already gates pull
requests.

No secrets live in the repository. Every variable in `.env.example` is set as a Vercel
environment variable, with two deliberate differences: `BETTER_AUTH_SECRET` is generated fresh
for production rather than copied from local, and **`TEST_DATABASE_URL` is not set at all** — it
exists only for `e2e/global-setup.ts`, which drops and re-seeds whatever it points at.

### Sanitising in a serverless runtime

Descriptions are sanitised with `sanitize-html` rather than DOMPurify. DOMPurify needs a DOM, and
`isomorphic-dompurify` supplies one with jsdom — which sits on Next's default
`serverExternalPackages` list, so Turbopack leaves it as a runtime `require()` instead of
bundling it. jsdom now reaches the ESM-only `@exodus/bytes`, and Vercel's serverless runtime runs
Node with `require(esm)` disabled, so every page importing the sanitiser returned 500 in
production while working locally. Reproduce that locally with:

```bash
node --no-experimental-require-module -e "require('jsdom')"
```

`sanitize-html` parses instead of needing a DOM and is not on the external list, so it is bundled
and its own ESM dependencies resolve at build time.

## Testing

```bash
pnpm test                     # Vitest, scoped to src/**/*.test.ts
pnpm test:coverage            # the same, with a coverage report
pnpm test:e2e                 # Playwright, scoped to e2e/
pnpm test:all                 # both suites from a clean clone, one command
```

CI runs `lint → typecheck → format:check → vitest → playwright` on every pull request and on
`main`, against a Postgres service container. It deliberately sets no `R2_*` variables: the
upload round-trip test skips itself, and a build with them absent is what proves the S3 client
in `src/lib/r2.ts` is constructed lazily rather than at module load. The admin journey covering
`SPEC` §9 flow 4 mocks R2 and Anthropic at the network boundary instead, so it still runs there.

### The E2E database

Playwright never touches the database `pnpm dev` uses. It runs against `<your database>_test`
(override with `TEST_DATABASE_URL`), which `e2e/global-setup.ts` creates if needed, migrates,
empties and re-seeds **before every run**. Two consequences worth knowing:

- Every run starts from exactly what the seed writes — 5 categories, 31 products, 30 of them
  published, 2 demo accounts — no matter what the previous run left behind. The suite has no
  teardown by design, so without this the accounts and draft products pile up. On this machine
  the dev database had reached 579 accounts before the split.
- Anything you created by hand while developing is safe.

The suite also runs on port **3100**, not 3000, so another project's dev server cannot be
adopted by `reuseExistingServer` and quietly serve the tests the wrong app.

### Reading the coverage report

`pnpm test:coverage` prints a table and writes a browsable one to `coverage/index.html`.

| Column              | Means                                                       |
| ------------------- | ----------------------------------------------------------- |
| `% Stmts`           | statements executed                                         |
| `% Branch`          | branches taken — the column that catches an untested `else` |
| `% Funcs`           | functions called at least once                              |
| `Uncovered Line #s` | the part actually worth reading                             |

**Read the uncovered lines, not the percentage.** The report is scoped to `src/lib/**` — the
pure logic — and deliberately excludes the modules a node-environment unit suite cannot execute:
`auth.ts`, `auth-client.ts`, `cart-queries.ts`, `cart-client.ts`, `wishlist-client.ts` and
`use-hydrated.ts` are React hooks, Drizzle queries or `next/headers` callers, and Playwright
covers them instead. Including them would report a large red block that only says "the E2E suite
tests this".

There are no thresholds, and adding one would be the wrong move: the goal is to see what is
uncovered and judge whether it could silently produce wrong data, not to defend a number.
`r2.ts` sits at ~18% on purpose — `putProductImage` is a network call, and only
`imageObjectKey` beside it is unit-testable.
