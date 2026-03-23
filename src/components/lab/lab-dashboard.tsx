'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CreatureRenderer } from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import { DEFAULT_VISUAL_PARAMS } from '@/components/creature/creature-renderer';
import { ELEMENTS, SYNERGIES, COMBAT_TRAITS, GAME_CONFIG, type ElementId } from '@/lib/game-engine/constants';
import { getRankTier } from '@/lib/game-engine/battle-engine';
import { StatsBar } from './stats-bar';
import { AllocationPanel } from './allocation-panel';
import { ELEMENT_COLORS } from './element-levels-display';
import { LabChamber } from '@/components/creature/lab-chamber';
import { PersonalityRadar } from './personality-radar';
import { EditableCreatureName } from './editable-creature-name';
import { InstallButton } from '@/components/pwa/install-button';
import { TierCelebration } from './tier-celebration';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  creature: {
    id: string;
    name: string;
    generation: number | null;
    ageDays: number | null;
    stability: number | null;
    elementLevels: Record<string, number>;
    traitValues: Record<string, number>;
    visualParams: Record<string, unknown>;
  };
  todayAllocation: null;
  canAllocate: boolean;
  mutationActive: boolean;
  mutationProgress: number;
  currentVisualParams: Record<string, unknown>;
  currentElementLevels: Record<string, number>;
  timeUntilNextDay: number;
  dayKey: string;
  isDevMode: boolean;
  cooldownRemaining?: number;
  unseenBattles?: number;
  ranking?: { eloRating: number; wins: number; losses: number; draws: number; tier: string; axp?: number } | null;
}

