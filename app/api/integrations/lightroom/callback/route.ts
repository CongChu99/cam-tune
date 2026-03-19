/**
 * GET /api/integrations/lightroom/callback
 *
 * Handles the Adobe OAuth 2.0 callback. Reads the authorization code,
 * validates state, exchanges for tokens, and stores them encrypted.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForTokens, LightroomService } from "@/lib/lightroom-service";
import { cookies } from "next/headers";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle Adobe returning an error
  if (error) {
    console.error("[Lightroom OAuth] Adobe returned error:", error, errorDescription);
    const redirectUrl = new URL("/settings/integrations", request.url);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  // Validate PKCE state + retrieve code verifier from cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get("lr_oauth_state")?.value;
  const codeVerifier = cookieStore.get("lr_pkce_verifier")?.value;

  if (!storedState || storedState !== returnedState) {
    return NextResponse.json({ error: "OAuth state mismatch — possible CSRF" }, { status: 400 });
  }

  if (!codeVerifier) {
    return NextResponse.json({ error: "PKCE verifier missing" }, { status: 400 });
  }

  // Clear the PKCE cookies
  cookieStore.delete("lr_pkce_verifier");
  cookieStore.delete("lr_oauth_state");

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    await LightroomService.storeOAuthTokens(session.user.id, tokens);
  } catch (err) {
    console.error("[Lightroom OAuth] Token exchange failed:", err);
    const redirectUrl = new URL("/settings/integrations", request.url);
    redirectUrl.searchParams.set("error", "token_exchange_failed");
    return NextResponse.redirect(redirectUrl);
  }

  // Success — redirect back to integrations settings
  const successUrl = new URL("/settings/integrations", request.url);
  successUrl.searchParams.set("connected", "1");
  return NextResponse.redirect(successUrl);
}
