'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ProfileUser {
  displayName: string;
  email: string;
  streak: number;
  createdAt: string;
  isAdmin: boolean;
}

interface ProfileCreature {
  name: string;
  ageDays: number;
  generation: number;
  stability: number;
}

interface ProfileViewProps {
  user: ProfileUser;
  creature: ProfileCreature | null;
}

type ArchiveMode = null | 'reset' | 'failed';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 text-lg font-bold tabular-nums ${accent ?? 'text-foreground'}`}
      >
        {value}
      </p>
    </div>
  );
}

const CONFIRM_TEXT: Record<'reset' | 'failed', { title: string; body: string; button: string }> = {
  reset: {
    title: 'Nuova Partita',
    body: 'Vuoi archiviare questa creatura e ricominciare? La creatura verra conservata nella tua bacheca.',
    button: 'Conferma Nuova Partita',
  },
  failed: {
    title: 'Esperimento Fallito',
    body: 'Vuoi dichiarare questo esperimento fallito? La creatura verra archiviata come fallita.',
    button: 'Dichiara Fallito',
  },
};

export function ProfileView({ user, creature }: ProfileViewProps) {
  const router = useRouter();
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>(null);
  const [resetting, setResetting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ callbackUrl: '/login' });
  }

  async function handleArchive(reason: 'reset' | 'failed') {
    setResetting(true);
    try {
      const res = await fetch('/api/creature/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setArchiveMode(null);
        router.push('/lab');
        router.refresh();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setResetting(false);
    }
  }

  const stabilityPercent = creature
    ? Math.round(creature.stability * 100)
    : 0;
  const stabilityColor =
    !creature
      ? 'text-muted'
      : creature.stability < 0.3
        ? 'text-danger'
        : creature.stability < 0.7
          ? 'text-warning'
          : 'text-accent';

  return (
    <div className="mx-auto max-w-md pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-foreground">Profilo</h1>
      </div>

      {/* User info card */}
      <div className="mb-4 rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-foreground">
              {user.displayName}
            </h2>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Streak" value={`${user.streak} giorni`} accent="text-warning" />
          <StatCard label="Membro dal" value={formatDate(user.createdAt)} />
        </div>
      </div>

      {/* Creature stats card */}
      {creature && (
        <div className="mb-4 rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">
            {creature.name}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Giorno" value={creature.ageDays} />
            <StatCard label="Gen." value={creature.generation} />
            <StatCard
              label="Stabilita"
              value={`${stabilityPercent}%`}
              accent={stabilityColor}
            />
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mb-4 space-y-2">
        <Link
          href="/guida"
          className="focus-ring flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-surface-2"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold">Guida all&apos;Evoluzione</p>
            <p className="text-[10px] text-muted">Scopri come funziona il laboratorio</p>
          </div>
        </Link>

        <Link
          href="/bacheca"
          className="focus-ring flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-surface-2"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-4.5A3.375 3.375 0 0 0 13.125 10.875h-2.25A3.375 3.375 0 0 0 7.5 14.25v4.5m9-9V6a2.25 2.25 0 0 0-2.25-2.25h-6.5A2.25 2.25 0 0 0 7.5 6v3.75" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold">Bacheca degli Esperimenti</p>
            <p className="text-[10px] text-muted">Tutti i tuoi esperimenti passati e presenti</p>
          </div>
        </Link>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {/* Archive actions */}
        {archiveMode === null ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setArchiveMode('reset')}
            >
              Nuova Partita
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setArchiveMode('failed')}
            >
              Esperimento Fallito
            </Button>
          </div>
        ) : (
          <div
            className={`rounded-xl border p-4 ${
              archiveMode === 'failed'
                ? 'border-danger/30 bg-danger/10'
                : 'border-warning/30 bg-warning/10'
            }`}
          >
            <p className="mb-1 text-xs font-bold text-foreground">
              {CONFIRM_TEXT[archiveMode].title}
            </p>
            <p className="mb-3 text-xs text-foreground/80">
              {CONFIRM_TEXT[archiveMode].body}
            </p>
            <div className="flex gap-2">
              <Button
                variant={archiveMode === 'failed' ? 'danger' : 'secondary'}
                size="sm"
                onClick={() => handleArchive(archiveMode)}
                loading={resetting}
              >
                {CONFIRM_TEXT[archiveMode].button}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setArchiveMode(null)}
                disabled={resetting}
              >
                Annulla
              </Button>
            </div>
          </div>
        )}

        {/* Logout */}
        <Button
          variant="ghost"
          fullWidth
          onClick={handleLogout}
          loading={loggingOut}
        >
          Logout
        </Button>

        {/* Admin link */}
        {user.isAdmin && (
          <Link
            href="/admin"
            className="focus-ring block rounded-xl border border-bio-purple/30 bg-bio-purple/10 px-4 py-3 text-center text-xs font-medium text-bio-purple transition-colors hover:bg-bio-purple/20"
          >
            Pannello Admin
          </Link>
        )}
      </div>
    </div>
  );
}
