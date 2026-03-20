'use client';

import { useState } from 'react';
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

export function ProfileView({ user, creature }: ProfileViewProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const res = await fetch('/api/auth/signout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch {
      setLoggingOut(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch('/api/creature/reset', { method: 'POST' });
      if (res.ok) {
        setShowConfirm(false);
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
              label="Stabilit&agrave;"
              value={`${stabilityPercent}%`}
              accent={stabilityColor}
            />
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mb-4">
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
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {/* New game */}
        {!showConfirm ? (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowConfirm(true)}
          >
            Nuova Partita
          </Button>
        ) : (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4">
            <p className="mb-3 text-xs text-foreground">
              Sei sicuro? Questa azione canceller&agrave; la tua creatura e tutti
              i dati di evoluzione. Non pu&ograve; essere annullata.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={handleReset}
                loading={resetting}
              >
                Conferma Reset
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(false)}
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
