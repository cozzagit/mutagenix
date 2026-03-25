"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TournamentDetail } from "./tournament-detail";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface TournamentSummary {
  id: string;
  name: string;
  tournamentType: string;
  status: string;
  battleFormat: string;
  maxParticipants: number | null;
  minParticipants: number;
  entryFee: number;
  currentRound: number;
  totalRounds: number | null;
  participantCount: number;
  enrollmentStart: string | null;
  enrollmentEnd: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isEnrolled: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Sub: Type badge                                                    */
/* ------------------------------------------------------------------ */

function TypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    knockout: { label: "ELIMINAZIONE", color: "#ff4466", bg: "rgba(255,68,102,0.12)" },
    calendar: { label: "CAMPIONATO", color: "#3d5afe", bg: "rgba(61,90,254,0.12)" },
    random: { label: "RANDOM", color: "#ffd600", bg: "rgba(255,214,0,0.12)" },
  };

  const c = config[type] ?? config.knockout;

  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {c.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: Status badge                                                  */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    draft: { label: "Bozza", color: "#6b6d7b" },
    enrollment: { label: "Iscrizioni aperte", color: "#00e5a0" },
    active: { label: "In corso", color: "#3d5afe" },
    resolving: { label: "In risoluzione", color: "#ffd600" },
    completed: { label: "Completato", color: "#8a8a8a" },
    cancelled: { label: "Cancellato", color: "#ff4466" },
  };

  const c = config[status] ?? config.draft;

  return (
    <span
      className="text-[10px] font-bold"
      style={{ color: c.color }}
    >
      {c.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: Format badge                                                  */
/* ------------------------------------------------------------------ */

function FormatBadge({ format }: { format: string }) {
  return (
    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
      {format}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: TournamentCard                                                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Sub: Countdown hook for tournament start                           */
/* ------------------------------------------------------------------ */

function useCountdown(targetDate: string | null): string {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!targetDate) return;
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setText(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setText(`${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [targetDate]);
  return text;
}

/* ------------------------------------------------------------------ */
/* Sub: TournamentRulesCard                                           */
/* ------------------------------------------------------------------ */

function TournamentRulesCard({ tournament }: { tournament: TournamentSummary }) {
  const countdown = useCountdown(tournament.startsAt);

  return (
    <div
      className="col-span-full rounded-xl border-2 p-5"
      style={{
        borderColor: '#ffd60040',
        backgroundColor: 'rgba(255, 214, 0, 0.04)',
        boxShadow: '0 0 20px rgba(255, 214, 0, 0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{'\u{1F3C6}'}</span>
        <h3 className="text-base font-black text-foreground uppercase tracking-tight">
          {tournament.name}
        </h3>
      </div>

      <div className="flex flex-col gap-2 text-[13px] text-muted mb-4">
        <div className="flex items-start gap-2">
          <span className="shrink-0">{'\u{1F4CB}'}</span>
          <div>
            <span className="font-bold text-foreground">Regole:</span>
            <ul className="mt-1 flex flex-col gap-1">
              <li>Eliminazione diretta 1v1</li>
              <li>La tua creatura piu forte combatte</li>
              <li>Chi perde viene eliminato</li>
              <li>Il vincitore passa al turno successivo</li>
              <li>Premi e gloria per i finalisti</li>
              {tournament.entryFee === 0 && <li className="font-semibold text-accent">Ingresso gratuito</li>}
            </ul>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <span>{'\u23F0'}</span>
            <span>
              Inizio:{" "}
              <strong className="text-foreground">
                {tournament.startsAt
                  ? new Date(tournament.startsAt).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Da definire"}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span>{'\u{1F4CA}'}</span>
          <span>
            Partecipanti:{" "}
            <strong className="text-foreground">
              {tournament.participantCount}
              {tournament.maxParticipants ? `/${tournament.maxParticipants}` : ""}
            </strong>
          </span>
          {countdown && (
            <span
              className="ml-auto rounded-lg px-2 py-0.5 text-[11px] font-mono font-bold"
              style={{ color: '#ff9100', backgroundColor: 'rgba(255, 145, 0, 0.12)' }}
            >
              Tra {countdown}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: TournamentCard                                                */
/* ------------------------------------------------------------------ */

function TournamentCard({
  tournament,
  onEnroll,
  onDetail,
  enrolling,
}: {
  tournament: TournamentSummary;
  onEnroll: (id: string) => void;
  onDetail: (id: string) => void;
  enrolling: string | null;
}) {
  const isEnrollment = tournament.status === "enrollment";
  const enrollmentEnd = tournament.enrollmentEnd
    ? new Date(tournament.enrollmentEnd)
    : null;
  const enrollmentExpired = enrollmentEnd && enrollmentEnd < new Date();
  const countdown = useCountdown(isEnrollment ? tournament.startsAt : null);

  return (
    <div
      className="flex flex-col rounded-xl border-2 p-4 transition-all hover:bg-surface"
      style={{
        borderColor: isEnrollment ? '#ff910050' : 'var(--color-border)',
        backgroundColor: isEnrollment ? 'rgba(255, 145, 0, 0.04)' : 'var(--color-surface)',
        boxShadow: isEnrollment
          ? '0 0 16px rgba(255, 145, 0, 0.1)'
          : undefined,
        animation: isEnrollment ? 'tournament-card-pulse 3s ease-in-out infinite alternate' : undefined,
      }}
    >
      <style>{`
        @keyframes tournament-card-pulse {
          from { box-shadow: 0 0 12px rgba(255, 145, 0, 0.08); }
          to { box-shadow: 0 0 22px rgba(255, 145, 0, 0.18); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-foreground leading-tight truncate flex-1">
          {tournament.name}
        </h3>
        <TypeBadge type={tournament.tournamentType} />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 mb-3">
        <FormatBadge format={tournament.battleFormat} />
        {isEnrollment ? (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{
              color: '#ff9100',
              backgroundColor: 'rgba(255, 145, 0, 0.15)',
              animation: 'tournament-card-pulse 2s ease-in-out infinite alternate',
            }}
          >
            ISCRIZIONI APERTE
          </span>
        ) : (
          <StatusBadge status={tournament.status} />
        )}
      </div>

      {/* Participants */}
      <div className="flex items-center justify-between text-[11px] text-muted mb-2">
        <span>
          Partecipanti:{" "}
          <strong className="text-foreground">
            {tournament.participantCount}
            {tournament.maxParticipants ? `/${tournament.maxParticipants}` : ""}
          </strong>
        </span>
        {tournament.entryFee > 0 ? (
          <span>
            Costo:{" "}
            <strong className="text-warning">{tournament.entryFee} energia</strong>
          </span>
        ) : (
          <span className="text-accent font-semibold">Gratuito</span>
        )}
      </div>

      {/* Countdown for enrollment */}
      {isEnrollment && countdown && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px]">{'\u23F0'}</span>
          <span
            className="text-[11px] font-mono font-bold"
            style={{ color: '#ff9100' }}
          >
            Inizia tra {countdown}
          </span>
        </div>
      )}

      {/* Dates */}
      {enrollmentEnd && !enrollmentExpired && isEnrollment && !countdown && (
        <p className="text-[10px] text-muted mb-3">
          Iscrizioni fino al{" "}
          {enrollmentEnd.toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      {tournament.status === "active" && tournament.currentRound > 0 && (
        <p className="text-[10px] text-muted mb-3">
          Round {tournament.currentRound}
          {tournament.totalRounds ? ` / ${tournament.totalRounds}` : ""}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {isEnrollment && !tournament.isEnrolled && !enrollmentExpired && (
          <Button
            variant="accent"
            size="sm"
            fullWidth
            onClick={() => onEnroll(tournament.id)}
            loading={enrolling === tournament.id}
            className="uppercase font-black tracking-wider text-[11px]"
            style={{
              background: 'linear-gradient(135deg, #ff6b00, #ff3d3d)',
              border: 'none',
            }}
          >
            {'\u2694\uFE0F'} ISCRIVITI
          </Button>
        )}

        {tournament.isEnrolled && isEnrollment && (
          <span className="flex-1 flex items-center justify-center text-[11px] font-bold text-accent">
            Iscritto
          </span>
        )}

        <Button
          variant="secondary"
          size="sm"
          fullWidth={!isEnrollment || tournament.isEnrolled || !!enrollmentExpired}
          onClick={() => onDetail(tournament.id)}
          className="uppercase font-black tracking-wider text-[11px]"
        >
          DETTAGLI
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main: TournamentList                                               */
/* ------------------------------------------------------------------ */

export function TournamentList() {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("enrollment,active");

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/arena/tournaments?status=${statusFilter}`,
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTournaments(json.data ?? []);
    } catch {
      toast("error", "Errore nel caricamento dei tornei.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handleEnroll = useCallback(
    async (tournamentId: string) => {
      setEnrolling(tournamentId);
      try {
        const res = await fetch(
          `/api/arena/tournaments/${tournamentId}/enroll`,
          { method: "POST" },
        );
        const json = await res.json();
        if (!res.ok) {
          toast("error", json.error?.message ?? "Errore durante l'iscrizione.");
          return;
        }
        toast("success", "Iscrizione completata!");
        fetchTournaments();
      } catch {
        toast("error", "Errore di rete durante l'iscrizione.");
      } finally {
        setEnrolling(null);
      }
    },
    [fetchTournaments, toast],
  );

  // Sort: enrollment tournaments first, then active, then rest
  const sorted = useMemo(() => {
    const priority: Record<string, number> = { enrollment: 0, active: 1, resolving: 2, completed: 3 };
    return [...tournaments].sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9));
  }, [tournaments]);

  if (selectedTournamentId) {
    return (
      <TournamentDetail
        tournamentId={selectedTournamentId}
        onBack={() => {
          setSelectedTournamentId(null);
          fetchTournaments();
        }}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-base font-black text-foreground tracking-tight">
          Tornei
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Campionati, eliminazione diretta e tornei speciali. La gloria ti aspetta.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5 mb-4 w-fit">
        {[
          { value: "enrollment,active", label: "Attivi" },
          { value: "completed", label: "Completati" },
          { value: "enrollment,active,completed,resolving", label: "Tutti" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-all ${
              statusFilter === f.value
                ? "bg-danger/20 text-danger"
                : "text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-border/30 bg-surface-2 animate-pulse"
            />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="rounded-xl border border-border/30 bg-surface-2 p-10 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} className="h-10 w-10 text-muted/40 mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-4.5A3.375 3.375 0 0 0 13.125 10.875h-2.25A3.375 3.375 0 0 0 7.5 14.25v4.5m6-12a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <p className="text-sm font-bold text-muted mb-1">Nessun torneo disponibile al momento</p>
          <p className="text-xs text-muted/70 leading-relaxed max-w-xs mx-auto">
            I tornei vengono creati periodicamente dal sistema e dagli amministratori.
            Torna a controllare presto — nuove competizioni sono in arrivo!
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-bold text-primary">Prossimamente</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Rules card for the first enrollment tournament */}
          {(() => {
            const enrolling_t = sorted.find(t => t.status === 'enrollment');
            return enrolling_t ? <TournamentRulesCard tournament={enrolling_t} /> : null;
          })()}
          {sorted.map((t) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              onEnroll={handleEnroll}
              onDetail={setSelectedTournamentId}
              enrolling={enrolling}
            />
          ))}
        </div>
      )}
    </div>
  );
}
