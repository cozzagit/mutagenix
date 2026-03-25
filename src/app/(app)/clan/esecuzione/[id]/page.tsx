import { EsecuzioneScene } from '@/components/clan/esecuzione-scene';

export const dynamic = 'force-dynamic';

export default async function EsecuzionePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EsecuzioneScene betrayalId={id} />;
}
