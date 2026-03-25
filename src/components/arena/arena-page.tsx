"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WarriorCard, TierBadge, type WarriorData } from "./warrior-card";
import { CaricaBadge } from "@/components/cariche/carica-badge";
import { OpponentCard, type OpponentData } from "./opponent-card";
import { BattleSuspense } from "./battle-suspense";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import type { RoundEvent } from "@/types/battle";
import { FarmingPage } from "./farming-page";
import { SquadManager } from "./squad-manager";
import { TournamentList } from "./tournament-list";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type Zone = "sfide" | "squadre" | "tornei";
type SfideTab = "ranked" | "farming" | "classifica" | "cronologia";
type Tab = "sfida" | "farming" | "tornei" | "squadra" | "classifica" | "cronologia";

interface RankingEntry {
  position: number;
  creatureId: string;
  name: string;
  ownerName: string;
  ageDays: number | null;
  eloRating: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestWinStreak: number;
  tier: string;
  cariche?: string[];
  isBot?: boolean;
}

interface BattleHistoryEntry {
  battleId: string;
  opponentName: string;
  myCreatureName: string;
  result: "victory" | "defeat" | "draw";
  eloDelta: number;
  eloBefore: number;
  eloAfter: number;
  roundsPlayed: number;
  date: string;
}

interface ChallengeResult {
  battleId: string;
  result: "victory" | "defeat" | "draw";
  winnerId: string | null;
  rounds: number;
  challengerHpPercent: number;
  defenderHpPercent: number;
  eloChanges: {
    challenger: { before: number; after: number; delta: number };
    defender: { before: number; after: number; delta: number };
  };
  events: RoundEvent[];
  mvpAction: string;
}

/* ------------------------------------------------------------------ */
/* Sub: Tabs                                                          */
/* ------------------------------------------------------------------ */

const TABS: { id: Tab; label: string }[] = [
  { id: "sfida", label: "SFIDA" },
  { id: "farming", label: "FARMING" },
  { id: "tornei", label: "TORNEI" },
  { id: "squadra", label: "SQUADRA" },
  { id: "classifica", label: "CLASSIFICA" },
  { id: "cronologia", label: "CRONOLOGIA" },
];

/* ------------------------------------------------------------------ */
/* Sub: BattleResultModal                                             */
/* ------------------------------------------------------------------ */

