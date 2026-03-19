/**
 * DELETE /api/integrations/captureone/disconnect
 *
 * Revokes the stored Capture One plugin tokens for the authenticated user.
 *
 * Auth: getServerSession (web app only)
 *
 * Responses:
 *  200 — { success: true }
 *  401 — unauthenticated
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CaptureOneService } from "@/lib/captureone-service";

export async function DELETE(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await CaptureOneService.revokeTokens(session.user.id);
  return NextResponse.json({ success: true }, { status: 200 });
}
