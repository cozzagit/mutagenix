import { getRequiredSession } from '@/lib/auth/get-session';
import { redirect } from 'next/navigation';
import { BreedingHub } from '@/components/breeding/breeding-hub';

export const dynamic = 'force-dynamic';

export default async function BreedingPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  return <BreedingHub userId={session.userId} />;
}
