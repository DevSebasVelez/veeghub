"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/app/generated/prisma/client";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionResult, actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { parseLocalDateTime } from "@/lib/admin/schemas";
import { deleteFromR2 } from "@/lib/storage/r2";
import {
  ASSET_KINDS,
  ASSET_PREFIX,
  CHANNELS,
  CONTENT_CHANNELS,
  type ContentStatusValue,
} from "@/lib/marketing/constants";
import { importIdeas, importPostsIndustrias, seedBrandGuidelines } from "@/lib/marketing/import";
import { BEAT_TYPES, parseIdeasHtml, readBeats, spokenStats, voiceText } from "@/lib/marketing/ideas-import";
import { stripUtm } from "@/lib/marketing/utm";

function revalidateMarketing(postId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/marketing", "layout");
  if (postId) revalidatePath(`/admin/marketing/calendario/${postId}`);
}

/**
 * A <textarea> submits line breaks as CRLF (HTML form encoding). Stored as is,
 * every line carries an invisible \r: the editor's counter then disagrees with
 * the channel's, and «did the approved text change?» sees a change on every
 * save. Everything that comes from a form goes through here.
 */
function formText(value: unknown) {
  return value == null ? "" : String(value).replace(/\r\n?/g, "\n");
}

const optional = z.preprocess(
  formText,
  z
    .string()
    .trim()
    .transform((value) => value || null),
);

const optionalUrl = optional.refine(
  (value) => !value || /^https?:\/\/\S+$/i.test(value),
  "La URL debe empezar con https://",
);

// ─── Posts ──────────────────────────────────────────────────────────────────

const postSchema = z
  .object({
    title: z.string().trim().min(1, "Ponle un nombre interno al post."),
    channel: z.enum(CONTENT_CHANNELS, "Elige un canal."),
    campaignId: optional.transform((value) => (value === "none" ? null : value)),
    body: z.preprocess(formText, z.string().trim().min(1, "El texto del post está vacío.")),
    firstComment: optional,
    linkUrl: optionalUrl.transform((value) => (value ? stripUtm(value) : null)),
    scheduledLocal: optional,
    assetIds: optional.transform((value) =>
      value ? [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))] : [],
    ),
  })
  .transform((data, ctx) => {
    const limit = CHANNELS[data.channel].maxChars;
    if (limit && data.body.length > limit) {
      ctx.addIssue({
        code: "custom",
        message: `El texto tiene ${data.body.length} caracteres; ${CHANNELS[data.channel].short} admite ${limit}.`,
      });
    }

    let scheduledAt: Date | null = null;
    if (data.scheduledLocal) {
      scheduledAt = parseLocalDateTime(data.scheduledLocal);
      if (Number.isNaN(scheduledAt.getTime())) {
        ctx.addIssue({ code: "custom", message: "Fecha u hora inválida." });
        scheduledAt = null;
      }
    }

    const { scheduledLocal: _local, ...rest } = data;
    void _local;

    return {
      ...rest,
      // Only LinkedIn uses a first comment; other channels drop it.
      firstComment: CHANNELS[data.channel].linkInComment ? data.firstComment : null,
      scheduledAt,
    };
  });

function parsePost(formData: FormData) {
  return postSchema.parse(Object.fromEntries(formData));
}

function assetRows(assetIds: string[]) {
  return assetIds.map((assetId, position) => ({ assetId, position }));
}

export async function createPost(formData: FormData) {
  await requireAdmin();

  return actionResult(async () => {
    const { assetIds, ...data } = parsePost(formData);

    const post = await prisma.contentPost.create({
      data: { ...data, status: "BORRADOR", assets: { create: assetRows(assetIds) } },
      select: { id: true },
    });

    revalidateMarketing();
    return { id: post.id };
  });
}

/** Statuses where the approved text is what will go out. */
const APPROVED: ContentStatusValue[] = ["APROBADO", "PROGRAMADO"];

/**
 * Saves the editor. Golden rule of the module: what goes out is what someone
 * approved. Changing the text, comment, link, channel or images of an approved
 * post sends it back to BORRADOR; moving only its date keeps the approval but
 * re-arms the reminders for the new time.
 */
