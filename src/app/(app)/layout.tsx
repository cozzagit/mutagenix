"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";
import { BattleNotifier } from "@/components/pwa/battle-notifier";

// Increment this on breaking changes to force client refresh
const APP_VERSION = 6;

/* ------------------------------------------------------------------ */
/* Nav items — PRIMARY (always visible in bottom bar)                  */
/* ------------------------------------------------------------------ */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  activeColor?: 'red' | 'blue';
  badgeKey?: string;
}

const PRIMARY_NAV: NavItem[] = [
  {
    href: "/lab",
    label: "Lab",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5m-4.75-11.396c.25.023.5.05.75.082M5 14.5l-1.456 1.456a1.5 1.5 0 0 0 1.06 2.544h14.792a1.5 1.5 0 0 0 1.06-2.544L19 14.5m-14 0h14" />
      </svg>
    ),
  },
  {
    href: "/arena",
    label: "Arena",
    activeColor: 'red',
    badgeKey: 'arena',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3l6 6 6-6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v12" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 3l-6 6-6-6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l-3 3 3 3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 7l3 3-3 3" />
      </svg>
    ),
  },
  {
    href: "/breeding",
    label: "DNA",
    activeColor: 'blue',
    badgeKey: 'breeding',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 4c0 6 8 6 8 12" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 4c0 6-8 6-8 12" />
        <line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round" opacity="0.5" />
        <line x1="8" y1="10" x2="16" y2="10" strokeLinecap="round" opacity="0.5" />
        <line x1="8" y1="13" x2="16" y2="13" strokeLinecap="round" opacity="0.5" />
        <line x1="8" y1="16.5" x2="16" y2="16.5" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    href: "/laboratori",
    label: "Biosfera",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M3 12h18" />
        <path strokeLinecap="round" d="M12 3c-2.5 3-4 6.5-4 9s1.5 6 4 9" />
        <path strokeLinecap="round" d="M12 3c2.5 3 4 6.5 4 9s-1.5 6-4 9" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Nav items — SECONDARY (inside "Altro" menu)                         */
/* ------------------------------------------------------------------ */

const SECONDARY_NAV: NavItem[] = [
  {
    href: "/clan",
    label: "Clan",
    badgeKey: 'clan',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L9 7H4l3.5 5L6 18h4l2 4 2-4h4l-1.5-6L20 7h-5L12 2Z" />
        <circle cx="12" cy="11" r="2" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profilo",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    href: "/lab/log",
    label: "Diario",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: "/cariche",
    label: "Cariche",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.09 6.26L20.18 9.27l-5.09 3.94L16.18 20 12 16.77 7.82 20l1.09-6.79L3.82 9.27l6.09-1.01L12 2Z" />
      </svg>
    ),
  },
  {
    href: "/guida",
    label: "Guida",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01" />
      </svg>
    ),
  },
];

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

/* ------------------------------------------------------------------ */
/* Desktop NavLink                                                     */
/* ------------------------------------------------------------------ */

