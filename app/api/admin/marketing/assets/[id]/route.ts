import { redirect } from "next/navigation";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getR2DownloadUrl } from "@/lib/storage/r2";

/**
 * Fresh signed URL for a library file. Pages and alert emails link here
 * instead of embedding a signed URL, which expires in 5 minutes.
 * `?descargar=1` forces the download with the original name.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await ctx.params;
  const asset = await prisma.contentAsset.findUnique({
    where: { id },
    select: { r2Key: true, name: true },
  });

  if (!asset) return new Response("No existe", { status: 404 });

  const download = new URL(request.url).searchParams.has("descargar");
  redirect(await getR2DownloadUrl(asset.r2Key, download ? { filename: asset.name } : undefined));
}
