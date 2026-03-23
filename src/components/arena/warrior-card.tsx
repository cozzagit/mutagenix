"use client";

import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const TIER_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  novice: { label: "Novizio", color: "text-muted", bg: "bg-muted/20" },
  intermediate: { label: "Intermedio", color: "text-primary", bg: "bg-primary/20" },
  veteran: { label: "Veterano", color: "text-bio-purple", bg: "bg-bio-purple/20" },
  legend: { label: "Leggenda", color: "text-warning", bg: "bg-warning/20" },
  immortal: { label: "Immortale", color: "text-red-400", bg: "bg-red-500/20" },
  divine: { label: "Divinità", color: "text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-400 to-cyan-400", bg: "bg-gradient-to-r from-amber-500/15 via-pink-500/15 to-cyan-500/15" },
};

const AXP_TIER_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  Recluta: { label: "Recluta", color: "text-muted", bg: "bg-muted/20" },
  Esperto: { label: "Esperto", color: "text-primary", bg: "bg-primary/20" },
  Veterano: { label: "Veterano", color: "text-bio-purple", bg: "bg-bio-purple/20" },
  Maestro: { label: "Maestro", color: "text-amber-400", bg: "bg-amber-400/20" },
};

const PERSONALITY_LABELS: Record<string, { label: string; color: string }> = {
  aggression: { label: "Aggressivo", color: "text-danger" },
  luminosity: { label: "Luminoso", color: "text-bio-cyan" },
  toxicity: { label: "Tossico", color: "text-bio-green" },
  intelligence: { label: "Intelligente", color: "text-bio-purple" },
  armoring: { label: "Corazzato", color: "text-warning" },
};

const AXP_TIERS: { min: number; label: string; color: string }[] = [
  { min: 200, label: "Maestro", color: "text-amber-400" },
  { min: 100, label: "Veterano", color: "text-bio-purple" },
  { min: 50, label: "Esperto", color: "text-primary" },
  { min: 0, label: "Recluta", color: "text-muted" },
];

function getAxpTier(axp: number): { label: string; color: string } {
  return AXP_TIERS.find((t) => axp >= t.min) ?? AXP_TIERS[AXP_TIERS.length - 1];
}

/* ------------------------------------------------------------------ */
/* Data types                                                         */
/* ------------------------------------------------------------------ */

export interface WarriorData {
  creatureId: string;
  name: string;
  ageDays: number | null;
  eloRating: number;
  eloPeak: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestWinStreak: number;
  tier: string;
  hp: number;
  attackPower: number;
  defense: number;
  speed: number;
  stamina: number;
  specialAttack: number;
  battleScars: number;
  dominantPersonality: string;
  personality: Record<string, number>;
  activeSynergies: string[];
  recovery: {
    active: boolean;
    remainingMinutes: number;
    until: string | null;
  };
  trauma: {
    active: boolean;
    consecutiveLosses: number;
  };
  battlesToday: number;
  battlesRemaining: number;
  visualParams: Record<string, unknown>;
  axp: number;
}

/* ------------------------------------------------------------------ */
/* Shared sub-components                                              */
/* ------------------------------------------------------------------ */

/** Colored stat bar with emoji icon and numeric value */
function StatBar({
  icon,
  value,
  max,
  color,
}: {
  icon: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-center text-xs leading-none shrink-0">{icon}</span>
      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-[10px] font-mono text-muted text-right">{Math.round(value)}</span>
    </div>
  );
}

/** Rank tier badge */
function TierBadge({ tier }: { tier: string }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.novice;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.color} ${style.bg}`}
    >
      {style.label}
    </span>
  );
}

/** AXP tier badge — for use on opponent cards with a string tier */
function AxpBadge({ axpTier }: { axpTier: string }) {
  const style = AXP_TIER_STYLES[axpTier] ?? AXP_TIER_STYLES.Recluta;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.color} ${style.bg}`}
    >
      {style.label}
    </span>
  );
}

