import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default async function EditSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/api/auth/signin')
  if (!hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

  const { id } = await params
  const sp = await searchParams

  const rows = await sql`SELECT id, title, slug, description FROM series WHERE id = ${id}::uuid`
  if (rows.length === 0) notFound()
  const series = rows[0]

  async function updateSeries(formData: FormData) {
    'use server'
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

    const title       = (formData.get('title') as string | null)?.trim()
    const description = (formData.get('description') as string | null)?.trim() || null
    const customSlug  = (formData.get('slug') as string | null)?.trim()

    if (!title) redirect(`/series/${id}/edit?error=Title+is+required`)

    const slug = customSlug ? slugify(customSlug) : slugify(title)
    if (!slug) redirect(`/series/${id}/edit?error=Could+not+generate+a+valid+slug`)

    try {
      await sql`
        UPDATE series SET title = ${title}, slug = ${slug}, description = ${description}
        WHERE id = ${id}::uuid
      `
    } catch {
      redirect(`/series/${id}/edit?error=A+series+with+that+slug+already+exists`)
    }

    redirect('/series')
  }

  return (
    <main>
      <p><a href="/series">← Back to series</a></p>
      <h1>Edit Series</h1>

      {sp.error && <p className="message-error">{decodeURIComponent(sp.error)}</p>}

      <form action={updateSeries}>
        <label htmlFor="title">Title *</label>
        <input type="text" id="title" name="title" required defaultValue={series.title as string} autoFocus />

        <label htmlFor="slug">Slug</label>
        <input type="text" id="slug" name="slug" defaultValue={series.slug as string}
          pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only" />

        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3}
          style={{ padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '1rem' }}
          defaultValue={(series.description as string) ?? ''}
        />

        <div>
          <button type="submit" data-variant="primary">Save changes</button>
        </div>
      </form>
    </main>
  )
}
