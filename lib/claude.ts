import Anthropic from '@anthropic-ai/sdk'

export interface ClaudeEventResult {
  event_count: number
  title?: string
  summary?: string
  description?: string | null
  starts_at?: string
  ends_at?: string | null
  timezone?: string
  location_type?: 'in_person' | 'virtual' | 'hybrid'
  venue_name?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  virtual_url?: string | null
  event_url?: string | null
  image_url?: string | null
  cost?: string | null
  tags_suggested?: string[]
}

const SYSTEM_PROMPT = `You are an event data extraction assistant. Given text content, extract structured event information and return ONLY a valid JSON object — no explanation, no markdown fences.

Focus on the PRIMARY event being described. Pages often mention related or upcoming events in sidebars, footers, or "you might also like" sections — ignore those and extract only the main event.

If the content describes a primary event (even if other events are mentioned in passing), return:
{
  "event_count": 1,
  "title": string,
  "summary": string (1-2 sentences, max 280 chars),
  "description": string | null (full event description — speakers, agenda, what to expect; plain text),
  "starts_at": string (ISO 8601 with timezone offset),
  "ends_at": string | null,
  "timezone": string (IANA, e.g. "America/Los_Angeles"),
  "location_type": "in_person" | "virtual" | "hybrid",
  "venue_name": string | null (name of the specific venue, e.g. "Cinema 21", "Revolution Hall"),
  "address": string | null,
  "city": string | null,
  "state": string | null,
  "virtual_url": string | null,
  "event_url": string | null,
  "cost": string | null (e.g. "Free", "$15", "$10–$25 sliding scale", "Pay what you can"),
  "tags_suggested": string[] (choose from: arts-culture, civic, community-meetup, education-workshops, food-drink, health-wellness, kids-family, media-film, music, outdoors-nature, spirituality-faith, sports-recreation, technology, virtual)
}

Only return { "event_count": 2 } if the page is genuinely a listing of multiple equal events (e.g. an events calendar page) with no single primary event.
If no event can be extracted at all, return: { "event_count": 0 }`

function parseClaudeJson(text: string): ClaudeEventResult {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  return JSON.parse(stripped) as ClaudeEventResult
}

/**
 * Calls Claude to extract structured event data from text content.
 * Throws on API failure or unparseable JSON — callers handle logging.
 */
export async function extractEventFromText(content: string): Promise<ClaudeEventResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Extract event data from this content:\n\n${content}`,
      },
    ],
  })

  const responseText =
    message.content[0]?.type === 'text' ? message.content[0].text : ''

  return parseClaudeJson(responseText)
}
