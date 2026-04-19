import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { generateIcal, type EventRow } from '@/lib/ical'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<any> }
) {
  const { slug } = await params as { slug: string }

  const tagRows = await sql`SELECT id, name FROM tags WHERE slug = ${slug}`
  if (!tagRows[0]) {
    return new Response('Tag not found', { status: 404 })
  }
  const tagName = tagRows[0].name as string

  const events = await sql`
    SELECT e.id, e.title, e.summary, e.starts_at, e.ends_at, e.timezone,
           e.address, e.virtual_url, e.event_url
    FROM events e
    JOIN event_tags et ON et.event_id = e.id
    JOIN tags t ON t.id = et.tag_id
    WHERE e.status = 'published'
      AND t.slug = ${slug}
    ORDER BY e.starts_at ASC
  `

  const body = generateIcal(events as unknown as EventRow[], `My Events Calendar — ${tagName}`)

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
