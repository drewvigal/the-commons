import { sql } from '@/lib/db'
import { generateIcal, type EventRow } from '@/lib/ical'

export async function GET() {
  const events = await sql`
    SELECT id, title, summary, starts_at, ends_at, timezone,
           address, virtual_url, event_url
    FROM events
    WHERE status = 'published'
    ORDER BY starts_at ASC
  `

  const body = generateIcal(events as unknown as EventRow[], 'My Events Calendar')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="events.ics"',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
