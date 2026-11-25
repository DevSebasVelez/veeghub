import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  FileText,
  Folder,
  KeyRound,
  LayoutDashboard,
  Magnet,
  Megaphone,
  Newspaper,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of the admin navigation: the sidebar, the mobile bar and the
 * header title all read from here, so a new section is one entry.
 */

export type NavBadgeKey = "leads" | "marketing";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line shown as tooltip when the sidebar is collapsed. */
  hint: string;
  /** Exact match only (the dashboard would otherwise match everything). */
  exact?: boolean;
  badge?: NavBadgeKey;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "inicio",
    label: "Inicio",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: LayoutDashboard,
        hint: "Resumen del día",
        exact: true,
      },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      { href: "/admin/leads", label: "Leads", icon: Magnet, hint: "Pipeline de prospectos", badge: "leads" },
      { href: "/admin/campanas", label: "Campañas", icon: Megaphone, hint: "Anuncios de Meta y su costo" },
      { href: "/admin/marketing", label: "Marketing", icon: Newspaper, hint: "Calendario editorial y marca", badge: "marketing" },
    ],
  },
  {
    id: "operacion",
    label: "Operación",
    items: [
      { href: "/admin/clientes", label: "Clientes", icon: Users, hint: "Empresas y contactos" },
      { href: "/admin/proyectos", label: "Proyectos", icon: BriefcaseBusiness, hint: "Proyectos en curso" },
      { href: "/admin/tareas", label: "Tareas", icon: CheckSquare, hint: "Pendientes por proyecto" },
      { href: "/admin/reuniones", label: "Reuniones", icon: CalendarDays, hint: "Agenda con clientes" },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    items: [
      { href: "/admin/finanzas", label: "Cobros", icon: BadgeDollarSign, hint: "Hitos, pagos, resumen e impuestos" },
      { href: "/admin/egresos", label: "Egresos", icon: Wallet, hint: "Gastos y pagos a personas" },
      { href: "/admin/facturas", label: "Facturas", icon: FileText, hint: "Facturas electrónicas y envíos" },
      { href: "/admin/reportes", label: "Reportes", icon: BarChart3, hint: "Facturación y cobros del período" },
    ],
  },
  {
    id: "recursos",
    label: "Recursos",
    items: [
      { href: "/admin/drive", label: "Drive", icon: Folder, hint: "Archivos de clientes y proyectos" },
      { href: "/admin/credenciales", label: "Credenciales", icon: KeyRound, hint: "Accesos cifrados" },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section })),
);

function matches(item: NavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The item that owns a path: the longest matching href wins. */
export function activeNavItem(pathname: string) {
  return (
    ALL_ITEMS.filter((item) => matches(item, pathname)).sort(
      (a, b) => b.href.length - a.href.length,
    )[0] ?? null
  );
}

export function isNavItemActive(item: NavItem, pathname: string) {
  return activeNavItem(pathname)?.href === item.href;
}

export type NavBadges = Partial<Record<NavBadgeKey, number>>;
