'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useFiltersStore } from '@/store/filters'

// Radix SelectItem rejects value="", so "every category" needs a sentinel. The underscores are
// the guarantee it never collides with a real slug: slugify() collapses every non-alphanumeric
// run to a hyphen. Same trick as NO_CATEGORY in product-form.tsx.
const ALL_CATEGORIES = '__all__'

/** Long enough that a typed word lands as one navigation, short enough to still feel live. */
const SEARCH_DEBOUNCE_MS = 300

type Props = {
  categories: { name: string; slug: string }[]
}

/**
 * Writes ?q= and ?category= and nothing else — the URL is the source of truth and the Server
 * Component re-queries off it (SPEC 3.3). Zustand holds only whether the mobile panel is open;
 * it never holds the filter values, because that would be a second source of truth.
 *
 * The search box is locally stateful on purpose. Driving `value` straight off useSearchParams
 * would render the last *committed* query, so a debounced keystroke would visibly fail to
 * appear. Local state renders instantly; the render-phase reconciliation below is what keeps
 * Back/Forward honest without a useEffect.
 */
export function ProductFilters({ categories }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isPanelOpen, togglePanel } = useFiltersStore()

  const searchId = useId()
  const categoryId = useId()
  const panelId = useId()

  const urlQuery = searchParams.get('q') ?? ''
  const [term, setTerm] = useState(urlQuery)
  // The last q we wrote to the URL ourselves. State rather than a ref because this is read
  // during render, which refs forbid — and it is React's documented shape for adjusting state
  // when a prop changes, so no useEffect and no extra round trip.
  const [committed, setCommitted] = useState(urlQuery)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The URL moved on its own — Back, Forward, or the empty state's "Clear filters" link — so
  // the box has to follow it. Skipped when the URL merely caught up with what we just wrote,
  // which is what would otherwise stomp on a keystroke that is still mid-debounce.
  if (urlQuery !== committed && urlQuery !== term) {
    setCommitted(urlQuery)
    setTerm(urlQuery)
  }

  function commit(key: 'q' | 'category', value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    // Any change to the result set invalidates the offset, so page 3 of the old results must
    // not survive into the new ones.
    next.delete('page')

    if (key === 'q') setCommitted(value)

    const query = next.toString()
    // replace, not push: typing must not bury the previous page under a dozen history entries.
    // The ternary keeps a cleared filter on `/` rather than `/?`. scroll: false because both
    // controls sit above the grid, and jumping to the top on every debounce tick fights the
    // user.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  // The timer is otherwise only cleared by the next keystroke, so it outlives this component
  // and can fire after the user has navigated away. Standard cleanup, and it narrows — but does
  // not close — a race where clicking a product inside the debounce window lets a late
  // router.replace cancel that navigation. Closing it properly needs a UX decision about what a
  // half-typed search should do when the user clicks away; see the note in CLAUDE.md.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function onSearchChange(value: string) {
    setTerm(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit('q', value.trim()), SEARCH_DEBOUNCE_MS)
  }

  // No local state and no debounce for the select, so the URL can drive it directly.
  const category = searchParams.get('category') ?? ''

  return (
    <div className="mt-8">
      <Button
        type="button"
        variant="outline"
        aria-expanded={isPanelOpen}
        aria-controls={panelId}
        onClick={togglePanel}
        className="sm:hidden"
      >
        Filters
      </Button>

      <div
        id={panelId}
        className={cn(
          'mt-4 grid gap-4 sm:mt-0 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-end',
          !isPanelOpen && 'max-sm:hidden',
        )}
      >
        <div className="grid gap-2">
          <Label htmlFor={searchId}>Search</Label>
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            placeholder="Search products"
            value={term}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={categoryId}>Category</Label>
          <Select
            value={category || ALL_CATEGORIES}
            onValueChange={(value) => commit('category', value === ALL_CATEGORIES ? '' : value)}
          >
            <SelectTrigger id={categoryId} className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
              {categories.map((option) => (
                <SelectItem key={option.slug} value={option.slug}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
