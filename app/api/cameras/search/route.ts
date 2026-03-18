import { NextRequest, NextResponse } from "next/server";
import { searchCameras } from "@/lib/camera-database";

/**
 * GET /api/cameras/search?q=<query>
 * Fuzzy search the camera database. Returns top 10 matches.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ cameras: [] });
  }

  try {
    const cameras = await searchCameras(q);
    return NextResponse.json({ cameras });
  } catch (error) {
    console.error("[GET /api/cameras/search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search cameras" },
      { status: 500 }
    );
  }
}
