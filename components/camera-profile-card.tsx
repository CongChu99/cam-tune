"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CameraProfile = {
  id: string;
  brand: string;
  model: string;
  isActive: boolean;
  isUserEntered: boolean;
  cameraDatabaseId: string | null;
  cameraDatabase: {
    sensorSize: string;
    pixelCountMp: number | null;
    ibis: boolean;
    releaseYear: number | null;
    mount: string | null;
  } | null;
};

type CameraProfileCardProps = {
  profile: CameraProfile;
  onSetActive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
};

const SENSOR_SIZE_LABELS: Record<string, string> = {
  FULL_FRAME: "Full Frame",
  APS_C: "APS-C",
  MFT: "MFT",
  ONE_INCH: "1-inch",
  MEDIUM_FORMAT: "Medium Format",
  OTHER: "Other",
};

export function CameraProfileCard({
  profile,
  onSetActive,
  onDelete,
  onEdit,
}: CameraProfileCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSetActive = async () => {
    if (profile.isActive) return;
    setIsLoading(true);
    try {
      await onSetActive(profile.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${profile.brand} ${profile.model}"?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(profile.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const db = profile.cameraDatabase;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all",
        profile.isActive
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-muted-foreground/40"
      )}
    >
      {/* Active badge */}
      {profile.isActive && (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
          Active
        </span>
      )}

      {/* User-entered badge */}
      {profile.isUserEntered && (
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Custom
        </span>
      )}

      {/* Camera info */}
      <div className={cn("flex flex-col gap-1", profile.isUserEntered ? "mt-5" : "")}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {profile.brand}
        </p>
        <h3 className="text-lg font-semibold leading-tight text-foreground">
          {profile.model}
        </h3>
      </div>

      {/* Specs row */}
      {db && (
        <div className="flex flex-wrap gap-2">
          {db.sensorSize && (
            <Chip>{SENSOR_SIZE_LABELS[db.sensorSize] ?? db.sensorSize}</Chip>
          )}
          {db.pixelCountMp && <Chip>{db.pixelCountMp} MP</Chip>}
          {db.ibis && <Chip>IBIS</Chip>}
          {db.mount && <Chip>{db.mount}</Chip>}
          {db.releaseYear && <Chip>{db.releaseYear}</Chip>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {!profile.isActive && (
          <Button
            size="sm"
            onClick={handleSetActive}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Setting..." : "Set Active"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEdit(profile.id)}
          className={profile.isActive ? "flex-1" : ""}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "..." : "Delete"}
        </Button>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}
