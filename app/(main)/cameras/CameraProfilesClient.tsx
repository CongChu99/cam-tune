"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CameraProfileCard, type CameraProfile } from "@/components/camera-profile-card";
import { CameraSearch, type CameraSearchResult } from "@/components/camera-search";

type CameraProfilesClientProps = {
  initialProfiles: CameraProfile[];
};

type ModalState =
  | { type: "closed" }
  | { type: "add-search" }
  | { type: "add-manual"; query: string }
  | { type: "edit"; profileId: string };

export function CameraProfilesClient({
  initialProfiles,
}: CameraProfilesClientProps) {
  const [profiles, setProfiles] = useState<CameraProfile[]>(initialProfiles);
  const [modal, setModal] = useState<ModalState>({ type: "closed" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSetActive = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/user/cameras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    if (!res.ok) {
      setError("Failed to set active camera.");
      return;
    }
    const data = await res.json();
    // Reflect active state changes: deactivate all others, activate selected
    setProfiles((prev) =>
      prev
        .map((p) => ({ ...p, isActive: p.id === id ? true : false }))
        .map((p) => (p.id === id ? { ...p, ...data.profile } : p))
    );
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/user/cameras/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete camera profile.");
      return;
    }
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const handleEdit = (id: string) => {
    setModal({ type: "edit", profileId: id });
  };

  // Add camera via database search selection
  const handleSelectFromSearch = async (
    camera: CameraSearchResult,
    makeActive: boolean
  ) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/user/cameras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: camera.brand,
          model: camera.model,
          cameraDatabaseId: camera.id,
          isActive: makeActive,
          isUserEntered: false,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add camera.");
        return;
      }
      const data = await res.json();
      if (makeActive) {
        setProfiles((prev) => [
          ...prev.map((p) => ({ ...p, isActive: false })),
          data.profile,
        ]);
      } else {
        setProfiles((prev) => [...prev, data.profile]);
      }
      setModal({ type: "closed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add camera via manual entry
  const handleManualSubmit = async (
    brand: string,
    model: string,
    makeActive: boolean
  ) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/user/cameras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          model,
          isActive: makeActive,
          isUserEntered: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add camera.");
        return;
      }
      const data = await res.json();
      if (makeActive) {
        setProfiles((prev) => [
          ...prev.map((p) => ({ ...p, isActive: false })),
          data.profile,
        ]);
      } else {
        setProfiles((prev) => [...prev, data.profile]);
      }
      setModal({ type: "closed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Profile list */}
      {profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            No camera profiles yet. Add your first camera to get started.
          </p>
          <Button
            className="mt-4"
            onClick={() => setModal({ type: "add-search" })}
          >
            Add Camera
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {profiles.map((profile) => (
              <CameraProfileCard
                key={profile.id}
                profile={profile}
                onSetActive={handleSetActive}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>

          <Button
            variant="outline"
            className="mt-2 self-start"
            onClick={() => setModal({ type: "add-search" })}
          >
            + Add Camera
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Add Camera Modal ── */}
      {(modal.type === "add-search" || modal.type === "add-manual") && (
        <AddCameraModal
          initialQuery={modal.type === "add-manual" ? modal.query : ""}
          startInManual={modal.type === "add-manual"}
          isSubmitting={isSubmitting}
          onClose={() => setModal({ type: "closed" })}
          onSelectCamera={handleSelectFromSearch}
          onManualEntry={(query) => setModal({ type: "add-manual", query })}
          onManualSubmit={handleManualSubmit}
        />
      )}

      {/* ── Edit Camera Modal ── */}
      {modal.type === "edit" && (
        <EditCameraModal
          profileId={modal.profileId}
          profile={profiles.find((p) => p.id === modal.profileId)!}
          isSubmitting={isSubmitting}
          onClose={() => setModal({ type: "closed" })}
          onSave={async (id, brand, model) => {
            setError(null);
            setIsSubmitting(true);
            try {
              const res = await fetch(`/api/user/cameras/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ brand, model }),
              });
              if (!res.ok) {
                const data = await res.json();
                setError(data.error ?? "Failed to save changes.");
                return;
              }
              const data = await res.json();
              setProfiles((prev) =>
                prev.map((p) => (p.id === id ? { ...p, ...data.profile } : p))
              );
              setModal({ type: "closed" });
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      )}
    </>
  );
}

// ─── Add Camera Modal ──────────────────────────────────────────────────────────

type AddCameraModalProps = {
  initialQuery: string;
  startInManual: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSelectCamera: (camera: CameraSearchResult, makeActive: boolean) => void;
  onManualEntry: (query: string) => void;
  onManualSubmit: (brand: string, model: string, makeActive: boolean) => void;
};

function AddCameraModal({
  initialQuery,
  startInManual,
  isSubmitting,
  onClose,
  onSelectCamera,
  onManualEntry,
  onManualSubmit,
}: AddCameraModalProps) {
  const [selectedCamera, setSelectedCamera] =
    useState<CameraSearchResult | null>(null);
  const [makeActive, setMakeActive] = useState(true);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState(() => {
    if (startInManual && initialQuery) return initialQuery;
    return "";
  });

  const handleSearchSelect = (camera: CameraSearchResult) => {
    setSelectedCamera(camera);
  };

  const handleConfirmSearch = () => {
    if (!selectedCamera) return;
    onSelectCamera(selectedCamera, makeActive);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) return;
    onManualSubmit(brand.trim(), model.trim(), makeActive);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {startInManual ? "Add Camera Manually" : "Add Camera"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {!startInManual ? (
          /* Search mode */
          <div className="flex flex-col gap-4">
            <CameraSearch
              onSelect={handleSearchSelect}
              onManualEntry={onManualEntry}
              className="w-full"
            />

            {selectedCamera && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Selected</p>
                <p className="font-semibold">
                  {selectedCamera.brand} {selectedCamera.model}
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
                className="rounded"
              />
              Set as active camera
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSearch}
                disabled={!selectedCamera || isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add Camera"}
              </Button>
            </div>
          </div>
        ) : (
          /* Manual entry mode */
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Your camera wasn&apos;t found in our database. Enter its details
              manually.
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="manual-brand">
                Brand
              </label>
              <input
                id="manual-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Sony"
                required
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="manual-model">
                Model
              </label>
              <input
                id="manual-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. A9 III"
                required
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
                className="rounded"
              />
              Set as active camera
            </label>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!brand.trim() || !model.trim() || isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add Camera"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Edit Camera Modal ─────────────────────────────────────────────────────────

type EditCameraModalProps = {
  profileId: string;
  profile: CameraProfile;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (id: string, brand: string, model: string) => Promise<void>;
};

function EditCameraModal({
  profileId,
  profile,
  isSubmitting,
  onClose,
  onSave,
}: EditCameraModalProps) {
  const [brand, setBrand] = useState(profile.brand);
  const [model, setModel] = useState(profile.model);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) return;
    await onSave(profileId, brand.trim(), model.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Camera</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="edit-brand">
              Brand
            </label>
            <input
              id="edit-brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              required
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="edit-model">
              Model
            </label>
            <input
              id="edit-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!brand.trim() || !model.trim() || isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
