import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// GET /api/chat/mentions?q=...&type=player|creature
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim();
  const typeFilter = searchParams.get('type');

  if (!q || q.length < 1) {
    return NextResponse.json({ data: { players: [], creatures: [] } });
  }

  void session;
  const pattern = `%${q}%`;

  try {
    let playerResults: { id: string; displayName: string }[] = [];
    let creatureResults: { id: string; name: string; ownerName: string }[] = [];

    if (!typeFilter || typeFilter === 'player') {
      playerResults = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(sql`${users.displayName} ILIKE ${pattern}`)
        .limit(6);
    }

    if (!typeFilter || typeFilter === 'creature') {
      creatureResults = await db
        .select({
          id: creatures.id,
          name: creatures.name,
          ownerName: users.displayName,
        })
        .from(creatures)
        .innerJoin(users, sql`${creatures.userId} = ${users.id}`)
        .where(sql`${creatures.name} ILIKE ${pattern}`)
        .limit(6);
    }

    return NextResponse.json({
      data: { players: playerResults, creatures: creatureResults },
    });
  } catch (error) {
    console.error('[Chat Mentions] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Errore nella ricerca' } },
      { status: 500 },
    );
  }
}
