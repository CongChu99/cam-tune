/**
 * POST /api/integrations/captureone/sync
 *
 * Supports two authentication modes:
 *  1. Plugin auth — `Authorization: Bearer <accessToken>` + `userId` in body
 *     Used by the Capture One plugin (no browser session available).
 *     Rate-limited per userId (10 attempts/min) to prevent brute-force.
 *     Token compared using constant-time comparison to prevent timing attacks.
 *  2. Web session auth — `getServerSession` cookie (no Authorization header)
 *     Used by the web app.
 *
 * Request body (plugin): { userId: string; sessionId: string }
 * Request body (web):    { sessionId: string }
 *
 * Responses:
 *  400 — missing or invalid fields
 *  401 — unauthenticated or token mismatch
 *  429 — rate limit exceeded (plugin auth only)
 *  200 — { success: boolean; synced: number; error?: string }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { CaptureOneService } from "@/lib/captureone-service";
import { decryptApiKey } from "@/lib/openai-client";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Simple rate limiter using Upstash Redis (gracefully skipped if unavailable)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

async function checkRateLimit(userId: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return true; // Redis not configured — skip rate limiting
  }
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const key = `c1:rl:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }
    return count <= RATE_LIMIT_MAX_ATTEMPTS;
  } catch {
    return true; // On Redis error, allow the request
  }
}

// ---------------------------------------------------------------------------
// Constant-time token comparison (prevents timing attacks)
// ---------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Lengths differ — compare anyway to avoid early exit leaking length info
    crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { userId: bodyUserId, sessionId } =
    (body as { userId?: unknown; sessionId?: unknown }) ?? {};

  // --- Auth: plugin Bearer token ---
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);

    if (typeof bodyUserId !== "string" || !bodyUserId) {
      return NextResponse.json(
        { error: "userId is required for plugin auth." },
        { status: 400 }
      );
    }

    // Rate limit: 10 attempts per userId per minute
    const allowed = await checkRateLimit(bodyUserId);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many authentication attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Validate token using constant-time comparison (prevents timing attacks)
    const user = await prisma.user.findUnique({
      where: { id: bodyUserId },
      select: { captureOneAccessTokenEncrypted: true },
    });

    let valid = false;
    if (user?.captureOneAccessTokenEncrypted) {
      try {
        const storedToken = decryptApiKey(user.captureOneAccessTokenEncrypted);
        valid = timingSafeEqual(storedToken, bearerToken);
      } catch {
        valid = false;
      }
    }

    if (!valid) {
      return NextResponse.json({ error: "Invalid plugin token." }, { status: 401 });
    }

    if (typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const result = await CaptureOneService.syncSession(bodyUserId, sessionId);
    return NextResponse.json(result, { status: 200 });
  }

  // --- Auth: web session ---
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const userId = session.user.id;

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const status = await CaptureOneService.getStatus(userId);
  if (!status.connected) {
    return NextResponse.json(
      { error: "User is not connected to Capture One. Please authorize the plugin first." },
      { status: 401 }
    );
  }

  const result = await CaptureOneService.syncSession(userId, sessionId);
  return NextResponse.json(result, { status: 200 });
}
