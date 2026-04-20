import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { generateIcal, type EventRow } from '@/lib/ical'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<any> }
) {
  const { slug } = await params as { slug: string }

  const seriesRows = await sql`SELECT id, title FROM series WHERE slug = ${slug}`
  if (!seriesRows[0]) {
    return new Response('Series not found', { status: 404 })
  }
  const series = seriesRows[0]

  const events = await sql`
    SELECT e.id, e.title, e.summary, e.starts_at, e.ends_at, e.timezone,
           e.address, e.virtual_url, e.event_url
    FROM events e
    JOIN event_series es ON es.event_id = e.id
    WHERE es.series_id = ${series.id}::uuid AND e.status = 'published'
    ORDER BY e.starts_at ASC
  `

  const body = generateIcal(events as unknown as EventRow[], series.title as string)

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
