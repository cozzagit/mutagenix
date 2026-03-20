'use client';

import { useEffect, useRef } from 'react';
import { CreatureRenderer } from '@/components/creature/creature-renderer';
import { DEFAULT_VISUAL_PARAMS } from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';

interface TimelineSnapshot {
  day: string;
  visualParams: Record<string, unknown>;
  stabilityScore: number;
  elementLevels: Record<string, number>;
}

interface Props {
  snapshots: TimelineSnapshot[];
  currentCreature: {
    ageDays: number;
    visualParams: Record<string, unknown>;
    stability: number;
  };
}

function stabilityColor(score: number): string {
  if (score >= 0.7) return '#39ff7f';
  if (score >= 0.4) return '#ff9100';
  return '#ff3d3d';
}

function stabilityLabel(score: number): string {
  if (score >= 0.7) return 'Stabile';
  if (score >= 0.4) return 'Instabile';
  return 'Critico';
}

function extractBodyHue(params: Record<string, unknown>): number {
  const hue = params.bodyHue;
  return typeof hue === 'number' ? hue : 210;
}

function DayCard({
  dayLabel,
  visualParams,
  stability,
  isCurrent,
}: {
  dayLabel: string;
  visualParams: Record<string, unknown>;
  stability: number;
  isCurrent: boolean;
}) {
  const merged: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(visualParams as Partial<VisualParams>),
  };

  return (
    <div
      className={`relative flex shrink-0 flex-col items-center gap-1.5 rounded-xl border p-2 transition-all duration-300 ${
        isCurrent
          ? 'border-primary bg-surface-2 shadow-[0_0_20px_#3d5afe33,0_0_40px_#3d5afe11]'
          : 'border-border/50 bg-surface hover:border-border hover:bg-surface-2'
      }`}
      style={{ width: 'var(--card-w)' }}
    >
      {/* Day label */}
      <span
        className={`text-[10px] font-bold tracking-wide uppercase ${
          isCurrent ? 'text-primary' : 'text-muted'
        }`}
      >
        {isCurrent ? 'Oggi' : dayLabel}
      </span>

      {/* Creature */}
      <div className="flex items-center justify-center rounded-lg bg-background/60 p-1">
        <CreatureRenderer
          params={merged}
          size={typeof window !== 'undefined' && window.innerWidth < 768 ? 80 : 100}
          animated={isCurrent}
          seed={42}
        />
      </div>

      {/* Stability dot + score */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{
            backgroundColor: stabilityColor(stability),
            boxShadow: `0 0 6px ${stabilityColor(stability)}66`,
          }}
        />
        <span className="text-[9px] tabular-nums text-muted">
          {Math.round(stability * 100)}%
        </span>
      </div>

      {/* Pulsing ring for current day */}
      {isCurrent && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl border border-primary/40"
          style={{ animation: 'pulse-glow 2.5s ease-in-out infinite' }}
        />
      )}
    </div>
  );
}

export function EvolutionTimeline({ snapshots, currentCreature }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the end (latest day) on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, []);

  if (snapshots.length === 0 && currentCreature.ageDays === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 rounded-full bg-surface-2 p-6">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-12 w-12 text-muted"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3c-1.2 0-2.4.6-3 1.5C8.4 3.6 7.2 3 6 3c-2.5 0-4.5 2-4.5 4.5 0 5 6 9.5 10.5 13.5 4.5-4 10.5-8.5 10.5-13.5C22.5 5 20.5 3 18 3c-1.2 0-2.4.6-3 1.5-.6-.9-1.8-1.5-3-1.5Z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-bold text-foreground">
          Nessuna storia evolutiva
        </h2>
        <p className="max-w-xs text-sm text-muted">
          La tua creatura non ha ancora storia evolutiva. Inietta i primi
          crediti per iniziare!
        </p>
      </div>
    );
  }

  // Build the full list: snapshots + current creature as last item
  const firstHue = snapshots.length > 0
    ? extractBodyHue(snapshots[0].visualParams)
    : extractBodyHue(currentCreature.visualParams);
  const lastHue = extractBodyHue(currentCreature.visualParams);

  return (
    <div className="mx-auto max-w-4xl pb-8">
      {/* Header */}
      <div className="mb-4 px-4 pt-2">
        <h1 className="text-lg font-bold text-foreground">Evoluzione</h1>
        <p className="mt-0.5 text-xs text-muted">
          {snapshots.length + 1} giorn{snapshots.length === 0 ? 'o' : 'i'} di
          mutazioni &mdash; dal blob alla bestia
        </p>
      </div>

      {/* Timeline container */}
      <div className="relative px-4">
        {/* Horizontal scrollable area */}
        <div
          ref={scrollRef}
          className="scrollbar-thin flex gap-0 overflow-x-auto pb-4 pt-2"
          style={
            {
              '--card-w': 'clamp(100px, 26vw, 140px)',
            } as React.CSSProperties
          }
        >
          {/* Snapshot cards */}
          {snapshots.map((snap, idx) => (
            <div key={snap.day} className="flex shrink-0 items-end">
              <DayCard
                dayLabel={`G${idx + 1}`}
                visualParams={snap.visualParams}
                stability={snap.stabilityScore}
                isCurrent={false}
              />
              {/* Connector line */}
              <ConnectorLine
                fromHue={extractBodyHue(snap.visualParams)}
                toHue={
                  idx < snapshots.length - 1
                    ? extractBodyHue(snapshots[idx + 1].visualParams)
                    : extractBodyHue(currentCreature.visualParams)
                }
              />
            </div>
          ))}

          {/* Current creature = "OGGI" */}
          <div className="flex shrink-0 items-end">
            <DayCard
              dayLabel="Oggi"
              visualParams={currentCreature.visualParams}
              stability={currentCreature.stability}
              isCurrent={true}
            />
          </div>
        </div>

        {/* Gradient evolution path line (below cards) */}
        <div className="mt-1 flex items-center px-2">
          <div
            className="h-[2px] w-full rounded-full opacity-60"
            style={{
              background: `linear-gradient(to right, hsl(${firstHue},50%,40%), hsl(${lastHue},60%,50%))`,
              boxShadow: `0 0 8px hsl(${lastHue},60%,40%,0.3)`,
            }}
          />
          {/* Terminal dot */}
          <div
            className="ml-[-4px] h-2 w-2 shrink-0 rounded-full"
            style={{
              backgroundColor: `hsl(${lastHue},60%,50%)`,
              boxShadow: `0 0 8px hsl(${lastHue},60%,50%,0.5)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connector between day cards — short gradient line                   */
/* ------------------------------------------------------------------ */

function ConnectorLine({ fromHue, toHue }: { fromHue: number; toHue: number }) {
  return (
    <div className="flex shrink-0 items-center self-center" style={{ width: 24 }}>
      <svg width="24" height="8" viewBox="0 0 24 8" className="overflow-visible">
        <defs>
          <linearGradient id={`cg-${fromHue}-${toHue}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={`hsl(${fromHue},45%,40%)`} />
            <stop offset="100%" stopColor={`hsl(${toHue},50%,45%)`} />
          </linearGradient>
        </defs>
        <line
          x1="0"
          y1="4"
          x2="24"
          y2="4"
          stroke={`url(#cg-${fromHue}-${toHue})`}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="12" cy="4" r="2" fill={`hsl(${toHue},50%,50%)`} opacity="0.4" />
      </svg>
    </div>
  );
}
