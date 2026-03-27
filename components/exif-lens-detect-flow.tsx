"use client"

import React, { useState, useRef } from 'react'

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

type ExifLensDetectFlowProps = {
  cameraProfileId: string
  onLensConfirmed: (lensProfile: { id: string; [key: string]: unknown }) => void
  onSearchDatabase: (prefillQuery?: string) => void
  onEnterManually: () => void
  onClose: () => void
}

type FlowState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'matched'; lens: LensfunLens; rawLensModelString: string; confidence: number }
  | { status: 'unmatched'; rawLensModelString: string }
  | { status: 'error'; message: string }
  | { status: 'confirming' }

export function ExifLensDetectFlow({
  cameraProfileId,
  onLensConfirmed,
  onSearchDatabase,
  onEnterManually,
  onClose,
}: ExifLensDetectFlowProps) {
  const [state, setState] = useState<FlowState>({ status: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleUploadButtonClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setState({ status: 'uploading' })

    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/lens-detect-exif', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Detection failed: ${res.status}`)
      }

      const data = await res.json()

      if (data.matched) {
        setState({
          status: 'matched',
          lens: data.matched as LensfunLens,
          rawLensModelString: data.rawLensModelString,
          confidence: data.confidence,
        })
      } else {
        setState({
          status: 'unmatched',
          rawLensModelString: data.rawLensModelString ?? '',
        })
      }
    } catch {
      setState({ status: 'error', message: 'Failed to detect lens. Try again.' })
    }
  }

  async function handleConfirm() {
    if (state.status !== 'matched') return

    setState({ status: 'confirming' })

    try {
      const { lens } = state
      const res = await fetch('/api/lens-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraProfileId,
          lensfunId: lens.lensfunId,
          source: 'exif',
          focalLengthMm: lens.focalLengthMinMm,
          maxAperture: lens.maxAperture,
          lensType: lens.lensType,
        }),
      })

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`)
      }

      const savedProfile = await res.json()
      onLensConfirmed(savedProfile)
    } catch {
      setState({ status: 'error', message: 'Failed to save lens profile. Try again.' })
    }
  }

  return (
    <div>
      {/* Hidden file input */}
      <input
        data-testid="exif-upload-input"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {state.status === 'idle' && (
        <div>
          <p>Detect lens from EXIF data automatically</p>
          <button onClick={handleUploadButtonClick}>Upload photo</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      )}

      {state.status === 'uploading' && (
        <div role="status" aria-live="polite">
          <p>Detecting lens...</p>
        </div>
      )}

      {state.status === 'matched' && (
        <div>
          <p>
            Detected: {state.lens.manufacturer} {state.lens.model} — is this correct?
          </p>
          <button onClick={handleConfirm}>Confirm</button>
          <button
            onClick={() => {
              if (state.status === 'matched') {
                setState({ status: 'idle' })
                onSearchDatabase(state.lens.model)
              }
            }}
          >
            Edit
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      )}

      {state.status === 'unmatched' && (
        <div>
          <p>
            Could not identify your lens (EXIF: &apos;{state.rawLensModelString}&apos;)
          </p>
          <button onClick={() => onSearchDatabase(state.rawLensModelString)}>
            Search database
          </button>
          <button onClick={onEnterManually}>Enter manually</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      )}

      {state.status === 'confirming' && (
        <div role="status" aria-live="polite">
          <p>Saving lens profile...</p>
        </div>
      )}

      {state.status === 'error' && (
        <div>
          <p>{state.message}</p>
          <button onClick={() => setState({ status: 'idle' })}>Try again</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      )}
    </div>
  )
}
