'use client'
import { useState, useEffect, useRef } from 'react'

interface Props {
  defaultVenue:   string
  defaultAddress: string
  defaultCity:    string
  defaultState:   string
  defaultMapsUrl: string
}

interface Suggestion {
  placeId: string
  text: string
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  fontSize: '1rem',
  width: '100%',
}

function setField(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el) el.value = value
}

export default function VenueAutocomplete({
  defaultVenue, defaultAddress, defaultCity, defaultState, defaultMapsUrl,
}: Props) {
  const [query, setQuery]           = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen]             = useState(false)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey || query.length < 2) { setSuggestions([]); setOpen(false); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
          body: JSON.stringify({ input: query, includedPrimaryTypes: ['establishment'] }),
        })
        const data = await res.json()
        const results: Suggestion[] = (data.suggestions ?? []).map((s: any) => ({
          placeId: s.placePrediction.placeId,
          text:    s.placePrediction.text.text,
        }))
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch {
        setSuggestions([])
      }
    }, 300)
  }, [query])

  async function selectPlace(placeId: string, displayText: string) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    setOpen(false)
    setQuery(displayText)

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        { headers: { 'X-Goog-Api-Key': apiKey!, 'X-Goog-FieldMask': 'displayName,addressComponents,googleMapsUri' } }
      )
      const place = await res.json()

      let streetNumber = '', route = '', city = '', state = ''
      for (const c of (place.addressComponents ?? [])) {
        const types: string[] = c.types ?? []
        if (types.includes('street_number'))               streetNumber = c.longText ?? ''
        if (types.includes('route'))                       route        = c.longText ?? ''
        if (types.includes('locality'))                    city         = c.longText ?? ''
        if (types.includes('administrative_area_level_1')) state        = c.shortText ?? ''
      }

      setField('venue_name', place.displayName?.text ?? displayText)
      setField('address',    [streetNumber, route].filter(Boolean).join(' '))
      setField('city',       city)
      setField('state',      state)
      setField('maps_url',   place.googleMapsUri ?? '')
    } catch {
      setField('venue_name', displayText)
    }
  }

  return (
    <>
      <label htmlFor="venue_search">Search venue on Google Maps</label>
      <div style={{ position: 'relative' }}>
        <input
          id="venue_search"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Start typing a venue name…"
          style={inputStyle}
          autoComplete="off"
        />
        {open && (
          <ul style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#fff', border: '1px solid var(--color-border)',
            borderTop: 'none', borderRadius: '0 0 4px 4px',
            listStyle: 'none', padding: 0, margin: 0,
            zIndex: 100, boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
          }}>
            {suggestions.map(s => (
              <li
                key={s.placeId}
                onMouseDown={() => selectPlace(s.placeId, s.text)}
                style={{
                  padding: '0.5rem 0.75rem', cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)', fontSize: '0.9rem',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                {s.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="muted" style={{ marginTop: '0.25rem', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
        Selecting a result auto-fills the fields below — you can still edit them manually.
      </p>

      <label htmlFor="venue_name">Venue name</label>
      <input type="text" id="venue_name" name="venue_name"
        placeholder="Cinema 21, Revolution Hall…"
        defaultValue={defaultVenue} style={inputStyle} />

      <label htmlFor="address">Address</label>
      <input type="text" id="address" name="address"
        defaultValue={defaultAddress} style={inputStyle} />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label htmlFor="city">City</label>
          <input type="text" id="city" name="city"
            defaultValue={defaultCity} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label htmlFor="state">State</label>
          <input type="text" id="state" name="state"
            defaultValue={defaultState} style={inputStyle} />
        </div>
      </div>

      <label htmlFor="maps_url">Google Maps link</label>
      <input type="url" id="maps_url" name="maps_url"
        placeholder="https://maps.google.com/…"
        defaultValue={defaultMapsUrl} style={inputStyle} />
    </>
  )
}
