/**
 * Turns the AI route's plain-text stream into the HTML TipTap stores.
 *
 * Lives here rather than in description-editor.tsx for the reason src/lib/cart.ts gives: pure
 * logic is kept out of the components so it is testable without a DOM. Vitest runs
 * `environment: 'node'`, and importing the editor would drag TipTap and React in with it.
 */

export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/**
 * The stream arrives as plain text, so the blank lines the prompt asks for have to become real
 * paragraphs — pushing the raw text at TipTap would parse it as HTML and collapse all of it into
 * one block. Escaping first is what stops a stray '<' mid-sentence from opening a tag.
 */
export function toParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block)}</p>`)
    .join('')
}