function BattleResultModal({
  result,
  warrior,
  opponentName,
  opponentVisualParams,
  onClose,
  onReplay,
}: {
  result: ChallengeResult;
  warrior: WarriorData;
  opponentName: string;
  opponentVisualParams: Record<string, unknown>;
  onClose: () => void;
  onReplay: () => void;
}) {
  const isVictory = result.result === "victory";
  const isDraw = result.result === "draw";

  const resultLabel = isVictory ? "VITTORIA!" : isDraw ? "PAREGGIO" : "SCONFITTA";
  const resultColor = isVictory ? "text-accent" : isDraw ? "text-warning" : "text-danger";
  const resultGlow = isVictory ? "glow-green" : isDraw ? "glow-orange" : "glow-red";
  const eloDelta = result.eloChanges.challenger.delta;

  const wVp = { ...DEFAULT_VISUAL_PARAMS, ...(warrior.visualParams as Partial<VisualParams>) } as VisualParams;
  const oVp = { ...DEFAULT_VISUAL_PARAMS, ...(opponentVisualParams as Partial<VisualParams>) } as VisualParams;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm p-0 md:p-4">
      <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-border/50 bg-surface p-5 md:p-6">
        {/* Creatures side by side */}
        <div className="flex items-center justify-center gap-3 md:gap-4 mb-4">
          <div className="text-center">
            <CreatureRenderer params={wVp} size={120} animated />
            <p className="text-[10px] md:text-xs text-muted mt-1 truncate max-w-[100px] md:max-w-[120px]">{warrior.name}</p>
          </div>
          <span className="text-base md:text-lg font-black text-muted">VS</span>
          <div className="text-center">
            <div style={{ transform: "scaleX(-1)" }}>
              <CreatureRenderer params={oVp} size={120} animated />
            </div>
            <p className="text-[10px] md:text-xs text-muted mt-1 truncate max-w-[100px] md:max-w-[120px]">{opponentName}</p>
          </div>
        </div>

        {/* Result */}
        <h2 className={`text-center text-3xl font-black ${resultColor} ${resultGlow} mb-2`}>
          {resultLabel}
        </h2>

        {/* ELO change */}
        <p className={`text-center text-lg font-bold mb-4 ${eloDelta >= 0 ? "text-accent" : "text-danger"}`}>
          {eloDelta >= 0 ? "+" : ""}{eloDelta} ELO
        </p>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted mb-6 bg-surface-2 rounded-lg p-3">
          <span>Round giocati: <strong className="text-foreground">{result.rounds}</strong></span>
          <span>HP finale: <strong className="text-foreground">{Math.round(result.challengerHpPercent)}%</strong></span>
          <span className="col-span-2 text-[10px] italic mt-1">{result.mvpAction}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" fullWidth onClick={onClose}>
            CHIUDI
          </Button>
          <Button variant="danger" size="sm" fullWidth onClick={onReplay}>
            GUARDA REPLAY
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: ConfirmChallengeModal                                         */
/* ------------------------------------------------------------------ */

function ConfirmChallengeModal({
  opponentName,
  onConfirm,
  onCancel,
  loading,
}: {
  opponentName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/50 bg-surface p-6">
        <h3 className="text-lg font-bold text-foreground mb-2">Conferma Sfida</h3>
        <p className="text-sm text-muted mb-6">
          Vuoi sfidare <strong className="text-foreground">{opponentName}</strong>?
          Il combattimento sara risolto immediatamente.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" fullWidth onClick={onCancel} disabled={loading}>
            ANNULLA
          </Button>
          <Button variant="danger" size="sm" fullWidth onClick={onConfirm} loading={loading}>
            SFIDA!
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Sfida                                                         */
/* ------------------------------------------------------------------ */

function SfidaTab({ warrior }: { warrior: WarriorData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [opponents, setOpponents] = useState<OpponentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeTarget, setChallengeTarget] = useState<{ id: string; name: string } | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [battleSuspense, setBattleSuspense] = useState<{
    result: ChallengeResult;
    opponentName: string;
    opponentVp: Record<string, unknown>;
  } | null>(null);
  const [battleResult, setBattleResult] = useState<{
    result: ChallengeResult;
    opponentName: string;
    opponentVp: Record<string, unknown>;
  } | null>(null);

  const fetchOpponents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/arena/opponents");
      if (!res.ok) throw new Error("Errore nel caricamento avversari");
      const json = await res.json();
      setOpponents(json.data ?? []);
    } catch {
      toast("error", "Errore nel caricamento degli avversari.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOpponents();
  }, [fetchOpponents]);

  const handleChallenge = useCallback((creatureId: string) => {
    const opp = opponents.find((o) => o.creatureId === creatureId);
    if (opp) {
      setChallengeTarget({ id: creatureId, name: opp.name });
    }
  }, [opponents]);

  const executeChallenge = useCallback(async () => {
    if (!challengeTarget) return;
    setChallenging(true);
    try {
      const res = await fetch("/api/arena/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defenderCreatureId: challengeTarget.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast("error", json.error?.message ?? "Errore nella sfida.");
        setChallengeTarget(null);
        return;
      }
      const opp = opponents.find((o) => o.creatureId === challengeTarget.id);
      setBattleSuspense({
        result: json.data,
        opponentName: challengeTarget.name,
        opponentVp: opp?.visualParams ?? {},
      });
      setChallengeTarget(null);
    } catch {
      toast("error", "Errore di rete durante la sfida.");
    } finally {
      setChallenging(false);
    }
  }, [challengeTarget, opponents, toast]);

  const isInRecovery = warrior.recovery.active;

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Warrior sidebar */}
        <div className="w-full lg:w-72 lg:shrink-0">
          {/* Compact on mobile, full on desktop */}
          <div className="lg:hidden">
            <WarriorCard warrior={warrior} compact />
          </div>
          <div className="hidden lg:block">
            <WarriorCard warrior={warrior} />
          </div>
        </div>

        {/* Opponents grid */}
        <div className="flex-1">
          <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
            Avversari Disponibili
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 rounded-xl border border-border/30 bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : opponents.length === 0 ? (
            <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
              <p className="text-sm text-muted">Nessun avversario disponibile al momento.</p>
              <p className="text-[10px] text-muted mt-1">Torna piu tardi o aspetta che altri guerrieri si registrino.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
              {opponents.map((opp) => (
                <OpponentCard
                  key={opp.creatureId}
                  opponent={opp}
                  disabled={isInRecovery}
                  onChallenge={handleChallenge}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {challengeTarget && (
        <ConfirmChallengeModal
          opponentName={challengeTarget.name}
          onConfirm={executeChallenge}
          onCancel={() => setChallengeTarget(null)}
          loading={challenging}
        />
      )}

      {/* Battle suspense animation */}
      {battleSuspense && (
        <BattleSuspense
          challengerName={warrior.name}
          defenderName={battleSuspense.opponentName}
          challengerVisualParams={warrior.visualParams}
          defenderVisualParams={battleSuspense.opponentVp}
          challengerCreatureId={warrior.creatureId}
          events={battleSuspense.result.events}
          totalRounds={battleSuspense.result.rounds}
          result={battleSuspense.result.result}
          eloDelta={battleSuspense.result.eloChanges.challenger.delta}
          battleId={battleSuspense.result.battleId}
          onComplete={() => {
            setBattleResult(battleSuspense);
            setBattleSuspense(null);
          }}
        />
      )}

      {/* Result modal */}
      {battleResult && (
        <BattleResultModal
          result={battleResult.result}
          warrior={warrior}
          opponentName={battleResult.opponentName}
          opponentVisualParams={battleResult.opponentVp}
          onClose={() => {
            setBattleResult(null);
            router.refresh();
          }}
          onReplay={() => {
            router.push(`/arena/battle/${battleResult.result.battleId}`);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Classifica                                                    */
/* ------------------------------------------------------------------ */

function ClassificaTab({ myCreatureId }: { myCreatureId: string }) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [tierFilter, setTierFilter] = useState("all");
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const { toast } = useToast();
  const perPage = 20;

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(perPage),
        offset: String(offset),
        tier: tierFilter,
      });
      const res = await fetch(`/api/arena/rankings?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRankings(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
      setMyPosition(json.myPosition?.position ?? null);
    } catch {
      toast("error", "Errore nel caricamento della classifica.");
    } finally {
      setLoading(false);
    }
  }, [offset, tierFilter, toast]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const totalPages = Math.ceil(total / perPage);
  const currentPage = Math.floor(offset / perPage) + 1;

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted uppercase">Fascia:</label>
          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value); setOffset(0); }}
            className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-foreground focus:outline-none focus:border-danger"
          >
            <option value="all">Tutte</option>
            <option value="novice">Novizio</option>
            <option value="intermediate">Intermedio</option>
            <option value="veteran">Veterano</option>
            <option value="legend">Leggenda</option>
            <option value="immortal">Immortale</option>
            <option value="divine">Divinità</option>
          </select>
        </div>
        {myPosition && (
          <span className="text-xs text-muted">
            La tua posizione: <strong className="text-foreground">#{myPosition}</strong>
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : rankings.length === 0 ? (
        <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
          <p className="text-sm text-muted">Nessun guerriero registrato in questa fascia.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="hidden md:grid md:grid-cols-[3rem_1fr_1fr_5rem_5rem_4rem_5rem_4rem] gap-2 px-3 py-1.5 text-[10px] text-muted uppercase tracking-wider border-b border-border/30">
            <span>#</span>
            <span>Creatura</span>
            <span>Proprietario</span>
            <span>ELO</span>
            <span>V/S</span>
            <span>Streak</span>
            <span>Tier</span>
            <span>Giorno</span>
          </div>

          {rankings.map((entry) => {
            const isMe = entry.creatureId === myCreatureId;
            return (
              <div
                key={entry.creatureId}
                className={`grid grid-cols-[2.5rem_1fr_auto] md:grid-cols-[3rem_1fr_1fr_5rem_5rem_4rem_5rem_4rem] gap-2 px-3 py-2 text-xs items-center border-b border-border/10 ${
                  isMe ? "bg-danger/5 border-l-2 border-l-danger" : ""
                }`}
              >
                <span className="font-mono text-muted">{entry.position}</span>
                <span className="font-bold text-foreground truncate flex items-center gap-1">
                  {entry.name}
                  {entry.cariche && entry.cariche.map((cId) => (
                    <CaricaBadge key={cId} caricaId={cId} compact />
                  ))}
                </span>
                <span className="hidden md:block text-muted truncate">
                  {entry.ownerName}
                  {entry.isBot && (
                    <span className="ml-1 rounded-sm bg-surface-3 px-1 py-0.5 text-[7px] font-bold text-muted/60 uppercase">Bot</span>
                  )}
                </span>
                <span className="font-mono text-foreground">{entry.eloRating}</span>
                <span className="hidden md:block text-muted">
                  <span className="text-accent">{entry.wins}V</span> <span className="text-danger">{entry.losses}S</span>{entry.draws > 0 && <> <span className="text-warning">{entry.draws}P</span></>}
                </span>
                <span className="hidden md:block text-muted">{entry.winStreak}</span>
                <span className="hidden md:block"><TierBadge tier={entry.tier} /></span>
                <span className="hidden md:block text-muted">{entry.ageDays}</span>

                {/* Mobile: right side */}
                <div className="flex items-center gap-2 md:hidden">
                  <span className="font-mono text-foreground">{entry.eloRating}</span>
                  <TierBadge tier={entry.tier} />
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setOffset(Math.max(0, offset - perPage))}
              >
                Prec.
              </Button>
              <span className="text-xs text-muted">
                Pagina {currentPage} di {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setOffset(offset + perPage)}
              >
                Succ.
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Cronologia                                                    */
/* ------------------------------------------------------------------ */

function CronologiaTab({ activeCreatureName }: { activeCreatureName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [history, setHistory] = useState<BattleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/arena/battles/history?limit=50");
        if (!res.ok) throw new Error();
        const json = await res.json();
        setHistory(json.data ?? []);
      } catch {
        toast("error", "Errore nel caricamento della cronologia.");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [toast]);

  const resultLabel = (r: string) => r === "victory" ? "V" : r === "defeat" ? "S" : "P";
  const resultColor = (r: string) => r === "victory" ? "text-accent" : r === "defeat" ? "text-danger" : "text-warning";

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
        <p className="text-sm text-muted">Nessuna battaglia nella cronologia.</p>
        <p className="text-[10px] text-muted mt-1">Sfida un avversario per iniziare!</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header (desktop) */}
      <div className="hidden md:grid md:grid-cols-[7rem_1fr_1fr_3rem_5rem_4rem] gap-2 px-3 py-1.5 text-[10px] text-muted uppercase tracking-wider border-b border-border/30">
        <span>Data</span>
        <span>La tua creatura</span>
        <span>Avversario</span>
        <span>Esito</span>
        <span>ELO</span>
        <span>Round</span>
      </div>

      {history.map((entry) => {
        const isActive = entry.myCreatureName === activeCreatureName;
        return (
        <button
          key={entry.battleId}
          onClick={() => router.push(`/arena/battle/${entry.battleId}`)}
          className={`w-full grid grid-cols-[auto_1fr_auto] md:grid-cols-[7rem_1fr_1fr_3rem_5rem_4rem] gap-2 px-3 py-2.5 text-xs items-center border-b border-border/10 transition-colors text-left ${
            isActive ? 'bg-primary/[0.04] hover:bg-primary/[0.08] border-l-2 border-l-primary/40' : 'hover:bg-surface-2'
          }`}
        >
          <span className="text-muted font-mono text-[10px]">
            {new Date(entry.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
          {/* Mobile: "MiaCreatura vs Avversario" in one column */}
          <span className="text-foreground truncate md:hidden">
            <span className="text-primary">{entry.myCreatureName}</span>
            <span className="text-muted"> vs </span>
            {entry.opponentName}
          </span>
          {/* Desktop: separate columns */}
          <span className="hidden md:block text-primary truncate">{entry.myCreatureName}</span>
          <span className="hidden md:block text-foreground truncate">{entry.opponentName}</span>
          <span className={`font-bold ${resultColor(entry.result)}`}>
            {resultLabel(entry.result)}
          </span>
          <span className={`hidden md:block font-mono ${entry.eloDelta >= 0 ? "text-accent" : "text-danger"}`}>
            {entry.eloDelta >= 0 ? "+" : ""}{entry.eloDelta}
          </span>
          <span className="hidden md:block text-muted">{entry.roundsPlayed}</span>

          {/* Mobile: delta in same row */}
          <span className={`md:hidden font-mono text-[10px] ${entry.eloDelta >= 0 ? "text-accent" : "text-danger"}`}>
            {entry.eloDelta >= 0 ? "+" : ""}{entry.eloDelta}
          </span>
        </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main ArenaPage Component                                           */
/* ------------------------------------------------------------------ */

interface ArenaPageProps {
  warrior: WarriorData;
  unseenDefenderBattles?: number;
  hasSquad?: boolean;
}

export function ArenaPage({ warrior, unseenDefenderBattles = 0, hasSquad = false }: ArenaPageProps) {
  const [activeZone, setActiveZone] = useState<Zone>("sfide");
  const [sfideTab, setSfideTab] = useState<SfideTab>("ranked");
  const [showUnseenBanner, setShowUnseenBanner] = useState(unseenDefenderBattles > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* Unseen defender battles banner */}
      {showUnseenBanner && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-danger">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-xs font-bold text-danger">
                Hai subito {unseenDefenderBattles} sfid{unseenDefenderBattles === 1 ? 'a' : 'e'} mentre eri assente!
              </p>
              <button
                onClick={() => { setActiveZone("sfide"); setSfideTab("cronologia"); setShowUnseenBanner(false); }}
                className="text-[10px] text-danger/80 underline hover:text-danger"
              >
                Guarda la cronologia
              </button>
            </div>
          </div>
          <button onClick={() => setShowUnseenBanner(false)} className="shrink-0 rounded p-1 text-danger/60 hover:text-danger">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Header with zone switch */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-foreground tracking-tight">
            <span className="text-danger glow-red">Arena</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">Il centro del gioco. Ranking, gloria, sopravvivenza.</p>
        </div>

        {/* Zone switch — like biosfera toggle */}
        <div className="flex items-center gap-0.5 rounded-lg bg-surface-2/80 p-0.5">
          {([
            { id: 'sfide' as Zone, label: 'Sfide' },
            { id: 'squadre' as Zone, label: 'Squadre' },
            { id: 'tornei' as Zone, label: 'Tornei' },
          ]).map((z) => (
            <button
              key={z.id}
              onClick={() => setActiveZone(z.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                activeZone === z.id
                  ? 'bg-danger/20 text-danger shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {/* === ZONE: SFIDE === */}
      {activeZone === "sfide" && (
        <>
          {/* Sub-tabs for sfide zone */}
          <div className="flex gap-0 mb-5 border-b border-border/30">
            {([
              { id: 'ranked' as SfideTab, label: '1v1 Ranked' },
              { id: 'farming' as SfideTab, label: 'Farming' },
              { id: 'classifica' as SfideTab, label: 'Classifica' },
              { id: 'cronologia' as SfideTab, label: 'Cronologia' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSfideTab(tab.id)}
                className={`shrink-0 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                  sfideTab === tab.id
                    ? 'text-danger border-danger'
                    : 'text-muted border-transparent hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {sfideTab === "ranked" && <SfidaTab warrior={warrior} />}
          {sfideTab === "farming" && <FarmingPage />}
          {sfideTab === "classifica" && <ClassificaTab myCreatureId={warrior.creatureId} />}
          {sfideTab === "cronologia" && <CronologiaTab activeCreatureName={warrior.name} />}
        </>
      )}

      {/* === ZONE: SQUADRE === */}
      {activeZone === "squadre" && <SquadManager />}

      {/* === ZONE: TORNEI === */}
      {activeZone === "tornei" && <TournamentList />}
    </div>
  );
}