export async function updatePost(id: string, formData: FormData) {
  await requireAdmin();

  return actionResult(async () => {
    const { assetIds, ...data } = parsePost(formData);

    const current = await prisma.contentPost.findUniqueOrThrow({
      where: { id },
      include: { assets: { orderBy: { position: "asc" }, select: { assetId: true } } },
    });

    if (current.status === "PUBLICADO") {
      throw new Error("Este post ya está publicado; ya no se edita.");
    }

    const contentChanged =
      current.body !== data.body ||
      current.firstComment !== data.firstComment ||
      current.linkUrl !== data.linkUrl ||
      current.channel !== data.channel ||
      current.assets.map((a) => a.assetId).join(",") !== assetIds.join(",");

    const timeChanged =
      (current.scheduledAt?.getTime() ?? null) !== (data.scheduledAt?.getTime() ?? null);

    const revoke = contentChanged && APPROVED.includes(current.status);

    await prisma.$transaction([
      prisma.contentPostAsset.deleteMany({ where: { postId: id } }),
      prisma.contentPost.update({
        where: { id },
        data: {
          ...data,
          assets: { create: assetRows(assetIds) },
          ...(revoke ? { status: "BORRADOR", approvedAt: null, approvedById: null } : {}),
          ...(timeChanged || revoke ? { reminderSentAt: null, dueNotifiedAt: null } : {}),
          // A post moved after its alert waits for its new time again.
          ...(timeChanged && current.status === "PROGRAMADO" && !revoke
            ? { status: "APROBADO" }
            : {}),
        },
      }),
    ]);

    revalidateMarketing(id);
    return { revoked: revoke };
  });
}

const TRANSITIONS: Record<string, ContentStatusValue[]> = {
  // target: allowed sources
  EN_REVISION: ["IDEA", "BORRADOR", "FALLIDO"],
  APROBADO: ["IDEA", "BORRADOR", "EN_REVISION", "FALLIDO"],
  BORRADOR: ["IDEA", "EN_REVISION", "APROBADO", "PROGRAMADO", "FALLIDO", "DESCARTADO"],
  DESCARTADO: ["IDEA", "BORRADOR", "EN_REVISION", "APROBADO", "PROGRAMADO", "FALLIDO"],
};

export async function setPostStatus(
  id: string,
  status: "EN_REVISION" | "APROBADO" | "BORRADOR" | "DESCARTADO",
): Promise<AdminFormState> {
  const session = await requireAdmin();

  return actionState(async () => {
    const allowed = TRANSITIONS[status];
    if (!allowed) throw new Error("Estado inválido.");

    const post = await prisma.contentPost.findUniqueOrThrow({ where: { id } });

    if (!allowed.includes(post.status)) {
      throw new Error("Ese cambio de estado no aplica a este post.");
    }

    if (status === "APROBADO") {
      const limit = CHANNELS[post.channel].maxChars;
      if (!post.body.trim()) throw new Error("No se puede aprobar un post vacío.");
      if (limit && post.body.length > limit) {
        throw new Error(`El texto supera los ${limit} caracteres del canal.`);
      }
      if (!post.scheduledAt) {
        throw new Error("Ponle fecha y hora antes de aprobarlo: el aviso sale a esa hora.");
      }
    }

    await prisma.contentPost.update({
      where: { id },
      data: {
        status,
        ...(status === "APROBADO"
          ? { approvedAt: new Date(), approvedById: session.user.id, error: null }
          : { approvedAt: null, approvedById: null }),
        // Back from an alert: let it alert again once re-approved.
        dueNotifiedAt: null,
      },
    });

    revalidateMarketing(id);
  });
}

export async function markPostPublished(
  id: string,
  externalUrl: string,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const url = optionalUrl.parse(externalUrl);
    const post = await prisma.contentPost.findUniqueOrThrow({ where: { id } });

    if (post.status === "DESCARTADO") throw new Error("El post está descartado.");

    const now = new Date();
    await prisma.contentPost.update({
      where: { id },
      data: {
        status: "PUBLICADO",
        publishedAt: post.publishedAt ?? now,
        externalUrl: url,
        error: null,
        reminderSentAt: post.reminderSentAt ?? now,
        dueNotifiedAt: post.dueNotifiedAt ?? now,
      },
    });

    revalidateMarketing(id);
  });
}

export async function deletePost(id: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    await prisma.contentPost.delete({ where: { id } });
    revalidateMarketing();
  });
}

export async function importPostsIndustriasFile(formData: FormData) {
  await requireAdmin();

  return actionResult(async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Elige el archivo posts-industrias.md.");
    }
    if (file.size > 1024 * 1024) throw new Error("El archivo pesa más de 1 MB.");

    // On the server there is no veegsoft-web checkout: bring the images the
    // posts need from the public site.
    const result = await importPostsIndustrias(await file.text(), { fetchMissingAssets: true });
    revalidateMarketing();
    return result;
  });
}

// ─── Guidelines ─────────────────────────────────────────────────────────────

const guidelineSchema = z.object({
  title: z.string().trim().min(1, "Falta el título."),
  content: z.preprocess(formText, z.string().trim().min(1, "La directriz está vacía.")),
  active: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
});

export async function updateGuideline(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = guidelineSchema.parse(Object.fromEntries(formData));
    await prisma.brandGuideline.update({ where: { id }, data });
    revalidatePath("/admin/marketing/directrices");
  });
}

