import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return Response.json({ error: 'Invalid id' }, { status: 400 })

  const rows = await sql`
    SELECT
      e.*,
      COALESCE(
        json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS tags
    FROM events e
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    WHERE e.id = ${id}::uuid AND e.status = 'published'
    GROUP BY e.id
  `

  if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(rows[0])
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(session.user.role, 'curator')) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return Response.json({ error: 'Invalid id' }, { status: 400 })

  const existing = await sql`SELECT owner_id, status FROM events WHERE id = ${id}::uuid`
  if (!existing[0]) return Response.json({ error: 'Not found' }, { status: 404 })

  const isOwner    = (existing[0].owner_id as string) === session.user.id
  const isAdminPlus = hasRole(session.user.role, 'admin')
  if (!isOwner && !isAdminPlus) return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = await sql`
    UPDATE events SET
      title         = COALESCE(${(body.title as string | null) ?? null}, title),
      summary       = COALESCE(${(body.summary as string | null) ?? null}, summary),
      description   = COALESCE(${(body.description as string | null) ?? null}, description),
      starts_at     = COALESCE(${(body.starts_at as string | null) ?? null}::timestamptz, starts_at),
      ends_at       = COALESCE(${(body.ends_at as string | null) ?? null}::timestamptz, ends_at),
      timezone      = COALESCE(${(body.timezone as string | null) ?? null}, timezone),
      location_type = COALESCE(${(body.location_type as string | null) ?? null}, location_type),
      address       = COALESCE(${(body.address as string | null) ?? null}, address),
      city          = COALESCE(${(body.city as string | null) ?? null}, city),
      state         = COALESCE(${(body.state as string | null) ?? null}, state),
      virtual_url   = COALESCE(${(body.virtual_url as string | null) ?? null}, virtual_url),
      event_url     = COALESCE(${(body.event_url as string | null) ?? null}, event_url),
      image_url     = COALESCE(${(body.image_url as string | null) ?? null}, image_url),
      updated_at    = now()
    WHERE id = ${id}::uuid
    RETURNING *
  `

  return Response.json(rows[0])
}
