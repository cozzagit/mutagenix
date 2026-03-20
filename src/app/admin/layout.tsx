import { redirect } from 'next/navigation';
import { getRequiredSession } from '@/lib/auth/get-session';
import Link from 'next/link';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/lab');
  }

  if (!session.isAdmin) {
    redirect('/lab');
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-3 border-b border-border/50 bg-surface/80 px-4 backdrop-blur-md">
        <Link
          href="/lab"
          className="flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
          Lab
        </Link>
        <div className="h-4 w-px bg-border/50" />
        <h1
          className="text-sm font-black tracking-tighter text-primary"
          style={{ textShadow: '0 0 12px #3d5afe44' }}
        >
          Admin
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
