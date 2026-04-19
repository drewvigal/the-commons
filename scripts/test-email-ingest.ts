/**
 * Test script for the Resend inbound email webhook.
 *
 * Generates a valid Svix HMAC signature and POSTs a fake inbound email
 * to the local dev server — no real email address or domain required.
 *
 * Prerequisites:
 *   1. npm run dev must be running in another terminal
 *   2. RESEND_WEBHOOK_SECRET must be set in .env.local
 *   3. The `from` email below must match a user in the DB with role
 *      'curator', 'admin', or 'developer'. Update it to your own email
 *      before running, or the webhook will return 403.
 *
 * Usage:
 *   npx tsx scripts/test-email-ingest.ts
 */

import * as crypto from 'crypto'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET
const ENDPOINT       = 'http://localhost:3000/api/v1/ingest/email'

if (!WEBHOOK_SECRET) {
  console.error('RESEND_WEBHOOK_SECRET is not set in .env.local')
  process.exit(1)
}

// ─── UPDATE THIS to your email (must exist in users table with curator+ role) ───
const SENDER_EMAIL = 'andrew.devigal@gmail.com'

const payload = {
  type: 'email.received',
  data: {
    from: `Andrew DeVigal <${SENDER_EMAIL}>`,
    to:   ['ingest@myeventscalendar.com'],
    subject: 'Portland Node.js Meetup — May 2026',
    text: `
You're invited to the Portland Node.js Meetup!

Join us for a night of talks, demos, and networking with the local Node.js community.

Date: Thursday, May 14, 2026
Time: 6:30 PM – 9:00 PM PDT
Location: Centrl Office, 1355 NW Everett St, Portland, OR 97209

Talks this month:
- "Building real-time apps with Neon Postgres" by Jane Smith
- "TypeScript 5.8: what's new" by Bob Jones

Food and drinks provided. Free to attend.
RSVP: https://www.meetup.com/portland-nodejs/events/example
    `.trim(),
    html: null,
  },
}

function generateSvixSignature(secret: string, msgId: string, timestamp: string, body: string): string {
  // Svix signs: msgId + "." + timestamp + "." + body
  const toSign      = `${msgId}.${timestamp}.${body}`
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signature   = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64')
  return `v1,${signature}`
}

async function main() {
  const bodyStr   = JSON.stringify(payload)
  const msgId     = `msg_test_${Date.now()}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = generateSvixSignature(WEBHOOK_SECRET!, msgId, timestamp, bodyStr)

  console.log('Posting to:', ENDPOINT)
  console.log('From:', SENDER_EMAIL)
  console.log('Subject:', payload.data.subject)
  console.log()

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'svix-id':        msgId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    },
    body: bodyStr,
  })

  const text = await response.text()
  console.log('Status:', response.status)

  try {
    const json = JSON.parse(text)
    if (json.eventId) {
      console.log('✓ Event created — draft ID:', json.eventId)
      console.log('  Review at: http://localhost:3000/drafts')
    } else {
      console.log('Response:', json)
    }
  } catch {
    console.log('Response:', text)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
