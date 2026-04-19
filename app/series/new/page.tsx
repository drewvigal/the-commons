import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default async function NewSeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/api/auth/signin')
  if (!hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

  const sp = await searchParams

  async function createSeries(formData: FormData) {
    'use server'
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

    const title       = (formData.get('title') as string | null)?.trim()
    const description = (formData.get('description') as string | null)?.trim() || null
    const customSlug  = (formData.get('slug') as string | null)?.trim()

    if (!title) redirect('/series/new?error=Title+is+required')

    const slug = customSlug ? slugify(customSlug) : slugify(title)
    if (!slug) redirect('/series/new?error=Could+not+generate+a+valid+slug')

    try {
      await sql`
        INSERT INTO series (title, slug, description, owner_id)
        VALUES (${title}, ${slug}, ${description}, ${session.user.id}::uuid)
      `
    } catch (err: unknown) {
      if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
      redirect('/series/new?error=A+series+with+that+slug+already+exists')
    }

    redirect('/series')
  }

  return (
    <main>
      <p><a href="/series">← Back to series</a></p>
      <h1>Create Series</h1>
      <p className="muted">A series groups recurring or related events — e.g. "Monthly Node.js Meetup".</p>

      {sp.error && <p className="message-error">{decodeURIComponent(sp.error)}</p>}

      <form action={createSeries}>
        <label htmlFor="title">Title *</label>
        <input type="text" id="title" name="title" required placeholder="Monthly Node.js Meetup" autoFocus />

        <label htmlFor="slug">
          Slug <span className="muted">(auto-generated if blank)</span>
        </label>
        <input type="text" id="slug" name="slug" placeholder="monthly-nodejs-meetup"
          pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only" />

        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3}
          style={{ padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '1rem' }}
          placeholder="A monthly gathering of Portland's Node.js community." />

        <div>
          <button type="submit" data-variant="primary">Create Series</button>
        </div>
      </form>
    </main>
  )
}
