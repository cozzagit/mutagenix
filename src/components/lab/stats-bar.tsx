'use client';

interface StatsBarProps {
  ageDays: number;
  generation: number;
  stability: number;
  /** When true, renders as a single compact line (for left panel / mobile header) */
  compact?: boolean;
  /** Whether the creature is in warrior phase (combatPhase > 0) */
  isWarrior?: boolean;
}

export function StatsBar({ ageDays, generation, stability, compact, isWarrior }: StatsBarProps) {
  const stabilityPercent = Math.round(stability * 100);
  const stabilityLabel =
    stability < 0.3
      ? 'Instabile'
      : stability < 0.7
        ? 'Variabile'
        : 'Stabile';
  const stabilityColor =
    stability < 0.3
      ? '#ff3d3d'
      : stability < 0.7
        ? '#ff9100'
        : '#00e5a0';

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
        <span className="font-medium text-foreground">Gen {generation}</span>
        <span className="text-border">·</span>
        <span className="font-medium text-foreground">
          Giorno {ageDays}
        </span>
        <span className="text-border">·</span>
        <span
          className="font-semibold"
          style={{ color: stabilityColor }}
        >
          {stabilityLabel}
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-2 text-xs text-muted">
        <span className="font-medium text-foreground">Gen {generation}</span>
        <span className="text-border">·</span>
        <span className="font-medium text-foreground">
          Giorno {ageDays}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-surface-3"
        >
          <span
            className="block h-full rounded-full transition-all duration-500"
            style={{
              width: `${stabilityPercent}%`,
              backgroundColor: stabilityColor,
              boxShadow: `0 0 6px ${stabilityColor}66`,
            }}
          />
        </span>
        <span
          className="text-[10px] font-semibold"
          style={{ color: stabilityColor }}
        >
          {stabilityLabel}
        </span>
      </span>
    </div>
  );
}
