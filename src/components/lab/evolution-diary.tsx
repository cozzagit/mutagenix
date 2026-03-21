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
  keySnapshots: KeySnapshot[];
  allSnapshotsForMilestones: MilestoneCandidate[];
}

// ---------------------------------------------------------------------------
// Personality definitions (mirrored from personality-radar)
// ---------------------------------------------------------------------------

const PERSONALITY_DEFS = [
  { key: 'aggression', label: 'Aggressività', color: '#ff4466',
    weights: { Fe: 0.4, S: 0.3, Cl: 0.2, Ca: 0.1 } as Record<string, number> },
  { key: 'luminosity', label: 'Luminosità', color: '#00f0ff',
    weights: { P: 0.4, O: 0.2, K: 0.2, Na: 0.2 } as Record<string, number> },
  { key: 'toxicity', label: 'Tossicità', color: '#76ff03',
    weights: { S: 0.4, Cl: 0.3, P: 0.2, N: 0.1 } as Record<string, number> },
  { key: 'intelligence', label: 'Intelligenza', color: '#b26eff',
    weights: { K: 0.3, Na: 0.3, P: 0.2, O: 0.2 } as Record<string, number> },
  { key: 'armoring', label: 'Corazza', color: '#ffcc80',
    weights: { Ca: 0.4, Fe: 0.3, C: 0.2, S: 0.1 } as Record<string, number> },
] as const;

// ---------------------------------------------------------------------------
// Dominant element insight descriptions
// ---------------------------------------------------------------------------

