import { sql } from '@/lib/db'

export const revalidate = 60

export default async function EmbedEventsPage({
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
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('title', s.title, 'slug', s.slug))
        FILTER (WHERE s.id IS NOT NULL),
        '[]'::jsonb
      ) AS series,
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::jsonb
      ) AS tags
    FROM events e
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    LEFT JOIN event_series es ON es.event_id = e.id
    LEFT JOIN series s ON s.id = es.series_id
    WHERE e.status = 'published'
      AND (${tagSlug}::text IS NULL OR e.id IN (
        SELECT et2.event_id FROM event_tags et2
        JOIN tags t2 ON t2.id = et2.tag_id
        WHERE t2.slug = ${tagSlug}
      ))
      AND (${seriesSlug}::text IS NULL OR e.id IN (
        SELECT es2.event_id FROM event_series es2
        JOIN series s2 ON s2.id = es2.series_id
        WHERE s2.slug = ${seriesSlug}
      ))
    GROUP BY e.id
    ORDER BY e.starts_at ASC
  `

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const activeTag = tagSlug
    ? (events[0]?.tags as Array<{ name: string; slug: string }>)?.find(t => t.slug === tagSlug)?.name ?? tagSlug
    : null
  const activeSeries = seriesSlug
    ? (await sql`SELECT title, description FROM series WHERE slug = ${seriesSlug}`)[0] ?? null
    : null

  return (
    <div>
      {activeSeries?.description && (
        <p style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>
          {activeSeries.description as string}
        </p>
      )}

      {events.length === 0 ? (
        <p className="muted">No upcoming events.</p>
      ) : (
        <ul className="event-list" style={{ margin: 0 }}>
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
                  <a href={`${appUrl}/events/${event.id as string}`} target="_blank" rel="noopener" style={{ flexShrink: 0 }}>
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
                  <a href={`${appUrl}/events/${event.id as string}`} target="_blank" rel="noopener">
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
                    {(event.series as Array<{ title: string; slug: string }>).map(s => (
                      <a key={s.slug} href={`${appUrl}/events?series=${s.slug}`} target="_blank" rel="noopener" className="tag tag--series">
                        {s.title}
                      </a>
                    ))}
                    {tags.map(tag => (
                      <a key={tag.slug} href={`${appUrl}/events?tag=${tag.slug}`} target="_blank" rel="noopener" className="tag">
                        {tag.name}
                      </a>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8rem' }}>
        <a href={`${appUrl}/events${seriesSlug ? `?series=${seriesSlug}` : tagSlug ? `?tag=${tagSlug}` : ''}`}
          target="_blank" rel="noopener" className="muted">
          View full calendar →
        </a>
      </p>
    </div>
  )
}
