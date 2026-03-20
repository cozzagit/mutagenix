import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, creatures, DEFAULT_ELEMENT_LEVELS, DEFAULT_TRAIT_VALUES } from '@/lib/db/schema';

interface RegisterBody {
  email: string;
  displayName: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterBody;

    // Validate input
    if (!body.email || !body.displayName || !body.password) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Email, displayName, and password are required' } },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const displayName = body.displayName.trim();
    const password = body.password;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 },
      );
    }

    if (displayName.length < 2 || displayName.length > 50) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Display name must be between 2 and 50 characters' } },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } },
        { status: 400 },
      );
    }

    // Check if user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'An account with this email already exists' } },
        { status: 409 },
      );
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await hash(password, 12);

    // Create user and creature in a transaction
    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email,
          displayName,
          passwordHash,
        })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          createdAt: users.createdAt,
        });

      const [newCreature] = await tx
        .insert(creatures)
        .values({
          userId: newUser.id,
          name: 'Specimen-001',
          elementLevels: DEFAULT_ELEMENT_LEVELS,
          traitValues: DEFAULT_TRAIT_VALUES,
          visualParams: {},
        })
        .returning({
          id: creatures.id,
          name: creatures.name,
        });

      return { user: newUser, creature: newCreature };
    });

    return NextResponse.json(
      {
        data: {
          user: result.user,
          creature: result.creature,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred during registration' } },
      { status: 500 },
    );
  }
}
