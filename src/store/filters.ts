import { create } from 'zustand'

type FiltersStore = {
  isPanelOpen: boolean
  togglePanel: () => void
}

/**
 * The filter panel's open/closed state and nothing else (SPEC 3.3). q, category and page are
 * owned by the URL; duplicating any of them here would create a second source of truth that
 * goes stale the moment someone uses the Back button.
 *
 * Module-level, which is normally an SSR hazard because a single store would be shared across
 * requests. Safe here specifically because the initial value is the constant `false` and it is
 * only ever written from a click handler in the browser — nothing per-request is stored on the
 * server, so there is nothing to leak and no hydration mismatch. Do not put request data here.
 */
export const useFiltersStore = create<FiltersStore>()((set) => ({
  isPanelOpen: false,
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
}))
