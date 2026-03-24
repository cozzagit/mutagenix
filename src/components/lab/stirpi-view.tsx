'use client';

import { useMemo } from 'react';
import {
  CreatureRenderer,
  DEFAULT_VISUAL_PARAMS,
} from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import type { LaboratoriCreature } from './laboratori-directory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StirpiViewProps {
  creatures: LaboratoriCreature[];
}

interface GenealogyNode {
  creature: LaboratoriCreature;
  generation: number;
  x: number;
  y: number;
}

interface BreedingLink {
  parent1: GenealogyNode;
  parent2: GenealogyNode;
  children: GenealogyNode[];
  midX: number;
  midY: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 130;
const ROW_HEIGHT = 200;
const PADDING_LEFT = 80;
const PADDING_TOP = 60;
const NODE_RENDER_WIDTH = 90;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGenColor(gen: number): string {
  if (gen === 1) return '#3d5afe';
  if (gen === 2) return '#b26eff';
  return '#00e5a0';
}

function getGenSize(gen: number): number {
  if (gen === 1) return 75;
  if (gen === 2) return 65;
  return 55;
}

/**
 * Find all creatures involved in breeding: they are parents of someone,
 * or they have parents (i.e. they are children).
 */
function findInvolvedCreatures(
  creatures: LaboratoriCreature[],
): LaboratoriCreature[] {
  const parentNames = new Set<string>();
  const childIds = new Set<string>();

  for (const c of creatures) {
    if (c.parentNames?.parentA) {
      parentNames.add(c.parentNames.parentA);
      childIds.add(c.id);
    }
    if (c.parentNames?.parentB) {
      parentNames.add(c.parentNames.parentB);
      childIds.add(c.id);
    }
  }

  return creatures.filter(
    (c) => parentNames.has(c.name) || childIds.has(c.id),
  );
}

/**
 * Order Gen 1 creatures so breeding partners are placed next to each other.
 */
function orderByBreedingProximity(
  gen1: LaboratoriCreature[],
  allCreatures: LaboratoriCreature[],
): LaboratoriCreature[] {
  // Find unique breeding pairs among all creatures
  const pairs: [string, string][] = [];
  for (const c of allCreatures) {
    if (c.parentNames?.parentA && c.parentNames?.parentB) {
      const key = [c.parentNames.parentA, c.parentNames.parentB]
        .sort()
        .join('|');
      if (!pairs.some((p) => p.sort().join('|') === key)) {
        pairs.push(
          [c.parentNames.parentA, c.parentNames.parentB].sort() as [
            string,
            string,
          ],
        );
      }
    }
  }

  const gen1Names = new Set(gen1.map((c) => c.name));
  const placed: LaboratoriCreature[] = [];
  const remaining = new Set(gen1.map((c) => c.name));

  // Only consider pairs where at least one member is gen1
  const gen1Pairs = pairs.filter(
    ([a, b]) => gen1Names.has(a) || gen1Names.has(b),
  );

  for (const [a, b] of gen1Pairs) {
    if (remaining.has(a) && !placed.some((c) => c.name === a)) {
      placed.push(gen1.find((c) => c.name === a)!);
      remaining.delete(a);
    }
    if (remaining.has(b) && !placed.some((c) => c.name === b)) {
      placed.push(gen1.find((c) => c.name === b)!);
      remaining.delete(b);
    }
  }

  // Add remaining gen1 that haven't bred
  for (const c of gen1) {
    if (remaining.has(c.name)) {
      placed.push(c);
    }
  }

  return placed;
}

/**
 * Resolve horizontal overlaps in a set of nodes by pushing them apart.
 */
function resolveOverlaps(nodes: GenealogyNode[], minSpacing: number) {
  nodes.sort((a, b) => a.x - b.x);
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    if (curr.x - prev.x < minSpacing) {
      curr.x = prev.x + minSpacing;
    }
  }
}

/**
 * Build breeding links from positioned nodes.
 */
