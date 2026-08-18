import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'
import { safeNextPath } from '@/lib/validation'

export const metadata = { title: 'Log in' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams

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
      <AuthForm mode="login" next={safeNextPath(typeof next === 'string' ? next : undefined)} />
    </section>
  )
}
