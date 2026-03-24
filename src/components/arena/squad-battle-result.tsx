"use client";

import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface DuelResult {
  myCreature: {
    name: string;
    visualParams: Record<string, unknown>;
    hpPercent: number;
  };
  opponentCreature: {
    name: string;
    visualParams: Record<string, unknown>;
    hpPercent: number;
  };
  result: "win" | "loss" | "draw";
  kinshipPenalty?: number; // e.g. -12
  clanBonus?: number; // e.g. +8
}

export interface SquadBattleResultData {
  overallResult: "victory" | "defeat" | "draw";
  myScore: number;
  opponentScore: number;
  duels: DuelResult[];
  rewards?: {
    farmingAxp?: number;
    energy?: number;
  };
}

/* ------------------------------------------------------------------ */
/* Sub: HP bar                                                        */
/* ------------------------------------------------------------------ */

function HpBar({ percent, side }: { percent: number; side: "left" | "right" }) {
  const color =
    percent >= 60 ? "bg-accent" : percent >= 30 ? "bg-warning" : "bg-danger";
  return (
    <div
      className={`h-1 w-16 rounded-full bg-surface-2 overflow-hidden ${
        side === "right" ? "ml-auto" : ""
      }`}
    >
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: DuelRow                                                       */
/* ------------------------------------------------------------------ */

function DuelRow({ duel, index }: { duel: DuelResult; index: number }) {
  const myVp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(duel.myCreature.visualParams as Partial<VisualParams>),
  } as VisualParams;
  const oppVp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(duel.opponentCreature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  const resultIcon =
    duel.result === "win" ? (
      <span className="text-accent font-black text-sm">&#10003;</span>
    ) : duel.result === "loss" ? (
      <span className="text-danger font-black text-sm">&#10007;</span>
    ) : (
      <span className="text-warning font-black text-sm">~</span>
    );

  const resultColor =
    duel.result === "win"
      ? "border-accent/30"
      : duel.result === "loss"
      ? "border-danger/30"
      : "border-warning/30";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border ${resultColor} bg-surface-2/50 px-3 py-2.5 transition-all`}
    >
      {/* Duel number */}
      <span className="text-[10px] text-muted font-mono shrink-0 w-4">
        {index + 1}
      </span>

      {/* My creature */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <CreatureRenderer params={myVp} size={50} animated={false} />
        <p className="text-[9px] text-muted truncate max-w-[60px]">
          {duel.myCreature.name}
        </p>
        <HpBar percent={duel.myCreature.hpPercent} side="left" />
      </div>

      {/* VS + badges */}
      <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
        <span className="text-[10px] font-black text-muted">VS</span>
        {resultIcon}

        {/* Badges */}
        <div className="flex flex-col items-center gap-0.5">
          {duel.kinshipPenalty && (
            <span className="text-[8px] font-bold text-danger bg-danger/10 rounded px-1 py-0.5">
              Parentela {duel.kinshipPenalty}%
            </span>
          )}
          {duel.clanBonus && (
            <span className="text-[8px] font-bold text-accent bg-accent/10 rounded px-1 py-0.5">
              Clan +{duel.clanBonus}%
            </span>
          )}
        </div>
      </div>

      {/* Opponent creature */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div style={{ transform: "scaleX(-1)" }}>
          <CreatureRenderer params={oppVp} size={50} animated={false} />
        </div>
        <p className="text-[9px] text-muted truncate max-w-[60px]">
          {duel.opponentCreature.name}
        </p>
        <HpBar percent={duel.opponentCreature.hpPercent} side="right" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main: SquadBattleResult                                            */
/* ------------------------------------------------------------------ */

export function SquadBattleResult({
  data,
  onClose,
}: {
  data: SquadBattleResultData;
  onClose: () => void;
}) {
  const isVictory = data.overallResult === "victory";
  const isDraw = data.overallResult === "draw";

  const bannerLabel = isVictory
    ? `VITTORIA SQUADRA ${data.myScore}-${data.opponentScore}`
    : isDraw
    ? `PAREGGIO ${data.myScore}-${data.opponentScore}`
    : `SCONFITTA SQUADRA ${data.myScore}-${data.opponentScore}`;

  const bannerColor = isVictory
    ? "text-accent"
    : isDraw
    ? "text-warning"
    : "text-danger";

  const bannerGlow = isVictory
    ? "glow-green"
    : isDraw
    ? "glow-orange"
    : "glow-red";

  const bannerBorder = isVictory
    ? "border-accent/30"
    : isDraw
    ? "border-warning/30"
    : "border-danger/30";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm p-0 md:p-4">
      <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-border/50 bg-surface p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        {/* Banner */}
        <div
          className={`rounded-xl border ${bannerBorder} bg-surface-2 p-4 mb-4 text-center`}
        >
          <h2
            className={`text-xl font-black ${bannerColor} ${bannerGlow} tracking-tight`}
          >
            {bannerLabel}
          </h2>
          {data.rewards && (
            <div className="flex items-center justify-center gap-3 mt-2">
              {data.rewards.farmingAxp && (
                <span className="text-xs text-accent font-bold">
                  +{data.rewards.farmingAxp} Farming AXP
                </span>
              )}
              {data.rewards.energy && (
                <span className="text-xs text-primary font-bold">
                  +{data.rewards.energy} Energia
                </span>
              )}
            </div>
          )}
        </div>

        {/* Duel rows */}
        <div className="flex flex-col gap-2 mb-4">
          {data.duels.map((duel, i) => (
            <DuelRow key={i} duel={duel} index={i} />
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-surface-2 px-4 py-2.5 text-xs font-bold text-foreground uppercase tracking-wider hover:bg-surface-3 transition-colors"
        >
          CHIUDI
        </button>
      </div>
    </div>
  );
}
