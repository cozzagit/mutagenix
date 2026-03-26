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
import { SenescenceCelebration } from './senescence-celebration';
import { WellnessPanel } from '@/components/creature/wellness-panel';
import { CreatureSwitcher } from '@/components/creatures/creature-switcher';

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
  unseenBattleDetails?: Array<{ battleId: string; attackerCreatureName: string; defenderCreatureName: string; won: boolean; date: string }>;
  ranking?: { eloRating: number; wins: number; losses: number; draws: number; tier: string; axp?: number } | null;
  wellness?: { activity: number; hunger: number; boredom: number; fatigue: number; composite: number };
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
  const effectiveTier = ageDays >= 1000 ? 'eternal' : ageDays >= 500 ? 'divine' : ageDays >= 300 ? 'immortal' : ageDays > 150 ? 'legend' : ageDays > 100 ? 'veteran' : ageDays > 60 ? 'intermediate' : 'novice';
  if (effectiveTier === 'eternal') return { label: 'Eterno', color: 'text-amber-300 animate-pulse', bg: 'bg-gradient-to-r from-amber-500/20 via-yellow-300/20 to-amber-500/20 border border-amber-300/50 shadow-[0_0_8px_rgba(252,211,77,0.3)]' };
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
  unseenBattleDetails = [],
  ranking = null,
  wellness,
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
  const [showSenescence, setShowSenescence] = useState(false);
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
  const [showWellnessModal, setShowWellnessModal] = useState(false);
  const [liveWellness, setLiveWellness] = useState(wellness);

  // --- Tournament enrollment banner ---
  const [activeTournament, setActiveTournament] = useState<{id: string; name: string; startsAt: string; participantCount: number; status: string; isEnrolled?: boolean} | null>(null);
  const [tournamentDismissed, setTournamentDismissed] = useState(false);
  const [tournamentCountdown, setTournamentCountdown] = useState('');

  useEffect(() => {
    async function checkTournament() {
      try {
        const res = await fetch('/api/arena/tournaments?status=enrollment,active');
        if (!res.ok) return;
        const json = await res.json();
        const tournaments = json.data ?? [];
        if (tournaments.length > 0) {
          const t = tournaments[0];
          try {
            const detailRes = await fetch('/api/arena/tournaments/' + t.id);
            if (detailRes.ok) {
              const dj = await detailRes.json();
              t.isEnrolled = !!dj.data?.myParticipantId;
            }
          } catch { /* ignore */ }
          setActiveTournament(t);
        }
      } catch { /* ignore */ }
    }
    checkTournament();
  }, []);

  // Countdown timer for tournament
  useEffect(() => {
    if (!activeTournament?.startsAt) return;
    const update = () => {
      const now = Date.now();
      const start = new Date(activeTournament.startsAt).getTime();
      const diff = start - now;
      if (diff <= 0) {
        setTournamentCountdown('');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setTournamentCountdown(`${hours}h ${minutes}m`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [activeTournament?.startsAt]);

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
            const thresholds = [1000, 500, 300, 151, 101, 61, 40];
            const tierKeys = ['eternal', 'divine', 'immortal', 'legend', 'veteran', 'intermediate', 'novice'];
            for (let i = 0; i < thresholds.length; i++) {
              if (newDay >= thresholds[i] && prevDay < thresholds[i]) {
                setTierCelebration(tierKeys[i]);
                break;
              }
            }
            // Senescence celebration at Day 1000
            if (newDay >= 1000 && prevDay < 1000) {
              setShowSenescence(true);
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
    // Immediately boost hunger + activity in local wellness state
    setLiveWellness((prev) => prev ? {
      ...prev,
      hunger: 100,
      activity: Math.min(100, prev.activity + 20),
      composite: Math.round((Math.min(100, prev.activity + 20) + 100 + prev.boredom + prev.fatigue) / 4),
    } : prev);
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
  const bonusCredits = creatureTier === 'eternal'
    ? GAME_CONFIG.ETERNAL_CREDIT_BONUS
    : creatureTier === 'divine'
      ? GAME_CONFIG.DIVINE_CREDIT_BONUS
      : creatureTier === 'immortal'
        ? GAME_CONFIG.IMMORTAL_CREDIT_BONUS
        : 0;

  // --- Warrior phase detection ---
  const isWarrior = ageDays >= GAME_CONFIG.WARRIOR_PHASE_START;
  const combatTraitValues = COMBAT_TRAITS.map((ct) => (creature.traitValues[ct] ?? 0));

  // --- Overdose detection (element saturation warning) ---
  const totalElements = ELEMENTS.reduce((s, el) => s + (elementLevels[el as string] ?? 0), 0);
  const saturatedElements = totalElements >= GAME_CONFIG.OVERDOSE_MIN_TOTAL
    ? ELEMENTS.filter((el) => (elementLevels[el as string] ?? 0) / totalElements > GAME_CONFIG.OVERDOSE_MILD_THRESHOLD)
    : [];
  const worstSaturation = saturatedElements.length > 0
    ? Math.max(...saturatedElements.map((el) => (elementLevels[el as string] ?? 0) / totalElements))
    : 0;
  const overdoseLevel = worstSaturation > GAME_CONFIG.OVERDOSE_CRITICAL_THRESHOLD
    ? 'critico'
    : worstSaturation > GAME_CONFIG.OVERDOSE_SEVERE_THRESHOLD
      ? 'severo'
      : worstSaturation > GAME_CONFIG.OVERDOSE_MILD_THRESHOLD
        ? 'lieve'
        : null;
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
        className={`fixed left-0 top-0 z-50 flex w-[260px] flex-col border-r border-border/50 bg-surface/95 backdrop-blur-md transition-transform duration-300 ease-out md:hidden ${
          statsOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ height: 'calc(100dvh - 48px - env(safe-area-inset-bottom, 0px))' }}
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
        <CreatureSwitcher currentCreatureId={creature.id} />
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
        {/* Tournament enrollment banner */}
        {activeTournament && !tournamentDismissed && (
          <div className="w-full shrink-0 px-4 pt-2">
            <div
              className="relative overflow-hidden rounded-xl border-2 px-4 py-3"
              style={{
                borderColor: activeTournament.status === 'enrollment' ? '#ff910080' : '#3d5afe80',
                backgroundColor: activeTournament.status === 'enrollment' ? 'rgba(255, 145, 0, 0.08)' : 'rgba(61, 90, 254, 0.08)',
                boxShadow: activeTournament.status === 'enrollment'
                  ? '0 0 20px rgba(255, 145, 0, 0.15), inset 0 0 20px rgba(255, 145, 0, 0.05)'
                  : '0 0 20px rgba(61, 90, 254, 0.15), inset 0 0 20px rgba(61, 90, 254, 0.05)',
                animation: activeTournament.status === 'enrollment' ? 'tournament-glow 2s ease-in-out infinite alternate' : undefined,
              }}
            >
              <style>{`
                @keyframes tournament-glow {
                  from { box-shadow: 0 0 15px rgba(255, 145, 0, 0.1), inset 0 0 15px rgba(255, 145, 0, 0.03); }
                  to { box-shadow: 0 0 25px rgba(255, 145, 0, 0.25), inset 0 0 25px rgba(255, 145, 0, 0.08); }
                }
              `}</style>

              {/* Dismiss */}
              <button
                onClick={() => setTournamentDismissed(true)}
                className="absolute right-2 top-2 shrink-0 rounded p-0.5 text-muted/60 hover:text-foreground z-10"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-2xl">{'\u{1F3C6}'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground leading-tight">
                    {activeTournament.name}
                  </p>
                  {activeTournament.status === 'enrollment' ? (
                    <>
                      <p className="text-xs font-bold mt-0.5" style={{ color: '#ff9100' }}>
                        Iscrizioni aperte! Inizia il 26 Marzo alle 20:00
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-muted">
                          {activeTournament.participantCount} partecipanti iscritti
                        </span>
                        {tournamentCountdown && (
                          <span className="text-[11px] font-mono font-bold" style={{ color: '#ff9100' }}>
                            Inizia tra {tournamentCountdown}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs font-bold mt-0.5" style={{ color: '#3d5afe' }}>
                      Torneo in corso!
                    </p>
                  )}
                </div>
              </div>

              {activeTournament.status === 'enrollment' && !activeTournament.isEnrolled && (
                <Link
                  href="/arena"
                  className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:brightness-110"
                  style={{
                    background: 'linear-gradient(135deg, #ff6b00, #ff3d3d)',
                    boxShadow: '0 0 12px rgba(255, 107, 0, 0.3)',
                  }}
                >
                  <span>{'\u2694\uFE0F'}</span> ISCRIVITI ORA
                </Link>
              )}
              {activeTournament.status === 'enrollment' && activeTournament.isEnrolled && (
                <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-accent/15 border border-accent/30 px-4 py-2">
                  <span className="text-accent text-sm">{'\u2705'}</span>
                  <span className="text-[11px] font-bold text-accent">Sei iscritto! Preparati per la battaglia.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wellness status summary banner */}
        {liveWellness && (
          <div className="w-full shrink-0 px-4 pt-2">
            <div
              className="flex w-full items-center justify-between rounded-xl border px-4 py-3"
              style={{
                borderColor: liveWellness.composite >= 60 ? '#00e5a030' : liveWellness.composite >= 30 ? '#ff910030' : '#ff3d3d30',
                backgroundColor: liveWellness.composite >= 60 ? 'rgba(0, 229, 160, 0.06)' : liveWellness.composite >= 30 ? 'rgba(255, 145, 0, 0.06)' : 'rgba(255, 61, 61, 0.06)',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg md:text-xl">{liveWellness.composite >= 60 ? '\uD83D\uDC9A' : liveWellness.composite >= 30 ? '\uD83D\uDFE1' : '\uD83D\uDD34'}</span>
                <div>
                  <p className="text-sm font-bold md:text-base" style={{ color: liveWellness.composite >= 60 ? '#00e5a0' : liveWellness.composite >= 30 ? '#ff9100' : '#ff3d3d' }}>
                    {liveWellness.composite >= 80 ? 'In forma perfetta' : liveWellness.composite >= 60 ? 'Condizioni buone' : liveWellness.composite >= 40 ? 'Necessita attenzione' : liveWellness.composite >= 20 ? 'Condizioni critiche' : 'Stato di emergenza'}
                  </p>
                  <p className="text-xs text-muted md:text-sm">
                    {liveWellness.hunger < 30 && 'Ha fame \u2014 inietta! '}
                    {liveWellness.boredom < 30 && 'Si annoia \u2014 combatti! '}
                    {liveWellness.fatigue < 30 && 'Stanca \u2014 falla riposare! '}
                    {liveWellness.activity < 30 && 'Inattiva \u2014 torna pi\u00F9 spesso! '}
                    {liveWellness.composite >= 70 && 'Nutrimento, attivit\u00E0 e stimoli nella norma.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-bold md:text-sm"
                  style={{
                    color: liveWellness.composite >= 60 ? '#00e5a0' : liveWellness.composite >= 30 ? '#ff9100' : '#ff3d3d',
                    backgroundColor: liveWellness.composite >= 60 ? '#00e5a015' : liveWellness.composite >= 30 ? '#ff910015' : '#ff3d3d15',
                  }}
                >
                  {liveWellness.composite}%
                </span>
                <button
                  onClick={() => setShowWellnessModal(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border/50 text-muted transition-colors hover:border-primary/40 hover:text-primary"
                  title="Cos'\u00E8 lo Stato Vitale?"
                >
                  <span className="text-xs font-bold">?</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Battle notification banner — detailed */}
        {showBattleBanner && (
          <div className="w-full shrink-0 px-4 pt-2">
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{'\u2694\uFE0F'}</span>
                  <span className="text-xs font-bold text-danger">
                    {unseenBattles} sfid{unseenBattles === 1 ? 'a' : 'e'} subita{unseenBattles === 1 ? '' : 'e'}!
                  </span>
                </div>
                <button onClick={() => setShowBattleBanner(false)} className="shrink-0 rounded p-0.5 text-danger/60 hover:text-danger">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>
              {unseenBattleDetails.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {unseenBattleDetails.slice(0, 5).map((b) => (
                    <Link
                      key={b.battleId}
                      href={`/arena/battle/${b.battleId}`}
                      className="flex items-center justify-between rounded-lg bg-background/40 px-2.5 py-1.5 transition-colors hover:bg-background/60"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black ${b.won ? 'text-accent' : 'text-danger'}`}>
                          {b.won ? 'VINTO' : 'PERSO'}
                        </span>
                        <span className="text-[10px] text-muted">
                          {b.attackerCreatureName} ha attaccato {b.defenderCreatureName}
                        </span>
                      </div>
                      <span className="text-[9px] text-primary font-bold">Rivedi &rarr;</span>
                    </Link>
                  ))}
                  {unseenBattleDetails.length > 5 && (
                    <Link href="/arena" className="text-center text-[10px] text-danger/70 underline hover:text-danger">
                      +{unseenBattleDetails.length - 5} altre sfide
                    </Link>
                  )}
                </div>
              ) : (
                <Link href="/arena" className="text-[10px] text-danger/80 underline hover:text-danger">
                  Vai all&apos;Arena per i dettagli
                </Link>
              )}
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
            <CreatureSwitcher currentCreatureId={creature.id} />
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

            {/* Wellness Panel */}
            {liveWellness && <WellnessPanel wellness={liveWellness} />}

            {/* Overdose warning */}
            {overdoseLevel && !mutationActive && (
              <div
                className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-[11px] leading-relaxed"
                style={{
                  borderLeft: `3px solid ${overdoseLevel === 'critico' ? '#ff3d3d' : overdoseLevel === 'severo' ? '#ff9100' : '#ffd600'}`,
                  backgroundColor: overdoseLevel === 'critico'
                    ? 'rgba(255, 61, 61, 0.08)'
                    : overdoseLevel === 'severo'
                      ? 'rgba(255, 145, 0, 0.06)'
                      : 'rgba(255, 214, 0, 0.05)',
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: overdoseLevel === 'critico' ? '#ff3d3d' : overdoseLevel === 'severo' ? '#ff9100' : '#ffd600' }}>
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-bold" style={{ color: overdoseLevel === 'critico' ? '#ff3d3d' : overdoseLevel === 'severo' ? '#ff9100' : '#ffd600' }}>
                    Sovradosaggio {overdoseLevel}
                  </span>
                  <p className="mt-0.5 text-muted">
                    {saturatedElements.map((el) => el).join(', ')} {saturatedElements.length > 1 ? 'sono' : 'è'} in
                    eccesso. Diversifica le iniezioni per evitare sprechi di crediti.
                  </p>
                </div>
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

      {/* Senescence celebration overlay */}
      {showSenescence && (
        <SenescenceCelebration creatureName={creatureName} onClose={() => setShowSenescence(false)} />
      )}

      {/* Wellness info modal */}
      {showWellnessModal && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowWellnessModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/50 bg-surface p-6 my-auto max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-center text-xl font-black text-foreground">
              Stato Vitale
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-muted">
              <p>
                La tua creatura ha bisogno di <span className="font-bold text-foreground">cure costanti</span> per restare in forma.
                Quattro indicatori misurano il suo benessere:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-base">{'\u26A1'}</span>
                  <div>
                    <p className="font-bold text-foreground">Attivit&agrave;</p>
                    <p className="text-xs">Quanto spesso inietti. Serve iniettare regolarmente negli ultimi 7 giorni per mantenerla alta (5 iniezioni = 100%).</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-base">{'\uD83E\uDDEA'}</span>
                  <div>
                    <p className="font-bold text-foreground">Nutrimento</p>
                    <p className="text-xs">Quanto tempo &egrave; passato dall&apos;ultima iniezione. Decade gradualmente in 3 giorni. Inietta almeno ogni 1-2 giorni!</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-base">{'\u2694\uFE0F'}</span>
                  <div>
                    <p className="font-bold text-foreground">Stimolo</p>
                    <p className="text-xs">Quanto tempo &egrave; passato dall&apos;ultima battaglia in Arena. Decade gradualmente in 5 giorni. Una battaglia ogni pochi giorni basta!</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-base">{'\uD83D\uDCA4'}</span>
                  <div>
                    <p className="font-bold text-foreground">Energia</p>
                    <p className="text-xs">Quante battaglie ha combattuto oggi. Ogni battaglia costa il 12%. Troppi combattimenti la stancano!</p>
                  </div>
                </div>
              </div>
              <div
                className="rounded-lg p-3 text-xs"
                style={{
                  borderLeft: '3px solid #ff3d3d',
                  backgroundColor: 'rgba(255, 61, 61, 0.06)',
                }}
              >
                <p className="font-bold text-foreground mb-1">Effetti in battaglia</p>
                <p>
                  Una creatura trascurata (fame, noia, inattivit&agrave;) o stremata (troppe battaglie) subisce
                  penalit&agrave; agli stats di combattimento fino al <strong>40%</strong>. Tieni la tua creatura
                  in forma per avere il massimo vantaggio!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowWellnessModal(false)}
              className="mt-5 w-full rounded-xl border border-primary/30 bg-primary/15 px-4 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/25"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
