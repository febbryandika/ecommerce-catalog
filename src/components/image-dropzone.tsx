'use client'

import Image from 'next/image'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { IMAGE_MIME_TYPES, productImageSchema } from '@/lib/validation'

// The file input's own value/onChange/type/accept are owned here, so they are omitted rather
// than intersected — everything else FormControl clones onto the child still passes through.
type Props = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'accept'> & {
  /** The uploaded image's public URL, or null. */
  value: string | null
  onValueChange: (url: string | null) => void
  /** Alt text for the preview — the product name, per SPEC 3.7. */
  alt: string
  onUploadError: (message: string) => void
}

/**
 * Posts one file to /api/upload and hands back the URL it returns. Not a general uploader:
 * a product has exactly one image (SPEC 3.2), so replacing it is just uploading again.
 *
 * XMLHttpRequest rather than fetch, because xhr.upload.onprogress is the only way to get real
 * bytes-sent events — fetch cannot report upload progress. The file input stays uncontrolled
 * and the rest props land on it, so the shadcn FormControl wiring (id, aria-describedby,
 * aria-invalid) reaches the real control rather than stopping at this wrapper.
 */
export function ImageDropzone({ value, onValueChange, alt, onUploadError, ...inputProps }: Props) {
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const statusId = useId()

  function upload(file: File) {
    // The same schema the route enforces, run here purely for instant feedback — the server
    // stays the boundary, exactly as the resolver in product-form.tsx is a convenience (SPEC 8).
    const precheck = productImageSchema.safeParse(file)
    if (!precheck.success) {
      onUploadError(precheck.error.issues.map((issue) => issue.message).join(' '))
      return
    }

    setProgress(0)
    const body = new FormData()
    body.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100))
    })

    xhr.addEventListener('load', () => {
      setProgress(null)
      // A misconfigured R2 throws through to Next's 500, whose body is HTML — so the parse has
      // to be able to fail without taking the form down with it.
      let payload: { url?: string; error?: string } = {}
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        payload = {}
      }

      if (xhr.status === 200 && payload.url) {
        onValueChange(payload.url)
      } else {
        onUploadError(payload.error ?? 'The upload failed. Try again.')
      }
    })

    xhr.addEventListener('error', () => {
      setProgress(null)
      onUploadError('The upload failed. Try again.')
    })

    xhr.send(body)
  }

  function clear() {
    onValueChange(null)
    // The input is uncontrolled, so picking the same file again would not fire a change event.
    if (inputRef.current) inputRef.current.value = ''
  }

  const uploading = progress !== null

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        // dragleave also fires when the pointer crosses onto a child, which would make the
        // highlight flicker — only a leave that actually exits the box counts.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer.files[0]
        if (file) upload(file)
      }}
      className={cn(
        'grid gap-3 rounded-lg border border-dashed p-4 transition-colors',
        dragging && 'border-ring bg-accent',
      )}
    >
      {value ? (
        <div className="flex items-center gap-4">
          <Image
            src={value}
            alt={alt}
            width={96}
            height={96}
            className="size-24 rounded-md border object-cover"
          />
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Remove image
          </Button>
        </div>
      ) : null}

      <Input
        {...inputProps}
        ref={inputRef}
        type="file"
        accept={IMAGE_MIME_TYPES.join(',')}
        disabled={uploading || inputProps.disabled}
        aria-describedby={[inputProps['aria-describedby'], statusId].filter(Boolean).join(' ')}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) upload(file)
        }}
      />

      {uploading ? (
        <progress value={progress} max={100} aria-label="Upload progress" className="w-full" />
      ) : null}

      <p id={statusId} aria-live="polite" className="text-muted-foreground text-sm">
        {uploading
          ? `Uploading ${progress}%…`
          : value
            ? 'Image uploaded.'
            : 'Drag an image here, or choose one. JPEG, PNG or WebP, up to 5 MB.'}
      </p>
    </div>
  )
}
