/**
 * POST /api/auth/mobile/refresh
 *
 * Issues a new access token given a valid refresh token.
 * Designed for mobile Flutter clients.
 *
 * Request body: { refreshToken: string }
 * Response:     { accessToken, expiresIn }
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyRefreshToken,
  signAccessToken,
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

    const accessToken = await signAccessToken(user.id, user.email);

    return NextResponse.json({
      accessToken,
      expiresIn: ACCESS_EXPIRES_IN,
    });
  } catch (err) {
    console.error("[mobile/refresh] unexpected error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
