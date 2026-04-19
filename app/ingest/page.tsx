import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'
import { extractEventFromText } from '@/lib/claude'

// Shared logic: extract → validate → insert → log → redirect
async function processExtraction(
  parsed: Awaited<ReturnType<typeof extractEventFromText>>,
  sourceRaw: string,
  userId: string,
  redirectBase: string
) {
  if (parsed.event_count === 0) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
      VALUES ('url', ${sourceRaw}, ${JSON.stringify(parsed)}, 'failed', ${userId}::uuid)
    `
    redirect(`${redirectBase}&error=No+event+found+in+the+content`)
  }

  if (parsed.event_count > 1) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
      VALUES ('url', ${sourceRaw}, ${JSON.stringify(parsed)}, 'flagged', ${userId}::uuid)
    `
    redirect(`${redirectBase}&error=Multiple+events+detected+%E2%80%94+flagged+for+review`)
  }

  if (!parsed.title || !parsed.starts_at || !parsed.timezone || !parsed.location_type) {
    redirect(`${redirectBase}&error=Could+not+extract+required+fields`)
  }

  const rows = await sql`
    INSERT INTO events (
      title, summary, description, starts_at, ends_at, timezone,
      location_type, venue_name, address, city, state,
      virtual_url, event_url, image_url, cost, maps_url,
      owner_id, source_type, source_raw, status
    ) VALUES (
      ${parsed.title},
      ${parsed.summary ?? null},
      ${parsed.description ?? null},
      ${parsed.starts_at},
      ${parsed.ends_at ?? null},
      ${parsed.timezone},
      ${parsed.location_type!},
      ${parsed.venue_name ?? null},
      ${parsed.address ?? null},
      ${parsed.city ?? null},
      ${parsed.state ?? null},
      ${parsed.virtual_url ?? null},
      ${parsed.event_url ?? null},
      ${parsed.image_url ?? null},
      ${parsed.cost ?? null},
      ${null},
      ${userId}::uuid,
      'url',
      ${sourceRaw},
      'draft'
    )
    RETURNING id
  `

  await sql`
    INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
    VALUES ('url', ${sourceRaw}, ${JSON.stringify(parsed)}, 'success', ${userId}::uuid)
  `

  redirect(`${redirectBase}&success=true&eventId=${rows[0].id as string}`)
}

function extractOgImage(html: string): string | null {
  return (
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
    null
  )
}

export default async function IngestPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; eventId?: string; tab?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/api/auth/signin')
  if (!hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

  const sp = await searchParams
  const activeTab = sp.tab === 'paste' ? 'paste' : 'url'

  async function ingestUrl(formData: FormData) {
    'use server'
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

    const url = (formData.get('url') as string | null)?.trim()
    if (!url) redirect('/ingest?tab=url&error=URL+is+required')

    try {
      const html = await fetch(url, {
        headers: { 'User-Agent': 'MyEventsCalendar/1.0' },
        signal: AbortSignal.timeout(10_000),
      }).then(r => r.text())

      const ogImage = extractOgImage(html)
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
      const parsed = await extractEventFromText(text)
      if (ogImage && !parsed.image_url) parsed.image_url = ogImage
      await processExtraction(parsed, url, session.user.id, '/ingest?tab=url')
    } catch (err: unknown) {
      if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
      console.error('Ingest URL error:', err)
      redirect('/ingest?tab=url&error=Something+went+wrong+%E2%80%94+check+the+URL+and+try+again')
    }
  }

  async function ingestText(formData: FormData) {
    'use server'
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

    const text     = (formData.get('text')      as string | null)?.trim()
    const eventUrl = (formData.get('event_url') as string | null)?.trim() || null
    const imageUrl = (formData.get('image_url') as string | null)?.trim() || null
    if (!text) redirect('/ingest?tab=paste&error=Please+paste+some+event+text')

    try {
      const parsed = await extractEventFromText(text!.slice(0, 8000))
      if (eventUrl) parsed.event_url = eventUrl
      if (imageUrl) parsed.image_url = imageUrl
      await processExtraction(parsed, text!, session.user.id, '/ingest?tab=paste')
    } catch (err: unknown) {
      if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
      console.error('Ingest text error:', err)
      redirect('/ingest?tab=paste&error=Extraction+failed+%E2%80%94+try+again')
    }
  }

  const tabStyle = (tab: string) => ({
    padding: '0.5rem 1.25rem',
    cursor: 'pointer',
    border: '1px solid var(--color-border)',
    borderBottom: activeTab === tab ? '1px solid #fff' : '1px solid var(--color-border)',
    borderRadius: '4px 4px 0 0',
    background: activeTab === tab ? '#fff' : '#f5f5f5',
    fontWeight: activeTab === tab ? 600 : 400,
    marginBottom: '-1px',
    textDecoration: 'none',
    color: 'var(--color-text)',
    display: 'inline-block',
  } as React.CSSProperties)

  return (
    <main>
      <h1>Ingest Event</h1>

      {sp.success && (
        <p className="message-success" style={{ marginBottom: '1rem' }}>
          Draft created!{' '}
          <a href={`/drafts/${sp.eventId}`}>Review &amp; edit draft</a>
          {' · '}
          <a href="/drafts">All drafts</a>
        </p>
      )}
      {sp.error && (
        <p className="message-error" style={{ marginBottom: '1rem' }}>{decodeURIComponent(sp.error)}</p>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: 0 }}>
        <a href="/ingest?tab=url"   style={tabStyle('url')}>From URL</a>
        <a href="/ingest?tab=paste" style={tabStyle('paste')}>Paste text</a>
      </div>

      <div style={{ border: '1px solid var(--color-border)', borderRadius: '0 4px 4px 4px', padding: '1.5rem' }}>
        {activeTab === 'url' && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Works best on static pages (WordPress, Squarespace, etc.).
              JS-rendered sites like Eventive or Luma may return no content — use <a href="/ingest?tab=paste">Paste text</a> instead.
              Thumbnail is auto-extracted from the page&apos;s og:image tag when available.
            </p>
            <form action={ingestUrl}>
              <label htmlFor="url">Event page URL</label>
              <input
                type="url"
                id="url"
                name="url"
                required
                placeholder="https://example.com/event"
                autoFocus
              />
              <div>
                <button type="submit" data-variant="primary">Extract &amp; Save as Draft</button>
              </div>
            </form>
          </>
        )}

        {activeTab === 'paste' && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Copy the event details from any page (select all text, Cmd+C) and paste below.
              Works for JS-rendered sites, PDFs, emails, or anywhere a URL fails.
            </p>
            <form action={ingestText}>
              <label htmlFor="event_url">Event page URL <span className="muted">(optional)</span></label>
              <input
                type="url"
                id="event_url"
                name="event_url"
                placeholder="https://example.com/event"
              />
              <label htmlFor="image_url">Thumbnail image URL <span className="muted">(optional — right-click the event image → Copy Image Address)</span></label>
              <input
                type="url"
                id="image_url"
                name="image_url"
                placeholder="https://example.com/image.jpg"
              />
              <label htmlFor="text">Event text</label>
              <textarea
                id="text"
                name="text"
                required
                rows={12}
                placeholder="Paste the event page text here…"
                style={{
                  padding: '0.5rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  width: '100%',
                  resize: 'vertical',
                }}
              />
              <div>
                <button type="submit" data-variant="primary">Extract &amp; Save as Draft</button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
