/**
 * Mobile JWT helpers for PKCE token exchange.
 * Uses `jose` (available as transitive dependency of next-auth).
 *
 * Access token TTL:  15 minutes
 * Refresh token TTL: 30 days
 *
 * Secret: uses MOBILE_JWT_SECRET when set, otherwise falls back to
 * NEXTAUTH_SECRET so existing deployments continue to work without
 * configuration changes. Production should set a dedicated
 * MOBILE_JWT_SECRET to isolate mobile tokens from NextAuth sessions.
 */
import { SignJWT, jwtVerify, JWTPayload } from "jose";

const ACCESS_TOKEN_TTL = 15 * 60; // seconds
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // seconds

function getSecret(): Uint8Array {
  // Use a dedicated secret for mobile JWTs when available.
  // Fallback to NEXTAUTH_SECRET so existing deployments work without
  // additional configuration; production deployments should set
  // MOBILE_JWT_SECRET to isolate mobile tokens from NextAuth sessions.
  const secret = process.env.MOBILE_JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "MOBILE_JWT_SECRET (or NEXTAUTH_SECRET) environment variable is not set"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  userId: string,
  email: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email, type: "access" })
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
  type: "refresh";
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type: expected refresh token");
  }
  return payload as RefreshTokenPayload;
}

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  type: "access";
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.type !== "access") {
    throw new Error("Invalid token type: expected access token");
  }
  return payload as AccessTokenPayload;
}

export const ACCESS_EXPIRES_IN = ACCESS_TOKEN_TTL;
