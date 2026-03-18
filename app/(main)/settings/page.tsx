/**
 * Settings page — OpenAI API Key configuration.
 *
 * This is a React Server Component that loads the current user's model
 * selection on the server, then passes it to the client-side form component.
 *
 * Route: /settings
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { OpenAISettingsForm } from "./OpenAISettingsForm";

export const metadata = {
  title: "Settings — CamTune",
  description: "Connect your OpenAI API key to enable AI camera recommendations",
};

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  // Load current user state (never return the encrypted key to the client)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      openaiModelId: true,
      // Check if key is set (boolean) without revealing the value
      openaiApiKeyEncrypted: true,
    },
  });

  const isConnected = Boolean(user?.openaiApiKeyEncrypted);
  const currentModelId = user?.openaiModelId ?? null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">
        Configure your OpenAI API key to enable AI-powered camera recommendations.
      </p>

      <section className="border rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">OpenAI Integration</h2>
          <p className="text-sm text-muted-foreground">
            CamTune uses your own OpenAI API key. Your key is encrypted and
            never shared.
          </p>
        </div>

        <OpenAISettingsForm
          isConnected={isConnected}
          currentModelId={currentModelId}
        />
      </section>
    </main>
  );
}