const newGuidelineSchema = guidelineSchema.extend({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "La clave va en minúsculas, sin espacios (p. ej. «instagram»)."),
});

export async function createGuideline(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = newGuidelineSchema.parse({ active: "on", ...Object.fromEntries(formData) });
    const last = await prisma.brandGuideline.aggregate({ _max: { position: true } });

    await prisma.brandGuideline.create({
      data: { ...data, position: (last._max.position ?? 0) + 10 },
    });
    revalidatePath("/admin/marketing/directrices");
  });
}

export async function seedGuidelines() {
  await requireAdmin();

  return actionResult(async () => {
    const result = await seedBrandGuidelines();
    revalidatePath("/admin/marketing/directrices");
    return result;
  });
}

// ─── Library ────────────────────────────────────────────────────────────────

function parseTags(value: unknown) {
  return [
    ...new Set(
      String(value ?? "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 20);
}

const nullableNumber = (value: unknown) =>
  value === "" || value == null ? null : Number(value);

/** Pixels of an image or video frame. */
const dimension = z.preprocess(
  nullableNumber,
  z.number().int().positive().max(20000, "Dimensiones inválidas.").nullable(),
);

/** Bytes. R2 takes far more; 500 MB keeps a stray upload from going unnoticed. */
const fileSize = z.preprocess(
  nullableNumber,
  z.number().int().nonnegative().max(500 * 1024 * 1024, "El archivo pesa más de 500 MB.").nullable(),
);

const newAssetSchema = z.object({
  r2Key: z
    .string()
    .trim()
    .refine((key) => key.startsWith(ASSET_PREFIX) && !key.includes(".."), "Ruta de archivo inválida."),
  name: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(120),
  size: fileSize,
  width: dimension,
  height: dimension,
  kind: z.enum(ASSET_KINDS),
  tags: z.preprocess(parseTags, z.array(z.string())),
  alt: optional,
});

/** Registers a file the browser already uploaded to R2 with a presigned URL. */
export async function createAsset(input: Record<string, unknown>): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = newAssetSchema.parse(input);
    await prisma.contentAsset.create({ data });
    revalidatePath("/admin/marketing/biblioteca");
  });
}

const assetUpdateSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre.").max(200),
  kind: z.enum(ASSET_KINDS),
  tags: z.preprocess(parseTags, z.array(z.string())),
  alt: optional,
});

export async function updateAsset(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = assetUpdateSchema.parse(Object.fromEntries(formData));
    await prisma.contentAsset.update({ where: { id }, data });
    revalidatePath("/admin/marketing/biblioteca");
  });
}

export async function deleteAsset(id: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const asset = await prisma.contentAsset.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });

    if (asset._count.posts > 0) {
      throw new Error(
        `Está en ${asset._count.posts} publicación${asset._count.posts === 1 ? "" : "es"}. Quítalo de ahí primero.`,
      );
    }

    await prisma.contentAsset.delete({ where: { id } });

    try {
      await deleteFromR2(asset.r2Key);
    } catch (error) {
      // The row is gone; an orphan object in R2 is harmless and logged.
      console.error("[marketing] no se pudo borrar de R2", asset.r2Key, error);
    }

    revalidatePath("/admin/marketing/biblioteca");
  });
}

// ─── Banco de ideas (F2) ────────────────────────────────────────────────────

const IDEA_STAGES = ["IDEA", "GUION", "GRABADO", "EDITADO", "PUBLICADO", "DESCARTADO", "ARCHIVADO"] as const;

function revalidateIdeas(id?: string) {
  revalidatePath("/admin/marketing/ideas");
  if (id) revalidatePath(`/admin/marketing/ideas/${id}`);
}

/** Uploads of the five HTML files (production has no access to the local folder). */
export async function importIdeasFiles(formData: FormData) {
  await requireAdmin();

  return actionResult(async () => {
    const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
    if (!files.length) throw new Error("Elige los archivos HTML del banco de ideas.");

    let created = 0;
    let updated = 0;
    for (const file of files) {
      if (file.size > 2 * 1024 * 1024) throw new Error(`${file.name} pesa más de 2 MB.`);
      // Parse every file before writing anything: a bad file aborts the import.
      const ideas = parseIdeasHtml(file.name, await file.text());
      const result = await importIdeas(ideas);
      created += result.created;
      updated += result.updated;
    }

    revalidateIdeas();
    return { created, updated, files: files.length };
  });
}

const stageSchema = z.object({
  stage: z.enum(IDEA_STAGES),
  publishedUrl: optionalUrl,
});

