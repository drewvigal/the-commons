import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(session.user.role, 'curator')) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return Response.json({ error: 'Invalid id' }, { status: 400 })

  const existing = await sql`SELECT owner_id, status FROM events WHERE id = ${id}::uuid`
  if (!existing[0]) return Response.json({ error: 'Not found' }, { status: 404 })

  const isOwner     = (existing[0].owner_id as string) === session.user.id
  const isAdminPlus = hasRole(session.user.role, 'admin')
  if (!isOwner && !isAdminPlus) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await sql`
    UPDATE events
    SET status = 'published', updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING *
  `

  return Response.json(rows[0])
}
