"use client";

import { useState, useEffect, useCallback } from "react";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  SquadBattleResult,
  type SquadBattleResultData,
} from "./squad-battle-result";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type FarmingFormat = "1v1" | "2v2" | "3v3";

interface FarmingOpponent {
  userId: string;
  userName: string;
  creatureId?: string;
  creatureName?: string;
  ageDays?: number | null;
  eloRating?: number;
  attackPower?: number;
  defense?: number;
  speed?: number;
  visualParams?: Record<string, unknown>;
  // For 2v2/3v3 — player cards with squad preview
  squadPreview?: {
    name: string;
    visualParams: Record<string, unknown>;
  }[];
}

interface FarmingStats {
  wins: number;
  losses: number;
  farmingAxp: number;
  battlesToday: number;
  dailyLimit: number;
}

/* ------------------------------------------------------------------ */
/* Sub: FormatSelector                                                */
/* ------------------------------------------------------------------ */

function FormatSelector({
  format,
  onFormatChange,
}: {
  format: FarmingFormat;
  onFormatChange: (f: FarmingFormat) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5">
      {(["1v1", "2v2", "3v3"] as FarmingFormat[]).map((f) => (
        <button
          key={f}
          onClick={() => onFormatChange(f)}
          className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all ${
            format === f
              ? "bg-accent/20 text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: FarmingStatsBar                                               */
/* ------------------------------------------------------------------ */

function FarmingStatsBar({ stats }: { stats: FarmingStats }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-2/50 border border-border/20 px-4 py-2.5 mb-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-[9px] text-muted uppercase tracking-wider">
            Vittorie
          </p>
          <p className="text-sm font-black text-accent">{stats.wins}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-muted uppercase tracking-wider">
            Sconfitte
          </p>
          <p className="text-sm font-black text-danger">{stats.losses}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-muted uppercase tracking-wider">
            Farming AXP
          </p>
          <p className="text-sm font-black text-primary">{stats.farmingAxp}</p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-[10px] text-muted">Battaglie farming oggi:</p>
        <p
          className={`text-sm font-black ${
            stats.battlesToday >= stats.dailyLimit
              ? "text-danger"
              : "text-foreground"
          }`}
        >
          {stats.battlesToday}/{stats.dailyLimit}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: FarmingOpponentCard (1v1)                                     */
/* ------------------------------------------------------------------ */

function FarmingCreatureCard({
  opponent,
  disabled,
  onChallenge,
}: {
  opponent: FarmingOpponent;
  disabled: boolean;
  onChallenge: () => void;
}) {
  const vp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(opponent.visualParams as Partial<VisualParams>),
  } as VisualParams;

  return (
    <div className="group flex flex-col rounded-xl border border-border/50 bg-surface/80 p-3 transition-all hover:border-accent/40 hover:bg-surface">
      <div className="flex justify-center mb-2">
        <CreatureRenderer params={vp} size={80} animated={false} seed={42} />
      </div>

      <p className="text-sm font-bold text-foreground truncate text-center leading-tight">
        {opponent.creatureName ?? "???"}
      </p>
      <p className="text-[10px] text-muted truncate text-center mb-2">
        {opponent.userName} · Giorno {opponent.ageDays ?? 0}
      </p>

      {/* Quick stats */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-[9px] text-danger font-mono">
          ATK {opponent.attackPower ?? 0}
        </span>
        <span className="text-[9px] text-primary font-mono">
          DEF {opponent.defense ?? 0}
        </span>
        <span className="text-[9px] text-bio-cyan font-mono">
          SPD {opponent.speed ?? 0}
        </span>
      </div>

      <Button
        variant="accent"
        size="sm"
        fullWidth
        disabled={disabled}
        onClick={onChallenge}
        className="!min-h-[36px] !h-8 uppercase font-black tracking-wider text-[11px]"
      >
        FARM
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: FarmingPlayerCard (2v2/3v3)                                   */
/* ------------------------------------------------------------------ */

function FarmingPlayerCard({
  opponent,
  disabled,
  onChallenge,
}: {
  opponent: FarmingOpponent;
  disabled: boolean;
  onChallenge: () => void;
}) {
  return (
    <div className="group flex flex-col rounded-xl border border-border/50 bg-surface/80 p-3 transition-all hover:border-accent/40 hover:bg-surface">
      {/* Squad preview — mini creature SVGs */}
      <div className="flex items-center justify-center gap-1 mb-2">
        {(opponent.squadPreview ?? []).map((c, i) => {
          const vp = {
            ...DEFAULT_VISUAL_PARAMS,
            ...(c.visualParams as Partial<VisualParams>),
          } as VisualParams;
          return (
            <div key={i} className="flex flex-col items-center">
              <CreatureRenderer
                params={vp}
                size={40}
                animated={false}
                seed={42}
              />
              <p className="text-[8px] text-muted truncate max-w-[50px]">
                {c.name}
              </p>
            </div>
          );
        })}
        {(opponent.squadPreview ?? []).length === 0 && (
          <div className="h-12 flex items-center justify-center">
            <span className="text-[10px] text-muted italic">
              Squadra nascosta
            </span>
          </div>
        )}
      </div>

      <p className="text-sm font-bold text-foreground truncate text-center leading-tight">
        {opponent.userName}
      </p>
      <p className="text-[10px] text-muted text-center mb-3">
        {(opponent.squadPreview ?? []).length} creature in squadra
      </p>

      <Button
        variant="accent"
        size="sm"
        fullWidth
        disabled={disabled}
        onClick={onChallenge}
        className="!min-h-[36px] !h-8 uppercase font-black tracking-wider text-[11px]"
      >
        FARM
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: ConfirmFarmingModal                                           */
/* ------------------------------------------------------------------ */

function ConfirmFarmingModal({
  format,
  opponentName,
  onConfirm,
  onCancel,
  loading,
}: {
  format: FarmingFormat;
  opponentName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/50 bg-surface p-6">
        <h3 className="text-lg font-bold text-foreground mb-2">
          Battaglia Farming {format}
        </h3>
        <p className="text-sm text-muted mb-6">
          Vuoi sfidare{" "}
          <strong className="text-foreground">{opponentName}</strong> in un
          combattimento farming {format}?
          <br />
          <span className="text-[11px] text-accent">
            Nessuna morte. Danni leggeri e recuperabili.
          </span>
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={onCancel}
            disabled={loading}
          >
            ANNULLA
          </Button>
          <Button
            variant="accent"
            size="sm"
            fullWidth
            onClick={onConfirm}
            loading={loading}
          >
            Combatti!
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main: FarmingPage                                                  */
/* ------------------------------------------------------------------ */

export function FarmingPage() {
  const { toast } = useToast();
  const [format, setFormat] = useState<FarmingFormat>("1v1");
  const [opponents, setOpponents] = useState<FarmingOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FarmingStats>({
    wins: 0,
    losses: 0,
    farmingAxp: 0,
    battlesToday: 0,
    dailyLimit: 20,
  });
  const [challengeTarget, setChallengeTarget] =
    useState<FarmingOpponent | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [battleResult, setBattleResult] =
    useState<SquadBattleResultData | null>(null);

  const fetchOpponents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/arena/farming/opponents?format=${format}`
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setOpponents(json.data?.opponents ?? []);
      if (json.data?.stats) {
        setStats(json.data.stats);
      }
    } catch {
      toast("error", "Errore nel caricamento avversari farming.");
    } finally {
      setLoading(false);
    }
  }, [format, toast]);

  useEffect(() => {
    fetchOpponents();
  }, [fetchOpponents]);

  const executeChallenge = useCallback(async () => {
    if (!challengeTarget) return;
    setChallenging(true);
    try {
      const res = await fetch("/api/arena/farming/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opponentUserId: challengeTarget.userId,
          format,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(
          "error",
          json.error?.message ?? "Errore nella sfida farming."
        );
        setChallengeTarget(null);
        return;
      }

      // For 1v1, show a simple result; for 2v2/3v3 show squad battle result
      if (format === "1v1" && json.data) {
        // Map 1v1 result to squad format with single duel
        const singleDuel: SquadBattleResultData = {
          overallResult: json.data.result,
          myScore: json.data.result === "victory" ? 1 : 0,
          opponentScore: json.data.result === "defeat" ? 1 : 0,
          duels: json.data.duels ?? [
            {
              myCreature: json.data.myCreature ?? {
                name: "Tu",
                visualParams: {},
                hpPercent: json.data.challengerHpPercent ?? 100,
              },
              opponentCreature: json.data.opponentCreature ?? {
                name: challengeTarget.creatureName ?? challengeTarget.userName,
                visualParams: challengeTarget.visualParams ?? {},
                hpPercent: json.data.defenderHpPercent ?? 0,
              },
              result:
                json.data.result === "victory"
                  ? "win"
                  : json.data.result === "defeat"
                  ? "loss"
                  : "draw",
            },
          ],
          rewards: json.data.rewards,
        };
        setBattleResult(singleDuel);
      } else if (json.data) {
        setBattleResult(json.data);
      }

      setChallengeTarget(null);

      // Update stats
      setStats((prev) => ({
        ...prev,
        battlesToday: prev.battlesToday + 1,
      }));
    } catch {
      toast("error", "Errore di rete durante la sfida farming.");
    } finally {
      setChallenging(false);
    }
  }, [challengeTarget, format, toast]);

  const isAtLimit = stats.battlesToday >= stats.dailyLimit;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-base font-black text-foreground tracking-tight">
          Battaglie di Farming
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Combattimenti leggeri per guadagnare risorse. Nessuna morte.
        </p>
      </div>

      {/* Stats bar */}
      <FarmingStatsBar stats={stats} />

      {/* Format selector */}
      <div className="flex items-center justify-between mb-4">
        <FormatSelector format={format} onFormatChange={setFormat} />
        <span className="text-[10px] text-muted">
          Formato: <strong className="text-foreground">{format}</strong>
        </span>
      </div>

      {/* Opponents grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-border/30 bg-surface-2 animate-pulse"
            />
          ))}
        </div>
      ) : opponents.length === 0 ? (
        <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
          <p className="text-sm text-muted">
            Nessun avversario disponibile per il formato {format}.
          </p>
          <p className="text-[10px] text-muted mt-1">
            {format !== "1v1"
              ? "Per 2v2 e 3v3 servono giocatori con una squadra attiva."
              : "Torna piu tardi o prova un formato diverso."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {opponents.map((opp, i) =>
            format === "1v1" ? (
              <FarmingCreatureCard
                key={opp.creatureId ?? i}
                opponent={opp}
                disabled={isAtLimit}
                onChallenge={() => setChallengeTarget(opp)}
              />
            ) : (
              <FarmingPlayerCard
                key={opp.userId}
                opponent={opp}
                disabled={isAtLimit}
                onChallenge={() => setChallengeTarget(opp)}
              />
            )
          )}
        </div>
      )}

      {/* At limit warning */}
      {isAtLimit && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center">
          <p className="text-xs text-warning font-bold">
            Hai raggiunto il limite giornaliero di battaglie farming!
          </p>
          <p className="text-[10px] text-warning/70 mt-0.5">
            Torna domani per nuove battaglie.
          </p>
        </div>
      )}

      {/* Confirm modal */}
      {challengeTarget && (
        <ConfirmFarmingModal
          format={format}
          opponentName={
            challengeTarget.creatureName ?? challengeTarget.userName
          }
          onConfirm={executeChallenge}
          onCancel={() => setChallengeTarget(null)}
          loading={challenging}
        />
      )}

      {/* Squad battle result */}
      {battleResult && (
        <SquadBattleResult
          data={battleResult}
          onClose={() => {
            setBattleResult(null);
            fetchOpponents();
          }}
        />
      )}
    </div>
  );
}
