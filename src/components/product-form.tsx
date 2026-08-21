'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { createProduct, updateProduct } from '@/actions/products'
import { DescriptionEditor } from '@/components/description-editor'
import { ImageDropzone } from '@/components/image-dropzone'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { productSchema, type ProductInput } from '@/lib/validation'

// Radix SelectItem rejects value="", so "no category" needs a sentinel. It never collides with
// a real value because category ids are cuid2.
const NO_CATEGORY = 'none'

type Props = {
  /** null in create mode. */
  product: (ProductInput & { id: string }) | null
  categories: { id: string; name: string }[]
}

/**
 * One form for both create and edit, per SPEC 2 — the field set is identical and only the
 * action differs. Mirrors auth-form.tsx: react-hook-form + zodResolver against the same schema
 * the Server Action re-parses, so client validation is a convenience and the server stays the
 * boundary (SPEC 8). Publishing is deliberately not here; it lives on the list so there is one
 * obvious place to do it.
 */
export function ProductForm({ product, categories }: Props) {
  const router = useRouter()

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    // price and stock are left undefined rather than 0 so a new product starts with empty
    // inputs and the "enter a price" message fires instead of silently saving a free product.
    defaultValues: product ?? { name: '', description: '', categoryId: null, imageUrl: null },
  })

  async function onSubmit(values: ProductInput) {
    const result = product
      ? await updateProduct({ ...values, id: product.id })
      : await createProduct(values)

    if ('error' in result) {
      form.setError('root', { message: result.error })
      return
    }

    toast.success(product ? 'Product saved.' : 'Product created.')
    router.push('/admin/products')
    router.refresh()
  }

  // Read live rather than once: it is the image preview's alt text (SPEC 3.7) and the subject
  // the AI generator is handed, and in create mode it is still being typed.
  const name = useWatch({ control: form.control, name: 'name' })

  const rootError = form.formState.errors.root?.message

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid max-w-3xl gap-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormDescription>The URL slug is generated from this.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <DescriptionEditor
                  value={field.value}
                  onValueChange={field.onChange}
                  productName={name}
                />
              </FormControl>
              <FormDescription>
                Rich text, sanitised on save. Add specs on the right to draft it with AI.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === '' ? undefined : event.target.valueAsNumber,
                      )
                    }
                  />
                </FormControl>
                <FormDescription>Whole yen — JPY has no minor unit.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === '' ? undefined : event.target.valueAsNumber,
                      )
                    }
                  />
                </FormControl>
                <FormDescription>Units on hand.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                value={field.value ?? NO_CATEGORY}
                onValueChange={(value) => field.onChange(value === NO_CATEGORY ? null : value)}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Optional — products can sit outside a category.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image</FormLabel>
              <FormControl>
                <ImageDropzone
                  value={field.value}
                  onValueChange={field.onChange}
                  alt={name || 'Product image'}
                  onUploadError={(message) => form.setError('imageUrl', { message })}
                />
              </FormControl>
              <FormDescription>One image per product. Uploaded straight away.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {rootError ? (
          <p role="alert" className="text-destructive text-sm">
            {rootError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            aria-busy={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {product ? 'Save changes' : 'Create product'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/products">Cancel</Link>
          </Button>
        </div>
      </form>
    </Form>
  )
}
