'use client';

import { useState } from 'react';
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from '@/components/creature/creature-renderer';
import { PersonalityRadar } from '@/components/lab/personality-radar';
import { SynergyBadges } from '@/components/lab/synergy-badges';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';

interface Experiment {
  id: string;
  name: string;
  generation: number;
  ageDays: number;
  stability: number;
  elementLevels: Record<string, number>;
  traitValues: Record<string, number>;
  visualParams: Record<string, unknown>;
  isArchived: boolean;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
}

interface ExperimentGalleryProps {
  experiments: Experiment[];
}

function formatDateIT(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function castVisualParams(raw: Record<string, unknown>): VisualParams {
  return { ...DEFAULT_VISUAL_PARAMS, ...(raw as Partial<VisualParams>) };
}

function StabilityBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value < 0.3
      ? 'text-danger'
      : value < 0.7
        ? 'text-warning'
        : 'text-accent';
  return (
    <span className={`text-xs font-bold tabular-nums ${color}`}>
      {pct}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Experiment Card                                                     */
/* ------------------------------------------------------------------ */

function ExperimentCard({
  experiment,
  isExpanded,
  onToggle,
}: {
  experiment: Experiment;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isActive = !experiment.isArchived;
  const isFailed = experiment.archiveReason === 'failed';
  const isReset = experiment.isArchived && experiment.archiveReason !== 'failed';

  const vp = castVisualParams(experiment.visualParams);

  // Card opacity
  const cardOpacity = isFailed ? 'opacity-50' : isReset ? 'opacity-70' : '';

  // Border style
  const borderClass = isActive
    ? 'border-primary/40 shadow-[0_0_12px_#3d5afe22]'
    : isFailed
      ? 'border-danger/30'
      : 'border-border';

  return (
    <div
      className={`relative cursor-pointer rounded-xl border bg-surface transition-all hover:bg-surface-2 ${borderClass} ${cardOpacity}`}
      onClick={onToggle}
    >
      {/* ESPERIMENTO FALLITO stamp overlay */}
      {isFailed && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-xl">
          <div
            className="select-none border-2 border-red-600/60 px-3 py-1.5 text-center font-black uppercase leading-tight text-red-600/70"
            style={{
              transform: 'rotate(-12deg)',
              fontSize: 'clamp(10px, 2.5vw, 14px)',
              textShadow: '0 0 20px rgba(220, 38, 38, 0.3)',
              letterSpacing: '0.1em',
              maxWidth: '80%',
            }}
          >
            Esperimento Fallito
          </div>
        </div>
      )}

      {/* Card content */}
      <div className="relative z-0 p-4">
        {/* Status badge */}
        <div className="mb-3 flex items-center justify-between">
          {isActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" style={{ boxShadow: '0 0 6px #4ade80' }} />
              Attivo
            </span>
          )}
          {isReset && (
            <span className="inline-flex items-center rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              Archiviato
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
              Fallito
            </span>
          )}
          <span className="text-[10px] tabular-nums text-muted">
            Gen {experiment.generation}
          </span>
        </div>

        {/* Creature SVG */}
        <div className="mb-3 flex justify-center">
          <div className={isFailed ? 'relative' : ''}>
            {isFailed && (
              <div
                className="pointer-events-none absolute inset-0 z-10 rounded-lg"
                style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 70%)' }}
              />
            )}
            <CreatureRenderer
              params={vp}
              size={isExpanded ? 200 : 120}
              seed={42}
              animated={isActive}
            />
          </div>
        </div>

        {/* Name & stats */}
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{experiment.name}</p>
          <p className="mt-0.5 text-[10px] text-muted">
            Giorno {experiment.ageDays} &middot; Stabilita: <StabilityBadge value={experiment.stability} />
          </p>
          {experiment.isArchived && experiment.archivedAt && (
            <p className="mt-1 text-[9px] text-muted">
              {isFailed ? 'Fallito' : 'Archiviato'} il {formatDateIT(experiment.archivedAt)}
            </p>
          )}
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
            {/* Element levels */}
            <div>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted">
                Livelli Elementali
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {Object.entries(experiment.elementLevels).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <p className="text-[9px] font-bold text-muted">{key}</p>
                    <p className="text-xs font-bold tabular-nums text-foreground">
                      {typeof value === 'number' ? value.toFixed(1) : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Personality radar */}
            <PersonalityRadar elementLevels={experiment.elementLevels} size={140} />

            {/* Synergies */}
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted">
                Sinergie
              </p>
              <SynergyBadges elementLevels={experiment.elementLevels} />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                <p className="text-[9px] text-muted">Giorno</p>
                <p className="text-sm font-bold tabular-nums text-foreground">{experiment.ageDays}</p>
              </div>
              <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                <p className="text-[9px] text-muted">Generazione</p>
                <p className="text-sm font-bold tabular-nums text-foreground">{experiment.generation}</p>
              </div>
              <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                <p className="text-[9px] text-muted">Stabilita</p>
                <p className="text-sm font-bold tabular-nums"><StabilityBadge value={experiment.stability} /></p>
              </div>
            </div>

            {experiment.isArchived && (
              <div className="rounded-lg bg-surface-2 px-3 py-2 text-center">
                <p className="text-[9px] text-muted">Motivo Archiviazione</p>
                <p className={`text-xs font-bold ${isFailed ? 'text-danger' : 'text-muted'}`}>
                  {isFailed ? 'Esperimento Fallito' : 'Nuova Partita'}
                </p>
                {experiment.archivedAt && (
                  <p className="mt-0.5 text-[9px] text-muted">
                    {formatDateIT(experiment.archivedAt)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery grid                                                        */
/* ------------------------------------------------------------------ */

export function ExperimentGallery({ experiments }: ExperimentGalleryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (experiments.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted">Nessun esperimento ancora.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {experiments.map((exp) => (
        <ExperimentCard
          key={exp.id}
          experiment={exp}
          isExpanded={expandedId === exp.id}
          onToggle={() => handleToggle(exp.id)}
        />
      ))}
    </div>
  );
}
