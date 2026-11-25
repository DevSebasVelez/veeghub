"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/admin/user-menu";
import {
  NAV_SECTIONS,
  isNavItemActive,
  type NavBadges,
} from "@/components/admin/nav-config";
import { cn } from "@/lib/utils";

function badgeLabel(value: number) {
  return value > 99 ? "99+" : String(value);
}

export function AdminNav({
  user,
  badges = {},
}: {
  user: { name: string | null; email: string | null };
  badges?: NavBadges;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" aria-label="Navegación principal">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <Link
          href="/admin"
          onClick={closeOnMobile}
          className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:px-0"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            V
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold leading-tight">VeegHub</span>
            <span className="block truncate text-xs text-muted-foreground">Operaciones</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {NAV_SECTIONS.map((section, index) => {
          const labelId = `nav-${section.id}`;

          return (
            <SidebarGroup key={section.id} className="py-1.5">
              {index > 0 ? (
                <SidebarSeparator className="mb-2 hidden group-data-[collapsible=icon]:block" />
              ) : null}
              <SidebarGroupLabel
                id={labelId}
                className="h-7 text-xs font-medium text-muted-foreground"
              >
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu aria-labelledby={labelId} className="gap-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(item, pathname);
                    const count = item.badge ? (badges[item.badge] ?? 0) : 0;

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={{ children: count ? `${item.label} · ${count}` : item.label }}
                          className={cn(
                            "relative h-11 gap-3 rounded-lg text-[15px] md:h-9 md:gap-2.5 md:text-sm",
                            "[&_svg]:size-5 md:[&_svg]:size-4",
                            // Bar on the left edge marks the current page, not only the fill.
                            "data-[active=true]:font-medium data-[active=true]:before:absolute data-[active=true]:before:inset-y-2 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-primary",
                            "group-data-[collapsible=icon]:data-[active=true]:before:hidden",
                          )}
                        >
                          <Link
                            href={item.href}
                            onClick={closeOnMobile}
                            aria-current={active ? "page" : undefined}
                            title={item.hint}
                          >
                            <Icon aria-hidden="true" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {count ? (
                          <SidebarMenuBadge
                            aria-label={`${count} pendientes`}
                            className="top-3 right-2 h-5 min-w-5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground peer-data-[size=default]/menu-button:top-3 md:top-2 md:peer-data-[size=default]/menu-button:top-2 peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground"
                          >
                            {badgeLabel(count)}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <UserMenu name={user.name} email={user.email} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
