import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { ProfileView } from '@/components/profile/profile-view';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user) redirect('/login');

  const [activeUser] = await db.select({ activeCreatureId: users.activeCreatureId })
    .from(users).where(eq(users.id, session.userId));

  const [creature] = activeUser?.activeCreatureId
    ? await db.select().from(creatures).where(eq(creatures.id, activeUser.activeCreatureId))
    : await db.select().from(creatures)
        .where(and(eq(creatures.userId, session.userId), eq(creatures.isArchived, false)));

  return (
    <ProfileView
      user={{
        displayName: user.displayName,
        email: user.email,
        streak: user.streak ?? 0,
        createdAt: user.createdAt.toISOString(),
        isAdmin: user.isAdmin ?? false,
      }}
      creature={
        creature
          ? {
              name: creature.name,
              ageDays: creature.ageDays ?? 0,
              generation: creature.generation ?? 1,
              stability: creature.stability ?? 0.5,
            }
          : null
      }
    />
  );
}
