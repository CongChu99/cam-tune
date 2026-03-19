/**
 * Settings › Integrations page
 *
 * Shows Lightroom connection status and lets the user connect / disconnect.
 * Handles the 90-day re-auth prompt.
 *
 * Route: /settings/integrations
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LightroomService, isAdobeConfigured } from "@/lib/lightroom-service";
import LightroomIntegrationCard from "./LightroomIntegrationCard";

export const metadata = {
  title: "Integrations — CamTune",
  description: "Connect CamTune to Adobe Lightroom and other tools",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const params = await searchParams;
  const justConnected = params.connected === "1";
  const oauthError = params.error;

  const status = await LightroomService.getStatus(session.user.id);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Settings
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Integrations</h1>
      <p className="text-muted-foreground mb-8">
        Connect CamTune to your favorite tools to sync session data automatically.
      </p>

      {oauthError && (
        <div className="mb-6 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          OAuth error: <span className="font-mono">{oauthError}</span>. Please try
          connecting again.
        </div>
      )}

      {justConnected && (
        <div className="mb-6 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Lightroom connected successfully.
        </div>
      )}

      <div className="space-y-4">
        <LightroomIntegrationCard status={status} />
      </div>
    </main>
  );
}
