import { execFileSync } from 'node:child_process'
import { Client } from 'pg'

/**
 * Makes the E2E run reproducible: every run starts from exactly what `pnpm db:seed` writes —
 * 5 categories, 31 products, 2 demo accounts — regardless of what the previous run left behind.
 *
 * The suite has no teardown by design (every test mints a UUID-suffixed account so parallel
 * workers cannot collide), so without this the database accumulates accounts and draft products
 * on every run and "the same starting state" quietly stops being true.
 *
 * Runs against TEST_DATABASE_URL, never the dev database — see playwright.config.ts.
 */

/** postgres duplicate_database. CREATE DATABASE has no IF NOT EXISTS, so this is the check. */
const DUPLICATE_DATABASE = '42P04'

function maintenanceUrl(url: string) {
  const parsed = new URL(url)
  const database = parsed.pathname.replace(/^\//, '')
  // Connect to the default maintenance database to create the target one.
  parsed.pathname = '/postgres'
  return { maintenance: parsed.toString(), database }
}

async function ensureDatabase(url: string) {
  const { maintenance, database } = maintenanceUrl(url)
  const client = new Client({ connectionString: maintenance })
  await client.connect()
  try {
    // Identifiers cannot be bound as parameters, so the name is quoted rather than interpolated
    // raw. It comes from TEST_DATABASE_URL, not from anything a test supplies.
    await client.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`)
    console.log(`e2e: created ${database}`)
  } catch (error) {
    if ((error as { code?: string }).code !== DUPLICATE_DATABASE) throw error
  } finally {
    await client.end()
  }
}

/**
 * TRUNCATE rather than DROP DATABASE: a drop needs no live connections, and Playwright may
 * already have started the dev server against this database. Drizzle keeps its migration
 * bookkeeping in the `drizzle` schema, so emptying `public` leaves the applied migrations
 * recorded and the schema intact.
 */
async function truncatePublicTables(url: string) {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    )
    if (rows.length === 0) return
    const list = rows.map((row) => `"${row.tablename.replaceAll('"', '""')}"`).join(', ')
    await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
  } finally {
    await client.end()
  }
}

function run(command: string, args: string[], databaseUrl: string) {
  execFileSync(command, args, {
    stdio: 'inherit',
    // The child must see the test database, not whatever .env says.
    env: { ...process.env, DATABASE_URL: databaseUrl },
  })
}

export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — playwright.config.ts should have resolved it')
  }

  await ensureDatabase(databaseUrl)
  // Migrate before truncating: the tables have to exist before they can be emptied, and on a
  // freshly created database this is what creates them.
  run('pnpm', ['db:migrate'], databaseUrl)
  await truncatePublicTables(databaseUrl)
  run('pnpm', ['db:seed'], databaseUrl)
}
