"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { Button } from "@/components/ui/button";
import type { RoundEvent } from "@/types/battle";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface BattleSide {
  creatureId: string;
  name: string;
  visualParams: Record<string, unknown>;
  eloBefore: number;
  eloAfter: number;
  eloDelta: number;
  finalHpPercent: number | null;
}

export interface BattleReplayData {
  id: string;
  battleType: string;
  result: "victory" | "defeat" | "draw";
  winnerId: string | null;
  roundsPlayed: number;
  challenger: BattleSide;
  defender: BattleSide;
  events: RoundEvent[];
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* HP Bar                                                             */
/* ------------------------------------------------------------------ */

function HpBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
        <span>{label}</span>
        <span className="font-mono">{Math.round(clamped)}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Event flash overlays                                               */
/* ------------------------------------------------------------------ */

function FlashOverlay({ type, visible, damage }: { type: string; visible: boolean; damage?: number }) {
  if (!visible) return null;

  // Intensity based on damage (0-100 scale, clamped)
  const intensity = Math.min(1, Math.max(0.2, (damage ?? 5) / 20));
  let content: React.ReactNode = null;
  let boxShadow = '';
  let bg = '';

  switch (type) {
    case "attack_hit": {
      bg = `rgba(255, 68, 102, ${0.1 + intensity * 0.25})`;
      boxShadow = `inset 0 0 ${20 + intensity * 40}px rgba(255, 68, 102, ${intensity * 0.6}), 0 0 ${10 + intensity * 30}px rgba(255, 68, 102, ${intensity * 0.4})`;
      if (damage && damage > 8) {
        content = (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black text-danger" style={{ textShadow: `0 0 ${intensity * 20}px rgba(255,68,102,0.8)` }}>
              -{Math.round(damage)}
            </span>
          </div>
        );
      }
      break;
    }
    case "dodge":
      boxShadow = '0 0 20px rgba(0, 229, 230, 0.3)';
      content = (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-bio-cyan animate-bounce" style={{ textShadow: '0 0 12px rgba(0,229,230,0.8)' }}>SCHIVATA!</span>
        </div>
      );
      break;
    case "special":
      bg = `rgba(168, 85, 247, ${0.15 + intensity * 0.2})`;
      boxShadow = `inset 0 0 ${30 + intensity * 40}px rgba(168, 85, 247, ${intensity * 0.5}), 0 0 ${20 + intensity * 30}px rgba(168, 85, 247, ${intensity * 0.4})`;
      content = (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-bio-purple animate-pulse" style={{ textShadow: '0 0 16px rgba(168,85,247,0.9)' }}>SPECIALE!</span>
        </div>
      );
      break;
    case "poison":
      bg = 'rgba(0, 200, 83, 0.1)';
      boxShadow = '0 0 15px rgba(0, 200, 83, 0.25)';
      break;
    case "regen":
      bg = 'rgba(0, 229, 160, 0.1)';
      boxShadow = '0 0 15px rgba(0, 229, 160, 0.3)';
      content = (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-accent" style={{ textShadow: '0 0 10px rgba(0,229,160,0.8)' }}>+REGEN</span>
        </div>
      );
      break;
    case "critical":
      bg = `rgba(255, 68, 102, ${0.2 + intensity * 0.3})`;
      boxShadow = `inset 0 0 ${40 + intensity * 50}px rgba(255, 68, 102, ${0.4 + intensity * 0.4}), 0 0 ${30 + intensity * 40}px rgba(255, 68, 102, ${0.3 + intensity * 0.4})`;
      content = (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black text-danger animate-pulse" style={{ textShadow: '0 0 20px rgba(255,68,102,1)' }}>
            CRITICO! -{Math.round(damage ?? 0)}
          </span>
        </div>
      );
      break;
    default:
      return null;
  }

  return (
    <div
      className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-300"
      style={{ backgroundColor: bg, boxShadow }}
    >
      {content}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main BattleReplay                                                  */
/* ------------------------------------------------------------------ */

export function BattleReplay({ battle, tournamentId }: { battle: BattleReplayData; tournamentId?: string | null }) {
  const [currentRound, setCurrentRound] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const [challengerFlash, setChallengerFlash] = useState<{ type: string; damage: number } | null>(null);
  const [defenderFlash, setDefenderFlash] = useState<{ type: string; damage: number } | null>(null);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const logEndRef = useRef<HTMLDivElement>(null);

  const totalRounds = battle.roundsPlayed;

  // Group events by round
  const eventsByRound = new Map<number, RoundEvent[]>();
  for (const ev of battle.events) {
    const roundEvents = eventsByRound.get(ev.round) ?? [];
    roundEvents.push(ev);
    eventsByRound.set(ev.round, roundEvents);
  }

  // Calculate HP at current round
  const getHpAtRound = useCallback((round: number): { challengerHp: number; defenderHp: number } => {
    if (round === 0) return { challengerHp: 100, defenderHp: 100 };

    let challengerHp = 100;
    let defenderHp = 100;

    for (let r = 1; r <= round; r++) {
      const events = eventsByRound.get(r);
      if (!events) continue;
      for (const ev of events) {
        // Use the after values from events
        if (ev.attackerId === battle.challenger.creatureId) {
          challengerHp = ev.attackerHpAfter;
          defenderHp = ev.defenderHpAfter;
        } else {
          challengerHp = ev.defenderHpAfter;
          defenderHp = ev.attackerHpAfter;
        }
      }
    }

    return { challengerHp, defenderHp };
  }, [battle.challenger.creatureId, battle.events, eventsByRound]);

  const { challengerHp, defenderHp } = getHpAtRound(currentRound);

  // Visible events: all events up to current round
  const visibleEvents: RoundEvent[] = [];
  for (let r = 1; r <= currentRound; r++) {
    const events = eventsByRound.get(r);
    if (events) visibleEvents.push(...events);
  }

  // Flash effects for current round
  useEffect(() => {
    if (currentRound === 0) return;
    const roundEvents = eventsByRound.get(currentRound);
    if (!roundEvents) return;

    for (const ev of roundEvents) {
      const isAttackerChallenger = ev.attackerId === battle.challenger.creatureId;
      const dmg = ev.damage ?? 0;

      if (ev.type === "dodge") {
        if (isAttackerChallenger) {
          setDefenderFlash({ type: "dodge", damage: 0 });
        } else {
          setChallengerFlash({ type: "dodge", damage: 0 });
        }
      } else if (ev.type === "special") {
        if (isAttackerChallenger) {
          setDefenderFlash({ type: "special", damage: dmg });
        } else {
          setChallengerFlash({ type: "special", damage: dmg });
        }
      } else if (ev.type === "poison_tick") {
        if (isAttackerChallenger) {
          setDefenderFlash({ type: "poison", damage: dmg });
        } else {
          setChallengerFlash({ type: "poison", damage: dmg });
        }
      } else if (ev.type === "regen") {
        if (isAttackerChallenger) {
          setChallengerFlash({ type: "regen", damage: dmg });
        } else {
          setDefenderFlash({ type: "regen", damage: dmg });
        }
      } else if (ev.isCritical) {
        if (isAttackerChallenger) {
          setDefenderFlash({ type: "critical", damage: dmg });
        } else {
          setChallengerFlash({ type: "critical", damage: dmg });
        }
      } else if (dmg > 0) {
        if (isAttackerChallenger) {
          setDefenderFlash({ type: "attack_hit", damage: dmg });
        } else {
          setChallengerFlash({ type: "attack_hit", damage: dmg });
        }
      }
    }

    const timer = setTimeout(() => {
      setChallengerFlash(null);
      setDefenderFlash(null);
    }, 800);

    return () => clearTimeout(timer);
  }, [currentRound, battle.challenger.creatureId, eventsByRound]);

  // Auto scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleEvents.length]);

  // Auto-play
  useEffect(() => {
    if (!autoPlaying) {
      clearTimeout(autoPlayRef.current);
      return;
    }

    if (currentRound >= totalRounds) {
      setAutoPlaying(false);
      setShowResult(true);
      return;
    }

    const delay = speed === 0 ? 0 : (2500 / speed);
    autoPlayRef.current = setTimeout(() => {
      setCurrentRound((r) => r + 1);
    }, delay);

    return () => clearTimeout(autoPlayRef.current);
  }, [autoPlaying, currentRound, totalRounds, speed]);

  // Show result when reaching last round manually
  useEffect(() => {
    if (currentRound >= totalRounds && totalRounds > 0) {
      const timer = setTimeout(() => setShowResult(true), 1000);
      return () => clearTimeout(timer);
    }
    setShowResult(false);
  }, [currentRound, totalRounds]);

  const goFirst = () => { setCurrentRound(0); setAutoPlaying(false); };
  const goPrev = () => { setCurrentRound((r) => Math.max(0, r - 1)); setAutoPlaying(false); };
  const goNext = () => { setCurrentRound((r) => Math.min(totalRounds, r + 1)); setAutoPlaying(false); };
  const goLast = () => { setCurrentRound(totalRounds); setAutoPlaying(false); };
  const toggleAutoPlay = () => setAutoPlaying((p) => !p);
  const skipToEnd = () => { setCurrentRound(totalRounds); setAutoPlaying(false); setShowResult(true); };

  const challengerVp = { ...DEFAULT_VISUAL_PARAMS, ...(battle.challenger.visualParams as Partial<VisualParams>) } as VisualParams;
  const defenderVp = { ...DEFAULT_VISUAL_PARAMS, ...(battle.defender.visualParams as Partial<VisualParams>) } as VisualParams;

  const isVictory = battle.result === "victory";
  const isDraw = battle.result === "draw";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Back button */}
      <a
        href={tournamentId ? `/arena?tournament=${tournamentId}` : "/arena"}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors mb-4"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        {tournamentId ? 'Torna al Torneo' : 'Torna all\u0027Arena'}
      </a>

      {/* Battle arena */}
      <div className="rounded-2xl border border-border/50 bg-surface/80 p-4 md:p-6">
        {/* Fighters */}
        <div className="flex items-center justify-between mb-4">
          {/* Challenger */}
          <div className="flex-1 text-center relative">
            <div className="relative inline-block">
              <CreatureRenderer params={challengerVp} size={160} animated />
              <FlashOverlay type={challengerFlash?.type ?? ""} visible={!!challengerFlash} damage={challengerFlash?.damage} />
            </div>
            <p className="text-sm font-bold text-foreground mt-1 truncate">{battle.challenger.name}</p>
            <p className="text-[10px] text-muted">Sfidante</p>
          </div>

          {/* VS */}
          <div className="px-4 shrink-0">
            <span className="text-xl font-black text-muted">VS</span>
          </div>

          {/* Defender */}
          <div className="flex-1 text-center relative">
            <div className="relative inline-block" style={{ transform: "scaleX(-1)" }}>
              <CreatureRenderer params={defenderVp} size={160} animated />
              <FlashOverlay type={defenderFlash?.type ?? ""} visible={!!defenderFlash} damage={defenderFlash?.damage} />
            </div>
            <p className="text-sm font-bold text-foreground mt-1 truncate">{battle.defender.name}</p>
            <p className="text-[10px] text-muted">Difensore</p>
          </div>
        </div>

        {/* HP/Stamina bars */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <HpBar label="HP" percent={challengerHp} color={challengerHp > 50 ? "bg-accent" : challengerHp > 25 ? "bg-warning" : "bg-danger"} />
          <HpBar label="HP" percent={defenderHp} color={defenderHp > 50 ? "bg-accent" : defenderHp > 25 ? "bg-warning" : "bg-danger"} />
        </div>

        {/* Event log */}
        <div className="rounded-xl border border-border/30 bg-surface-2 p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted uppercase tracking-wider font-bold">
              Round {currentRound}/{totalRounds}
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-xs">
            {currentRound === 0 ? (
              <p className="text-muted italic">Premi play per iniziare il replay...</p>
            ) : visibleEvents.length === 0 ? (
              <p className="text-muted italic">Nessun evento</p>
            ) : (
              visibleEvents.map((ev, i) => {
                let color = "text-muted";
                let prefix = ">";
                if (ev.type === "dodge") { color = "text-bio-cyan"; prefix = "~"; }
                else if (ev.type === "special") { color = "text-bio-purple"; prefix = "*"; }
                else if (ev.type === "poison_tick") { color = "text-bio-green"; prefix = "!"; }
                else if (ev.type === "regen") { color = "text-accent"; prefix = "+"; }
                else if (ev.isCritical) { color = "text-danger"; prefix = "!!"; }
                else if (ev.damage > 0) { color = "text-foreground"; }

                const isNewRound = i === 0 || visibleEvents[i - 1].round !== ev.round;

                return (
                  <div key={`${ev.round}-${i}`}>
                    {isNewRound && i > 0 && (
                      <div className="border-t border-border/20 my-1 pt-1">
                        <span className="text-[10px] text-muted">Round {ev.round}</span>
                      </div>
                    )}
                    <p className={color}>
                      <span className="text-muted mr-1">{prefix}</span>
                      {ev.description}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={goFirst} disabled={currentRound === 0}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M15.79 14.77a.75.75 0 0 1-1.06.02l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 1 1 1.04 1.08L11.832 10l3.938 3.71a.75.75 0 0 1 .02 1.06Z" />
              <path d="M4.25 5a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-1.5 0v-8.5A.75.75 0 0 1 4.25 5Z" />
            </svg>
          </Button>
          <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentRound === 0}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
          </Button>

          <Button
            variant={autoPlaying ? "danger" : "primary"}
            size="sm"
            onClick={toggleAutoPlay}
          >
            {autoPlaying ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5ZM12.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
              </svg>
            )}
          </Button>

          <span className="text-xs text-muted font-mono px-2">
            {currentRound}/{totalRounds}
          </span>

          <Button variant="ghost" size="sm" onClick={goNext} disabled={currentRound >= totalRounds}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </Button>
          <Button variant="ghost" size="sm" onClick={goLast} disabled={currentRound >= totalRounds}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M4.21 14.77a.75.75 0 0 0 1.06.02l4.5-4.25a.75.75 0 0 0 0-1.08l-4.5-4.25a.75.75 0 1 0-1.04 1.08L8.168 10l-3.938 3.71a.75.75 0 0 0-.02 1.06Z" />
              <path d="M15.75 5a.75.75 0 0 0-.75.75v8.5a.75.75 0 0 0 1.5 0v-8.5a.75.75 0 0 0-.75-.75Z" />
            </svg>
          </Button>

          {/* Speed */}
          <div className="flex items-center gap-1 ml-2 border-l border-border/30 pl-2">
            {[1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  speed === s ? "bg-danger/20 text-danger" : "text-muted hover:text-foreground"
                }`}
              >
                {s}x
              </button>
            ))}
            <button
              onClick={skipToEnd}
              className="px-1.5 py-0.5 text-[10px] font-bold rounded text-muted hover:text-foreground"
            >
              Salta
            </button>
          </div>
        </div>
      </div>

      {/* Result overlay */}
      {showResult && (
        <div className="mt-6 rounded-2xl border border-border/50 bg-surface/80 p-6 text-center">
          <h2
            className={`text-3xl font-black mb-2 ${
              isVictory ? "text-accent glow-green" : isDraw ? "text-warning glow-orange" : "text-danger glow-red"
            }`}
          >
            {isVictory ? "VITTORIA!" : isDraw ? "PAREGGIO" : "SCONFITTA"}
          </h2>

          <div className="flex items-center justify-center gap-8 text-sm mt-4">
            <div>
              <p className="text-foreground font-bold">{battle.challenger.name}</p>
              <p className={`font-mono ${battle.challenger.eloDelta >= 0 ? "text-accent" : "text-danger"}`}>
                {battle.challenger.eloDelta >= 0 ? "+" : ""}{battle.challenger.eloDelta} ELO
              </p>
              <p className="text-[10px] text-muted">{battle.challenger.eloBefore} → {battle.challenger.eloAfter}</p>
            </div>
            <div>
              <p className="text-foreground font-bold">{battle.defender.name}</p>
              <p className={`font-mono ${battle.defender.eloDelta >= 0 ? "text-accent" : "text-danger"}`}>
                {battle.defender.eloDelta >= 0 ? "+" : ""}{battle.defender.eloDelta} ELO
              </p>
              <p className="text-[10px] text-muted">{battle.defender.eloBefore} → {battle.defender.eloAfter}</p>
            </div>
          </div>

          <div className="flex gap-3 justify-center mt-6">
            <Button variant="secondary" size="sm" onClick={() => { goFirst(); setShowResult(false); }}>
              RIVEDI REPLAY
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
