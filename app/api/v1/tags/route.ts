import { sql } from '@/lib/db'

export async function GET() {
  const rows = await sql`SELECT id, name, slug FROM tags ORDER BY name ASC`
  return Response.json(rows)
}