function buildBreedingLinks(nodes: GenealogyNode[]): BreedingLink[] {
  // Group children by parent pair
  const pairMap = new Map<string, GenealogyNode[]>();

  for (const node of nodes) {
    const c = node.creature;
    if (!c.parentNames?.parentA || !c.parentNames?.parentB) continue;
    const key = [c.parentNames.parentA, c.parentNames.parentB]
      .sort()
      .join('|');
    const arr = pairMap.get(key) ?? [];
    arr.push(node);
    pairMap.set(key, arr);
  }

  const links: BreedingLink[] = [];
  for (const [key, children] of pairMap) {
    const [p1Name, p2Name] = key.split('|');
    const parent1 = nodes.find((n) => n.creature.name === p1Name);
    const parent2 = nodes.find((n) => n.creature.name === p2Name);
    if (!parent1 || !parent2) continue;

    // Junction Y is between the parent row and child row
    const parentBottomY = Math.max(parent1.y, parent2.y) + 55;
    const childTopY = Math.min(...children.map((c) => c.y));
    const junctionY = parentBottomY + (childTopY - parentBottomY) * 0.4;

    links.push({
      parent1,
      parent2,
      children,
      midX: (parent1.x + parent2.x) / 2,
      midY: junctionY,
    });
  }

  return links;
}

/**
 * Main layout function: positions all creatures in generation layers
 * and builds breeding links between them.
 */
function layoutGenealogy(allCreatures: LaboratoriCreature[]): {
  nodes: GenealogyNode[];
  links: BreedingLink[];
} {
  const involved = findInvolvedCreatures(allCreatures);
  if (involved.length === 0) return { nodes: [], links: [] };

  // Determine max generation
  const maxGen = Math.max(
    ...involved.map((c) => c.familyGeneration ?? 1),
    1,
  );

  // Group by generation
  const byGen = new Map<number, LaboratoriCreature[]>();
  for (let g = 1; g <= maxGen; g++) {
    byGen.set(
      g,
      involved.filter((c) => (c.familyGeneration ?? 1) === g),
    );
  }

  const nodes: GenealogyNode[] = [];

  // Position Gen 1 (order by breeding proximity)
  const gen1 = byGen.get(1) ?? [];
  const orderedGen1 = orderByBreedingProximity(gen1, allCreatures);
  orderedGen1.forEach((c, i) => {
    nodes.push({
      creature: c,
      generation: 1,
      x: PADDING_LEFT + i * NODE_WIDTH,
      y: PADDING_TOP,
    });
  });

  // Position subsequent generations
  for (let g = 2; g <= maxGen; g++) {
    const genCreatures = byGen.get(g) ?? [];
    const rowY = PADDING_TOP + ROW_HEIGHT * (g - 1);

    for (const child of genCreatures) {
      const p1 = nodes.find(
        (n) => n.creature.name === child.parentNames?.parentA,
      );
      const p2 = nodes.find(
        (n) => n.creature.name === child.parentNames?.parentB,
      );
      let midX: number;
      if (p1 && p2) {
        midX = (p1.x + p2.x) / 2;
      } else if (p1) {
        midX = p1.x;
      } else if (p2) {
        midX = p2.x;
      } else {
        // Orphan — place at the end
        const existing = nodes.filter((n) => n.generation === g);
        midX =
          existing.length > 0
            ? Math.max(...existing.map((n) => n.x)) + NODE_WIDTH
            : PADDING_LEFT;
      }
      nodes.push({ creature: child, generation: g, x: midX, y: rowY });
    }

    // Resolve overlaps within this generation
    const genNodes = nodes.filter((n) => n.generation === g);
    resolveOverlaps(genNodes, NODE_WIDTH * 0.85);

    // Apply resolved positions back
    for (const gn of genNodes) {
      const idx = nodes.findIndex(
        (n) => n.creature.id === gn.creature.id,
      );
      if (idx >= 0) nodes[idx] = gn;
    }
  }

  // Build breeding links
  const links = buildBreedingLinks(nodes);

  return { nodes, links };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CreatureNode({
  creature,
  size,
}: {
  creature: LaboratoriCreature;
  size: number;
}) {
  const vp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  const gen = creature.familyGeneration ?? 1;
  const genColor = getGenColor(gen);
  const isDead = creature.isDead === true;

  return (
    <div className="flex flex-col items-center">
      {/* Glow ring */}
      <div className="relative">
        <div
          className="absolute inset-[-6px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${genColor}22 0%, transparent 70%)`,
          }}
        />
        <div className={isDead ? 'opacity-30 sepia' : ''}>
          <CreatureRenderer
            params={vp}
            size={size}
            animated={false}
            seed={42}
          />
        </div>
      </div>
      <p
        className="mt-1 max-w-[90px] truncate text-center text-[10px] font-bold text-foreground"
        title={creature.name}
      >
        {creature.name}
      </p>
      <p className="text-[8px] text-muted">{creature.ownerName}</p>
      <span
        className="mt-0.5 rounded-full px-1.5 py-0.5 text-[7px] font-bold"
        style={{
          color: genColor,
          backgroundColor: `${genColor}15`,
        }}
      >
        Gen {gen}
      </span>
    </div>
  );
}

