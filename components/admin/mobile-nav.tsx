"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckSquare,
  LayoutDashboard,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/admin/clientes", label: "Clientes", icon: Users, exact: false },
  {
    href: "/admin/proyectos",
    label: "Proyectos",
    icon: BriefcaseBusiness,
    exact: false,
  },
  { href: "/admin/tareas", label: "Tareas", icon: CheckSquare, exact: false },
  {
    href: "/admin/finanzas",
    label: "Finanzas",
    icon: BadgeDollarSign,
    exact: false,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <nav className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-2xl border border-border bg-background/80 p-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground active:bg-muted",
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
