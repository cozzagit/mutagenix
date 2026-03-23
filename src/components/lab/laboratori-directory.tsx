'use client';

import { useState, useMemo } from 'react';
import {
  CreatureRenderer,
  DEFAULT_VISUAL_PARAMS,
} from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import { PersonalityRadar } from '@/components/lab/personality-radar';
import { COMBAT_TRAITS } from '@/lib/game-engine/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LaboratoriCreature {
  id: string;
  name: string;
  ownerName: string;
  ageDays: number;
  generation: number;
  stability: number;
  level: string; // 'embryo' | 'novice' | 'intermediate' | 'veteran' | 'legend' | 'immortal' | 'divine'
  potenza: number;
  visualParams: Record<string, unknown>;
  elementLevels: Record<string, number>;
  activeSynergies: string[];
  combatApprox: Record<string, number>;
  arena: {
    eloRating: number;
    wins: number;
    losses: number;
    draws: number;
    winStreak: number;
    tier: string;
  } | null;
}

interface LaboratoriDirectoryProps {
  creatures: LaboratoriCreature[];
}

type SortMode = 'potenza' | 'evoluzione' | 'elo' | 'nome';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVEL_BADGES: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  embryo: { label: 'Embrione', color: 'text-muted', bg: 'bg-muted/10', dot: '#6b7280' },
  novice: { label: 'Novizio', color: 'text-blue-400', bg: 'bg-blue-500/15', dot: '#60a5fa' },
  intermediate: { label: 'Intermedio', color: 'text-primary', bg: 'bg-primary/15', dot: '#3d5afe' },
  veteran: { label: 'Veterano', color: 'text-bio-purple', bg: 'bg-bio-purple/15', dot: '#b26eff' },
  legend: { label: 'Leggenda', color: 'text-amber-400', bg: 'bg-amber-500/15', dot: '#fbbf24' },
  immortal: { label: 'Immortale', color: 'text-red-400', bg: 'bg-red-500/15', dot: '#f87171' },
  divine: { label: 'Divinità', color: 'badge-divine text-amber-400', bg: 'bg-amber-500/20 border border-amber-400/30', dot: '#ec4899' },
};

function getPotenzaTier(potenza: number): { color: string; glow: string; textColor: string } {
  if (potenza >= 200) return { color: '#fbbf24', glow: '#fbbf2466', textColor: 'text-amber-400' };
  if (potenza >= 100) return { color: '#b26eff', glow: '#b26eff44', textColor: 'text-bio-purple' };
  if (potenza >= 50) return { color: '#60a5fa', glow: '#60a5fa44', textColor: 'text-blue-400' };
  return { color: '#6b7280', glow: '#6b728033', textColor: 'text-muted' };
}

function getBodyColor(vp: Record<string, unknown>): string | null {
  if (vp && typeof vp === 'object') {
    const hue = vp.bodyHue;
    const sat = vp.bodySaturation;
    const lgt = vp.bodyLightness;
    if (typeof hue === 'number' && typeof sat === 'number' && typeof lgt === 'number') {
      return `hsl(${hue}, ${sat}%, ${lgt}%)`;
    }
  }
  return null;
}

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'potenza', label: 'Potenza' },
  { key: 'evoluzione', label: 'Evoluzione' },
  { key: 'elo', label: 'ELO' },
  { key: 'nome', label: 'Nome' },
];

const COMBAT_TRAIT_LABELS: Record<string, string> = {
  attackPower: 'Attacco',
  defense: 'Difesa',
  speed: 'Velocita',
  stamina: 'Resistenza',
  specialAttack: 'Speciale',
  battleScars: 'Cicatrici',
};

const COMBAT_TRAIT_COLORS: Record<string, string> = {
  attackPower: '#ff3d3d',
  defense: '#4488ff',
  speed: '#00e5e5',
  stamina: '#ff9100',
  specialAttack: '#b26eff',
  battleScars: '#8a8a8a',
};

const SYNERGY_COLORS: Record<string, string> = {
  Ossatura: '#ffcc80',
  Sangue: '#ff4466',
  Veleno: '#76ff03',
  Neural: '#b26eff',
  Organico: '#00e5e5',
  Caotico: '#ff9100',
};

const TIER_LABELS: Record<string, string> = {
  novice: 'Novizio',
  intermediate: 'Intermedio',
  veteran: 'Veterano',
  legend: 'Leggenda',
  immortal: 'Immortale',
  divine: 'Divinità',
};

// ---------------------------------------------------------------------------
// Creature Card
// ---------------------------------------------------------------------------

