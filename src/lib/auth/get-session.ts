import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export type SessionData = {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

export async function getRequiredSession(): Promise<SessionData> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthError('Authentication required', 'UNAUTHORIZED', 401);
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isAdmin: session.user.isAdmin,
  };
}

export function unauthorizedResponse(message = 'Authentication required') {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message } },
    { status: 401 },
  );
}

export function forbiddenResponse(message = 'Insufficient permissions') {
  return NextResponse.json(
    { error: { code: 'FORBIDDEN', message } },
    { status: 403 },
  );
}
