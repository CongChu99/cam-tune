/**
 * GET /api/auth/openai/models
 *
 * Returns the list of Vision-capable OpenAI models for the authenticated user.
 * Decrypts the stored API key and calls OpenAI models.list().
 * Also returns the currently selected modelId.
 *
 * Response (200):
 *   { models: Array<{ id: string; created: number }>; modelId: string | null }
 *
 * Response (401):
 *   { error: "Unauthorized" } or { error: "No API key configured ..." }
 *
 * Response (502):
 *   { error: string } — OpenAI returned an unexpected error
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listModels, decryptApiKey } from "@/lib/openai-client";
import prisma from "@/lib/prisma";

export async function GET() {
  // --- Auth check -----------------------------------------------------------
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Load user's stored key -----------------------------------------------
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      openaiApiKeyEncrypted: true,
      openaiModelId: true,
    },
  });

  if (!user?.openaiApiKeyEncrypted) {
    return NextResponse.json(
      { error: "No API key configured — please connect your OpenAI account in Settings" },
      { status: 401 }
    );
  }

  // --- Decrypt and fetch models ---------------------------------------------
  let apiKey: string;
  try {
    apiKey = decryptApiKey(user.openaiApiKeyEncrypted);
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt stored API key" },
      { status: 500 }
    );
  }

  let models: Array<{ id: string; created: number }>;
  try {
    models = await listModels(apiKey);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch models";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // --- Return models (never return the API key) ----------------------------
  return NextResponse.json({
    models,
    modelId: user.openaiModelId ?? null,
  });
}
