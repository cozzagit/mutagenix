"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { useToast } from "@/components/ui/toast";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface CreatureData {
  id: string;
  name: string;
  ageDays: number | null;
  familyGeneration: number | null;
  isFounder: boolean;
  isDead: boolean;
  stability: number | null;
  visualParams: Record<string, unknown>;
  isActive: boolean;
  parentNames: string[] | null;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

interface CreatureSwitcherProps {
  currentCreatureId: string;
}

export function CreatureSwitcher({ currentCreatureId }: CreatureSwitcherProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [creatures, setCreatures] = useState<CreatureData[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [hasMultiple, setHasMultiple] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check on mount if user has multiple creatures
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/creatures");
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data ?? [];
        const alive = data.filter((c: CreatureData) => !c.isDead);
        setHasMultiple(alive.length > 1);
        setCreatures(data);
      } catch {
        // silent
      }
    }
    check();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const fetchCreatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/creatures");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCreatures(json.data ?? []);
    } catch {
      toast("error", "Errore nel caricamento delle creature.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    fetchCreatures();
  }, [fetchCreatures]);

  const handleActivate = useCallback(async (id: string) => {
    setActivating(id);
    try {
      const res = await fetch(`/api/creatures/${id}/activate`, { method: "PATCH" });
      if (!res.ok) {
        const json = await res.json();
        toast("error", json.error?.message ?? "Errore nell'attivazione.");
        return;
      }
      toast("success", "Creatura attivata!");
      setOpen(false);
      router.refresh();
    } catch {
      toast("error", "Errore di rete.");
    } finally {
      setActivating(null);
    }
  }, [toast, router]);

  // Don't render if user has only 1 alive creature
  if (!hasMultiple) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switch icon button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-border/50 text-muted transition-colors hover:border-accent/40 hover:text-accent"
        title="Cambia creatura"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-border/50 bg-surface shadow-xl shadow-black/30">
          <div className="p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 py-1 mb-1">
              Cambia Creatura
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {creatures
                  .filter((c) => !c.isDead)
                  .sort((a, b) => {
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
                    return (b.ageDays ?? 0) - (a.ageDays ?? 0);
                  })
                  .map((c) => {
                    const vp = { ...DEFAULT_VISUAL_PARAMS, ...(c.visualParams as Partial<VisualParams>) } as VisualParams;
                    const isCurrentActive = c.id === currentCreatureId;

                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (!isCurrentActive) handleActivate(c.id);
                        }}
                        disabled={isCurrentActive || activating !== null}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                          isCurrentActive
                            ? "bg-accent/10 border border-accent/30"
                            : "hover:bg-surface-2 border border-transparent"
                        } ${activating === c.id ? "opacity-50" : ""}`}
                      >
                        <div className="shrink-0">
                          <CreatureRenderer params={vp} size={36} animated={false} seed={42} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                          <p className="text-[9px] text-muted">
                            Giorno {c.ageDays ?? 0}
                            {c.familyGeneration && c.familyGeneration > 1 ? ` · Gen ${c.familyGeneration}` : ""}
                          </p>
                        </div>
                        {isCurrentActive && (
                          <span className="shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 text-[8px] font-bold text-accent">
                            ATTIVA
                          </span>
                        )}
                        {activating === c.id && (
                          <div className="shrink-0 h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
