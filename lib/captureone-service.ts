/**
 * CaptureOneService — Capture One plugin integration.
 *
 * Responsibilities:
 *  - Connection status check (isCaptureOneConfigured + token lookup)
 *  - Encrypted token storage / retrieval via Prisma
 *  - Sync payload builder from ShootSession
 *  - Offline queue: store failed syncs in ShootSession.captureOneSyncQueue (jsonb)
 *    with optional Upstash Redis fallback
 */

import Redis from "ioredis";
import { Prisma } from "@/lib/generated/prisma";
import prisma from "@/lib/prisma";
import { encryptApiKey, decryptApiKey } from "@/lib/openai-client";
import {
  type IntegrationService,
  type IntegrationStatus,
  type OAuthTokens,
  type SyncResult,
  REAUTH_THRESHOLD_MS,
} from "@/lib/integration-service";

// ---------------------------------------------------------------------------
// Environment / configuration
// ---------------------------------------------------------------------------

/** Returns true if the Capture One integration is configured in env vars. */
export function isCaptureOneConfigured(): boolean {
  return Boolean(process.env.CAPTUREONE_CLIENT_ID);
}

// ---------------------------------------------------------------------------
// Upstash Redis client (lazy-init, optional)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  if (!process.env.REDIS_URL) {
    return null;
  }
  _redis = new Redis(process.env.REDIS_URL).on('error', () => {});
  return _redis;
}

const C1_SYNC_QUEUE_KEY = (userId: string) =>
  `camtune:c1-sync-queue:${userId}`;

// ---------------------------------------------------------------------------
// Sync payload type
// ---------------------------------------------------------------------------

export interface CaptureOneSyncPayload {
  sessionId: string;
  location: {
    lat: number | string;
    lng: number | string;
    name?: string;
  };
  weather: Record<string, unknown> | null;
  sun?: Record<string, unknown> | null;
  sceneType: string | null | undefined;
  aiRecommendation: Record<string, unknown> | null;
  actualSettings: Record<string, unknown> | null;
  userRating: number | null | undefined;
  notes?: string | null;
  startedAt: string;
  endedAt: string | null | undefined;
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

/**
 * Builds a CaptureOneSyncPayload from a raw ShootSession database record.
 * Handles all optional fields gracefully.
 */
export function buildSyncPayload(session: {
  id: string;
  lat: number | string | { toNumber(): number };
  lng: number | string | { toNumber(): number };
  locationName?: string | null;
  weatherSnapshot: unknown;
  sunSnapshot?: unknown;
  sceneType?: string | null;
  aiRecommendation?: unknown;
  actualSettings?: unknown;
  userRating?: number | null;
  notes?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
}): CaptureOneSyncPayload {
  // Decimal fields from Prisma may be Decimal objects — convert to number
  const toNum = (v: unknown): number | string => {
    if (v && typeof (v as { toNumber?: () => number }).toNumber === "function") {
      return (v as { toNumber(): number }).toNumber();
    }
    return v as number | string;
  };

  return {
    sessionId: session.id,
    location: {
      lat: toNum(session.lat),
      lng: toNum(session.lng),
      ...(session.locationName != null ? { name: session.locationName } : {}),
    },
    weather:
      session.weatherSnapshot != null
        ? (session.weatherSnapshot as Record<string, unknown>)
        : null,
    sun:
      session.sunSnapshot != null
        ? (session.sunSnapshot as Record<string, unknown>)
        : undefined,
    sceneType: session.sceneType ?? null,
    aiRecommendation:
      session.aiRecommendation != null
        ? (session.aiRecommendation as Record<string, unknown>)
        : null,
    actualSettings:
      session.actualSettings != null
        ? (session.actualSettings as Record<string, unknown>)
        : null,
    userRating: session.userRating ?? null,
    notes: session.notes ?? null,
    startedAt: session.startedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    endedAt: session.endedAt
      ? session.endedAt.toISOString().replace(/\.\d{3}Z$/, "Z")
      : null,
  };
}

// ---------------------------------------------------------------------------
// Offline queue helpers
// ---------------------------------------------------------------------------

/**
 * Pushes a session ID to the failed-sync queue.
 *
 * Strategy:
 *  1. If Redis is available: use RPUSH on a per-user key.
 *  2. Otherwise: store inside ShootSession.captureOneSyncQueue (jsonb field).
 */
export async function queueFailedSync(
  userId: string,
  sessionId: string
): Promise<void> {
  const redis = getRedis();

  if (redis) {
    await redis.rpush(C1_SYNC_QUEUE_KEY(userId), sessionId);
    return;
  }

  // Fallback: persist to ShootSession.captureOneSyncQueue jsonb
  const session = await prisma.shootSession.findUnique({
    where: { id: sessionId },
    select: { captureOneSyncQueue: true },
  });

  const existing = (session?.captureOneSyncQueue as { pending?: string[] } | null) ?? {};
  const pending: string[] = Array.isArray(existing.pending)
    ? existing.pending
    : [];

  if (!pending.includes(sessionId)) {
    pending.push(sessionId);
  }

  await prisma.shootSession.update({
    where: { id: sessionId },
    data: {
      captureOneSyncQueue: { pending },
    },
  });
}

/**
 * Returns all pending session IDs from the queue and clears them.
 *
 * Strategy mirrors queueFailedSync:
 *  1. If Redis is available: LPOP up to 100 items.
 *  2. Otherwise: scan ShootSessions for captureOneSyncQueue.pending entries.
 */
export async function dequeuePendingSessions(userId: string): Promise<string[]> {
  const redis = getRedis();

  if (redis) {
    const key = C1_SYNC_QUEUE_KEY(userId);
    const items: string[] = [];
    for (let i = 0; i < 100; i++) {
      const item = await redis.lpop(key);
      if (item === null) break;
      items.push(item);
    }
    return items;
  }

  // Fallback: find sessions with pending queue entries for this user
  const sessions = await prisma.shootSession.findMany({
    where: {
      userId,
      NOT: {
        captureOneSyncQueue: { equals: Prisma.JsonNull },
      },
    },
    select: { id: true, captureOneSyncQueue: true },
  });

  const sessionIds: string[] = [];

  for (const s of sessions) {
    const queue = s.captureOneSyncQueue as { pending?: string[] } | null;
    if (Array.isArray(queue?.pending) && queue.pending.length > 0) {
      sessionIds.push(...queue.pending);
      // Clear the queue after dequeuing
      await prisma.shootSession.update({
        where: { id: s.id },
        data: { captureOneSyncQueue: { pending: [] } },
      });
    }
  }

  return sessionIds;
}

// ---------------------------------------------------------------------------
// Token storage helpers (encrypted)
// ---------------------------------------------------------------------------

async function storeTokensInternal(
  userId: string,
  tokens: OAuthTokens
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      captureOneAccessTokenEncrypted: encryptApiKey(tokens.accessToken),
      captureOneRefreshTokenEncrypted: encryptApiKey(tokens.refreshToken),
      captureOneTokenExpiry: tokens.expiresAt,
      captureOneTokenIssuedAt: tokens.issuedAt,
    },
  });
}

