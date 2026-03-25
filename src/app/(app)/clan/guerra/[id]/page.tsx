"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface WarMatch {
  id: string;
  matchIndex: number;
  creature1Id: string;
  creature1Name: string;
  creature2Id: string;
  creature2Name: string;
  battleId: string | null;
  winnerCreatureId: string | null;
  status: string;
  hpPercent1: number | null;
  hpPercent2: number | null;
}

interface WarDetail {
  id: string;
  challengerClanId: string;
  challengerClanName: string;
  challengerClanColor: string | null;
  defenderClanId: string;
  defenderClanName: string;
  defenderClanColor: string | null;
  format: string;
  status: string;
  challengerWins: number;
  defenderWins: number;
  winnerClanId: string | null;
  prestigeStakes: number;
  challengerEloBefore: number;
  defenderEloBefore: number;
  challengerEloAfter: number | null;
  defenderEloAfter: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function ClanWarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: warId } = use(params);
  const [war, setWar] = useState<WarDetail | null>(null);
  const [matches, setMatches] = useState<WarMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function fetchWar() {
    try {
      const res = await fetch(`/api/clan-war/${warId}`);
      if (res.ok) {
        const json = await res.json();
        setWar(json.data?.war ?? null);
        setMatches(json.data?.matches ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWar();
  }, [warId]);

  async function handleAccept() {
    setPlaying(true);
    try {
      const res = await fetch(`/api/clan-war/${warId}/accept`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchWar();
      }
    } catch {
      // silently ignore
    } finally {
      setPlaying(false);
    }
  }

  async function handleDecline() {
    setPlaying(true);
    try {
      const res = await fetch(`/api/clan-war/${warId}/decline`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchWar();
      }
    } catch {
      // silently ignore
    } finally {
      setPlaying(false);
    }
  }

  async function handlePlayNext() {
    setPlaying(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/clan-war/${warId}/play`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        if (d.forfeit) {
          setLastResult(`${d.forfeiter} non si presenta. Vittoria per forfeit!`);
        } else if (d.isDraw) {
          setLastResult(`Match ${d.matchIndex + 1}: Pareggio tra ${d.challengerName} e ${d.defenderName} (${d.rounds} round)`);
        } else {
          const winnerName = d.winnerId === d.challengerName ? d.challengerName : d.defenderName;
          setLastResult(`Match ${d.matchIndex + 1}: ${winnerName} vince in ${d.rounds} round!`);
        }
        if (d.warCompleted) {
          setLastResult((prev) => prev + " | GUERRA CONCLUSA!");
        }
        await fetchWar();
      }
    } catch {
      // silently ignore
    } finally {
      setPlaying(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  if (!war) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-muted">Guerra non trovata.</p>
        <Link href="/clan" className="mt-4 inline-block text-xs text-primary hover:underline">
          Torna al Clan
        </Link>
      </div>
    );
  }

  const challengerColor = war.challengerClanColor || "#dc2626";
  const defenderColor = war.defenderClanColor || "#3d5afe";
  const isCompleted = war.status === "completed";
  const isPending = war.status === "pending";
  const isInProgress = war.status === "in_progress";
  const formatLabel = { bo3: "Best of 3", bo5: "Best of 5", bo7: "Best of 7" }[war.format] ?? war.format;
  const hasPendingMatches = matches.some((m) => m.status === "pending");

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6">
      {/* Back */}
      <Link
        href="/clan"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Clan
      </Link>

      {/* War header */}
      <div className="mb-6 rounded-xl border border-border/30 bg-surface/30 p-5">
        <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted">
          Sfida di Clan &middot; {formatLabel}
        </div>

        {/* VS display */}
        <div className="flex items-center justify-center gap-4">
          <div className="text-right">
            <div
              className="text-lg font-black text-foreground sm:text-xl"
              style={{ color: challengerColor }}
            >
              {war.challengerClanName}
            </div>
            <div className="text-xs text-muted">ELO {war.challengerEloBefore}</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-black text-foreground sm:text-3xl">
              {war.challengerWins} - {war.defenderWins}
            </div>
          </div>

          <div className="text-left">
            <div
              className="text-lg font-black text-foreground sm:text-xl"
              style={{ color: defenderColor }}
            >
              {war.defenderClanName}
            </div>
            <div className="text-xs text-muted">ELO {war.defenderEloBefore}</div>
          </div>
        </div>

        {/* Status badge */}
        <div className="mt-3 text-center">
          {isCompleted && war.winnerClanId && (
            <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">
              Vincitore: {war.winnerClanId === war.challengerClanId ? war.challengerClanName : war.defenderClanName}
            </span>
          )}
          {isPending && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
              In Attesa di Accettazione
            </span>
          )}
          {isInProgress && (
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-400">
              In Corso
            </span>
          )}
          {war.status === "declined" && (
            <span className="rounded-full bg-gray-500/20 px-3 py-1 text-xs font-bold text-gray-400">
              Rifiutata
            </span>
          )}
        </div>

        {/* ELO changes on completion */}
        {isCompleted && war.challengerEloAfter !== null && war.defenderEloAfter !== null && (
          <div className="mt-3 flex justify-center gap-6 text-xs">
            <span className="text-muted">
              {war.challengerClanName}: {war.challengerEloAfter - war.challengerEloBefore > 0 ? "+" : ""}
              {war.challengerEloAfter - war.challengerEloBefore} ELO
            </span>
            <span className="text-muted">
              {war.defenderClanName}: {war.defenderEloAfter - war.defenderEloBefore > 0 ? "+" : ""}
              {war.defenderEloAfter - war.defenderEloBefore} ELO
            </span>
          </div>
        )}
      </div>

      {/* Pending: accept/decline buttons */}
      {isPending && (
        <div className="mb-6 flex gap-3 justify-center">
          <button
            onClick={handleAccept}
            disabled={playing}
            className="rounded-lg bg-primary/20 px-6 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/30 disabled:opacity-50"
          >
            {playing ? "..." : "Accetta la Sfida"}
          </button>
          <button
            onClick={handleDecline}
            disabled={playing}
            className="rounded-lg border border-border/30 bg-surface/50 px-6 py-2.5 text-sm font-medium text-muted transition hover:text-foreground disabled:opacity-50"
          >
            Rifiuta
          </button>
        </div>
      )}

      {/* Play next match button */}
      {isInProgress && hasPendingMatches && (
        <div className="mb-6 text-center">
          <button
            onClick={handlePlayNext}
            disabled={playing}
            className="rounded-lg bg-danger/80 px-8 py-3 text-sm font-black uppercase text-white transition hover:bg-danger disabled:opacity-50"
          >
            {playing ? "Combattimento in corso..." : "Gioca Prossimo Match"}
          </button>
        </div>
      )}

      {/* Last result */}
      {lastResult && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm text-foreground">
          {lastResult}
        </div>
      )}

      {/* Match list */}
      {matches.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Match
          </h2>
          <div className="space-y-2">
            {matches.map((match) => {
              const isDone = match.status === "completed";
              const c1Won = match.winnerCreatureId === match.creature1Id;
              const c2Won = match.winnerCreatureId === match.creature2Id;
              const draw = isDone && !match.winnerCreatureId;

              return (
                <div
                  key={match.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    isDone
                      ? "border-border/20 bg-surface/30"
                      : "border-border/10 bg-surface/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted">
                      #{match.matchIndex + 1}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        c1Won ? "text-green-400" : c2Won ? "text-red-400/60" : "text-foreground"
                      }`}
                    >
                      {match.creature1Name}
                    </span>
                    <span className="text-xs text-muted">vs</span>
                    <span
                      className={`text-sm font-bold ${
                        c2Won ? "text-green-400" : c1Won ? "text-red-400/60" : "text-foreground"
                      }`}
                    >
                      {match.creature2Name}
                    </span>
                  </div>
                  <div>
                    {isDone ? (
                      draw ? (
                        <span className="rounded-full bg-gray-500/20 px-2 py-0.5 text-[9px] font-bold text-gray-400">
                          PAREGGIO
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-bold text-green-400">
                          {match.winnerCreatureId === match.creature1Id
                            ? match.creature1Name
                            : match.creature2Name}
                        </span>
                      )
                    ) : (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                        IN ATTESA
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
