import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/roles'
import { getContent } from '@/lib/content'
import ContentEditor from '@/app/ContentEditor'

export const metadata = { title: 'About Us — The Commons' }

export default async function AboutPage() {
  const session = await auth()
  const isAdmin = session?.user && hasRole(session.user.role, 'admin')
  const body = await getContent('about:body')

  return (
    <main style={{ maxWidth: '680px' }}>
      <h1>About The Commons</h1>
      <ContentEditor
        contentKey="about:body"
        defaultValue={body}
        isEditable={!!isAdmin}
        format="paragraphs"
      />
    </main>
  )
}
