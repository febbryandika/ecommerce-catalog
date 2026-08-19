// Idempotent demo seed: 5 categories, 31 products, their images in R2, and the two demo
// accounts the README publishes (SPEC 10, 11 step 8). An empty grid on a live demo is worse
// than no demo, so this is what a reviewer sees first.
//
// Run by `node --env-file-if-exists=.env scripts/seed.ts` — bare type-stripping, no bundler.
// So there is no `@/` alias here (Node does not read tsconfig `paths`) and the pool must be
// closed or the process hangs. It also issues plain SQL rather than importing the Drizzle
// schema: `src/db/schema.ts` imports `./auth-schema` extensionless, which Node's ESM resolver
// rejects, and making that chain loadable would mean editing the schema plus enabling
// `allowImportingTsExtensions` in tsconfig. Every import below is a bare specifier for the
// same reason — that is the constraint this file is written around, not an oversight.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createId } from '@paralleldrive/cuid2'
import { hashPassword } from 'better-auth/crypto'
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

type SeedProduct = {
  slug: string
  name: string
  category: string
  price: number
  stock: number
  description: string
  isPublished?: boolean
}

// Slugs are hand-written rather than derived from the name: they are also the image filename
// contract in seed/images/, so they have to stay stable when a name is edited.
//
// price is whole yen — JPY has no minor unit and the column is `integer` (SPEC 3.2). Stock is
// varied on purpose: one product is out of stock and two sit in low single digits, so the
// out-of-stock and low-stock states have something to render (SPEC 10).
const seedProducts: SeedProduct[] = [
  {
    slug: 'aurora-over-ear-headphones',
    name: 'Aurora Over-Ear Headphones',
    category: 'audio',
    price: 34800,
    stock: 18,
    description:
      '<p>The Aurora is built for the hours after everyone else has gone home. Forty millimetre ' +
      'drivers and a sealed leather cup give you a floor of silence to work against, and the ' +
      'clamping force is tuned low enough that hour six feels like hour one.</p>' +
      '<p>Battery life runs to <strong>60 hours</strong> with adaptive noise cancelling on, so ' +
      'the charging cable becomes a weekly errand rather than a nightly one. A ten minute top-up ' +
      'returns roughly six hours if you forget anyway.</p>' +
      '<p>Folds flat into the included hard case. <em>Bluetooth 5.4, multipoint, USB-C, and a ' +
      '3.5&nbsp;mm jack for the flights that still insist on one.</em></p>',
  },
  {
    slug: 'nocturne-wireless-earbuds',
    name: 'Nocturne Wireless Earbuds',
    category: 'audio',
    price: 19800,
    stock: 42,
    description:
      '<p>Compact true-wireless earbuds with active noise cancelling, 8 hours per charge and ' +
      '32 hours in the case.</p>',
  },
  {
    slug: 'kaze-portable-bluetooth-speaker',
    name: 'Kaze Portable Bluetooth Speaker',
    category: 'audio',
    price: 12800,
    stock: 27,
    description:
      '<p>A pocketable IP67 speaker that pairs in seconds and runs 14 hours between charges.</p>',
  },
  {
    slug: 'sora-studio-monitor-pair',
    name: 'Sora Studio Monitor Pair',
    category: 'audio',
    price: 54800,
    stock: 6,
    description:
      '<p>Five-inch near-field monitors with a flat response curve, sold as a matched pair.</p>',
  },
  {
    slug: 'meridian-usb-c-dac',
    name: 'Meridian USB-C DAC',
    category: 'audio',
    price: 24800,
    stock: 15,
    description:
      '<p>A thumb-sized 32-bit/384&nbsp;kHz DAC and headphone amp that draws power from the ' +
      'host.</p>',
  },
  {
    slug: 'hoshi-open-back-headphones',
    name: 'Hoshi Open-Back Headphones',
    category: 'audio',
    price: 42800,
    stock: 0,
    description:
      '<p>Open-back planar magnetic headphones with a wide stage, for quiet rooms only.</p>',
  },
  {
    slug: 'tsuki-desktop-amplifier',
    name: 'Tsuki Desktop Amplifier',
    category: 'audio',
    price: 38800,
    stock: 9,
    description:
      '<p>A Class A desktop amplifier with enough headroom for 600&nbsp;ohm headphones.</p>',
  },
  {
    slug: 'lumen-m2-mirrorless-body',
    name: 'Lumen M2 Mirrorless Body',
    category: 'cameras',
    price: 178000,
    stock: 5,
    description:
      '<p>The M2 is the camera you stop thinking about. A 33 megapixel back-illuminated sensor ' +
      'and in-body stabilisation worth seven stops mean the shot you framed is the shot you ' +
      'get, handheld, in light that used to require a tripod.</p>' +
      '<p>Subject detection tracks people, animals and vehicles across the full frame and holds ' +
      'focus at <strong>30 frames per second</strong> with the shutter silent. Dual card slots ' +
      'write in parallel, because the second copy is the one that matters.</p>' +
      '<p>Weather-sealed magnesium body, 1.2 kg with the battery. <em>Sold as a body only — ' +
      'pair it with the 35&nbsp;mm prime for street work or the 24-70&nbsp;mm zoom for ' +
      'everything else.</em></p>',
  },
  {
    slug: 'lumen-35mm-prime-lens',
    name: 'Lumen 35mm Prime Lens',
    category: 'cameras',
    price: 62800,
    stock: 12,
    description:
      '<p>A fast 35&nbsp;mm f/1.8 prime, weather-sealed and light enough to leave mounted.</p>',
  },
  {
    slug: 'lumen-24-70mm-zoom-lens',
    name: 'Lumen 24-70mm Zoom Lens',
    category: 'cameras',
    price: 148000,
    stock: 3,
    description:
      '<p>The constant f/2.8 standard zoom — the one lens that covers most of a working day.</p>',
  },
  {
    slug: 'kiri-compact-travel-camera',
    name: 'Kiri Compact Travel Camera',
    category: 'cameras',
    price: 89800,
    stock: 14,
    description:
      '<p>A pocket compact with a one-inch sensor and a 24-100&nbsp;mm equivalent zoom.</p>',
  },
  {
    slug: 'anchor-carbon-tripod',
    name: 'Anchor Carbon Tripod',
    category: 'cameras',
    price: 34800,
    stock: 22,
    description:
      '<p>A five-section carbon tripod that folds to 38&nbsp;cm and carries 12&nbsp;kg.</p>',
  },
  {
    slug: 'field-camera-messenger-bag',
    name: 'Field Camera Messenger Bag',
    category: 'cameras',
    price: 16800,
    stock: 31,
    description: '<p>Waxed canvas messenger with removable dividers for a body and two lenses.</p>',
  },
  {
    slug: 'kotori-14-ultrabook',
    name: 'Kotori 14 Ultrabook',
    category: 'computers',
    price: 218000,
    stock: 8,
    description:
      '<p>At 1.1 kilograms the Kotori 14 disappears into a bag, but the part you notice is the ' +
      'silence: under everyday load the fans never spin up at all.</p>' +
      '<p>The 14-inch display runs 2880&times;1800 at 120&nbsp;Hz and covers the full P3 gamut, ' +
      'so colour work does not have to wait until you are back at a desk. <strong>18 hours</strong> ' +
      'of real battery life means the charger is a travel item, not a daily one.</p>' +
      '<p>32&nbsp;GB of memory and a 1&nbsp;TB drive as standard. <em>Two Thunderbolt ports, ' +
      'HDMI, and a headphone jack — no dongle required for a meeting room projector.</em></p>',
  },
  {
    slug: 'kotori-16-creator-laptop',
    name: 'Kotori 16 Creator Laptop',
    category: 'computers',
    price: 298000,
    stock: 4,
    // Left unpublished on purpose: the public grid must filter it out while the admin list
    // still shows it, which is the isPublished invariant (SPEC 3.2) with something to prove.
    isPublished: false,
    description:
      '<p>A 16-inch workstation with a discrete GPU, 64&nbsp;GB of memory and a colour-calibrated ' +
      'display.</p>',
  },
  {
    slug: 'slate-pro-mechanical-keyboard',
    name: 'Slate Pro Mechanical Keyboard',
    category: 'computers',
    price: 24800,
    stock: 26,
    description: '<p>A full-size hot-swappable board with a gasket mount and PBT keycaps.</p>',
  },
  {
    slug: 'slate-compact-65-keyboard',
    name: 'Slate Compact 65% Keyboard',
    category: 'computers',
    price: 18800,
    stock: 33,
    description: '<p>The same board at 65% — arrow keys kept, number pad dropped.</p>',
  },
  {
    slug: 'orbit-vertical-mouse',
    name: 'Orbit Vertical Mouse',
    category: 'computers',
    price: 9800,
    stock: 45,
    description:
      '<p>A vertical mouse that puts the wrist at 57 degrees, with six programmable buttons.</p>',
  },
  {
    slug: 'panorama-34-ultrawide-monitor',
    name: 'Panorama 34-inch Ultrawide Monitor',
    category: 'computers',
    price: 128000,
    stock: 7,
    description: '<p>A 34-inch 3440&times;1440 ultrawide with 100&nbsp;W USB-C power delivery.</p>',
  },
  {
    slug: 'hub-eight-port-usb-c-dock',
    name: 'Hub Eight-Port USB-C Dock',
    category: 'computers',
    price: 16800,
    stock: 29,
    description:
      '<p>Eight ports over one cable: dual HDMI, ethernet, card reader and 85&nbsp;W ' +
      'passthrough.</p>',
  },
  {
    slug: 'kettle-precision-gooseneck',
    name: 'Kettle Precision Gooseneck',
    category: 'home-kitchen',
    price: 18800,
    stock: 24,
    description:
      '<p>Coffee is the one thing in the kitchen where a degree genuinely matters, and this ' +
      'kettle holds whatever you set to within one — from 60&nbsp;°C for a delicate sencha to ' +
      'a full boil.</p>' +
      '<p>The gooseneck is weighted so the pour rate stays flat through the whole arc, which is ' +
      'the difference between an even bloom and a channelled bed. A <strong>built-in timer</strong> ' +
      'starts the moment you begin pouring.</p>' +
      '<p>Stainless steel throughout, 1&nbsp;litre, with a keep-warm mode that holds temperature ' +
      'for an hour. <em>The base remembers your last setting, so the morning is one button.</em></p>',
  },
  {
    slug: 'hikari-pour-over-coffee-set',
    name: 'Hikari Pour-Over Coffee Set',
    category: 'home-kitchen',
    price: 12800,
    stock: 19,
    description:
      '<p>A borosilicate carafe, ceramic dripper and reusable steel filter, boxed together.</p>',
  },
  {
    slug: 'nagomi-cast-iron-skillet',
    name: 'Nagomi Cast Iron Skillet',
    category: 'home-kitchen',
    price: 9800,
    stock: 36,
    description: '<p>A 26&nbsp;cm skillet, pre-seasoned and oven-safe to 260&nbsp;°C.</p>',
  },
  {
    slug: 'mori-ceramic-knife-block-set',
    name: 'Mori Ceramic Knife Block Set',
    category: 'home-kitchen',
    price: 42800,
    stock: 11,
    description:
      '<p>Five knives in a magnetic oak block: chef, santoku, bread, utility and paring.</p>',
  },
  {
    slug: 'cloud-air-purifier',
    name: 'Cloud Air Purifier',
    category: 'home-kitchen',
    price: 68000,
    stock: 6,
    description:
      '<p>A HEPA and carbon purifier rated for 60&nbsp;m², quiet enough for a bedroom.</p>',
  },
  {
    slug: 'tatami-reed-diffuser-trio',
    name: 'Tatami Reed Diffuser Trio',
    category: 'home-kitchen',
    price: 4980,
    stock: 52,
    description: '<p>Three 100&nbsp;ml diffusers — hinoki, yuzu and green tea.</p>',
  },
  {
    slug: 'meridian-smartwatch-series-4',
    name: 'Meridian Smartwatch Series 4',
    category: 'wearables',
    price: 68000,
    stock: 13,
    description:
      '<p>Series 4 finally solves the thing that made smartwatches annoying: it lasts ' +
      '<strong>nine days</strong> between charges, so it stays on your wrist through the night ' +
      'and the sleep data is actually continuous.</p>' +
      '<p>The always-on display reaches 2000 nits, which is the difference between reading a ' +
      'notification in direct sun and shading it with your hand. Dual-band GPS locks on in ' +
      'seconds and holds a line through city streets.</p>' +
      '<p>Sapphire crystal, titanium case, 100&nbsp;m water resistance. <em>Swaps to any 22&nbsp;mm ' +
      'strap without a tool.</em></p>',
  },
  {
    slug: 'meridian-sport-band-pack',
    name: 'Meridian Sport Band Pack',
    category: 'wearables',
    price: 6800,
    stock: 48,
    description: '<p>Three 22&nbsp;mm quick-release silicone bands in slate, sand and black.</p>',
  },
  {
    slug: 'pulse-fitness-tracker',
    name: 'Pulse Fitness Tracker',
    category: 'wearables',
    price: 24800,
    stock: 25,
    description:
      '<p>A screenless band that tracks heart rate, sleep and recovery for 12 days a charge.</p>',
  },
  {
    slug: 'halo-sleep-ring',
    name: 'Halo Sleep Ring',
    category: 'wearables',
    price: 54800,
    stock: 2,
    description:
      '<p>A titanium ring that measures sleep stages, temperature and HRV overnight.</p>',
  },
  {
    slug: 'trail-gps-running-watch',
    name: 'Trail GPS Running Watch',
    category: 'wearables',
    price: 84800,
    stock: 10,
    description:
      '<p>A trail watch with topographic maps, dual-band GPS and 40 hours in GPS mode.</p>',
  },
]

