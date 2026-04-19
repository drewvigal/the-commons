import '../globals.css'

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning style={{ padding: '1rem', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
