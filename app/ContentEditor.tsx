'use client'

import { useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import { updateContent } from './content-actions'

interface Props {
  contentKey: string
  defaultValue: string
  isEditable: boolean
  format?: 'text' | 'paragraphs'
  className?: string
  style?: React.CSSProperties
}

export default function ContentEditor({ contentKey, defaultValue, isEditable, format = 'text', className, style }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(defaultValue)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      await updateContent(contentKey, value)
      setEditing(false)
    })
  }

  function cancel() {
    setValue(defaultValue)
    setEditing(false)
  }

  const rendered = format === 'paragraphs'
    ? <ReactMarkdown>{value}</ReactMarkdown>
    : value

  if (!isEditable) {
    return <span className={className} style={style}>{rendered}</span>
  }

  if (editing) {
    return (
      <span style={{ display: 'block' }}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          rows={Math.max(4, value.split('\n').length + 1)}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 'inherit', padding: '0.5rem', border: '2px solid var(--color-link)', borderRadius: 4, resize: 'vertical', lineHeight: 1.6 }}
          autoFocus
        />
        <span style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
          <button data-variant="primary" onClick={save} disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={cancel} disabled={pending}>Cancel</button>
          {format === 'paragraphs' && (
            <span style={{ marginLeft: 'auto', color: 'var(--color-muted)', fontSize: '0.75rem' }}>
              Markdown supported — **bold**, *italic*, [link](url), blank line = new paragraph
            </span>
          )}
        </span>
      </span>
    )
  }

  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'block', ...style }}
      onMouseEnter={e => { const btn = e.currentTarget.querySelector<HTMLElement>('.edit-btn'); if (btn) btn.style.opacity = '1' }}
      onMouseLeave={e => { const btn = e.currentTarget.querySelector<HTMLElement>('.edit-btn'); if (btn) btn.style.opacity = '0' }}
    >
      {rendered}
      <button
        className="edit-btn"
        onClick={() => setEditing(true)}
        title={`Edit ${contentKey}`}
        style={{ position: 'absolute', top: 0, right: 0, opacity: 0, transition: 'opacity 0.15s', background: 'var(--color-link)', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
      >
        Edit
      </button>
    </span>
  )
}
