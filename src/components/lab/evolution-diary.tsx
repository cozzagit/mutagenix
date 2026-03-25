'use client';

import { useMemo, useRef } from 'react';
import { CreatureRenderer } from '@/components/creature/creature-renderer';
import { DEFAULT_VISUAL_PARAMS } from '@/components/creature/creature-renderer';
import { ELEMENT_COLORS, ELEMENT_NAMES } from '@/components/lab/element-levels-display';
import { ELEMENTS, SYNERGIES, GAME_CONFIG, type ElementId } from '@/lib/game-engine/constants';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import type { ElementLevels, TraitValues } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeySnapshot {
  dayNumber: number;
  day: string;
  visualParams: Record<string, unknown>;
  elementLevels: Record<string, number>;
  traitValues: Record<string, number>;
  stabilityScore: number;
}

interface MilestoneCandidate {
  dayNumber: number;
  traitValues: Record<string, number>;
  elementLevels: Record<string, number>;
  stabilityScore: number;
}

interface EvolutionDiaryProps {
  creatureName: string;
  totalDays: number;
  elementLevels: ElementLevels;
  traitValues?: Record<string, number>;
  currentVisualParams?: Record<string, number>;
  generation: number;
  stability: number;
  ageDays: number;
  foundingElements: Record<string, number> | null;
  growthElements: Record<string, number> | null;
  geneticImprint?: Record<string, number> | null;
  keySnapshots: KeySnapshot[];
  allSnapshotsForMilestones: MilestoneCandidate[];
}

// ---------------------------------------------------------------------------
// Personality definitions
// ---------------------------------------------------------------------------

const PERSONALITY_DEFS = [
  { key: 'aggression', label: 'Aggressivita', shortLabel: 'AGR', color: '#ff4466',
    description: 'Istinto combattivo e ferocia',
    weights: { Fe: 0.4, S: 0.3, Cl: 0.2, Ca: 0.1 } as Record<string, number> },
  { key: 'luminosity', label: 'Luminosita', shortLabel: 'LUM', color: '#00f0ff',
    description: 'Bioluminescenza e radianza',
    weights: { P: 0.4, O: 0.2, K: 0.2, Na: 0.2 } as Record<string, number> },
  { key: 'toxicity', label: 'Tossicita', shortLabel: 'TOX', color: '#76ff03',
    description: 'Veleni e secrezioni acide',
    weights: { S: 0.4, Cl: 0.3, P: 0.2, N: 0.1 } as Record<string, number> },
  { key: 'intelligence', label: 'Intelligenza', shortLabel: 'INT', color: '#b26eff',
    description: 'Capacita cognitiva e adattamento',
    weights: { K: 0.3, Na: 0.3, P: 0.2, O: 0.2 } as Record<string, number> },
  { key: 'armoring', label: 'Corazza', shortLabel: 'ARM', color: '#ffcc80',
    description: 'Protezione fisica e resistenza',
    weights: { Ca: 0.4, Fe: 0.3, C: 0.2, S: 0.1 } as Record<string, number> },
] as const;

// ---------------------------------------------------------------------------
// Dominant element insight descriptions
// ---------------------------------------------------------------------------

