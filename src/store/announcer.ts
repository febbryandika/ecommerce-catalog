import { create } from 'zustand'

type AnnouncerStore = {
  message: string
  nonce: number
  announce: (message: string) => void
}

/**
 * The message behind the single aria-live region (SPEC 3.7: cart and wishlist changes must
 * announce). One shared region rather than one per component, because several regions competing
 * on the same page is a known way to get announcements dropped or read out of order.
 *
 * `nonce` exists because a live region announces on *DOM mutation*, not on state change. Adding
 * the same product twice produces the identical sentence both times, so the text node would not
 * change and the second add would be announced to nobody — likewise wishlist save → remove →
 * save. The counter lets Announcer vary the rendered text without varying what is spoken.
 *
 * Module-level for the same reason src/store/filters.ts is, and under the same rule: the initial
 * value is a constant and it is only ever written from a browser event handler, so nothing
 * per-request is stored on the server. Do not put request data here.
 */
export const useAnnouncer = create<AnnouncerStore>()((set) => ({
  message: '',
  nonce: 0,
  announce: (message) => set((state) => ({ message, nonce: state.nonce + 1 })),
}))
