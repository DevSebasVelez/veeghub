import { redirect } from "next/navigation";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getR2DownloadUrl } from "@/lib/storage/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  await requireAdmin();

  const { fileId } = await params;
  const file = await prisma.driveFile.findUniqueOrThrow({
    where: { id: fileId },
    select: { objectKey: true },
  });

  redirect(await getR2DownloadUrl(file.objectKey));
}
