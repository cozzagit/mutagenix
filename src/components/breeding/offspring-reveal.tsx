"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface OffspringData {
  creatureId: string;
  name: string;
  stability: number;
  familyGeneration: number;
  visualParams: Record<string, unknown>;
  inheritedTraits?: string[];
}

interface BreedingResult {
  breedingId: string;
  offspringA: OffspringData;
  offspringB: OffspringData | null;
  anomalies: string[];
  parentA?: { name: string; visualParams: Record<string, unknown> };
  parentB?: { name: string; visualParams: Record<string, unknown> };
}

type RevealPhase = "loading" | "fusion" | "parents" | "flash" | "reveal" | "error";

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

interface OffspringRevealProps {
  breedingId: string;
}

export function OffspringReveal({ breedingId }: OffspringRevealProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [phase, setPhase] = useState<RevealPhase>("loading");
  const [data, setData] = useState<BreedingResult | null>(null);
  const [offspringName, setOffspringName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Fetch breeding result
  useEffect(() => {
    async function fetchResult() {
      try {
        // The accept endpoint already returned the data, but we need it via the breeding record
        // Try getting it from a dedicated endpoint or use what was passed
        const res = await fetch(`/api/breeding/requests/${breedingId}/result`);
        if (!res.ok) {
          // Fallback: the ID might be used directly with the accept response stored
          setPhase("error");
          return;
        }
        const json = await res.json();
        setData(json.data);
        setPhase("fusion");
      } catch {
        setPhase("error");
      }
    }
    fetchResult();
  }, [breedingId]);

  // Phase transitions
  useEffect(() => {
    if (phase === "fusion") {
      const timer = setTimeout(() => setPhase("parents"), 2000);
      return () => clearTimeout(timer);
    }
    if (phase === "parents") {
      const timer = setTimeout(() => setPhase("flash"), 3000);
      return () => clearTimeout(timer);
    }
    if (phase === "flash") {
      const timer = setTimeout(() => setPhase("reveal"), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleSaveName = useCallback(async () => {
    if (!data || !offspringName.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/creatures/${data.offspringA.creatureId}/name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: offspringName.trim() }),
      });
      if (!res.ok) {
        toast("error", "Errore nel salvataggio del nome.");
        return;
      }
      toast("success", "Nome salvato!");
    } catch {
      toast("error", "Errore di rete.");
    } finally {
      setSavingName(false);
    }
  }, [data, offspringName, toast]);

  // Error state
  if (phase === "error") {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted mb-4">Impossibile caricare il risultato dell&apos;accoppiamento.</p>
          <Button variant="secondary" size="sm" onClick={() => router.push("/breeding")}>
            Torna al Laboratorio DNA
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (phase === "loading" || !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted">Caricamento...</p>
        </div>
      </div>
    );
  }

  const offspringVp = { ...DEFAULT_VISUAL_PARAMS, ...(data.offspringA.visualParams as Partial<VisualParams>) } as VisualParams;
  const parentAVp = data.parentA
    ? ({ ...DEFAULT_VISUAL_PARAMS, ...(data.parentA.visualParams as Partial<VisualParams>) } as VisualParams)
    : DEFAULT_VISUAL_PARAMS;
  const parentBVp = data.parentB
    ? ({ ...DEFAULT_VISUAL_PARAMS, ...(data.parentB.visualParams as Partial<VisualParams>) } as VisualParams)
    : DEFAULT_VISUAL_PARAMS;

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-120px) scale(0.8); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(120px) scale(0.8); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes pulseGlow {
          0%, 100% { text-shadow: 0 0 20px rgba(0, 229, 160, 0.4); }
          50% { text-shadow: 0 0 40px rgba(0, 229, 160, 0.8), 0 0 60px rgba(0, 229, 160, 0.3); }
        }
        @keyframes flash {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes scaleReveal {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes particle {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
        }
        .anim-fade-in { animation: fadeIn 0.8s ease-out forwards; }
        .anim-slide-left { animation: slideInLeft 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .anim-slide-right { animation: slideInRight 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .anim-pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        .anim-flash { animation: flash 1.5s ease-out forwards; }
        .anim-scale-reveal { animation: scaleReveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .anim-float { animation: float 3s ease-in-out infinite; }
        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #00e5a0;
          animation: particle 1.5s ease-out forwards;
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background overflow-y-auto">
        <div className="w-full max-w-2xl px-4 py-8">
          {/* Phase 1: Fusion text */}
          {phase === "fusion" && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] anim-fade-in">
              <div className="relative">
                {/* DNA helix icon */}
                <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16 text-accent mb-6 mx-auto opacity-60">
                  <path d="M20 8c0 12 24 12 24 24s-24 12-24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M44 8c0 12-24 12-24 24s24 12 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
                  <line x1="20" y1="20" x2="44" y2="20" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                  <line x1="20" y1="32" x2="44" y2="32" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                  <line x1="20" y1="44" x2="44" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                </svg>
                <h1 className="text-2xl md:text-3xl font-black text-accent text-center anim-pulse-glow">
                  Fusione Genetica in Corso...
                </h1>
                <p className="text-xs text-muted text-center mt-3">
                  Ricombinazione del DNA in atto
                </p>
              </div>
              {/* Animated dots */}
              <div className="flex gap-2 mt-8">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-accent"
                    style={{
                      animation: `pulseGlow 1.5s ease-in-out ${i * 0.2}s infinite`,
                      opacity: 0.3 + i * 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Phase 2: Parents approaching */}
          {phase === "parents" && (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="flex items-center justify-center gap-6 md:gap-12">
                {/* Parent A */}
                <div className="text-center anim-slide-left">
                  <CreatureRenderer params={parentAVp} size={140} animated />
                  <p className="text-xs text-muted mt-2">{data.parentA?.name ?? "Genitore A"}</p>
                </div>

                {/* Center particles */}
                <div className="relative w-12 h-12">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const angle = (i / 8) * Math.PI * 2;
                    return (
                      <div
                        key={i}
                        className="particle"
                        style={{
                          left: "50%",
                          top: "50%",
                          "--tx": `${Math.cos(angle) * 30}px`,
                          "--ty": `${Math.sin(angle) * 30}px`,
                          animationDelay: `${i * 0.15}s`,
                          animationIterationCount: "infinite",
                        } as React.CSSProperties}
                      />
                    );
                  })}
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-accent">
                    +
                  </span>
                </div>

                {/* Parent B */}
                <div className="text-center anim-slide-right">
                  <div style={{ transform: "scaleX(-1)" }}>
                    <CreatureRenderer params={parentBVp} size={140} animated />
                  </div>
                  <p className="text-xs text-muted mt-2">{data.parentB?.name ?? "Genitore B"}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-foreground mt-8 anim-fade-in">
                Combinazione dei genomi...
              </p>
            </div>
          )}

          {/* Phase 3: Flash */}
          {phase === "flash" && (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              {/* White flash overlay */}
              <div className="fixed inset-0 bg-white/20 anim-flash pointer-events-none" />
              <h2 className="text-3xl md:text-4xl font-black text-accent text-center anim-fade-in anim-pulse-glow">
                DNA Ricombinato!
              </h2>
              <p className="text-sm text-muted text-center mt-3 anim-fade-in" style={{ animationDelay: "0.5s" }}>
                Una nuova creatura sta emergendo...
              </p>
            </div>
          )}

          {/* Phase 4: Reveal */}
          {phase === "reveal" && (
            <div className="flex flex-col items-center anim-fade-in">
              {/* Offspring creature */}
              <div className="anim-scale-reveal mb-6">
                <div
                  className="anim-float"
                  style={{
                    filter: `drop-shadow(0 0 20px rgba(0, 229, 160, 0.4)) drop-shadow(0 0 40px rgba(0, 229, 160, 0.2))`,
                  }}
                >
                  <CreatureRenderer params={offspringVp} size={280} animated />
                </div>
              </div>

              {/* Name */}
              <h2 className="text-xl font-black text-foreground mb-1">
                {data.offspringA.name}
              </h2>
              <p className="text-xs text-muted mb-4">
                Generazione {data.offspringA.familyGeneration} &middot; Stabilit&agrave; {Math.round(data.offspringA.stability * 100)}%
              </p>

              {/* Inherited traits */}
              {data.offspringA.inheritedTraits && data.offspringA.inheritedTraits.length > 0 && (
                <div className="rounded-xl border border-border/30 bg-surface-2 p-4 mb-4 w-full max-w-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                    Tratti Ereditati
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {data.offspringA.inheritedTraits.map((trait) => (
                      <span
                        key={trait}
                        className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Anomalies */}
              {data.anomalies && data.anomalies.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 mb-4 w-full max-w-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-warning mb-2">
                    Anomalie Genetiche
                  </h3>
                  <ul className="space-y-1">
                    {data.anomalies.map((anomaly, i) => (
                      <li key={i} className="text-xs text-warning/90 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5 text-warning">&#9888;</span>
                        {anomaly}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Name input */}
              <div className="w-full max-w-sm mb-6">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 block">
                  Dai un Nome alla Creatura
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={offspringName}
                    onChange={(e) => setOffspringName(e.target.value)}
                    placeholder={data.offspringA.name}
                    maxLength={30}
                    className="flex-1 rounded-lg border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
                  />
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={handleSaveName}
                    loading={savingName}
                    disabled={!offspringName.trim()}
                  >
                    SALVA
                  </Button>
                </div>
              </div>

              {/* Second offspring */}
              {data.offspringB && (
                <div className="rounded-xl border border-border/30 bg-surface/80 p-4 mb-6 w-full max-w-sm text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Seconda prole (partner)</p>
                  <div className="flex justify-center mb-2">
                    <CreatureRenderer
                      params={{ ...DEFAULT_VISUAL_PARAMS, ...(data.offspringB.visualParams as Partial<VisualParams>) } as VisualParams}
                      size={100}
                      animated
                    />
                  </div>
                  <p className="text-sm font-bold text-foreground">{data.offspringB.name}</p>
                  <p className="text-[10px] text-muted">Gen {data.offspringB.familyGeneration}</p>
                </div>
              )}

              {/* Back link */}
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.push("/breeding")}
              >
                Torna al Laboratorio DNA
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
