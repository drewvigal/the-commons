import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT
      e.id, e.title, e.summary, e.starts_at, e.ends_at, e.timezone,
      e.location_type, e.city, e.state, e.event_url,
      uel.added_at,
      COALESCE(
        json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS tags
    FROM user_event_lists uel
    JOIN events e ON e.id = uel.event_id
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    WHERE uel.user_id = ${session.user.id}::uuid
    GROUP BY e.id, uel.added_at
    ORDER BY uel.added_at DESC
  `

  return Response.json(rows)
}
