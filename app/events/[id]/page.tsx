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
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('title', s.title, 'slug', s.slug))
        FILTER (WHERE s.id IS NOT NULL),
        '[]'::jsonb
      ) AS series,
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::jsonb
      ) AS tags
    FROM events e
    LEFT JOIN event_series es ON es.event_id = e.id
    LEFT JOIN series s ON s.id = es.series_id
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    WHERE e.id = ${id}::uuid AND e.status = 'published'
    GROUP BY e.id
  `

  if (!rows[0]) notFound()
  const event      = rows[0]
  const seriesList = event.series as Array<{ title: string; slug: string }>
  const tags       = event.tags as Array<{ id: string; name: string; slug: string }>

  const tz = (event.timezone as string) || 'UTC'
  const d  = new Date(event.starts_at as string)

  const day     = d.toLocaleString('en-US', { timeZone: tz, day: 'numeric' })
  const weekday = d.toLocaleString('en-US', { timeZone: tz, weekday: 'long' })
  const time    = d.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })

  const fullDate = d.toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
  const endStr = event.ends_at
    ? new Date(event.ends_at as string).toLocaleString('en-US', {
        timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })
    : null

  const locationParts = [event.venue_name, event.address, event.city, event.state].filter(Boolean)
  const locationDisplay =
    event.location_type === 'virtual'
      ? `Virtual${event.virtual_url ? ` — ${event.virtual_url}` : ''}`
      : locationParts.join(', ')

  return (
    <main>
      <p style={{ marginBottom: '1rem' }}>
        <a href="/events" className="muted">← Back to events</a>
        {isCurator && <> · <a href={`/drafts/${id}`} className="muted">Edit event</a></>}
      </p>

      <div className="events-container">
        {/* Date bar — matches listing card style */}
        <div className="event-date-bar" style={{ margin: '-1.5rem -1.5rem 1.5rem', borderRadius: '10px 10px 0 0' }}>
          <span className="badge-day">{day}</span>
          <span className="badge-weekday">{weekday}</span>
          <span className="badge-time">{time}</span>
        </div>

        {/* Golden ratio layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.618fr 1fr', gap: '3rem', alignItems: 'start' }}>

          {/* Left column */}
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', marginTop: 0, lineHeight: 1.2 }}>
              {event.title as string}
            </h1>

            {event.summary && (
              <p style={{ fontSize: '1.1rem', fontWeight: 500, marginTop: '-0.25rem', marginBottom: '1.25rem', color: 'var(--color-muted)' }}>
                {event.summary as string}
              </p>
            )}

            <p style={{ margin: '0 0 0.25rem' }}>
              {fullDate}{endStr ? ` – ${endStr}` : ''}
            </p>

            {locationDisplay && (
              <p style={{ margin: '0 0 0.25rem' }}>
                {locationDisplay}
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
              <p style={{ marginTop: '1.5rem', lineHeight: 1.7 }}>{event.description as string}</p>
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
                className="btn-cta"
                style={{ marginBottom: '1.5rem' }}
              >
                Visit Event Page
              </a>
            )}

            {(seriesList.length > 0 || tags.length > 0) && (
              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-muted)' }}>
                  Explore related events
                </p>
                <div>
                  {seriesList.map(s => (
                    <a key={s.slug} href={`/events?series=${s.slug}`} className="tag tag--series">{s.title}</a>
                  ))}
                  {tags.map(tag => (
                    <a key={tag.slug} href={`/events?tag=${tag.slug}`} className="tag">{tag.name}</a>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  )
}
