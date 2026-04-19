import { sql } from '@/lib/db'
import { generateIcal, type EventRow } from '@/lib/ical'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  if (!UUID_RE.test(userId)) return new Response('Invalid userId', { status: 400 })

  const userRows = await sql`SELECT name FROM users WHERE id = ${userId}::uuid`
  if (!userRows[0]) return new Response('Curator not found', { status: 404 })
  const curatorName = (userRows[0].name as string | null) ?? 'Curator'

  const events = await sql`
    SELECT e.id, e.title, e.summary, e.starts_at, e.ends_at, e.timezone,
           e.address, e.virtual_url, e.event_url
    FROM user_event_lists uel
    JOIN events e ON e.id = uel.event_id
    WHERE uel.user_id = ${userId}::uuid
      AND e.status = 'published'
    ORDER BY uel.added_at DESC
  `

  const body = generateIcal(events as unknown as EventRow[], `${curatorName}'s Events`)

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="curator-${userId}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