const demoAccounts = [
  { name: 'Demo Admin', email: 'demo-admin@example.com', role: 'admin' },
  { name: 'Demo Customer', email: 'demo-customer@example.com', role: 'customer' },
]

// Published in the README so a reviewer can sign in as either role without signing up
// (SPEC 10). Deliberately not a secret.
const DEMO_PASSWORD = 'demo-password-123'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const imagesDir = fileURLToPath(new URL('../seed/images/', import.meta.url))

/**
 * Maps product slug -> image filename, from whatever is actually in seed/images/. Files are
 * supplied by hand, so a missing one is expected rather than an error: that product simply
 * seeds without an image and is counted in the summary.
 */
function readImageFiles(): Map<string, string> {
  const found = new Map<string, string>()
  let entries: string[]
  try {
    entries = readdirSync(imagesDir)
  } catch {
    return found
  }

  for (const entry of entries) {
    const dot = entry.lastIndexOf('.')
    if (dot <= 0) continue
    const extension = entry.slice(dot).toLowerCase()
    if (!(extension in MIME_BY_EXTENSION)) continue
    found.set(entry.slice(0, dot), entry)
  }
  return found
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

// Built inline rather than imported from src/lib/r2.ts, which is unreachable from here (see the
// header). It also could not be reused as-is: imageObjectKey() mints a fresh cuid2 per call,
// which is right for admin uploads and fatal for a seed that must not re-upload.
let client: S3Client | undefined

function r2(): S3Client {
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
  return client
}

/**
 * Puts the file at a deterministic `seed/<slug>.<ext>` key and returns its public URL. The
 * determinism is the whole point: a HeadObject hit means a previous run already uploaded this
 * object, so a re-run costs one HEAD instead of a 30-file upload. The `seed/` prefix also keeps
 * these visually separate from the admin route's `products/<cuid2>` objects in the bucket.
 */
async function ensureImage(slug: string, filename: string): Promise<{ url: string; put: boolean }> {
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  const key = `seed/${slug}${extension === '.jpeg' ? '.jpg' : extension}`
  const bucket = requireEnv('R2_BUCKET')
  const url = `${requireEnv('R2_PUBLIC_URL').replace(/\/$/, '')}/${key}`

  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return { url, put: false }
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && '$metadata' in error
        ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
        : undefined
    // Anything other than "it is not there" is a real fault — bad credentials, wrong bucket —
    // and must not be swallowed into a silent re-upload.
    if (status !== 404) throw error
  }

  await r2().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: readFileSync(join(imagesDir, filename)),
      ContentType: MIME_BY_EXTENSION[extension],
      // Not the `immutable` the admin route uses: that key carries a cuid2 and can never be
      // rewritten, whereas this one is stable and its bytes can legitimately be replaced.
      CacheControl: 'public, max-age=3600',
    }),
  )
  return { url, put: true }
}

