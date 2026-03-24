// ---------------------------------------------------------------------------
// Mutagenix – Creature Wellness System
// ---------------------------------------------------------------------------
// Pure computation of creature wellness indicators.
// No database, no side effects.
// ---------------------------------------------------------------------------

import { TIME_CONFIG } from './time-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WellnessInput {
  /** Timestamp of most recent injection */
  lastInjectionAt: Date | null;
  /** Number of injections in the recent activity window */
  recentInjectionCount: number;
  /** Timestamp of most recent arena battle */
  lastBattleAt: Date | null;
  /** Battles fought today */
  battlesToday: number;
  /** Current timestamp */
  now: Date;
}

export interface WellnessState {
  /** 0-100: how active/engaged the creature is (injection frequency) */
  activity: number;
  /** 0-100: how well-fed (100 = just fed, 0 = starving) */
  hunger: number;
  /** 0-100: how entertained (100 = just fought, 0 = very bored) */
  boredom: number;
  /** 0-100: how rested (100 = fresh, 0 = exhausted from too many fights) */
  fatigue: number;
  /** 0-100: overall wellness average */
  composite: number;
}

export interface WellnessCombatModifiers {
  attackMul: number;
  defenseMul: number;
  speedMul: number;
  staminaMul: number;
  specialAttackMul: number;
}

// ---------------------------------------------------------------------------
// Time windows (adjust for dev mode)
// ---------------------------------------------------------------------------

function getTimeScale(): number {
  // In dev mode, compress time windows: 8h mutation becomes 60s → ratio 480x
  return TIME_CONFIG.isDevMode ? 480 : 1;
}

/** Hunger: decays over 24h in prod (3 min in dev) */
function getHungerWindowMs(): number {
  return (24 * 60 * 60 * 1000) / getTimeScale();
}

/** Activity: window of 72h in prod (9 min in dev) */
function getActivityWindowMs(): number {
  return (72 * 60 * 60 * 1000) / getTimeScale();
}

/** Boredom: decays over 48h in prod (6 min in dev) */
function getBoredomWindowMs(): number {
  return (48 * 60 * 60 * 1000) / getTimeScale();
}

// ---------------------------------------------------------------------------
// Wellness calculation
// ---------------------------------------------------------------------------

export function calculateWellness(input: WellnessInput): WellnessState {
  const { lastInjectionAt, recentInjectionCount, lastBattleAt, battlesToday, now } = input;

  // --- Hunger: time since last injection ---
  let hunger = 100;
  if (lastInjectionAt) {
    const elapsed = now.getTime() - lastInjectionAt.getTime();
    const ratio = Math.min(1, elapsed / getHungerWindowMs());
    hunger = Math.round(100 * (1 - ratio));
  } else {
    hunger = 0; // never injected = starving
  }

  // --- Activity: injection frequency in recent window ---
  // 3 injections in window = 100, scales linearly
  const activity = Math.min(100, Math.round(recentInjectionCount * 33.33));

  // --- Boredom: time since last battle ---
  let boredom = 100;
  if (lastBattleAt) {
    const elapsed = now.getTime() - lastBattleAt.getTime();
    const ratio = Math.min(1, elapsed / getBoredomWindowMs());
    boredom = Math.round(100 * (1 - ratio));
  } else {
    // Never fought = moderately bored (not critical since young creatures don't fight)
    boredom = 40;
  }

  // --- Fatigue: based on battles today (0-10 scale) ---
  // 0 battles = 100 (fresh), 8+ = very tired
  const fatigue = Math.max(0, Math.round(100 - battlesToday * 12));

  // --- Composite ---
  const composite = Math.round((activity + hunger + boredom + fatigue) / 4);

  return {
    activity: clamp(activity),
    hunger: clamp(hunger),
    boredom: clamp(boredom),
    fatigue: clamp(fatigue),
    composite: clamp(composite),
  };
}

// ---------------------------------------------------------------------------
// Combat modifiers from wellness
// ---------------------------------------------------------------------------

export function calculateWellnessCombatModifiers(wellness: WellnessState): WellnessCombatModifiers {
  let attackMul = 1;
  let defenseMul = 1;
  let speedMul = 1;
  let staminaMul = 1;
  let specialAttackMul = 1;

  // Hunger penalties
  if (wellness.hunger < 20) {
    // Starving: heavy penalties
    attackMul *= 0.85;
    speedMul *= 0.90;
    defenseMul *= 0.95;
  } else if (wellness.hunger < 50) {
    // Hungry: moderate penalties
    attackMul *= 0.95;
    speedMul *= 0.95;
  }

  // Boredom penalties
  if (wellness.boredom < 30) {
    // Very bored: lacks motivation
    speedMul *= 0.95;
    specialAttackMul *= 0.90;
  }

  // Activity penalties
  if (wellness.activity < 30) {
    // Inactive: everything suffers
    attackMul *= 0.90;
    defenseMul *= 0.90;
    speedMul *= 0.90;
    staminaMul *= 0.90;
    specialAttackMul *= 0.90;
  }

  // Fatigue penalties
  if (wellness.fatigue < 20) {
    // Exhausted (8+ battles)
    attackMul *= 0.85;
    staminaMul *= 0.80;
    speedMul *= 0.90;
  } else if (wellness.fatigue < 40) {
    // Tired (5-7 battles)
    attackMul *= 0.95;
    staminaMul *= 0.90;
  }

  return { attackMul, defenseMul, speedMul, staminaMul, specialAttackMul };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * Get wellness level label for display.
 */
export function getWellnessLabel(value: number): 'ottimo' | 'buono' | 'discreto' | 'scarso' | 'critico' {
  if (value >= 80) return 'ottimo';
  if (value >= 60) return 'buono';
  if (value >= 40) return 'discreto';
  if (value >= 20) return 'scarso';
  return 'critico';
}
