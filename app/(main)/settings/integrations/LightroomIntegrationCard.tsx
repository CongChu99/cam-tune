"use client";

/**
 * LightroomIntegrationCard
 *
 * Client component that renders the Lightroom connection card in the
 * Integrations settings page. Handles connect / disconnect / re-auth actions.
 */

import { useState, useTransition } from "react";
import type { IntegrationStatus } from "@/lib/integration-service";

interface Props {
  status: IntegrationStatus;
}

export default function LightroomIntegrationCard({ status }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConnect() {
    // Redirect to the OAuth initiation endpoint
    window.location.href = "/api/integrations/lightroom";
  }

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/integrations/lightroom/disconnect", {
          method: "DELETE",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json.error ?? "Failed to disconnect");
          return;
        }
        setCurrentStatus((prev) => ({
          ...prev,
          connected: false,
          needsReauth: false,
          issuedAt: undefined,
        }));
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  const formattedIssuedAt = currentStatus.issuedAt
    ? new Date(currentStatus.issuedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Adobe Lightroom icon placeholder */}
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            Lr
          </div>
          <div>
            <h2 className="text-base font-semibold">Adobe Lightroom</h2>
            <p className="text-sm text-muted-foreground">
              Sync session metadata as XMP sidecar files to your Lightroom catalog.
            </p>
          </div>
        </div>

        {/* Status badge */}
        {!currentStatus.configured ? (
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground flex-shrink-0">
            Not configured
          </span>
        ) : currentStatus.connected ? (
          <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 flex-shrink-0">
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground flex-shrink-0">
            Disconnected
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}

      {!currentStatus.configured && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          Set <code className="font-mono text-xs">ADOBE_CLIENT_ID</code>,{" "}
          <code className="font-mono text-xs">ADOBE_CLIENT_SECRET</code>, and{" "}
          <code className="font-mono text-xs">ADOBE_REDIRECT_URI</code> to enable this
          integration.
        </p>
      )}

      {currentStatus.configured && currentStatus.connected && formattedIssuedAt && (
        <p className="text-sm text-muted-foreground">
          Connected since <span className="font-medium">{formattedIssuedAt}</span>
        </p>
      )}

      {currentStatus.configured && currentStatus.connected && currentStatus.needsReauth && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Your authorization is over 90 days old. Please re-authorize to continue syncing.
          <button
            onClick={handleConnect}
            className="ml-3 underline font-medium hover:no-underline focus:outline-none"
          >
            Re-authorize
          </button>
        </div>
      )}

      {currentStatus.configured && (
        <div className="flex gap-3 pt-1">
          {!currentStatus.connected ? (
            <button
              onClick={handleConnect}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors"
            >
              Connect Lightroom
            </button>
          ) : (
            <>
              {currentStatus.needsReauth && (
                <button
                  onClick={handleConnect}
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors"
                >
                  Re-authorize
                </button>
              )}
              <button
                onClick={handleDisconnect}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors"
              >
                {isPending ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