async function getTokensInternal(userId: string): Promise<OAuthTokens | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      captureOneAccessTokenEncrypted: true,
      captureOneRefreshTokenEncrypted: true,
      captureOneTokenExpiry: true,
      captureOneTokenIssuedAt: true,
    },
  });

  if (
    !user?.captureOneAccessTokenEncrypted ||
    !user?.captureOneRefreshTokenEncrypted ||
    !user?.captureOneTokenExpiry ||
    !user?.captureOneTokenIssuedAt
  ) {
    return null;
  }

  return {
    accessToken: decryptApiKey(user.captureOneAccessTokenEncrypted),
    refreshToken: decryptApiKey(user.captureOneRefreshTokenEncrypted),
    expiresAt: user.captureOneTokenExpiry,
    issuedAt: user.captureOneTokenIssuedAt,
  };
}

// ---------------------------------------------------------------------------
// Public CaptureOneService implementation
// ---------------------------------------------------------------------------

export const CaptureOneService: IntegrationService & {
  syncSession(
    userId: string,
    sessionId: string
  ): Promise<SyncResult>;
} = {
  async getStatus(userId: string): Promise<IntegrationStatus> {
    if (!isCaptureOneConfigured()) {
      return { configured: false, connected: false, needsReauth: false };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        captureOneAccessTokenEncrypted: true,
        captureOneTokenIssuedAt: true,
      },
    });

    const connected = Boolean(user?.captureOneAccessTokenEncrypted);
    let needsReauth = false;
    let issuedAt: string | undefined;

    if (connected && user?.captureOneTokenIssuedAt) {
      issuedAt = user.captureOneTokenIssuedAt.toISOString();
      needsReauth =
        Date.now() - user.captureOneTokenIssuedAt.getTime() > REAUTH_THRESHOLD_MS;
    }

    return { configured: true, connected, needsReauth, issuedAt };
  },

  async storeTokens(userId: string, tokens: OAuthTokens): Promise<void> {
    return storeTokensInternal(userId, tokens);
  },

  async revokeTokens(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        captureOneAccessTokenEncrypted: null,
        captureOneRefreshTokenEncrypted: null,
        captureOneTokenExpiry: null,
        captureOneTokenIssuedAt: null,
      },
    });
  },

  async refreshAccessToken(userId: string): Promise<OAuthTokens> {
    const tokens = await getTokensInternal(userId);
    if (!tokens) {
      throw new Error("User is not connected to Capture One.");
    }
    // Capture One uses API key auth — tokens do not expire via OAuth refresh.
    // If the token is still valid, return as-is. Preserve original issuedAt.
    return tokens;
  },

  /**
   * Syncs a single session to Capture One via the plugin bridge API.
   * On failure, queues the session for later retry.
   */
  async syncSession(userId: string, sessionId: string): Promise<SyncResult> {
    const tokens = await getTokensInternal(userId);
    if (!tokens) {
      return {
        success: false,
        synced: 0,
        error: "User is not connected to Capture One.",
      };
    }

    // Drain any previously queued failed syncs before processing this one
    const queued = await dequeuePendingSessions(userId);
    if (queued.length > 0) {
      // Fire-and-forget retry: Promise.allSettled never rejects
      void Promise.allSettled(
        queued
          .filter((id) => id !== sessionId) // avoid duplicate processing
          .map((id) => CaptureOneService.syncSession(userId, id))
      );
    }

    const session = await prisma.shootSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return { success: false, synced: 0, error: `Session ${sessionId} not found.` };
    }

    const payload = buildSyncPayload(session);

    try {
      const res = await fetch(
        `${process.env.CAPTUREONE_PLUGIN_BRIDGE_URL ?? "http://localhost:8088"}/api/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Capture One sync failed (${res.status}): ${text}`);
      }

      return { success: true, synced: 1 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await queueFailedSync(userId, sessionId);
      return {
        success: false,
        synced: 0,
        error: `Sync failed — queued for retry: ${msg}`,
      };
    }
  },
};
