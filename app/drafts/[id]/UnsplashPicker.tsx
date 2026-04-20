'use client'

import { useState } from 'react'

interface UnsplashPhoto {
  id: string
  urls: { thumb: string; regular: string }
  alt_description: string | null
  user: { name: string }
}

export default function UnsplashPicker({ defaultValue }: { defaultValue: string }) {
  const [url, setUrl]         = useState(defaultValue)
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<UnsplashPhoto[]>([])
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    const res = await fetch(`/api/unsplash?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setResults(data.results ?? [])
    setLoading(false)
  }

  function select(photo: UnsplashPhoto) {
    setUrl(photo.urls.regular)
    setOpen(false)
    setResults([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <input
        type="url"
        id="image_url"
        name="image_url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        style={{ width: '100%' }}
      />

      {url && (
        <img
          src={url}
          alt="Event thumbnail"
          style={{ display: 'block', maxWidth: '320px', maxHeight: '180px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }}
        />
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}
      >
        {open ? '▲ Close image search' : '▼ Search Unsplash for an image'}
      </button>

      {open && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.75rem', background: '#faf8fd' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="e.g. community gathering, live music…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
              style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'inherit' }}
            />
            <button type="button" onClick={search} disabled={loading}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
              {loading ? '…' : 'Search'}
            </button>
          </div>

          {results.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {results.map(photo => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => select(photo)}
                    title={`Photo by ${photo.user.name}`}
                    style={{ padding: 0, border: '2px solid transparent', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', background: 'none', display: 'block' }}
                  >
                    <img
                      src={photo.urls.thumb}
                      alt={photo.alt_description ?? ''}
                      style={{ display: 'block', width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                Photos by <a href="https://unsplash.com?utm_source=the_commons&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>. Click a photo to use it.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
