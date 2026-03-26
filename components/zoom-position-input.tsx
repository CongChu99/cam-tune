"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZoomPositionInputProps {
  focalLengthMinMm: number;
  focalLengthMaxMm: number;
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ZoomPositionInput({
  focalLengthMinMm,
  focalLengthMaxMm,
  value,
  onChange,
  className,
}: ZoomPositionInputProps) {
  // Prime lens — render nothing
  if (focalLengthMinMm === focalLengthMaxMm) {
    return null;
  }

  return (
    <ZoomPositionInputInner
      focalLengthMinMm={focalLengthMinMm}
      focalLengthMaxMm={focalLengthMaxMm}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}

// Inner component (avoids conditional hook issues)
function ZoomPositionInputInner({
  focalLengthMinMm,
  focalLengthMaxMm,
  value,
  onChange,
  className,
}: ZoomPositionInputProps) {
  const [inputStr, setInputStr] = useState<string>(
    value !== null ? String(value) : ""
  );

  // Sync inputStr when value prop changes externally
  useEffect(() => {
    setInputStr(value !== null ? String(value) : "");
  }, [value]);

  // Determine if current inputStr is out-of-range
  const trimmed = inputStr.trim();
  const parsed = trimmed === "" ? NaN : parseFloat(trimmed);
  const isOutOfRange =
    trimmed !== "" && !isNaN(parsed) && (parsed < focalLengthMinMm || parsed > focalLengthMaxMm);

  const errorMessage = isOutOfRange
    ? `Must be between ${focalLengthMinMm}–${focalLengthMaxMm} mm`
    : null;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setInputStr(raw);

    if (raw.trim() === "") {
      onChange(null);
      return;
    }

    const num = parseFloat(raw);
    if (!isNaN(num) && num >= focalLengthMinMm && num <= focalLengthMaxMm) {
      onChange(num);
    }
    // Out-of-range: do not call onChange
  }

  const inputId = "zoom-position-input";

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Zoom Position (mm)
      </label>
      <input
        id={inputId}
        type="number"
        value={inputStr}
        onChange={handleChange}
        placeholder={`${focalLengthMinMm}–${focalLengthMaxMm} mm`}
        className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {errorMessage && (
        <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
