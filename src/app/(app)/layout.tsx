"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
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
    label: "Log",
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
    href: "/bacheca",
    label: "Bacheca",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        {/* Trophy / archive icon */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.996.178-1.768.63-2.166 1.242a3.02 3.02 0 0 0-.084 2.697c.407.862 1.275 1.5 2.373 1.759M18.75 4.236c.996.178 1.768.63 2.166 1.242a3.02 3.02 0 0 1 .084 2.697c-.407.862-1.275 1.5-2.373 1.759m-13.25.002a7.5 7.5 0 0 0 14.998 0M5.378 9.936a7.5 7.5 0 0 1-.002-5.7M18.624 9.936a7.5 7.5 0 0 0 0-5.7"
        />
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

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        isActive
          ? "text-primary [&_svg]:drop-shadow-[0_0_6px_#3d5afe88]"
          : "text-muted hover:text-foreground"
      }`}
    >
      {item.icon}
      {item.label && <span className="hidden md:inline">{item.label}</span>}
    </Link>
  );
}

function MobileNavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`focus-ring flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium transition-colors ${
        isActive
          ? "text-primary [&_svg]:drop-shadow-[0_0_6px_#3d5afe88]"
          : "text-muted hover:text-foreground"
      }`}
    >
      {item.icon}
      <span>{item.label || "Settings"}</span>
    </Link>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
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
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
          ))}
        </nav>
      </header>

      {/* Main content: fills all remaining space */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <ToastProvider>{children}</ToastProvider>
      </main>

      {/* Mobile: slim bottom nav (48px) */}
      <nav className="flex h-12 shrink-0 items-center justify-around border-t border-border/50 bg-surface/80 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map((item) => (
          <MobileNavLink key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
      </nav>
    </div>
  );
}
