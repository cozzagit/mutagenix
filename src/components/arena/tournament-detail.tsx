"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TournamentBracket } from "./tournament-bracket";
import Link from "next/link";
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
  battleId?: string | null;
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
    swiss: { label: "SVIZZERO", color: "#9c27b0", bg: "rgba(156,39,176,0.12)" },
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
/* Types: Match Result                                                */
/* ------------------------------------------------------------------ */

interface DuelResult {
  duelIndex: number;
  creature1Id: string;
  creature2Id: string;
  winnerId: string | null;
  rounds: number;
  hpPercent1: number;
  hpPercent2: number;
}

interface MatchResult {
  result: string;
  winnerParticipantId: string | null;
  duels: DuelResult[];
}

/* ------------------------------------------------------------------ */
/* Sub: MatchResultOverlay                                            */
/* ------------------------------------------------------------------ */

function MatchResultOverlay({
  matchResult,
  myParticipantId,
  creatureNames,
  onClose,
}: {
  matchResult: MatchResult;
  myParticipantId: string | null;
  creatureNames: Record<string, string>;
  onClose: () => void;
}) {
  const isVictory = matchResult.winnerParticipantId === myParticipantId;
  const isDraw = matchResult.winnerParticipantId === null;

  const outcomeLabel = isDraw ? "PAREGGIO!" : isVictory ? "VITTORIA!" : "SCONFITTA.";
  const outcomeColor = isDraw ? "#ffd600" : isVictory ? "#00e5a0" : "#ff4466";
  const outcomeBg = isDraw
    ? "rgba(255,214,0,0.06)"
    : isVictory
      ? "rgba(0,229,160,0.06)"
      : "rgba(255,68,102,0.06)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: "#0e0f14", borderColor: outcomeColor + "44", background: outcomeBg + ", #0e0f14" }}
      >
        {/* Outcome headline */}
        <p
          className="text-center font-black tracking-widest mb-1"
          style={{ color: outcomeColor, fontSize: "2rem", textShadow: `0 0 24px ${outcomeColor}88` }}
        >
          {outcomeLabel}
        </p>
        <p className="text-center text-[10px] text-muted uppercase tracking-wider mb-5">
          {matchResult.duels.length === 1 ? "Duello" : `${matchResult.duels.length} duelli`}
        </p>

        {/* Duel breakdown */}
        <div className="flex flex-col gap-2 mb-6">
          {matchResult.duels.map((duel, i) => {
            const name1 = creatureNames[duel.creature1Id] ?? `C.${duel.creature1Id.slice(0, 6)}`;
            const name2 = creatureNames[duel.creature2Id] ?? `C.${duel.creature2Id.slice(0, 6)}`;
            const c1Won = duel.winnerId === duel.creature1Id;
            const c2Won = duel.winnerId === duel.creature2Id;
            const duelDraw = duel.winnerId === null;

            return (
              <div
                key={i}
                className="rounded-xl border border-border/20 bg-surface/40 px-4 py-3"
              >
                {/* Duel index */}
                <p className="text-[9px] text-muted uppercase tracking-widest mb-2">
                  Duello {i + 1} · {duel.rounds} round{duel.rounds !== 1 ? "i" : ""}
                </p>

                {/* Fighters row */}
                <div className="flex items-center gap-2">
                  {/* Creature 1 */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-black truncate"
                      style={{ color: c1Won ? "#00e5a0" : duelDraw ? "#ffd600" : "#ff4466" }}
                    >
                      {name1}
                      {c1Won && <span className="ml-1 text-[9px]">WIN</span>}
                    </p>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${duel.hpPercent1}%`,
                          backgroundColor: c1Won ? "#00e5a0" : "#ff4466",
                        }}
                      />
                    </div>
                    <p className="text-[9px] text-muted mt-0.5">{Math.round(duel.hpPercent1)}% HP</p>
                  </div>

                  {/* VS divider */}
                  <span className="shrink-0 text-[10px] font-bold text-muted/50">vs</span>

                  {/* Creature 2 */}
                  <div className="flex-1 min-w-0 text-right">
                    <p
                      className="text-xs font-black truncate"
                      style={{ color: c2Won ? "#00e5a0" : duelDraw ? "#ffd600" : "#ff4466" }}
                    >
                      {c2Won && <span className="mr-1 text-[9px]">WIN</span>}
                      {name2}
                    </p>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden flex justify-end">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${duel.hpPercent2}%`,
                          backgroundColor: c2Won ? "#00e5a0" : "#ff4466",
                        }}
                      />
                    </div>
                    <p className="text-[9px] text-muted mt-0.5">{Math.round(duel.hpPercent2)}% HP</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full rounded-xl py-2.5 text-sm font-black uppercase tracking-widest transition-all hover:opacity-80"
          style={{ backgroundColor: outcomeColor + "22", color: outcomeColor, border: `1px solid ${outcomeColor}44` }}
        >
          CHIUDI
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Sub: SwissRoundView — round-by-round experience                    */
/* ------------------------------------------------------------------ */

function SwissRoundView({
  matches,
  standings,
  totalRounds,
  currentRound,
  myParticipantId,
  tournamentStatus,
}: {
  matches: Array<{
    id: string;
    roundNumber: number;
    participant1Id: string;
    participant2Id: string;
    participant1Name: string;
    participant2Name: string;
    winnerId: string | null;
    status: string;
    battleId?: string | null;
  }>;
  standings: StandingData[];
  totalRounds: number;
  currentRound: number;
  myParticipantId: string | null;
  tournamentStatus: string;
}) {
  const [viewingRound, setViewingRound] = useState(
    tournamentStatus === "completed" ? totalRounds : currentRound,
  );

  // Group matches by round
  const matchesByRound = new Map<number, typeof matches>();
  for (const m of matches) {
    const arr = matchesByRound.get(m.roundNumber) ?? [];
    arr.push(m);
    matchesByRound.set(m.roundNumber, arr);
  }

  const roundMatches = matchesByRound.get(viewingRound) ?? [];
  const roundComplete = roundMatches.length > 0 && roundMatches.every(m => m.status === "completed");

  // Build standings snapshot up to this round
  const standingsUpToRound = standings
    .map(s => {
      // Count points from matches up to viewingRound
      let pts = 0;
      let w = 0;
      let l = 0;
      for (let r = 1; r <= viewingRound; r++) {
        const rm = matchesByRound.get(r) ?? [];
        for (const m of rm) {
          if (m.status !== "completed") continue;
          if (m.participant1Id === s.participantId) {
            if (m.winnerId === s.participantId) { pts += 3; w++; }
            else if (m.winnerId) { l++; }
            else { pts += 1; }
          } else if (m.participant2Id === s.participantId) {
            if (m.winnerId === s.participantId) { pts += 3; w++; }
            else if (m.winnerId) { l++; }
            else { pts += 1; }
          }
        }
      }
      return { ...s, roundPoints: pts, roundWins: w, roundLosses: l };
    })
    .sort((a, b) => b.roundPoints - a.roundPoints || b.roundWins - a.roundWins);

  return (
    <div>
      {/* Round selector */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {Array.from({ length: totalRounds }).map((_, i) => {
          const rn = i + 1;
          const hasMatches = matchesByRound.has(rn);
          const allDone = hasMatches && (matchesByRound.get(rn) ?? []).every(m => m.status === "completed");
          return (
            <button
              key={rn}
              onClick={() => setViewingRound(rn)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                viewingRound === rn
                  ? "bg-[#9c27b0]/20 text-[#9c27b0] ring-1 ring-[#9c27b0]/30"
                  : hasMatches
                    ? "bg-surface-2 text-foreground hover:bg-surface-2/80"
                    : "bg-surface-2/30 text-muted/40"
              }`}
              disabled={!hasMatches}
            >
              R{rn}
              {allDone && <span className="ml-1 text-accent">{'\u2713'}</span>}
            </button>
          );
        })}
      </div>

      {/* Round matches */}
      <div className="rounded-xl border border-border/30 bg-surface/40 overflow-hidden mb-4">
        <div className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
          <span className="text-[11px] font-black text-[#9c27b0] uppercase tracking-wider">
            Round {viewingRound}
          </span>
          <span className={`text-[10px] font-bold ${roundComplete ? "text-accent" : "text-warning"}`}>
            {roundComplete ? "Completato" : "In corso"}
          </span>
        </div>

        {roundMatches.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted">Round non ancora generato.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {roundMatches.map((m) => {
              const isCompleted = m.status === "completed";
              const p1Won = m.winnerId === m.participant1Id;
              const p2Won = m.winnerId === m.participant2Id;
              const isMyMatch = m.participant1Id === myParticipantId || m.participant2Id === myParticipantId;

              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 px-3 py-2.5 ${
                    isMyMatch ? "bg-danger/5 border-l-2 border-l-danger" : ""
                  }`}
                >
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs truncate flex-1 text-right ${
                        isCompleted && p1Won ? "text-accent font-bold" : isCompleted && !p1Won ? "text-muted" : "text-foreground"
                      }`}
                    >
                      {m.participant1Name}
                    </span>

                    {isCompleted ? (
                      <span className="shrink-0 rounded bg-surface-2 px-2 py-0.5 text-[10px] font-mono font-bold text-foreground">
                        {p1Won ? "3" : m.winnerId ? "0" : "1"} - {p2Won ? "3" : m.winnerId ? "0" : "1"}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-muted font-bold px-2">vs</span>
                    )}

                    <span
                      className={`text-xs truncate flex-1 ${
                        isCompleted && p2Won ? "text-accent font-bold" : isCompleted && !p2Won ? "text-muted" : "text-foreground"
                      }`}
                    >
                      {m.participant2Name}
                    </span>
                  </div>

                  {/* Replay link */}
                  {isCompleted && m.battleId && (
                    <Link
                      href={`/arena/battle/${m.battleId}`}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-primary hover:text-foreground bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      {'\u25B6'}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Standings snapshot at this round */}
      <div className="rounded-xl border border-border/30 bg-surface/40 overflow-hidden">
        <div className="px-3 py-2 border-b border-border/20">
          <span className="text-[11px] font-black text-muted uppercase tracking-wider">
            Classifica dopo Round {viewingRound}
          </span>
        </div>
        <div className="divide-y divide-border/10">
          {standingsUpToRound.map((s, i) => {
            const isMe = s.participantId === myParticipantId;
            return (
              <div
                key={s.participantId}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                  isMe ? "bg-danger/5 border-l-2 border-l-danger" : ""
                }`}
              >
                <span className="w-5 text-muted font-mono text-[10px]">{i + 1}.</span>
                <span className="flex-1 font-bold text-foreground truncate">{s.displayName}</span>
                <span className="text-accent font-bold">{s.roundWins}V</span>
                <span className="text-danger">{s.roundLosses}S</span>
                <span className="font-black text-foreground w-8 text-right">{s.roundPoints}pt</span>
              </div>
            );
          })}
        </div>
      </div>
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
  const [myCreatures, setMyCreatures] = useState<{id: string; name: string; ageDays: number}[]>([]);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null);
  const [enrolledCreatureIds, setEnrolledCreatureIds] = useState<Set<string>>(new Set());
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [creatureNames, setCreatureNames] = useState<Record<string, string>>({});

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

        // Track which creature IDs the user already enrolled
        const enrolled = new Set<string>();
        if (detailJson.data.myEnrolledCreatureIds) {
          for (const cid of detailJson.data.myEnrolledCreatureIds) enrolled.add(cid);
        }
        setEnrolledCreatureIds(enrolled);

        // Creature names map for battle result overlay
        if (detailJson.data.creatureNames) {
          setCreatureNames(detailJson.data.creatureNames);
        }
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

  // Fetch user's warrior creatures for enrollment selector (1v1)
  useEffect(() => {
    async function fetchMyCreatures() {
      try {
        const res = await fetch('/api/creatures?warrior=true');
        if (res.ok) {
          const json = await res.json();
          setMyCreatures(json.data ?? []);
        }
      } catch { /* ignore */ }
    }
    fetchMyCreatures();
  }, []);

  const handleEnroll = useCallback(async () => {
    setEnrolling(true);
    try {
      const body = selectedCreatureId ? JSON.stringify({ creatureId: selectedCreatureId }) : undefined;
      const res = await fetch(
        `/api/arena/tournaments/${tournamentId}/enroll`,
        {
          method: "POST",
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body,
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast("error", json.error?.message ?? "Errore durante l'iscrizione.");
        return;
      }
      toast("success", "Iscrizione completata!");
      setSelectedCreatureId(null);
      fetchData();
    } catch {
      toast("error", "Errore di rete durante l'iscrizione.");
    } finally {
      setEnrolling(false);
    }
  }, [tournamentId, selectedCreatureId, fetchData, toast]);

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

        const result = json.data as MatchResult & {
          team1Wins: number;
          team2Wins: number;
          team1TotalHpPercent: number;
          team2TotalHpPercent: number;
        };

        // Show the result overlay
        setMatchResult({
          result: result.result,
          winnerParticipantId: result.winnerParticipantId,
          duels: result.duels,
        });

        // Backup toast for accessibility / quick feedback
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

  // Build name map for bracket — use creature name, not player name
  const nameMap = new Map(participants.map((p) => [p.id, p.creatureName ?? p.displayName]));

  const bracketMatches = matches.map((m) => ({
    ...m,
    participant1Name: nameMap.get(m.participant1Id) ?? "???",
    participant2Name: nameMap.get(m.participant2Id) ?? "???",
    winnerName: m.winnerId ? (nameMap.get(m.winnerId) ?? null) : null,
  }));

  const isKnockout =
    tournament.tournamentType === "knockout" ||
    tournament.tournamentType === "random";
  const isSwiss = tournament.tournamentType === "swiss";

  // Find my playable matches
  const myPlayableMatches = matches.filter(
    (m) =>
      (m.participant1Id === myParticipantId ||
        m.participant2Id === myParticipantId) &&
      (m.status === "pending" || m.status === "scheduled"),
  );

  return (
    <div>
      {/* Match result overlay */}
      {matchResult && (
        <MatchResultOverlay
          matchResult={matchResult}
          myParticipantId={myParticipantId}
          creatureNames={creatureNames}
          onClose={() => {
            setMatchResult(null);
          }}
        />
      )}

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
          {tournament.status === "enrollment" && !(tournament.maxParticipants && participants.length >= tournament.maxParticipants) && (
            <Button
              variant="accent"
              size="sm"
              onClick={handleEnroll}
              loading={enrolling}
              className="uppercase font-black tracking-wider text-[11px]"
            >
              {isEnrolled ? 'ISCRIVI ALTRA' : 'ISCRIVITI'}
            </Button>
          )}
          {tournament.status === "enrollment" && isEnrolled && !(tournament.maxParticipants && participants.length >= tournament.maxParticipants) && (
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
          {tournament.status === "enrollment" && tournament.maxParticipants && participants.length >= tournament.maxParticipants && (
            <span className="text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1">
              {'\u2705'} Tabellone completo
            </span>
          )}
        </div>
      </div>

      {/* View tabs + bracket/matches — ABOVE participants when active/completed */}
      {tournament.status !== "enrollment" && (
        <>
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
              { id: "bracket" as const, label: isKnockout ? "TABELLONE" : isSwiss ? "ROUND" : "CLASSIFICA" },
              { id: "standings" as const, label: "CLASSIFICA" },
              { id: "matches" as const, label: "MATCH" },
            ]
              .filter((tab) => {
                if (!isKnockout && !isSwiss && tab.id === "bracket") return false;
                if ((isKnockout || isSwiss) && tab.id === "standings") return false;
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

          {activeView === "bracket" && isSwiss && (
            <SwissRoundView
              matches={bracketMatches}
              standings={standings}
              totalRounds={tournament.totalRounds ?? 1}
              currentRound={tournament.currentRound}
              myParticipantId={myParticipantId}
              tournamentStatus={tournament.status}
            />
          )}

          {(activeView === "standings" || (activeView === "bracket" && !isKnockout && !isSwiss)) && (
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
        </>
      )}

      {/* Creature selector for enrollment (1v1) — only if slots available */}
      {tournament.status === "enrollment" && tournament.battleFormat === "1v1" && myCreatures.length > 0 && !(tournament.maxParticipants && participants.length >= tournament.maxParticipants) && (
        <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-3">
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">
            Scegli creatura da iscrivere
          </p>
          <div className="flex flex-wrap gap-2">
            {myCreatures
              .filter(c => !enrolledCreatureIds.has(c.id))
              .map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCreatureId(selectedCreatureId === c.id ? null : c.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedCreatureId === c.id
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border/30 bg-surface/60 text-foreground hover:border-accent/40'
                  }`}
                >
                  {c.name}
                  <span className="ml-1 text-[9px] text-muted font-normal">G{c.ageDays}</span>
                </button>
              ))}
            {myCreatures.filter(c => !enrolledCreatureIds.has(c.id)).length === 0 && (
              <p className="text-[10px] text-muted italic">Tutte le tue creature guerriero sono già iscritte.</p>
            )}
          </div>
        </div>
      )}

      {/* Enrolled participants — fighter cards */}
      {participants.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-black text-muted uppercase tracking-wider mb-3 px-1">
            Combattenti ({participants.length}{tournament.maxParticipants ? `/${tournament.maxParticipants}` : ''})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {participants.map((p, i) => {
              const vp = p.creatureVisualParams
                ? { ...DEFAULT_VISUAL_PARAMS, ...(p.creatureVisualParams as Partial<VisualParams>) } as VisualParams
                : null;
              const isMe = p.id === myParticipantId;
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col items-center rounded-xl border p-3 transition-all ${
                    p.isEliminated
                      ? 'border-danger/20 bg-danger/5 opacity-40'
                      : isMe
                        ? 'border-accent/50 bg-accent/5 shadow-[0_0_12px_rgba(0,229,160,0.1)]'
                        : 'border-border/30 bg-surface/40 hover:border-border/50'
                  }`}
                >
                  {/* Seed number */}
                  <span className="absolute top-2 left-2.5 text-[10px] font-mono text-muted/40">#{i + 1}</span>
                  {isMe && <span className="absolute top-2 right-2.5 text-[9px] font-bold text-accent">TU</span>}

                  {/* Creature SVG */}
                  {vp && (
                    <div className={`mb-2 ${p.isEliminated ? 'grayscale' : ''}`}>
                      <CreatureRenderer params={vp} size={90} animated={false} seed={42} />
                    </div>
                  )}

                  {/* Creature name */}
                  <p className="text-sm font-bold text-foreground truncate max-w-full text-center">
                    {p.creatureName ?? '???'}
                  </p>

                  {/* Owner */}
                  <p className="text-[10px] text-muted truncate max-w-full text-center">
                    {p.displayName}
                  </p>

                  {/* Day + Status */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {p.creatureAgeDays != null && (
                      <span className="text-[9px] text-muted">Giorno {p.creatureAgeDays}</span>
                    )}
                    {p.isEliminated && (
                      <span className="rounded-sm bg-danger/20 px-1.5 py-0.5 text-[8px] font-bold text-danger uppercase">Eliminato</span>
                    )}
                  </div>

                  {/* Battle stats if tournament has started */}
                  {p.matchesPlayed > 0 && (
                    <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                      <span className="font-bold text-accent">{p.matchesWon}V</span>
                      <span className="font-bold text-danger">{p.matchesLost}S</span>
                      {p.matchesDrawn > 0 && <span className="font-bold text-warning">{p.matchesDrawn}P</span>}
                      <span className="text-muted">· {p.points}pt</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View tabs/bracket/matches for enrollment-only (shown below participants) */}
      {tournament.status === "enrollment" && (
        <>
          <div className="flex gap-0 mb-4 border-b border-border/30">
            {[
              { id: "bracket" as const, label: isKnockout ? "TABELLONE" : "CLASSIFICA" },
              { id: "standings" as const, label: "CLASSIFICA" },
              { id: "matches" as const, label: "MATCH" },
            ]
              .filter((tab) => {
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
        </>
      )}
    </div>
  );
}
