import { getRequiredSession } from '@/lib/auth/get-session';
import { redirect } from 'next/navigation';
import { ClanLeaderboard } from '@/components/clan/clan-leaderboard';

export const dynamic = 'force-dynamic';

export default async function ClansPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  return <ClanLeaderboard userId={session.userId} />;
}
