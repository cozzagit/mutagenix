import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

  const [creature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.userId, session.userId));

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
