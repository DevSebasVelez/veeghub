import { redirect } from "next/navigation";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getR2DownloadUrl } from "@/lib/storage/r2";

/** Above this, `?archivo=1` refuses: Vercel caps a function response at 4.5 MB. */
const MAX_PROXY_BYTES = 4 * 1024 * 1024;

/**
 * Fresh signed URL for a library file. Pages and alert emails link here
 * instead of embedding a signed URL, which expires in 5 minutes.
 *
 * - `?descargar=1` forces the download with the original name.
 * - `?archivo=1` returns the bytes from this origin instead of redirecting.
 *   The phone «Compartir» button needs them as a File, and fetching R2
 *   directly would depend on the bucket's CORS.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await ctx.params;
  const asset = await prisma.contentAsset.findUnique({
    where: { id },
    select: { r2Key: true, name: true, mime: true, size: true },
  });

  if (!asset) return new Response("No existe", { status: 404 });

  const search = new URL(request.url).searchParams;

  if (search.has("archivo")) {
    if (asset.size && asset.size > MAX_PROXY_BYTES) {
      return new Response("Archivo demasiado grande", { status: 413 });
    }

    const upstream = await fetch(await getR2DownloadUrl(asset.r2Key));
    if (!upstream.ok || !upstream.body) {
      return new Response("No se pudo leer el archivo", { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "content-type": asset.mime,
        "cache-control": "private, max-age=300",
      },
    });
  }

  const download = search.has("descargar");
  redirect(await getR2DownloadUrl(asset.r2Key, download ? { filename: asset.name } : undefined));
}
