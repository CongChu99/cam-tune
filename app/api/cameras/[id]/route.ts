import { NextRequest, NextResponse } from "next/server";
import { getCameraById } from "@/lib/camera-database";

/**
 * GET /api/cameras/[id]
 * Returns the Camera DNA (full record) for a given camera database id.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const camera = await getCameraById(id);

    if (!camera) {
      return NextResponse.json({ error: "Camera not found" }, { status: 404 });
    }

    return NextResponse.json({ camera });
  } catch (error) {
    console.error("[GET /api/cameras/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch camera" },
      { status: 500 }
    );
  }
}
