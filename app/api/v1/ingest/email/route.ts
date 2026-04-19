import { Webhook } from 'svix'
import { Resend } from 'resend'
import { sql } from '@/lib/db'
import { canIngestEmail } from '@/lib/roles'
import { extractEventFromText, type ClaudeEventResult } from '@/lib/claude'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResendInboundPayload {
  type: string
  data: {
    from: string
    to: string[]
    subject: string
    text: string | null
    html: string | null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract bare email address from "Display Name <email>" or plain "email" */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : from.toLowerCase().trim()
}

// ---------------------------------------------------------------------------
// POST /api/v1/ingest/email
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Read raw body once — HMAC is computed over the raw bytes.
  const rawBody = await request.text()

  // 2. Verify Resend / Svix webhook signature
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('RESEND_WEBHOOK_SECRET is not configured')
    return new Response('Server misconfigured', { status: 500 })
  }

  let payload: ResendInboundPayload
  try {
    const wh = new Webhook(webhookSecret)
    payload = wh.verify(rawBody, {
      'svix-id':        request.headers.get('svix-id')        ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    }) as ResendInboundPayload
  } catch {
    return new Response('Invalid webhook signature', { status: 401 })
  }

  if (payload.type !== 'email.received') {
    return new Response('Ignored', { status: 200 })
  }

  // 3. Extract and authorize sender
  const senderEmail = extractEmail(payload.data.from)
  const userRows = await sql`
    SELECT id, role FROM users WHERE email = ${senderEmail}
  `

  const sender = userRows[0] as { id: string; role: string } | undefined

  if (!sender || !canIngestEmail(sender.role as Parameters<typeof canIngestEmail>[0])) {
    return new Response('Unauthorized sender', { status: 403 })
  }

  const senderId = sender.id
  const emailBody = payload.data.text ?? payload.data.html ?? ''

  // 4. Extract event data with Claude
  let parsed: ClaudeEventResult
  try {
    parsed = await extractEventFromText(emailBody)
  } catch (err) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, status, created_by)
      VALUES ('email', ${rawBody}, 'failed', ${senderId}::uuid)
    `
    console.error('Claude extraction failed:', err)
    return new Response('Logged: extraction error', { status: 200 })
  }

  // 5. Branch on event_count
  if (parsed.event_count === 0) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
      VALUES ('email', ${rawBody}, ${JSON.stringify(parsed)}, 'failed', ${senderId}::uuid)
    `
    return new Response('Logged: no event found', { status: 200 })
  }

  if (parsed.event_count > 1) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
      VALUES ('email', ${rawBody}, ${JSON.stringify(parsed)}, 'flagged', ${senderId}::uuid)
    `
    return new Response('Logged: multiple events flagged for review', { status: 200 })
  }

  // 6. Single event — validate required fields and insert
  if (!parsed.title || !parsed.starts_at || !parsed.timezone || !parsed.location_type) {
    await sql`
      INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
      VALUES ('email', ${rawBody}, ${JSON.stringify(parsed)}, 'failed', ${senderId}::uuid)
    `
    return new Response('Logged: missing required fields', { status: 200 })
  }

  const eventRows = await sql`
    INSERT INTO events (
      title, summary, description, starts_at, ends_at, timezone,
      location_type, address, city, state,
      virtual_url, event_url,
      owner_id, source_type, source_raw, status
    ) VALUES (
      ${parsed.title},
      ${parsed.summary ?? null},
      ${parsed.description ?? null},
      ${parsed.starts_at},
      ${parsed.ends_at ?? null},
      ${parsed.timezone},
      ${parsed.location_type},
      ${parsed.address ?? null},
      ${parsed.city ?? null},
      ${parsed.state ?? null},
      ${parsed.virtual_url ?? null},
      ${parsed.event_url ?? null},
      ${senderId}::uuid,
      'email',
      ${rawBody},
      'draft'
    )
    RETURNING id
  `

  const newEventId = eventRows[0].id as string

  await sql`
    INSERT INTO ingestion_log (source_type, raw_input, parsed_json, status, created_by)
    VALUES ('email', ${rawBody}, ${JSON.stringify(parsed)}, 'success', ${senderId}::uuid)
  `

  // 7. Notify admin if draft threshold is reached
  try {
    const settingRows = await sql`
      SELECT key, value FROM admin_settings
      WHERE key IN ('draft_notification_threshold', 'notification_email')
    `
    const settings = Object.fromEntries(
      settingRows.map(r => [r.key as string, r.value as string])
    )
    const threshold   = parseInt(settings['draft_notification_threshold'] ?? '5', 10)
    const notifyEmail = settings['notification_email'] ?? ''

    if (notifyEmail) {
      const countRows = await sql`SELECT COUNT(*) AS count FROM events WHERE status = 'draft'`
      const draftCount = parseInt(countRows[0].count as string, 10)

      if (draftCount >= threshold) {
        const resend = new Resend(process.env.RESEND_API_KEY!)
        await resend.emails.send({
          from:    `noreply@${new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname}`,
          to:      notifyEmail,
          subject: `[My Events Calendar] ${draftCount} drafts awaiting review`,
          text:    `There are ${draftCount} draft events awaiting review. Log in to your admin panel to review them.`,
        })
      }
    }
  } catch (err) {
    console.error('Draft notification failed:', err)
  }

  return Response.json({ eventId: newEventId }, { status: 200 })
}
