"use client";

import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { Button } from "@/components/ui/button";
import { TierBadge, AxpBadge } from "./warrior-card";
import { CaricaBadge } from "@/components/cariche/carica-badge";

export interface OpponentData {
  creatureId: string;
  name: string;
  ageDays: number | null;
  ownerName: string;
  tier: string;
  eloRating: number;
  wins: number;
  losses: number;
  winStreak: number;
  attackPower: number;
  defense: number;
  speed: number;
  stamina: number;
  hp: number;
  visualParams: Record<string, unknown>;
  axpTier: string; // Recluta, Esperto, Veterano, Maestro
  cariche?: string[];
  isBot?: boolean;
  stability?: number; // 0-1, opponent stability
  wellness?: { activity: number; hunger: number; boredom: number; fatigue: number; composite: number };
}

interface OpponentCardProps {
  opponent: OpponentData;
  disabled?: boolean;
  onChallenge: (creatureId: string) => void;
}

/** Thin stat bar — no labels, just color fill proportional to max (~80) */
function MiniStatBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / 80) * 100));
  return (
    <div className="flex-1">
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Win/loss mini progress bar */
function WinLossBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) {
    return (
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden w-full" />
    );
  }
  const winPct = (wins / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-danger/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${winPct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted shrink-0">
        <span className="text-accent">{wins}V</span>{" "}
        <span className="text-danger">{losses}S</span>
      </span>
    </div>
  );
}

export function OpponentCard({ opponent, disabled = false, onChallenge }: OpponentCardProps) {
  const vp = { ...DEFAULT_VISUAL_PARAMS, ...(opponent.visualParams as Partial<VisualParams>) } as VisualParams;

  return (
    <div className="group flex flex-col rounded-xl border border-border/50 bg-surface/80 p-3 transition-all hover:border-danger/40 hover:bg-surface">
      {/* Cariche badges — above creature for consistent alignment */}
      <div className="flex items-center justify-center gap-1 mb-1 min-h-[30px]">
        {opponent.cariche && opponent.cariche.length > 0 && opponent.cariche.map((cId) => (
          <CaricaBadge key={cId} caricaId={cId} compact />
        ))}
      </div>

      {/* Creature centered */}
      <div className="flex justify-center mb-2">
        <CreatureRenderer params={vp} size={90} animated={false} seed={42} />
      </div>

      {/* Name */}
      <p className="text-sm font-bold text-foreground truncate text-center leading-tight">
        {opponent.name}
      </p>

      {/* Owner + day */}
      <p className="text-[10px] text-muted truncate text-center mb-2">
        {opponent.ownerName}
        {opponent.isBot && (
          <span className="ml-1 rounded-sm bg-surface-3 px-1 py-0.5 text-[7px] font-bold text-muted/60 uppercase">Bot</span>
        )}
        {' '}· Giorno {opponent.ageDays ?? 0}
      </p>

      {/* Tier + AXP + stability badges */}
      <div className="flex items-center justify-center gap-1 mb-2 flex-wrap">
        <TierBadge tier={opponent.tier} />
        <AxpBadge axpTier={opponent.axpTier} />
        {opponent.stability !== undefined && opponent.stability < 0.4 && (
          <span className="rounded-sm bg-warning/15 px-1 py-0.5 text-[8px] font-bold text-warning">⚠</span>
        )}
      </div>

      {/* ELO prominent */}
      <div className="flex items-center justify-center gap-1 mb-2">
        <span className="text-bio-cyan text-xs">&#9889;</span>
        <span className="text-base font-black font-mono text-foreground tracking-tight">
          {opponent.eloRating}
        </span>
      </div>

      {/* Win/loss bar */}
      <div className="mb-2.5">
        <WinLossBar wins={opponent.wins} losses={opponent.losses} />
      </div>

      {/* Stat bars — 3 thin bars with tiny icons below */}
      <div className="flex items-center gap-1.5 mb-1">
        <MiniStatBar value={opponent.attackPower} color="bg-danger" />
        <MiniStatBar value={opponent.defense} color="bg-primary" />
        <MiniStatBar value={opponent.speed} color="bg-bio-cyan" />
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="flex-1 text-center text-[9px] leading-none text-danger/70">&#9876;</span>
        <span className="flex-1 text-center text-[9px] leading-none text-primary/70">&#128737;</span>
        <span className="flex-1 text-center text-[9px] leading-none text-bio-cyan/70">&#9889;</span>
      </div>

      {/* Wellness compact */}
      {opponent.wellness && (
        <div className="flex items-center justify-center gap-1 mb-2">
          {([
            { key: 'activity' as const, icon: '\u26A1' },
            { key: 'hunger' as const, icon: '\uD83E\uDDEA' },
            { key: 'boredom' as const, icon: '\u2694\uFE0F' },
            { key: 'fatigue' as const, icon: '\uD83D\uDCA4' },
          ] as const).map((ind) => {
            const val = opponent.wellness![ind.key];
            const col = val >= 70 ? '#00e5a0' : val >= 40 ? '#ff9100' : '#ff3d3d';
            return (
              <div key={ind.key} className="flex flex-col items-center gap-0.5" title={`${val}%`}>
                <span className="text-[9px]">{ind.icon}</span>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col, boxShadow: `0 0 4px ${col}66` }} />
              </div>
            );
          })}
          <span className="text-[9px] font-bold ml-0.5" style={{ color: opponent.wellness.composite >= 60 ? '#00e5a0' : opponent.wellness.composite >= 30 ? '#ff9100' : '#ff3d3d' }}>
            {opponent.wellness.composite}%
          </span>
        </div>
      )}

      {/* Challenge button */}
      <Button
        variant="danger"
        size="sm"
        fullWidth
        disabled={disabled}
        onClick={() => onChallenge(opponent.creatureId)}
        className="!min-h-[36px] !h-8 uppercase font-black tracking-wider text-[11px]"
      >
        SFIDA
      </Button>
    </div>
  );
}
