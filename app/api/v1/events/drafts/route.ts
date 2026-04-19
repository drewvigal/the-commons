import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(session.user.role, 'curator')) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const isCurator = session.user.role === 'curator'

  const rows = await sql`
    SELECT
      e.id, e.title, e.summary, e.starts_at, e.ends_at, e.timezone,
      e.location_type, e.city, e.state, e.source_type, e.created_at,
      u.name AS owner_name, u.email AS owner_email,
      COALESCE(
        json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS tags
    FROM events e
    JOIN users u ON u.id = e.owner_id
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    WHERE e.status = 'draft'
      AND (${!isCurator} OR e.owner_id = ${session.user.id}::uuid)
    GROUP BY e.id, u.name, u.email
    ORDER BY e.created_at DESC
  `

  return Response.json(rows)
}