type Phase = 'idle' | 'allocating' | 'mutating' | 'waiting';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatTime(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getActiveSynergies(elementLevels: Record<string, number>): string[] {
  const active: string[] = [];
  for (const syn of SYNERGIES) {
    if (syn.elements.length === 0) continue;
    const meetsAll = syn.elements.every((el) => {
      const threshold = syn.thresholds[el] ?? 0;
      return (elementLevels[el] ?? 0) >= threshold;
    });
    if (meetsAll) active.push(syn.name);
  }
  return active;
}

const SYNERGY_COLORS: Record<string, string> = {
  Ossatura: '#ffcc80',
  Sangue: '#ff4466',
  Veleno: '#76ff03',
  Neural: '#b26eff',
  Organico: '#00f0ff',
  Caotico: '#ffd600',
};

const COMBAT_TRAIT_LABELS: Record<string, string> = {
  attackPower: 'Attacco',
  defense: 'Difesa',
  speed: 'Velocità',
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

function getLevelBadge(ageDays: number, tier?: string): { label: string; color: string; bg: string } {
  if (ageDays < GAME_CONFIG.WARRIOR_PHASE_START) {
    return { label: 'Embrione', color: 'text-muted', bg: 'bg-muted/10' };
  }
  // Always derive tier from age (DB ranking tier may be stale)
  const effectiveTier = ageDays >= 500 ? 'divine' : ageDays >= 300 ? 'immortal' : ageDays > 150 ? 'legend' : ageDays > 100 ? 'veteran' : ageDays > 60 ? 'intermediate' : 'novice';
  if (effectiveTier === 'divine') return { label: 'Divinità', color: 'badge-divine text-amber-400', bg: 'bg-amber-500/20 border border-amber-400/30' };
  if (effectiveTier === 'immortal') return { label: 'Immortale', color: 'text-red-400', bg: 'bg-red-500/15' };
  if (effectiveTier === 'legend') return { label: 'Leggenda', color: 'text-amber-400', bg: 'bg-amber-500/15' };
  if (effectiveTier === 'veteran') return { label: 'Veterano', color: 'text-bio-purple', bg: 'bg-bio-purple/15' };
  if (effectiveTier === 'intermediate') return { label: 'Intermedio', color: 'text-primary', bg: 'bg-primary/15' };
  return { label: 'Novizio', color: 'text-muted', bg: 'bg-muted/15' };
}


/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function LabDashboard({
  creature,
  todayAllocation,
  canAllocate: initialCanAllocate,
  mutationActive: initialMutationActive,
  mutationProgress: initialMutationProgress,
  currentVisualParams: initialVisualParams,
  currentElementLevels: initialElementLevels,
  timeUntilNextDay: _initialTimeUntilNextDay,
  dayKey: initialDayKey,
  isDevMode,
  cooldownRemaining: initialCooldown = 0,
  unseenBattles = 0,
  ranking = null,
}: Props) {
  const router = useRouter();

  // --- Live state ---
  const [visualParams, setVisualParams] = useState<VisualParams>({
    ...DEFAULT_VISUAL_PARAMS,
    ...(initialVisualParams as Partial<VisualParams>),
  });
  const [elementLevels, setElementLevels] = useState<Record<string, number>>(
    initialElementLevels,
  );
  const [mutationActive, setMutationActive] = useState(initialMutationActive);
  const [mutationProgress, setMutationProgress] = useState(initialMutationProgress);
  const [canAllocate, setCanAllocate] = useState(initialCanAllocate);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [mutationPhase, setMutationPhase] = useState<string | null>(null);
  const [mutationComplete, setMutationComplete] = useState(false);
  const [tierCelebration, setTierCelebration] = useState<string | null>(null);
  const prevDayRef = useRef(creature.ageDays ?? 0);
  const [dayKey, setDayKey] = useState(initialDayKey);

  // --- Phase ---
  const [panelOpen, setPanelOpen] = useState(false);

  // --- Auto-inject mode ---
  const [autoInject, setAutoInject] = useState(false);
  const [autoRecipe, setAutoRecipe] = useState<Record<string, number> | null>(null);
  const [autoCount, setAutoCount] = useState(0);
  const autoInjectRef = useRef(false);

  // Keep ref in sync
  useEffect(() => { autoInjectRef.current = autoInject; }, [autoInject]);

  // --- Mobile stats panel ---
  const [statsOpen, setStatsOpen] = useState(false);

  // --- Battle notification banner ---
  const [showBattleBanner, setShowBattleBanner] = useState(unseenBattles > 0);

  const _phase: Phase = mutationActive
    ? 'mutating'
    : panelOpen
      ? 'allocating'
      : canAllocate
        ? 'idle'
        : 'waiting';

  // --- Cooldown countdown ---
  const cooldownStartRef = useRef(Date.now());
  const cooldownInitRef = useRef(initialCooldown);

  useEffect(() => {
    cooldownStartRef.current = Date.now();
    cooldownInitRef.current = initialCooldown;
  }, [initialCooldown]);

  useEffect(() => {
    if (cooldown <= 0 && !mutationActive) return;
    const timer = setInterval(() => {
      if (mutationActive) return; // polling handles mutation
      const elapsed = Date.now() - cooldownStartRef.current;
      const remaining = Math.max(0, cooldownInitRef.current - elapsed);
      setCooldown(remaining);
      if (remaining <= 0) {
        setCanAllocate(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [mutationActive, cooldown]);

  // --- Polling: fetch /api/creature/tick every 5s during mutation ---
  useEffect(() => {
    if (!mutationActive) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/creature/tick');
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const d = json.data;
        if (!d || cancelled) return;

        setVisualParams({
          ...DEFAULT_VISUAL_PARAMS,
          ...(d.visualParams as Partial<VisualParams>),
        });
        setElementLevels(d.elementLevels);
        setMutationProgress(d.progress);
        setMutationPhase(d.mutationPhase);

        if (d.ageDays !== undefined) {
          setDayKey(String(d.ageDays));

          // Check for tier change — only when day actually advances during mutation
          const prevDay = prevDayRef.current;
          const newDay = d.ageDays;
          if (newDay > prevDay) {
            const thresholds = [500, 300, 151, 101, 61, 40];
            const tierKeys = ['divine', 'immortal', 'legend', 'veteran', 'intermediate', 'novice'];
            for (let i = 0; i < thresholds.length; i++) {
              if (newDay >= thresholds[i] && prevDay < thresholds[i]) {
                setTierCelebration(tierKeys[i]);
                break;
              }
            }
            prevDayRef.current = newDay;
          }
        }

        if (!d.mutationActive) {
          setMutationActive(false);
          setMutationComplete(true);
          const newCooldown = d.cooldownRemaining ?? 0;
          setCooldown(newCooldown);
          cooldownStartRef.current = Date.now();
          cooldownInitRef.current = newCooldown;
          setCanAllocate(d.canAllocate ?? false);

          // Auto-inject: if enabled, wait for cooldown then re-inject
          if (autoInjectRef.current && autoRecipe) {
            const waitMs = Math.max(newCooldown + 1500, 2500); // wait cooldown + buffer
            setTimeout(async () => {
              if (!autoInjectRef.current) return;
              setMutationComplete(false);
              try {
                const res = await fetch('/api/allocations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ creatureId: creature.id, credits: autoRecipe }),
                });
                if (res.ok) {
                  setAutoCount((c) => c + 1);
                  setMutationActive(true);
                  setMutationProgress(0);
                  setCanAllocate(false);
                } else {
                  setAutoInject(false); // stop on error
                  router.refresh();
                }
              } catch {
                setAutoInject(false);
                router.refresh();
              }
            }, waitMs);
          } else {
            setTimeout(() => {
              setMutationComplete(false);
              router.refresh();
            }, 2500);
          }
        }
      } catch {
        // silently retry next cycle
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mutationActive, router]);

  // --- Stop auto-inject ---
  const stopAutoInject = useCallback(() => {
    setAutoInject(false);
    setAutoRecipe(null);
    setAutoCount(0);
  }, []);

  // --- Allocation callback ---
  const handleAllocated = useCallback((recipe?: Record<string, number>) => {
    setPanelOpen(false);
    setMutationActive(true);
    setMutationProgress(0);
    setCanAllocate(false);
    // If a recipe is passed, store it for potential auto-inject
    if (recipe) setAutoRecipe(recipe);
  }, []);

  // --- Creature name state ---
  const [creatureName, setCreatureName] = useState(creature.name);

  // --- Derived values ---
  const ageDays = parseInt(dayKey, 10) || (creature.ageDays ?? 0);
  const generation = creature.generation ?? 1;
  const stability = creature.stability ?? 0.5;
  const activeSynergies = getActiveSynergies(elementLevels);
  const progressPercent = Math.round(mutationProgress * 100);

  // --- Tier bonus credits ---
  const creatureTier = getRankTier(ageDays);
  const bonusCredits = creatureTier === 'divine'
    ? GAME_CONFIG.DIVINE_CREDIT_BONUS
    : creatureTier === 'immortal'
      ? GAME_CONFIG.IMMORTAL_CREDIT_BONUS
      : 0;

  // --- Warrior phase detection ---
  const isWarrior = ageDays >= GAME_CONFIG.WARRIOR_PHASE_START;
  const combatTraitValues = COMBAT_TRAITS.map((ct) => (creature.traitValues[ct] ?? 0));
  const combatPowerTotal = Math.round(combatTraitValues.reduce((a, b) => a + b, 0));
  const hasCombatStats = combatTraitValues.some((v) => v > 0.5);

  // Max element value for bar scaling
  const maxElementLevel = Math.max(
    ...ELEMENTS.map((el) => elementLevels[el] ?? 0),
    1,
  );
  const barScale = Math.max(maxElementLevel, 50);

  // ---- Render ----

  return (
    <div className="relative flex h-full flex-col md:flex-row">
      {/* ============================================================= */}
      {/* LEFT PANEL — Desktop only: creature info, elements, synergies  */}
      {/* ============================================================= */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/50 bg-surface/80 md:flex">
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* Personality donut — centered */}
          <div className="flex justify-center">
            <PersonalityRadar elementLevels={elementLevels} size={150} />
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-border/20" />

          {/* Element levels — centered title + bars */}
          <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-muted">
            Elementi
          </p>
          <div className="flex flex-col gap-0.5">
            {ELEMENTS.map((el) => {
              const level = Math.round(elementLevels[el] ?? 0);
              const color = ELEMENT_COLORS[el];
              const barWidth = barScale > 0 ? (level / barScale) * 100 : 0;

              return (
                <div key={el} className="flex h-[22px] items-center gap-1.5">
                  <span
                    className="w-6 shrink-0 text-right text-[10px] font-black"
                    style={{ color }}
                  >
                    {el}
                  </span>
                  <div className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-surface-3/60">
                    <div
                      className="h-full rounded-sm transition-all duration-700 ease-out"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: color,
                        boxShadow: level > 0 ? `0 0 6px ${color}44` : undefined,
                        opacity: level > 0 ? 1 : 0.2,
                      }}
                    />
                  </div>
                  <span
                    className="w-5 shrink-0 text-right text-[10px] font-semibold tabular-nums"
                    style={{ color: level > 0 ? color : 'var(--color-muted)' }}
                  >
                    {level}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-border/20" />

          {/* Synergies */}
          <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-widest text-muted">
            Sinergie
          </p>
          {activeSynergies.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5">
              {activeSynergies.map((name) => {
                const color = SYNERGY_COLORS[name] ?? '#6b6d7b';
                return (
                  <span key={name} className="inline-flex items-center gap-1 py-0.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}88` }}
                    />
                    <span className="text-[10px] font-semibold" style={{ color, textShadow: `0 0 6px ${color}33` }}>
                      {name}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="block text-center text-[10px] text-muted">Nessuna attiva</span>
          )}

          {/* Combat stats — Warrior Phase */}
          {(hasCombatStats || ranking) && (
            <>
              <div className="my-2 border-t border-border/20" />
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <span
                  className="rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-400"
                  style={{ textShadow: '0 0 8px #ff3d3d33' }}
                >
                  Fase Guerriero
                </span>
              </div>

              {/* ELO + AXP + Record */}
              {ranking && (
                <div className="flex flex-col items-center gap-0.5 mb-1">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-[11px] font-mono font-bold text-foreground" style={{ textShadow: '0 0 8px #ff3d3d33' }}>
                      ELO {ranking.eloRating}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span className="text-accent">{ranking.wins}V</span>
                      <span className="text-danger">{ranking.losses}S</span>
                      {ranking.draws > 0 && <span className="text-muted">{ranking.draws}P</span>}
                    </div>
                  </div>
                  {(ranking.axp ?? 0) > 0 && (
                    <span className={`text-[10px] font-mono font-semibold ${
                      (ranking.axp ?? 0) >= 200 ? 'text-amber-400' :
                      (ranking.axp ?? 0) >= 100 ? 'text-bio-purple' :
                      (ranking.axp ?? 0) >= 50 ? 'text-primary' : 'text-muted'
                    }`}>
                      AXP {ranking.axp}
                    </span>
                  )}
                </div>
              )}

              {hasCombatStats && (
                <div className="flex flex-col gap-0.5">
                  {COMBAT_TRAITS.map((ct) => {
                    const value = Math.round(creature.traitValues[ct] ?? 0);
                    const color = COMBAT_TRAIT_COLORS[ct];
                    const label = COMBAT_TRAIT_LABELS[ct];
                    const barWidth = value;
                    return (
                      <div key={ct} className="flex h-[20px] items-center gap-1.5">
                        <span
                          className="w-[52px] shrink-0 text-right text-[9px] font-bold"
                          style={{ color }}
                        >
                          {label}
                        </span>
                        <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-surface-3/60">
                          <div
                            className="h-full rounded-sm transition-all duration-700 ease-out"
                            style={{
                              width: `${barWidth}%`,
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
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-center text-[9px] font-semibold text-muted">
                Potenza: <span className="text-red-400">{combatPowerTotal}</span>
              </p>
            </>
          )}

        </div>

      </aside>

      {/* ============================================================= */}
      {/* MOBILE: Stats slide-out panel                                  */}
      {/* ============================================================= */}

      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          statsOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setStatsOpen(false)}
      />

      {/* Slide-out panel */}
      <div
        className={`fixed left-0 top-0 z-50 flex h-full w-[260px] flex-col border-r border-border/50 bg-surface/95 backdrop-blur-md transition-transform duration-300 ease-out md:hidden ${
          statsOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Statistiche
          </span>
          <button
            onClick={() => setStatsOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel content — same as desktop sidebar */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted">
            Elementi
          </p>
          <div className="flex flex-col gap-0.5">
            {ELEMENTS.map((el) => {
              const level = Math.round(elementLevels[el] ?? 0);
              const color = ELEMENT_COLORS[el];
              const bw = barScale > 0 ? (level / barScale) * 100 : 0;
              return (
                <div key={el} className="flex h-[22px] items-center gap-1.5">
                  <span className="w-6 shrink-0 text-right text-[10px] font-black" style={{ color }}>{el}</span>
                  <div className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-surface-3/60">
                    <div
                      className="h-full rounded-sm transition-all duration-700 ease-out"
                      style={{
                        width: `${bw}%`,
                        backgroundColor: color,
                        boxShadow: level > 0 ? `0 0 6px ${color}44` : undefined,
                        opacity: level > 0 ? 1 : 0.2,
                      }}
                    />
                  </div>
                  <span
                    className="w-5 shrink-0 text-right text-[10px] font-semibold tabular-nums"
                    style={{ color: level > 0 ? color : 'var(--color-muted)' }}
                  >
                    {level}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Synergies */}
          <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-widest text-muted">
            Sinergie
          </p>
          {activeSynergies.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {activeSynergies.map((name) => {
                const color = SYNERGY_COLORS[name] ?? '#6b6d7b';
                return (
                  <div key={name} className="flex items-center gap-1.5 py-0.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}88` }}
                    />
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color, textShadow: `0 0 6px ${color}33` }}
                    >
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-[10px] text-muted">Nessuna attiva</span>
          )}

          {/* Personality radar */}
          <PersonalityRadar elementLevels={elementLevels} size={120} />

          {/* Combat stats — mobile */}
          {(hasCombatStats || ranking) && (
            <>
              <div className="my-2 border-t border-border/20" />
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <span
                  className="rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-400"
                  style={{ textShadow: '0 0 8px #ff3d3d33' }}
                >
                  Fase Guerriero
                </span>
              </div>

              {ranking && (
                <div className="flex flex-col items-center gap-0.5 mb-1">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-[11px] font-mono font-bold text-foreground" style={{ textShadow: '0 0 8px #ff3d3d33' }}>
                      ELO {ranking.eloRating}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span className="text-accent">{ranking.wins}V</span>
                      <span className="text-danger">{ranking.losses}S</span>
                      {ranking.draws > 0 && <span className="text-muted">{ranking.draws}P</span>}
                    </div>
                  </div>
                  {(ranking.axp ?? 0) > 0 && (
                    <span className={`text-[10px] font-mono font-semibold ${
                      (ranking.axp ?? 0) >= 200 ? 'text-amber-400' :
                      (ranking.axp ?? 0) >= 100 ? 'text-bio-purple' :
                      (ranking.axp ?? 0) >= 50 ? 'text-primary' : 'text-muted'
                    }`}>
                      AXP {ranking.axp}
                    </span>
                  )}
                </div>
              )}

              {hasCombatStats && (
                <div className="flex flex-col gap-0.5">
                  {COMBAT_TRAITS.map((ct) => {
                    const value = Math.round(creature.traitValues[ct] ?? 0);
                    const color = COMBAT_TRAIT_COLORS[ct];
                    const label = COMBAT_TRAIT_LABELS[ct];
                    const barWidth = value;
                    return (
                      <div key={ct} className="flex h-[20px] items-center gap-1.5">
                        <span
                          className="w-[52px] shrink-0 text-right text-[9px] font-bold"
                          style={{ color }}
                        >
                          {label}
                        </span>
                        <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-surface-3/60">
                          <div
                            className="h-full rounded-sm transition-all duration-700 ease-out"
                            style={{
                              width: `${barWidth}%`,
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
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-center text-[9px] font-semibold text-muted">
                Potenza: <span className="text-red-400">{combatPowerTotal}</span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* MOBILE: Floating stats button (bottom-left, above nav)         */}
      {/* ============================================================= */}
      <button
        onClick={() => setStatsOpen(true)}
        className="fixed bottom-16 left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-surface/90 text-muted shadow-lg backdrop-blur-md transition-all active:scale-90 md:hidden"
        style={{ boxShadow: '0 0 12px #3d5afe22' }}
        aria-label="Apri statistiche"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      </button>

      {/* ============================================================= */}
      {/* MOBILE: PWA install badge (bottom-right, above nav)             */}
      {/* ============================================================= */}
      <InstallButton variant="badge" />

      {/* ============================================================= */}
      {/* MOBILE HEADER — Compact single line (below md only)            */}
      {/* ============================================================= */}
      <div className="flex shrink-0 items-center justify-center gap-2 px-4 pt-3 md:hidden">
        <EditableCreatureName
          creatureId={creature.id}
          name={creatureName}
          onNameChange={setCreatureName}
          className="text-sm"
        />
        <span className="text-border">·</span>
        <StatsBar ageDays={ageDays} generation={generation} stability={stability} compact isWarrior={isWarrior} />
        <span className={`rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getLevelBadge(ageDays, ranking?.tier).color} ${getLevelBadge(ageDays, ranking?.tier).bg}`}>
          {getLevelBadge(ageDays, ranking?.tier).label}
        </span>
      </div>

      {/* ============================================================= */}
      {/* RIGHT AREA — Name/day ABOVE creature, countdown/button BELOW   */}
      {/* ============================================================= */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto overflow-x-hidden">
        {/* Battle notification banner */}
        {showBattleBanner && (
          <div className="w-full shrink-0 px-4 pt-2">
            <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-danger">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                <p className="text-[11px] text-danger">
                  Il tuo guerriero ha combattuto!{' '}
                  <Link href="/arena" className="font-bold underline hover:text-danger/80">
                    Vai all&apos;Arena per vedere i risultati.
                  </Link>
                </p>
              </div>
              <button
                onClick={() => setShowBattleBanner(false)}
                className="shrink-0 rounded p-0.5 text-danger/60 hover:text-danger"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* NAME + DAY — above the creature (desktop) */}
        <div className="hidden shrink-0 flex-col items-center gap-1 pt-5 pb-1 md:flex">
          <div className="flex items-center gap-2">
            <EditableCreatureName
              creatureId={creature.id}
              name={creatureName}
              onNameChange={setCreatureName}
              className="text-lg"
            />
            {/* Guide link — desktop */}
            <Link
              href="/guida"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/50 text-muted transition-colors hover:border-primary/40 hover:text-primary"
              title="Guida"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01" />
              </svg>
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <StatsBar ageDays={ageDays} generation={generation} stability={stability} compact isWarrior={isWarrior} />
            <span className={`rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getLevelBadge(ageDays, ranking?.tier).color} ${getLevelBadge(ageDays, ranking?.tier).bg}`}>
              {getLevelBadge(ageDays, ranking?.tier).label}
            </span>
          </div>
        </div>

        {/* CREATURE IN LAB CHAMBER — centered */}
        <div className="relative flex flex-1 items-center justify-center px-2">
          <div className="relative">
            {/* Mobile chamber */}
            <div className="md:hidden">
              <LabChamber width={260} height={320} mutating={mutationActive} glowColor={`hsl(${visualParams.glowHue ?? 210}, 70%, 55%)`} stability={stability} dayNumber={ageDays}>
                <div style={mutationActive ? { animation: 'mutation-morph 2s ease-in-out infinite' } : { animation: 'breathe 4s ease-in-out infinite' }}>
                  <CreatureRenderer params={visualParams} size={240} animated seed={42} />
                </div>
              </LabChamber>
            </div>
            {/* Desktop chamber */}
            <div className="hidden md:block">
              <LabChamber
                width={Math.min(420, typeof window !== 'undefined' ? window.innerHeight - 320 : 420)}
                height={Math.min(480, typeof window !== 'undefined' ? window.innerHeight - 240 : 480)}
                mutating={mutationActive}
                glowColor={`hsl(${visualParams.glowHue ?? 210}, 70%, 55%)`}
                stability={stability}
                dayNumber={ageDays}
              >
                <div
                  style={mutationActive ? { animation: 'mutation-morph 2s ease-in-out infinite' } : { animation: 'breathe 4s ease-in-out infinite' }}
                  className="[&>svg]:h-auto [&>svg]:w-full"
                >
                  <CreatureRenderer params={visualParams} size={460} animated seed={42} />
                </div>
              </LabChamber>
            </div>

            {/* Mutation complete flash */}
            {mutationComplete && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span
                  className="rounded-full bg-accent/20 px-5 py-2 text-sm font-black text-accent backdrop-blur-sm"
                  style={{ textShadow: '0 0 12px #00e5a088', animation: 'pulse-glow 0.5s ease-out' }}
                >
                  Mutazione Completa!
                </span>
              </div>
            )}
          </div>
        </div>

        {/* BELOW CREATURE — countdown / progress / button */}
        <div className="shrink-0 w-full px-4 pb-4 pt-2">
          <div className="flex flex-col items-center gap-2">
            {/* Mutation progress bar + phase */}
            {mutationActive && (
              <div className="w-full max-w-xs md:w-80">
                <div className="flex items-center justify-center gap-2 text-xs text-muted mb-1.5">
                  <span>
                    Mutazione{' '}
                    <span className="font-bold text-bio-purple">{progressPercent}%</span>
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      background: 'linear-gradient(90deg, #b26eff, #00f0ff, #00e5a0)',
                      boxShadow: '0 0 12px #b26eff66',
                    }}
                  />
                  <div
                    className="absolute top-0 h-full w-3"
                    style={{
                      left: `${Math.max(0, progressPercent - 2)}%`,
                      background: 'linear-gradient(90deg, transparent, #00f0ff88)',
                      animation: 'pulse-glow 1.5s ease-in-out infinite',
                    }}
                  />
                </div>
                {mutationPhase && (
                  <p className="mt-1 text-center text-[10px] capitalize text-muted">
                    {mutationPhase === 'destabilize' && 'Destabilizzazione...'}
                    {mutationPhase === 'reshape' && 'Rimodellamento...'}
                    {mutationPhase === 'detail' && 'Dettagli emergenti...'}
                    {mutationPhase === 'stabilize' && 'Stabilizzazione...'}
                  </p>
                )}
              </div>
            )}

            {/* Cooldown countdown */}
            {!canAllocate && !mutationActive && cooldown > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-primary">
                  <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.5a.75.75 0 0 0-1.5 0V8c0 .284.16.544.414.67l2.5 1.25a.75.75 0 1 0 .672-1.34L8.75 7.69V4.5Z" clipRule="evenodd" />
                </svg>
                <span>
                  Prossimo esperimento tra{' '}
                  <span className="font-semibold tabular-nums text-foreground">{formatTime(cooldown)}</span>
                </span>
              </div>
            )}

            {/* INJECT BUTTON — appears here when ready */}
            {canAllocate && !mutationActive && !panelOpen && !autoInject && (
              <button
                onClick={() => setPanelOpen(true)}
                className="group relative w-full max-w-xs overflow-hidden rounded-xl bg-accent/10 px-8 py-3 text-sm font-bold text-accent transition-all hover:bg-accent/20 active:scale-95 md:w-auto md:max-w-none"
                style={{
                  boxShadow: '0 0 24px #00e5a022, 0 0 48px #00e5a011',
                  border: '1px solid #00e5a033',
                  minHeight: '48px',
                }}
              >
                <span className="relative z-10">Inietta Esperimento</span>
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'linear-gradient(90deg, transparent, #00e5a044, transparent)',
                    animation: 'shimmer 3s ease-in-out infinite',
                  }}
                />
              </button>
            )}

            {/* AUTO-INJECT TOGGLE — shown after first injection when recipe exists */}
            {autoRecipe && !panelOpen && (
              <div className="flex items-center justify-center gap-3 mt-1">
                {!autoInject ? (
                  <button
                    onClick={() => { setAutoInject(true); setAutoCount(0); }}
                    className="flex items-center gap-2 rounded-lg border border-bio-purple/30 bg-bio-purple/10 px-4 py-2 text-xs font-semibold text-bio-purple transition-all hover:bg-bio-purple/20 active:scale-95"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm4.78 1.97a.75.75 0 0 0-1.06 1.06L7.44 8.75 5.72 10.47a.75.75 0 1 0 1.06 1.06l2.25-2.25a.75.75 0 0 0 0-1.06L6.78 5.97Zm3.44 4.78a.75.75 0 0 0 0-1.5H9.5a.75.75 0 0 0 0 1.5h.72Z" />
                    </svg>
                    Auto-iniezione
                  </button>
                ) : (
                  <button
                    onClick={stopAutoInject}
                    className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/15 px-4 py-2 text-xs font-bold text-danger transition-all hover:bg-danger/25 active:scale-95"
                    style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                    </span>
                    STOP Auto ({autoCount} iniezioni)
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Mobile: Guide link */}
        <div className="shrink-0 flex justify-center pb-1 md:hidden">
          <Link
            href="/guida"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium text-muted transition-colors hover:text-primary"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01" />
            </svg>
            Guida
          </Link>
        </div>

      </div>

      {/* === ALLOCATION PANEL OVERLAY === */}
      <AllocationPanel
        creatureId={creature.id}
        elementLevels={elementLevels}
        onAllocated={handleAllocated}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        bonusCredits={bonusCredits}
      />

      {/* Tier celebration overlay */}
      {tierCelebration && (
        <TierCelebration tier={tierCelebration} onClose={() => setTierCelebration(null)} />
      )}
    </div>
  );
}
