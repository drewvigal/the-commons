# The Commons — Claude Code Context

Community events calendar for curators to ingest, review, and publish local events.
Source of truth for requirements: `community-calendar-project-brief.docx`.

## Tech Stack
- Next.js 15 App Router, TypeScript
- Neon Postgres (`@neondatabase/serverless`) — HTTP `sql` tagged template in `lib/db.ts`
- Auth.js v5 (`next-auth@beta`) — Google OAuth, JWT session strategy, role in token
- Resend — outbound email + inbound webhook (Svix HMAC verification)
- Anthropic SDK (`claude-sonnet-4-6`) — event extraction from email/HTML in `lib/claude.ts`
- `react-markdown` — Markdown rendering in `ContentEditor`

## Role Hierarchy
`developer (4) > admin (3) > curator (2) > user (1)`
- Guard functions in `lib/roles.ts`: `canIngestEmail`, `canPublishEvent`, `canManageTags`, `canManageUsers`
- To promote a user to admin: `UPDATE users SET role = 'admin' WHERE email = 'their@email.com';` in Neon SQL editor

## Bootstrap (complete)
- [x] Neon DB created, `DATABASE_URL` set
- [x] Google OAuth credentials set (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`)
- [x] `AUTH_SECRET` generated via `npx auth secret`
- [x] Resend API key set (`RESEND_API_KEY`)
- [x] Anthropic API key set (`ANTHROPIC_API_KEY`)
- [x] `npm run migrate` — all tables + seeds applied
- [x] First user promoted to admin via Neon SQL editor
- [x] Deployed to Vercel, connected to `thecommons.forum` domain
- [x] Google OAuth authorized origins updated for production
- [x] Unsplash API key set (`UNSPLASH_ACCESS_KEY`)

## Phase Status

| Phase | Status | Scope |
|-------|--------|-------|
| 0 | ✅ Done | DB schema, migrations, Google OAuth, Resend webhook skeleton |
| 1 | ✅ Done | Email ingestion, URL extraction, draft review queue, public event views, .ics feeds |
| 1.5 | ✅ Done | WordPress iframe embed, branding, visual design |
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
- `app/drafts/[id]/page.tsx` — Full editor: all fields, datetime-local with timezone conversion, tag checkboxes, series checkboxes (multi-series), image preview, raw source toggle; back link is context-aware (→ event if published, → drafts if draft); form clusters: Location (location type, venue, virtual URL, neighborhoods) and Relating Events (series, default tags, custom tags)
- `app/drafts/[id]/VenueAutocomplete.tsx` — Client component: Google Places search box that auto-fills venue name, address, city, state, Maps URL on selection
- `app/drafts/[id]/InlineTagAdder.tsx` — Client component: inline create custom or neighborhood tags without leaving the edit page; new tags appear as checked checkboxes included in form submission
- `app/drafts/[id]/UnsplashPicker.tsx` — Client component: reveal panel below image URL field; curator searches Unsplash, clicks thumbnail to fill URL; proxies via `/api/unsplash` to keep API key server-side
- `app/drafts/[id]/tag-actions.ts` → moved to `app/drafts/tag-actions.ts` — `createTag(name, category)` server action (curator+); upserts by slug
- `app/drafts/actions.ts` — Server actions: `publishEvent()`, `discardEvent()` (owner or admin+)

### Public Event Views
- `app/events/page.tsx` — Card grid (4 col), grouped by month with slate dividers; series pills + up to 3 tags on cards; date bar above image (full-width, not overlaid); filters by `?tag=slug` or `?series=slug`
- `app/events/[id]/page.tsx` — Golden ratio two-column layout (1.618fr / 1fr); left: title, summary, date, location, description; right: image, "Visit Event Page" button, related events (all series + tags as clickable pills)

### .ics Feeds
- `app/feed/all.ics/route.ts` — All published events; RFC 5545, 300s cache
- `app/feed/tag/[slug].ics/route.ts` — Tag-filtered feed
- `app/feed/series/[slug].ics/route.ts` — Series-filtered feed
- `app/feed/curator/[userId].ics/route.ts` — Curator's personal list feed
- `lib/ical.ts` — RFC 5545 formatter (TZID, line folding, escaping)

### Series
- `app/series/page.tsx` — Series list with event counts; Edit link per row
- `app/series/new/page.tsx` — Create series (auto-slugify)
- `app/series/[id]/edit/page.tsx` — Edit series title, slug, description

## Phase 1.5 — What Was Built

### Branding & Visual Design
- Site name: **The Commons** (reserved "The Commons : Portland" colon pattern for future sub-sites)
- `app/globals.css` — Full visual redesign: navy/slate/lavender color palette, serif font for site title and events heading, card grid layout, full-width nav bars
- **Color palette:**
  - Top bar bg: `#1E2C51`
  - Header (title + tagline) bg: `#3A4C7C`
  - Section nav / month dividers: `#4d5e8a`
  - Page bg: `#e5ddf0` (lavender)
- **Three-tier nav:**
  - Top bar (`#1E2C51`): About The Commons | How We Collaborate — auth (right)
  - Header (`#3A4C7C`): "The Commons" serif title + uppercase tagline
  - Section nav (`#4d5e8a`): Events : Series — curator links (right)
- **CSS specificity gotcha:** `.top-bar .bar-inner` and `.section-nav .bar-inner` use `padding-top`/`padding-bottom` only (NOT the `padding` shorthand) so they don't override `.container`'s horizontal padding

### CMS / Inline Editing
- `migrations/002_site_content.sql` — `site_content(key text PK, value text)` table
- `lib/content.ts` — `getContent(key)` and `getContentMany(keys[])` helpers
- `app/content-actions.ts` — `updateContent(key, value)` server action (admin+ only)
- `app/ContentEditor.tsx` — Client component: hover → Edit button → textarea → save. `format="paragraphs"` renders Markdown via `react-markdown`. Only visible to admin/developer roles.
- **Editable keys:** `tagline`, `footer`, `about:body`, `how-it-works:intro`, `how-it-works:browsing`, `how-it-works:member`, `how-it-works:curator`
- Markdown supported in all paragraph fields: `**bold**`, `*italic*`, `[link](url)`, headings

### Content Pages
- `app/about/page.tsx` — About The Commons (DB-backed, inline editable for admins)
- `app/how-it-works/page.tsx` — Three-tier membership explanation (DB-backed, inline editable); `suppressHydrationWarning` on curator mailto link (Gmail extension rewrites it)

### WordPress Embed
- `app/embed/events/page.tsx` — Embeddable events listing, all links `target="_blank"`
- `app/embed/page.tsx` — Curator-only iframe code generator
- `app/embed/layout.tsx` — Minimal layout (no nav)
- `next.config.ts` — `X-Frame-Options: ALLOWALL` for `/embed/*` routes

### Auth
- Sign in / sign out in top bar (right side)
- `app/SignOutButton.tsx` — Client component using `next-auth/react` `signOut()`

## Key Decisions
- **Google Places venue search:** Uses Places API (New) REST endpoints directly (`places:autocomplete` + `places/{id}`) with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Custom dropdown in `VenueAutocomplete.tsx` — do NOT use the `PlaceAutocompleteElement` web component (shadow DOM swallows events) or the legacy JS SDK `Autocomplete` class (requires old Places API). Also requires Maps JavaScript API enabled in Cloud Console.
- **Inbound email testing:** Uses `scripts/test-email-ingest.ts` locally (no domain/MX needed). Swap to real Resend inbound when domain is purchased.
- **Timezone storage:** Events stored as UTC `timestamptz`; draft editor converts to/from IANA timezone using `datetime-local` inputs.
- **Auth:** JWT only — no session table. User id + role embedded in signed cookie.
- **Claude extraction:** `lib/claude.ts` calls Sonnet 4.6 with a strict JSON schema. Extraction failures are logged to `ingestion_log` but don't crash the webhook.
- **Content editing:** `render` functions cannot be passed as props from server to client components — use `format="paragraphs"` prop on `ContentEditor` instead.
- **Route handler params typing:** Use `{ params: Promise<any> }` with a cast inside — Next.js 15 / Vercel is stricter than local dev about param types.
- **Tags are categorized:** `default` (seeded, general), `custom` (curator-created), `neighborhood` (curator-created). Stored in `tags.category` column (migration 003). Displayed in separate fieldsets on edit page.
- **Series is many-to-many:** `event_series` junction table (migration 004). Events can belong to multiple series. All queries use `jsonb_agg(DISTINCT jsonb_build_object(...))` — must use `jsonb` not `json` because `DISTINCT` requires an equality operator.
- **Unsplash image search:** Proxied via `/api/unsplash` route to keep `UNSPLASH_ACCESS_KEY` server-side. Demo tier (50 req/hour) is sufficient for curator use.

## What's Next
- Phase 2: Multi-curator — invite-only registration, role enforcement, curator profiles
- Phase 2.5: Public event submission form + moderation queue
- Phase 3: Stripe donation, RSS ingestion