/** AXP tier badge from numeric AXP — for the warrior card */
function AxpBadgeFromValue({ axp }: { axp: number }) {
  const tier = getAxpTier(axp);
  const style = AXP_TIER_STYLES[tier.label] ?? AXP_TIER_STYLES.Recluta;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.color} ${style.bg}`}
    >
      {tier.label}
    </span>
  );
}

function RecoveryCountdown({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const display = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      IN RECUPERO — {display}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Warrior Card                                                       */
/* ------------------------------------------------------------------ */

interface WarriorCardProps {
  warrior: WarriorData;
  compact?: boolean;
}

export function WarriorCard({ warrior, compact = false }: WarriorCardProps) {
  const vp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(warrior.visualParams as Partial<VisualParams>),
  } as VisualParams;
  const personalityInfo =
    PERSONALITY_LABELS[warrior.dominantPersonality] ?? PERSONALITY_LABELS.aggression;
  const statMax = 80; // bar scale max

  /* ---- COMPACT MODE ---- */
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface/80 px-3 py-2">
        <div className="shrink-0">
          <CreatureRenderer params={vp} size={64} animated={false} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{warrior.name}</span>
            <span className="text-bio-cyan text-[10px]">&#9889;</span>
            <span className="text-xs font-black font-mono text-foreground">{warrior.eloRating}</span>
            <span className="text-[10px] font-mono text-accent">{warrior.wins}V</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <TierBadge tier={warrior.tier} />
            <AxpBadgeFromValue axp={warrior.axp} />
            {warrior.recovery.active && (
              <span className="text-[9px] text-warning font-bold uppercase">Recupero</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---- FULL MODE ---- */
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-surface/80 p-4">
      {/* Creature centered */}
      <div className="flex justify-center">
        <CreatureRenderer params={vp} size={120} animated />
      </div>

      {/* Name */}
      <h3 className="text-base font-black text-foreground text-center truncate leading-tight">
        {warrior.name}
      </h3>

      {/* Tier + AXP badges */}
      <div className="flex items-center justify-center gap-1.5">
        <TierBadge tier={warrior.tier} />
        <AxpBadgeFromValue axp={warrior.axp} />
      </div>

      {/* ELO + record */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-bio-cyan text-sm">&#9889;</span>
          <span className="text-xl font-black font-mono text-foreground tracking-tight">
            {warrior.eloRating}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-1 text-xs">
          <span className="text-accent font-bold">{warrior.wins}V</span>
          <span className="text-danger font-bold">{warrior.losses}S</span>
          <span className="text-muted font-bold">{warrior.draws}P</span>
          {warrior.winStreak > 0 && (
            <span className="text-warning text-[10px] font-bold">
              {warrior.winStreak} &#128293;
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted mt-0.5">
          Picco {warrior.eloPeak} · Giorno {warrior.ageDays ?? 0}
        </p>
      </div>

      {/* Stats bars with icons */}
      <div className="rounded-lg bg-surface-2/60 p-2.5 flex flex-col gap-1.5">
        <StatBar icon="&#9876;" value={warrior.attackPower} max={statMax} color="bg-danger" />
        <StatBar icon="&#128737;" value={warrior.defense} max={statMax} color="bg-primary" />
        <StatBar icon="&#9889;" value={warrior.speed} max={statMax} color="bg-bio-cyan" />
        <StatBar icon="&#10084;" value={warrior.stamina} max={statMax} color="bg-bio-green" />
        <StatBar icon="&#10024;" value={warrior.specialAttack} max={statMax} color="bg-bio-purple" />
      </div>

      {/* AXP + Personality + Synergies */}
      <div className="flex flex-wrap items-center gap-1">
        <span className={`text-[10px] font-mono ${getAxpTier(warrior.axp).color}`}>
          AXP {warrior.axp}
        </span>
        <span className="text-muted text-[10px]">·</span>
        <span
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${personalityInfo.color} bg-surface-2`}
        >
          {personalityInfo.label}
        </span>
        {warrior.activeSynergies.map((syn) => (
          <span
            key={syn}
            className="inline-flex items-center rounded-md bg-surface-2 px-1 py-0.5 text-[9px] font-mono text-muted"
          >
            {syn}
          </span>
        ))}
      </div>

      {/* Trauma warning */}
      {warrior.trauma.active && (
        <div className="flex items-center gap-1.5 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
              clipRule="evenodd"
            />
          </svg>
          TRAUMA — {warrior.trauma.consecutiveLosses} sconfitte consecutive
        </div>
      )}

      {/* Recovery */}
      {warrior.recovery.active && <RecoveryCountdown minutes={warrior.recovery.remainingMinutes} />}

      {/* Battles remaining */}
      <div className="text-[10px] text-muted text-center">
        Battaglie: {warrior.battlesToday}/5 oggi ({warrior.battlesRemaining} rimanenti)
      </div>
    </div>
  );
}

export { TierBadge, AxpBadge };
