// ---------------------------------------------------------------------------
// Mutagenix – Shared Game Types
// ---------------------------------------------------------------------------

import type { VisualParams } from '@/lib/game-engine/visual-mapper';

export type { ElementId, TraitId, CombatTraitId } from '@/lib/game-engine/constants';
export type { VisualParams } from '@/lib/game-engine/visual-mapper';

import type { ElementId, TraitId, CombatTraitId } from '@/lib/game-engine/constants';

/** Current element concentrations for a creature. */
export type ElementLevels = Record<ElementId, number>;

/** Current trait values (0–100) for a creature, including combat traits. */
export type TraitValues = Record<TraitId, number> & Record<CombatTraitId, number>;

/** Credits the player chooses to allocate on a given day. */
export type AllocationCredits = Partial<Record<ElementId, number>>;

/** A single entry in the daily mutation log. */
export interface MutationEntry {
  traitId: TraitId | CombatTraitId;
  oldValue: number;
  newValue: number;
  delta: number;
  triggerType: 'growth' | 'synergy' | 'decay' | 'noise' | 'combat';
  triggerDetails?: string;
}

/** Combat trait values for warrior phase creatures. */
export type CombatTraitValues = Record<CombatTraitId, number>;

/** Full snapshot of a creature's state. */
export interface CreatureState {
  elementLevels: ElementLevels;
  traitValues: TraitValues;
  visualParams: VisualParams;
  stability: number;
  ageDays: number;
  generation: number;
}
