import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'
import { safeNextPath } from '@/lib/validation'

export const metadata = { title: 'Sign up' }

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const { next } = await searchParams

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Sign up</h1>
      <p className="text-muted-foreground mt-2">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Log in
        </Link>
        .
      </p>
      <AuthForm mode="signup" next={safeNextPath(typeof next === 'string' ? next : undefined)} />
    </section>
  )
}
