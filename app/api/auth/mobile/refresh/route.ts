/**
 * POST /api/auth/mobile/refresh
 *
 * Issues a new access token AND a new refresh token given a valid refresh token.
 * Implements refresh token rotation: each use of a refresh token yields a fresh
 * refresh token, reducing the window of stolen-token reuse.
 * Note (v1 known limitation): the old refresh token is NOT revoked (stateless).
 *
 * Designed for mobile Flutter clients.
 *
 * Request body: { refreshToken: string }
 * Response:     { accessToken, refreshToken, expiresIn }
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  ACCESS_EXPIRES_IN,
} from "@/lib/mobile-jwt";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body ?? {};

    if (!refreshToken) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      return NextResponse.json(
        { error: "refresh_token_expired" },
        { status: 401 }
      );
    }

    const userId = payload.sub;

    // Validate user still exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: "refresh_token_expired" },
        { status: 401 }
      );
    }

    // Refresh token rotation: issue both a new access token and a new refresh token
    const [accessToken, newRefreshToken] = await Promise.all([
      signAccessToken(user.id, user.email),
      signRefreshToken(user.id),
    ]);

    return NextResponse.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_EXPIRES_IN,
    });
  } catch (err) {
    console.error("[mobile/refresh] unexpected error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
