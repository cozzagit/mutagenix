'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
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

interface PositionedCreature {
  creature: LaboratoriCreature;
  x: number;
  y: number;
  size: number;
}

interface Connection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isParentChild: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCreatureGlowColor(creature: LaboratoriCreature): string {
  const gen = creature.familyGeneration ?? 1;
  if (gen === 1) return '#3d5afe';
  if (gen === 2) return '#b26eff';
  return '#00e5a0';
}

// ---------------------------------------------------------------------------
// Layout — cluster creatures by owner, ring by generation
// ---------------------------------------------------------------------------

function calculateLayout(
  creatures: LaboratoriCreature[],
  containerWidth: number,
): PositionedCreature[] {
  // Group by owner
  const groups = new Map<string, LaboratoriCreature[]>();
  for (const c of creatures) {
    const arr = groups.get(c.ownerName) ?? [];
    arr.push(c);
    groups.set(c.ownerName, arr);
  }

  const groupArray = Array.from(groups.entries());
  const cols = Math.min(groupArray.length, 3);
  const cellWidth = Math.max(containerWidth / cols, 280);
  const cellHeight = 380;

  const positions: PositionedCreature[] = [];

  groupArray.forEach(([, groupCreatures], groupIdx) => {
    const col = groupIdx % cols;
    const row = Math.floor(groupIdx / cols);
    const centerX = col * cellWidth + cellWidth / 2;
    const centerY = row * cellHeight + cellHeight / 2 + 30;

    // Sort: founders first (gen 1, oldest), then gen 2, then gen 3+
    const sorted = [...groupCreatures].sort((a, b) => {
      const genA = a.familyGeneration ?? 1;
      const genB = b.familyGeneration ?? 1;
      if (genA !== genB) return genA - genB;
      return b.ageDays - a.ageDays;
    });

    sorted.forEach((creature, i) => {
      const gen = creature.familyGeneration ?? 1;
      const size = gen === 1 ? 90 : gen === 2 ? 70 : 55;

      if (i === 0) {
        // Founder at center
        positions.push({ creature, x: centerX, y: centerY - 30, size });
      } else {
        // Others in a ring around center
        const sameGenCreatures = sorted.filter(
          (c) => (c.familyGeneration ?? 1) === gen,
        );
        const idxInGen = sameGenCreatures.indexOf(creature);
        const totalInGen = sameGenCreatures.length;
        const angle =
          (idxInGen / Math.max(totalInGen, 1)) * Math.PI * 2 - Math.PI / 2;
        const radius = gen === 2 ? 110 : gen === 3 ? 170 : 130 + gen * 20;

        positions.push({
          creature,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          size,
        });
      }
    });
  });

  return positions;
}

// ---------------------------------------------------------------------------
// Connections — parent-child lines
// ---------------------------------------------------------------------------

function calculateConnections(
  positions: PositionedCreature[],
): Connection[] {
  const connections: Connection[] = [];
  const nameMap = new Map<string, PositionedCreature>();
  for (const p of positions) {
    nameMap.set(p.creature.name, p);
  }

  for (const pos of positions) {
    const c = pos.creature;
    if (!c.parentNames) continue;

    if (c.parentNames.parentA) {
      const parentPos = nameMap.get(c.parentNames.parentA);
      if (parentPos) {
        connections.push({
          x1: pos.x,
          y1: pos.y,
          x2: parentPos.x,
          y2: parentPos.y,
          isParentChild: true,
        });
      }
    }

    if (c.parentNames.parentB) {
      const parentPos = nameMap.get(c.parentNames.parentB);
      if (parentPos) {
        connections.push({
          x1: pos.x,
          y1: pos.y,
          x2: parentPos.x,
          y2: parentPos.y,
          isParentChild: true,
        });
      }
    }
  }

  return connections;
}

// ---------------------------------------------------------------------------
// Creature Node
// ---------------------------------------------------------------------------

