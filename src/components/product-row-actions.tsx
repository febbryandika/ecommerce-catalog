'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { deleteProduct, togglePublish } from '@/actions/products'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

type Props = {
  id: string
  name: string
  isPublished: boolean
}

/**
 * The only client island in the admin list — the table itself stays a Server Component. Every
 * control carries the product name in its accessible name, because the same three labels
 * repeat on every row and both screen readers and Playwright address them by role + name.
 */
export function ProductRowActions({ id, name, isPublished }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: true } | { error: string }>, success: string) {
    startTransition(async () => {
      const result = await action()

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(success)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/products/${id}`}>
          Edit<span className="sr-only"> {name}</span>
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(() => togglePublish(id), isPublished ? `Unpublished ${name}.` : `Published ${name}.`)
        }
      >
        {isPublished ? 'Unpublish' : 'Publish'}
        <span className="sr-only"> {name}</span>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={pending}>
            Delete<span className="sr-only"> {name}</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product from the catalog permanently. There is no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => run(() => deleteProduct(id), `Deleted ${name}.`)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
