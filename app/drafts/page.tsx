import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'
import DraftActions from './DraftActions'

export default async function DraftsPage() {
  const session = await auth()
  if (!session?.user) redirect('/api/auth/signin')
  if (!hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

  const isCurator = session.user.role === 'curator'

  const drafts = await sql`
    SELECT
      e.id, e.title, e.starts_at, e.timezone,
      e.city, e.state, e.location_type, e.source_type, e.created_at,
      u.name AS owner_name,
      COALESCE(
        json_agg(json_build_object('name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS tags
    FROM events e
    JOIN users u ON u.id = e.owner_id
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    WHERE e.status = 'draft'
      AND (${!isCurator} OR e.owner_id = ${session.user.id}::uuid)
    GROUP BY e.id, u.name
    ORDER BY e.created_at DESC
  `

  return (
    <main>
      <h1>Draft Events</h1>

      {drafts.length === 0 ? (
        <p className="muted">No drafts to review. <a href="/ingest">Ingest a URL</a> to create one.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Location</th>
              <th>Source</th>
              <th>Tags</th>
              <th>Owner</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map(draft => {
              const tags = draft.tags as Array<{ name: string; slug: string }>
              const date = new Date(draft.starts_at as string).toLocaleDateString('en-US', {
                timeZone: draft.timezone as string,
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              const location = [draft.city, draft.state].filter(Boolean).join(', ')
                || (draft.location_type as string).replace('_', ' ')

              return (
                <tr key={draft.id as string}>
                  <td><a href={`/drafts/${draft.id}`}><strong>{draft.title as string}</strong></a></td>
                  <td className="muted">{date}</td>
                  <td className="muted">{location}</td>
                  <td className="muted">{draft.source_type as string}</td>
                  <td>
                    {tags.map(tag => (
                      <span key={tag.slug} className="tag">{tag.name}</span>
                    ))}
                  </td>
                  <td className="muted">{draft.owner_name as string}</td>
                  <td><DraftActions eventId={draft.id as string} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </main>
  )
}
