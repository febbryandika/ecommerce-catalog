import { redirect } from 'next/navigation'
import { AuthorizationError, requireRole } from '@/lib/auth'

/**
 * The role gate for /admin/*. proxy.ts only proves that a session cookie exists and cannot see
 * the role, so this is the first point at which a signed-in customer is actually turned away
 * (SPEC 3.1, 8). It redirects rather than letting requireRole's throw render error.tsx,
 * because SPEC 9 test 5 specifies a redirect. Every admin Server Action re-checks the role
 * independently — this layout is convenience, not the boundary.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  try {
    await requireRole('admin')
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect('/')
    }
    throw error
  }

  return children
}