function BreedingLinkSVG({ link }: { link: BreedingLink }) {
  const { parent1, parent2, children, midX, midY } = link;

  // Parent bottom anchor (below the creature render)
  const p1Bottom = parent1.y + 55;
  const p2Bottom = parent2.y + 55;
  const parentBottomY = Math.max(p1Bottom, p2Bottom);

  return (
    <g>
      {/* Horizontal breeding line between parents */}
      <line
        x1={parent1.x}
        y1={parentBottomY}
        x2={parent2.x}
        y2={parentBottomY}
        stroke="#ec4899"
        strokeWidth={1.5}
        opacity={0.4}
        strokeDasharray="6 3"
      />

      {/* Vertical stubs from each parent down to the horizontal line */}
      {parent1.y + 55 < parentBottomY && (
        <line
          x1={parent1.x}
          y1={parent1.y + 55}
          x2={parent1.x}
          y2={parentBottomY}
          stroke="#ec4899"
          strokeWidth={1.5}
          opacity={0.3}
        />
      )}
      {parent2.y + 55 < parentBottomY && (
        <line
          x1={parent2.x}
          y1={parent2.y + 55}
          x2={parent2.x}
          y2={parentBottomY}
          stroke="#ec4899"
          strokeWidth={1.5}
          opacity={0.3}
        />
      )}

      {/* Vertical line from breeding line midpoint down to junction */}
      <line
        x1={midX}
        y1={parentBottomY}
        x2={midX}
        y2={midY}
        stroke="#ec4899"
        strokeWidth={1.5}
        opacity={0.3}
      />

      {/* Heart at junction */}
      <text
        x={midX}
        y={midY + 4}
        textAnchor="middle"
        fill="#ec4899"
        fontSize={10}
        opacity={0.6}
      >
        &#9829;
      </text>

      {/* Lines from junction to each child */}
      {children.map((child, i) => {
        const childTopY = child.y - 15;
        return (
          <g key={i}>
            {/* Horizontal from junction to above child */}
            {Math.abs(child.x - midX) > 1 && (
              <line
                x1={midX}
                y1={midY}
                x2={child.x}
                y2={midY}
                stroke="#b26eff"
                strokeWidth={1}
                opacity={0.3}
              />
            )}
            {/* Vertical down to child */}
            <line
              x1={child.x}
              y1={midY}
              x2={child.x}
              y2={childTopY}
              stroke="#b26eff"
              strokeWidth={1}
              opacity={0.3}
            />
            {/* Small arrow/dot at the child end */}
            <circle
              cx={child.x}
              cy={childTopY}
              r={2.5}
              fill="#b26eff"
              opacity={0.4}
            />
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function StirpiView({ creatures: allCreatures }: StirpiViewProps) {
  const { nodes, links } = useMemo(
    () => layoutGenealogy(allCreatures),
    [allCreatures],
  );

  // Find solo founders (gen 1, never bred, have no parents)
  const soloFounders = useMemo(() => {
    const parentNames = new Set<string>();
    for (const c of allCreatures) {
      if (c.parentNames?.parentA) parentNames.add(c.parentNames.parentA);
      if (c.parentNames?.parentB) parentNames.add(c.parentNames.parentB);
    }
    return allCreatures.filter(
      (c) =>
        (c.familyGeneration ?? 1) === 1 &&
        !parentNames.has(c.name) &&
        !c.parentNames?.parentA &&
        !c.parentNames?.parentB,
    );
  }, [allCreatures]);

  // Determine generations present
  const generations = useMemo(() => {
    const gens = new Set(nodes.map((n) => n.generation));
    return Array.from(gens).sort((a, b) => a - b);
  }, [nodes]);

  // Empty state
  if (nodes.length === 0 && soloFounders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#8a9a70]/15 bg-surface/30">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-7 w-7 text-muted/30"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
            />
          </svg>
        </div>
        <p className="text-sm text-muted/50">
          Nessun incrocio registrato.
        </p>
        <p className="text-xs text-muted/30">
          Accoppia le tue creature nella sezione DNA!
        </p>
      </div>
    );
  }

  // Calculate canvas dimensions
  const canvasWidth =
    nodes.length > 0
      ? Math.max(...nodes.map((n) => n.x)) + NODE_RENDER_WIDTH + 40
      : 400;
  const canvasHeight =
    nodes.length > 0
      ? Math.max(...nodes.map((n) => n.y)) + 150
      : 300;

  // Count breeding events (unique parent pairs)
  const breedingCount = links.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-5 w-5 text-bio-purple/60"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
          />
        </svg>
        <h3 className="text-sm font-bold tracking-wide text-foreground/70">
          Albero Genealogico
        </h3>
        <span className="rounded-full bg-bio-purple/10 px-2 py-0.5 text-[9px] font-bold text-bio-purple/60">
          {breedingCount} {breedingCount === 1 ? 'incrocio' : 'incroci'}
        </span>
        <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[9px] font-bold text-muted/50">
          {nodes.length} creature
        </span>
      </div>

      {/* Genealogical tree */}
      <div
        className="overflow-auto rounded-2xl border border-border/30 bg-background"
        style={{ maxHeight: '70vh' }}
      >
        <div className="relative" style={{ width: canvasWidth, minHeight: canvasHeight }}>
          {/* Generation labels on the left */}
          {generations.map((gen) => {
            const genNodes = nodes.filter((n) => n.generation === gen);
            if (genNodes.length === 0) return null;
            const y = genNodes[0].y;
            return (
              <div
                key={gen}
                className="absolute left-2"
                style={{ top: y - 10 }}
              >
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: getGenColor(gen), opacity: 0.4 }}
                >
                  Gen {gen}
                </span>
              </div>
            );
          })}

          {/* SVG connection lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={canvasWidth}
            height={canvasHeight}
          >
            {links.map((link, i) => (
              <BreedingLinkSVG key={i} link={link} />
            ))}
          </svg>

          {/* Creature nodes */}
          {nodes.map((node) => (
            <div
              key={node.creature.id}
              className="absolute"
              style={{
                left: node.x - NODE_RENDER_WIDTH / 2,
                top: node.y - 10,
              }}
            >
              <CreatureNode
                creature={node.creature}
                size={getGenSize(node.generation)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Solo founders section */}
      {soloFounders.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="h-[1px] flex-1 bg-border/20" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted/40">
              Creature senza discendenza
            </span>
            <div className="h-[1px] flex-1 bg-border/20" />
          </div>
          <div className="flex flex-wrap items-start justify-center gap-4 rounded-xl border border-border/15 bg-surface/20 p-4">
            {soloFounders.map((creature) => (
              <CreatureNode key={creature.id} creature={creature} size={55} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
