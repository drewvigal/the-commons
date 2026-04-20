'use server'

import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getEventAndCheckAccess(eventId: string, userId: string, role: string) {
  const rows = await sql`SELECT owner_id FROM events WHERE id = ${eventId}::uuid`
  if (!rows[0]) throw new Error('Not found')
  const isOwner     = (rows[0].owner_id as string) === userId
  const isAdminPlus = hasRole(role as Parameters<typeof hasRole>[0], 'admin')
  if (!isOwner && !isAdminPlus) throw new Error('Forbidden')
}

export async function publishEvent(eventId: string) {
  const session = await auth()
  if (!session?.user || !hasRole(session.user.role, 'curator')) throw new Error('Forbidden')
  await getEventAndCheckAccess(eventId, session.user.id, session.user.role)
  await sql`UPDATE events SET status = 'published', updated_at = now() WHERE id = ${eventId}::uuid`
  revalidatePath('/drafts')
  revalidatePath('/events')
  redirect(`/events/${eventId}`)
}

export async function discardEvent(eventId: string) {
  const session = await auth()
  if (!session?.user || !hasRole(session.user.role, 'curator')) throw new Error('Forbidden')
  await getEventAndCheckAccess(eventId, session.user.id, session.user.role)
  await sql`UPDATE events SET status = 'archived', updated_at = now() WHERE id = ${eventId}::uuid`
  revalidatePath('/drafts')
}
