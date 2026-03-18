/**
 * POST /api/auth/openai/validate
 *
 * Validates an OpenAI API key, saves the encrypted key + selected model to the
 * authenticated user's record, and returns the list of Vision-capable models.
 *
 * Request body:
 *   { apiKey: string; modelId?: string }
 *
 * Response (200):
 *   { models: Array<{ id: string; created: number }>; modelId: string | null }
 *
 * Response (400):
 *   { error: string }
 *
 * Response (401):
 *   { error: "Invalid API key — please check your OpenAI dashboard" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { validateKey, encryptApiKey } from "@/lib/openai-client";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // --- Auth check -----------------------------------------------------------
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Parse body -----------------------------------------------------------
  let body: { apiKey?: string; modelId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { apiKey, modelId } = body;

  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json(
      { error: "apiKey is required" },
      { status: 400 }
    );
  }

  // --- Validate the key against OpenAI -------------------------------------
  let models: Array<{ id: string; created: number }>;
  try {
    models = await validateKey(apiKey.trim());
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to validate API key";
    const status = message.includes("Invalid API key") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }

  // --- Encrypt and persist --------------------------------------------------
  const encryptedKey = encryptApiKey(apiKey.trim());

  // Use provided modelId if it's in the validated model list; otherwise pick
  // the first (most recent) Vision-capable model.
  const resolvedModelId =
    modelId && models.some((m) => m.id === modelId)
      ? modelId
      : models[0]?.id ?? null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      openaiApiKeyEncrypted: encryptedKey,
      openaiModelId: resolvedModelId,
    },
  });

  // --- Return models (never return the API key) ----------------------------
  return NextResponse.json({ models, modelId: resolvedModelId });
}
