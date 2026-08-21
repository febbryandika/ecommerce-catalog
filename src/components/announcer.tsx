'use client'

import { useAnnouncer } from '@/store/announcer'

/**
 * Visually hidden, permanently mounted live region. It has to exist in the DOM *before* the
 * text changes — a region inserted at the same moment as its content is frequently not
 * announced at all — which is why this renders an empty <p> rather than nothing when idle.
 */
export function Announcer() {
  const message = useAnnouncer((state) => state.message)

  return (
    <p aria-live="polite" className="sr-only" role="status">
      {message}
    </p>
  )
}
