import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { breedingRequests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: requestId } = await params;

  const [breedingRequest] = await db
    .select()
    .from(breedingRequests)
    .where(eq(breedingRequests.id, requestId));

  if (!breedingRequest) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Richiesta di riproduzione non trovata.' } },
      { status: 404 },
    );
  }

  if (breedingRequest.targetId !== session.userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Non sei il destinatario di questa richiesta.' } },
      { status: 403 },
    );
  }

  if (breedingRequest.status !== 'pending') {
    return NextResponse.json(
      { error: { code: 'INVALID_STATUS', message: 'Questa richiesta non è più in sospeso.' } },
      { status: 422 },
    );
  }

  await db
    .update(breedingRequests)
    .set({ status: 'rejected', respondedAt: new Date() })
    .where(eq(breedingRequests.id, requestId));

  return NextResponse.json({ data: { success: true } });
}
