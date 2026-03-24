// ---------------------------------------------------------------------------
// Mutagenix – Cariche API
// ---------------------------------------------------------------------------
// GET /api/cariche — returns all current active cariche
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { getAllActiveCariche } from '@/lib/game-engine/cariche-loader';
import { CARICHE } from '@/lib/game-engine/constants';

export async function GET() {
  const activeCariche = await getAllActiveCariche();

  // Merge with CARICHE constants for full info
  const result = CARICHE.map((def) => {
    const active = activeCariche.find((a) => a.caricaId === def.id);
    return {
      ...def,
      holder: active
        ? {
            creatureId: active.creatureId,
            userId: active.userId,
            creatureName: active.creatureName,
            ownerName: active.ownerName,
            metricValue: active.metricValue,
            awardedAt: active.awardedAt,
            expiresAt: active.expiresAt,
          }
        : null,
    };
  });

  return NextResponse.json({ data: result });
}
