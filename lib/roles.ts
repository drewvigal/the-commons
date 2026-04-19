export type Role = 'developer' | 'admin' | 'curator' | 'user'

const RANK: Record<Role, number> = {
  developer: 4,
  admin: 3,
  curator: 2,
  user: 1,
}

/** Returns true if userRole meets or exceeds requiredRole in the hierarchy. */
export function hasRole(userRole: Role, required: Role): boolean {
  return RANK[userRole] >= RANK[required]
}

export const canIngestEmail  = (role: Role) => hasRole(role, 'curator')
export const canPublishEvent = (role: Role) => hasRole(role, 'curator')
export const canManageTags   = (role: Role) => hasRole(role, 'admin')
export const canManageUsers  = (role: Role) => hasRole(role, 'admin')
