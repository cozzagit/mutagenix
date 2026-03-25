"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface BetrayalStrike {
  attackerName: string;
  damage: number;
  description: string;
}

interface BetrayalData {
  totalStatLossPercent: number;
  strikes: BetrayalStrike[];
  traitLosses: Record<string, number>;
  traitorName: string;
  clanName: string;
}

type Phase = "darkness" | "gathering" | "strikes" | "summary" | "exile";

const TRAIT_LABELS: Record<string, string> = {
  attackPower: "Attacco",
  defense: "Difesa",
  speed: "Velocità",
  stamina: "Resistenza",
  specialAttack: "Attacco Speciale",
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function EsecuzioneScene({ betrayalId }: { betrayalId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("darkness");
  const [data, setData] = useState<BetrayalData | null>(null);
  const [currentStrike, setCurrentStrike] = useState(0);
  const [shaking, setShaking] = useState(false);

  // Load betrayal data from sessionStorage (set by the leave action)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`betrayal-${betrayalId}`);
      if (stored) {
        setData(JSON.parse(stored));
        sessionStorage.removeItem(`betrayal-${betrayalId}`);
      } else {
        // Fallback: create minimal data from the betrayalId
        setData({
          totalStatLossPercent: 15,
          strikes: [{ attackerName: "La Famiglia", damage: 0, description: "La Famiglia non perdona i traditori." }],
          traitLosses: {},
          traitorName: "Il Traditore",
          clanName: "La Famiglia",
        });
      }
    } catch {
      setData({
        totalStatLossPercent: 15,
        strikes: [{ attackerName: "La Famiglia", damage: 0, description: "La Famiglia non perdona i traditori." }],
        traitLosses: {},
        traitorName: "Il Traditore",
        clanName: "La Famiglia",
      });
    }
  }, [betrayalId]);

  // Phase transitions
  useEffect(() => {
    if (!data) return;

    if (phase === "darkness") {
      const timer = setTimeout(() => setPhase("gathering"), 2500);
      return () => clearTimeout(timer);
    }
    if (phase === "gathering") {
      const timer = setTimeout(() => setPhase("strikes"), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, data]);

  // Strike animation
  useEffect(() => {
    if (phase !== "strikes" || !data) return;

    if (currentStrike >= data.strikes.length) {
      const timer = setTimeout(() => setPhase("summary"), 1000);
      return () => clearTimeout(timer);
    }

    // Shake effect for each strike
    setShaking(true);
    const shakeTimer = setTimeout(() => setShaking(false), 300);
    const nextTimer = setTimeout(() => setCurrentStrike((s) => s + 1), 800);

    return () => {
      clearTimeout(shakeTimer);
      clearTimeout(nextTimer);
    };
  }, [phase, currentStrike, data]);

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-900 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black px-4 py-8">
      {/* Background vignette */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.9) 100%)",
        }}
      />

      {/* Red ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background: "radial-gradient(ellipse at center, rgba(220,38,38,0.3) 0%, transparent 70%)",
        }}
      />

      {/* PHASE: DARKNESS */}
      {phase === "darkness" && (
        <div className="animate-pulse text-center">
          <p
            className="text-xl font-black uppercase tracking-[0.3em] text-red-600 sm:text-3xl"
            style={{
              textShadow: "0 0 30px rgba(220, 38, 38, 0.6), 0 0 60px rgba(220, 38, 38, 0.3)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            Il Prezzo del Tradimento...
          </p>
        </div>
      )}

      {/* PHASE: GATHERING */}
      {phase === "gathering" && (
        <div className="text-center">
          <p className="mb-4 text-xs uppercase tracking-widest text-red-800">
            I membri di {data.clanName} si radunano...
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {data.strikes.map((strike, i) => (
              <div
                key={i}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-red-900/40 bg-red-950/30 text-[10px] font-bold text-red-400"
                style={{
                  animation: `fadeIn 0.3s ease-out ${i * 0.15}s both`,
                }}
              >
                {strike.attackerName.slice(0, 3)}
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-red-500/80">
            {data.traitorName} &egrave; circondato.
          </p>
        </div>
      )}

      {/* PHASE: STRIKES */}
      {phase === "strikes" && (
        <div className={`text-center ${shaking ? "animate-shake" : ""}`}>
          <div className="mb-6 text-xs uppercase tracking-widest text-red-800">
            Esecuzione in corso
          </div>

          {/* Show all strikes up to current */}
          <div className="mx-auto max-w-sm space-y-2">
            {data.strikes.slice(0, currentStrike).map((strike, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-red-900/30 bg-red-950/20 px-4 py-2"
                style={{ animation: `slideIn 0.3s ease-out` }}
              >
                <span className="text-xs text-red-300">{strike.description}</span>
                {strike.damage > 0 && (
                  <span className="ml-2 shrink-0 text-sm font-black text-red-500">
                    -{strike.damage.toFixed(1)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Current strike flash */}
          {currentStrike < data.strikes.length && shaking && (
            <div
              className="pointer-events-none fixed inset-0 bg-red-600/10"
              style={{ animation: "flash 0.3s ease-out" }}
            />
          )}
        </div>
      )}

      {/* PHASE: SUMMARY */}
      {phase === "summary" && (
        <div className="text-center" style={{ animation: "fadeIn 0.5s ease-out" }}>
          <div className="mb-6">
            <div
              className="text-5xl font-black text-red-600 sm:text-7xl"
              style={{
                textShadow: "0 0 40px rgba(220, 38, 38, 0.5), 0 0 80px rgba(220, 38, 38, 0.2)",
              }}
            >
              -{data.totalStatLossPercent.toFixed(0)}%
            </div>
            <p className="mt-2 text-sm text-red-400">
              capacit&agrave; combat perse permanentemente
            </p>
          </div>

          {/* Trait losses */}
          <div className="mx-auto max-w-xs space-y-1.5">
            {Object.entries(data.traitLosses).map(([trait, loss]) => (
              <div
                key={trait}
                className="flex items-center justify-between rounded-lg border border-red-900/20 bg-red-950/20 px-3 py-1.5"
              >
                <span className="text-xs text-red-300/80">
                  {TRAIT_LABELS[trait] ?? trait}
                </span>
                <span className="text-xs font-bold text-red-500">
                  -{loss.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setPhase("exile")}
            className="mt-8 rounded-lg border border-red-900/30 bg-red-950/30 px-8 py-3 text-sm font-black uppercase tracking-wider text-red-500 transition hover:bg-red-900/30"
          >
            Continua
          </button>
        </div>
      )}

      {/* PHASE: EXILE */}
      {phase === "exile" && (
        <div className="text-center" style={{ animation: "fadeIn 0.8s ease-out" }}>
          <div
            className="mb-6 text-4xl font-black uppercase tracking-[0.4em] text-red-700 sm:text-6xl"
            style={{
              textShadow: "0 0 40px rgba(220, 38, 38, 0.6)",
              animation: "burnIn 1s ease-out",
            }}
          >
            TRADITORE
          </div>

          <p className="mb-2 text-sm text-red-400/80">
            {data.traitorName} porta il marchio del tradimento.
          </p>
          <p className="mb-8 text-xs text-red-800">
            Ex membro di {data.clanName} &mdash; esiliato per sempre.
          </p>

          <button
            onClick={() => router.push("/lab")}
            className="rounded-lg border border-red-900/30 bg-red-950/30 px-8 py-3 text-sm font-black uppercase tracking-wider text-red-500 transition hover:bg-red-900/30 hover:text-red-400"
          >
            Esilio
          </button>
        </div>
      )}

      {/* CSS animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes flash {
          from { opacity: 0.3; }
          to { opacity: 0; }
        }
        @keyframes burnIn {
          0% { opacity: 0; transform: scale(1.5); filter: blur(10px); }
          50% { opacity: 1; filter: blur(3px); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
