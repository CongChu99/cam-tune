import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  updateCameraProfile,
  deleteCameraProfile,
} from "@/lib/camera-database";

/**
 * PATCH /api/user/cameras/[id]
 * Edit a camera profile or set it as active.
 *
 * Body (all optional):
 *   brand?: string
 *   model?: string
 *   isActive?: boolean       — set to true to make this the active camera
 *   ibisVerified?: boolean
 *   customOverrides?: object
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: {
    brand?: string;
    model?: string;
    isActive?: boolean;
    ibisVerified?: boolean;
    customOverrides?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const profile = await updateCameraProfile(id, session.user.id, body);

    if (!profile) {
      return NextResponse.json(
        { error: "Camera profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[PATCH /api/user/cameras/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to update camera profile" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/cameras/[id]
 * Delete a camera profile.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const deleted = await deleteCameraProfile(id, session.user.id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Camera profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/user/cameras/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete camera profile" },
      { status: 500 }
    );
  }
}
