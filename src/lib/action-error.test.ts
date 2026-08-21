import { describe, expect, it } from 'vitest'
import { ActionError, actionErrorMessage } from '@/lib/action-error'

describe('actionErrorMessage', () => {
  it('shows an expected failure verbatim', () => {
    // These messages are written for a human by the Server Action that returned `{ error }`.
    expect(actionErrorMessage(new ActionError('This product is out of stock.'), 'fallback')).toBe(
      'This product is out of stock.',
    )
  })

  it('hides a transport failure behind the written fallback', () => {
    // The invariant this guards: anything that is not an ActionError is a dropped connection or
    // a 500, and surfacing error.message there is how "Failed to fetch" ends up in a toast
    // looking like a bug in the cart.
    expect(
      actionErrorMessage(new TypeError('Failed to fetch'), 'Could not update your cart.'),
    ).toBe('Could not update your cart.')
  })

  it('falls back for non-Error values too', () => {
    expect(actionErrorMessage('a thrown string', 'fallback')).toBe('fallback')
    expect(actionErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(actionErrorMessage({ message: 'looks like an error' }, 'fallback')).toBe('fallback')
  })

  it('keeps ActionError distinguishable from a plain Error', () => {
    // Subclassing Error is only useful if instanceof survives — the check the whole rollback
    // path depends on.
    const error = new ActionError('nope')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ActionError')
    expect(actionErrorMessage(new Error('nope'), 'fallback')).toBe('fallback')
  })
})
