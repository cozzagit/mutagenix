'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  CreatureRenderer,
  DEFAULT_VISUAL_PARAMS,
} from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import { PersonalityRadar } from '@/components/lab/personality-radar';
import { CaricaBadge } from '@/components/cariche/carica-badge';
import { COMBAT_TRAITS } from '@/lib/game-engine/constants';
import { StirpiView } from './stirpi-view';

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
  wellness?: { activity: number; hunger: number; boredom: number; fatigue: number; composite: number };
  parentNames?: { parentA: string | null; parentB: string | null } | null;
  familyGeneration?: number;
  cariche?: string[];
  isDead?: boolean;
}

interface LaboratoriDirectoryProps {
  creatures: LaboratoriCreature[];
}

type SortMode = 'potenza' | 'elo' | 'day' | 'wellness' | 'nome';
type TierFilter = 'all' | 'embryo' | 'novice' | 'intermediate' | 'veteran' | 'legend' | 'immortal' | 'divine';

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
  divine: { label: 'Divinita', color: 'badge-divine text-amber-400', bg: 'bg-amber-500/20 border border-amber-400/30', dot: '#ec4899' },
};

const TIER_FILTER_OPTIONS: { key: TierFilter; label: string }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'divine', label: 'Divinita' },
  { key: 'immortal', label: 'Immortale' },
  { key: 'legend', label: 'Leggenda' },
  { key: 'veteran', label: 'Veterano' },
  { key: 'intermediate', label: 'Intermedio' },
  { key: 'novice', label: 'Novizio' },
  { key: 'embryo', label: 'Embrione' },
];

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
  { key: 'elo', label: 'ELO' },
  { key: 'day', label: 'Giorno' },
  { key: 'wellness', label: 'Wellness' },
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
  divine: 'Divinita',
};

// ---------------------------------------------------------------------------
// Specimen Card — Petri dish colony style
// ---------------------------------------------------------------------------

