// Idempotent seed. Categories land now so the admin product form has something to pick from;
// the ~30 products and the two demo accounts arrive with the catalog phase (SPEC 10, 11 step 8).
//
// Run by `node --env-file-if-exists=.env src/db/seed.ts` — bare type-stripping, no bundler. So
// there is no `@/` alias here (Node does not read tsconfig `paths`) and the pool must be closed
// or the process hangs. It also issues plain SQL rather than importing the Drizzle schema:
// `src/db/schema.ts` imports `./auth-schema` extensionless, which Node's ESM resolver rejects,
// and making that chain loadable would mean editing the schema plus enabling
// `allowImportingTsExtensions` in tsconfig — a lot of blast radius for five rows.
import { createId } from '@paralleldrive/cuid2'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const pool = new Pool({ connectionString })

const seedCategories = [
  { name: 'Audio', slug: 'audio' },
  { name: 'Cameras', slug: 'cameras' },
  { name: 'Computers', slug: 'computers' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Wearables', slug: 'wearables' },
]

try {
  let inserted = 0

  for (const { name, slug } of seedCategories) {
    // No conflict target: `name` and `slug` are both unique, and a bare DO NOTHING covers
    // either, which is what makes a re-run a no-op.
    const result = await pool.query(
      'INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [createId(), name, slug],
    )
    inserted += result.rowCount ?? 0
  }

  console.log(`db:seed — ${seedCategories.length} categories ensured, ${inserted} newly inserted.`)
} finally {
  await pool.end()
}
