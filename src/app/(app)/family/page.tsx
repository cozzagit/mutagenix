import { getRequiredSession } from '@/lib/auth/get-session';
import { redirect } from 'next/navigation';
import { FamilyTreeView } from '@/components/family/family-tree-view';

export const dynamic = 'force-dynamic';

export default async function FamilyPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  return <FamilyTreeView userId={session.userId} />;
}
