import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { getContentMany } from '@/lib/content'
import ContentEditor from '@/app/ContentEditor'

export const metadata = { title: 'How Commons Works — The Commons' }

export default async function HowItWorksPage() {
  const session = await auth()
  const isAdmin = session?.user && hasRole(session.user.role, 'admin')

  const content = await getContentMany([
    'how-it-works:intro',
    'how-it-works:browsing',
    'how-it-works:member',
    'how-it-works:curator',
  ])

  return (
    <main style={{ maxWidth: '680px' }}>
      <h1>How The Commons Works</h1>

      <ContentEditor
        contentKey="how-it-works:intro"
        defaultValue={content['how-it-works:intro'] ?? ''}
        isEditable={!!isAdmin}
        format="paragraphs"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginTop: '2rem' }}>

        <section>
          <h2 style={{ marginBottom: '0.25rem' }}>Just Browsing</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>No account needed</p>
          <ContentEditor
            contentKey="how-it-works:browsing"
            defaultValue={content['how-it-works:browsing'] ?? ''}
            isEditable={!!isAdmin}
            format="paragraphs"
          />
          <a href="/events"><button data-variant="primary" style={{ marginTop: '0.75rem' }}>Explore Events</button></a>
        </section>

        <section>
          <h2 style={{ marginBottom: '0.25rem' }}>Registered Member</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>Free to join</p>
          <ContentEditor
            contentKey="how-it-works:member"
            defaultValue={content['how-it-works:member'] ?? ''}
            isEditable={!!isAdmin}
            format="paragraphs"
          />
          <a href="/api/auth/signin"><button data-variant="primary" style={{ marginTop: '0.75rem' }}>Join The Commons</button></a>
        </section>

        <section>
          <h2 style={{ marginBottom: '0.25rem' }}>Community Curator</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>For organizers, publishers, and civic builders</p>
          <ContentEditor
            contentKey="how-it-works:curator"
            defaultValue={content['how-it-works:curator'] ?? ''}
            isEditable={!!isAdmin}
            format="paragraphs"
          />
          <a href="mailto:hello@thecommons.forum?subject=Curator%20Application" suppressHydrationWarning>
            <button data-variant="primary" style={{ marginTop: '0.75rem' }}>Apply to Become a Curator</button>
          </a>
        </section>

      </div>
    </main>
  )
}
