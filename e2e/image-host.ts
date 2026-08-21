/**
 * The image host the E2E environment is allowed to render.
 *
 * Three constraints meet here. productSchema requires an absolute https URL, so a mocked upload
 * cannot answer with a path. next.config.ts derives images.remotePatterns from R2_PUBLIC_URL and
 * leaves it empty when R2 is unconfigured, and next/image *throws* on an unconfigured host
 * rather than merely failing to load — which takes the form down with it. And CI deliberately
 * sets no R2_* at all.
 *
 * So the suite names a host, playwright.config.ts hands it to the dev server as R2_PUBLIC_URL
 * when nothing real is configured, and the mocked upload answers on that host. Where a real
 * bucket *is* configured the real one wins, so upload.spec.ts's live round-trip still renders.
 */
export const MOCK_IMAGE_ORIGIN = 'https://images.e2e.test'

export function allowedImageOrigin(): string {
  const configured = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
  return configured || MOCK_IMAGE_ORIGIN
}
