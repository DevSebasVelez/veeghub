"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { ChevronsUpDown, Bell, LogOut, Monitor, Moon, Sun } from "lucide-react";

import { signOutAdmin } from "@/lib/admin/actions/auth/actions";
import { NotificationsDialog } from "@/components/admin/notifications-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || "?";

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function UserMenu({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const { theme, setTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            {/* No tooltip prop here: SidebarMenuButton wraps itself in a
                TooltipTrigger when it gets one, which would stack two asChild
                layers with DropdownMenuTrigger. */}
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                  {initials(name, email)}
                </div>
                <div className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">
                    {name ?? "Administrador"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email ?? ""}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            >
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Tema
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={theme ?? "system"}
                onValueChange={setTheme}
              >
                <DropdownMenuRadioItem value="light">
                  <Sun className="size-4" />
                  Claro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="size-4" />
                  Oscuro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor className="size-4" />
                  Sistema
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={() => setNotificationsOpen(true)}>
                <Bell className="size-4" />
                Avisos de leads
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  void signOutAdmin();
                }}
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <NotificationsDialog
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
      />
    </>
  );
}
