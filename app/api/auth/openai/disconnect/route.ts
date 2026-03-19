/**
 * DELETE /api/auth/openai/disconnect
 *
 * Disconnects the authenticated user from their OpenAI account by clearing
 * the encrypted API key and selected model from the database.
 *
 * Response (200):
 *   { success: true }
 *
 * Response (401):
 *   { error: "Unauthorized" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  // --- Auth check -----------------------------------------------------------
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Clear API key and model from DB ---------------------------------------
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      openaiApiKeyEncrypted: null,
      openaiModelId: null,
    },
  });

  return NextResponse.json({ success: true });
}
