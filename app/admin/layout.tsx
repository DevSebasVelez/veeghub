import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getNavBadges } from "@/lib/admin/queries/nav";
import { AdminNav } from "@/app/admin/admin-nav";
import { AdminHeaderTitle } from "@/components/admin/admin-header-title";
import { MobileNav } from "@/components/admin/mobile-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const badges = await getNavBadges();

  return (
    <SidebarProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      <AdminNav
        user={{
          name: session.user?.name ?? null,
          email: session.user?.email ?? null,
        }}
        badges={badges}
      />
      <SidebarInset id="contenido" tabIndex={-1} className="min-w-0 outline-none">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="hidden shrink-0 md:inline-flex" />
          <Separator orientation="vertical" className="hidden h-5 md:block" />
          <AdminHeaderTitle />
        </header>
        <div className="flex-1 p-4 pb-28 md:p-6 md:pb-6">{children}</div>
      </SidebarInset>
      <MobileNav badges={badges} />
    </SidebarProvider>
  );
}
