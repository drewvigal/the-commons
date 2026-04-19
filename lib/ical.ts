export interface EventRow {
  id: string
  title: string
  summary: string | null
  starts_at: string
  ends_at: string | null
  timezone: string
  address: string | null
  virtual_url: string | null
  event_url: string | null
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// RFC 5545: lines over 75 octets must be folded with CRLF + single space
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const chunks: string[] = []
  let pos = 0
  let first = true
  while (pos < bytes.length) {
    const limit = first ? 75 : 74
    chunks.push(bytes.slice(pos, pos + limit).toString('utf8'))
    pos += limit
    first = false
  }
  return chunks.join('\r\n ')
}

export function formatIcalDate(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map(p => [p.type, p.value])
  )
  // Normalize midnight boundary (hour '24' → '00')
  const hour = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}${parts.month}${parts.day}T${hour}${parts.minute}${parts.second}`
}

export function formatIcalDateUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function generateIcal(events: EventRow[], calName = 'My Events Calendar'): string {
  const now = new Date()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Events Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ]

  for (const event of events) {
    const start = new Date(event.starts_at)
    const end = event.ends_at
      ? new Date(event.ends_at)
      : new Date(start.getTime() + 60 * 60 * 1000) // +1 hour fallback

    const location = event.address ?? event.virtual_url ?? ''

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:${event.id}@myeventscalendar`))
    lines.push(foldLine(`DTSTAMP:${formatIcalDateUtc(now)}`))
    lines.push(foldLine(`DTSTART;TZID=${event.timezone}:${formatIcalDate(start, event.timezone)}`))
    lines.push(foldLine(`DTEND;TZID=${event.timezone}:${formatIcalDate(end, event.timezone)}`))
    lines.push(foldLine(`SUMMARY:${escapeText(event.title)}`))
    if (event.summary) lines.push(foldLine(`DESCRIPTION:${escapeText(event.summary)}`))
    if (location) lines.push(foldLine(`LOCATION:${escapeText(location)}`))
    if (event.event_url) lines.push(foldLine(`URL:${event.event_url}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
