'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'

export async function updateContent(key: string, value: string) {
  const session = await auth()
  if (!session?.user || !hasRole(session.user.role, 'admin')) {
    throw new Error('Unauthorized')
  }

  await sql`
    INSERT INTO site_content (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `

  revalidatePath('/', 'layout')
  revalidatePath('/about')
  revalidatePath('/how-it-works')
}
