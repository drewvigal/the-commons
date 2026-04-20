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
      e.id, e.title, e.starts_at, e.timezone,
      e.venue_name, e.city, e.state, e.image_url,
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

  const activeTag = tagSlug
    ? (events[0]?.tags as Array<{ name: string; slug: string }>)?.find(t => t.slug === tagSlug)?.name ?? tagSlug
    : null
  const activeSeries = seriesSlug
    ? (await sql`SELECT title, description FROM series WHERE slug = ${seriesSlug}`)[0] ?? null
    : null

  const heading = activeSeries?.title
    ? (activeSeries.title as string)
    : activeTag
      ? `${activeTag} Events`
      : 'Upcoming Events'

  // Group by month + year so events spanning calendar years stay in order
  const grouped: Array<{ key: string; label: string; events: typeof events }> = []
  for (const event of events) {
    const tz = (event.timezone as string) || 'UTC'
    const d = new Date(event.starts_at as string)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { timeZone: tz, month: 'long', year: 'numeric' })
    if (!grouped.length || grouped[grouped.length - 1].key !== key) {
      grouped.push({ key, label, events: [event] })
    } else {
      grouped[grouped.length - 1].events.push(event)
    }
  }

  return (
    <main>
      {activeSeries?.description && (
        <p style={{ marginBottom: '1rem', fontSize: '1.05rem' }}>{activeSeries.description as string}</p>
      )}

      <div className="events-container">
        <h1 className="events-heading">{heading}</h1>

        {events.length === 0 ? (
          <p className="muted">No published events yet.</p>
        ) : (
          grouped.map(({ key, label, events: monthEvents }) => (
            <div key={key}>
              <div className="month-divider">{label.toUpperCase()}</div>
              <div className="events-grid">
                {monthEvents.map(event => {
                  const tz = (event.timezone as string) || 'UTC'
                  const d = new Date(event.starts_at as string)
                  const day     = d.toLocaleString('en-US', { timeZone: tz, day: 'numeric' })
                  const weekday = d.toLocaleString('en-US', { timeZone: tz, weekday: 'long' })
                  const time    = d.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
                  const location = [event.venue_name, event.city].filter(Boolean).join(', ')
                  const seriesList = event.series as Array<{ title: string; slug: string }>
                  const tags = (event.tags as Array<{ name: string; slug: string }>).slice(0, 3)

                  return (
                    <a key={event.id as string} href={`/events/${event.id}`} className="event-card">
                      <div className="event-date-bar">
                        <span className="badge-day">{day}</span>
                        <span className="badge-weekday">{weekday}</span>
                        <span className="badge-time">{time}</span>
                      </div>
                      <div className="event-card-img">
                        {event.image_url
                          ? <img src={event.image_url as string} alt="" />
                          : null
                        }
                      </div>
                      <div className="event-card-body">
                        <div className="event-card-title">{event.title as string}</div>
                        {location && <div className="event-card-meta">{location}</div>}
                        {(seriesList.length > 0 || tags.length > 0) && (
                          <div className="event-card-tags">
                            {seriesList.map(s => (
                              <span key={s.slug} className="tag tag--series">{s.title}</span>
                            ))}
                            {tags.map(tag => (
                              <span key={tag.slug} className="tag">{tag.name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <p style={{ marginTop: '1.5rem' }}>
        {activeSeries
          ? <a href={`/feed/series/${seriesSlug}.ics`} className="muted" style={{ fontSize: '0.8rem' }}>Subscribe to this series (.ics)</a>
          : tagSlug
            ? <a href={`/feed/tag/${tagSlug}.ics`} className="muted" style={{ fontSize: '0.8rem' }}>Subscribe to {activeTag} events (.ics)</a>
            : <a href="/feed/all.ics" className="muted" style={{ fontSize: '0.8rem' }}>Subscribe to all events (.ics)</a>
        }
      </p>
    </main>
  )
}
