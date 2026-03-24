/**
 * Server-side camera database functions.
 * Provides search, retrieval, and active-camera management.
 */

import prisma from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CameraDatabaseRecord = {
  id: string;
  brand: string;
  model: string;
  slug: string;
  sensorSize: string;
  pixelCountMp: number | null;
  baseIso: number;
  maxUsableIso: number;
  maxNativeIso: number;
  ibis: boolean;
  ibisStops: number | null;
  dualNativeIso: boolean;
  dualNativeIsoValues: string | null;
  dynamicRangeEv: number | null;
  releaseYear: number | null;
  mount: string | null;
  maxFlashSyncSpeed: number | null;
};

export type CameraProfileRecord = {
  id: string;
  userId: string;
  brand: string;
  model: string;
  cameraDatabaseId: string | null;
  isActive: boolean;
  isUserEntered: boolean;
  ibisVerified: boolean;
  customOverrides: unknown;
  createdAt: Date;
  cameraDatabase: CameraDatabaseRecord | null;
};

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Fuzzy search CameraDatabase by brand or model using SQLite LIKE.
 * Returns top 10 matches.
 */
export async function searchCameras(
  query: string
): Promise<CameraDatabaseRecord[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const q = query.trim();

  const results = await prisma.cameraDatabase.findMany({
    where: {
      OR: [
        { brand: { contains: q } },
        { model: { contains: q } },
        { slug: { contains: q.toLowerCase() } },
      ],
    },
    take: 10,
    orderBy: [{ brand: "asc" }, { model: "asc" }],
  });

  return results.map(toCameraDatabaseRecord);
}

/**
 * Get a single camera by id.
 */
export async function getCameraById(
  id: string
): Promise<CameraDatabaseRecord | null> {
  const camera = await prisma.cameraDatabase.findUnique({
    where: { id },
  });

  if (!camera) return null;
  return toCameraDatabaseRecord(camera);
}

// ─── Profile CRUD ─────────────────────────────────────────────────────────────

/**
 * List all camera profiles for a user, ordered by active first then createdAt.
 */
export async function listUserCameraProfiles(
  userId: string
): Promise<CameraProfileRecord[]> {
  const profiles = await prisma.cameraProfile.findMany({
    where: { userId },
    include: { cameraDatabase: true },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return profiles.map(toCameraProfileRecord);
}

/**
 * Create a new camera profile for a user.
 * If isActive is true, deactivates all other profiles in the same transaction.
 */
export async function createCameraProfile(
  userId: string,
  data: {
    brand: string;
    model: string;
    cameraDatabaseId?: string | null;
    isActive?: boolean;
    isUserEntered?: boolean;
    customOverrides?: unknown;
  }
): Promise<CameraProfileRecord> {
  const makeActive = data.isActive ?? false;

  const profile = await prisma.$transaction(async (tx) => {
    if (makeActive) {
      await tx.cameraProfile.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.cameraProfile.create({
      data: {
        userId,
        brand: data.brand,
        model: data.model,
        cameraDatabaseId: data.cameraDatabaseId ?? null,
        isActive: makeActive,
        isUserEntered: data.isUserEntered ?? false,
        customOverrides: data.customOverrides
          ? (data.customOverrides as object)
          : undefined,
      },
      include: { cameraDatabase: true },
    });
  });

  return toCameraProfileRecord(profile);
}

/**
 * Update a camera profile. Setting isActive=true deactivates all other
 * profiles for that user in the same transaction (enforces single-active rule).
 */
export async function updateCameraProfile(
  profileId: string,
  userId: string,
  data: {
    brand?: string;
    model?: string;
    isActive?: boolean;
    ibisVerified?: boolean;
    customOverrides?: unknown;
  }
): Promise<CameraProfileRecord | null> {
  // Verify ownership
  const existing = await prisma.cameraProfile.findFirst({
    where: { id: profileId, userId },
  });
  if (!existing) return null;

  const profile = await prisma.$transaction(async (tx) => {
    if (data.isActive === true) {
      await tx.cameraProfile.updateMany({
        where: { userId, isActive: true, id: { not: profileId } },
        data: { isActive: false },
      });
    }

    return tx.cameraProfile.update({
      where: { id: profileId },
      data: {
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.model !== undefined && { model: data.model }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.ibisVerified !== undefined && {
          ibisVerified: data.ibisVerified,
        }),
        ...(data.customOverrides !== undefined && {
          customOverrides: data.customOverrides as object,
        }),
      },
      include: { cameraDatabase: true },
    });
  });

  return toCameraProfileRecord(profile);
}

/**
 * Delete a camera profile. Returns false if not found or not owned by user.
 */
export async function deleteCameraProfile(
  profileId: string,
  userId: string
): Promise<boolean> {
  const existing = await prisma.cameraProfile.findFirst({
    where: { id: profileId, userId },
  });
  if (!existing) return false;

  await prisma.cameraProfile.delete({ where: { id: profileId } });
  return true;
}

/**
 * Set a specific camera profile as active for a user.
 * Deactivates all other profiles in the same transaction.
 */
export async function setActiveCamera(
  userId: string,
  cameraProfileId: string
): Promise<CameraProfileRecord | null> {
  return updateCameraProfile(cameraProfileId, userId, { isActive: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toCameraDatabaseRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
): CameraDatabaseRecord {
  return {
    id: raw.id,
    brand: raw.brand,
    model: raw.model,
    slug: raw.slug,
    sensorSize: raw.sensorSize,
    pixelCountMp:
      raw.pixelCountMp !== null ? Number(raw.pixelCountMp) : null,
    baseIso: raw.baseIso,
    maxUsableIso: raw.maxUsableIso,
    maxNativeIso: raw.maxNativeIso,
    ibis: raw.ibis,
    ibisStops: raw.ibisStops !== null ? Number(raw.ibisStops) : null,
    dualNativeIso: raw.dualNativeIso,
    dualNativeIsoValues: raw.dualNativeIsoValues ?? null,
    dynamicRangeEv:
      raw.dynamicRangeEv !== null ? Number(raw.dynamicRangeEv) : null,
    releaseYear: raw.releaseYear ?? null,
    mount: raw.mount ?? null,
    maxFlashSyncSpeed: raw.maxFlashSyncSpeed ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCameraProfileRecord(raw: any): CameraProfileRecord {
  return {
    id: raw.id,
    userId: raw.userId,
    brand: raw.brand,
    model: raw.model,
    cameraDatabaseId: raw.cameraDatabaseId ?? null,
    isActive: raw.isActive,
    isUserEntered: raw.isUserEntered,
    ibisVerified: raw.ibisVerified,
    customOverrides: raw.customOverrides ?? null,
    createdAt: raw.createdAt,
    cameraDatabase: raw.cameraDatabase
      ? toCameraDatabaseRecord(raw.cameraDatabase)
      : null,
  };
}
