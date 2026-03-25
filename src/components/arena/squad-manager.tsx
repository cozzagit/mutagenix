"use client";

import { useState, useEffect, useCallback } from "react";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface SquadCreature {
  id: string;
  name: string;
  ageDays: number | null;
  attackPower: number;
  defense: number;
  speed: number;
  stamina?: number;
  specialAttack?: number;
  visualParams: Record<string, unknown>;
  wellness?: { activity: number; hunger: number; boredom: number; fatigue: number; composite: number };
}

interface SquadData {
  starters: (SquadCreature | null)[];
  reserves: (SquadCreature | null)[];
  autoRotate: boolean;
}

/* ------------------------------------------------------------------ */
/* Sub: WellnessDots                                                  */
/* ------------------------------------------------------------------ */

function WellnessDots({ wellness }: { wellness?: SquadCreature["wellness"] }) {
  if (!wellness) return null;
  const indicators = [
    { key: "activity" as const, icon: "\u26A1" },
    { key: "hunger" as const, icon: "\uD83E\uDDEA" },
    { key: "boredom" as const, icon: "\u2694\uFE0F" },
    { key: "fatigue" as const, icon: "\uD83D\uDCA4" },
  ] as const;

  return (
    <div className="flex items-center gap-1">
      {indicators.map((ind) => {
        const val = wellness[ind.key];
        const col = val >= 70 ? "#00e5a0" : val >= 40 ? "#ff9100" : "#ff3d3d";
        return (
          <span
            key={ind.key}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: col, boxShadow: `0 0 4px ${col}66` }}
            title={`${ind.icon} ${val}%`}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: CreatureSlot                                                   */
/* ------------------------------------------------------------------ */

function CreatureSlot({
  creature,
  type,
  onRemove,
  onAdd,
}: {
  creature: SquadCreature | null;
  type: "starter" | "reserve";
  onRemove: () => void;
  onAdd: () => void;
}) {
  const isStarter = type === "starter";
  const size = isStarter ? 70 : 55;

  if (!creature) {
    return (
      <button
        onClick={onAdd}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all hover:border-primary/50 hover:bg-primary/5 ${
          isStarter
            ? "border-primary/30 bg-surface/60 min-h-[160px] p-4"
            : "border-border/20 bg-surface/30 min-h-[130px] p-3 opacity-70"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className={`text-muted mb-1 ${isStarter ? "h-8 w-8" : "h-6 w-6"}`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        <span className="text-[10px] text-muted font-medium">Aggiungi</span>
      </button>
    );
  }

  const vp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  return (
    <div
      className={`flex flex-col items-center rounded-xl border transition-all ${
        isStarter
          ? "border-primary/30 bg-surface/60 p-3 min-h-[160px]"
          : "border-border/20 bg-surface/30 p-2.5 min-h-[130px] opacity-70 hover:opacity-100"
      }`}
    >
      <CreatureRenderer params={vp} size={size} animated={false} />
      <p
        className={`font-bold truncate max-w-full text-center leading-tight mt-1 ${
          isStarter ? "text-xs text-foreground" : "text-[10px] text-muted"
        }`}
      >
        {creature.name}
      </p>

      {/* Key stats as mini bars */}
      <div className="flex flex-col gap-0.5 mt-1 w-full">
        {[
          { label: 'ATK', value: Math.round(creature.attackPower), color: '#ff3d3d' },
          { label: 'DEF', value: Math.round(creature.defense), color: '#3d5afe' },
          { label: 'SPD', value: Math.round(creature.speed), color: '#00e5e5' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1">
            <span className="text-[7px] font-bold w-5" style={{ color: s.color }}>{s.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.value)}%`, backgroundColor: s.color, boxShadow: `0 0 4px ${s.color}44` }} />
            </div>
            <span className="text-[7px] font-mono text-muted w-4 text-right">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Wellness */}
      <div className="mt-1">
        <WellnessDots wellness={creature.wellness} />
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="mt-1.5 text-[9px] text-danger/60 hover:text-danger transition-colors font-medium"
      >
        Rimuovi
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: CreatureSelector                                              */
/* ------------------------------------------------------------------ */

function CreatureSelector({
  available,
  onSelect,
  onClose,
}: {
  available: SquadCreature[];
  onSelect: (creature: SquadCreature) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm p-0 md:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-border/50 bg-surface p-5 md:p-6 max-h-[85dvh] overflow-y-auto md:my-auto md:max-h-[90dvh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">
            Seleziona Creatura
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:text-foreground transition-colors"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {available.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-surface-2 p-6 text-center">
            <p className="text-sm text-muted">
              Nessuna creatura disponibile.
            </p>
            <p className="text-[10px] text-muted mt-1">
              Tutte le tue creature sono gia in squadra, morte o archiviate.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {available.map((c) => {
              const vp = {
                ...DEFAULT_VISUAL_PARAMS,
                ...(c.visualParams as Partial<VisualParams>),
              } as VisualParams;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className="flex items-center gap-3 rounded-lg border border-border/30 bg-surface-2/50 px-3 py-2.5 hover:border-primary/40 hover:bg-surface-2 transition-all text-left"
                >
                  <CreatureRenderer
                    params={vp}
                    size={50}
                    animated={false}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {c.name}
                    </p>
                    <p className="text-[10px] text-muted">
                      Giorno {c.ageDays ?? 0}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {[
                        { l: 'ATK', v: Math.round(c.attackPower), col: '#ff3d3d' },
                        { l: 'DEF', v: Math.round(c.defense), col: '#3d5afe' },
                        { l: 'SPD', v: Math.round(c.speed), col: '#00e5e5' },
                      ].map(s => (
                        <div key={s.l} className="flex items-center gap-0.5">
                          <span className="text-[7px] font-bold" style={{ color: s.col }}>{s.l}</span>
                          <span className="text-[8px] font-mono text-muted">{s.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <WellnessDots wellness={c.wellness} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main: SquadManager                                                 */
/* ------------------------------------------------------------------ */

export function SquadManager() {
  const { toast } = useToast();
  const [squad, setSquad] = useState<SquadData>({
    starters: [null, null, null],
    reserves: [null, null, null],
    autoRotate: true,
  });
  const [available, setAvailable] = useState<SquadCreature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<{
    type: "starter" | "reserve";
    index: number;
  } | null>(null);
  const [autoRotating, setAutoRotating] = useState(false);

  // Fetch squad data
  const fetchSquad = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/arena/squad");
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.data) {
        setSquad({
          starters: json.data.starters ?? [null, null, null],
          reserves: json.data.reserves ?? [null, null, null],
          autoRotate: json.data.autoRotate ?? true,
        });
        setAvailable(json.data.available ?? []);
      }
    } catch {
      toast("error", "Errore nel caricamento della squadra.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSquad();
  }, [fetchSquad]);

  // Save squad
  const saveSquad = useCallback(async () => {
    setSaving(true);
    try {
      const body = {
        starters: squad.starters.map((c) => c?.id ?? null),
        reserves: squad.reserves.map((c) => c?.id ?? null),
        autoRotate: squad.autoRotate,
      };
      const res = await fetch("/api/arena/squad", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message ?? "Errore nel salvataggio");
      }
      toast("success", "Squadra salvata!");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Errore nel salvataggio della squadra.");
    } finally {
      setSaving(false);
    }
  }, [squad, toast]);

  // Auto-rotate
  const handleAutoRotate = useCallback(async () => {
    setAutoRotating(true);
    try {
      const res = await fetch("/api/arena/squad/auto-rotate", {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.data) {
        // Auto-rotate returned suggested starters — save them immediately
        const newStarters = json.data.starters ?? [];
        const saveBody = {
          starters: newStarters.map((c: SquadCreature | null) => c?.id ?? null),
          reserves: squad.reserves.map((c) => c?.id ?? null),
          autoRotate: squad.autoRotate,
        };
        const saveRes = await fetch("/api/arena/squad", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
        if (saveRes.ok) {
          toast("success", "Squadra auto-selezionata e salvata!");
          // Reload full squad data from server to sync state
          await fetchSquad();
        } else {
          // Still update local state even if save fails
          setSquad((prev) => ({
            ...prev,
            starters: newStarters,
          }));
          setAvailable(json.data.available ?? []);
          toast("info", "Titolari selezionati (salva per confermare).");
        }
      }
    } catch {
      toast("error", "Errore nella rotazione automatica.");
    } finally {
      setAutoRotating(false);
    }
  }, [toast]);

  // Handle creature assignment
  const handleSelect = useCallback(
    (creature: SquadCreature) => {
      if (!selectorTarget) return;
      const { type, index } = selectorTarget;

      setSquad((prev) => {
        const newSquad = { ...prev };
        if (type === "starter") {
          const starters = [...prev.starters];
          starters[index] = creature;
          newSquad.starters = starters;
        } else {
          const reserves = [...prev.reserves];
          reserves[index] = creature;
          newSquad.reserves = reserves;
        }
        return newSquad;
      });

      // Remove from available
      setAvailable((prev) => prev.filter((c) => c.id !== creature.id));
      setSelectorTarget(null);
    },
    [selectorTarget]
  );

  // Handle remove
  const handleRemove = useCallback(
    (type: "starter" | "reserve", index: number) => {
      setSquad((prev) => {
        const newSquad = { ...prev };
        const slot =
          type === "starter" ? prev.starters[index] : prev.reserves[index];

        if (type === "starter") {
          const starters = [...prev.starters];
          starters[index] = null;
          newSquad.starters = starters;
        } else {
          const reserves = [...prev.reserves];
          reserves[index] = null;
          newSquad.reserves = reserves;
        }

        // Add back to available
        if (slot) {
          setAvailable((a) => [...a, slot]);
        }
        return newSquad;
      });
    },
    []
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-48 rounded bg-surface-2 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl bg-surface-2 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-surface-2 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-base font-black text-foreground tracking-tight">
          La Tua Squadra
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Seleziona 3 titolari e fino a 3 riserve per le battaglie a squadre
        </p>
      </div>

      {/* Auto-rotate toggle + button */}
      <div className="flex items-center justify-between mb-5 rounded-lg bg-surface-2/50 border border-border/20 px-4 py-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={squad.autoRotate}
            onChange={(e) =>
              setSquad((prev) => ({ ...prev, autoRotate: e.target.checked }))
            }
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          <span className="text-xs text-muted">Rotazione automatica</span>
        </label>

        <button
          onClick={handleAutoRotate}
          disabled={autoRotating}
          className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
          </svg>
          {autoRotating ? "..." : "Auto-seleziona"}
        </button>
      </div>

      {/* Starters */}
      <div className="mb-2">
        <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">
          Titolari
        </h3>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {squad.starters.map((creature, i) => (
            <CreatureSlot
              key={`starter-${i}`}
              creature={creature}
              type="starter"
              onRemove={() => handleRemove("starter", i)}
              onAdd={() => setSelectorTarget({ type: "starter", index: i })}
            />
          ))}
        </div>
      </div>

      {/* Reserves */}
      <div className="mb-5">
        <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 mt-4">
          Riserve
        </h3>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {squad.reserves.map((creature, i) => (
            <CreatureSlot
              key={`reserve-${i}`}
              creature={creature}
              type="reserve"
              onRemove={() => handleRemove("reserve", i)}
              onAdd={() => setSelectorTarget({ type: "reserve", index: i })}
            />
          ))}
        </div>
      </div>

      {/* Save button */}
      <Button
        variant="accent"
        size="md"
        fullWidth
        onClick={saveSquad}
        loading={saving}
        className="!font-black !uppercase !tracking-wider"
      >
        Salva Squadra
      </Button>

      {/* Creature selector modal */}
      {selectorTarget && (
        <CreatureSelector
          available={available}
          onSelect={handleSelect}
          onClose={() => setSelectorTarget(null)}
        />
      )}
    </div>
  );
}
