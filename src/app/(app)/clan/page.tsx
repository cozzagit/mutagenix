import { getRequiredSession } from '@/lib/auth/get-session';
import { redirect } from 'next/navigation';
import { ClanDashboard } from '@/components/clan/clan-dashboard';

export const dynamic = 'force-dynamic';

export default async function ClanPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  return <ClanDashboard userId={session.userId} />;
}
