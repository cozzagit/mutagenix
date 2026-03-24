"use client";

import { useState, useEffect, useCallback } from "react";
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

  return (
    <div className="flex flex-col rounded-xl border border-border/50 bg-surface/80 p-4 transition-all hover:border-border hover:bg-surface">
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
        <StatusBadge status={tournament.status} />
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
        {tournament.entryFee > 0 && (
          <span>
            Costo:{" "}
            <strong className="text-warning">{tournament.entryFee} energia</strong>
          </span>
        )}
      </div>

      {/* Dates */}
      {enrollmentEnd && !enrollmentExpired && isEnrollment && (
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
          >
            ISCRIVITI
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
        <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
          <p className="text-sm text-muted">Nessun torneo disponibile al momento.</p>
          <p className="text-[10px] text-muted mt-1">
            Torna più tardi per nuovi tornei.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tournaments.map((t) => (
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