const DOMINANT_ELEMENT_INSIGHTS: Record<string, string> = {
  Ca: 'Il Calcio ha forgiato una creatura corazzata e robusta, con ossa spesse e postura salda.',
  Fe: 'Il Ferro ha creato un bruto muscoloso, aggressivo e dal colore rossastro.',
  K: 'Il Potassio ha sviluppato un\'intelligenza aliena, alta e slanciata, con molti occhi.',
  Na: 'Il Sodio ha sviluppato un organismo nervoso e reattivo, con riflessi fulminei.',
  S: 'Lo Zolfo ha generato un orrore tossico ricoperto di spine.',
  Cl: 'Il Cloro ha prodotto una creatura acida e velenosa, adattata alla sopravvivenza.',
  P: 'Il Fosforo ha dato vita a un alieno bioluminescente, elegante e misterioso.',
  N: 'L\'Azoto ha costruito un organismo equilibrato e resistente.',
  O: 'L\'Ossigeno ha favorito una creatura armoniosa e bilanciata.',
  C: 'Il Carbonio ha costruito una struttura solida e massiccia.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePersonality(elLevels: Record<string, number>) {
  const scores = PERSONALITY_DEFS.map((p) => {
    let raw = 0;
    for (const [el, w] of Object.entries(p.weights)) {
      raw += (elLevels[el] ?? 0) * w;
    }
    return { ...p, raw: raw * raw }; // squared like visual-mapper
  });
  const total = scores.reduce((s, p) => s + p.raw, 0);
  return scores.map((p) => ({
    key: p.key,
    label: p.label,
    color: p.color,
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

// ---------------------------------------------------------------------------
// Insight generator
// ---------------------------------------------------------------------------

function generateInsights(
  elLevels: Record<string, number>,
  lastSnapshot: KeySnapshot | undefined,
  currentTraits?: Record<string, number>,
  currentVisuals?: Record<string, number>,
): string[] {
  const insights: string[] = [];
  const sorted = getSortedElements(elLevels);
  const top2 = new Set(sorted.slice(0, 2).map((e) => e.el));
  const top3 = new Set(sorted.slice(0, 3).map((e) => e.el));

  // Color insights
  if (top2.has('Fe')) {
    insights.push('Il colore rossastro è influenzato dal Ferro presente nel tuo organismo.');
  }
  if (top2.has('P')) {
    insights.push('Il bagliore verdastro è una conseguenza del Fosforo.');
  }
  if (top2.has('S')) {
    insights.push('Le tinte acide derivano dallo Zolfo.');
  }
  if (top2.has('O') && !top2.has('Fe')) {
    insights.push('I toni cianotici sono dovuti all\'alta presenza di Ossigeno.');
  }

  // Use CURRENT data if available, fallback to last snapshot
  {
    const vp = (currentVisuals ?? lastSnapshot?.visualParams ?? {}) as Partial<VisualParams>;
    const tv = currentTraits ?? lastSnapshot?.traitValues ?? {};

    // Body shape insights
    const bw = (vp.bodyWidth as number) ?? 70;
    const bh = (vp.bodyHeight as number) ?? 60;
    if (bw > bh * 1.1) {
      insights.push('Il corpo largo e tozzo è tipico delle creature ricche di Calcio e Ferro.');
    }
    if (bh > bw * 1.3) {
      insights.push('La forma slanciata è dovuta agli elementi leggeri come Potassio e Sodio.');
    }

    // Feature insights
    if ((tv.furDensity ?? 0) > 5) {
      insights.push('La pelliccia folta è favorita da Azoto e Ossigeno.');
    }
    if ((tv.spininess ?? 0) > 5) {
      insights.push('Le spine si sviluppano con Zolfo e Calcio.');
    }
    if ((vp.eyeCount as number ?? 1) > 3) {
      insights.push('Gli occhi multipli sono un segno di alta stimolazione nervosa (Potassio, Fosforo).');
    }
    if ((vp.limbCount as number ?? 0) > 4) {
      insights.push('Gli arti extra sono favoriti dal Potassio e dal Sodio.');
    }
    if ((vp.clawSize as number ?? 0) > 8) {
      insights.push('Gli artigli affilati crescono con il Ferro.');
    }
    if ((vp.spineCount as number ?? 0) > 5) {
      insights.push('Le protuberanze spinose sono il segno dello Zolfo nel tuo organismo.');
    }
    if ((vp.tailLength as number ?? 0) > 15) {
      insights.push('La coda lunga è favorita dal Cloro e dal Fosforo.');
    }

    // Combat insights
    if ((tv.attackPower ?? 0) > 0 || (tv.defense ?? 0) > 0) {
      if ((tv.defense ?? 0) > (tv.attackPower ?? 0)) {
        insights.push('Il tuo guerriero è specializzato in difesa — tipico delle creature a base di Calcio.');
      }
      if ((tv.speed ?? 0) > (tv.defense ?? 0)) {
        insights.push('La velocità in battaglia è potenziata dal Sodio e dal Potassio.');
      }
      if ((tv.specialAttack ?? 0) > (tv.attackPower ?? 0)) {
        insights.push('Gli attacchi speciali sono amplificati da Fosforo e Zolfo.');
      }
    }
  }

  // Dominant element injection fact
  const dominant = sorted[0];
  insights.push(
    `Hai iniettato più ${ELEMENT_NAMES[dominant.el]} di qualsiasi altro elemento (${Math.round(dominant.value)} unità).`,
  );

  // Synergy hints
  for (const syn of SYNERGIES) {
    if (syn.elements.length === 0) continue; // skip caotico
    const active = syn.elements.every(
      (el) => (elLevels[el] ?? 0) >= (syn.thresholds[el] ?? 0),
    );
    if (active) {
      insights.push(`La sinergia "${syn.name}" è attiva grazie a ${syn.elements.map((e) => ELEMENT_NAMES[e as ElementId]).join(' e ')}.`);
    }
  }

  // Cap at 6 insights max, prioritize variety
  return insights.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Milestone generator
// ---------------------------------------------------------------------------

interface Milestone {
  dayNumber: number;
  label: string;
}

function generateMilestones(
  snapshots: MilestoneCandidate[],
  totalDays: number,
): Milestone[] {
  if (snapshots.length === 0) return [];

  const milestones: Milestone[] = [];
  const seen = new Set<string>();

  function add(day: number, label: string, key: string) {
    if (seen.has(key)) return;
    seen.add(key);
    milestones.push({ dayNumber: day, label });
  }

  // Day 1: birth
  add(1, 'Nascita — il tuo blob primordiale', 'birth');

  let prevTraits: Record<string, number> | null = null;

  for (const snap of snapshots) {
    const tv = snap.traitValues;

    // First limbs
    if ((tv.limbGrowth ?? 0) > 2 && prevTraits && (prevTraits.limbGrowth ?? 0) <= 2) {
      add(snap.dayNumber, 'Primi arti sviluppati', 'limbs');
    }

    // Multiple eyes
    if ((tv.eyeDev ?? 0) > 5 && prevTraits && (prevTraits.eyeDev ?? 0) <= 5) {
      add(snap.dayNumber, 'Occhi multipli', 'eyes');
    }

    // Fur
    if ((tv.furDensity ?? 0) > 3 && prevTraits && (prevTraits.furDensity ?? 0) <= 3) {
      add(snap.dayNumber, 'Pelliccia visibile', 'fur');
    }

    // Spines
    if ((tv.spininess ?? 0) > 3 && prevTraits && (prevTraits.spininess ?? 0) <= 3) {
      add(snap.dayNumber, 'Prime spine', 'spines');
    }

    // Claws
    if ((tv.clawDev ?? 0) > 3 && prevTraits && (prevTraits.clawDev ?? 0) <= 3) {
      add(snap.dayNumber, 'Artigli in crescita', 'claws');
    }

    // Tail
    if ((tv.tailGrowth ?? 0) > 3 && prevTraits && (prevTraits.tailGrowth ?? 0) <= 3) {
      add(snap.dayNumber, 'Coda sviluppata', 'tail');
    }

    // Warrior phase
    if (snap.dayNumber >= GAME_CONFIG.WARRIOR_PHASE_START) {
      if ((tv.attackPower ?? 0) > 0 || (tv.defense ?? 0) > 0) {
        add(snap.dayNumber, 'Inizio fase guerriero', 'warrior');
      }
    }

    // Synergy activations
    for (const syn of SYNERGIES) {
      if (syn.elements.length === 0) continue;
      const active = syn.elements.every(
        (el) => (snap.elementLevels[el] ?? 0) >= (syn.thresholds[el] ?? 0),
      );
      const wasPrev = prevTraits
        ? syn.elements.every(
            (el) => ((prevTraits as Record<string, number>)?.[`__el_${el}`] ?? 0) >= (syn.thresholds[el] ?? 0),
          )
        : false;
      // Use a simpler heuristic: just check if this snap activates but we haven't logged it yet
      if (active) {
        add(snap.dayNumber, `Sinergia "${syn.name}" attivata`, `syn_${syn.id}`);
      }
    }

    // Big milestones by day number
    if (snap.dayNumber === 50) add(50, '50 giorni di evoluzione', 'day50');
    if (snap.dayNumber === 100) add(100, '100 giorni — creatura veterana', 'day100');
    if (snap.dayNumber === 200) add(200, '200 giorni — sopravvissuta a tutto', 'day200');
    if (snap.dayNumber === 365) add(365, 'Un anno di vita!', 'day365');

    prevTraits = { ...tv };
    // Also store element levels for synergy comparison
    for (const el of ELEMENTS) {
      prevTraits[`__el_${el}`] = snap.elementLevels[el] ?? 0;
    }
  }

  return milestones.sort((a, b) => a.dayNumber - b.dayNumber);
}

// ---------------------------------------------------------------------------
// Section Components
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

function QuickSummary({
  elementLevels,
  totalDays,
}: {
  elementLevels: Record<string, number>;
  totalDays: number;
}) {
  const dominant = getDominantElement(elementLevels);
  const personality = computePersonality(elementLevels);
  const topPersonality = personality.reduce((a, b) => (a.pct > b.pct ? a : b));
  const insight = DOMINANT_ELEMENT_INSIGHTS[dominant] ?? 'Una creatura unica nel suo genere.';

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Riepilogo Rapido
      </h2>
      <div className="flex items-center gap-3 mb-2">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-black"
          style={{
            backgroundColor: `${ELEMENT_COLORS[dominant]}22`,
            color: ELEMENT_COLORS[dominant],
            border: `1px solid ${ELEMENT_COLORS[dominant]}44`,
          }}
        >
          {dominant}
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">
            Elemento dominante: {ELEMENT_NAMES[dominant]}
          </p>
          <p className="text-xs text-muted">{totalDays} giorni di evoluzione</p>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/80 italic">
        &ldquo;{insight}&rdquo;
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted">Personalità dominante:</span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: `${topPersonality.color}22`,
            color: topPersonality.color,
            border: `1px solid ${topPersonality.color}44`,
          }}
        >
          {topPersonality.label} {(topPersonality.pct * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function VisualTimeline({ snapshots }: { snapshots: KeySnapshot[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (snapshots.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Evoluzione Visiva
      </h2>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
      >
        {snapshots.map((snap) => {
          const vp: VisualParams = {
            ...DEFAULT_VISUAL_PARAMS,
            ...(snap.visualParams as Partial<VisualParams>),
          };
          return (
            <div
              key={snap.dayNumber}
              className="flex shrink-0 flex-col items-center"
            >
              <div className="rounded-lg bg-background/60 p-1.5">
                <CreatureRenderer
                  params={vp}
                  size={80}
                  animated={false}
                  seed={42}
                />
              </div>
              <span className="mt-1 text-[10px] font-semibold tabular-nums text-muted">
                Giorno {snap.dayNumber}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightPills({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Pillole di Insight
      </h2>
      <div className="space-y-2">
        {insights.map((text, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-lg bg-background/50 p-3"
          >
            <span className="mt-0.5 shrink-0 text-sm" aria-hidden>
              💡
            </span>
            <p className="text-sm leading-relaxed text-foreground/85">
              {text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChemicalDiet({ elementLevels }: { elementLevels: Record<string, number> }) {
  const sorted = getSortedElements(elementLevels);
  const maxValue = sorted[0]?.value ?? 1;
  const total = sorted.reduce((s, e) => s + e.value, 0);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Dieta Chimica
      </h2>
      <p className="mb-3 text-[11px] text-muted">
        Distribuzione totale degli elementi iniettati
      </p>
      <div className="space-y-2">
        {sorted.map(({ el, value }) => {
          const pct = total > 0 ? (value / total) * 100 : 0;
          const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <div key={el} className="flex items-center gap-2">
              <span
                className="w-7 shrink-0 text-right text-xs font-bold"
                style={{ color: ELEMENT_COLORS[el] }}
              >
                {el}
              </span>
              <span className="w-16 shrink-0 text-[10px] text-muted truncate">
                {ELEMENT_NAMES[el]}
              </span>
              <div className="flex-1 h-3 rounded-full bg-background/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: ELEMENT_COLORS[el],
                    opacity: 0.8,
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-[10px] font-mono tabular-nums text-foreground/70">
                {Math.round(value)}
              </span>
              <span className="w-9 shrink-0 text-right text-[10px] font-mono tabular-nums text-muted">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeyMilestones({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Tappe Principali
      </h2>
      <div className="relative ml-3">
        {/* Vertical timeline line */}
        <div className="absolute left-0 top-1 bottom-1 w-px bg-border" />

        <div className="space-y-3">
          {milestones.map((m, i) => (
            <div key={i} className="relative flex items-start gap-3 pl-4">
              {/* Timeline dot */}
              <div
                className="absolute left-[-3.5px] top-1.5 h-2 w-2 rounded-full border border-primary bg-surface shadow-[0_0_6px_#3d5afe44]"
              />
              <div>
                <span className="text-[10px] font-bold tabular-nums text-primary-light">
                  Giorno {m.dayNumber}
                </span>
                <p className="text-sm text-foreground/85">
                  {m.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
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
  keySnapshots,
  allSnapshotsForMilestones,
}: EvolutionDiaryProps) {
  // Memoize computed data
  const elLevels = elementLevels as Record<string, number>;

  const insights = useMemo(
    () => generateInsights(
      elLevels,
      keySnapshots.length > 0 ? keySnapshots[keySnapshots.length - 1] : undefined,
      currentTraitValues,
      currentVisualParams,
    ),
    [elLevels, keySnapshots, currentTraitValues, currentVisualParams],
  );

  const milestones = useMemo(
    () => generateMilestones(allSnapshotsForMilestones, totalDays),
    [allSnapshotsForMilestones, totalDays],
  );

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
          <span className="text-primary-light">{creatureName}</span>{' '}
          &mdash; {totalDays} giorni di evoluzione
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <QuickSummary elementLevels={elLevels} totalDays={totalDays} />
        <VisualTimeline snapshots={keySnapshots} />
        <InsightPills insights={insights} />
        <ChemicalDiet elementLevels={elLevels} />
        <KeyMilestones milestones={milestones} />
      </div>
    </div>
  );
}
