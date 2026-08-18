import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type { auth } from '@/lib/auth'

// `import type` is load-bearing: a value import would pull the server auth instance —
// and with it the pg pool — into the client bundle. inferAdditionalFields is what makes
// session.user.role typed on the client.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
})
