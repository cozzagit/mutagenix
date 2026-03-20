'use client';

import { CreatureRenderer } from '@/components/creature/creature-renderer';
import { DEFAULT_VISUAL_PARAMS } from '@/components/creature/creature-renderer';
import { ELEMENT_COLORS } from '@/components/lab/element-levels-display';
import { ELEMENTS, type ElementId } from '@/lib/game-engine/constants';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import type { DailySnapshot, MutationLogEntry, TriggerType } from '@/lib/db/schema';

const TRAIT_LABELS: Record<string, string> = {
  bodySize: 'Corpo',
  headSize: 'Testa',
  limbGrowth: 'Arti',
  eyeDev: 'Occhi',
  skinTex: 'Pelle',
  furDensity: 'Pelliccia',
  spininess: 'Spine',
  tailGrowth: 'Coda',
  clawDev: 'Artigli',
  posture: 'Postura',
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  element: 'Elemento',
  synergy: 'Sinergia',
  decay: 'Decadimento',
  threshold: 'Soglia',
  noise: 'Variazione',
};

const TRIGGER_COLORS: Record<TriggerType, string> = {
  element: 'bg-primary/20 text-primary-light border-primary/30',
  synergy: 'bg-bio-purple/20 text-bio-purple border-bio-purple/30',
  decay: 'bg-danger/20 text-danger border-danger/30',
  threshold: 'bg-warning/20 text-warning border-warning/30',
  noise: 'bg-muted/20 text-muted border-muted/30',
};

interface TimelineEntry {
  snapshot: DailySnapshot;
  mutations: MutationLogEntry[];
  dayNumber: number;
}

interface EvolutionLogProps {
  timelineData: TimelineEntry[];
  creatureName: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function stabilityColor(score: number): string {
  if (score < 0.3) return 'text-danger';
  if (score < 0.7) return 'text-warning';
  return 'text-accent';
}

function stabilityGlow(score: number): string {
  if (score < 0.3) return '';
  if (score < 0.7) return '';
  return 'glow-green';
}

function ElementPills({ elementLevels }: { elementLevels: Record<string, number> }) {
  const activeElements = ELEMENTS.filter(
    (el) => (elementLevels[el] ?? 0) > 0,
  );

  if (activeElements.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {activeElements.map((el) => (
        <span
          key={el}
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{
            backgroundColor: `${ELEMENT_COLORS[el]}18`,
            color: ELEMENT_COLORS[el],
            border: `1px solid ${ELEMENT_COLORS[el]}33`,
          }}
        >
          {el}
          <span className="font-mono text-[8px] opacity-70">
            {Math.round(elementLevels[el] ?? 0)}
          </span>
        </span>
      ))}
    </div>
  );
}

function DayCard({ entry }: { entry: TimelineEntry }) {
  const { snapshot, mutations, dayNumber } = entry;
  const visualParams: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(snapshot.visualParams as Partial<VisualParams>),
  };

  return (
    <div className="relative">
      {/* Timeline connector */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

      {/* Timeline node */}
      <div className="absolute left-3.5 top-5 z-10 h-3 w-3 rounded-full border-2 border-primary bg-surface shadow-[0_0_8px_#3d5afe44]" />

      <div className="ml-10 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-glow">
        {/* Header */}
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-foreground">
            Giorno {dayNumber}
          </h3>
          <span className="text-[11px] tabular-nums text-muted">
            {formatDate(snapshot.day)}
          </span>
        </div>

        {/* Creature thumbnail */}
        <div className="mb-3 flex justify-center">
          <div className="rounded-lg bg-background/60 p-2">
            <CreatureRenderer
              params={visualParams}
              size={120}
              animated={false}
            />
          </div>
        </div>

        {/* Stability */}
        <div className="mb-2 flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-3.5 w-3.5 text-muted"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
            />
          </svg>
          <span className="text-xs text-muted">Stabilit&agrave;:</span>
          <span
            className={`text-xs font-semibold tabular-nums ${stabilityColor(snapshot.stabilityScore)} ${stabilityGlow(snapshot.stabilityScore)}`}
          >
            {(snapshot.stabilityScore * 100).toFixed(0)}%
          </span>
        </div>

        {/* Mutations */}
        {mutations.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Mutazioni
            </span>
            {mutations.map((mut) => (
              <div
                key={mut.id}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-16 shrink-0 font-medium text-foreground">
                  {TRAIT_LABELS[mut.traitId] ?? mut.traitId}
                </span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    mut.delta > 0 ? 'text-bio-green' : mut.delta < 0 ? 'text-bio-red' : 'text-muted'
                  }`}
                >
                  {mut.delta > 0 ? '+' : ''}
                  {mut.delta.toFixed(1)}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${
                    TRIGGER_COLORS[mut.triggerType as TriggerType] ?? 'bg-surface-2 text-muted border-border'
                  }`}
                >
                  {TRIGGER_LABELS[mut.triggerType as TriggerType] ?? mut.triggerType}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Snapshot mutations_applied fallback (when no mutation_log entries) */}
        {mutations.length === 0 &&
          snapshot.mutationsApplied &&
          (snapshot.mutationsApplied as Array<{ traitId: string; delta: number; trigger: string }>).length > 0 && (
            <div className="mt-3 space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Mutazioni
              </span>
              {(snapshot.mutationsApplied as Array<{ traitId: string; delta: number; trigger: string }>).map(
                (mut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-16 shrink-0 font-medium text-foreground">
                      {TRAIT_LABELS[mut.traitId] ?? mut.traitId}
                    </span>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        mut.delta > 0 ? 'text-bio-green' : mut.delta < 0 ? 'text-bio-red' : 'text-muted'
                      }`}
                    >
                      {mut.delta > 0 ? '+' : ''}
                      {mut.delta.toFixed(1)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${
                        TRIGGER_COLORS[mut.trigger as TriggerType] ?? 'bg-surface-2 text-muted border-border'
                      }`}
                    >
                      {TRIGGER_LABELS[mut.trigger as TriggerType] ?? mut.trigger}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}

        {/* Element pills */}
        <ElementPills elementLevels={snapshot.elementLevels as Record<string, number>} />
      </div>
    </div>
  );
}

export function EvolutionLog({ timelineData, creatureName }: EvolutionLogProps) {
  if (timelineData.length === 0) {
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
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-bold text-foreground">
          Nessuna storia ancora
        </h2>
        <p className="max-w-xs text-sm text-muted">
          La tua creatura non ha ancora storia. Alloca i tuoi primi crediti!
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pb-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-foreground">
          Evoluzione
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          Timeline di <span className="text-primary-light">{creatureName}</span>{' '}
          &mdash; {timelineData.length} giorni
        </p>
      </div>

      {/* Timeline */}
      <div className="relative space-y-4">
        {timelineData.map((entry) => (
          <DayCard key={entry.snapshot.id} entry={entry} />
        ))}

        {/* Timeline start marker */}
        <div className="relative">
          <div className="absolute left-3.5 top-0 z-10 h-3 w-3 rounded-full border-2 border-accent bg-surface shadow-[0_0_8px_#00e5a044]" />
          <div className="ml-10 py-2 text-xs text-muted">
            Inizio
          </div>
        </div>
      </div>
    </div>
  );
}
