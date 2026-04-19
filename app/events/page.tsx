import { sql } from '@/lib/db'

export const revalidate = 60

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; series?: string }>
}) {
  const sp = await searchParams
  const tagSlug    = sp.tag    ?? null
  const seriesSlug = sp.series ?? null

  const events = await sql`
    SELECT
      e.id, e.title, e.summary, e.starts_at, e.timezone,
      e.city, e.state, e.location_type, e.event_url, e.image_url, e.cost,
      s.title AS series_title, s.slug AS series_slug,
      COALESCE(
        json_agg(json_build_object('name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS tags
    FROM events e
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    LEFT JOIN series s ON s.id = e.series_id
    WHERE e.status = 'published'
      AND (${tagSlug}::text IS NULL OR e.id IN (
        SELECT et2.event_id FROM event_tags et2
        JOIN tags t2 ON t2.id = et2.tag_id
        WHERE t2.slug = ${tagSlug}
      ))
      AND (${seriesSlug}::text IS NULL OR s.slug = ${seriesSlug})
    GROUP BY e.id, s.title, s.slug
    ORDER BY e.starts_at ASC
  `

  const activeTag = tagSlug ? events[0] ? (events[0].tags as Array<{ name: string; slug: string }>).find(t => t.slug === tagSlug)?.name ?? tagSlug : tagSlug : null
  const activeSeries = seriesSlug
    ? (await sql`SELECT title, description FROM series WHERE slug = ${seriesSlug}`)[0] ?? null
    : null
  const activeSeriesTitle = activeSeries?.title as string ?? null

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: activeSeries?.description ? '0.25rem' : '1rem' }}>
        <h1 style={{ margin: 0 }}>
          {activeTag ? `${activeTag} events` : activeSeriesTitle ? activeSeriesTitle : 'Upcoming Events'}
        </h1>
      </div>

      {activeSeries?.description && (
        <p style={{ marginTop: '0.25rem', marginBottom: '1.5rem', fontSize: '1.05rem' }}>{activeSeries.description as string}</p>
      )}

      {events.length === 0 ? (
        <p className="muted">No published events yet.</p>
      ) : (
        <ul className="event-list">
          {events.map(event => {
            const tags = event.tags as Array<{ name: string; slug: string }>
            const date = new Date(event.starts_at as string).toLocaleString('en-US', {
              timeZone: event.timezone as string,
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
            const location = [event.city, event.state].filter(Boolean).join(', ')

            return (
              <li key={event.id as string} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                {event.image_url ? (
                  <a href={`/events/${event.id}`} style={{ flexShrink: 0 }}>
                    <img
                      src={event.image_url as string}
                      alt=""
                      style={{ width: '96px', height: '64px', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
                    />
                  </a>
                ) : (
                  <div style={{ width: '96px', height: '64px', flexShrink: 0, background: '#f0f0f0', borderRadius: '4px' }} />
                )}
                <div>
                  <a href={`/events/${event.id}`}>
                    <strong>{event.title as string}</strong>
                  </a>
                  <p className="muted" style={{ margin: '4px 0' }}>
                    {date}
                    {location && ` · ${location}`}
                    {' · '}
                    {(event.location_type as string).replace('_', ' ')}
                    {event.cost && ` · ${event.cost as string}`}
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
              </li>
            )
          })}
        </ul>
      )}

      <p style={{ marginTop: '2rem' }}>
        {activeSeries
          ? <a href={`/feed/series/${seriesSlug}.ics`} className="muted" style={{ fontSize: '0.85rem' }}>Subscribe to this series (.ics)</a>
          : tagSlug
            ? <a href={`/feed/tag/${tagSlug}.ics`} className="muted" style={{ fontSize: '0.85rem' }}>Subscribe to {activeTag} events (.ics)</a>
            : <a href="/feed/all.ics" className="muted" style={{ fontSize: '0.85rem' }}>Subscribe to all events (.ics)</a>
        }
      </p>
    </main>
  )
}
