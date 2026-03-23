"use client";

import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { Button } from "@/components/ui/button";
import { TierBadge } from "./warrior-card";

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
}

const AXP_TIER_COLORS: Record<string, string> = {
  Recluta: 'text-muted',
  Esperto: 'text-primary',
  Veterano: 'text-bio-purple',
  Maestro: 'text-amber-400',
};

interface OpponentCardProps {
  opponent: OpponentData;
  disabled?: boolean;
  onChallenge: (creatureId: string) => void;
}

export function OpponentCard({ opponent, disabled = false, onChallenge }: OpponentCardProps) {
  const vp = { ...DEFAULT_VISUAL_PARAMS, ...(opponent.visualParams as Partial<VisualParams>) } as VisualParams;

  return (
    <div className="flex flex-col rounded-xl border border-border/50 bg-surface/80 p-3 transition-colors hover:border-danger/30">
      {/* Creature + name */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="shrink-0">
          <CreatureRenderer params={vp} size={90} animated={false} seed={42} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{opponent.name}</p>
          <p className="text-[10px] text-muted truncate">{opponent.ownerName}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <TierBadge tier={opponent.tier} />
            <span className="text-[10px] font-mono text-muted">
              ELO {opponent.eloRating}
            </span>
            <span className={`text-[9px] font-bold ${AXP_TIER_COLORS[opponent.axpTier] ?? 'text-muted'}`}>
              {opponent.axpTier}
            </span>
          </div>
        </div>
      </div>

      {/* Approximate stats */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted mb-2">
        <span>HP~{opponent.hp}</span>
        <span>ATK~{opponent.attackPower}</span>
        <span>DEF~{opponent.defense}</span>
        <span>SPD~{opponent.speed}</span>
      </div>

      {/* Record */}
      <div className="flex items-center gap-2 text-[10px] mb-3">
        <span className="text-accent font-bold">{opponent.wins}V</span>
        <span className="text-danger font-bold">{opponent.losses}S</span>
        {opponent.winStreak > 0 && (
          <span className="text-warning">{opponent.winStreak} streak</span>
        )}
        <span className="text-muted ml-auto">Giorno {opponent.ageDays ?? 0}</span>
      </div>

      {/* Challenge button */}
      <Button
        variant="danger"
        size="sm"
        fullWidth
        disabled={disabled}
        onClick={() => onChallenge(opponent.creatureId)}
      >
        SFIDA
      </Button>
    </div>
  );
}