function CreatureCard({
  creature,
  onClick,
}: {
  creature: LaboratoriCreature;
  onClick: () => void;
}) {
  const badge = LEVEL_BADGES[creature.level] ?? LEVEL_BADGES.embryo;
  const potenzaTier = getPotenzaTier(creature.potenza);
  const bodyColor = getBodyColor(creature.visualParams);

  const visualParams: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full w-full cursor-pointer flex-col rounded-xl border border-border/40 bg-surface/60 p-3 text-left transition-all hover:border-border/70 hover:bg-surface/80 active:scale-[0.98]"
      style={
        bodyColor
          ? { boxShadow: `0 0 20px ${bodyColor}18, inset 0 0 20px ${bodyColor}08` }
          : undefined
      }
    >
      {/* Creature SVG */}
      <div className="flex items-center justify-center py-2">
        <CreatureRenderer
          params={visualParams}
          size={160}
          animated={false}
          seed={42}
        />
      </div>

      {/* Potenza score — big and glowing */}
      <div className="flex items-center justify-center gap-1 py-1">
        <span
          className="text-2xl font-black tabular-nums leading-none"
          style={{
            color: potenzaTier.color,
            textShadow: `0 0 12px ${potenzaTier.glow}`,
          }}
        >
          {creature.potenza}
        </span>
      </div>

      {/* Creature name */}
      <p className="truncate text-center text-sm font-bold text-foreground">
        {creature.name}
      </p>

      {/* Owner */}
      <p className="truncate text-center text-[11px] text-muted">
        {creature.ownerName}
      </p>

      {/* Day + Level badge */}
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <span className="text-[11px] text-muted">
          Day {creature.ageDays}
        </span>
        <span className="text-muted/40">&middot;</span>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${badge.color} ${badge.bg}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Arena record */}
      {creature.arena && (
        <p className="mt-1 text-center text-[11px]">
          <span className="font-bold text-accent">{creature.arena.wins}V</span>
          {' '}
          <span className="font-bold text-red-400">{creature.arena.losses}S</span>
          <span className="text-muted"> &middot; ELO </span>
          <span className="font-bold text-foreground">{creature.arena.eloRating}</span>
        </p>
      )}

      {/* Synergies */}
      {creature.activeSynergies.length > 0 && (
        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
          {creature.activeSynergies.map((s) => (
            <span
              key={s}
              className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${SYNERGY_COLORS[s] ?? '#6b7280'}18`,
                color: SYNERGY_COLORS[s] ?? '#6b7280',
                border: `1px solid ${SYNERGY_COLORS[s] ?? '#6b7280'}33`,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer (slide-over from right)
// ---------------------------------------------------------------------------

function CreatureDetailDrawer({
  creature,
  onClose,
}: {
  creature: LaboratoriCreature;
  onClose: () => void;
}) {
  const badge = LEVEL_BADGES[creature.level] ?? LEVEL_BADGES.embryo;
  const potenzaTier = getPotenzaTier(creature.potenza);

  const visualParams: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  const hasCombatStats = COMBAT_TRAITS.some(
    (ct) => (creature.combatApprox[ct] ?? 0) > 0,
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-2xl border-t border-border/50 bg-background shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-surface/80 px-4 py-3 backdrop-blur-md">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {creature.name}
            </h2>
            <p className="text-[10px] text-muted">
              {creature.ownerName} &middot; Day {creature.ageDays}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 p-4">
          {/* Creature SVG — big */}
          <div className="flex justify-center">
            <CreatureRenderer
              params={visualParams}
              size={280}
              animated
              seed={42}
            />
          </div>

          {/* Potenza — hero */}
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
              Potenza
            </p>
            <p
              className="text-4xl font-black tabular-nums leading-none"
              style={{
                color: potenzaTier.color,
                textShadow: `0 0 20px ${potenzaTier.glow}`,
              }}
            >
              {creature.potenza}
            </p>
          </div>

          {/* Level + Stability */}
          <div className="flex items-center justify-center gap-3">
            <span
              className={`rounded-sm px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${badge.color} ${badge.bg}`}
            >
              {badge.label}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted">Stabilita</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    creature.stability >= 0.7
                      ? 'bg-emerald-500'
                      : creature.stability >= 0.4
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.round(creature.stability * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-foreground">
                {Math.round(creature.stability * 100)}%
              </span>
            </div>
          </div>

          {/* Personality radar */}
          <div className="flex justify-center">
            <PersonalityRadar
              elementLevels={creature.elementLevels}
              size={160}
            />
          </div>

          {/* Combat traits (approximate) */}
          {hasCombatStats && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Statistiche Combattimento
              </p>
              <p className="mb-2 text-[9px] italic text-muted/50">
                Valori approssimati
              </p>
              <div className="space-y-0.5">
                {COMBAT_TRAITS.map((ct) => {
                  const value = creature.combatApprox[ct] ?? 0;
                  const color = COMBAT_TRAIT_COLORS[ct];
                  const label = COMBAT_TRAIT_LABELS[ct];
                  return (
                    <div key={ct} className="flex h-[20px] items-center gap-2">
                      <span
                        className="w-[52px] shrink-0 text-right text-[9px] font-bold"
                        style={{ color }}
                      >
                        {label}
                      </span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-surface-2">
                        <div
                          className="h-full rounded-sm transition-all duration-700 ease-out"
                          style={{
                            width: `${value}%`,
                            backgroundColor: color,
                            boxShadow: value > 0 ? `0 0 6px ${color}44` : undefined,
                            opacity: value > 0 ? 1 : 0.2,
                          }}
                        />
                      </div>
                      <span
                        className="w-5 shrink-0 text-right text-[9px] font-semibold tabular-nums"
                        style={{ color: value > 0 ? color : 'var(--color-muted)' }}
                      >
                        ~{value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Arena record */}
          {creature.arena && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Record Arena
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-foreground/80">
                  <span className="text-muted">ELO: </span>
                  <span className="font-bold">{creature.arena.eloRating}</span>
                </div>
                <div className="text-foreground/80">
                  <span className="text-muted">Tier: </span>
                  <span className="font-bold capitalize">
                    {TIER_LABELS[creature.arena.tier] ?? creature.arena.tier}
                  </span>
                </div>
                <div className="text-foreground/80">
                  <span className="font-bold text-accent">{creature.arena.wins}V</span>
                  {' / '}
                  <span className="font-bold text-red-400">{creature.arena.losses}S</span>
                  {' / '}
                  <span className="font-bold text-muted">{creature.arena.draws}P</span>
                </div>
                <div className="text-foreground/80">
                  <span className="text-muted">Streak: </span>
                  <span className="font-bold text-warning">{creature.arena.winStreak}</span>
                </div>
              </div>
            </div>
          )}

          {/* Active synergies with descriptions */}
          {creature.activeSynergies.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Sinergie Attive
              </p>
              <div className="flex flex-wrap gap-1.5">
                {creature.activeSynergies.map((s) => (
                  <span
                    key={s}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${SYNERGY_COLORS[s] ?? '#6b7280'}15`,
                      color: SYNERGY_COLORS[s] ?? '#6b7280',
                      border: `1px solid ${SYNERGY_COLORS[s] ?? '#6b7280'}30`,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Directory Component
// ---------------------------------------------------------------------------

export function LaboratoriDirectory({ creatures }: LaboratoriDirectoryProps) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('potenza');
  const [selectedCreature, setSelectedCreature] = useState<LaboratoriCreature | null>(null);

  const filtered = useMemo(() => {
    let result = creatures;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.ownerName.toLowerCase().includes(q),
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortMode) {
        case 'potenza':
          return b.potenza - a.potenza;
        case 'evoluzione':
          return b.ageDays - a.ageDays;
        case 'elo': {
          const aElo = a.arena?.eloRating ?? -Infinity;
          const bElo = b.arena?.eloRating ?? -Infinity;
          return bElo - aElo;
        }
        case 'nome':
          return a.name.localeCompare(b.name, 'it');
        default:
          return 0;
      }
    });

    return result;
  }, [creatures, search, sortMode]);

  return (
    <div>
      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome creatura o scienziato..."
            className="w-full rounded-lg border border-border/50 bg-surface/60 py-2 pl-10 pr-4 text-xs text-foreground placeholder:text-muted/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Sort pills */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortMode(opt.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-colors ${
              sortMode === opt.key
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'bg-surface/60 text-muted hover:bg-surface/80 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="shrink-0 self-center pl-2 text-[10px] text-muted/50">
          {filtered.length} creatur{filtered.length === 1 ? 'a' : 'e'}
        </span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((creature) => (
          <CreatureCard
            key={creature.id}
            creature={creature}
            onClick={() => setSelectedCreature(creature)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          Nessuna creatura trovata
        </p>
      )}

      {/* Detail Drawer */}
      {selectedCreature && (
        <CreatureDetailDrawer
          creature={selectedCreature}
          onClose={() => setSelectedCreature(null)}
        />
      )}
    </div>
  );
}
