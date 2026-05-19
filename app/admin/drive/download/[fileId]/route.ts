import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getR2DownloadUrl } from "@/lib/storage/r2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  await requireAdmin();

  const { fileId } = await params;
  const forceDownload =
    new URL(request.url).searchParams.get("download") === "1";

  const file = await prisma.driveFile.findUniqueOrThrow({
    where: { id: fileId },
    select: { objectKey: true, name: true },
  });

  const url = await getR2DownloadUrl(
    file.objectKey,
    forceDownload ? { filename: file.name } : undefined,
  );

  return NextResponse.redirect(url);
}
