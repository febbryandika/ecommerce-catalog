'use client'

import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Heading2, Italic, List, Loader2 } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { Label } from '@/components/ui/label'
import { describeSchema } from '@/lib/validation'

// Everything FormControl clones onto its child, plus the field wiring. Declared rather than
// spread from ComponentProps<'div'> because none of it lands on this wrapper — it all has to
// reach ProseMirror's contenteditable, which is the element the label and the errors describe.
type Props = {
  /** TipTap HTML. '' when the description is empty. */
  value: string
  onValueChange: (html: string) => void
  /** The form's Name field, watched — what the generator is asked to describe. */
  productName: string
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/**
 * The stream arrives as plain text, so the blank lines the prompt asks for have to become real
 * paragraphs — pushing the raw text at TipTap would parse it as HTML and collapse all of it into
 * one block. Escaping first is what stops a stray '<' mid-sentence from opening a tag.
 */
function toParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block)}</p>`)
    .join('')
}

/** A 403/400 from the route is JSON; an unexpected 500 is Next's HTML error page. */
async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body?.error === 'string') return body.error
  } catch {
    // fall through
  }
  return 'The description could not be generated. Try again.'
}

const CONTENT_CLASS = [
  'min-h-56 max-w-none px-3 py-2.5 text-sm outline-none',
  '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic',
  '[&_a]:underline [&_a]:underline-offset-4',
].join(' ')

/**
 * TipTap plus the AI sidebar (SPEC 3.6, 6). A single-shot stream, not a chat — there is no
 * message history and nothing to resume, so the raw fetch/reader loop is the whole client.
 *
 * Headings stop at h2 because the product page owns the h1; src/lib/sanitize.ts allows exactly
 * the tags this configuration can emit, so the two have to be changed together.
 */
export function DescriptionEditor({
  value,
  onValueChange,
  productName,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: Props) {
  const [specs, setSpecs] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const specsId = useId()
  const statusId = useId()

  // ProseMirror only reads these when it builds the DOM, so they are re-applied below whenever
  // the form's error state flips — otherwise aria-invalid would be frozen at its first value.
  const attributes = useMemo(
    () => ({
      ...(id ? { id } : {}),
      ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      ...(invalid ? { 'aria-invalid': 'true' } : {}),
      // A contenteditable div is not a labelable element, so FormLabel's htmlFor cannot name it.
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': 'Description',
      class: CONTENT_CLASS,
    }),
    [id, describedBy, invalid],
  )

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value,
    // The admin form is server-rendered, and TipTap warns and mismatches without this.
    immediatelyRender: false,
    editorProps: { attributes },
    onUpdate: ({ editor }) => onValueChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes } })
  }, [editor, attributes])

  // v3's useEditor does not re-render on every transaction, so reading editor.isActive() during
  // render would leave the toolbar showing the state the selection had one keystroke ago.
  const { bold, italic, heading, bulletList } = useEditorState({
    editor,
    selector: ({ editor }: { editor: Editor | null }) => ({
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      heading: editor?.isActive('heading', { level: 2 }) ?? false,
      bulletList: editor?.isActive('bulletList') ?? false,
    }),
  }) ?? { bold: false, italic: false, heading: false, bulletList: false }

  async function generate() {
    if (!editor) return

    // The same schema the route enforces, run here only for an instant message — the server
    // stays the boundary, exactly as the resolver in product-form.tsx is a convenience (SPEC 8).
    const precheck = describeSchema.safeParse({ name: productName, specs })
    if (!precheck.success) {
      setError(precheck.error.issues.map((issue) => issue.message).join(' '))
      return
    }

    // Captured before anything is cleared: a stream that dies halfway has to leave the existing
    // description exactly as it was (SPEC 3.6).
    const previous = editor.getHTML()
    setError(null)
    setStreaming(true)

    try {
      const response = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(precheck.data),
      })
      if (!response.ok || !response.body) throw new Error(await readError(response))

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      editor.commands.clearContent()
      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        buffer += decoder.decode(chunk, { stream: true })
        editor.commands.setContent(toParagraphs(buffer))
      }

      // A model-side failure — a rejected key, a rate limit — is not an HTTP error: the SDK
      // drops the error part on its way through toTextStream, so the response is a perfectly
      // ordinary 200 carrying nothing at all. Without this the editor would simply be left
      // empty and silent, which is the one outcome SPEC 3.6 rules out.
      if (!buffer.trim()) throw new Error('The generator returned nothing. Try again.')
    } catch (cause) {
      editor.commands.setContent(previous)
      setError(cause instanceof Error ? cause.message : 'The description could not be generated.')
    } finally {
      // setContent does not reliably emit an update, so the form field is synced by hand rather
      // than left holding whatever onUpdate last saw.
      onValueChange(editor.isEmpty ? '' : editor.getHTML())
      setStreaming(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="focus-within:border-ring focus-within:ring-ring/50 border-input overflow-hidden rounded-lg border transition-colors focus-within:ring-3">
        <div className="border-input flex items-center gap-1 border-b p-1">
          <Toggle
            size="sm"
            pressed={bold}
            onPressedChange={() => editor?.chain().focus().toggleBold().run()}
            aria-label="Bold"
          >
            <Bold />
          </Toggle>
          <Toggle
            size="sm"
            pressed={italic}
            onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
            aria-label="Italic"
          >
            <Italic />
          </Toggle>
          <Toggle
            size="sm"
            pressed={heading}
            onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            aria-label="Heading"
          >
            <Heading2 />
          </Toggle>
          <Toggle
            size="sm"
            pressed={bulletList}
            onPressedChange={() => editor?.chain().focus().toggleBulletList().run()}
            aria-label="Bullet list"
          >
            <List />
          </Toggle>
        </div>

        <EditorContent editor={editor} />
      </div>

      <aside className="grid content-start gap-2 rounded-lg border border-dashed p-3">
        <Label htmlFor={specsId}>Specs</Label>
        <Textarea
          id={specsId}
          rows={5}
          value={specs}
          onChange={(event) => setSpecs(event.target.value)}
          placeholder={'- 40 mm drivers\n- 60 h battery\n- USB-C'}
          disabled={streaming}
        />

        <Button type="button" onClick={generate} disabled={streaming} aria-busy={streaming}>
          {streaming ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {streaming ? 'Generating…' : 'Generate description'}
        </Button>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <p id={statusId} aria-live="polite" className="text-muted-foreground text-sm">
          {streaming
            ? 'Writing a description…'
            : productName
              ? `Writes a description for “${productName}” from these specs. Edit it afterwards.`
              : 'Enter a product name above, then add specs here.'}
        </p>
      </aside>
    </div>
  )
}