/** Generate creature description from actual visual params + traits, not generic element text */
function generateCreatureInsight(
  vp: Record<string, number> | undefined,
  traitValues: Record<string, number> | undefined,
  dominantEl: ElementId,
): string {
  if (!vp && !traitValues) return `Il ${ELEMENT_NAMES[dominantEl]} domina la composizione genetica di questa creatura.`;

  const parts: string[] = [];

  // Body color description from actual bodyHue
  const hue = vp?.bodyHue ?? 0;
  if (hue >= 0 && hue < 30) parts.push('dal corpo rossastro');
  else if (hue >= 30 && hue < 60) parts.push('con tonalita aranciate');
  else if (hue >= 60 && hue < 90) parts.push('dai toni giallastri');
  else if (hue >= 90 && hue < 150) parts.push('dal corpo verdastro');
  else if (hue >= 150 && hue < 210) parts.push('dai toni acquamarina');
  else if (hue >= 210 && hue < 270) parts.push('dal corpo blu-azzurro');
  else if (hue >= 270 && hue < 330) parts.push('con sfumature violacee');
  else parts.push('dal corpo cremisi');

  // Size from body dimensions
  const w = vp?.bodyWidth ?? 140;
  const h = vp?.bodyHeight ?? 130;
  if (w > 170 && h > 150) parts.push('di corporatura massiccia');
  else if (w < 100 || h < 100) parts.push('di dimensioni contenute');
  else if (w > h * 1.3) parts.push('dal profilo tozzo e largo');
  else if (h > w * 1.3) parts.push('dal corpo slanciato e alto');

  // Notable features from traits
  const tv = traitValues ?? {};
  if ((tv.furDensity ?? 0) > 40) parts.push('ricoperta di pelliccia');
  if ((tv.spininess ?? 0) > 40) parts.push('irta di spine');
  if ((tv.clawDev ?? 0) > 40) parts.push('con artigli sviluppati');
  if ((tv.eyeDev ?? 0) > 50) parts.push('con occhi evoluti');
  if ((tv.tailGrowth ?? 0) > 40) parts.push('dotata di coda');
  if ((tv.armoring ?? 0) > 40) parts.push('con placche corazzate');

  // Glow
  const glow = vp?.glowIntensity ?? 0;
  if (glow > 0.5) parts.push('avvolta in un bagliore intenso');
  else if (glow > 0.2) parts.push('con una lieve bioluminescenza');

  if (parts.length === 0) return `Una creatura unica plasmata dal ${ELEMENT_NAMES[dominantEl]}.`;

  return `Creatura ${parts.slice(0, 4).join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePersonality(elLevels: Record<string, number>) {
  const scores = PERSONALITY_DEFS.map((p) => {
    let raw = 0;
    for (const [el, w] of Object.entries(p.weights)) {
      raw += (elLevels[el] ?? 0) * w;
    }
    return { ...p, raw: raw * raw };
  });
  const total = scores.reduce((s, p) => s + p.raw, 0);
  return scores.map((p) => ({
    key: p.key,
    label: p.label,
    shortLabel: p.shortLabel,
    color: p.color,
    description: p.description,
    pct: total > 0 ? p.raw / total : 0,
  }));
}

function getSortedElements(elLevels: Record<string, number>): Array<{ el: ElementId; value: number }> {
  return ELEMENTS
    .map((el) => ({ el, value: elLevels[el] ?? 0 }))
    .sort((a, b) => b.value - a.value);
}

function getDominantElement(elLevels: Record<string, number>): ElementId {
  return getSortedElements(elLevels)[0].el;
}

function getActiveSynergies(elLevels: Record<string, number>) {
  return SYNERGIES.filter((syn) => {
    if (syn.elements.length === 0) return false;
    return syn.elements.every(
      (el) => (elLevels[el] ?? 0) >= (syn.thresholds[el] ?? 0),
    );
  });
}

// ---------------------------------------------------------------------------
// Milestone generator
// ---------------------------------------------------------------------------

interface Milestone {
  dayNumber: number;
  label: string;
  type: 'birth' | 'growth' | 'combat' | 'synergy' | 'milestone';
}

function generateMilestones(
  snapshots: MilestoneCandidate[],
  totalDays: number,
): Milestone[] {
  if (snapshots.length === 0) return [];

  const milestones: Milestone[] = [];
  const seen = new Set<string>();

  function add(day: number, label: string, key: string, type: Milestone['type']) {
    if (seen.has(key)) return;
    seen.add(key);
    milestones.push({ dayNumber: day, label, type });
  }

  add(1, 'Nascita — il tuo blob primordiale', 'birth', 'birth');

  let prevTraits: Record<string, number> | null = null;

  for (const snap of snapshots) {
    const tv = snap.traitValues;

    if ((tv.limbGrowth ?? 0) > 2 && prevTraits && (prevTraits.limbGrowth ?? 0) <= 2) {
      add(snap.dayNumber, 'Primi arti sviluppati', 'limbs', 'growth');
    }
    if ((tv.eyeDev ?? 0) > 5 && prevTraits && (prevTraits.eyeDev ?? 0) <= 5) {
      add(snap.dayNumber, 'Occhi multipli', 'eyes', 'growth');
    }
    if ((tv.furDensity ?? 0) > 3 && prevTraits && (prevTraits.furDensity ?? 0) <= 3) {
      add(snap.dayNumber, 'Pelliccia visibile', 'fur', 'growth');
    }
    if ((tv.spininess ?? 0) > 3 && prevTraits && (prevTraits.spininess ?? 0) <= 3) {
      add(snap.dayNumber, 'Prime spine', 'spines', 'growth');
    }
    if ((tv.clawDev ?? 0) > 3 && prevTraits && (prevTraits.clawDev ?? 0) <= 3) {
      add(snap.dayNumber, 'Artigli in crescita', 'claws', 'growth');
    }
    if ((tv.tailGrowth ?? 0) > 3 && prevTraits && (prevTraits.tailGrowth ?? 0) <= 3) {
      add(snap.dayNumber, 'Coda sviluppata', 'tail', 'growth');
    }

    if (snap.dayNumber >= GAME_CONFIG.WARRIOR_PHASE_START) {
      if ((tv.attackPower ?? 0) > 0 || (tv.defense ?? 0) > 0) {
        add(snap.dayNumber, 'Inizio fase guerriero', 'warrior', 'combat');
      }
    }

    for (const syn of SYNERGIES) {
      if (syn.elements.length === 0) continue;
      const active = syn.elements.every(
        (el) => (snap.elementLevels[el] ?? 0) >= (syn.thresholds[el] ?? 0),
      );
      if (active) {
        add(snap.dayNumber, `Sinergia "${syn.name}" attivata`, `syn_${syn.id}`, 'synergy');
      }
    }

    if (snap.dayNumber === 50) add(50, '50 giorni di evoluzione', 'day50', 'milestone');
    if (snap.dayNumber === 100) add(100, '100 giorni — creatura veterana', 'day100', 'milestone');
    if (snap.dayNumber === 200) add(200, '200 giorni — sopravvissuta a tutto', 'day200', 'milestone');
    if (snap.dayNumber === 365) add(365, 'Un anno di vita!', 'day365', 'milestone');

    prevTraits = { ...tv };
    for (const el of ELEMENTS) {
      prevTraits[`__el_${el}`] = snap.elementLevels[el] ?? 0;
    }
  }

  return milestones.sort((a, b) => a.dayNumber - b.dayNumber);
}

// ---------------------------------------------------------------------------
// Section: DNA Helix Visualization
// ---------------------------------------------------------------------------

function DnaHelix({ elementLevels }: { elementLevels: Record<string, number> }) {
  const maxLevel = Math.max(...ELEMENTS.map(el => elementLevels[el] ?? 0), 1);

  return (
    <div className="rounded-2xl border border-border/30 bg-surface p-5 overflow-hidden">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Sequenza DNA
      </h2>
      <p className="mb-4 text-[11px] text-muted">Firma genetica della tua creatura</p>

      <div className="relative py-4">
        {/* Central backbone — glowing vertical line */}
        <div
          className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2"
          style={{
            background: 'linear-gradient(to bottom, #3d5afe44, #b26eff44, #00f0ff44, #39ff7f44, #ff446644)',
            boxShadow: '0 0 8px #3d5afe22, 0 0 16px #b26eff11',
          }}
        />

        {/* Connector nodes on backbone */}
        {ELEMENTS.map((_, i) => (
          <div
            key={`node-${i}`}
            className="absolute left-1/2 -translate-x-1/2 w-[6px] h-[6px] rounded-full bg-surface border border-border/50"
            style={{
              top: `${((i + 0.5) / ELEMENTS.length) * 100}%`,
              boxShadow: '0 0 4px rgba(61, 90, 254, 0.3)',
            }}
          />
        ))}

        <div className="space-y-1">
          {ELEMENTS.map((el, i) => {
            const level = elementLevels[el] ?? 0;
            const widthPct = Math.max(8, (level / maxLevel) * 85);
            const isLeft = i % 2 === 0;
            const color = ELEMENT_COLORS[el];

            return (
              <div
                key={el}
                className={`flex items-center gap-0 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}
                style={{
                  animationName: 'dna-fade-in',
                  animationDuration: '0.6s',
                  animationDelay: `${i * 0.06}s`,
                  animationFillMode: 'both',
                  animationTimingFunction: 'ease-out',
                }}
              >
                {/* Label side */}
                <div className={`w-[52px] shrink-0 flex items-center gap-1.5 ${isLeft ? 'justify-end' : 'justify-start flex-row-reverse'}`}>
                  <span className="text-[9px] tabular-nums text-muted/70 font-mono">
                    {Math.round(level)}
                  </span>
                  <span
                    className="text-[11px] font-black tracking-wide"
                    style={{ color, textShadow: `0 0 6px ${color}44` }}
                  >
                    {el}
                  </span>
                </div>

                {/* Connector line from label to backbone center */}
                <div className="flex-1 flex items-center" style={{ justifyContent: isLeft ? 'flex-end' : 'flex-start' }}>
                  {/* The rung bar */}
                  <div
                    className="h-[10px] rounded-full relative overflow-hidden"
                    style={{
                      width: `${widthPct}%`,
                      opacity: level > 0 ? 0.6 + (level / maxLevel) * 0.4 : 0.15,
                      transition: 'width 1.2s ease-out, opacity 0.8s ease-out',
                    }}
                  >
                    {/* Base fill */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, ${color}22, ${color})`,
                      }}
                    />
                    {/* Glow overlay */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        boxShadow: `inset 0 0 8px ${color}66, 0 0 12px ${color}33`,
                      }}
                    />
                    {/* Shine streak */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[3px] rounded-full"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${color}88, transparent)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes dna-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Genetic Identity Card
// ---------------------------------------------------------------------------

function GeneticIdentityCard({
  creatureName,
  generation,
  totalDays,
  stability,
  elementLevels,
  traitValues,
  visualParams,
  foundingElements,
  growthElements,
}: {
  creatureName: string;
  generation: number;
  totalDays: number;
  stability: number;
  elementLevels: Record<string, number>;
  traitValues?: Record<string, number>;
  visualParams?: Record<string, number>;
  foundingElements: Record<string, number> | null;
  growthElements: Record<string, number> | null;
}) {
  const dominant = getDominantElement(elementLevels);
  const dominantColor = ELEMENT_COLORS[dominant];
  const personality = computePersonality(elementLevels);
  const topPersonality = personality.reduce((a, b) => (a.pct > b.pct ? a : b));
  const activeSynergies = getActiveSynergies(elementLevels);
  const insight = generateCreatureInsight(visualParams, traitValues, dominant);

  const stabilityPct = Math.round(stability * 100);
  const stabilityColor = stabilityPct >= 70 ? '#39ff7f' : stabilityPct >= 40 ? '#ffd600' : '#ff4466';

  // Heritage info from founding/growth elements
  const heritageInfo = useMemo(() => {
    if (!foundingElements && !growthElements) return null;
    const founding = foundingElements ?? {};
    const growth = growthElements ?? {};
    const foundingDom = Object.entries(founding).sort(([, a], [, b]) => b - a)[0];
    const growthDom = Object.entries(growth).sort(([, a], [, b]) => b - a)[0];
    if (!foundingDom && !growthDom) return null;
    return { foundingDom, growthDom };
  }, [foundingElements, growthElements]);

  return (
    <div
      className="rounded-2xl border bg-surface p-5 relative overflow-hidden"
      style={{ borderColor: `${dominantColor}30` }}
    >
      {/* Subtle accent glow in top-right */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: `${dominantColor}08` }}
      />

      {/* Creature name */}
      <h2
        className="text-2xl font-black tracking-tight mb-3"
        style={{ color: dominantColor, textShadow: `0 0 20px ${dominantColor}33` }}
      >
        {creatureName}
      </h2>

      {/* Badges row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2.5 py-1 text-[10px] font-bold text-muted border border-border/30">
          <span className="text-primary-light">GEN</span> {generation}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2.5 py-1 text-[10px] font-bold text-muted border border-border/30">
          <span className="text-primary-light">GIORNO</span> {totalDays}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2.5 py-1 text-[10px] font-bold border border-border/30"
          style={{ color: stabilityColor }}
        >
          STAB {stabilityPct}%
        </span>
      </div>

      {/* Dominant element */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black"
          style={{
            backgroundColor: `${dominantColor}18`,
            color: dominantColor,
            border: `1px solid ${dominantColor}40`,
            boxShadow: `0 0 12px ${dominantColor}22`,
          }}
        >
          {dominant}
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">
            Elemento dominante: {ELEMENT_NAMES[dominant]}
          </p>
          <p className="text-[11px] text-muted/80 italic leading-snug mt-0.5">
            {insight}
          </p>
        </div>
      </div>

      {/* Dominant personality trait */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted uppercase tracking-wider">Tratto dominante:</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{
              backgroundColor: `${topPersonality.color}18`,
              color: topPersonality.color,
              border: `1px solid ${topPersonality.color}35`,
              boxShadow: `0 0 8px ${topPersonality.color}15`,
            }}
          >
            {topPersonality.label} {(topPersonality.pct * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-[11px] text-muted/70 mt-1">{topPersonality.description}</p>
      </div>

      {/* Active synergies */}
      {activeSynergies.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] text-muted uppercase tracking-wider">Sinergie attive:</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {activeSynergies.map((syn) => (
              <span
                key={syn.id}
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-foreground/90"
                style={{
                  background: 'linear-gradient(135deg, rgba(61,90,254,0.15), rgba(178,110,255,0.15))',
                  border: '1px solid rgba(178,110,255,0.3)',
                  boxShadow: '0 0 8px rgba(178,110,255,0.12)',
                }}
              >
                {syn.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Heritage info */}
      {heritageInfo && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <span className="text-[10px] text-muted uppercase tracking-wider">Eredita genetica:</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {heritageInfo.foundingDom && (
              <span className="text-[11px] text-foreground/70">
                Fondazione:{' '}
                <span style={{ color: ELEMENT_COLORS[heritageInfo.foundingDom[0] as ElementId] ?? '#888' }} className="font-bold">
                  {ELEMENT_NAMES[heritageInfo.foundingDom[0] as ElementId] ?? heritageInfo.foundingDom[0]}
                </span>
              </span>
            )}
            {heritageInfo.growthDom && (
              <span className="text-[11px] text-foreground/70">
                Crescita:{' '}
                <span style={{ color: ELEMENT_COLORS[heritageInfo.growthDom[0] as ElementId] ?? '#888' }} className="font-bold">
                  {ELEMENT_NAMES[heritageInfo.growthDom[0] as ElementId] ?? heritageInfo.growthDom[0]}
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Visual Evolution Timeline
// ---------------------------------------------------------------------------

function VisualTimeline({ snapshots }: { snapshots: KeySnapshot[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (snapshots.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/30 bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Evoluzione Visiva
      </h2>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin"
        style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
      >
        {snapshots.map((snap) => {
          const vp: VisualParams = {
            ...DEFAULT_VISUAL_PARAMS,
            ...(snap.visualParams as Partial<VisualParams>),
          };

          // Stability indicator
          const stab = snap.stabilityScore ?? 0.5;
          const stabColor = stab >= 0.7 ? '#39ff7f' : stab >= 0.4 ? '#ffd600' : '#ff4466';

          return (
            <div
              key={snap.dayNumber}
              className="flex shrink-0 flex-col items-center snap-center"
            >
              <div className="rounded-xl bg-background/60 p-2 border border-border/20 relative">
                <CreatureRenderer
                  params={vp}
                  size={100}
                  animated={false}
                  seed={42}
                />
                {/* Stability dot */}
                <div
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: stabColor,
                    boxShadow: `0 0 4px ${stabColor}66`,
                  }}
                  title={`Stabilita: ${Math.round(stab * 100)}%`}
                />
              </div>
              <span
                className="mt-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-bold tabular-nums text-muted border border-border/20"
              >
                G{snap.dayNumber}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Personality Radar Chart (SVG spider chart)
// ---------------------------------------------------------------------------

function TraitRadarChart({ elementLevels }: { elementLevels: Record<string, number> }) {
  const personality = computePersonality(elementLevels);
  const hasData = personality.some((p) => p.pct > 0);

  if (!hasData) return null;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 75;
  const levels = 4; // concentric rings

  // 5 traits, 72 degrees apart
  const angleStep = (2 * Math.PI) / 5;
  const startAngle = -Math.PI / 2; // start from top

  function polarToXY(angle: number, r: number) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  // Build radar polygon points
  const radarPoints = personality.map((p, i) => {
    const angle = startAngle + i * angleStep;
    const r = p.pct * maxR;
    return polarToXY(angle, r);
  });

  const polygonPath = radarPoints.map((pt, i) =>
    `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
  ).join(' ') + ' Z';

  // Axis lines
  const axes = personality.map((p, i) => {
    const angle = startAngle + i * angleStep;
    const end = polarToXY(angle, maxR);
    const labelPos = polarToXY(angle, maxR + 16);
    return { ...p, end, labelPos, angle };
  });

  return (
    <div className="rounded-2xl border border-border/30 bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Profilo Personalita
      </h2>

      <div className="flex flex-col items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          {/* Concentric rings */}
          {Array.from({ length: levels }, (_, i) => {
            const r = ((i + 1) / levels) * maxR;
            const ringPoints = Array.from({ length: 5 }, (__, j) => {
              const angle = startAngle + j * angleStep;
              return polarToXY(angle, r);
            });
            const path = ringPoints.map((pt, j) =>
              `${j === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
            ).join(' ') + ' Z';
            return (
              <path
                key={`ring-${i}`}
                d={path}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth={0.5}
                opacity={0.3}
              />
            );
          })}

          {/* Axis lines */}
          {axes.map((axis) => (
            <line
              key={`axis-${axis.key}`}
              x1={cx}
              y1={cy}
              x2={axis.end.x}
              y2={axis.end.y}
              stroke="var(--color-border)"
              strokeWidth={0.5}
              opacity={0.3}
            />
          ))}

          {/* Filled radar polygon */}
          <path
            d={polygonPath}
            fill="url(#radar-gradient)"
            stroke="url(#radar-stroke)"
            strokeWidth={1.5}
            opacity={0.85}
          />

          {/* Dots at each vertex */}
          {radarPoints.map((pt, i) => (
            <circle
              key={`dot-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={3}
              fill={personality[i].color}
              stroke="var(--color-background)"
              strokeWidth={1}
              style={{ filter: `drop-shadow(0 0 3px ${personality[i].color}88)` }}
            />
          ))}

          {/* Axis labels */}
          {axes.map((axis) => (
            <text
              key={`label-${axis.key}`}
              x={axis.labelPos.x}
              y={axis.labelPos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={axis.color}
              fontSize={9}
              fontWeight={700}
            >
              {axis.shortLabel}
            </text>
          ))}

          {/* Gradients */}
          <defs>
            <linearGradient id="radar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3d5afe" stopOpacity={0.25} />
              <stop offset="50%" stopColor="#b26eff" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="radar-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3d5afe" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#b26eff" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.8} />
            </linearGradient>
          </defs>
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3 px-2">
          {personality.filter(p => p.pct > 0.01).map((p) => (
            <div key={p.key} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: p.color, boxShadow: `0 0 4px ${p.color}55` }}
              />
              <span className="text-[9px] text-muted">
                {p.label}{' '}
                <span className="font-bold" style={{ color: p.color }}>
                  {(p.pct * 100).toFixed(0)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Combat Stats
// ---------------------------------------------------------------------------

function CombatStats({ traitValues }: { traitValues: Record<string, number> }) {
  const stats = [
    { key: 'attackPower', label: 'Attacco', color: '#ff4466' },
    { key: 'defense', label: 'Difesa', color: '#3d5afe' },
    { key: 'speed', label: 'Velocita', color: '#00f0ff' },
    { key: 'stamina', label: 'Resistenza', color: '#ff9100' },
    { key: 'specialAttack', label: 'Speciale', color: '#b26eff' },
    { key: 'battleScars', label: 'Cicatrici', color: '#6b6d7b' },
  ];

  const maxVal = Math.max(...stats.map(s => traitValues[s.key] ?? 0), 1);
  const hasCombat = stats.some(s => (traitValues[s.key] ?? 0) > 0);

  if (!hasCombat) return null;

  return (
    <div className="rounded-2xl border border-border/30 bg-surface p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Statistiche Combattimento
      </h2>
      <p className="mb-4 text-[11px] text-muted">Fase guerriero attiva</p>

      <div className="space-y-2.5">
        {stats.map(({ key, label, color }) => {
          const value = traitValues[key] ?? 0;
          const pct = Math.min((value / maxVal) * 100, 100);

          return (
            <div key={key} className="flex items-center gap-2.5">
              <span
                className="w-[72px] shrink-0 text-[11px] font-bold"
                style={{ color }}
              >
                {label}
              </span>
              <div className="flex-1 h-[10px] rounded-full bg-background/60 overflow-hidden relative">
                <div
                  className="h-full rounded-full relative"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}66, ${color})`,
                    boxShadow: `0 0 8px ${color}33`,
                    transition: 'width 1s ease-out',
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px] rounded-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }}
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-[10px] font-mono tabular-nums text-foreground/70">
                {value.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Genetic Imprint (Impronta Genetica)
// ---------------------------------------------------------------------------

function GeneticImprintDisplay({ imprint }: { imprint: Record<string, number> }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-surface p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Impronta Genetica
      </h2>
      <p className="mb-4 text-[11px] text-muted">Efficienza genetica per elemento</p>

      <div className="space-y-2">
        {ELEMENTS.map((el) => {
          const coeff = imprint[el] ?? 1.0;
          const color = ELEMENT_COLORS[el];
          // Map coefficient 0.7–1.3 to visual bar width (0%–100%)
          // 0.7 → 0%, 1.0 → 50%, 1.3 → 100%
          const barPct = Math.max(0, Math.min(100, ((coeff - 0.7) / 0.6) * 100));
          // Center line at 50% (coefficient 1.0)
          const isAboveAvg = coeff > 1.005;
          const isBelowAvg = coeff < 0.995;
          const accentColor = isAboveAvg ? color : isBelowAvg ? `${color}66` : `${color}88`;

          return (
            <div key={el} className="flex items-center gap-2.5">
              {/* Element label */}
              <span
                className="w-[28px] shrink-0 text-[11px] font-black tracking-wide text-right"
                style={{ color, textShadow: `0 0 6px ${color}44` }}
              >
                {el}
              </span>

              {/* Bar container */}
              <div className="flex-1 h-[10px] rounded-full bg-background/60 overflow-hidden relative">
                {/* Center line at 1.0 */}
                <div
                  className="absolute top-0 bottom-0 w-[1px] z-10"
                  style={{
                    left: '50%',
                    backgroundColor: 'var(--color-border)',
                    opacity: 0.5,
                  }}
                />

                {/* Filled bar from left */}
                <div
                  className="h-full rounded-full relative"
                  style={{
                    width: `${barPct}%`,
                    background: `linear-gradient(90deg, ${accentColor}33, ${accentColor})`,
                    boxShadow: isAboveAvg ? `0 0 8px ${color}33` : 'none',
                    transition: 'width 1s ease-out',
                  }}
                >
                  {isAboveAvg && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[3px] rounded-full"
                      style={{ background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }}
                    />
                  )}
                </div>
              </div>

              {/* Coefficient value */}
              <span
                className="w-[40px] shrink-0 text-right text-[10px] font-mono tabular-nums"
                style={{
                  color: isAboveAvg ? color : isBelowAvg ? 'var(--color-muted)' : 'var(--color-foreground)',
                  fontWeight: isAboveAvg ? 700 : 400,
                }}
              >
                {coeff.toFixed(2)}x
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between text-[9px] text-muted/60">
        <span>0.70x (debole)</span>
        <span>1.00x (neutro)</span>
        <span>1.30x (forte)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Key Milestones Timeline
// ---------------------------------------------------------------------------

const MILESTONE_COLORS: Record<Milestone['type'], string> = {
  birth: '#00f0ff',
  growth: '#39ff7f',
  combat: '#ff4466',
  synergy: '#b26eff',
  milestone: '#ffd600',
};

function KeyMilestonesTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/30 bg-surface p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
        Tappe Principali
      </h2>

      <div className="relative ml-4">
        {/* Glowing vertical timeline line */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px]"
          style={{
            background: 'linear-gradient(to bottom, #3d5afe44, #b26eff44, #39ff7f44)',
            boxShadow: '0 0 6px #3d5afe22',
          }}
        />

        <div className="space-y-4">
          {milestones.map((m, i) => {
            const color = MILESTONE_COLORS[m.type];
            return (
              <div key={i} className="relative flex items-start gap-4 pl-5">
                {/* Day circle on timeline */}
                <div
                  className="absolute left-[-11px] top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[8px] font-black"
                  style={{
                    backgroundColor: `${color}20`,
                    color,
                    border: `1.5px solid ${color}60`,
                    boxShadow: `0 0 8px ${color}25`,
                  }}
                >
                  {m.dayNumber}
                </div>

                {/* Event description */}
                <div className="pt-0.5">
                  <p className="text-sm text-foreground/90 leading-snug">
                    {m.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
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

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function EvolutionDiary({
  creatureName,
  totalDays,
  elementLevels,
  traitValues: currentTraitValues,
  currentVisualParams,
  generation,
  stability,
  ageDays,
  foundingElements,
  growthElements,
  geneticImprint,
  keySnapshots,
  allSnapshotsForMilestones,
}: EvolutionDiaryProps) {
  const elLevels = elementLevels as Record<string, number>;

  const milestones = useMemo(
    () => generateMilestones(allSnapshotsForMilestones, totalDays),
    [allSnapshotsForMilestones, totalDays],
  );

  const isWarrior = totalDays >= GAME_CONFIG.WARRIOR_PHASE_START;

  if (totalDays === 0 || keySnapshots.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto max-w-lg pb-8">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-foreground">
          Diario Evolutivo
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          Identita genetica e storia evolutiva
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* 1. DNA Helix — the centerpiece */}
        <DnaHelix elementLevels={elLevels} />

        {/* 1b. Genetic Imprint (if available) */}
        {geneticImprint && <GeneticImprintDisplay imprint={geneticImprint} />}

        {/* 2. Genetic Identity Card */}
        <GeneticIdentityCard
          creatureName={creatureName}
          generation={generation}
          totalDays={totalDays}
          stability={stability}
          elementLevels={elLevels}
          traitValues={currentTraitValues}
          visualParams={currentVisualParams as Record<string, number> | undefined}
          foundingElements={foundingElements}
          growthElements={growthElements}
        />

        {/* 3. Visual Evolution Timeline */}
        <VisualTimeline snapshots={keySnapshots} />

        {/* 4. Personality Radar Chart */}
        <TraitRadarChart elementLevels={elLevels} />

        {/* 5. Combat Stats (warrior phase only) */}
        {isWarrior && currentTraitValues && (
          <CombatStats traitValues={currentTraitValues} />
        )}

        {/* 6. Key Milestones */}
        <KeyMilestonesTimeline milestones={milestones} />
      </div>
    </div>
  );
}
