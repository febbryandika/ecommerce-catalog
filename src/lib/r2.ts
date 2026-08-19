import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createId } from '@paralleldrive/cuid2'

/**
 * The only module that reads R2 credentials, and it is imported by /api/upload alone — nothing
 * under components/ may touch it, which is what keeps the secrets out of the client bundle
 * (SPEC 8). The MIME and size limits the dropzone also needs live in validation.ts instead.
 */

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Collision-safe by construction: a cuid2 per object rather than the uploaded filename, so two
 * admins saving their own `photo.jpg` cannot overwrite each other. Pure, so it is unit-testable
 * without credentials.
 */
export function imageObjectKey(mimeType: string): string {
  return `products/${createId()}.${EXTENSIONS[mimeType] ?? 'bin'}`
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/**
 * Built on first use rather than at module load, which is where this departs from db/index.ts:
 * `pnpm test` imports this file for imageObjectKey and `pnpm build` evaluates the route that
 * imports it, and both run without R2 credentials. Throwing at load would break them; throwing
 * here fails only a request that actually needs R2.
 */
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

/** Puts the image in the bucket and returns its public URL for the product row. */
export async function putProductImage(file: File): Promise<string> {
  const key = imageObjectKey(file.type)

  await r2().send(
    new PutObjectCommand({
      Bucket: requireEnv('R2_BUCKET'),
      Key: key,
      // Buffered rather than streamed: PutObject needs a known ContentLength, and the schema
      // has already capped this at 5 MB.
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    }),
  )

  return `${requireEnv('R2_PUBLIC_URL').replace(/\/$/, '')}/${key}`
}
