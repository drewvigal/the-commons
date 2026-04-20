import { sql } from '@/lib/db'

export async function getContent(key: string, fallback = ''): Promise<string> {
  const rows = await sql`SELECT value FROM site_content WHERE key = ${key}`
  return (rows[0]?.value as string) ?? fallback
}

export async function getContentMany(keys: string[]): Promise<Record<string, string>> {
  const rows = await sql`SELECT key, value FROM site_content WHERE key = ANY(${keys})`
  const map: Record<string, string> = {}
  for (const row of rows) map[row.key as string] = row.value as string
  return map
}
