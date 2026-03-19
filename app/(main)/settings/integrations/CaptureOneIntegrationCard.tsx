"use client";

/**
 * CaptureOneIntegrationCard
 *
 * Client component that renders the Capture One connection card in the
 * Integrations settings page. Shows install guide when plugin is not configured.
 */

import { useState, useTransition } from "react";
import type { IntegrationStatus } from "@/lib/integration-service";

interface Props {
  status: IntegrationStatus;
  pluginConfigured: boolean;
}

export default function CaptureOneIntegrationCard({ status, pluginConfigured }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/integrations/captureone/disconnect", {
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
          <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            C1
          </div>
          <div>
            <h2 className="text-base font-semibold">Capture One</h2>
            <p className="text-sm text-muted-foreground">
              Sync session metadata directly into your Capture One catalog.
            </p>
          </div>
        </div>

        {!pluginConfigured ? (
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

      {/* Plugin not installed — install guide */}
      {!pluginConfigured && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm dark:bg-amber-950/20">
          <p className="mb-2 font-semibold text-amber-800 dark:text-amber-400">
            Plugin not installed
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-amber-700 dark:text-amber-500">
            <li>Download the CamTune plugin from your account dashboard</li>
            <li>
              Open Capture One → <strong>Script</strong> menu →{" "}
              <strong>Manage Scripts…</strong>
            </li>
            <li>
              Click <strong>Install Plugin</strong> and select the{" "}
              <code className="font-mono text-xs">.coplugin</code> file
            </li>
            <li>Restart Capture One — CamTune appears in the Script menu</li>
            <li>
              Run <strong>Script → CamTune → Connect CamTune Account</strong> and
              authorize in your browser
            </li>
          </ol>
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-500">
            You can skip this integration — it will not affect other CamTune features.
          </p>
        </div>
      )}

      {/* Plugin configured, not connected */}
      {pluginConfigured && !currentStatus.connected && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          Open Capture One and run{" "}
          <strong>Script → CamTune → Connect CamTune Account</strong> to link your
          account.
        </p>
      )}

      {/* Connected */}
      {pluginConfigured && currentStatus.connected && formattedIssuedAt && (
        <p className="text-sm text-muted-foreground">
          Connected since <span className="font-medium">{formattedIssuedAt}</span>
        </p>
      )}

      {pluginConfigured && currentStatus.connected && (
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors"
          >
            {isPending ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      )}
    </div>
  );
}
