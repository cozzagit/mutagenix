import { getRequiredSession } from '@/lib/auth/get-session';
import { redirect } from 'next/navigation';
import { CarichePage } from '@/components/cariche/cariche-page';

export const dynamic = 'force-dynamic';

export default async function CarichePageRoute() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  return <CarichePage userId={session.userId} />;
}
