"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  FileText,
  Folder,
  KeyRound,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { FaChartLine } from "react-icons/fa6";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/proyectos", label: "Proyectos", icon: BriefcaseBusiness },
  { href: "/admin/finanzas", label: "Finanzas", icon: BadgeDollarSign },
  { href: "/admin/facturas", label: "Facturas", icon: FileText },
  { href: "/admin/reportes", label: "Reportes", icon: FaChartLine },
  { href: "/admin/drive", label: "Drive", icon: Folder },
  { href: "/admin/credenciales", label: "Credenciales", icon: KeyRound },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            V
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Veeghub</div>
            <div className="truncate text-xs text-muted-foreground">
              Operaciones
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/admin"
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
