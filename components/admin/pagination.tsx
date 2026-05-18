import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  param = "page",
  searchParams = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  param?: string;
  searchParams?: Record<string, string | number | null | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        Mostrando {start}-{end} de {total}
      </div>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(basePath, param, page - 1, searchParams)}>
              <ChevronLeft />
              Anterior
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft />
            Anterior
          </Button>
        )}
        <div className="rounded-md border bg-muted/40 px-3 py-1 text-center text-xs font-medium text-foreground">
          {page} / {totalPages}
        </div>
        {hasNext ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(basePath, param, page + 1, searchParams)}>
              Siguiente
              <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Siguiente
            <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}

export function getPage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function hrefFor(
  basePath: string,
  param: string,
  page: number,
  params: Record<string, string | number | null | undefined>,
) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  search.set(param, String(page));

  return `${basePath}?${search.toString()}`;
}
