/**
 * Mobile JWT helpers for PKCE token exchange.
 * Uses `jose` (available as transitive dependency of next-auth).
 *
 * Access token TTL:  15 minutes
 * Refresh token TTL: 30 days
 */
import { SignJWT, jwtVerify, JWTPayload } from "jose";

const ACCESS_TOKEN_TTL = 15 * 60; // seconds
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // seconds

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  userId: string,
  email: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL)
    .sign(getSecret());
}

export async function signRefreshToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TOKEN_TTL)
    .sign(getSecret());
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as RefreshTokenPayload;
}

export const ACCESS_EXPIRES_IN = ACCESS_TOKEN_TTL;
