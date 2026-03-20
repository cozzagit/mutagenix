// ---------------------------------------------------------------------------
// Mutagenix – Shared Game Types
// ---------------------------------------------------------------------------

import type { VisualParams } from '@/lib/game-engine/visual-mapper';

export type { ElementId, TraitId } from '@/lib/game-engine/constants';
export type { VisualParams } from '@/lib/game-engine/visual-mapper';

import type { ElementId, TraitId } from '@/lib/game-engine/constants';

/** Current element concentrations for a creature. */
export type ElementLevels = Record<ElementId, number>;

/** Current trait values (0–100) for a creature. */
export type TraitValues = Record<TraitId, number>;

/** Credits the player chooses to allocate on a given day. */
export type AllocationCredits = Partial<Record<ElementId, number>>;

/** A single entry in the daily mutation log. */
export interface MutationEntry {
  traitId: TraitId;
  oldValue: number;
  newValue: number;
  delta: number;
  triggerType: 'growth' | 'synergy' | 'decay' | 'noise';
  triggerDetails?: string;
}

/** Full snapshot of a creature's state. */
export interface CreatureState {
  elementLevels: ElementLevels;
  traitValues: TraitValues;
  visualParams: VisualParams;
  stability: number;
  ageDays: number;
  generation: number;
}
