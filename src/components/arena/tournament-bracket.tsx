"use client";

import Link from "next/link";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface BracketMatch {
  id: string;
  roundNumber: number;
  participant1Id: string;
  participant2Id: string;
  participant1Name: string;
  participant2Name: string;
  winnerId: string | null;
  winnerName: string | null;
  status: string;
  battleId?: string | null;
}

interface TournamentBracketProps {
  matches: BracketMatch[];
  totalRounds: number;
  currentRound: number;
  myParticipantId: string | null;
}

/* ------------------------------------------------------------------ */
/* Sub: MatchNode                                                     */
/* ------------------------------------------------------------------ */

function MatchNode({
  match,
  myParticipantId,
}: {
  match: BracketMatch;
  myParticipantId: string | null;
}) {
  const isCompleted = match.status === "completed";
  const p1Won = match.winnerId === match.participant1Id;
  const p2Won = match.winnerId === match.participant2Id;
  const isMyMatch =
    myParticipantId === match.participant1Id ||
    myParticipantId === match.participant2Id;

  return (
    <div
      className={`rounded-lg border bg-surface/80 overflow-hidden w-48 ${
        isMyMatch ? "border-danger/50 ring-1 ring-danger/20" : "border-border/30"
      }`}
    >
      {/* Participant 1 */}
      <div
        className={`flex items-center justify-between px-2.5 py-1.5 text-[11px] border-b border-border/20 ${
          isCompleted && p1Won
            ? "bg-accent/10 text-accent font-bold"
            : isCompleted && !p1Won
            ? "text-muted line-through"
            : "text-foreground"
        }`}
      >
        <span className="truncate flex-1">
          {match.participant1Name}
        </span>
        {isCompleted && p1Won && (
          <span className="text-accent ml-1 shrink-0">&#10003;</span>
        )}
      </div>

      {/* Participant 2 */}
      <div
        className={`flex items-center justify-between px-2.5 py-1.5 text-[11px] ${
          isCompleted && p2Won
            ? "bg-accent/10 text-accent font-bold"
            : isCompleted && !p2Won
            ? "text-muted line-through"
            : "text-foreground"
        }`}
      >
        <span className="truncate flex-1">
          {match.participant2Name}
        </span>
        {isCompleted && p2Won && (
          <span className="text-accent ml-1 shrink-0">&#10003;</span>
        )}
      </div>

      {/* Replay link */}
      {isCompleted && match.battleId && (
        <Link
          href={`/arena/battle/${match.battleId}`}
          className="flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-bold text-primary hover:text-foreground bg-primary/5 hover:bg-primary/10 border-t border-border/20 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
            <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
          </svg>
          REPLAY
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main: TournamentBracket                                            */
/* ------------------------------------------------------------------ */

export function TournamentBracket({
  matches,
  totalRounds,
  currentRound,
  myParticipantId,
}: TournamentBracketProps) {
  // Group matches by round
  const rounds: Record<number, BracketMatch[]> = {};
  for (const match of matches) {
    if (!rounds[match.roundNumber]) {
      rounds[match.roundNumber] = [];
    }
    rounds[match.roundNumber].push(match);
  }

  const roundNumbers = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);

  if (roundNumbers.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-surface-2 p-6 text-center">
        <p className="text-sm text-muted">Il tabellone non è ancora disponibile.</p>
      </div>
    );
  }

  const roundLabels: Record<number, string> = {};
  for (const rn of roundNumbers) {
    if (rn === totalRounds) {
      roundLabels[rn] = "FINALE";
    } else if (rn === totalRounds - 1 && totalRounds > 2) {
      roundLabels[rn] = "SEMIFINALE";
    } else if (rn === totalRounds - 2 && totalRounds > 3) {
      roundLabels[rn] = "QUARTI";
    } else {
      roundLabels[rn] = `ROUND ${rn}`;
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {roundNumbers.map((rn) => {
          const roundMatches = rounds[rn];
          const isCurrent = rn === currentRound;

          return (
            <div key={rn} className="flex flex-col">
              {/* Round header */}
              <div
                className={`text-center mb-3 pb-1 border-b ${
                  isCurrent
                    ? "border-danger/40 text-danger"
                    : "border-border/20 text-muted"
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {roundLabels[rn]}
                </span>
              </div>

              {/* Matches in this round */}
              <div className="flex flex-col gap-4 justify-around flex-1">
                {roundMatches.map((match) => (
                  <MatchNode
                    key={match.id}
                    match={match}
                    myParticipantId={myParticipantId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
