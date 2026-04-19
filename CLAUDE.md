# My Events Calendar — Claude Code Context

Community events calendar for curators to ingest, review, and publish local events.
Source of truth for requirements: `community-calendar-project-brief.docx`.

## Tech Stack
- Next.js 15 App Router, TypeScript
- Neon Postgres (`@neondatabase/serverless`) — HTTP `sql` tagged template in `lib/db.ts`
- Auth.js v5 (`next-auth@beta`) — Google OAuth, JWT session strategy, role in token
- Resend — outbound email + inbound webhook (Svix HMAC verification)
- Anthropic SDK (`claude-sonnet-4-6`) — event extraction from email/HTML in `lib/claude.ts`

## Role Hierarchy
`developer (4) > admin (3) > curator (2) > user (1)`
- Guard functions in `lib/roles.ts`: `canIngestEmail`, `canPublishEvent`, `canManageTags`, `canManageUsers`

## Bootstrap (complete)
- [x] Neon DB created, `DATABASE_URL` set
- [x] Google OAuth credentials set (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`)
- [x] `AUTH_SECRET` generated via `npx auth secret`
- [x] Resend API key set (`RESEND_API_KEY`)
- [x] Anthropic API key set (`ANTHROPIC_API_KEY`)
- [x] `npm run migrate` — all tables + seeds applied
- [x] First user promoted to admin via Neon SQL editor

## Phase Status

| Phase | Status | Scope |
|-------|--------|-------|
| 0 | ✅ Done | DB schema, migrations, Google OAuth, Resend webhook skeleton |
| 1 | ✅ Done | Email ingestion, URL extraction, draft review queue, public event views, .ics feeds |
| 1.5 | 🔜 Next | WordPress iframe embed |
| 2 | Pending | Multi-curator, role enforcement, invite-only registration |
| 2.5 | Pending | Public submission form, moderation queue |
| 3 | Pending | Stripe donation, RSS ingestion |

## Phase 1 — What Was Built

### Ingestion
- `app/api/v1/ingest/email/route.ts` — Resend/Svix inbound webhook; checks sender role; calls Claude; logs to `ingestion_log`
- `app/api/v1/ingest/url/route.ts` — Authenticated URL endpoint; fetches HTML, strips tags, extracts og:image; calls Claude
- `app/ingest/page.tsx` — Dual-mode UI (URL tab + paste-text tab); redirects to draft on success
- `scripts/test-email-ingest.ts` — Local test script that POSTs a valid Svix-signed payload to localhost (bypasses real MX records)

### Draft Review Queue
- `app/drafts/page.tsx` — Curator-only draft listing
- `app/drafts/[id]/page.tsx` — Full editor: all fields, datetime-local with timezone conversion, tag checkboxes, series dropdown, image preview, raw source toggle; back link is context-aware (→ event if published, → drafts if draft)
- `app/drafts/[id]/VenueAutocomplete.tsx` — Client component: Google Places search box that auto-fills venue name, address, city, state, Maps URL on selection
- `app/drafts/actions.ts` — Server actions: `publishEvent()`, `discardEvent()` (owner or admin+)

### Public Event Views
- `app/events/page.tsx` — Published events listing; filter by tag/series; series pill rendered first (highlighted blue), then regular tag pills; subscribe link is context-aware (series feed / tag feed / all)
- `app/events/[id]/page.tsx` — Golden ratio two-column layout (1.618fr / 1fr); left: title, summary, date, location, description; right: image, "Visit Event Page" button, related events (series pill + tag pills)

### .ics Feeds
- `app/feed/all.ics/route.ts` — All published events; RFC 5545, 300s cache
- `app/feed/tag/[slug].ics/route.ts` — Tag-filtered feed
- `app/feed/curator/[userId].ics/route.ts` — Curator's personal list feed
- `lib/ical.ts` — RFC 5545 formatter (TZID, line folding, escaping)

### Series
- `app/series/page.tsx` — Series list with event counts; Edit link per row
- `app/series/new/page.tsx` — Create series (auto-slugify)
- `app/series/[id]/edit/page.tsx` — Edit series title, slug, description

### Nav & Layout
- `app/layout.tsx` — Async server component; public links (Events, Series) always visible; curator-only links (Drafts, Ingest URL) separated by a divider and shown in muted style; Subscribe (.ics) removed

### Visual Design
- `app/globals.css` — `.tag--series` class: blue-tinted pill (bg `#e8f0fe`, border `#93b4f5`, text `#1a4bbf`, bold) used on both listing and detail pages
- Series description shown on filtered events page (`/events?series=`) below the heading, full opacity, `1.05rem`
- .ics links across all pages are muted/small; removed from event detail page entirely

## Key Decisions
- **Google Places venue search:** Uses Places API (New) REST endpoints directly (`places:autocomplete` + `places/{id}`) with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Custom dropdown in `VenueAutocomplete.tsx` — do NOT use the `PlaceAutocompleteElement` web component (shadow DOM swallows events) or the legacy JS SDK `Autocomplete` class (requires old Places API). Also requires Maps JavaScript API enabled in Cloud Console.
- **Inbound email testing:** Uses `scripts/test-email-ingest.ts` locally (no domain/MX needed). Swap to real Resend inbound when domain is purchased.
- **Timezone storage:** Events stored as UTC `timestamptz`; draft editor converts to/from IANA timezone using `datetime-local` inputs.
- **Auth:** JWT only — no session table. User id + role embedded in signed cookie.
- **Claude extraction:** `lib/claude.ts` calls Sonnet 4.6 with a strict JSON schema. Extraction failures are logged to `ingestion_log` but don't crash the webhook.

## What's Next
- Phase 1.5: WordPress iframe embed for the public events view
- Visual brand pass: colors, typography (deferred — will do as a dedicated session)
