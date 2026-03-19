/**
 * DELETE /api/integrations/lightroom/disconnect
 *
 * Revokes the stored Lightroom tokens for the current user.
 * Does not call Adobe's revocation endpoint (no Adobe-side logout needed
 * for this flow; tokens simply become unused).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LightroomService } from "@/lib/lightroom-service";

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await LightroomService.revokeTokens(session.user.id);
    return NextResponse.json({ disconnected: true });
  } catch (err) {
    console.error("[Lightroom disconnect]", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
