import { getRequiredSession } from '@/lib/auth/get-session';
import { redirect } from 'next/navigation';
import { OffspringReveal } from '@/components/breeding/offspring-reveal';

export const dynamic = 'force-dynamic';

export default async function RevealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await getRequiredSession();
  } catch {
    redirect('/login');
  }

  const { id } = await params;

  return <OffspringReveal breedingId={id} />;
}