try {
  let newCategories = 0
  for (const { name, slug } of seedCategories) {
    // No conflict target: `name` and `slug` are both unique, and a bare DO NOTHING covers
    // either, which is what makes a re-run a no-op.
    const result = await pool.query(
      'INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [createId(), name, slug],
    )
    newCategories += result.rowCount ?? 0
  }

  const categoryRows = await pool.query<{ id: string; slug: string }>(
    'SELECT id, slug FROM categories',
  )
  const categoryIdBySlug = new Map(categoryRows.rows.map((row) => [row.slug, row.id]))

  // Existing rows decide how much work is left. A product that is already there is left alone
  // (SPEC 10 accepts that demo data drifts), but one seeded before R2 was configured still has
  // a null image_url and is worth finishing.
  const existingRows = await pool.query<{ slug: string; image_url: string | null }>(
    'SELECT slug, image_url FROM products',
  )
  const existingImageBySlug = new Map(existingRows.rows.map((row) => [row.slug, row.image_url]))

  const imageFiles = readImageFiles()
  // Gated the same way e2e/upload.spec.ts gates its round-trip: without a bucket the seed still
  // runs end to end, it just leaves image_url null.
  const r2Configured = Boolean(process.env.R2_BUCKET)
  let uploaded = 0
  let withImage = 0
  const missingImages: string[] = []

  let newProducts = 0
  let backfilledImages = 0

  for (const [index, product] of seedProducts.entries()) {
    // undefined when the product is new, null when it exists without an image — both need one.
    const existingUrl = existingImageBySlug.get(product.slug) ?? null

    let imageUrl: string | null = null
    const filename = imageFiles.get(product.slug)
    if (!filename) {
      missingImages.push(product.slug)
    } else if (existingUrl === null && r2Configured) {
      // Skipped entirely when the row already carries a URL: that is one less round-trip per
      // product, and the object behind an existing URL is not this script's business.
      const result = await ensureImage(product.slug, filename)
      imageUrl = result.url
      if (result.put) uploaded += 1
    }
    if (imageUrl ?? existingUrl) withImage += 1

    // Staggered so newest-first ordering is stable — 31 rows sharing one now() would leave the
    // grid's order up to the planner.
    const hoursAgo = (seedProducts.length - index) * 3

    const inserted = await pool.query(
      `INSERT INTO products
         (id, category_id, name, slug, description, price, stock, image_url, is_published, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - make_interval(hours => $10))
       ON CONFLICT (slug) DO NOTHING`,
      [
        createId(),
        categoryIdBySlug.get(product.category) ?? null,
        product.name,
        product.slug,
        product.description,
        product.price,
        product.stock,
        imageUrl,
        product.isPublished ?? true,
        hoursAgo,
      ],
    )
    newProducts += inserted.rowCount ?? 0

    // Only ever fills a hole. `image_url IS NULL` is what stops this from overwriting an image
    // an admin uploaded over the seeded one.
    if (inserted.rowCount === 0 && imageUrl) {
      const filled = await pool.query(
        'UPDATE products SET image_url = $1 WHERE slug = $2 AND image_url IS NULL',
        [imageUrl, product.slug],
      )
      backfilledImages += filled.rowCount ?? 0
    }
  }

  let newAccounts = 0
  for (const account of demoAccounts) {
    // Better Auth declares `role` as input: false, so no HTTP signup can mint the admin — it
    // silently rewrites the field to 'customer'. Writing the rows directly is the same
    // promote-by-SQL route the README and e2e/admin.ts already document (SPEC 3.1, 7).
    await pool.query(
      `INSERT INTO "user" (id, name, email, email_verified, role, created_at, updated_at)
       VALUES ($1, $2, $3, false, $4, now(), now())
       ON CONFLICT (email) DO NOTHING`,
      [createId(), account.name, account.email, account.role],
    )
    const userRow = await pool.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [
      account.email,
    ])
    const userId = userRow.rows[0]?.id
    if (!userId) throw new Error(`Failed to resolve the seeded user ${account.email}`)

    // `account` carries no unique constraint, so the guard is an explicit NOT EXISTS. Checking
    // before hashing also matters: this scrypt runs at N=16384, r=16 and is genuinely slow, and
    // a re-run should not pay for it.
    const hasCredential = await pool.query(
      "SELECT 1 FROM account WHERE user_id = $1 AND provider_id = 'credential'",
      [userId],
    )
    if (hasCredential.rowCount === 0) {
      const created = await pool.query(
        `INSERT INTO account
           (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
        [createId(), userId, await hashPassword(DEMO_PASSWORD)],
      )
      newAccounts += created.rowCount ?? 0
    }
  }

  const imageSummary = r2Configured
    ? `${withImage}/${seedProducts.length} with images (${uploaded} uploaded this run)`
    : 'images skipped (R2_BUCKET is not set)'

  console.log(
    `db:seed — ${seedCategories.length} categories (${newCategories} new), ` +
      `${seedProducts.length} products (${newProducts} new), ${imageSummary}, ` +
      `${demoAccounts.length} demo accounts (${newAccounts} new).`,
  )
  if (backfilledImages > 0) {
    console.log(`db:seed — backfilled image_url on ${backfilledImages} existing products.`)
  }
  if (missingImages.length > 0) {
    console.log(
      `db:seed — ${missingImages.length} products have no file in seed/images/: ` +
        `${missingImages.join(', ')}`,
    )
  }
} finally {
  await pool.end()
}
