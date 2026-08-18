'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { signupSchema, type SignupInput } from '@/lib/validation'

type Props = {
  mode: 'login' | 'signup'
  next: string
}

export function AuthForm({ mode, next }: Props) {
  const router = useRouter()
  const isSignup = mode === 'signup'

  // Both modes resolve to the same field set so a single form serves both. Login keeps an
  // unused `name` with no minimum, which makes the two resolvers one type rather than a
  // union react-hook-form cannot infer through.
  const schema = isSignup ? signupSchema : signupSchema.extend({ name: z.string() })

  const form = useForm<SignupInput>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  })

  async function onSubmit({ name, email, password }: SignupInput) {
    // `role` is deliberately absent: Better Auth declares it `input: false`, so it is
    // assigned server-side and a client cannot promote itself to admin.
    const { error } = isSignup
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password })

    if (error) {
      form.setError('root', { message: error.message ?? 'Something went wrong. Try again.' })
      return
    }

    router.push(next)
    router.refresh()
  }

  const rootError = form.formState.errors.root?.message

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid max-w-sm gap-6">
        {isSignup ? (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {rootError ? (
          <p role="alert" className="text-destructive text-sm">
            {rootError}
          </p>
        ) : null}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {isSignup ? 'Create account' : 'Log in'}
        </Button>
      </form>
    </Form>
  )
}
