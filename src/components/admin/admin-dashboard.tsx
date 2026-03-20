'use client';

import { useState, useMemo } from 'react';
import {
  CreatureRenderer,
  DEFAULT_VISUAL_PARAMS,
} from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import type { ElementLevels, TraitValues } from '@/lib/db/schema/creatures';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserData {
  id: string;
  email: string;
  displayName: string;
  streak: number;
  lastLoginAt: string | null;
  isAdmin: boolean;
  createdAt: string;
}

interface CreatureData {
  id: string;
  name: string;
  generation: number;
  ageDays: number;
  stability: number;
  elementLevels: ElementLevels;
  traitValues: TraitValues;
  visualParams: Record<string, unknown>;
}

interface AdminEntry {
  user: UserData;
  creature: CreatureData | null;
  allocationCount: number;
}

interface AdminStats {
  totalUsers: number;
  totalCreatures: number;
  totalInjections: number;
  mostEvolvedName: string | null;
  mostEvolvedDays: number;
}

interface AdminDashboardProps {
  data: AdminEntry[];
  stats: AdminStats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
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

const ELEMENT_LABELS: Record<string, string> = {
  N: 'Azoto',
  K: 'Potassio',
  Na: 'Sodio',
  C: 'Carbonio',
  O: 'Ossigeno',
  P: 'Fosforo',
  S: 'Zolfo',
  Ca: 'Calcio',
  Fe: 'Ferro',
  Cl: 'Cloro',
};

const TRAIT_LABELS: Record<string, string> = {
  aggression: 'Aggressione',
  luminosity: 'Luminosita',
  toxicity: 'Tossicita',
  intelligence: 'Intelligenza',
  armoring: 'Corazza',
};

const PERSONALITY_TRAITS = [
  'aggression',
  'luminosity',
  'toxicity',
  'intelligence',
  'armoring',
] as const;

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
// Placeholder blob for users without creatures
// ---------------------------------------------------------------------------

function PlaceholderBlob({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="opacity-30">
      <ellipse
        cx={40}
        cy={42}
        rx={28}
        ry={24}
        fill="hsl(220, 10%, 30%)"
        opacity={0.6}
      />
      <ellipse
        cx={40}
        cy={38}
        rx={22}
        ry={18}
        fill="hsl(220, 10%, 40%)"
        opacity={0.4}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// User Card (grid item)
// ---------------------------------------------------------------------------

function UserCard({
  entry,
  onClick,
}: {
  entry: AdminEntry;
  onClick: () => void;
}) {
  const { user, creature, allocationCount } = entry;

  const visualParams: VisualParams = creature
    ? ({
        ...DEFAULT_VISUAL_PARAMS,
        ...(creature.visualParams as Partial<VisualParams>),
      } as VisualParams)
    : DEFAULT_VISUAL_PARAMS;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-center rounded-xl border border-border/40 bg-surface/60 p-3 text-left transition-all hover:border-border hover:bg-surface active:scale-[0.98]"
    >
      {/* Creature preview */}
      <div className="flex h-[80px] w-[80px] items-center justify-center overflow-hidden">
        {creature ? (
          <CreatureRenderer
            params={visualParams}
            size={80}
            animated={false}
            seed={42}
          />
        ) : (
          <PlaceholderBlob size={80} />
        )}
      </div>

      {/* Creature info */}
      {creature ? (
        <div className="mt-2 w-full text-center">
          <p className="truncate text-xs font-bold text-foreground">
            {creature.name}
          </p>
          <p className="text-[10px] text-muted">
            Day {creature.ageDays} &middot; Gen {creature.generation}
          </p>
        </div>
      ) : (
        <div className="mt-2 w-full text-center">
          <p className="text-xs italic text-muted">Nessuna creatura</p>
        </div>
      )}

      {/* Divider */}
      <div className="my-2 h-px w-full bg-border/30" />

      {/* User info */}
      <div className="w-full space-y-0.5 text-[11px]">
        <p className="truncate text-foreground/80">
          <span className="mr-1">&#x1F464;</span>
          {user.displayName}
        </p>
        <p className="truncate text-muted">
          <span className="mr-1">&#x1F4E7;</span>
          {user.email}
        </p>
        <p className="text-muted">
          <span className="mr-1">&#x1F9EA;</span>
          {allocationCount} iniezioni
        </p>
        <p className="text-muted">
          <span className="mr-1">&#x1F4C5;</span>
          Iscritto {formatDate(user.createdAt)}
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer (slide-over from right)
// ---------------------------------------------------------------------------

function DetailDrawer({
  entry,
  onClose,
}: {
  entry: AdminEntry;
  onClose: () => void;
}) {
  const { user, creature, allocationCount } = entry;
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visualParams: VisualParams = creature
    ? ({
        ...DEFAULT_VISUAL_PARAMS,
        ...(creature.visualParams as Partial<VisualParams>),
      } as VisualParams)
    : DEFAULT_VISUAL_PARAMS;

  async function handleReset() {
    if (!creature) return;
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

  const elements = creature
    ? Object.entries(creature.elementLevels).filter(
        ([, v]) => typeof v === 'number',
      )
    : [];

  const personalityTraits = creature
    ? PERSONALITY_TRAITS.map((t) => ({
        key: t,
        label: TRAIT_LABELS[t] ?? t,
        value: creature.traitValues[t] ?? 0,
      }))
    : [];

  const activeSynergies = creature
    ? ((creature.visualParams as Record<string, unknown>)
        .activeSynergyVisuals as string[] | undefined) ?? []
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col overflow-y-auto border-l border-border/50 bg-background shadow-2xl md:w-[420px]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-surface/80 px-4 py-3 backdrop-blur-md">
          <h2 className="text-sm font-bold text-foreground">
            Dettaglio Utente
          </h2>
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
          <div className="flex justify-center">
            {creature ? (
              <CreatureRenderer
                params={visualParams}
                size={200}
                animated={true}
                seed={42}
              />
            ) : (
              <PlaceholderBlob size={200} />
            )}
          </div>

          {/* Creature details */}
          {creature && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-base font-bold text-foreground">
                  {creature.name}
                </p>
                <p className="text-xs text-muted">
                  Day {creature.ageDays} &middot; Gen {creature.generation}
                </p>
              </div>

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
                            width: `${Math.min(100, (val as number))}%`,
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

              {/* Personality traits */}
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                  Personalita
                </p>
                <div className="space-y-1">
                  {personalityTraits.map((t) => (
                    <div key={t.key} className="flex items-center gap-2">
                      <span className="w-20 text-[10px] text-foreground/70">
                        {t.label}
                      </span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-accent/60"
                          style={{
                            width: `${Math.min(100, t.value)}%`,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right text-[10px] text-muted">
                        {Math.round(t.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

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
            </div>
          )}

          {/* User info */}
          <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-1.5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
              Info Utente
            </p>
            <div className="text-xs">
              <p className="text-foreground/90">
                <span className="text-muted">Email: </span>
                {user.email}
              </p>
              <p className="text-foreground/90">
                <span className="text-muted">Nome: </span>
                {user.displayName}
              </p>
              <p className="text-foreground/90">
                <span className="text-muted">Registrato: </span>
                {formatDateFull(user.createdAt)}
              </p>
              {user.lastLoginAt && (
                <p className="text-foreground/90">
                  <span className="text-muted">Ultimo login: </span>
                  {formatDateFull(user.lastLoginAt)}
                </p>
              )}
              <p className="text-foreground/90">
                <span className="text-muted">Streak: </span>
                {user.streak} giorni
              </p>
              <p className="text-foreground/90">
                <span className="text-muted">Iniezioni: </span>
                {allocationCount}
              </p>
              {user.isAdmin && (
                <p className="mt-1 text-primary font-medium">Admin</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pb-8">
            {creature && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
              >
                {resetting ? 'Resettando...' : 'Resetta Creatura'}
              </button>
            )}

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
              >
                Elimina Utente
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3">
                <p className="text-xs text-red-300">
                  Sei sicuro? Questa azione elimina l&apos;utente, la creatura e
                  tutti i dati correlati. Non e reversibile.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? 'Eliminando...' : 'Conferma Eliminazione'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-lg border border-border/50 bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase().trim();
    return data.filter(
      (entry) =>
        entry.user.displayName.toLowerCase().includes(q) ||
        entry.user.email.toLowerCase().includes(q),
    );
  }, [data, search]);

  const selectedEntry = selectedUserId
    ? data.find((d) => d.user.id === selectedUserId) ?? null
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4">
      {/* Stats bar */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Utenti" value={stats.totalUsers} />
        <StatCard label="Creature" value={stats.totalCreatures} />
        <StatCard label="Iniezioni totali" value={stats.totalInjections} />
        <StatCard
          label="Piu evoluta"
          value={stats.mostEvolvedName ?? '-'}
          sub={
            stats.mostEvolvedName
              ? `Day ${stats.mostEvolvedDays}`
              : undefined
          }
        />
      </div>

      {/* Search */}
      <div className="mb-4">
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
            placeholder="Cerca per nome o email..."
            className="w-full rounded-lg border border-border/50 bg-surface/60 py-2 pl-10 pr-4 text-xs text-foreground placeholder:text-muted/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((entry) => (
          <UserCard
            key={entry.user.id}
            entry={entry}
            onClick={() => setSelectedUserId(entry.user.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          Nessun utente trovato
        </p>
      )}

      {/* Detail Drawer */}
      {selectedEntry && (
        <DetailDrawer
          entry={selectedEntry}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
