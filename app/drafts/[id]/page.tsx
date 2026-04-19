import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import DraftActions from '../DraftActions'
import VenueAutocomplete from './VenueAutocomplete'

const UUID_RE = /^[0-9a-f-]{36}$/i

export default async function DraftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/api/auth/signin')
  if (!hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

  const { id }    = await params
  const sp        = await searchParams

  if (!UUID_RE.test(id)) notFound()

  const rows = await sql`
    SELECT e.*, u.name AS owner_name
    FROM events e
    JOIN users u ON u.id = e.owner_id
    WHERE e.id = ${id}::uuid
  `
  if (!rows[0]) notFound()

  const event = rows[0]

  const isOwner     = (event.owner_id as string) === session.user.id
  const isAdminPlus = hasRole(session.user.role, 'admin')
  if (!isOwner && !isAdminPlus) redirect('/drafts')

  const [tagsRows, currentTagRows, seriesRows] = await Promise.all([
    sql`SELECT id, name, slug FROM tags ORDER BY name ASC`,
    sql`SELECT tag_id FROM event_tags WHERE event_id = ${id}::uuid`,
    sql`SELECT id, title FROM series ORDER BY title ASC`,
  ])
  const currentTagIds = new Set(currentTagRows.map(r => r.tag_id as string))

  async function saveEvent(formData: FormData) {
    'use server'
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

    const get = (key: string) => (formData.get(key) as string | null)?.trim() || null
    const selectedTagIds = formData.getAll('tags') as string[]

    // Convert a naive "YYYY-MM-DDTHH:mm" datetime-local string to a UTC ISO string
    // by determining the offset for the given IANA timezone at that point in time.
    function localToUtcIso(localStr: string, timezone: string): string {
      const asIfUtc = new Date(localStr + ':00Z')
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      })
      const parts = Object.fromEntries(fmt.formatToParts(asIfUtc).map(p => [p.type, p.value]))
      const hour = parts.hour === '24' ? '00' : parts.hour
      const localAsUtc = new Date(`${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}Z`)
      const offsetMs = asIfUtc.getTime() - localAsUtc.getTime()
      return new Date(asIfUtc.getTime() + offsetMs).toISOString()
    }

    const tz = get('timezone') ?? (event.timezone as string)
    const startsAtUtc = get('starts_at') ? localToUtcIso(get('starts_at')!, tz) : null
    const endsAtUtc   = get('ends_at')   ? localToUtcIso(get('ends_at')!, tz)   : null
    const seriesId    = get('series_id') || null

    // Replace all tags for this event atomically
    await sql`DELETE FROM event_tags WHERE event_id = ${id}::uuid`
    for (const tagId of selectedTagIds) {
      await sql`INSERT INTO event_tags (event_id, tag_id) VALUES (${id}::uuid, ${tagId}::uuid) ON CONFLICT DO NOTHING`
    }

    await sql`
      UPDATE events SET
        title         = COALESCE(${get('title')}, title),
        summary       = ${get('summary')},
        description   = ${get('description')},
        timezone      = ${tz},
        starts_at     = COALESCE(${startsAtUtc}::timestamptz, starts_at),
        ends_at       = ${endsAtUtc}::timestamptz,
        location_type = COALESCE(${get('location_type')}, location_type),
        address       = ${get('address')},
        city          = ${get('city')},
        state         = ${get('state')},
        virtual_url   = ${get('virtual_url')},
        event_url     = ${get('event_url')},
        image_url     = ${get('image_url')},
        cost          = ${get('cost')},
        venue_name    = ${get('venue_name')},
        maps_url      = ${get('maps_url')},
        series_id     = ${seriesId}::uuid,
        updated_at    = now()
      WHERE id = ${id}::uuid
    `
    revalidatePath(`/drafts/${id}`)
    revalidatePath('/drafts')
    revalidatePath(`/events/${id}`)
    revalidatePath('/events')
    redirect(`/drafts/${id}?saved=1`)
  }

  // Format a UTC timestamp as YYYY-MM-DDTHH:mm in the event's local timezone
  // so the datetime-local input shows the correct local time, not UTC.
  const fmtDatetimeLocal = (iso: unknown) => {
    if (!iso) return ''
    const date = new Date(iso as string)
    const tz = (event.timezone as string) || 'UTC'
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]))
    const hour = parts.hour === '24' ? '00' : parts.hour
    return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`
  }

  return (
    <main>
      <p>
        {event.status === 'published'
          ? <a href={`/events/${id}`}>← Back to event</a>
          : <a href="/drafts">← Back to drafts</a>
        }
      </p>
      <h1>{event.status === 'published' ? 'Edit Event' : 'Edit Draft'}</h1>

      {sp.saved && <p className="message-success">Changes saved.</p>}

      <form action={saveEvent} style={{ maxWidth: '640px' }}>
        <label htmlFor="title">Title *</label>
        <input type="text" id="title" name="title" required defaultValue={event.title as string} />

        <label htmlFor="summary">Summary (max 280 chars)</label>
        <input type="text" id="summary" name="summary" maxLength={280} defaultValue={(event.summary as string) ?? ''} />

        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={4}
          style={{ padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '1rem' }}
          defaultValue={(event.description as string) ?? ''} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="starts_at">Start date &amp; time *</label>
            <input type="datetime-local" id="starts_at" name="starts_at" required
              defaultValue={fmtDatetimeLocal(event.starts_at)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="ends_at">End date &amp; time</label>
            <input type="datetime-local" id="ends_at" name="ends_at"
              defaultValue={fmtDatetimeLocal(event.ends_at)} />
          </div>
        </div>

        <label htmlFor="timezone">Timezone (IANA)</label>
        <input type="text" id="timezone" name="timezone" placeholder="America/Los_Angeles"
          defaultValue={(event.timezone as string) ?? ''} />

        <label htmlFor="location_type">Location type *</label>
        <select id="location_type" name="location_type"
          style={{ padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '1rem' }}
          defaultValue={(event.location_type as string) ?? 'in_person'}>
          <option value="in_person">In person</option>
          <option value="virtual">Virtual</option>
          <option value="hybrid">Hybrid</option>
        </select>

        <VenueAutocomplete
          defaultVenue={  (event.venue_name as string) ?? ''}
          defaultAddress={(event.address   as string) ?? ''}
          defaultCity={   (event.city      as string) ?? ''}
          defaultState={  (event.state     as string) ?? ''}
          defaultMapsUrl={(event.maps_url  as string) ?? ''}
        />

        <label htmlFor="virtual_url">Virtual / stream URL</label>
        <input type="url" id="virtual_url" name="virtual_url" defaultValue={(event.virtual_url as string) ?? ''} />

        <label htmlFor="cost">Cost</label>
        <input type="text" id="cost" name="cost" placeholder='e.g. Free, $15, $10–$25 sliding scale' defaultValue={(event.cost as string) ?? ''} />

        <label htmlFor="event_url">Event page URL</label>
        <input type="url" id="event_url" name="event_url" defaultValue={(event.event_url as string) ?? ''} />

        <label htmlFor="image_url">Thumbnail image URL</label>
        <input type="url" id="image_url" name="image_url" defaultValue={(event.image_url as string) ?? ''} />
        {event.image_url && (
          <img
            src={event.image_url as string}
            alt="Event thumbnail"
            style={{ display: 'block', marginTop: '0.5rem', maxWidth: '320px', maxHeight: '180px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          />
        )}

        <label htmlFor="series_id">Series</label>
        <select id="series_id" name="series_id"
          style={{ padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '1rem' }}
          defaultValue={(event.series_id as string) ?? ''}>
          <option value="">— None —</option>
          {seriesRows.map(s => (
            <option key={s.id as string} value={s.id as string}>{s.title as string}</option>
          ))}
        </select>
        {seriesRows.length === 0 && (
          <p className="muted" style={{ marginTop: '-0.75rem', fontSize: '0.8rem' }}>
            No series yet. <a href="/series/new">Create one</a>.
          </p>
        )}

        <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: '4px', padding: '0.75rem 1rem' }}>
          <legend style={{ fontWeight: 600, fontSize: '0.9rem', padding: '0 0.25rem' }}>Tags</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
            {tagsRows.map(tag => (
              <label key={tag.id as string} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'normal', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="tags"
                  value={tag.id as string}
                  defaultChecked={currentTagIds.has(tag.id as string)}
                />
                {tag.name as string}
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingTop: '0.5rem' }}>
          <button type="submit" data-variant="primary">Save changes</button>
          <span className="muted">or</span>
          <DraftActions eventId={id} />
        </div>
      </form>

      <details style={{ marginTop: '2rem' }}>
        <summary className="muted" style={{ cursor: 'pointer' }}>Raw source</summary>
        <pre style={{ marginTop: '0.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px', overflowX: 'auto', fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {event.source_raw as string}
        </pre>
      </details>

      <p className="muted" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
        Ingested via {event.source_type as string} · Owner: {event.owner_name as string}
      </p>
    </main>
  )
}
