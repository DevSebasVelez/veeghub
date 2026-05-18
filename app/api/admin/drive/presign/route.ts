import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getR2UploadUrl } from "@/lib/storage/r2";
import { compactId } from "@/lib/admin/slug";

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  await requireAdmin();

  const params = request.nextUrl.searchParams;
  const filename = params.get("filename");
  const contentType =
    params.get("contentType") ?? "application/octet-stream";

  if (!filename) {
    return NextResponse.json({ error: "filename requerido" }, { status: 400 });
  }

  const key = `drive/${Date.now()}-${compactId()}-${safeFileName(filename)}`;
  const url = await getR2UploadUrl({ key, contentType });

  return NextResponse.json({ url, key });
}
