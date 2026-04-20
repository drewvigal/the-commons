'use server'

import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'

export async function createTag(
  name: string,
  category: 'custom' | 'neighborhood'
): Promise<{ id: string; name: string } | null> {
  const session = await auth()
  if (!session?.user || !hasRole(session.user.role, 'curator')) return null

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!slug) return null

  // Upsert: if slug already exists return that row unchanged
  const rows = await sql`
    INSERT INTO tags (name, slug, category)
    VALUES (${name.trim()}, ${slug}, ${category})
    ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
    RETURNING id, name
  `
  return rows[0] ? { id: rows[0].id as string, name: rows[0].name as string } : null
}
