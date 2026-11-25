import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { compactId } from "@/lib/admin/slug";
import { ASSET_PREFIX } from "@/lib/marketing/constants";
import { getR2UploadUrl } from "@/lib/storage/r2";

const ALLOWED = /^(image|video)\//;

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Presigned PUT for the marketing library: images and video only. */
export async function GET(request: NextRequest) {
  await requireAdmin();

  const params = request.nextUrl.searchParams;
  const filename = params.get("filename");
  const contentType = params.get("contentType") ?? "";

  if (!filename) {
    return NextResponse.json({ error: "filename requerido" }, { status: 400 });
  }
  if (!ALLOWED.test(contentType)) {
    return NextResponse.json(
      { error: "La biblioteca sólo admite imágenes y videos." },
      { status: 400 },
    );
  }

  const key = `${ASSET_PREFIX}subidas/${Date.now()}-${compactId()}-${safeFileName(filename)}`;
  const url = await getR2UploadUrl({ key, contentType });

  return NextResponse.json({ url, key });
}
