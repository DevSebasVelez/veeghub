"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Magnet, Menu, Newspaper, CheckSquare } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { activeNavItem, type NavBadges } from "@/components/admin/nav-config";
import { cn } from "@/lib/utils";

// The four places used daily from the phone; everything else is one tap away
// in «Menú», which opens the full sidebar with its sections.
const TABS = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Magnet, badge: "leads" as const },
  { href: "/admin/marketing", label: "Marketing", icon: Newspaper, badge: "marketing" as const },
  { href: "/admin/tareas", label: "Tareas", icon: CheckSquare },
];

const itemClass = (active: boolean) =>
  cn(
    "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-muted",
  );

export function MobileNav({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname();
  const { setOpenMobile, openMobile } = useSidebar();
  const current = activeNavItem(pathname)?.href;
  const inTabs = TABS.some((tab) => tab.href === current);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <nav
        aria-label="Accesos rápidos"
        className="pointer-events-auto flex w-full max-w-md items-stretch gap-1 rounded-2xl border border-border bg-background/90 p-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = current === tab.href;
          const count = tab.badge ? (badges[tab.badge] ?? 0) : 0;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={itemClass(active)}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
              <span className="text-xs font-medium leading-none">{tab.label}</span>
              {count ? (
                <span
                  aria-label={`${count} pendientes`}
                  className="absolute right-[calc(50%-1.25rem)] top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground"
                >
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          aria-expanded={openMobile}
          aria-label="Abrir el menú con todas las secciones"
          className={itemClass(!inTabs)}
        >
          <Menu size={22} strokeWidth={!inTabs ? 2.25 : 1.75} aria-hidden="true" />
          <span className="text-xs font-medium leading-none">Menú</span>
        </button>
      </nav>
    </div>
  );
}
