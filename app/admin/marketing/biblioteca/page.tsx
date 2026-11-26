import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Images, Search } from "lucide-react";
import { IconTile } from "@/components/admin/tone";

import { AssetCard } from "@/components/admin/marketing/asset-card";
import { AssetUploader } from "@/components/admin/marketing/asset-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getAssetTags, getAssets, type AssetFilters } from "@/lib/admin/queries/marketing";
import { ASSET_KIND_LABELS, ASSET_KINDS, isAssetKind } from "@/lib/marketing/constants";

type Params = { q?: string; tipo?: string; etiqueta?: string };

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters: AssetFilters = {
    q: params.q?.trim() || undefined,
    kind: isAssetKind(params.tipo) ? params.tipo : undefined,
    tag: params.etiqueta?.trim() || undefined,
  };
  const tags = await getAssetTags();
  const filterKey = `${filters.q ?? ""}|${filters.kind ?? ""}|${filters.tag ?? ""}`;
  const filtered = Boolean(filters.q || filters.kind || filters.tag);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* key: uncontrolled inputs reset when the URL changes. */}
        <Form key={filterKey} action="/admin/marketing/biblioteca" className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={filters.q} placeholder="Buscar" className="h-9 w-48 pl-8" />
          </div>
          <select name="tipo" defaultValue={filters.kind ?? ""} className={selectClass} aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {ASSET_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ASSET_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <select name="etiqueta" defaultValue={filters.tag ?? ""} className={selectClass} aria-label="Etiqueta">
            <option value="">Todas las etiquetas</option>
            {tags.map(({ tag, count }) => (
              <option key={tag} value={tag}>
                {tag} ({count})
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="secondary">
            Filtrar
          </Button>
          {filtered ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/marketing/biblioteca">Limpiar</Link>
            </Button>
          ) : null}
        </Form>
        <AssetUploader />
      </div>

      <Suspense key={filterKey} fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <AssetGrid filters={filters} filtered={filtered} />
      </Suspense>
    </div>
  );
}

async function AssetGrid({ filters, filtered }: { filters: AssetFilters; filtered: boolean }) {
  const assets = await getAssets(filters, 240);

  if (!assets.length) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        <IconTile icon={Images} tone="pink" size="lg" className="mx-auto mb-4" />
        {filtered ? (
          "Nada coincide con el filtro."
        ) : (
          <>
            La biblioteca está vacía. Sube archivos o carga los de veegsoft-web con{" "}
            <code className="rounded bg-muted px-1">npm run mkt:assets</code>.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {assets.length} recurso{assets.length === 1 ? "" : "s"}
        {assets.length === 240 ? " (los 240 más recientes; filtra para ver otros)" : ""}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}
