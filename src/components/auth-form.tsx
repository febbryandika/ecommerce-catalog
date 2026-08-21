'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
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
import { addToCart } from '@/actions/cart'
import { toggleWishlist } from '@/actions/wishlist'
import { authClient } from '@/lib/auth-client'
import { signupSchema, type SignupInput } from '@/lib/validation'

type Props = {
  mode: 'login' | 'signup'
  next: string
  /** Product id from a signed-out add-to-cart click, replayed once after sign-in (SPEC 3.4). */
  add?: string
  /** The wishlist equivalent (SPEC 3.5). */
  wish?: string
}

export function AuthForm({ mode, next, add, wish }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
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

    // Replay the intent that sent the visitor here, exactly once. It lives in this submit
    // handler rather than in an effect on the destination page on purpose: an effect would fire
    // again on remount and — because the param would still be in the URL — a second time on
    // refresh, which is precisely the "added twice" bug. A submit handler runs once per
    // submission, and by the time router.push lands, the URL carrying the intent is gone.
    //
    // Failures are swallowed deliberately: the sign-in succeeded, and blocking the redirect on a
    // secondary action would strand the user on the login page with a valid session.
    if (add) {
      await addToCart({ productId: add, quantity: 1 })
    } else if (wish) {
      await toggleWishlist({ productId: wish })
    }

    // Cleared after the replay, not before: the header's cart query refetches the moment the
    // cache is dropped, and doing that first would race the write and cache an empty cart that
    // staleTime would then hold on to.
    //
    // It has to happen at all because the cache was populated for whoever was here before — an
    // anonymous visitor, or a previous account — and one session's cart must not be shown to the
    // next.
    queryClient.clear()

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
