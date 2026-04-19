import { sql } from '@/lib/db'

export async function GET() {
  const rows = await sql`SELECT id, title, slug, description FROM series ORDER BY title ASC`
  return Response.json(rows)
}
