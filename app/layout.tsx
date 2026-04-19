import './globals.css'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'

export const metadata = {
  title: 'My Events Calendar',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isCurator = session?.user && hasRole(session.user.role, 'curator')

  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <nav>
          <a href="/events">Events</a>
          <a href="/series">Series</a>
          {isCurator && (
            <>
              <span style={{ borderLeft: '1px solid var(--color-border)', margin: '0 0.25rem' }} />
              <a href="/drafts" style={{ color: 'var(--color-muted)' }}>Drafts</a>
              <a href="/ingest" style={{ color: 'var(--color-muted)' }}>Ingest URL</a>
              <a href="/embed" style={{ color: 'var(--color-muted)' }}>Embed</a>
            </>
          )}
        </nav>
        {children}
      </body>
    </html>
  )
}
