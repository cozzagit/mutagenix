"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { Button } from "@/components/ui/button";
import type { RoundEvent } from "@/types/battle";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface BattleSuspenseProps {
  challengerName: string;
  defenderName: string;
  challengerVisualParams: Record<string, unknown>;
  defenderVisualParams: Record<string, unknown>;
  challengerCreatureId: string;
  events: RoundEvent[];
  totalRounds: number;
  result: "victory" | "defeat" | "draw";
  eloDelta: number;
  battleId: string;
  onComplete: () => void;
}

interface HighlightRound {
  roundNumber: number;
  events: RoundEvent[];
  challengerHpAfter: number;
  defenderHpAfter: number;
}

/* ------------------------------------------------------------------ */
/* Helpers: select dramatic rounds                                    */
/* ------------------------------------------------------------------ */

function selectHighlightRounds(
  events: RoundEvent[],
  totalRounds: number,
  challengerCreatureId: string,
): HighlightRound[] {
  // Group events by round
  const byRound = new Map<number, RoundEvent[]>();
  for (const ev of events) {
    const arr = byRound.get(ev.round) ?? [];
    arr.push(ev);
    byRound.set(ev.round, arr);
  }

  // Track HP through rounds to find threshold crossings
  const roundNumbers = Array.from(byRound.keys()).sort((a, b) => a - b);
  const roundScores = new Map<number, number>();
  let prevChallengerHp = 100;
  let prevDefenderHp = 100;

  for (const r of roundNumbers) {
    const roundEvents = byRound.get(r)!;
    let score = 0;
    let challengerHp = prevChallengerHp;
    let defenderHp = prevDefenderHp;

    for (const ev of roundEvents) {
      // Update HP tracking
      if (ev.attackerId === challengerCreatureId) {
        challengerHp = ev.attackerHpAfter;
        defenderHp = ev.defenderHpAfter;
      } else {
        challengerHp = ev.defenderHpAfter;
        defenderHp = ev.attackerHpAfter;
      }

      // Score dramatic events
      if (ev.type === "special") score += 5;
      if (ev.type === "dodge") score += 3;
      if (ev.isCritical) score += 4;
      if (ev.damage > 0) score += ev.damage / 10;
      if (ev.type === "poison_tick") score += 2;
      if (ev.type === "trauma_reflect") score += 3;
    }

    // HP threshold crossings are dramatic
    if (
      (prevChallengerHp > 50 && challengerHp <= 50) ||
      (prevDefenderHp > 50 && defenderHp <= 50)
    ) {
      score += 6;
    }
    if (
      (prevChallengerHp > 25 && challengerHp <= 25) ||
      (prevDefenderHp > 25 && defenderHp <= 25)
    ) {
      score += 8;
    }

    roundScores.set(r, score);
    prevChallengerHp = challengerHp;
    prevDefenderHp = defenderHp;
  }

  // Always include first and last round
  const selected = new Set<number>();
  if (roundNumbers.length > 0) selected.add(roundNumbers[0]);
  if (roundNumbers.length > 1) selected.add(roundNumbers[roundNumbers.length - 1]);

  // Sort remaining by score, pick top ones (cap at 6 total)
  const remaining = roundNumbers
    .filter((r) => !selected.has(r))
    .sort((a, b) => (roundScores.get(b) ?? 0) - (roundScores.get(a) ?? 0));

  for (const r of remaining) {
    if (selected.size >= 6) break;
    selected.add(r);
  }

  // Build highlight rounds in order
  const sortedSelected = Array.from(selected).sort((a, b) => a - b);

  // Re-compute HP at each selected round
  const highlights: HighlightRound[] = [];
  let cHp = 100;
  let dHp = 100;

  for (const r of roundNumbers) {
    const roundEvents = byRound.get(r)!;
    for (const ev of roundEvents) {
      if (ev.attackerId === challengerCreatureId) {
        cHp = ev.attackerHpAfter;
        dHp = ev.defenderHpAfter;
      } else {
        cHp = ev.defenderHpAfter;
        dHp = ev.attackerHpAfter;
      }
    }
    if (sortedSelected.includes(r)) {
      // Pick up to 2 most interesting events from the round
      const ranked = [...roundEvents].sort((a, b) => {
        const scoreA =
          (a.type === "special" ? 10 : 0) +
          (a.type === "dodge" ? 8 : 0) +
          (a.isCritical ? 7 : 0) +
          a.damage;
        const scoreB =
          (b.type === "special" ? 10 : 0) +
          (b.type === "dodge" ? 8 : 0) +
          (b.isCritical ? 7 : 0) +
          b.damage;
        return scoreB - scoreA;
      });
      highlights.push({
        roundNumber: r,
        events: ranked.slice(0, 2),
        challengerHpAfter: cHp,
        defenderHpAfter: dHp,
      });
    }
  }

  return highlights;
}

