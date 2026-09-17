import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "@/app/admin/admin-nav";
import { MobileNav } from "@/components/admin/mobile-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <SidebarProvider>
      <AdminNav
        user={{
          name: session.user?.name ?? null,
          email: session.user?.email ?? null,
        }}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="shrink-0" />
          <Separator orientation="vertical" className="h-5" />
          <div className="text-sm font-medium">Panel administrativo</div>
        </header>
        <div className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
