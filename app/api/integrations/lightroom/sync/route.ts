/**
 * POST /api/integrations/lightroom/sync
 *
 * Syncs one or more shoot session(s) as XMP sidecar files to Lightroom.
 *
 * Request body:
 *   sessionIds  string[]   IDs of ShootSession records to sync
 *
 * The handler:
 *  1. Loads each session from the database
 *  2. Builds XmpSessionData from session fields
 *  3. Calls LightroomService.syncSessionsBatch()
 *  4. On token expiry, items are queued in Upstash; response still returns 202
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LightroomService } from "@/lib/lightroom-service";
import type { XmpSessionData } from "@/lib/xmp-generator";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { sessionIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !Array.isArray(body.sessionIds) ||
    body.sessionIds.length === 0 ||
    !body.sessionIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json(
      { error: "sessionIds must be a non-empty array of strings" },
      { status: 400 }
    );
  }

  const sessionIds = body.sessionIds as string[];

  // Verify ownership + load sessions
  const dbSessions = await prisma.shootSession.findMany({
    where: { id: { in: sessionIds }, userId },
    select: {
      id: true,
      locationName: true,
      aiRecommendation: true,
      actualSettings: true,
      startedAt: true,
    },
  });

  if (dbSessions.length === 0) {
    return NextResponse.json({ error: "No sessions found" }, { status: 404 });
  }

  // Build XmpSessionData for each session
  const xmpData: XmpSessionData[] = dbSessions.map((s) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (s.aiRecommendation as Record<string, any>) ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actual = (s.actualSettings as Record<string, any>) ?? {};

    // Prefer actual settings if available, fall back to AI recommendation
    const settings = { ...rec, ...actual };

    return {
      sessionId: s.id,
      iso: settings.iso ?? settings.ISO,
      aperture: settings.aperture ?? settings.f,
      shutterSpeed: settings.shutterSpeed ?? settings.shutter,
      whiteBalance: settings.whiteBalance ?? settings.wb,
      aiConfidence:
        typeof rec.confidence === "number"
          ? rec.confidence
          : typeof rec.aiConfidence === "number"
          ? rec.aiConfidence
          : undefined,
      locationName: s.locationName ?? undefined,
      modifyDate: s.startedAt,
    };
  });

  const result = await LightroomService.syncSessionsBatch(userId, xmpData);

  if (!result.success && result.synced === 0) {
    // All failed and queued — respond 202 Accepted (async retry)
    return NextResponse.json(
      {
        queued: true,
        synced: 0,
        message: "Sync queued for retry",
        error: result.error,
      },
      { status: 202 }
    );
  }

  return NextResponse.json({
    success: result.success,
    synced: result.synced,
    total: xmpData.length,
    ...(result.error ? { warning: result.error } : {}),
  });
}
