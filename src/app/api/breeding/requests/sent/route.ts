import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { breedingRequests, creatures, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const requests = await db
    .select({
      request: breedingRequests,
      targetCreatureName: creatures.name,
      targetOwnerName: users.displayName,
    })
    .from(breedingRequests)
    .innerJoin(creatures, eq(breedingRequests.targetCreatureId, creatures.id))
    .innerJoin(users, eq(breedingRequests.targetId, users.id))
    .where(eq(breedingRequests.requesterId, session.userId))
    .orderBy(desc(breedingRequests.createdAt));

  const results = requests.map((r) => ({
    id: r.request.id,
    status: r.request.status,
    energyCost: r.request.energyCost,
    expiresAt: r.request.expiresAt.toISOString(),
    createdAt: r.request.createdAt.toISOString(),
    targetCreatureName: r.targetCreatureName,
    targetOwnerName: r.targetOwnerName,
  }));

  return NextResponse.json({ data: results });
}
