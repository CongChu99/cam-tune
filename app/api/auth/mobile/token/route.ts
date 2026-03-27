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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};

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
