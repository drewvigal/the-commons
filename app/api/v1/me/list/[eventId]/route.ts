import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId } = await params
  if (!UUID_RE.test(eventId)) return Response.json({ error: 'Invalid eventId' }, { status: 400 })

  await sql`
    INSERT INTO user_event_lists (user_id, event_id)
    VALUES (${session.user.id}::uuid, ${eventId}::uuid)
    ON CONFLICT (user_id, event_id) DO NOTHING
  `

  return Response.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId } = await params
  if (!UUID_RE.test(eventId)) return Response.json({ error: 'Invalid eventId' }, { status: 400 })

  await sql`
    DELETE FROM user_event_lists
    WHERE user_id = ${session.user.id}::uuid AND event_id = ${eventId}::uuid
  `

  return Response.json({ ok: true })
}
