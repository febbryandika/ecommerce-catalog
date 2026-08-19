// Multipart product image upload to R2. Needs the Node runtime for the S3 client.
import { AuthorizationError, requireRole } from '@/lib/auth'
import { putProductImage } from '@/lib/r2'
import { MAX_IMAGE_BYTES, productImageSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  // proxy.ts matches /admin/:path* only, so nothing has checked this caller yet — requireRole
  // here is the whole authorization boundary for the route. It throws rather than redirecting
  // precisely so a fetch() gets a 403 instead of a 307 to an HTML login page (SPEC 3.1, 8).
  try {
    await requireRole('admin')
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json(
        { error: 'You do not have access to the catalog admin.' },
        { status: 403 },
      )
    }
    throw error
  }

  // Fast fail before buffering the body. Advisory only — content-length is client-supplied, so
  // the schema check below is still the real bound.
  if (Number(request.headers.get('content-length')) > MAX_IMAGE_BYTES * 1.1) {
    return Response.json({ error: 'Images must be 5 MB or smaller.' }, { status: 400 })
  }

  const form = await request.formData()
  const parsed = productImageSchema.safeParse(form.get('file'))
  if (!parsed.success) {
    // Joined rather than indexed: a 6 MB GIF trips both checks, and both sentences are worth
    // showing. Every message in productImageSchema is a complete sentence for this reason.
    const message = parsed.error.issues.map((issue) => issue.message).join(' ')
    return Response.json({ error: message }, { status: 400 })
  }

  return Response.json({ url: await putProductImage(parsed.data) })
}
