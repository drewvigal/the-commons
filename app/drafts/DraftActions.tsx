'use client'

import { useTransition } from 'react'
import { publishEvent, discardEvent } from './actions'

export default function DraftActions({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <span className="actions">
      <button
        data-variant="primary"
        disabled={isPending}
        onClick={() => startTransition(() => publishEvent(eventId))}
      >
        Publish
      </button>
      <button
        data-variant="danger"
        disabled={isPending}
        onClick={() => startTransition(() => discardEvent(eventId))}
      >
        Discard
      </button>
    </span>
  )
}
