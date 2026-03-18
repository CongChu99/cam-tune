import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listUserCameraProfiles,
  createCameraProfile,
} from "@/lib/camera-database";

/**
 * GET /api/user/cameras
 * Returns the authenticated user's camera profiles.
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profiles = await listUserCameraProfiles(session.user.id);
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("[GET /api/user/cameras] Error:", error);
    return NextResponse.json(
      { error: "Failed to list camera profiles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/cameras
 * Create a new camera profile.
 *
 * Body:
 *   brand: string
 *   model: string
 *   cameraDatabaseId?: string   — omit for user-entered cameras
 *   isActive?: boolean
 *   isUserEntered?: boolean     — true for manual entry fallback
 *   customOverrides?: object
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    brand?: string;
    model?: string;
    cameraDatabaseId?: string;
    isActive?: boolean;
    isUserEntered?: boolean;
    customOverrides?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brand, model, cameraDatabaseId, isActive, isUserEntered, customOverrides } =
    body;

  if (!brand || !model) {
    return NextResponse.json(
      { error: "brand and model are required" },
      { status: 400 }
    );
  }

  try {
    const profile = await createCameraProfile(session.user.id, {
      brand,
      model,
      cameraDatabaseId: cameraDatabaseId ?? null,
      isActive,
      isUserEntered,
      customOverrides,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/user/cameras] Error:", error);
    return NextResponse.json(
      { error: "Failed to create camera profile" },
      { status: 500 }
    );
  }
}
