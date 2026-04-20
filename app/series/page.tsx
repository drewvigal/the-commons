import { sql } from '@/lib/db'

export default async function SeriesPage() {
  const rows = await sql`
    SELECT s.id, s.title, s.slug, s.description,
           COUNT(e.id) AS event_count
    FROM series s
    LEFT JOIN event_series es ON es.series_id = s.id
    LEFT JOIN events e ON e.id = es.event_id AND e.status = 'published'
    GROUP BY s.id
    ORDER BY s.title ASC
  `

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Series</h1>
        <a href="/series/new">+ New series</a>
      </div>

      {rows.length === 0 ? (
        <p className="muted">No series yet. <a href="/series/new">Create one</a>.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map(s => (
            <li key={s.id as string} style={{ padding: '1rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                <strong>
                  <a href={`/events?series=${s.slug as string}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {s.title as string}
                  </a>
                </strong>
                <span className="muted">{s.event_count as number} published event{(s.event_count as number) !== 1 ? 's' : ''}</span>
                <a href={`/feed/series/${s.slug as string}.ics`} className="muted" style={{ fontSize: '0.8rem' }}>.ics</a>
                <a href={`/series/${s.id as string}/edit`} className="muted" style={{ fontSize: '0.8rem' }}>Edit</a>
              </div>
              {s.description && (
                <p className="muted" style={{ margin: '0.25rem 0 0' }}>{s.description as string}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
