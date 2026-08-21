'use client'

import { useAnnouncer } from '@/store/announcer'

/**
 * Visually hidden, permanently mounted live region. It has to exist in the DOM *before* the
 * text changes — a region inserted at the same moment as its content is frequently not
 * announced at all — which is why this renders an empty <p> rather than nothing when idle.
 *
 * The zero-width space alternating on the store's nonce is what makes a *repeated* message
 * announce again: a live region fires on DOM mutation, so re-setting the identical sentence
 * would otherwise change nothing and be spoken to nobody. U+200B has no spoken form, so the
 * message reads identically either way.
 */
export function Announcer() {
  const message = useAnnouncer((state) => state.message)
  const nonce = useAnnouncer((state) => state.nonce)

  return (
    <p aria-live="polite" className="sr-only" role="status">
      {message}
      {nonce % 2 === 1 ? '\u200B' : ''}
    </p>
  )
}