function SpecimenCard({
  creature,
  onClick,
}: {
  creature: LaboratoriCreature;
  onClick: () => void;
}) {
  const badge = LEVEL_BADGES[creature.level] ?? LEVEL_BADGES.embryo;
  const potenzaTier = getPotenzaTier(creature.potenza);
  const bodyColor = getBodyColor(creature.visualParams);
  const isDead = creature.isDead === true;

  const visualParams: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  // Colony growth ring color
  const colonyColor = bodyColor ?? '#8a9a70';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-full w-full cursor-pointer flex-col rounded-2xl border text-left transition-all duration-300 active:scale-[0.97] ${
        isDead
          ? 'border-border/20 bg-surface/30 opacity-60 grayscale'
          : 'border-[#8a9a70]/20 hover:border-[#8a9a70]/40 hover:shadow-lg'
      }`}
      style={{
        background: isDead
          ? undefined
          : `linear-gradient(135deg, rgba(180, 200, 160, 0.04) 0%, rgba(20, 25, 18, 0.6) 50%, rgba(180, 200, 160, 0.02) 100%)`,
        boxShadow: isDead
          ? undefined
          : `0 0 30px ${colonyColor}08, inset 0 1px 0 rgba(180, 200, 160, 0.06)`,
      }}
    >
      {/* Colony growth ring — radial gradient behind creature */}
      <div
        className="absolute inset-0 rounded-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-70"
        style={{
          background: `radial-gradient(ellipse at 50% 35%, ${colonyColor}12 0%, transparent 60%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col p-3">
        {/* Dead label */}
        {isDead && (
          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border border-red-500/30 bg-red-900/60 px-2 py-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">
              Campione Esaurito
            </span>
          </div>
        )}

        {/* Creature SVG — centered with colony ring effect */}
        <div className="relative mx-auto flex items-center justify-center py-1">
          {/* Subtle ring behind creature */}
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-md transition-opacity duration-300 group-hover:opacity-50"
            style={{
              background: `radial-gradient(circle, ${colonyColor}30 0%, transparent 70%)`,
            }}
          />
          <CreatureRenderer
            params={visualParams}
            size={140}
            animated={false}
            seed={42}
          />
        </div>

        {/* Potenza score — hero */}
        <div className="flex items-center justify-center gap-1 py-0.5">
          <span
            className="text-xl font-black tabular-nums leading-none md:text-2xl"
            style={{
              color: potenzaTier.color,
              textShadow: `0 0 12px ${potenzaTier.glow}`,
            }}
          >
            {creature.potenza}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-muted/50">
            PWR
          </span>
        </div>

        {/* Lab specimen tag area */}
        <div className="mt-1 rounded-lg border border-[#8a9a70]/10 bg-background/40 px-2.5 py-2 backdrop-blur-sm">
          {/* Name */}
          <p className="truncate text-center text-sm font-bold text-foreground">
            {creature.name}
          </p>

          {/* Scientist */}
          <p className="truncate text-center text-[10px] text-muted">
            Dr. {creature.ownerName}
          </p>

          {/* Day + Level badge row */}
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            <span className="text-[10px] text-muted/70">
              Giorno {creature.ageDays}
            </span>
            <span className="text-muted/30">&middot;</span>
            <span
              className={`rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${badge.color} ${badge.bg}`}
            >
              {badge.label}
            </span>
          </div>

          {/* Generation + Parents */}
          {creature.familyGeneration && creature.familyGeneration > 1 && (
            <div className="mt-1 flex flex-col items-center gap-0.5">
              <span className="rounded-full bg-bio-purple/15 px-1.5 py-0.5 text-[8px] font-bold text-bio-purple">
                Gen {creature.familyGeneration}
              </span>
              {creature.parentNames && (creature.parentNames.parentA || creature.parentNames.parentB) && (
                <p className="text-[8px] text-muted/60">
                  {[creature.parentNames.parentA, creature.parentNames.parentB].filter(Boolean).join(' + ')}
                </p>
              )}
            </div>
          )}

          {/* Wellness dots */}
          {creature.wellness && (
            <div className="mt-1.5 flex items-center justify-center gap-1">
              {([
                { key: 'activity' as const, label: 'Attivita' },
                { key: 'hunger' as const, label: 'Nutrizione' },
                { key: 'boredom' as const, label: 'Stimolazione' },
                { key: 'fatigue' as const, label: 'Energia' },
              ] as const).map((ind) => {
                const val = creature.wellness![ind.key];
                const col = val >= 70 ? '#00e5a0' : val >= 40 ? '#ff9100' : '#ff3d3d';
                return (
                  <span
                    key={ind.key}
                    className="h-1.5 w-1.5 rounded-full"
                    title={`${ind.label}: ${val}%`}
                    style={{ backgroundColor: col, boxShadow: `0 0 4px ${col}66` }}
                  />
                );
              })}
              <span
                className="ml-0.5 text-[8px] font-bold tabular-nums"
                style={{
                  color: creature.wellness.composite >= 60 ? '#00e5a0' : creature.wellness.composite >= 30 ? '#ff9100' : '#ff3d3d',
                }}
              >
                {creature.wellness.composite}%
              </span>
            </div>
          )}

          {/* Cariche badges */}
          {creature.cariche && creature.cariche.length > 0 && (
            <div className="mt-1.5 flex items-center justify-center gap-1">
              {creature.cariche.map((cId) => (
                <CaricaBadge key={cId} caricaId={cId} compact />
              ))}
            </div>
          )}

          {/* Arena record */}
          {creature.arena && (
            <p className="mt-1 text-center text-[10px]">
              <span className="font-bold text-accent">{creature.arena.wins}V</span>
              {' '}
              <span className="font-bold text-red-400">{creature.arena.losses}S</span>
              <span className="text-muted/50"> &middot; </span>
              <span className="text-[9px] text-muted/50">ELO </span>
              <span className="font-bold text-foreground/80">{creature.arena.eloRating}</span>
            </p>
          )}

          {/* Active synergies */}
          {creature.activeSynergies.length > 0 && (
            <div className="mt-1.5 flex flex-wrap justify-center gap-0.5">
              {creature.activeSynergies.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${SYNERGY_COLORS[s] ?? '#6b7280'}15`,
                    color: SYNERGY_COLORS[s] ?? '#6b7280',
                    border: `1px solid ${SYNERGY_COLORS[s] ?? '#6b7280'}25`,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Scientist Group Header
// ---------------------------------------------------------------------------

function ScientistGroupHeader({
  name,
  count,
  totalPotenza,
}: {
  name: string;
  count: number;
  totalPotenza: number;
}) {
  return (
    <div className="col-span-full mb-1 mt-4 first:mt-0">
      <div className="flex items-center gap-3 border-b border-[#8a9a70]/15 pb-2">
        {/* Microscope icon */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#8a9a70]/20 bg-[#8a9a70]/10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5 text-[#8a9a70]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-bold text-foreground">
            Laboratorio di Dr. {name}
          </h3>
          <p className="text-[10px] text-muted/60">
            {count} campion{count === 1 ? 'e' : 'i'} &middot; Potenza totale: {totalPotenza}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer — Lab Specimen Sheet
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
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-2xl border-t border-[#8a9a70]/20 bg-background shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#8a9a70]/15 bg-surface/80 px-4 py-3 backdrop-blur-md">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#8a9a70]">
              Scheda Campione
            </p>
            <h2 className="text-sm font-bold text-foreground">
              {creature.name}
            </h2>
            <p className="text-[10px] text-muted">
              Proprietario: Dr. {creature.ownerName} &middot; Giorno {creature.ageDays}
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
          <div className="relative flex justify-center">
            {/* Colony ring in drawer */}
            <div
              className="absolute inset-0 rounded-full opacity-20 blur-xl"
              style={{
                background: `radial-gradient(circle, ${getBodyColor(creature.visualParams) ?? '#8a9a70'}40 0%, transparent 60%)`,
              }}
            />
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

          {/* Generation + Parents */}
          {creature.familyGeneration && creature.familyGeneration > 1 && (
            <div className="flex flex-col items-center gap-1 rounded-lg border border-bio-purple/20 bg-bio-purple/5 px-3 py-2">
              <span className="rounded-full bg-bio-purple/15 px-2 py-0.5 text-[9px] font-bold text-bio-purple">
                Generazione {creature.familyGeneration}
              </span>
              {creature.parentNames && (creature.parentNames.parentA || creature.parentNames.parentB) && (
                <p className="text-[10px] text-muted">
                  Genitori: {[creature.parentNames.parentA, creature.parentNames.parentB].filter(Boolean).join(' + ')}
                </p>
              )}
            </div>
          )}

          {/* Cariche badges */}
          {creature.cariche && creature.cariche.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Cariche Attive
              </p>
              <div className="flex flex-wrap gap-1.5">
                {creature.cariche.map((cId) => (
                  <CaricaBadge key={cId} caricaId={cId} />
                ))}
              </div>
            </div>
          )}

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

          {/* Wellness detail */}
          {creature.wellness && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Stato Organismo
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'activity' as const, label: 'Attivita', color: '#00e5a0' },
                  { key: 'hunger' as const, label: 'Nutrizione', color: '#60a5fa' },
                  { key: 'boredom' as const, label: 'Stimolazione', color: '#b26eff' },
                  { key: 'fatigue' as const, label: 'Energia', color: '#ff9100' },
                ] as const).map((ind) => {
                  const val = creature.wellness![ind.key];
                  const displayColor = val >= 70 ? '#00e5a0' : val >= 40 ? '#ff9100' : '#ff3d3d';
                  return (
                    <div key={ind.key} className="flex items-center gap-2 rounded-md bg-surface/60 px-2 py-1.5">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: displayColor }} />
                      <div className="flex-1">
                        <p className="text-[8px] text-muted/60">{ind.label}</p>
                        <p className="text-[10px] font-bold" style={{ color: displayColor }}>{val}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 rounded-md border border-[#8a9a70]/15 bg-surface/40 px-3 py-1.5">
                <span className="text-[9px] text-muted">Composito:</span>
                <span
                  className="text-sm font-black tabular-nums"
                  style={{
                    color: creature.wellness.composite >= 60 ? '#00e5a0' : creature.wellness.composite >= 30 ? '#ff9100' : '#ff3d3d',
                  }}
                >
                  {creature.wellness.composite}%
                </span>
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
              {/* Sfida button */}
              <a
                href={`/arena?opponent=${creature.id}`}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                Sfida in Arena
              </a>
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
// Main Directory Component — Il Vetrino
// ---------------------------------------------------------------------------

export function LaboratoriDirectory({ creatures }: LaboratoriDirectoryProps) {
  const [view, setView] = useState<'grid' | 'stirpi'>('grid');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('potenza');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [groupByScientist, setGroupByScientist] = useState(false);
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

    // Tier filter
    if (tierFilter !== 'all') {
      result = result.filter((c) => c.level === tierFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortMode) {
        case 'potenza':
          return b.potenza - a.potenza;
        case 'day':
          return b.ageDays - a.ageDays;
        case 'elo': {
          const aElo = a.arena?.eloRating ?? -Infinity;
          const bElo = b.arena?.eloRating ?? -Infinity;
          return bElo - aElo;
        }
        case 'wellness': {
          const aW = a.wellness?.composite ?? -Infinity;
          const bW = b.wellness?.composite ?? -Infinity;
          return bW - aW;
        }
        case 'nome':
          return a.name.localeCompare(b.name, 'it');
        default:
          return 0;
      }
    });

    return result;
  }, [creatures, search, sortMode, tierFilter]);

  // Group by scientist
  const grouped = useMemo(() => {
    if (!groupByScientist) return null;
    const map = new Map<string, LaboratoriCreature[]>();
    for (const c of filtered) {
      const group = map.get(c.ownerName) ?? [];
      group.push(c);
      map.set(c.ownerName, group);
    }
    // Sort groups by total potenza descending
    return Array.from(map.entries()).sort((a, b) => {
      const aTotal = a[1].reduce((sum, c) => sum + c.potenza, 0);
      const bTotal = b[1].reduce((sum, c) => sum + c.potenza, 0);
      return bTotal - aTotal;
    });
  }, [filtered, groupByScientist]);

  return (
    <div className="relative">
      {/* Petri dish background effect */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(180, 200, 160, 0.03) 0%, transparent 70%)',
        }}
      />

      {/* Header — Il Vetrino */}
      <div className="relative z-10 mb-5">
        <div className="flex items-center gap-3">
          {/* Microscope icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8a9a70]/20 bg-[#8a9a70]/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-[#8a9a70]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Il Vetrino
            </h1>
            <p className="text-[11px] text-muted/70">
              Osserva tutte le creature del laboratorio sotto il microscopio
            </p>
          </div>

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-surface-2/80 p-0.5">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${view === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground'}`}
              onClick={() => setView('grid')}
            >
              Griglia
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${view === 'stirpi' ? 'bg-primary/20 text-primary' : 'text-muted hover:text-foreground'}`}
              onClick={() => setView('stirpi')}
            >
              Stirpi
            </button>
          </div>
        </div>
      </div>

      {/* Filter/Sort bar */}
      <div className="relative z-10 mb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/50"
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
            placeholder="Cerca creatura o scienziato..."
            className="w-full rounded-xl border border-[#8a9a70]/15 bg-surface/40 py-2 pl-10 pr-4 text-xs text-foreground placeholder:text-muted/40 focus:border-[#8a9a70]/30 focus:outline-none focus:ring-1 focus:ring-[#8a9a70]/20 backdrop-blur-sm"
          />
        </div>

        {/* Sort + Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort pills */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSortMode(opt.key)}
                className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
                  sortMode === opt.key
                    ? 'bg-[#8a9a70]/20 text-[#b4c8a0] ring-1 ring-[#8a9a70]/30'
                    : 'bg-surface/40 text-muted/60 hover:bg-surface/60 hover:text-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-muted/20">|</span>

          {/* Tier filter dropdown */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TierFilter)}
            className="rounded-full border border-[#8a9a70]/15 bg-surface/40 px-2.5 py-1 text-[10px] font-medium text-muted/70 focus:border-[#8a9a70]/30 focus:outline-none"
          >
            {TIER_FILTER_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Group by scientist toggle */}
          <button
            type="button"
            onClick={() => setGroupByScientist(!groupByScientist)}
            className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
              groupByScientist
                ? 'bg-[#8a9a70]/20 text-[#b4c8a0] ring-1 ring-[#8a9a70]/30'
                : 'bg-surface/40 text-muted/60 hover:bg-surface/60 hover:text-muted'
            }`}
          >
            Per Scienziato
          </button>

          {/* Count */}
          <span className="ml-auto shrink-0 text-[10px] text-muted/40">
            {filtered.length} campion{filtered.length === 1 ? 'e' : 'i'}
          </span>
        </div>
      </div>

      {/* Main content area */}
      {view === 'stirpi' ? (
        <div className="relative z-10">
          <StirpiView creatures={creatures} />
        </div>
      ) : (
      <div className="relative z-10">
        {grouped ? (
          /* Grouped by scientist */
          grouped.map(([name, groupCreatures]) => (
            <div key={name}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ScientistGroupHeader
                  name={name}
                  count={groupCreatures.length}
                  totalPotenza={groupCreatures.reduce((sum, c) => sum + c.potenza, 0)}
                />
                {groupCreatures.map((creature) => (
                  <SpecimenCard
                    key={creature.id}
                    creature={creature}
                    onClick={() => setSelectedCreature(creature)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          /* Flat grid */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((creature) => (
              <SpecimenCard
                key={creature.id}
                creature={creature}
                onClick={() => setSelectedCreature(creature)}
              />
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#8a9a70]/15 bg-surface/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-muted/30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <p className="text-sm text-muted/50">
              Nessun campione trovato
            </p>
            <p className="text-[10px] text-muted/30">
              Prova a modificare i filtri di ricerca
            </p>
          </div>
        )}
      </div>
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
