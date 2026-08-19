// streamText() product description stream. Admin-only; guarded by requireRole('admin').
import { anthropic } from '@ai-sdk/anthropic'
import { createTextStreamResponse, streamText, toTextStream } from 'ai'
import { AuthorizationError, requireRole } from '@/lib/auth'
import { describeSchema } from '@/lib/validation'

export async function POST(request: Request) {
  // This route sits outside proxy.ts's /admin/:path* matcher, so nothing else is standing here
  // (SPEC 3.1, 8). Answering 403 rather than letting requireRole's throw become a 500 keeps the
  // body JSON, which is what the editor's error branch reads — same shape as /api/upload.
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

  const parsed = describeSchema.safeParse(await request.json())
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(' ')
    return Response.json({ error: message }, { status: 400 })
  }

  const { name, specs } = parsed.data

  // Read rather than asserted: an unset id would otherwise be laundered into the request and
  // come back as an opaque model error. Throwing here matches requireEnv in r2.ts — a missing
  // variable is a deployment fault, not something an admin can act on.
  const model = process.env.ANTHROPIC_MODEL
  if (!model) throw new Error('ANTHROPIC_MODEL is not set')

  // maxOutputTokens is the cap on productSchema.description (5000 characters) expressed in the
  // only place that can enforce it: ~900 tokens of English cannot overflow it, so a generation
  // can never produce something the save would then reject.
  const result = streamText({
    model: anthropic(model),
    maxOutputTokens: 900,
    prompt: `Write a product description for an e-commerce listing.

Product: ${name}
Specs: ${specs}

2-3 paragraphs of marketing copy. Focus on benefits, not just features. Flowing prose, no bullet points.`,
  })

  return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) })
}
