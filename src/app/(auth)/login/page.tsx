import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'
import { safeNextPath } from '@/lib/validation'

export const metadata = { title: 'Log in' }

/** Same narrowing as the catalog params: a repeated key arrives as string[] and is discarded. */
function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  // `add` and `wish` carry a click that happened before the visitor had a session (SPEC 3.4,
  // 3.5). They are replayed once by AuthForm after a successful sign-in; nothing is stored
  // server-side, so an abandoned login simply loses the intent, which is the correct outcome.
  const { next, add, wish } = await searchParams

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Log in</h1>
      <p className="text-muted-foreground mt-2">
        New here?{' '}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
        .
      </p>
      <AuthForm
        mode="login"
        next={safeNextPath(single(next))}
        add={single(add)}
        wish={single(wish)}
      />
    </section>
  )
}
