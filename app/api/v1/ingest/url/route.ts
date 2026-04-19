import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'
import { extractEventFromText } from '@/lib/claude'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(session.user.role, 'curator')) return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const url = body.url?.trim()
  if (!url) return Response.json({ error: 'url is required' }, { status: 400 })

  // Fetch and strip HTML
  let text: string
  try {
    const html = await fetch(url, {
      headers: { 'User-Agent': 'MyEventsCalendar/1.0' },
      signal: AbortSignal.timeout(10_000),
    }).then(r => r.text())
    text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
  } catch (err) {
    console.error('URL fetch failed:', err)
    return Response.json({ error: 'Failed to fetch URL' }, { status: 422 })
  }

  // Extract with Claude
  let parsed
  try {
    parsed = await extractEventFromText(text)
  } catch (err) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, status, created_by)
      VALUES ('url', ${url}, 'failed', ${session.user.id}::uuid)
    `
    console.error('Claude extraction failed:', err)
    return Response.json({ error: 'Extraction failed' }, { status: 422 })
  }

  if (parsed.event_count === 0) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
      VALUES ('url', ${url}, ${JSON.stringify(parsed)}, 'failed', ${session.user.id}::uuid)
    `
    return Response.json({ error: 'No event found at that URL' }, { status: 422 })
  }

  if (parsed.event_count > 1) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
      VALUES ('url', ${url}, ${JSON.stringify(parsed)}, 'flagged', ${session.user.id}::uuid)
    `
    return Response.json({ error: 'Multiple events detected — flagged for manual review' }, { status: 422 })
  }

  if (!parsed.title || !parsed.starts_at || !parsed.timezone || !parsed.location_type) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
      VALUES ('url', ${url}, ${JSON.stringify(parsed)}, 'failed', ${session.user.id}::uuid)
    `
    return Response.json({ error: 'Could not extract required fields' }, { status: 422 })
  }

  const eventRows = await sql`
    INSERT INTO events (
      title, summary, description, starts_at, ends_at, timezone,
      location_type, address, city, state,
      virtual_url, event_url,
      owner_id, source_type, source_raw, status
    ) VALUES (
      ${parsed.title},
      ${parsed.summary ?? null},
      ${parsed.description ?? null},
      ${parsed.starts_at},
      ${parsed.ends_at ?? null},
      ${parsed.timezone},
      ${parsed.location_type},
      ${parsed.address ?? null},
      ${parsed.city ?? null},
      ${parsed.state ?? null},
      ${parsed.virtual_url ?? null},
      ${parsed.event_url ?? null},
      ${session.user.id}::uuid,
      'url',
      ${url},
      'draft'
    )
    RETURNING id
  `

  await sql`
    INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
    VALUES ('url', ${url}, ${JSON.stringify(parsed)}, 'success', ${session.user.id}::uuid)
  `

  return Response.json({ eventId: eventRows[0].id }, { status: 200 })
}
