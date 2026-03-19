/**
 * GET /api/integrations/lightroom
 *
 * Initiates the Adobe Lightroom OAuth 2.0 (PKCE) flow.
 * Stores the code verifier and state in a signed server-side cookie,
 * then redirects the user to Adobe's authorization endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildAuthorizationUrl, isAdobeConfigured } from "@/lib/lightroom-service";
import { cookies } from "next/headers";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdobeConfigured()) {
    return NextResponse.json(
      { error: "Adobe Lightroom integration is not configured. Set ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET, and ADOBE_REDIRECT_URI." },
      { status: 503 }
    );
  }

  const { url, codeVerifier, state } = buildAuthorizationUrl();

  // Store the PKCE verifier and state in an HttpOnly cookie for the callback
  const cookieStore = await cookies();
  cookieStore.set("lr_pkce_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  cookieStore.set("lr_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(url);
}
