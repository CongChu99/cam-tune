/**
 * Camera Profiles management page.
 *
 * Displays all user camera profiles with active indicator.
 * Allows adding new cameras (via search or manual entry),
 * switching the active camera, editing, and deleting profiles.
 *
 * Route: /cameras
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listUserCameraProfiles } from "@/lib/camera-database";
import { CameraProfilesClient } from "./CameraProfilesClient";

export const metadata = {
  title: "Camera Profiles — CamTune",
  description: "Manage your camera bodies for AI-powered recommendations",
};

export default async function CamerasPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const profiles = await listUserCameraProfiles(session.user.id);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Camera Profiles</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Add your camera bodies so CamTune can provide accurate recommendations.
        Only one camera can be active at a time.
      </p>

      <CameraProfilesClient initialProfiles={profiles} />
    </main>
  );
}
