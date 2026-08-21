/**
 * Marks an expected Server Action failure — an `{ error }` the action chose to return, whose
 * message is written for a human and is safe to show verbatim.
 *
 * TanStack Query only rolls an optimistic update back when the mutation *rejects*, so those
 * `{ error }` results have to be re-thrown. Once they are, they are indistinguishable from a
 * dropped connection or a 500 unless they carry a tag — and showing the user "Failed to fetch"
 * is how a network blip ends up looking like a bug in the cart.
 *
 * Same shape as AuthorizationError in src/lib/auth.ts.
 */
export class ActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionError'
  }
}

export function actionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ActionError ? error.message : fallback
}
