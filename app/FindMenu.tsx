'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  series: Array<{ title: string; slug: string }>
  tags:   Array<{ name: string;  slug: string }>
}

export default function FindMenu({ series, tags }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="find-btn" onClick={() => setOpen(o => !o)}>
        Find {open ? '▴' : '▾'}
      </button>

      {open && (
        <div className="find-dropdown" onClick={() => setOpen(false)}>
          {series.length > 0 && (
            <>
              <div className="find-dropdown-label">Series</div>
              {series.map(s => (
                <a key={s.slug} href={`/events?series=${s.slug}`} className="find-dropdown-item">
                  {s.title}
                </a>
              ))}
            </>
          )}
          {tags.length > 0 && (
            <>
              <div className="find-dropdown-label" style={{ borderTop: series.length > 0 ? '1px solid var(--color-border)' : 'none', marginTop: series.length > 0 ? '0.25rem' : 0 }}>Tags</div>
              {tags.map(t => (
                <a key={t.slug} href={`/events?tag=${t.slug}`} className="find-dropdown-item">
                  {t.name}
                </a>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
