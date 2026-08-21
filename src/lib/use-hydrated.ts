'use client'

import { useSyncExternalStore } from 'react'

/** Never fires — the value is constant per environment, so there is nothing to subscribe to. */
const subscribe = () => () => {}

/**
 * False on the server and during hydration, true once the client has taken over.
 *
 * The components that read `authClient.useSession()` need this because the hook does not report
 * the same thing in both places: on the server the session is always pending, while in the
 * browser the store can already be resolved by the time React hydrates. Rendering straight off
 * it means the server sends a placeholder and the client's first render produces a button, and
 * React answers that mismatch by throwing the server HTML away and regenerating the whole tree
 * on the client — measurably, on 7 of 8 loads of the catalog before this existed.
 *
 * That regeneration is why an interaction landing immediately after load could be lost: the node
 * it targeted was replaced underneath it. Gating on this keeps the first client render identical
 * to the server's, so hydration succeeds and the DOM survives.
 *
 * useSyncExternalStore rather than a useEffect flag because it has a documented server snapshot,
 * which is exactly this distinction — and because setting state in an effect is what
 * react-hooks/set-state-in-effect exists to reject.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
