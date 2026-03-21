"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";
import { BattleNotifier } from "@/components/pwa/battle-notifier";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavItemExt extends NavItem {
  activeColor?: 'red' | 'blue';
  badgeKey?: string; // key for badge counter
}

const NAV_ITEMS: NavItemExt[] = [
  {
    href: "/lab",
    label: "Lab",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5m-4.75-11.396c.25.023.5.05.75.082M5 14.5l-1.456 1.456a1.5 1.5 0 0 0 1.06 2.544h14.792a1.5 1.5 0 0 0 1.06-2.544L19 14.5m-14 0h14"
        />
      </svg>
    ),
  },
  {
    href: "/lab/log",
    label: "Diario",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
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
    href: "/laboratori",
    label: "Laboratori",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        {/* Beaker / labs icon */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5m-4.75-11.396c.25.023.5.05.75.082M5 14.5l-1.456 1.456a1.5 1.5 0 0 0 1.06 2.544h14.792a1.5 1.5 0 0 0 1.06-2.544L19 14.5m-14 0h14"
        />
        <circle cx="10" cy="17" r="1" fill="currentColor" opacity="0.5" />
        <circle cx="14" cy="16" r="0.8" fill="currentColor" opacity="0.4" />
        <circle cx="12" cy="18" r="0.6" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
];

function NavLink({ item, isActive, badge }: { item: NavItemExt; isActive: boolean; badge?: number }) {
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
      {item.label && <span className="hidden md:inline">{item.label}</span>}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

function MobileNavLink({ item, isActive, badge }: { item: NavItemExt; isActive: boolean; badge?: number }) {
  const isRed = item.activeColor === 'red';
  const activeClass = isRed
    ? "text-danger [&_svg]:drop-shadow-[0_0_6px_#ff3d3d88]"
    : "text-primary [&_svg]:drop-shadow-[0_0_6px_#3d5afe88]";

  return (
    <Link
      href={item.href}
      className={`focus-ring relative flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-[9px] font-medium transition-colors [&_svg]:h-4 [&_svg]:w-4 ${
        isActive ? activeClass : "text-muted hover:text-foreground"
      }`}
    >
      {item.icon}
      <span>{item.label || "Settings"}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-0.5 text-[8px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [arenaBadge, setArenaBadge] = useState(0);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Fetch unread arena battles on mount and when not on arena page
  useEffect(() => {
    if (isActive("/arena")) {
      setArenaBadge(0);
      return;
    }

    let cancelled = false;
    async function fetchUnread() {
      try {
        const res = await fetch("/api/arena/unread");
        if (!res.ok || cancelled) return;
        const json = await res.json();
        setArenaBadge(json.data?.unseenBattles ?? 0);
      } catch {
        // silently ignore
      }
    }
    fetchUnread();
    return () => { cancelled = true; };
  }, [pathname]);

  function getBadge(item: NavItemExt): number | undefined {
    if (item.badgeKey === 'arena') return arenaBadge;
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
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} badge={getBadge(item)} />
          ))}
        </nav>
      </header>

      {/* Main content: fills all remaining space */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <ToastProvider>{children}</ToastProvider>
      </main>

      <BattleNotifier />

      {/* Mobile: slim bottom nav (48px) */}
      <nav className="flex h-12 shrink-0 items-center justify-around border-t border-border/50 bg-surface/80 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map((item) => (
          <MobileNavLink key={item.href} item={item} isActive={isActive(item.href)} badge={getBadge(item)} />
        ))}
      </nav>
    </div>
  );
}
