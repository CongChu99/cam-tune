"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LensProfile = {
  id: string;
  cameraProfileId: string;
  focalLengthMm: number | null;
  maxAperture: number;
  minAperture: number;
  isStabilized: boolean;
  stabilizationStops: number | null;
  focalLengthMinMm: number | null;
  focalLengthMaxMm: number | null;
  isVariableAperture: boolean;
  maxApertureTele: number | null;
  lensType: string | null;
  lensfunId: string | null;
  source: string;
};

type LensMode = "prime" | "zoom";

type ManualLensEntryFormProps = {
  cameraProfileId: string;
  onSuccess: (lensProfile: LensProfile) => void;
  onCancel: () => void;
};

// ─── Validation ───────────────────────────────────────────────────────────────

type FormErrors = {
  focalLength?: string;
  focalLengthMin?: string;
  focalLengthMax?: string;
  focalLengthRange?: string;
  maxAperture?: string;
};

/** Returns true when the string parses to a finite number greater than zero. */
function isRequiredPositive(value: string): boolean {
  const n = parseFloat(value);
  return value.trim().length > 0 && !isNaN(n) && n > 0;
}

function validateForm(fields: {
  mode: LensMode;
  focalLength: string;
  focalLengthMin: string;
  focalLengthMax: string;
  maxAperture: string;
}): FormErrors {
  const errors: FormErrors = {};
  const { mode, focalLength, focalLengthMin, focalLengthMax, maxAperture } = fields;

  if (mode === "prime") {
    if (!isRequiredPositive(focalLength)) {
      errors.focalLength = "Focal length is required and must be greater than 0";
    }
  } else {
    if (!isRequiredPositive(focalLengthMin)) {
      errors.focalLengthMin = "Min focal length is required";
    }
    if (!isRequiredPositive(focalLengthMax)) {
      errors.focalLengthMax = "Max focal length is required";
    }
    if (!errors.focalLengthMin && !errors.focalLengthMax) {
      if (parseFloat(focalLengthMin) >= parseFloat(focalLengthMax)) {
        errors.focalLengthRange =
          "Focal range: max must be greater than min focal length";
      }
    }
  }

  if (!isRequiredPositive(maxAperture)) {
    errors.maxAperture = "Aperture is required and must be greater than 0";
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManualLensEntryForm({
  cameraProfileId,
  onSuccess,
  onCancel,
}: ManualLensEntryFormProps) {
  const [mode, setMode] = useState<LensMode>("prime");
  const [focalLength, setFocalLength] = useState("");
  const [focalLengthMin, setFocalLengthMin] = useState("");
  const [focalLengthMax, setFocalLengthMax] = useState("");
  const [maxAperture, setMaxAperture] = useState("");
  const [isStabilized, setIsStabilized] = useState(false);
  const [stabilizationStops, setStabilizationStops] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm({
      mode,
      focalLength,
      focalLengthMin,
      focalLengthMax,
      maxAperture,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const ap = parseFloat(maxAperture);
      const isStops = isStabilized ? parseFloat(stabilizationStops) || null : null;

      const focalLengthFields =
        mode === "prime"
          ? { focalLengthMm: parseFloat(focalLength) }
          : {
              focalLengthMinMm: parseFloat(focalLengthMin),
              focalLengthMaxMm: parseFloat(focalLengthMax),
            };

      const body = {
        cameraProfileId,
        ...focalLengthFields,
        maxAperture: ap,
        minAperture: ap,
        isStabilized,
        stabilizationStops: isStops,
        source: "manual",
      };

      const res = await fetch("/api/lens-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("Failed to save lens profile");
      }

      const data = await res.json();
      onSuccess(data.lensProfile);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ── Lens mode toggle ── */}
      <div>
        <button
          type="button"
          onClick={() => setMode("prime")}
          aria-pressed={mode === "prime"}
        >
          Prime
        </button>
        <button
          type="button"
          onClick={() => setMode("zoom")}
          aria-pressed={mode === "zoom"}
        >
          Zoom
        </button>
      </div>

      {/* ── Focal length fields ── */}
      {mode === "prime" ? (
        <div>
          <label htmlFor="focalLength">Focal Length (mm)</label>
          <input
            id="focalLength"
            type="number"
            value={focalLength}
            onChange={(e) => setFocalLength(e.target.value)}
          />
          {errors.focalLength && <p>{errors.focalLength}</p>}
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="focalLengthMin">Min Focal Length (mm)</label>
            <input
              id="focalLengthMin"
              type="number"
              value={focalLengthMin}
              onChange={(e) => setFocalLengthMin(e.target.value)}
            />
            {errors.focalLengthMin && <p>{errors.focalLengthMin}</p>}
          </div>
          <div>
            <label htmlFor="focalLengthMax">Max Focal Length (mm)</label>
            <input
              id="focalLengthMax"
              type="number"
              value={focalLengthMax}
              onChange={(e) => setFocalLengthMax(e.target.value)}
            />
            {errors.focalLengthMax && <p>{errors.focalLengthMax}</p>}
          </div>
          {errors.focalLengthRange && <p>{errors.focalLengthRange}</p>}
        </>
      )}

      {/* ── Max Aperture ── */}
      <div>
        <label htmlFor="maxAperture">Max Aperture (f/)</label>
        <input
          id="maxAperture"
          type="number"
          step="0.1"
          value={maxAperture}
          onChange={(e) => setMaxAperture(e.target.value)}
        />
        {errors.maxAperture && <p>{errors.maxAperture}</p>}
      </div>

      {/* ── Image Stabilization toggle ── */}
      <div>
        <label>
          <input
            type="checkbox"
            aria-label="Image Stabilization"
            checked={isStabilized}
            onChange={(e) => setIsStabilized(e.target.checked)}
          />
          Image Stabilization (IS)
        </label>
      </div>

      {/* ── IS Stops (conditional) ── */}
      {isStabilized && (
        <div>
          <label htmlFor="stabilizationStops">IS Stops</label>
          <input
            id="stabilizationStops"
            type="number"
            step="0.5"
            value={stabilizationStops}
            onChange={(e) => setStabilizationStops(e.target.value)}
          />
        </div>
      )}

      {/* ── Actions ── */}
      <div>
        <button type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting}>
          Save
        </button>
      </div>
    </form>
  );
}
