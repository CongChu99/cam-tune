/**
 * POST /api/auth/mobile/token
 *
 * Exchanges email + password credentials for JWT bearer tokens.
 * Designed for mobile Flutter clients that cannot use Next-Auth session cookies.
 *
 * Request body: { email: string, password: string }
 * Response:     { accessToken, refreshToken, expiresIn }
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_EXPIRES_IN,
} from "@/lib/mobile-jwt";

/** Simple in-memory rate limiter: max 5 attempts per IP per 15 minutes. */
export const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes in ms
const RATE_LIMIT_RETRY_AFTER = 900; // seconds

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    // First request in this window or previous window has expired
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: RATE_LIMIT_RETRY_AFTER },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password } = body ?? {};

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user?.passwordHash) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 401 });
    }

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(user.id, user.email),
      signRefreshToken(user.id),
    ]);

    return NextResponse.json({
      accessToken,
      refreshToken,
      expiresIn: ACCESS_EXPIRES_IN,
    });
  } catch (err) {
    console.error("[mobile/token] unexpected error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
