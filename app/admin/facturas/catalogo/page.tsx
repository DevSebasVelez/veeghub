import { Package } from "lucide-react";

import { setCatalogItemActive } from "@/lib/admin/actions/catalog/actions";
import { CatalogItemDialog } from "@/components/admin/dialogs/catalog-item-dialog";
import { ConfirmActionButton } from "@/components/admin/finance/confirm-action-button";
import { InvoicesNav } from "@/components/admin/finance/invoices-nav";
import { IconTile } from "@/components/admin/tone";
import { getCatalogItems, getCurrentVatOptions } from "@/lib/admin/queries/catalog";
import { formatCurrency } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

export default async function CatalogPage() {
  const [items, vatOptions] = await Promise.all([getCatalogItems({ includeArchived: true }), getCurrentVatOptions()]);
  const active = items.filter((i) => i.active);
  const vatLabel = (code: string | null) =>
    code === null ? "Tarifa vigente" : (vatOptions.find((o) => o.code === code)?.label ?? `Código ${code}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground">
            Productos y servicios que se repiten: elígelos al emitir y se llenan descripción, código, precio e IVA.
          </p>
        </div>
        <CatalogItemDialog mode="create" vatOptions={vatOptions} />
      </div>

      <InvoicesNav active="catalogo" catalogCount={active.length} />

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Catálogo</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Los archivados no aparecen al emitir. Las facturas guardan su propia copia.
          </p>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <IconTile icon={Package} tone="indigo" size="lg" />
            <p className="text-sm font-medium">Aún no hay productos ni servicios</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Agrega lo que facturas seguido (desarrollo, hosting, mantenimiento) con «Nuevo producto».
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className={cn("flex items-center gap-3 px-5 py-3.5 sm:gap-4", !item.active && "opacity-60")}>
                <IconTile icon={Package} tone={item.active ? "indigo" : "zinc"} size="sm" className="max-sm:hidden" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[item.code, `IVA ${vatLabel(item.vatCode)}`, item.active ? null : "Archivado"]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(item.unitPrice)}</p>
                <div className="flex shrink-0 items-center gap-1">
                  <CatalogItemDialog item={item} vatOptions={vatOptions} />
                  <ConfirmActionButton
                    icon={item.active ? "archive" : "restore"}
                    title={item.active ? "Archivar producto" : "Restaurar producto"}
                    description={
                      item.active
                        ? `«${item.name}» deja de ofrecerse al emitir. Las facturas emitidas no cambian.`
                        : `«${item.name}» vuelve a ofrecerse al emitir.`
                    }
                    confirmLabel={item.active ? "Archivar" : "Restaurar"}
                    successMessage={item.active ? "Producto archivado." : "Producto restaurado."}
                    action={setCatalogItemActive.bind(null, item.id, !item.active)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
