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

interface BreedingEvent {
  id: string;
  parent1: LaboratoriCreature;
  parent2: LaboratoriCreature;
  children: LaboratoriCreature[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGenColor(gen: number): string {
  if (gen === 1) return '#3d5afe';
  if (gen === 2) return '#b26eff';
  return '#00e5a0';
}

/** Build breeding events from the creature list. */
function buildBreedingEvents(creatures: LaboratoriCreature[]): BreedingEvent[] {
  // Name -> creature map
  const nameMap = new Map<string, LaboratoriCreature>();
  for (const c of creatures) {
    nameMap.set(c.name, c);
  }

  // Find all children (creatures with both parents set)
  const children = creatures.filter(
    (c) => c.parentNames?.parentA && c.parentNames?.parentB,
  );

  // Group children by parent pair (sorted parent names as key)
  const breedingGroups = new Map<string, LaboratoriCreature[]>();
  for (const child of children) {
    const key = [child.parentNames!.parentA!, child.parentNames!.parentB!]
      .sort()
      .join('|');
    const arr = breedingGroups.get(key) ?? [];
    arr.push(child);
    breedingGroups.set(key, arr);
  }

  // Build events
  const events: BreedingEvent[] = [];
  for (const [key, groupChildren] of breedingGroups) {
    const [p1Name, p2Name] = key.split('|');
    const parent1 = nameMap.get(p1Name);
    const parent2 = nameMap.get(p2Name);
    if (!parent1 || !parent2) continue;

    // Each breeding attempt typically produces 2 children.
    // If the same pair bred multiple times, chunk into pairs.
    for (let i = 0; i < groupChildren.length; i += 2) {
      const chunk = groupChildren.slice(i, i + 2);
      events.push({
        id: `${key}:${i}`,
        parent1,
        parent2,
        children: chunk,
      });
    }
  }

  // Sort events: earliest children first (oldest breeding events first)
  events.sort((a, b) => {
    const ageA = Math.max(...a.children.map((c) => c.ageDays));
    const ageB = Math.max(...b.children.map((c) => c.ageDays));
    return ageB - ageA; // oldest first
  });

  return events;
}

/** Find creatures that have never bred (no children reference them as parent). */
function findSoloFounders(creatures: LaboratoriCreature[]): LaboratoriCreature[] {
  const parentNames = new Set<string>();
  for (const c of creatures) {
    if (c.parentNames?.parentA) parentNames.add(c.parentNames.parentA);
    if (c.parentNames?.parentB) parentNames.add(c.parentNames.parentB);
  }

  // Founders: gen 1, not a parent of anyone, and have no parents themselves
  return creatures.filter(
    (c) =>
      (c.familyGeneration ?? 1) === 1 &&
      !parentNames.has(c.name) &&
      !c.parentNames?.parentA &&
      !c.parentNames?.parentB,
  );
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
  const isDead = creature.wellness?.composite === 0 || creature.isDead;

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
        <div className={isDead ? 'grayscale opacity-40' : ''}>
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
      <p className="text-[8px] text-muted">Dr. {creature.ownerName}</p>
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

function DnaConnector() {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <div className="flex items-center gap-1">
        <div className="h-[2px] w-6 bg-gradient-to-r from-transparent to-pink-400/60" />
        <span className="text-xs text-pink-400">&#9829;</span>
        <div className="h-[2px] w-6 bg-gradient-to-r from-pink-400/60 to-transparent" />
      </div>
      <span className="text-[7px] font-bold text-pink-400/40">DNA</span>
    </div>
  );
}

function BreedingEventCard({ event }: { event: BreedingEvent }) {
  // Figure out which child belongs to which parent's owner
  const child1 =
    event.children.find((c) => c.ownerName === event.parent1.ownerName) ??
    event.children[0] ??
    null;
  const child2 =
    event.children.find(
      (c) => c.ownerName === event.parent2.ownerName && c !== child1,
    ) ??
    (event.children.length > 1
      ? event.children.find((c) => c !== child1) ?? null
      : null);

  return (
    <div className="rounded-2xl border border-border/30 bg-surface/40 p-4 sm:p-6">
      {/* Parents row */}
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <CreatureNode creature={event.parent1} size={80} />
        <DnaConnector />
        <CreatureNode creature={event.parent2} size={80} />
      </div>

      {/* Descent lines */}
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center gap-12 sm:gap-16">
          {child1 && (
            <div className="h-8 w-[2px] bg-gradient-to-b from-bio-purple/50 to-bio-purple/20" />
          )}
          {child2 && (
            <div className="h-8 w-[2px] border-l-2 border-dashed border-border/30 bg-gradient-to-b from-bio-purple/50 to-bio-purple/20" />
          )}
        </div>
      </div>

      {/* Children row */}
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {child1 && <CreatureNode creature={child1} size={65} />}
        {child1 && child2 && (
          <span className="text-[9px] text-muted/30">&amp;</span>
        )}
        {child2 && <CreatureNode creature={child2} size={65} />}
        {!child1 && !child2 && (
          <p className="text-[9px] italic text-muted/40">
            Prole non trovata
          </p>
        )}
      </div>
    </div>
  );
}

/** Detect multi-generation chains: if a child from one event is a parent in another. */
function findChainedEvents(events: BreedingEvent[]): Map<string, string[]> {
  // Map: event id -> list of event ids that follow (child became parent)
  const chains = new Map<string, string[]>();

  // Build a lookup: creature name -> events where it is a parent
  const parentInEvent = new Map<string, string[]>();
  for (const ev of events) {
    for (const name of [ev.parent1.name, ev.parent2.name]) {
      const arr = parentInEvent.get(name) ?? [];
      arr.push(ev.id);
      parentInEvent.set(name, arr);
    }
  }

  for (const ev of events) {
    const downstream: string[] = [];
    for (const child of ev.children) {
      const nextEvents = parentInEvent.get(child.name);
      if (nextEvents) {
        downstream.push(...nextEvents);
      }
    }
    if (downstream.length > 0) {
      chains.set(ev.id, downstream);
    }
  }

  return chains;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function StirpiView({ creatures: allCreatures }: StirpiViewProps) {
  const events = useMemo(
    () => buildBreedingEvents(allCreatures),
    [allCreatures],
  );

  const soloFounders = useMemo(
    () => findSoloFounders(allCreatures),
    [allCreatures],
  );

  const chains = useMemo(() => findChainedEvents(events), [events]);

  // Group events into chains for visual rendering.
  // An event that is "downstream" of another gets rendered after it with a connector.
  const renderedEventIds = new Set<string>();

  /** Recursively render an event and its downstream events. */
  function renderEventChain(eventId: string): React.ReactNode[] {
    if (renderedEventIds.has(eventId)) return [];
    renderedEventIds.add(eventId);

    const event = events.find((e) => e.id === eventId);
    if (!event) return [];

    const nodes: React.ReactNode[] = [
      <BreedingEventCard key={event.id} event={event} />,
    ];

    const downstream = chains.get(eventId);
    if (downstream) {
      for (const nextId of downstream) {
        if (renderedEventIds.has(nextId)) continue;
        // Chain connector
        nodes.push(
          <div
            key={`chain-${eventId}-${nextId}`}
            className="flex justify-center py-1"
          >
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-6 w-[2px] bg-gradient-to-b from-bio-purple/40 to-bio-purple/15" />
              <span className="text-[7px] font-bold uppercase tracking-widest text-muted/30">
                Gen successiva
              </span>
              <div className="h-4 w-[2px] bg-gradient-to-b from-bio-purple/15 to-transparent" />
            </div>
          </div>,
        );
        nodes.push(...renderEventChain(nextId));
      }
    }

    return nodes;
  }

  // Empty state
  if (events.length === 0 && soloFounders.length === 0) {
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

  // Render all event chains
  const chainNodes: React.ReactNode[] = [];
  for (const event of events) {
    if (!renderedEventIds.has(event.id)) {
      chainNodes.push(...renderEventChain(event.id));
    }
  }

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
          Incroci Genetici
        </h3>
        <span className="rounded-full bg-bio-purple/10 px-2 py-0.5 text-[9px] font-bold text-bio-purple/60">
          {events.length} {events.length === 1 ? 'incrocio' : 'incroci'}
        </span>
      </div>

      {/* Breeding event cards */}
      <div className="flex flex-col gap-4">{chainNodes}</div>

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
