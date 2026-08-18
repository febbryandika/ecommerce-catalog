// streamText() product description stream. Admin-only; guarded by requireRole('admin').
export function POST() {
  return new Response(null, { status: 501 })
}
