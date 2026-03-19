/**
 * PATCH /api/auth/openai/model
 *
 * Updates the selected model for the authenticated user.
 * Used by the Settings page when the user changes the model dropdown (R1.3).
 *
 * Request body:
 *   { modelId: string }
 *
 * Response (200):
 *   { modelId: string }
 *
 * Response (400):
 *   { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  // --- Auth check -----------------------------------------------------------
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Parse body -----------------------------------------------------------
  let body: { modelId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { modelId } = body;

  if (!modelId || typeof modelId !== "string" || !modelId.trim()) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }

  // --- Persist selection ----------------------------------------------------
  await prisma.user.update({
    where: { id: session.user.id },
    data: { openaiModelId: modelId.trim() },
  });

  return NextResponse.json({ modelId: modelId.trim() });
}
