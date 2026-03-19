"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export type CameraSearchResult = {
  id: string;
  brand: string;
  model: string;
  sensorSize: string;
  pixelCountMp: number | null;
  ibis: boolean;
  releaseYear: number | null;
  mount: string | null;
};

type CameraSearchProps = {
  /** Called when the user selects a camera from the dropdown */
  onSelect: (camera: CameraSearchResult) => void;
  /** Called when user clicks "Add manually" or search finds no results */
  onManualEntry?: (query: string) => void;
  placeholder?: string;
  className?: string;
};

const SENSOR_SIZE_LABELS: Record<string, string> = {
  FULL_FRAME: "Full Frame",
  APS_C: "APS-C",
  MFT: "MFT",
  ONE_INCH: "1-inch",
  MEDIUM_FORMAT: "Medium Format",
  OTHER: "Other",
};

export function CameraSearch({
  onSelect,
  onManualEntry,
  placeholder = "Search camera model (e.g. Sony A7 IV)…",
  className,
}: CameraSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CameraSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/cameras/search?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.cameras ?? []);
      setHasSearched(true);
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleSelect = (camera: CameraSearchResult) => {
    onSelect(camera);
    setQuery(`${camera.brand} ${camera.model}`);
    setIsOpen(false);
  };

  const handleManualEntry = () => {
    onManualEntry?.(query);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || hasSearched) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
          )}
          autoComplete="off"
          spellCheck={false}
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </span>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
          {results.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
              {results.map((camera) => (
                <li key={camera.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => handleSelect(camera)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-xs font-medium text-muted-foreground">
                        {camera.brand}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {camera.model}
                      </span>
                    </div>
                    <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1">
                      {camera.sensorSize && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {SENSOR_SIZE_LABELS[camera.sensorSize] ??
                            camera.sensorSize}
                        </span>
                      )}
                      {camera.ibis && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          IBIS
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            hasSearched &&
            !isLoading && (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No cameras found for &ldquo;{query}&rdquo;
                </p>
                {onManualEntry && (
                  <button
                    type="button"
                    onClick={handleManualEntry}
                    className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Add &ldquo;{query}&rdquo; manually
                  </button>
                )}
              </div>
            )
          )}

          {/* Always show manual entry option at bottom */}
          {results.length > 0 && onManualEntry && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={handleManualEntry}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Not listed? Add manually
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
