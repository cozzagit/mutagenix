'use client';

import { useState } from 'react';
import { useInstallPrompt } from '@/hooks/use-install-prompt';

/* ------------------------------------------------------------------ */
/* iOS instructions modal                                              */
/* ------------------------------------------------------------------ */

function IOSModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 mx-3 mb-3 w-full max-w-sm rounded-2xl border border-border/50 bg-surface p-5 shadow-2xl sm:mb-0">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="mb-3 text-base font-bold text-foreground">
          Installa Mutagenix
        </h3>

        <ol className="flex flex-col gap-3 text-sm text-muted">
          <li className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              1
            </span>
            <span>
              Tocca l&apos;icona{' '}
              <span className="inline-flex items-center gap-0.5 font-semibold text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="inline h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M12 1.5v12m0-12 3 3m-3-3-3 3" />
                </svg>
                Condividi
              </span>{' '}
              nella barra di Safari
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              2
            </span>
            <span>
              Scorri e tocca{' '}
              <span className="font-semibold text-foreground">
                &quot;Aggiungi alla schermata Home&quot;
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              3
            </span>
            <span>
              Conferma toccando{' '}
              <span className="font-semibold text-foreground">&quot;Aggiungi&quot;</span>
            </span>
          </li>
        </ol>

        <p className="mt-4 text-center text-[11px] text-muted">
          L&apos;app si aprirà a schermo intero, come un&apos;app nativa.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Download icon SVG                                                   */
/* ------------------------------------------------------------------ */

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* InstallButton                                                       */
/* ------------------------------------------------------------------ */

export function InstallButton({
  variant = 'landing',
}: {
  variant?: 'landing' | 'badge';
}) {
  const { canInstall, isIOS, isInstalled, install } = useInstallPrompt();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) return null;

  /* ---- Badge variant (lab page — floating, mobile only) ---- */
  if (variant === 'badge') {
    if (!canInstall && !isIOS) return null;

    return (
      <>
        <button
          onClick={isIOS ? () => setShowIOSModal(true) : install}
          className="fixed bottom-16 right-3 z-30 flex items-center gap-1.5 rounded-full border border-primary/30 bg-surface/90 px-3 py-1.5 text-[10px] font-semibold text-primary shadow-lg backdrop-blur-md transition-all active:scale-90 md:hidden"
          style={{ boxShadow: '0 0 12px #3d5afe22' }}
        >
          <PlusCircleIcon className="h-3.5 w-3.5" />
          Installa App
        </button>

        {showIOSModal && <IOSModal onClose={() => setShowIOSModal(false)} />}
      </>
    );
  }

  /* ---- Landing variant ---- */

  if (canInstall) {
    return (
      <button
        onClick={install}
        className="focus-ring inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-6 text-sm font-semibold text-accent transition-all hover:bg-accent/20 active:scale-[0.97]"
      >
        <DownloadIcon className="h-4 w-4" />
        Installa App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className="focus-ring inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-6 text-sm font-semibold text-accent transition-all hover:bg-accent/20 active:scale-[0.97]"
        >
          <DownloadIcon className="h-4 w-4" />
          Installa App
        </button>

        {showIOSModal && <IOSModal onClose={() => setShowIOSModal(false)} />}
      </>
    );
  }

  return null;
}
