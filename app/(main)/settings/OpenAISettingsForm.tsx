"use client";

import { useState, useEffect, useCallback } from "react";

interface ModelInfo {
  id: string;
  created: number;
}

interface Props {
  isConnected: boolean;
  currentModelId: string | null;
}

type Provider = "openai" | "ollama";

export function OpenAISettingsForm({ isConnected, currentModelId }: Props) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(currentModelId ?? "");
  const [connected, setConnected] = useState(isConnected);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const fetchModels = useCallback(async () => {
    if (!connected) return;
    try {
      const res = await fetch("/api/auth/openai/models");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.models)) {
        setModels(data.models);
        if (!selectedModel && data.modelId) setSelectedModel(data.modelId);
      }
    } catch {
      // non-critical
    }
  }, [connected, selectedModel]);

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    setError(null);
    const keyToSend = provider === "ollama" ? "ollama" : apiKey.trim();

    if (provider === "openai" && !keyToSend) {
      setError("Vui lòng nhập OpenAI API key.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/openai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToSend }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kết nối thất bại.");
        return;
      }
      setModels(data.models ?? []);
      setSelectedModel(data.modelId ?? data.models?.[0]?.id ?? "");
      setConnected(true);
      setApiKey("");
    } catch {
      setError("Lỗi mạng — thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleModelChange(modelId: string) {
    setSelectedModel(modelId);
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/auth/openai/model", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("idle");
      }
    } catch {
      setSaveStatus("idle");
    }
  }

  async function handleDisconnect() {
    try {
      const res = await fetch("/api/auth/openai/disconnect", { method: "DELETE" });
      if (res.ok) {
        setConnected(false);
        setModels([]);
        setSelectedModel("");
        setApiKey("");
        setError(null);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5">
      {/* Provider tabs */}
      {!connected && (
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
          {(["openai", "ollama"] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setProvider(p); setError(null); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                provider === p
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "openai" ? "OpenAI" : "Ollama (local)"}
            </button>
          ))}
        </div>
      )}

      {/* Connection status */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">
          {connected ? `Đã kết nối` : "Chưa kết nối"}
        </span>
      </div>

      {/* Input section */}
      {!connected && (
        <div className="space-y-3">
          {provider === "openai" ? (
            <div className="space-y-2">
              <label htmlFor="apiKey" className="block text-sm font-medium">
                OpenAI API Key
              </label>
              <div className="flex gap-2">
                <input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
                  disabled={loading}
                  className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={handleConnect}
                  disabled={loading || !apiKey.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Đang kết nối…" : "Kết nối"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Key được mã hoá AES-256-GCM, không bao giờ lưu dạng plaintext.{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                  Lấy API key
                </a>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Kết nối Ollama đang chạy tại <code className="bg-muted px-1 rounded">localhost:11434</code>.
                Đảm bảo Ollama đã được khởi động và có ít nhất một model hỗ trợ vision (vd: <code className="bg-muted px-1 rounded">llava</code>).
              </p>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Đang kết nối…" : "Kết nối Ollama"}
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}
        </div>
      )}

      {/* Model selection */}
      {connected && models.length > 0 && (
        <div className="space-y-2">
          <label htmlFor="model" className="block text-sm font-medium">
            Model AI
          </label>
          <div className="flex items-center gap-3">
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))}
            </select>
            {saveStatus === "saving" && <span className="text-xs text-muted-foreground">Đang lưu…</span>}
            {saveStatus === "saved" && <span className="text-xs text-green-600">Đã lưu</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {connected && models.some(m => m.id === "ollama")
              ? "Tất cả model đang có trong Ollama."
              : "Chỉ hiện model hỗ trợ Vision."}
          </p>
        </div>
      )}

      {connected && models.length === 0 && (
        <p className="text-sm text-yellow-600">
          Không tìm thấy model nào. Với Ollama, hãy pull model vision trước:{" "}
          <code className="bg-muted px-1 rounded">ollama pull llava</code>
        </p>
      )}

      {/* Disconnect */}
      {connected && (
        <div className="pt-2 border-t">
          <button onClick={handleDisconnect} className="text-sm text-red-600 hover:underline">
            Ngắt kết nối
          </button>
        </div>
      )}
    </div>
  );
}
