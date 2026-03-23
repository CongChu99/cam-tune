/**
 * TDD Phase 1 — RED
 *
 * Tests for CaptureOneService and the /api/integrations/captureone/sync route.
 *
 * These tests are written BEFORE the implementation exists and must fail
 * until Phase 2 (GREEN) is complete.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — prevent real DB / Redis calls
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    shootSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    rpush: vi.fn().mockResolvedValue(1),
    lpop: vi.fn().mockResolvedValue(null),
    lrange: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock next-auth so route tests don't need a real request context
vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Provide a deterministic encryption key for tests
process.env.ENCRYPTION_KEY = "a".repeat(64); // 64-char hex string (32 bytes)
process.env.CAPTUREONE_API_KEY = "test-co-api-key";
process.env.CAPTUREONE_CLIENT_ID = "test-co-client-id";

// ---------------------------------------------------------------------------
// Imports (after mocks are in place)
// ---------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import {
  CaptureOneService,
  buildSyncPayload,
  queueFailedSync,
  dequeuePendingSessions,
  isCaptureOneConfigured,
  type CaptureOneSyncPayload,
} from "@/lib/captureone-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  captureOneAccessTokenEncrypted: null,
  captureOneTokenIssuedAt: null,
  ...overrides,
});

const baseSession = {
  id: "session-abc",
  userId: "user-1",
  lat: 48.8566,
  lng: 2.3522,
  locationName: "Paris, France",
  startedAt: new Date("2024-06-15T08:00:00Z"),
  endedAt: new Date("2024-06-15T10:00:00Z"),
  weatherSnapshot: { temp: 22, condition: "Sunny", humidity: 45 },
  sunSnapshot: { altitude: 45, azimuth: 135 },
  sceneType: "landscape",
  aiRecommendation: {
    iso: 200,
    aperture: "f/8",
    shutterSpeed: "1/250",
    whiteBalance: "Daylight",
    confidence: 0.92,
  },
  actualSettings: {
    iso: 400,
    aperture: "f/11",
    shutterSpeed: "1/500",
    whiteBalance: "Auto",
  },
  userRating: 4,
  notes: "Great light",
  isPlan: false,
  createdAt: new Date("2024-06-15T08:00:00Z"),
};

// ---------------------------------------------------------------------------
// CaptureOneService.getStatus()
// ---------------------------------------------------------------------------

describe("CaptureOneService.getStatus()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns configured:false when env vars are not set", async () => {
    const savedClientId = process.env.CAPTUREONE_CLIENT_ID;
    delete process.env.CAPTUREONE_CLIENT_ID;

    const status = await CaptureOneService.getStatus("user-1");

    expect(status).toMatchObject({
      configured: false,
      connected: false,
      needsReauth: false,
    });
    expect(status.issuedAt).toBeUndefined();

    process.env.CAPTUREONE_CLIENT_ID = savedClientId;
  });

  it("returns connected:false when user has no stored token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser() as never);

    const status = await CaptureOneService.getStatus("user-1");

    expect(status.configured).toBe(true);
    expect(status.connected).toBe(false);
    expect(status.needsReauth).toBe(false);
    expect(status.issuedAt).toBeUndefined();
  });

  it("returns connected:true with issuedAt when token exists", async () => {
    const issuedAt = new Date("2024-06-01T00:00:00Z");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: "encrypted-token",
        captureOneTokenIssuedAt: issuedAt,
      }) as never
    );

    const status = await CaptureOneService.getStatus("user-1");

    expect(status.connected).toBe(true);
    expect(status.issuedAt).toBe(issuedAt.toISOString());
  });

  it("sets needsReauth:true when token is older than 90 days", async () => {
    // Issue date far in the past (> 90 days ago)
    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: "encrypted-token",
        captureOneTokenIssuedAt: oldDate,
      }) as never
    );

    const status = await CaptureOneService.getStatus("user-1");

    expect(status.needsReauth).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildSyncPayload()
// ---------------------------------------------------------------------------

describe("buildSyncPayload()", () => {
  it("builds a complete payload from a full session", () => {
    const payload = buildSyncPayload(baseSession as never);

    expect(payload).toMatchObject<Partial<CaptureOneSyncPayload>>({
      sessionId: "session-abc",
      location: {
        lat: 48.8566,
        lng: 2.3522,
        name: "Paris, France",
      },
      aiRecommendation: {
        iso: 200,
        aperture: "f/8",
        shutterSpeed: "1/250",
        whiteBalance: "Daylight",
        confidence: 0.92,
      },
      actualSettings: {
        iso: 400,
        aperture: "f/11",
        shutterSpeed: "1/500",
        whiteBalance: "Auto",
      },
      userRating: 4,
    });

    // Weather and scene should be present
    expect(payload.weather).toBeDefined();
    expect(payload.sceneType).toBe("landscape");
    // Timestamps
    expect(payload.startedAt).toBe("2024-06-15T08:00:00Z");
    expect(payload.endedAt).toBe("2024-06-15T10:00:00Z");
  });

  it("handles missing aiRecommendation gracefully", () => {
    const sessionWithoutAI = { ...baseSession, aiRecommendation: null };
    const payload = buildSyncPayload(sessionWithoutAI as never);

    expect(payload.aiRecommendation).toBeNull();
    expect(payload.sessionId).toBe("session-abc");
  });

  it("handles missing weather snapshot gracefully", () => {
    const sessionWithoutWeather = { ...baseSession, weatherSnapshot: null };
    const payload = buildSyncPayload(sessionWithoutWeather as never);

    expect(payload.weather).toBeNull();
    expect(payload.sessionId).toBe("session-abc");
  });

  it("handles missing actualSettings gracefully", () => {
    const sessionWithoutSettings = { ...baseSession, actualSettings: null };
    const payload = buildSyncPayload(sessionWithoutSettings as never);

    expect(payload.actualSettings).toBeNull();
    expect(payload.sessionId).toBe("session-abc");
  });

  it("handles missing optional locationName", () => {
    const sessionWithoutLocation = { ...baseSession, locationName: null };
    const payload = buildSyncPayload(sessionWithoutLocation as never);

    expect(payload.location.name).toBeUndefined();
    // lat/lng should still be present
    expect(payload.location.lat).toBeDefined();
    expect(payload.location.lng).toBeDefined();
  });

  it("handles missing userRating", () => {
    const sessionWithoutRating = { ...baseSession, userRating: null };
    const payload = buildSyncPayload(sessionWithoutRating as never);

    expect(payload.userRating).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Offline queue: queueFailedSync() and dequeuePendingSessions()
// ---------------------------------------------------------------------------

describe("Offline queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear Redis env to force fallback to ShootSession.jsonb queue
    delete process.env.REDIS_URL;
  });

  it("queueFailedSync() stores sessionId in ShootSession jsonb when Redis is unavailable", async () => {
    vi.mocked(prisma.shootSession.findUnique).mockResolvedValue({
      ...baseSession,
      captureOneSyncQueue: null,
    } as never);
    vi.mocked(prisma.shootSession.update).mockResolvedValue({} as never);

    await queueFailedSync("user-1", "session-abc");

    expect(prisma.shootSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-abc" },
        data: expect.objectContaining({
          captureOneSyncQueue: expect.objectContaining({
            pending: expect.arrayContaining(["session-abc"]),
          }),
        }),
      })
    );
  });

  it("dequeuePendingSessions() returns empty array when no sessions are queued", async () => {
    vi.mocked(prisma.shootSession.findMany).mockResolvedValue([]);

    const sessions = await dequeuePendingSessions("user-1");

    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions).toHaveLength(0);
  });

  it("dequeuePendingSessions() returns queued session IDs from ShootSession.jsonb", async () => {
    vi.mocked(prisma.shootSession.findMany).mockResolvedValue([
      {
        ...baseSession,
        captureOneSyncQueue: { pending: ["session-abc", "session-def"] },
      },
    ] as never);

    const sessions = await dequeuePendingSessions("user-1");

    expect(sessions).toContain("session-abc");
    expect(sessions).toContain("session-def");
  });

});

// ---------------------------------------------------------------------------
// CaptureOneService full service methods
// ---------------------------------------------------------------------------

describe("CaptureOneService.storeTokens()", () => {
  it("stores encrypted tokens for the user", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const tokens = {
      accessToken: "access-token-value",
      refreshToken: "refresh-token-value",
      expiresAt: new Date(Date.now() + 3600 * 1000),
      issuedAt: new Date(),
    };

    await expect(
      CaptureOneService.storeTokens("user-1", tokens)
    ).resolves.not.toThrow();

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          captureOneAccessTokenEncrypted: expect.any(String),
          captureOneRefreshTokenEncrypted: expect.any(String),
        }),
      })
    );
  });
});

describe("CaptureOneService.revokeTokens()", () => {
  it("clears all Capture One token fields for the user", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    await expect(
      CaptureOneService.revokeTokens("user-1")
    ).resolves.not.toThrow();

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          captureOneAccessTokenEncrypted: null,
          captureOneRefreshTokenEncrypted: null,
        }),
      })
    );
  });
});

describe("CaptureOneService.refreshAccessToken()", () => {
  it("throws when user has no stored tokens", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser() as never);

    await expect(
      CaptureOneService.refreshAccessToken("user-1")
    ).rejects.toThrow(/not connected/i);
  });

  it("returns existing tokens when user is connected (Capture One uses API key, no OAuth refresh)", async () => {
    const { encryptApiKey } = await import("@/lib/openai-client");
    const issuedAt = new Date();
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: encryptApiKey("valid-access-token"),
        captureOneRefreshTokenEncrypted: encryptApiKey("valid-refresh-token"),
        captureOneTokenExpiry: expiresAt,
        captureOneTokenIssuedAt: issuedAt,
      }) as never
    );

    const tokens = await CaptureOneService.refreshAccessToken("user-1");

    expect(tokens).toMatchObject({
      accessToken: "valid-access-token",
      refreshToken: "valid-refresh-token",
    });
  });
});

// ---------------------------------------------------------------------------
// isCaptureOneConfigured()
// ---------------------------------------------------------------------------

describe("isCaptureOneConfigured()", () => {
  it("returns true when CAPTUREONE_CLIENT_ID is set", () => {
    process.env.CAPTUREONE_CLIENT_ID = "test-client-id";
    expect(isCaptureOneConfigured()).toBe(true);
  });

  it("returns false when CAPTUREONE_CLIENT_ID is absent", () => {
    const saved = process.env.CAPTUREONE_CLIENT_ID;
    delete process.env.CAPTUREONE_CLIENT_ID;
    expect(isCaptureOneConfigured()).toBe(false);
    process.env.CAPTUREONE_CLIENT_ID = saved;
  });
});

// ---------------------------------------------------------------------------
// API Route: POST /api/integrations/captureone/sync
// ---------------------------------------------------------------------------

describe("POST /api/integrations/captureone/sync route", () => {
  const importRoute = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import("@/app/api/integrations/captureone/sync/route" as any);
    return mod;
  };

  it("returns 401 when not authenticated (no session)", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "session-abc" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when user is not connected to Capture One", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser() as never);
    vi.mocked(prisma.shootSession.findFirst).mockResolvedValue(baseSession as never);

    const { POST } = await importRoute();

    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "session-abc" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  it("returns 400 when required fields are missing", async () => {
    // Mock a connected user so we get past auth, but no sessionId in body
    const { encryptApiKey } = await import("@/lib/openai-client");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: encryptApiKey("token"),
        captureOneRefreshTokenEncrypted: encryptApiKey("refresh"),
        captureOneTokenExpiry: new Date(Date.now() + 3600 * 1000),
        captureOneTokenIssuedAt: new Date(),
      }) as never
    );

    const { POST } = await importRoute();

    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // missing sessionId
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 and synced:1 on successful sync", async () => {
    // Mock user with a valid token
    const { encryptApiKey } = await import("@/lib/openai-client");
    const encryptedToken = encryptApiKey("valid-access-token");

    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: encryptedToken,
        captureOneRefreshTokenEncrypted: encryptApiKey("valid-refresh-token"),
        captureOneTokenExpiry: new Date(Date.now() + 3600 * 1000),
        captureOneTokenIssuedAt: new Date(),
      }) as never
    );

    vi.mocked(prisma.shootSession.findFirst).mockResolvedValue(baseSession as never);
    vi.mocked(prisma.shootSession.findMany).mockResolvedValue([]);

    // Mock the external C1 sync HTTP call to succeed
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const { POST } = await importRoute();

    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "session-abc" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toMatchObject({ success: true, synced: 1 });

    fetchSpy.mockRestore();
  });

  it("queues the session and returns 200 with success:false when sync fails", async () => {
    const { encryptApiKey } = await import("@/lib/openai-client");
    const encryptedToken = encryptApiKey("valid-access-token");

    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: encryptedToken,
        captureOneRefreshTokenEncrypted: encryptApiKey("valid-refresh-token"),
        captureOneTokenExpiry: new Date(Date.now() + 3600 * 1000),
        captureOneTokenIssuedAt: new Date(),
      }) as never
    );

    vi.mocked(prisma.shootSession.findFirst).mockResolvedValue(baseSession as never);
    vi.mocked(prisma.shootSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.shootSession.update).mockResolvedValue({} as never);

    // Make the external sync call fail
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    );

    const { POST } = await importRoute();

    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "session-abc" }),
    });

    const res = await POST(req);
    // Should still return 200 (graceful degradation — queued for retry)
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toMatchObject({ success: false, synced: 0 });
    expect(json.error).toMatch(/queue/i);

    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// CaptureOneService.syncSession() — additional edge cases
// ---------------------------------------------------------------------------

describe("CaptureOneService.syncSession()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure env is set for "configured"
    process.env.CAPTUREONE_CLIENT_ID = "test-co-client-id";
  });

  it("returns error when session is not found in DB", async () => {
    const { encryptApiKey } = await import("@/lib/openai-client");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: encryptApiKey("valid-access-token"),
        captureOneRefreshTokenEncrypted: encryptApiKey("valid-refresh-token"),
        captureOneTokenExpiry: new Date(Date.now() + 3600 * 1000),
        captureOneTokenIssuedAt: new Date(),
      }) as never
    );
    vi.mocked(prisma.shootSession.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.shootSession.findMany).mockResolvedValue([]);

    const result = await CaptureOneService.syncSession("user-1", "nonexistent-session");

    expect(result.success).toBe(false);
    expect(result.synced).toBe(0);
    expect(result.error).toMatch(/not found/i);
  });

  it("queues session when C1 endpoint returns non-2xx status", async () => {
    const { encryptApiKey } = await import("@/lib/openai-client");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: encryptApiKey("valid-access-token"),
        captureOneRefreshTokenEncrypted: encryptApiKey("valid-refresh-token"),
        captureOneTokenExpiry: new Date(Date.now() + 3600 * 1000),
        captureOneTokenIssuedAt: new Date(),
      }) as never
    );
    vi.mocked(prisma.shootSession.findFirst).mockResolvedValue(baseSession as never);
    vi.mocked(prisma.shootSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.shootSession.update).mockResolvedValue({} as never);

    // C1 bridge returns 500
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    const result = await CaptureOneService.syncSession("user-1", "session-abc");

    expect(result.success).toBe(false);
    expect(result.synced).toBe(0);
    // Should have queued the session for retry
    expect(prisma.shootSession.update).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("returns error when user is not connected (no tokens)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser() as never);

    const result = await CaptureOneService.syncSession("user-1", "session-abc");

    expect(result.success).toBe(false);
    expect(result.synced).toBe(0);
    expect(result.error).toMatch(/not connected/i);
  });
});

// ---------------------------------------------------------------------------
// API Route: plugin Bearer token auth
// ---------------------------------------------------------------------------

describe("POST /api/integrations/captureone/sync — Bearer token (plugin) auth", () => {
  const importRoute = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import("@/app/api/integrations/captureone/sync/route" as any);
    return mod;
  };

  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when Bearer token does not match stored token", async () => {
    const { encryptApiKey } = await import("@/lib/openai-client");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({ captureOneAccessTokenEncrypted: encryptApiKey("real-token") }) as never
    );

    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({ userId: "user-1", sessionId: "session-abc" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 when Bearer token matches stored token", async () => {
    const { encryptApiKey } = await import("@/lib/openai-client");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser({
        captureOneAccessTokenEncrypted: encryptApiKey("valid-plugin-token"),
        captureOneRefreshTokenEncrypted: encryptApiKey("refresh"),
        captureOneTokenExpiry: new Date(Date.now() + 3600 * 1000),
        captureOneTokenIssuedAt: new Date(),
      }) as never
    );
    vi.mocked(prisma.shootSession.findFirst).mockResolvedValue(baseSession as never);
    vi.mocked(prisma.shootSession.findMany).mockResolvedValue([]);

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-plugin-token",
      },
      body: JSON.stringify({ userId: "user-1", sessionId: "session-abc" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    fetchSpy.mockRestore();
  });

  it("returns 400 when Bearer auth but userId missing from body", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/integrations/captureone/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer some-token",
      },
      body: JSON.stringify({ sessionId: "session-abc" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// API Route: DELETE /api/integrations/captureone/disconnect
// ---------------------------------------------------------------------------

describe("DELETE /api/integrations/captureone/disconnect route", () => {
  it("returns 401 when not authenticated", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { DELETE } = await import("@/app/api/integrations/captureone/disconnect/route" as any);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("returns 200 and revokes tokens for authenticated user", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { DELETE } = await import("@/app/api/integrations/captureone/disconnect/route" as any);
    const res = await DELETE();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