function CreatureNode({
  creature,
  x,
  y,
  size,
}: {
  creature: LaboratoriCreature;
  x: number;
  y: number;
  size: number;
}) {
  const vp = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  const isDead = creature.wellness?.composite === 0;
  const glowColor = getCreatureGlowColor(creature);

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Glow ring behind creature */}
      <div
        className="absolute rounded-full"
        style={{
          width: size + 24,
          height: size + 24,
          left: -(size + 24 - size) / 2,
          top: -(size + 24 - size) / 2,
          background: `radial-gradient(circle, ${glowColor}22 0%, transparent 70%)`,
        }}
      />

      {/* Creature SVG */}
      <div className={isDead ? 'grayscale opacity-40' : ''}>
        <CreatureRenderer params={vp} size={size} animated={false} seed={42} />
      </div>

      {/* Name tag */}
      <span
        className="mt-0.5 max-w-[80px] truncate text-center text-[9px] font-bold text-foreground/80"
        title={creature.name}
      >
        {creature.name}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StirpiView — Main Component
// ---------------------------------------------------------------------------

export function StirpiView({ creatures: allCreatures }: StirpiViewProps) {
  // Filter: only show creatures that are part of a family (have parents or children)
  const creatures = useMemo(() => {
    const parentNames = new Set<string>();
    const childNames = new Set<string>();
    for (const c of allCreatures) {
      if (c.parentNames?.parentA) parentNames.add(c.parentNames.parentA);
      if (c.parentNames?.parentB) parentNames.add(c.parentNames.parentB);
      if (c.parentNames?.parentA || c.parentNames?.parentB) childNames.add(c.name);
    }
    // Include creature if it's a parent of someone OR is a child of someone
    return allCreatures.filter(c => parentNames.has(c.name) || childNames.has(c.name));
  }, [allCreatures]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const positions = useMemo(
    () => calculateLayout(creatures, containerWidth),
    [creatures, containerWidth],
  );
  const connections = useMemo(
    () => calculateConnections(positions),
    [positions],
  );

  // Group labels
  const groups = useMemo(() => {
    const map = new Map<string, LaboratoriCreature[]>();
    for (const c of creatures) {
      const arr = map.get(c.ownerName) ?? [];
      arr.push(c);
      map.set(c.ownerName, arr);
    }
    return map;
  }, [creatures]);

  const cols = Math.min(groups.size, 3);
  const cellWidth = Math.max(containerWidth / cols, 280);
  const rows = Math.ceil(groups.size / cols);
  const canvasHeight = Math.max(rows * 380 + 100, 500);
  const canvasWidth = cellWidth * cols;

  if (creatures.length === 0) {
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
        <p className="text-sm text-muted/50">Nessun campione trovato</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto rounded-2xl border border-[#8a9a70]/15 bg-background"
      style={{
        minHeight: canvasHeight,
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(180, 200, 160, 0.04) 0%, transparent 60%)',
      }}
    >
      {/* Group labels */}
      {Array.from(groups.entries()).map(([ownerName], groupIdx) => {
        const col = groupIdx % cols;
        const row = Math.floor(groupIdx / cols);
        return (
          <div
            key={ownerName}
            className="absolute text-center"
            style={{
              left: col * cellWidth,
              top: row * 380 + 14,
              width: cellWidth,
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted/50">
              Dr. {ownerName}
            </span>
          </div>
        );
      })}

      {/* Connection lines */}
      <svg
        className="pointer-events-none absolute inset-0"
        width={canvasWidth}
        height={canvasHeight}
      >
        <defs>
          <linearGradient id="breedLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b26eff" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#ff69b4" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#b26eff" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {connections.map((conn, i) => (
          <line
            key={i}
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke="url(#breedLine)"
            strokeWidth={1.5}
            opacity={0.5}
            strokeDasharray={conn.isParentChild ? 'none' : '6 3'}
          />
        ))}
      </svg>

      {/* Creature nodes */}
      {positions.map((pos) => (
        <CreatureNode
          key={pos.creature.id}
          creature={pos.creature}
          x={pos.x}
          y={pos.y}
          size={pos.size}
        />
      ))}
    </div>
  );
}
