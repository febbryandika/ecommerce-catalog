// Multipart product image upload to R2. Needs the Node runtime for the S3 client.
export const runtime = 'nodejs'

export function POST() {
  return new Response(null, { status: 501 })
}
