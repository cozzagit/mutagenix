"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TournamentBracket } from "./tournament-bracket";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface TournamentData {
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
  enrollmentStart: string | null;
  enrollmentEnd: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

interface ParticipantData {
  id: string;
  userId: string;
  displayName: string;
  creatureName?: string | null;
  creatureAgeDays?: number | null;
  creatureVisualParams?: Record<string, unknown> | null;
  seed: number | null;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchesDrawn: number;
  points: number;
  isEliminated: boolean;
  status: string;
}

interface MatchData {
  id: string;
  roundNumber: number;
  participant1Id: string;
  participant2Id: string;
  participant1Name?: string;
  participant2Name?: string;
  status: string;
  winnerId: string | null;
  winnerName?: string | null;
  completedAt: string | null;
  duelResults: unknown;
}

interface StandingData {
  rank: number;
  participantId: string;
  userId: string;
  displayName: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchesDrawn: number;
  points: number;
  isEliminated: boolean;
  totalDamageTaken: number;
}

/* ------------------------------------------------------------------ */
/* Sub: Type & Status badges (duplicated locally for independence)     */
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
    <span className="text-[10px] font-bold" style={{ color: c.color }}>
      {c.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: StandingsTable                                                */
/* ------------------------------------------------------------------ */

function StandingsTable({
  standings,
  myUserId,
}: {
  standings: StandingData[];
  myUserId: string | null;
}) {
  if (standings.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-4">
        La classifica non è ancora disponibile.
      </p>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="hidden md:grid md:grid-cols-[3rem_1fr_5rem_5rem_5rem_5rem] gap-2 px-3 py-1.5 text-[10px] text-muted uppercase tracking-wider border-b border-border/30">
        <span>#</span>
        <span>Giocatore</span>
        <span>V/S/P</span>
        <span>Punti</span>
        <span>Danni</span>
        <span>Status</span>
      </div>

      {standings.map((s) => {
        const isMe = s.userId === myUserId;
        return (
          <div
            key={s.participantId}
            className={`grid grid-cols-[2rem_1fr_auto] md:grid-cols-[3rem_1fr_5rem_5rem_5rem_5rem] gap-2 px-3 py-2 text-xs items-center border-b border-border/10 ${
              isMe ? "bg-danger/5 border-l-2 border-l-danger" : ""
            } ${s.isEliminated ? "opacity-50" : ""}`}
          >
            <span className="font-mono text-muted">{s.rank}</span>
            <span className="font-bold text-foreground truncate">
              {s.displayName}
            </span>
            <span className="text-muted">
              <span className="text-accent">{s.matchesWon}V</span>{" "}
              <span className="text-danger">{s.matchesLost}S</span>
              {s.matchesDrawn > 0 && (
                <>
                  {" "}
                  <span className="text-warning">{s.matchesDrawn}P</span>
                </>
              )}
            </span>
            <span className="hidden md:block font-bold text-foreground">
              {s.points}
            </span>
            <span className="hidden md:block text-muted">
              {Math.round(s.totalDamageTaken)}
            </span>
            <span className="hidden md:block">
              {s.isEliminated ? (
                <span className="text-[10px] text-danger font-bold">Eliminato</span>
              ) : (
                <span className="text-[10px] text-accent font-bold">Attivo</span>
              )}
            </span>

            {/* Mobile: right column */}
            <div className="flex items-center gap-2 md:hidden">
              <span className="font-bold text-foreground">{s.points}pt</span>
              {s.isEliminated && (
                <span className="text-[9px] text-danger font-bold">ELIM</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main: TournamentDetail                                             */
/* ------------------------------------------------------------------ */

interface TournamentDetailProps {
  tournamentId: string;
  onBack: () => void;
}

export function TournamentDetail({
  tournamentId,
  onBack,
}: TournamentDetailProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingData[]>([]);
  const [withdrawing, setWithdrawing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [playingMatch, setPlayingMatch] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"bracket" | "standings" | "matches">("bracket");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, standingsRes] = await Promise.all([
        fetch(`/api/arena/tournaments/${tournamentId}`),
        fetch(`/api/arena/tournaments/${tournamentId}/standings`),
      ]);

      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        setTournament(detailJson.data.tournament);
        setParticipants(detailJson.data.participants);
        setMatches(detailJson.data.matches);
        setIsEnrolled(detailJson.data.isEnrolled);
        setMyParticipantId(detailJson.data.myParticipantId);
      }

      if (standingsRes.ok) {
        const standingsJson = await standingsRes.json();
        setStandings(standingsJson.data ?? []);
      }
    } catch {
      toast("error", "Errore nel caricamento del torneo.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEnroll = useCallback(async () => {
    setEnrolling(true);
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
      fetchData();
    } catch {
      toast("error", "Errore di rete durante l'iscrizione.");
    } finally {
      setEnrolling(false);
    }
  }, [tournamentId, fetchData, toast]);

  const handleWithdraw = useCallback(async () => {
    setWithdrawing(true);
    try {
      const res = await fetch(
        `/api/arena/tournaments/${tournamentId}/withdraw`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        toast("error", json.error?.message ?? "Errore durante il ritiro.");
        return;
      }
      toast("success", json.data?.message ?? "Ti sei ritirato dal torneo.");
      fetchData();
    } catch {
      toast("error", "Errore di rete durante il ritiro.");
    } finally {
      setWithdrawing(false);
    }
  }, [tournamentId, fetchData, toast]);

  const handlePlayMatch = useCallback(
    async (matchId: string) => {
      setPlayingMatch(matchId);
      try {
        const res = await fetch(
          `/api/arena/tournaments/${tournamentId}/matches/${matchId}/play`,
          { method: "POST" },
        );
        const json = await res.json();
        if (!res.ok) {
          toast("error", json.error?.message ?? "Errore durante il match.");
          return;
        }

        const result = json.data;
        if (result.winnerParticipantId === myParticipantId) {
          toast("success", "Vittoria!");
        } else if (result.winnerParticipantId === null) {
          toast("info", "Pareggio!");
        } else {
          toast("error", "Sconfitta.");
        }

        fetchData();
      } catch {
        toast("error", "Errore di rete durante il match.");
      } finally {
        setPlayingMatch(null);
      }
    },
    [tournamentId, myParticipantId, fetchData, toast],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded bg-surface-2 animate-pulse" />
        <div className="h-48 rounded-xl bg-surface-2 animate-pulse" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">Torneo non trovato.</p>
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-2">
          Torna alla lista
        </Button>
      </div>
    );
  }

  // Build name map for bracket
  const nameMap = new Map(participants.map((p) => [p.id, p.displayName]));

  const bracketMatches = matches.map((m) => ({
    ...m,
    participant1Name: nameMap.get(m.participant1Id) ?? "???",
    participant2Name: nameMap.get(m.participant2Id) ?? "???",
    winnerName: m.winnerId ? (nameMap.get(m.winnerId) ?? null) : null,
  }));

  const isKnockout =
    tournament.tournamentType === "knockout" ||
    tournament.tournamentType === "random";

  // Find my playable matches
  const myPlayableMatches = matches.filter(
    (m) =>
      (m.participant1Id === myParticipantId ||
        m.participant2Id === myParticipantId) &&
      (m.status === "pending" || m.status === "scheduled"),
  );

  return (
    <div>
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="shrink-0 rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-foreground truncate">
            {tournament.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <TypeBadge type={tournament.tournamentType} />
            <StatusBadge status={tournament.status} />
            <span className="text-[10px] text-muted">{tournament.battleFormat}</span>
          </div>
        </div>
      </div>

      {/* Tournament info bar */}
      <div className="flex items-center justify-between rounded-lg bg-surface-2/50 border border-border/20 px-4 py-2.5 mb-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[9px] text-muted uppercase tracking-wider">Partecipanti</p>
            <p className="text-sm font-black text-foreground">
              {participants.length}
              {tournament.maxParticipants ? `/${tournament.maxParticipants}` : ""}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-muted uppercase tracking-wider">Round</p>
            <p className="text-sm font-black text-foreground">
              {tournament.currentRound}
              {tournament.totalRounds ? `/${tournament.totalRounds}` : ""}
            </p>
          </div>
          {tournament.entryFee > 0 && (
            <div className="text-center">
              <p className="text-[9px] text-muted uppercase tracking-wider">Costo</p>
              <p className="text-sm font-black text-warning">{tournament.entryFee}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {tournament.status === "enrollment" && !isEnrolled && (
            <Button
              variant="accent"
              size="sm"
              onClick={handleEnroll}
              loading={enrolling}
              className="uppercase font-black tracking-wider text-[11px]"
            >
              ISCRIVITI
            </Button>
          )}
          {tournament.status === "enrollment" && isEnrolled && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleWithdraw}
              loading={withdrawing}
              className="uppercase font-black tracking-wider text-[11px]"
            >
              RITIRATI
            </Button>
          )}
        </div>
      </div>

      {/* Enrolled participants list */}
      {participants.length > 0 && (
        <div className="mb-4 rounded-xl border border-border/20 bg-surface/30 p-4">
          <h3 className="text-xs font-black text-muted uppercase tracking-wider mb-3">
            Partecipanti iscritti ({participants.length}{tournament.maxParticipants ? `/${tournament.maxParticipants}` : ''})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {participants.map((p, i) => {
              const vp = p.creatureVisualParams
                ? { ...DEFAULT_VISUAL_PARAMS, ...(p.creatureVisualParams as Partial<VisualParams>) } as VisualParams
                : null;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                    p.isEliminated ? 'border-danger/20 bg-danger/5 opacity-50' :
                    p.id === myParticipantId ? 'border-accent/40 bg-accent/5' :
                    'border-border/15 bg-surface/20'
                  }`}
                >
                  {vp && (
                    <div className={`shrink-0 ${p.isEliminated ? 'grayscale' : ''}`}>
                      <CreatureRenderer params={vp} size={40} animated={false} seed={42} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">
                      {p.creatureName ?? p.displayName}
                      {p.id === myParticipantId && <span className="text-accent ml-1">(tu)</span>}
                    </p>
                    <p className="text-[9px] text-muted truncate">
                      {p.displayName}
                      {p.creatureAgeDays != null && ` · G${p.creatureAgeDays}`}
                      {p.isEliminated ? ' · Eliminato' : p.matchesPlayed > 0 ? ` · ${p.matchesWon}V ${p.matchesLost}S` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My playable matches */}
      {myPlayableMatches.length > 0 && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <h3 className="text-xs font-black text-danger uppercase tracking-wider mb-2">
            I tuoi match da giocare
          </h3>
          <div className="flex flex-col gap-2">
            {myPlayableMatches.map((m) => {
              const opponentId =
                m.participant1Id === myParticipantId
                  ? m.participant2Id
                  : m.participant1Id;
              const opponentName = nameMap.get(opponentId) ?? "???";

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-surface/80 border border-border/30 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Round {m.roundNumber} vs{" "}
                      <span className="text-danger">{opponentName}</span>
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handlePlayMatch(m.id)}
                    loading={playingMatch === m.id}
                    className="uppercase font-black tracking-wider text-[11px]"
                  >
                    COMBATTI
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-0 mb-4 border-b border-border/30">
        {[
          { id: "bracket" as const, label: isKnockout ? "TABELLONE" : "CLASSIFICA" },
          { id: "standings" as const, label: "CLASSIFICA" },
          { id: "matches" as const, label: "MATCH" },
        ]
          .filter((tab) => {
            // For knockout, show bracket + matches
            // For calendar, show standings + matches (no bracket tab duplication)
            if (!isKnockout && tab.id === "bracket") return false;
            if (isKnockout && tab.id === "standings") return false;
            return true;
          })
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`shrink-0 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                activeView === tab.id
                  ? "text-danger border-danger"
                  : "text-muted border-transparent hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {/* View content */}
      {activeView === "bracket" && isKnockout && (
        <TournamentBracket
          matches={bracketMatches}
          totalRounds={tournament.totalRounds ?? 1}
          currentRound={tournament.currentRound}
          myParticipantId={myParticipantId}
        />
      )}

      {(activeView === "standings" || (activeView === "bracket" && !isKnockout)) && (
        <StandingsTable standings={standings} myUserId={null} />
      )}

      {activeView === "matches" && (
        <div>
          {matches.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">
              Nessun match ancora disponibile.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {matches.map((m) => {
                const p1Name = nameMap.get(m.participant1Id) ?? "???";
                const p2Name = nameMap.get(m.participant2Id) ?? "???";
                const isCompleted = m.status === "completed";
                const p1Won = m.winnerId === m.participant1Id;
                const p2Won = m.winnerId === m.participant2Id;

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 text-xs border-b border-border/10"
                  >
                    <span className="text-[10px] text-muted font-mono w-6">
                      R{m.roundNumber}
                    </span>
                    <span
                      className={`flex-1 truncate ${
                        isCompleted && p1Won ? "text-accent font-bold" : "text-foreground"
                      }`}
                    >
                      {p1Name}
                    </span>
                    <span className="text-[10px] text-muted">vs</span>
                    <span
                      className={`flex-1 truncate text-right ${
                        isCompleted && p2Won ? "text-accent font-bold" : "text-foreground"
                      }`}
                    >
                      {p2Name}
                    </span>
                    <span
                      className={`text-[10px] w-16 text-right ${
                        isCompleted ? "text-muted" : "text-warning font-bold"
                      }`}
                    >
                      {isCompleted ? "Giocato" : "In attesa"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