export async function setIdeaStage(id: string, stage: string, publishedUrl?: string) {
  await requireAdmin();

  return actionResult(async () => {
    const data = stageSchema.parse({ stage, publishedUrl: publishedUrl ?? "" });
    await prisma.contentIdea.update({
      where: { id },
      data: {
        stage: data.stage,
        ...(data.stage === "PUBLICADO" && data.publishedUrl ? { publishedUrl: data.publishedUrl } : {}),
      },
    });
    revalidateIdeas(id);
  });
}

export async function updateIdeaNotes(id: string, notes: string) {
  await requireAdmin();

  return actionResult(async () => {
    const value = formText(notes).trim();
    if (value.length > 10_000) throw new Error("Las notas pasan de 10.000 caracteres.");
    await prisma.contentIdea.update({ where: { id }, data: { notes: value || null } });
    revalidateIdeas(id);
  });
}

const scriptSchema = z.object({
  title: z.string().trim().min(1, "El título no puede quedar vacío.").max(200),
  beats: z
    .array(
      z.object({
        tipo: z.enum(BEAT_TYPES),
        voz: z.string().trim().min(1, "Ninguna parte del guion puede quedar vacía.").max(2000),
        motion: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1)
    .max(12),
  alternativeHook: z.string().trim().max(1000).optional(),
  visualPrompt: z.string().trim().max(10_000).optional(),
});

export type IdeaScriptInput = z.input<typeof scriptSchema>;

type ScriptSnapshot = { title: string; beats: unknown; alternative: string | null; visualPrompt: string | null };

function metaRecord(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {};
}

/**
 * The bank's scripts come from the AI; Sebastián rewrites them before
 * recording. The first edit keeps the imported version in meta.original, and
 * editedAt stops a re-import from overwriting the text.
 */
export async function updateIdeaScript(id: string, input: IdeaScriptInput) {
  await requireAdmin();

  return actionResult(async () => {
    const data = scriptSchema.parse(input);
    const idea = await prisma.contentIdea.findUnique({
      where: { id },
      select: { title: true, beats: true, meta: true, visualPrompt: true },
    });
    if (!idea) throw new Error("La idea ya no existe.");

    const meta = metaRecord(idea.meta);
    if (!meta.original) {
      meta.original = {
        title: idea.title,
        beats: idea.beats,
        alternative: typeof meta.alternative === "string" ? meta.alternative : null,
        visualPrompt: idea.visualPrompt,
      } satisfies ScriptSnapshot;
    }
    if (data.alternativeHook) meta.alternative = data.alternativeHook;
    else delete meta.alternative;

    const beats = data.beats.map((beat) => ({ tipo: beat.tipo, voz: beat.voz, ...(beat.motion ? { motion: beat.motion } : {}) }));
    const stats = spokenStats(beats);

    await prisma.contentIdea.update({
      where: { id },
      data: {
        title: data.title,
        beats,
        visualPrompt: data.visualPrompt || null,
        meta: meta as Prisma.InputJsonValue,
        words: stats.words,
        seconds: stats.seconds,
        editedAt: new Date(),
      },
    });
    revalidateIdeas(id);
    return stats;
  });
}

/** Back to the imported script; future re-imports update it again. */
export async function restoreIdeaOriginal(id: string) {
  await requireAdmin();

  return actionResult(async () => {
    const idea = await prisma.contentIdea.findUnique({ where: { id }, select: { meta: true } });
    if (!idea) throw new Error("La idea ya no existe.");
    const meta = metaRecord(idea.meta);
    const original = meta.original as ScriptSnapshot | undefined;
    if (!original) throw new Error("Esta idea no tiene una versión original guardada.");

    const beats = readBeats(original.beats);
    delete meta.original;
    if (original.alternative) meta.alternative = original.alternative;
    else delete meta.alternative;
    const stats = spokenStats(beats);

    await prisma.contentIdea.update({
      where: { id },
      data: {
        title: original.title,
        beats,
        visualPrompt: original.visualPrompt,
        meta: meta as Prisma.InputJsonValue,
        words: stats.words,
        seconds: stats.seconds,
        editedAt: null,
      },
    });
    revalidateIdeas(id);
  });
}

/**
 * Starts a LinkedIn draft from an idea: the spoken text as a base to rewrite
 * as a post, linked back to the idea. Nothing gets scheduled or approved.
 */
export async function createPostFromIdea(id: string) {
  await requireAdmin();

  return actionResult(async () => {
    const idea = await prisma.contentIdea.findUnique({
      where: { id },
      select: { title: true, beats: true, meta: true },
    });
    if (!idea) throw new Error("La idea ya no existe.");

    const post = await prisma.contentPost.create({
      data: {
        ideaId: id,
        channel: "LINKEDIN_PERSONAL",
        status: "BORRADOR",
        title: `${idea.title} · LinkedIn`,
        body: voiceText(readBeats(idea.beats)),
      },
      select: { id: true },
    });

    revalidateMarketing();
    revalidateIdeas(id);
    return { id: post.id };
  });
}