/* ------------------------------------------------------------------ */
/* Animation phases                                                   */
/* ------------------------------------------------------------------ */

type Phase =
  | "entrance"
  | "hp-appear"
  | "round-play"
  | "tension"
  | "result-reveal"
  | "stats"
  | "buttons";

/* ------------------------------------------------------------------ */
/* HpBar (local, with smooth transition)                              */
/* ------------------------------------------------------------------ */

function HpBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color =
    clamped > 50 ? "bg-accent" : clamped > 25 ? "bg-warning" : "bg-danger";
  return (
    <div className="h-3 w-full rounded-full bg-surface-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BattleSuspense Component                                           */
/* ------------------------------------------------------------------ */

export function BattleSuspense({
  challengerName,
  defenderName,
  challengerVisualParams,
  defenderVisualParams,
  challengerCreatureId,
  events,
  totalRounds,
  result,
  eloDelta,
  battleId,
  onComplete,
}: BattleSuspenseProps) {
  const router = useRouter();

  const highlights = useMemo(
    () => selectHighlightRounds(events, totalRounds, challengerCreatureId),
    [events, totalRounds, challengerCreatureId],
  );

  const [phase, setPhase] = useState<Phase>("entrance");
  const [currentHighlightIndex, setCurrentHighlightIndex] = useState(-1);
  const [challengerHp, setChallengerHp] = useState(100);
  const [defenderHp, setDefenderHp] = useState(100);
  const [activeEvents, setActiveEvents] = useState<RoundEvent[]>([]);
  const [flashType, setFlashType] = useState<string | null>(null);
  const [flashSide, setFlashSide] = useState<"challenger" | "defender" | null>(null);
  const [skipped, setSkipped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const challengerVp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(challengerVisualParams as Partial<VisualParams>),
  } as VisualParams;
  const defenderVp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(defenderVisualParams as Partial<VisualParams>),
  } as VisualParams;

  // Skip handler: tap anywhere during animation to jump to result
  const handleSkip = useCallback(() => {
    if (phase === "buttons") return;
    clearTimeout(timerRef.current);
    setSkipped(true);
    // Set final HP from last highlight
    if (highlights.length > 0) {
      const last = highlights[highlights.length - 1];
      setChallengerHp(last.challengerHpAfter);
      setDefenderHp(last.defenderHpAfter);
    }
    setActiveEvents([]);
    setFlashType(null);
    setFlashSide(null);
    setPhase("result-reveal");
  }, [phase, highlights]);

  // Auto-advance animation phases
  useEffect(() => {
    if (skipped && phase !== "result-reveal" && phase !== "stats" && phase !== "buttons") return;

    const schedule = (fn: () => void, ms: number) => {
      timerRef.current = setTimeout(fn, ms);
    };

    switch (phase) {
      case "entrance":
        schedule(() => setPhase("hp-appear"), 500);
        break;

      case "hp-appear":
        schedule(() => {
          setCurrentHighlightIndex(0);
          setPhase("round-play");
        }, 500);
        break;

      case "round-play": {
        // This is handled by the highlight index effect
        break;
      }

      case "tension":
        schedule(() => setPhase("result-reveal"), 1000);
        break;

      case "result-reveal":
        schedule(() => setPhase("stats"), 1000);
        break;

      case "stats":
        schedule(() => setPhase("buttons"), 500);
        break;

      case "buttons":
        break;
    }

    return () => clearTimeout(timerRef.current);
  }, [phase, skipped]);

  // Advance through highlight rounds
  useEffect(() => {
    if (phase !== "round-play" || currentHighlightIndex < 0) return;

    if (currentHighlightIndex >= highlights.length) {
      // All highlights played — schedule transition to tension pause
      const doneTimer = setTimeout(() => {
        setActiveEvents([]);
        setPhase("tension");
      }, 0);
      return () => clearTimeout(doneTimer);
    }

    const hl = highlights[currentHighlightIndex];

    // Schedule state updates for this round's events
    const initTimer = setTimeout(() => {
      setActiveEvents(hl.events);
      setChallengerHp(hl.challengerHpAfter);
      setDefenderHp(hl.defenderHpAfter);

      // Determine flash effect from the main event
      if (hl.events.length > 0) {
        const mainEvent = hl.events[0];
        const isAttackerChallenger = mainEvent.attackerId === challengerCreatureId;

        if (mainEvent.type === "dodge") {
          setFlashType("dodge");
          setFlashSide(isAttackerChallenger ? "defender" : "challenger");
        } else if (mainEvent.type === "special") {
          setFlashType("special");
          setFlashSide(isAttackerChallenger ? "defender" : "challenger");
        } else if (mainEvent.type === "poison_tick") {
          setFlashType("poison");
          setFlashSide(isAttackerChallenger ? "defender" : "challenger");
        } else if (mainEvent.isCritical) {
          setFlashType("critical");
          setFlashSide(isAttackerChallenger ? "defender" : "challenger");
        } else if (mainEvent.damage > 0) {
          setFlashType("hit");
          setFlashSide(isAttackerChallenger ? "defender" : "challenger");
        }
      }
    }, 0);

    // Clear flash after a bit, then advance
    const flashTimer = setTimeout(() => {
      setFlashType(null);
      setFlashSide(null);
    }, 500);

    const advanceTimer = setTimeout(() => {
      setCurrentHighlightIndex((i) => i + 1);
    }, 800);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(flashTimer);
      clearTimeout(advanceTimer);
    };
  }, [phase, currentHighlightIndex, highlights, challengerCreatureId]);

  // Result labels
  const resultLabel =
    result === "victory"
      ? "VITTORIA!"
      : result === "draw"
        ? "PAREGGIO"
        : "SCONFITTA";
  const resultColor =
    result === "victory"
      ? "text-accent"
      : result === "draw"
        ? "text-warning"
        : "text-danger";
  const resultGlow =
    result === "victory"
      ? "glow-green"
      : result === "draw"
        ? "glow-orange"
        : "glow-red";

  // Progress bar
  const progressPercent =
    highlights.length > 0
      ? Math.min(
          100,
          ((currentHighlightIndex < 0 ? 0 : currentHighlightIndex) /
            highlights.length) *
            100,
        )
      : 0;

  const showHp = phase !== "entrance";
  const showRoundInfo =
    phase === "round-play" || phase === "tension";
  const showResultReveal =
    phase === "result-reveal" ||
    phase === "stats" ||
    phase === "buttons";
  const showStats = phase === "stats" || phase === "buttons";
  const showButtons = phase === "buttons";

  // Current highlight round for display
  const currentHighlight =
    currentHighlightIndex >= 0 && currentHighlightIndex < highlights.length
      ? highlights[currentHighlightIndex]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-4"
      onClick={
        phase !== "buttons" && phase !== "result-reveal" && phase !== "stats"
          ? handleSkip
          : undefined
      }
    >
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        {/* Creatures facing each other */}
        <div
          className={`flex items-center justify-center gap-2 md:gap-4 mb-4 transition-all duration-500 ${
            phase === "entrance"
              ? "opacity-0 scale-90"
              : "opacity-100 scale-100"
          }`}
        >
          {/* Challenger */}
          <div className="text-center flex-1">
            <div
              className={`relative inline-block transition-transform duration-500 ${
                phase === "entrance"
                  ? "-translate-x-16 opacity-0"
                  : "translate-x-0 opacity-100"
              } ${
                flashType && flashSide === "challenger"
                  ? "animate-[shake_0.3s_ease-in-out]"
                  : ""
              }`}
            >
              <CreatureRenderer
                params={challengerVp}
                size={100}
                animated
              />
              {/* Flash overlay on challenger */}
              {flashType && flashSide === "challenger" && (
                <div className="absolute inset-0 rounded-xl pointer-events-none">
                  {flashType === "hit" && (
                    <div className="absolute inset-0 bg-danger/30 rounded-xl animate-pulse" />
                  )}
                  {flashType === "critical" && (
                    <div className="absolute inset-0 bg-danger/50 rounded-xl animate-pulse" />
                  )}
                  {flashType === "dodge" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-black text-bio-cyan glow-cyan animate-bounce">
                        SCHIVATA!
                      </span>
                    </div>
                  )}
                  {flashType === "special" && (
                    <div className="absolute inset-0 bg-bio-purple/30 rounded-xl animate-pulse" />
                  )}
                  {flashType === "poison" && (
                    <div className="absolute inset-0 bg-bio-green/20 rounded-xl animate-pulse" />
                  )}
                </div>
              )}
            </div>
            <p className="text-[10px] md:text-xs text-muted mt-1 truncate max-w-[100px] md:max-w-[120px] mx-auto">
              {challengerName}
            </p>
          </div>

          {/* VS */}
          <div className="shrink-0 px-2">
            <span className="text-lg md:text-xl font-black text-muted">
              VS
            </span>
          </div>

          {/* Defender */}
          <div className="text-center flex-1">
            <div
              className={`relative inline-block transition-transform duration-500 ${
                phase === "entrance"
                  ? "translate-x-16 opacity-0"
                  : "translate-x-0 opacity-100"
              } ${
                flashType && flashSide === "defender"
                  ? "animate-[shake_0.3s_ease-in-out]"
                  : ""
              }`}
              style={{ transform: phase !== "entrance" ? "scaleX(-1)" : "scaleX(-1) translateX(-4rem)" }}
            >
              <CreatureRenderer
                params={defenderVp}
                size={100}
                animated
              />
              {/* Flash overlay on defender */}
              {flashType && flashSide === "defender" && (
                <div className="absolute inset-0 rounded-xl pointer-events-none">
                  {flashType === "hit" && (
                    <div className="absolute inset-0 bg-danger/30 rounded-xl animate-pulse" />
                  )}
                  {flashType === "critical" && (
                    <div className="absolute inset-0 bg-danger/50 rounded-xl animate-pulse" />
                  )}
                  {flashType === "dodge" && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ transform: "scaleX(-1)" }}>
                      <span className="text-xs font-black text-bio-cyan glow-cyan animate-bounce">
                        SCHIVATA!
                      </span>
                    </div>
                  )}
                  {flashType === "special" && (
                    <div className="absolute inset-0 bg-bio-purple/30 rounded-xl animate-pulse" />
                  )}
                  {flashType === "poison" && (
                    <div className="absolute inset-0 bg-bio-green/20 rounded-xl animate-pulse" />
                  )}
                </div>
              )}
            </div>
            <p className="text-[10px] md:text-xs text-muted mt-1 truncate max-w-[100px] md:max-w-[120px] mx-auto">
              {defenderName}
            </p>
          </div>
        </div>

        {/* HP Bars */}
        <div
          className={`grid grid-cols-2 gap-4 mb-4 transition-all duration-500 ${
            showHp ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
              <span>HP</span>
              <span className="font-mono">{Math.round(challengerHp)}%</span>
            </div>
            <HpBar percent={challengerHp} />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
              <span>HP</span>
              <span className="font-mono">{Math.round(defenderHp)}%</span>
            </div>
            <HpBar percent={defenderHp} />
          </div>
        </div>

        {/* Round event display */}
        {showRoundInfo && (
          <div className="mb-4">
            {/* Event text box */}
            <div className="rounded-xl border border-border/30 bg-surface-2 p-3 min-h-[60px]">
              {currentHighlight ? (
                <>
                  <span className="text-[10px] text-muted uppercase tracking-wider font-bold">
                    Round {currentHighlight.roundNumber} / {totalRounds}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {activeEvents.map((ev, i) => {
                      let color = "text-foreground";
                      if (ev.type === "dodge") color = "text-bio-cyan";
                      else if (ev.type === "special") color = "text-bio-purple";
                      else if (ev.type === "poison_tick") color = "text-bio-green";
                      else if (ev.type === "regen") color = "text-accent";
                      else if (ev.isCritical) color = "text-danger";

                      return (
                        <p
                          key={`${ev.round}-${i}`}
                          className={`text-xs font-mono ${color} animate-[fadeInUp_0.3s_ease-out]`}
                        >
                          {ev.description}
                        </p>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted italic">Preparazione...</p>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-danger transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tension pause overlay */}
        {phase === "tension" && (
          <div className="text-center py-4">
            <div className="inline-flex gap-1">
              <span className="w-2 h-2 rounded-full bg-danger animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-danger animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-danger animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Result reveal */}
        {showResultReveal && (
          <div className="text-center py-4">
            <h2
              className={`text-4xl md:text-5xl font-black ${resultColor} ${resultGlow} animate-[scaleIn_0.5s_ease-out]`}
            >
              {resultLabel}
            </h2>
          </div>
        )}

        {/* Stats */}
        {showStats && (
          <div className="text-center mb-4 animate-[fadeInUp_0.3s_ease-out]">
            <p
              className={`text-xl font-bold ${
                eloDelta >= 0 ? "text-accent" : "text-danger"
              }`}
            >
              {eloDelta >= 0 ? "+" : ""}
              {eloDelta} ELO
            </p>
          </div>
        )}

        {/* Action buttons */}
        {showButtons && (
          <div className="flex gap-3 animate-[fadeInUp_0.3s_ease-out]">
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={onComplete}
            >
              CHIUDI
            </Button>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              onClick={() => router.push(`/arena/battle/${battleId}`)}
            >
              GUARDA REPLAY
            </Button>
          </div>
        )}

        {/* Skip hint */}
        {phase !== "buttons" &&
          phase !== "result-reveal" &&
          phase !== "stats" && (
            <p className="text-center text-[10px] text-muted/50 mt-4">
              Tocca per saltare
            </p>
          )}
      </div>

      {/* Custom keyframe animations injected via style tag */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeInUp {
          0% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
