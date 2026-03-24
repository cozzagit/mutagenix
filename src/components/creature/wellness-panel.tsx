'use client';

/* ------------------------------------------------------------------ */
/* Wellness Panel — shows Activity, Hunger, Boredom, Fatigue bars     */
/* ------------------------------------------------------------------ */

interface WellnessData {
  activity: number;
  hunger: number;
  boredom: number;
  fatigue: number;
  composite: number;
}

interface WellnessPanelProps {
  wellness: WellnessData;
  compact?: boolean;
}

const INDICATORS = [
  { key: 'activity' as const, label: 'Attivit\u00E0', icon: '⚡', desc: 'Frequenza iniezioni' },
  { key: 'hunger' as const, label: 'Nutrimento', icon: '🧪', desc: 'Tempo dall\u2019ultima iniezione' },
  { key: 'boredom' as const, label: 'Stimolo', icon: '⚔️', desc: 'Tempo dall\u2019ultima battaglia' },
  { key: 'fatigue' as const, label: 'Energia', icon: '💤', desc: 'Battaglie sostenute oggi' },
];

function getBarColor(value: number): string {
  if (value >= 70) return '#00e5a0';
  if (value >= 40) return '#ff9100';
  return '#ff3d3d';
}

function getBarGlow(value: number): string {
  if (value >= 70) return '#00e5a044';
  if (value >= 40) return '#ff910044';
  return '#ff3d3d44';
}

export function WellnessPanel({ wellness, compact }: WellnessPanelProps) {
  if (compact) {
    return <WellnessCompact wellness={wellness} />;
  }

  return (
    <div className="rounded-xl border border-border/30 bg-surface/40 p-3 backdrop-blur-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Stato Vitale
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{
            color: getBarColor(wellness.composite),
            backgroundColor: `${getBarColor(wellness.composite)}15`,
          }}
        >
          {wellness.composite}%
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {INDICATORS.map((ind) => {
          const value = wellness[ind.key];
          const color = getBarColor(value);
          return (
            <div key={ind.key} className="flex items-center gap-2">
              <span className="w-[18px] text-center text-[11px]">{ind.icon}</span>
              <div className="flex-1">
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted">{ind.label}</span>
                  <span className="text-[9px] font-bold" style={{ color }}>{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${value}%`,
                      backgroundColor: color,
                      boxShadow: `0 0 6px ${getBarGlow(value)}`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact version: single row of colored dots for biosfera cards */
function WellnessCompact({ wellness }: { wellness: WellnessData }) {
  return (
    <div className="flex items-center gap-1.5" title={`Stato Vitale: ${wellness.composite}%`}>
      {INDICATORS.map((ind) => {
        const value = wellness[ind.key];
        const color = getBarColor(value);
        return (
          <span
            key={ind.key}
            className="h-2 w-2 rounded-full"
            title={`${ind.label}: ${value}%`}
            style={{
              backgroundColor: color,
              boxShadow: `0 0 4px ${getBarGlow(value)}`,
            }}
          />
        );
      })}
      <span className="text-[9px] font-bold text-muted">{wellness.composite}%</span>
    </div>
  );
}
