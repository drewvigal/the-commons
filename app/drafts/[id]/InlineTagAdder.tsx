'use client'

import { useState, useTransition, useRef } from 'react'
import { createTag } from '../tag-actions'

interface Props {
  category: 'custom' | 'neighborhood'
}

export default function InlineTagAdder({ category }: Props) {
  const [added, setAdded] = useState<Array<{ id: string; name: string }>>([])
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const name = inputRef.current?.value.trim()
    if (!name) return
    startTransition(async () => {
      const tag = await createTag(name, category)
      if (tag) {
        setAdded(prev => [...prev, tag])
        if (inputRef.current) inputRef.current.value = ''
      }
    })
  }

  const placeholder = category === 'neighborhood' ? 'Add neighborhood…' : 'Add tag…'

  return (
    <>
      {added.map(tag => (
        <label key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'normal', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" name="tags" value={tag.id} defaultChecked />
          {tag.name}
        </label>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          disabled={pending}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          style={{ flex: 1, padding: '0.3rem 0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.85rem', fontFamily: 'inherit' }}
        />
        <button type="button" onClick={handleAdd} disabled={pending}
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}>
          {pending ? '…' : 'Add'}
        </button>
      </div>
    </>
  )
}
