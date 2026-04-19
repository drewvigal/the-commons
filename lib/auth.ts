import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { sql } from '@/lib/db'
import type { Role } from '@/lib/roles'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],

  session: {
    // JWT strategy avoids the need for a sessions table in Postgres.
    // The user's id and role are signed into a cookie.
    strategy: 'jwt',
  },

  callbacks: {
    /**
     * Called after Google returns the user profile.
     * Upserts the user record — creates on first sign-in, updates name/avatar on subsequent ones.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return false
      if (!profile?.sub || !profile.email) return false

      await sql`
        INSERT INTO users (email, name, avatar_url, google_sub)
        VALUES (
          ${profile.email},
          ${(profile.name as string | null) ?? null},
          ${(profile.picture as string | null) ?? null},
          ${profile.sub}
        )
        ON CONFLICT (google_sub) DO UPDATE SET
          email      = EXCLUDED.email,
          name       = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url
      `

      return true
    },

    /**
     * Called when a JWT is first created (trigger = 'signIn') or refreshed.
     * Embeds the DB user id and role into the token so every request has them without a DB hit.
     */
    async jwt({ token, trigger, profile }) {
      if (trigger === 'signIn' && profile?.sub) {
        const rows = await sql`
          SELECT id, role FROM users WHERE google_sub = ${profile.sub}
        `
        if (rows[0]) {
          token.userId = rows[0].id as string
          token.role   = rows[0].role as Role
        }
      }
      return token
    },

    /**
     * Shapes the session object that server components and API routes see.
     */
    async session({ session, token }) {
      session.user.id   = (token.userId as string) ?? ''
      session.user.role = (token.role as Role)     ?? 'user'
      return session
    },
  },
})
