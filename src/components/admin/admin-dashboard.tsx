'use client';

import { useState, useMemo } from 'react';
import {
  CreatureRenderer,
  DEFAULT_VISUAL_PARAMS,
} from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import type { ElementLevels, TraitValues } from '@/lib/db/schema/creatures';
import { PersonalityRadar } from '@/components/lab/personality-radar';
import { COMBAT_TRAITS, GAME_CONFIG } from '@/lib/game-engine/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RankingData {
  eloRating: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  tier: string;
  recoveryUntil: string | null;
  traumaActive: boolean;
  consecutiveLosses: number;
}

interface AdminCreature {
  id: string;
  name: string;
  ageDays: number;
  generation: number;
  stability: number;
  isArchived: boolean;
  archiveReason: string | null;
  archivedAt: string | null;
  elementLevels: ElementLevels;
  traitValues: TraitValues;
  visualParams: Record<string, unknown>;
  ranking: RankingData | null;
}

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  creatures: AdminCreature[];
  totalBattles: number;
}

interface AdminStats {
  totalUsers: number;
  activeCreatures: number;
  archivedCreatures: number;
  totalBattles: number;
  warriorsInArena: number;
}

interface AdminDashboardProps {
  data: AdminUser[];
  stats: AdminStats;
}

type SortMode = 'newest' | 'most-evolved';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stabilityColor(stability: number): string {
  if (stability >= 0.7) return 'bg-emerald-500';
  if (stability >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

const PERSONALITY_TRAITS: { key: string; label: string }[] = [
  { key: 'aggression', label: 'Aggressivita' },
  { key: 'luminosity', label: 'Luminosita' },
  { key: 'toxicity', label: 'Tossicita' },
  { key: 'intelligence', label: 'Intelligenza' },
  { key: 'armoring', label: 'Corazza' },
];

function getDominantPersonality(traitValues: TraitValues): { label: string; value: number } | null {
  let best: { label: string; value: number } | null = null;
  for (const pt of PERSONALITY_TRAITS) {
    const val = (traitValues as Record<string, number>)[pt.key] ?? 0;
    if (!best || val > best.value) {
      best = { label: pt.label, value: val };
    }
  }
  if (best && best.value <= 0) return null;
  return best;
}

function archiveReasonLabel(reason: string | null): string {
  if (reason === 'reset') return 'RESET';
  if (reason === 'failed') return 'FALLITO';
  return 'ARCHIVIATA';
}

const ELEMENT_LABELS: Record<string, string> = {
  N: 'Azoto', K: 'Potassio', Na: 'Sodio', C: 'Carbonio', O: 'Ossigeno',
  P: 'Fosforo', S: 'Zolfo', Ca: 'Calcio', Fe: 'Ferro', Cl: 'Cloro',
};

const COMBAT_TRAIT_LABELS: Record<string, string> = {
  attackPower: 'Attacco', defense: 'Difesa', speed: 'Velocita',
  stamina: 'Resistenza', specialAttack: 'Speciale', battleScars: 'Cicatrici',
};

const COMBAT_TRAIT_COLORS: Record<string, string> = {
  attackPower: '#ff3d3d', defense: '#4488ff', speed: '#00e5e5',
  stamina: '#ff9100', specialAttack: '#b26eff', battleScars: '#8a8a8a',
};

const TIER_LABELS: Record<string, string> = {
  novice: 'Novizio',
  intermediate: 'Intermedio',
  veteran: 'Veterano',
  legend: 'Leggenda',
};

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-surface/60 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder blob for creatures without visual params
// ---------------------------------------------------------------------------

function PlaceholderBlob({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="opacity-30">
      <ellipse cx={40} cy={42} rx={28} ry={24} fill="hsl(220, 10%, 30%)" opacity={0.6} />
      <ellipse cx={40} cy={38} rx={22} ry={18} fill="hsl(220, 10%, 40%)" opacity={0.4} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Creature mini-card (inside user card)
// ---------------------------------------------------------------------------

function CreatureMiniCard({
  creature,
  onClick,
}: {
  creature: AdminCreature;
  onClick: () => void;
}) {
  const isArchived = creature.isArchived;
  const svgSize = isArchived ? 40 : 60;

  const visualParams: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  const personality = getDominantPersonality(creature.traitValues);
  const isWarrior = creature.ageDays >= GAME_CONFIG.WARRIOR_PHASE_START;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-all hover:border-border active:scale-[0.99] ${
        isArchived
          ? 'border-border/20 bg-surface/20 opacity-60 hover:opacity-80'
          : 'border-border/40 bg-surface/50 hover:bg-surface/70'
      }`}
    >
      {/* Label */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            isArchived
              ? 'bg-muted/20 text-muted'
              : 'bg-emerald-500/15 text-emerald-400'
          }`}
        >
          {isArchived ? archiveReasonLabel(creature.archiveReason) : 'ATTIVA'}
        </span>
        {isWarrior && !isArchived && (
          <span
            className="rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400"
          >
            Guerriero
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* SVG */}
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden ${
            isArchived ? 'opacity-50' : ''
          }`}
          style={{ width: svgSize, height: svgSize }}
        >
          <CreatureRenderer
            params={visualParams}
            size={svgSize}
            animated={false}
            seed={42}
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold ${isArchived ? 'text-xs text-muted' : 'text-sm text-foreground'}`}>
            {creature.name}
          </p>
          <p className="text-[11px] text-muted">
            Day {creature.ageDays} &middot; Gen {creature.generation}
          </p>

          {/* Arena stats for active creatures */}
          {!isArchived && creature.ranking && (
            <p className="mt-0.5 text-[11px]">
              <span className="text-muted">ELO </span>
              <span className="font-bold text-foreground">{creature.ranking.eloRating}</span>
              <span className="text-muted"> &middot; </span>
              <span className="font-bold text-accent">{creature.ranking.wins}V</span>
              {' '}
              <span className="font-bold text-red-400">{creature.ranking.losses}S</span>
              <span className="text-muted"> &middot; </span>
              <span className="text-muted">{TIER_LABELS[creature.ranking.tier] ?? creature.ranking.tier}</span>
            </p>
          )}

          {/* Personality badge for active creatures */}
          {!isArchived && personality && (
            <p className="mt-0.5 text-[11px] text-muted">
              Personalita: <span className="font-medium text-foreground/80">{personality.label} {Math.round(personality.value)}%</span>
            </p>
          )}

          {/* Archive info for archived creatures */}
          {isArchived && creature.archivedAt && (
            <p className="mt-0.5 text-[10px] text-muted">
              Archiviato: {creature.archiveReason ?? 'n/a'} &middot; {formatDate(creature.archivedAt)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// User Card (expandable)
// ---------------------------------------------------------------------------

function UserCard({
  user,
  onCreatureClick,
}: {
  user: AdminUser;
  onCreatureClick: (creature: AdminCreature) => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeCreatures = user.creatures.filter((c) => !c.isArchived);
  const archivedCreatures = user.creatures.filter((c) => c.isArchived);
  const totalCreatures = user.creatures.length;

  async function handleReset() {
    if (activeCreatures.length === 0) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset`, {
        method: 'POST',
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error?.message ?? 'Errore durante il reset');
      }
    } catch {
      alert('Errore di rete');
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error?.message ?? 'Errore durante eliminazione');
      }
    } catch {
      alert('Errore di rete');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/40 bg-surface/60 p-4 transition-colors hover:border-border/60">
      {/* User header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base">&#x1F464;</span>
            <h3 className="truncate text-sm font-bold text-foreground">
              {user.displayName}
            </h3>
            {user.isAdmin && (
              <span className="shrink-0 rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                Admin
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Iscritto: {formatDate(user.createdAt)}
            {user.lastLoginAt && (
              <> &middot; Ultimo accesso: {formatDate(user.lastLoginAt)}</>
            )}
          </p>
        </div>
        {user.totalBattles > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Battaglie</p>
            <p className="text-sm font-bold text-foreground">{user.totalBattles}</p>
          </div>
        )}
      </div>

      {/* Creature summary */}
      <div className="mt-3 border-t border-border/20 pt-3">
        {totalCreatures > 0 ? (
          <>
            <p className="mb-2 text-[11px] text-muted">
              Creature: <span className="font-medium text-foreground/80">{totalCreatures} totali</span>
              {' ('}
              <span className="text-emerald-400">{activeCreatures.length} attiv{activeCreatures.length === 1 ? 'a' : 'e'}</span>
              {archivedCreatures.length > 0 && (
                <>, <span className="text-muted">{archivedCreatures.length} archiviat{archivedCreatures.length === 1 ? 'a' : 'e'}</span></>
              )}
              {')'}
            </p>

            {/* Active creatures */}
            <div className="space-y-2">
              {activeCreatures.map((creature) => (
                <CreatureMiniCard
                  key={creature.id}
                  creature={creature}
                  onClick={() => onCreatureClick(creature)}
                />
              ))}
            </div>

            {/* Archived creatures */}
            {archivedCreatures.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {archivedCreatures.map((creature) => (
                  <CreatureMiniCard
                    key={creature.id}
                    creature={creature}
                    onClick={() => onCreatureClick(creature)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs italic text-muted/60">Nessuna creatura</p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/20 pt-3">
        {activeCreatures.length > 0 && (
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            {resetting ? 'Resettando...' : 'Resetta Creatura Attiva'}
          </button>
        )}

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            Elimina Utente
          </button>
        ) : (
          <div className="w-full space-y-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3">
            <p className="text-[11px] text-red-300">
              Sei sicuro? Questa azione elimina l&apos;utente, tutte le creature e
              tutti i dati correlati. Non e reversibile.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Conferma Eliminazione'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-lg border border-border/50 bg-surface px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-foreground"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer (slide-over for creature deep-dive)
// ---------------------------------------------------------------------------

function CreatureDetailDrawer({
  creature,
  onClose,
}: {
  creature: AdminCreature;
  onClose: () => void;
}) {
  const visualParams: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  const elements = Object.entries(creature.elementLevels).filter(
    ([, v]) => typeof v === 'number',
  );

  const isWarrior = creature.ageDays >= GAME_CONFIG.WARRIOR_PHASE_START;
  const hasCombatStats = COMBAT_TRAITS.some(
    (ct) => (creature.traitValues[ct] ?? 0) > 0.5,
  );

  const activeSynergies =
    (creature.visualParams.activeSynergyVisuals as string[] | undefined) ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer — from right on desktop, from bottom on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-2xl border-t border-border/50 bg-background shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-surface/80 px-4 py-3 backdrop-blur-md">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {creature.name}
            </h2>
            <p className="text-[10px] text-muted">
              Day {creature.ageDays} &middot; Gen {creature.generation}
              {creature.isArchived && ' &middot; Archiviata'}
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
          {/* Creature SVG */}
          <div className={`flex justify-center ${creature.isArchived ? 'opacity-50' : ''}`}>
            <CreatureRenderer
              params={visualParams}
              size={200}
              animated={!creature.isArchived}
              seed={42}
            />
          </div>

          {/* Archive badge */}
          {creature.isArchived && (
            <div className="flex justify-center">
              <span className="rounded-sm bg-muted/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted">
                {archiveReasonLabel(creature.archiveReason)}
                {creature.archivedAt && ` — ${formatDate(creature.archivedAt)}`}
              </span>
            </div>
          )}

          {/* Stability bar */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="font-medium text-muted">Stabilita</span>
              <span className="font-bold text-foreground">
                {Math.round(creature.stability * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full transition-all ${stabilityColor(creature.stability)}`}
                style={{
                  width: `${Math.round(creature.stability * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Element levels */}
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
              Elementi
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {elements.map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-6 text-[10px] font-bold text-foreground/70">
                    {key}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{
                        width: `${Math.min(100, val as number)}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[10px] text-muted">
                    {Math.round(val as number)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Personality radar */}
          <div className="flex justify-center">
            <PersonalityRadar
              elementLevels={creature.elementLevels as Record<string, number>}
              size={160}
            />
          </div>

          {/* Warrior badge */}
          {isWarrior && (
            <div className="flex justify-center">
              <span
                className="rounded-sm bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-400"
                style={{ textShadow: '0 0 8px #ff3d3d33' }}
              >
                Fase Guerriero
              </span>
            </div>
          )}

          {/* Combat traits */}
          {hasCombatStats && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Statistiche Combattimento
              </p>
              <div className="space-y-0.5">
                {COMBAT_TRAITS.map((ct) => {
                  const value = Math.round(creature.traitValues[ct] ?? 0);
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
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Arena record */}
          {creature.ranking && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Record Arena
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-foreground/80">
                  <span className="text-muted">ELO: </span>
                  <span className="font-bold">{creature.ranking.eloRating}</span>
                </div>
                <div className="text-foreground/80">
                  <span className="text-muted">Tier: </span>
                  <span className="font-bold capitalize">
                    {TIER_LABELS[creature.ranking.tier] ?? creature.ranking.tier}
                  </span>
                </div>
                <div className="text-foreground/80">
                  <span className="font-bold text-accent">{creature.ranking.wins}V</span>
                  {' / '}
                  <span className="font-bold text-red-400">{creature.ranking.losses}S</span>
                  {' / '}
                  <span className="font-bold text-muted">{creature.ranking.draws}P</span>
                </div>
                <div className="text-foreground/80">
                  <span className="text-muted">Streak: </span>
                  <span className="font-bold text-warning">{creature.ranking.winStreak}</span>
                </div>
                {creature.ranking.traumaActive && (
                  <div className="col-span-2 mt-1 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-400">
                    Trauma attivo ({creature.ranking.consecutiveLosses} sconfitte consecutive)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active synergies */}
          {activeSynergies.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Sinergie Attive
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeSynergies.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {s.replace(/_/g, ' ')}
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
// Main Dashboard
// ---------------------------------------------------------------------------

export function AdminDashboard({ data, stats }: AdminDashboardProps) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedCreature, setSelectedCreature] = useState<AdminCreature | null>(null);

  const filtered = useMemo(() => {
    let result = data;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (user) =>
          user.displayName.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q),
      );
    }

    // Sort
    if (sortMode === 'most-evolved') {
      result = [...result].sort((a, b) => {
        const aMax = Math.max(0, ...a.creatures.filter((c) => !c.isArchived).map((c) => c.ageDays));
        const bMax = Math.max(0, ...b.creatures.filter((c) => !c.isArchived).map((c) => c.ageDays));
        return bMax - aMax;
      });
    }
    // 'newest' is default from server (already sorted by createdAt DESC)

    return result;
  }, [data, search, sortMode]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4">
      {/* Stats bar */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Totale utenti" value={stats.totalUsers} />
        <StatCard label="Creature attive" value={stats.activeCreatures} />
        <StatCard label="Creature archiviate" value={stats.archivedCreatures} />
        <StatCard label="Battaglie totali" value={stats.totalBattles} />
        <StatCard label="Guerrieri in Arena" value={stats.warriorsInArena} />
      </div>

      {/* Search + Sort */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
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
            placeholder="Cerca per nome o email..."
            className="w-full rounded-lg border border-border/50 bg-surface/60 py-2 pl-10 pr-4 text-xs text-foreground placeholder:text-muted/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Sort */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setSortMode('newest')}
            className={`rounded-lg px-3 py-2 text-[11px] font-medium transition-colors ${
              sortMode === 'newest'
                ? 'bg-primary/15 text-primary'
                : 'bg-surface/60 text-muted hover:text-foreground'
            }`}
          >
            Piu recenti
          </button>
          <button
            type="button"
            onClick={() => setSortMode('most-evolved')}
            className={`rounded-lg px-3 py-2 text-[11px] font-medium transition-colors ${
              sortMode === 'most-evolved'
                ? 'bg-primary/15 text-primary'
                : 'bg-surface/60 text-muted hover:text-foreground'
            }`}
          >
            Piu evolute
          </button>
        </div>
      </div>

      {/* User list */}
      <div className="space-y-3">
        {filtered.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onCreatureClick={(creature) => setSelectedCreature(creature)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          Nessun utente trovato
        </p>
      )}

      {/* Creature Detail Drawer */}
      {selectedCreature && (
        <CreatureDetailDrawer
          creature={selectedCreature}
          onClose={() => setSelectedCreature(null)}
        />
      )}
    </div>
  );
}
