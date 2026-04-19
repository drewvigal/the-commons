import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function EmbedGeneratorPage() {
  const session = await auth()
  if (!session?.user) redirect('/api/auth/signin')
  if (!hasRole(session.user.role, 'curator')) redirect('/api/auth/signin')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourdomain.com'

  const [seriesRows, tagsRows] = await Promise.all([
    sql`SELECT slug, title FROM series ORDER BY title ASC`,
    sql`SELECT slug, name FROM tags ORDER BY name ASC`,
  ])

  function iframeCode(src: string) {
    return `<iframe src="${src}" width="100%" height="600" frameborder="0" style="border:none;width:100%;"></iframe>`
  }

  const embeds = [
    { label: 'All events', src: `${appUrl}/embed/events` },
    ...seriesRows.map(s => ({
      label: `Series: ${s.title as string}`,
      src: `${appUrl}/embed/events?series=${s.slug as string}`,
    })),
    ...tagsRows.map(t => ({
      label: `Tag: ${t.name as string}`,
      src: `${appUrl}/embed/events?tag=${t.slug as string}`,
    })),
  ]

  return (
    <main>
      <h1>Embed Codes</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Copy any iframe snippet below and paste it into a WordPress HTML block or any page builder.
        All links in the embed open in a new tab.
      </p>

      <table>
        <thead>
          <tr>
            <th>View</th>
            <th>Preview</th>
            <th>Embed code</th>
          </tr>
        </thead>
        <tbody>
          {embeds.map(e => (
            <tr key={e.src}>
              <td style={{ whiteSpace: 'nowrap' }}>{e.label}</td>
              <td>
                <a href={e.src} target="_blank" rel="noopener" style={{ fontSize: '0.85rem' }}>
                  Preview →
                </a>
              </td>
              <td>
                <code style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  background: '#f5f5f5',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  wordBreak: 'break-all',
                  userSelect: 'all',
                }}>
                  {iframeCode(e.src)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