function NavLink({ item, isActive, badge }: { item: NavItem; isActive: boolean; badge?: number }) {
  const isRed = item.activeColor === 'red';
  const activeClass = isRed
    ? "text-danger [&_svg]:drop-shadow-[0_0_6px_#ff3d3d88]"
    : "text-primary [&_svg]:drop-shadow-[0_0_6px_#3d5afe88]";

  return (
    <Link
      href={item.href}
      className={`focus-ring relative flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        isActive ? activeClass : "text-muted hover:text-foreground"
      }`}
    >
      {item.icon}
      <span className="hidden md:inline">{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile NavLink (with label)                                         */
/* ------------------------------------------------------------------ */

function MobileNavLink({ item, isActive, badge, onClick }: { item: NavItem; isActive: boolean; badge?: number; onClick?: () => void }) {
  const isRed = item.activeColor === 'red';
  const activeClass = isRed
    ? "text-danger [&_svg]:drop-shadow-[0_0_6px_#ff3d3d88]"
    : "text-primary [&_svg]:drop-shadow-[0_0_6px_#3d5afe88]";

  const cls = `focus-ring relative flex flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[9px] font-medium transition-colors [&_svg]:h-[18px] [&_svg]:w-[18px] ${
    isActive ? activeClass : "text-muted hover:text-foreground"
  }`;

  const badgeEl = badge !== undefined && badge > 0 ? (
    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-0.5 text-[8px] font-bold text-white">
      {badge > 9 ? '9+' : badge}
    </span>
  ) : null;

  if (onClick) {
    return (
      <button onClick={onClick} className={cls}>
        {item.icon}
        <span className="leading-none">{item.label}</span>
        {badgeEl}
      </button>
    );
  }

  return (
    <Link href={item.href} className={cls}>
      {item.icon}
      <span className="leading-none">{item.label}</span>
      {badgeEl}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Main Layout                                                         */
/* ------------------------------------------------------------------ */

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [arenaBadge, setArenaBadge] = useState(0);
  const [breedingBadge, setBreedingBadge] = useState(0);
  const [clanBadge, setClanBadge] = useState(0);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const isSecondaryActive = SECONDARY_NAV.some(item => isActive(item.href));

  // Force reload if client has stale version
  useEffect(() => {
    const key = 'mx-app-version';
    const stored = parseInt(localStorage.getItem(key) ?? '0', 10);
    if (stored < APP_VERSION) {
      localStorage.setItem(key, String(APP_VERSION));
      if (stored > 0) {
        window.location.reload();
      }
    }
  }, []);

  // Close more menu on navigation
  useEffect(() => {
    setMoreMenuOpen(false);
  }, [pathname]);

  // Fetch unread arena battles
  useEffect(() => {
    if (isActive("/arena")) { setArenaBadge(0); return; }
    let cancelled = false;
    async function fetchUnread() {
      try {
        const res = await fetch("/api/arena/unread");
        if (!res.ok || cancelled) return;
        const json = await res.json();
        setArenaBadge(json.data?.unseenBattles ?? 0);
      } catch { /* silently ignore */ }
    }
    fetchUnread();
    return () => { cancelled = true; };
  }, [pathname]);

  // Fetch pending breeding requests for badge
  useEffect(() => {
    if (isActive("/breeding")) { setBreedingBadge(0); return; }
    let cancelled = false;
    async function fetchBreedingRequests() {
      try {
        const res = await fetch("/api/breeding/requests");
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const pending = (json.data ?? []).filter((r: { status: string }) => r.status === 'pending');
        setBreedingBadge(pending.length);
      } catch { /* silently ignore */ }
    }
    fetchBreedingRequests();
    return () => { cancelled = true; };
  }, [pathname]);

  // Fetch pending clan invitations for badge
  useEffect(() => {
    if (isActive("/clan")) { setClanBadge(0); return; }
    let cancelled = false;
    async function fetchClanInvites() {
      try {
        const res = await fetch("/api/clan/invitations");
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const inviteCount = (json.data?.invites ?? []).length;
        setClanBadge(inviteCount);
      } catch { /* silently ignore */ }
    }
    fetchClanInvites();
    return () => { cancelled = true; };
  }, [pathname]);

  function getBadge(item: NavItem): number | undefined {
    if (item.badgeKey === 'arena') return arenaBadge;
    if (item.badgeKey === 'breeding') return breedingBadge;
    if (item.badgeKey === 'clan') return clanBadge;
    return undefined;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Desktop: slim top bar (48px) */}
      <header className="hidden h-12 shrink-0 items-center border-b border-border/50 bg-surface/60 px-4 backdrop-blur-md md:flex">
        <Link
          href="/lab"
          className="mr-6 text-sm font-black tracking-tighter text-primary"
          style={{ textShadow: '0 0 12px #3d5afe44' }}
        >
          MX
        </Link>
        <nav className="flex items-center gap-1">
          {ALL_NAV.map((item) => (
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} badge={getBadge(item)} />
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <ToastProvider>{children}</ToastProvider>
      </main>

      <BattleNotifier />

      {/* Mobile: "Altro" popup menu */}
      {moreMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMoreMenuOpen(false)} />
          <div className="fixed bottom-[calc(48px+env(safe-area-inset-bottom,0px))] right-2 z-50 w-44 rounded-xl border border-border/50 bg-surface/95 p-2 shadow-xl shadow-black/30 backdrop-blur-xl md:hidden">
            {SECONDARY_NAV.map((item) => {
              const badge = getBadge(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreMenuOpen(false)}
                  className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                    isActive(item.href) ? 'text-primary bg-primary/10' : 'text-muted hover:text-foreground hover:bg-surface-2'
                  }`}
                >
                  <span className="[&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>
                  {item.label}
                  {badge !== undefined && badge > 0 && (
                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Mobile: fixed bottom nav — 5 items with labels */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border/50 bg-surface/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(52px + env(safe-area-inset-bottom, 0px))' }}
      >
        {PRIMARY_NAV.map((item) => (
          <MobileNavLink key={item.href} item={item} isActive={isActive(item.href)} badge={getBadge(item)} />
        ))}
        {/* "Altro" button */}
        <MobileNavLink
          item={{
            href: '',
            label: 'Altro',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="19" r="1.5" fill="currentColor" />
              </svg>
            ),
          }}
          isActive={isSecondaryActive || moreMenuOpen}
          onClick={() => setMoreMenuOpen(!moreMenuOpen)}
        />
      </nav>
      {/* Spacer for fixed nav */}
      <div className="shrink-0 md:hidden" style={{ height: 'calc(52px + env(safe-area-inset-bottom, 0px))' }} />
    </div>
  );
}
