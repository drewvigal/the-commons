import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [{ id }, session] = await Promise.all([params, auth()])
  const isCurator = session?.user && hasRole(session.user.role, 'curator')

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const rows = await sql`
    SELECT
      e.*,
      s.title AS series_title, s.slug AS series_slug,
      COALESCE(
        json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS tags
    FROM events e
    LEFT JOIN series s ON s.id = e.series_id
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    WHERE e.id = ${id}::uuid AND e.status = 'published'
    GROUP BY e.id, s.title, s.slug
  `

  if (!rows[0]) notFound()
  const event = rows[0]
  const tags  = event.tags as Array<{ id: string; name: string; slug: string }>

  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: event.timezone as string,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }
  const startStr = new Date(event.starts_at as string).toLocaleString('en-US', dateOptions)
  const endStr   = event.ends_at
    ? new Date(event.ends_at as string).toLocaleString('en-US', dateOptions)
    : null

  const locationParts = [event.venue_name, event.address, event.city, event.state].filter(Boolean)
  const locationDisplay =
    event.location_type === 'virtual'
      ? `Virtual${event.virtual_url ? ` — ${event.virtual_url}` : ''}`
      : locationParts.join(', ')

  return (
    <main>
      <p>
        <a href="/events">← Back to events</a>
        {isCurator && <> · <a href={`/drafts/${id}`}>Edit event</a></>}
      </p>

      {/* Golden ratio layout: left ~61.8%, right ~38.2% */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.618fr 1fr', gap: '3rem', alignItems: 'start' }}>

        {/* Left column */}
        <div>
          <h1 style={{ marginTop: 0 }}>{event.title as string}</h1>

          {event.summary && (
            <p style={{ fontSize: '1.15rem', fontWeight: 500, marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
              {event.summary as string}
            </p>
          )}

          <p style={{ margin: '0 0 0.25rem' }}>{startStr}{endStr ? ` – ${endStr}` : ''}</p>

          {locationDisplay && (
            <p style={{ margin: '0 0 0.25rem' }}>
              {locationDisplay as string}
              {event.maps_url && (
                <> · <a href={event.maps_url as string} target="_blank" rel="noopener">Map</a></>
              )}
            </p>
          )}
          {event.location_type === 'hybrid' && event.virtual_url && (
            <p style={{ margin: '0 0 0.25rem' }}>
              <a href={event.virtual_url as string} target="_blank" rel="noopener">{event.virtual_url as string}</a>
            </p>
          )}
          {event.cost && (
            <p style={{ margin: '0 0 1.25rem' }} className="muted">{event.cost as string}</p>
          )}

          {event.description && (
            <p style={{ marginTop: '1.5rem' }}>{event.description as string}</p>
          )}
        </div>

        {/* Right column */}
        <div>
          {event.image_url && (
            <img
              src={event.image_url as string}
              alt=""
              style={{ display: 'block', width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '6px', marginBottom: '1.25rem' }}
            />
          )}

          {event.event_url && (
            <a
              href={event.event_url as string}
              target="_blank"
              rel="noopener"
              data-variant="primary"
              style={{ display: 'block', textAlign: 'center', marginBottom: '1.5rem' }}
            >
              Visit Event Page
            </a>
          )}

          {(event.series_title || tags.length > 0) && (
            <div>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="muted">
                Explore related events
              </p>
              <div>
                {event.series_title && (
                  <a href={`/events?series=${event.series_slug as string}`} className="tag tag--series">
                    {event.series_title as string}
                  </a>
                )}
                {tags.map(tag => (
                  <a key={tag.slug} href={`/events?tag=${tag.slug}`} className="tag">{tag.name}</a>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
