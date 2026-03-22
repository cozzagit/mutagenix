import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  creatures,
  allocations,
  dailySnapshots,
  mutationLog,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  ELEMENTS,
  GAME_CONFIG,
  type ElementId,
} from '@/lib/game-engine/constants';
import { getRankTier } from '@/lib/game-engine/battle-engine';
import {
  processDailyMutation,
  type CreatureInput,
} from '@/lib/game-engine/mutation-engine';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';
import { finalizeIfExpired } from '@/lib/game-engine/auto-finalize';

function isValidElementKey(key: string): key is ElementId {
  return (ELEMENTS as readonly string[]).includes(key);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  let body: { creatureId?: string; credits?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Corpo della richiesta non valido' } },
      { status: 400 },
    );
  }

  const { creatureId, credits } = body;

  if (!creatureId || typeof creatureId !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'creatureId richiesto' } },
      { status: 400 },
    );
  }

  if (!credits || typeof credits !== 'object') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'credits richiesto' } },
      { status: 400 },
    );
  }

  // Validate element keys and values
  let totalCredits = 0;
  for (const [key, value] of Object.entries(credits)) {
    if (!isValidElementKey(key)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: `Elemento non valido: ${key}` } },
        { status: 400 },
      );
    }
    if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: `Valore non valido per ${key}` } },
        { status: 400 },
      );
    }
    totalCredits += value;
  }

  if (totalCredits <= 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Devi allocare almeno 1 credito' } },
      { status: 400 },
    );
  }

  // Credit limit check is deferred until after creature is loaded (tier bonus)

  // Fetch creature and verify ownership
  let [creature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, creatureId));

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Creatura non trovata' } },
      { status: 404 },
    );
  }

  if (creature.userId !== session.userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Non sei il proprietario di questa creatura' } },
      { status: 403 },
    );
  }

  if (creature.isArchived) {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'Questa creatura e archiviata' } },
      { status: 409 },
    );
  }

  // Tier-based credit bonus (Immortale +5, Divinità +10)
  const creatureTier = getRankTier(creature.ageDays ?? 0);
  const bonusCredits = creatureTier === 'divine'
    ? GAME_CONFIG.DIVINE_CREDIT_BONUS
    : creatureTier === 'immortal'
      ? GAME_CONFIG.IMMORTAL_CREDIT_BONUS
      : 0;
  const maxCredits = GAME_CONFIG.DAILY_CREDITS + bonusCredits;

  if (totalCredits > maxCredits) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: `Massimo ${maxCredits} crediti al giorno` } },
      { status: 400 },
    );
  }

  // Auto-finalize any expired mutation
  creature = await finalizeIfExpired(creature);

  // Check: can't inject while mutation is in progress
  if (creature.mutationEndsAt && creature.mutationEndsAt.getTime() > Date.now()) {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'Mutazione in corso, attendi il completamento' } },
      { status: 409 },
    );
  }

  // Check cooldown after last mutation completed
  if (creature.updatedAt) {
    const timeSinceUpdate = Date.now() - creature.updatedAt.getTime();
    if (timeSinceUpdate < TIME_CONFIG.COOLDOWN_MS && (creature.ageDays ?? 0) > 0) {
      const remainSec = Math.ceil((TIME_CONFIG.COOLDOWN_MS - timeSinceUpdate) / 1000);
      return NextResponse.json(
        { error: { code: 'COOLDOWN', message: `Cooldown attivo. Riprova tra ${remainSec}s` } },
        { status: 429 },
      );
    }
  }

  // The day number = creature's current ageDays + 1
  const newDay = (creature.ageDays ?? 0) + 1;
  const dayKey = String(newDay);

  // Save allocation
  await db.insert(allocations).values({
    creatureId,
    day: dayKey,
    credits,
    totalCredits,
  });

  // Run mutation engine
  const creatureInput: CreatureInput = {
    id: creature.id,
    elementLevels: creature.elementLevels,
    traitValues: creature.traitValues,
    ageDays: creature.ageDays ?? 0,
    stability: creature.stability ?? 0.5,
    day: newDay,
  };

  const result = processDailyMutation(creatureInput, credits);

  // Set TARGET state — mutation applies gradually
  const now = new Date();
  const mutationEndsAt = new Date(now.getTime() + TIME_CONFIG.getMutationDurationMs());

  await db
    .update(creatures)
    .set({
      targetElementLevels: result.newElementLevels,
      targetTraitValues: result.newTraitValues,
      targetVisualParams: result.newVisualParams as unknown as Record<string, unknown>,
      stability: result.newStability,
      mutationStartedAt: now,
      mutationEndsAt,
      updatedAt: now,
    })
    .where(eq(creatures.id, creatureId));

  // Save daily snapshot
  await db.insert(dailySnapshots).values({
    creatureId,
    day: dayKey,
    elementLevels: result.newElementLevels,
    traitValues: result.newTraitValues,
    visualParams: result.newVisualParams as unknown as Record<string, unknown>,
    stabilityScore: result.newStability,
    mutationsApplied: result.mutations.map((m) => ({
      traitId: m.traitId,
      delta: m.delta,
      trigger: m.triggerType,
    })),
  });

  // Save mutation log entries
  if (result.mutations.length > 0) {
    const triggerTypeMap: Record<string, 'element' | 'synergy' | 'decay' | 'threshold' | 'noise'> = {
      growth: 'element',
      synergy: 'synergy',
      decay: 'decay',
      noise: 'noise',
    };

    await db.insert(mutationLog).values(
      result.mutations.map((m) => ({
        creatureId,
        day: dayKey,
        traitId: m.traitId,
        oldValue: m.oldValue,
        newValue: m.newValue,
        delta: m.delta,
        triggerType: triggerTypeMap[m.triggerType] ?? 'element',
        triggerDetails: m.triggerDetails ?? null,
      })),
    );
  }

  return NextResponse.json({
    data: {
      success: true,
      mutations: result.mutations,
      activeSynergies: result.activeSynergies,
      mutationStartedAt: now.toISOString(),
      mutationEndsAt: mutationEndsAt.toISOString(),
      newDay,
      isDevMode: TIME_CONFIG.isDevMode,
    },
  });
}
