import { sql } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tag      = searchParams.get('tag')      // tag slug
  const city     = searchParams.get('city')
  const dateFrom = searchParams.get('date_from')
  const dateTo   = searchParams.get('date_to')
  const seriesId = searchParams.get('series_id')
  const virtual  = searchParams.get('virtual')  // 'true' | 'false'

  const rows = await sql`
    SELECT
      e.id, e.title, e.summary, e.starts_at, e.ends_at, e.timezone,
      e.location_type, e.address, e.city, e.state,
      e.virtual_url, e.event_url, e.image_url, e.series_id,
      e.created_at, e.updated_at,
      COALESCE(
        json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
        FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS tags
    FROM events e
    LEFT JOIN event_tags et ON et.event_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    WHERE e.status = 'published'
      AND (${city ?? null}::text IS NULL OR e.city ILIKE ${city ?? null})
      AND (${dateFrom ?? null}::text IS NULL OR e.starts_at >= ${dateFrom ?? null}::timestamptz)
      AND (${dateTo ?? null}::text IS NULL OR e.starts_at <= ${dateTo ?? null}::timestamptz)
      AND (${seriesId ?? null}::text IS NULL OR e.series_id = ${seriesId ?? null}::uuid)
      AND (${virtual ?? null}::text IS NULL OR (
        ${virtual} = 'true' AND e.location_type = 'virtual'
        OR ${virtual} = 'false' AND e.location_type != 'virtual'
      ))
      AND (${tag ?? null}::text IS NULL OR e.id IN (
        SELECT et2.event_id FROM event_tags et2
        JOIN tags t2 ON t2.id = et2.tag_id
        WHERE t2.slug = ${tag ?? null}
      ))
    GROUP BY e.id
    ORDER BY e.starts_at ASC
  `

  return Response.json(rows)
}
