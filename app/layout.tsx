import './globals.css'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { getContentMany } from '@/lib/content'
import { sql } from '@/lib/db'
import SignOutButton from './SignOutButton'
import ContentEditor from './ContentEditor'
import FindMenu from './FindMenu'

export const metadata = {
  title: 'The Commons',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isCurator = session?.user && hasRole(session.user.role, 'curator')
  const isAdmin   = session?.user && hasRole(session.user.role, 'admin')

  const [content, seriesList, tagsList] = await Promise.all([
    getContentMany(['tagline', 'footer']),
    sql`SELECT title, slug FROM series ORDER BY title ASC`,
    sql`SELECT name, slug FROM tags ORDER BY name ASC`,
  ])

  return (
    <html lang="en">
      <body suppressHydrationWarning>

        {/* Top utility bar */}
        <div className="top-bar">
          <div className="container bar-inner">
            <a href="/about">About The Commons</a>
            <span className="bar-sep">:</span>
            <a href="/how-it-works">How We Collaborate</a>
            <span style={{ flex: 1 }} />
            {session?.user ? (
              <>
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>{session.user.name ?? session.user.email}</span>
                <span className="bar-sep">:</span>
                <SignOutButton />
              </>
            ) : (
              <a href="/api/auth/signin">Sign in</a>
            )}
          </div>
        </div>

        {/* Site header */}
        <header className="site-header">
          <div className="container">
            <a href="/" className="site-title">The Commons</a>
            <ContentEditor
              contentKey="tagline"
              defaultValue={content['tagline'] ?? ''}
              isEditable={!!isAdmin}
              className="site-tagline"
            />
          </div>
        </header>

        {/* Section nav */}
        <nav className="section-nav">
          <div className="container bar-inner">
            <a href="/events">All Events</a>
            <span className="bar-sep">:</span>
            <FindMenu
              series={seriesList as Array<{ title: string; slug: string }>}
              tags={tagsList as Array<{ name: string; slug: string }>}
            />
            <span style={{ flex: 1 }} />
            {isCurator && (
              <>
                <a href="/drafts">Drafts</a>
                <span className="bar-sep">:</span>
                <a href="/ingest">Ingest URL</a>
                <span className="bar-sep">:</span>
                <a href="/embed">Embed</a>
              </>
            )}
          </div>
        </nav>

        {/* Page content */}
        <div className="page-body">
          {children}
        </div>

        {/* Footer */}
        <footer className="site-footer">
          <div className="container">
            <ContentEditor
              contentKey="footer"
              defaultValue={content['footer'] ?? ''}
              isEditable={!!isAdmin}
            />
          </div>
        </footer>

      </body>
    </html>
  )
}
