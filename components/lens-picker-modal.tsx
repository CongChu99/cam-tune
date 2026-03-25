"use client"

import React, { useState, useEffect, useCallback } from 'react'

type LensfunLens = {
  id: string
  lensfunId: string
  manufacturer: string
  model: string
  focalLengthMinMm: number
  focalLengthMaxMm: number
  maxAperture: number
  lensType: string
  popularityWeight: number
}

type LensPickerModalProps = {
  onSelect: (lens: LensfunLens) => void
  onClose: () => void
}

export function LensPickerModal({ onSelect, onClose }: LensPickerModalProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<LensfunLens[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Debounce: update debouncedQuery 300ms after query changes
  useEffect(() => {
    if (!query) {
      setDebouncedQuery('')
      return
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Fetch when debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    fetch(`/api/lens-search?q=${encodeURIComponent(debouncedQuery)}`, {})
      .then((res) => res.json())
      .then((data: LensfunLens[]) => {
        setResults(data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [debouncedQuery])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (!value) {
      setDebouncedQuery('')
    }
  }, [])

  return (
    <div role="dialog" className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <input
            id="lens-search"
            type="text"
            aria-label="Search lens"
            value={query}
            onChange={handleChange}
            placeholder="Search lenses…"
            className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-3 text-gray-500 hover:text-gray-700 text-sm"
          >
            Close
          </button>
        </div>

        {loading && (
          <div role="status" className="text-center py-4 text-gray-500 text-sm">
            Loading…
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">No lenses found</p>
        )}

        <ul className="divide-y max-h-64 overflow-y-auto">
          {results.map((lens) => (
            <li
              key={lens.id}
              role="listitem"
              className="py-2 px-1 cursor-pointer hover:bg-gray-50"
              onClick={() => onSelect(lens)}
            >
              <span className="text-sm font-medium">{lens.model}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
