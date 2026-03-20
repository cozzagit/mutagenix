import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { ExperimentGallery } from '@/components/lab/experiment-gallery';

export const dynamic = 'force-dynamic';

export default async function BachecaPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  // Fetch ALL creatures for this user (active + archived), ordered by creation date
  const allCreatures = await db
    .select()
    .from(creatures)
    .where(eq(creatures.userId, session.userId))
    .orderBy(asc(creatures.createdAt));

  if (allCreatures.length === 0) redirect('/lab');

  // Serialize for client component
  const serialized = allCreatures.map((c) => ({
    id: c.id,
    name: c.name,
    generation: c.generation ?? 1,
    ageDays: c.ageDays ?? 0,
    stability: c.stability ?? 0.5,
    elementLevels: c.elementLevels as Record<string, number>,
    traitValues: c.traitValues as Record<string, number>,
    visualParams: c.visualParams as Record<string, unknown>,
    isArchived: c.isArchived,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    archiveReason: c.archiveReason,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-foreground">
          Bacheca degli Esperimenti
        </h1>
        <p className="mt-1 text-xs text-muted">
          Ogni creatura che hai creato. Nulla viene mai cancellato.
        </p>
      </div>
      <ExperimentGallery experiments={serialized} />
    </div>
  );
}
