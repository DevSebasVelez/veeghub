import prisma from "@/lib/db/prisma";
import { formatDate } from "@/lib/admin/format";
import { sendPushToAdmins } from "@/lib/notifications/push";
import { CHANNELS } from "@/lib/marketing/constants";
import { scheduleWindow } from "@/lib/marketing/schedule";
import { buildUtmUrl, renderFirstComment } from "@/lib/marketing/utm";

/** Statuses that still get the day-before reminder: not out, not discarded. */
const PENDING_FOR_REMINDER = ["IDEA", "BORRADOR", "EN_REVISION", "APROBADO"] as const;

type PostForAlert = {
  id: string;
  title: string;
  channel: keyof typeof CHANNELS;
  body: string;
  firstComment: string | null;
  linkUrl: string | null;
  scheduledAt: Date | null;
  campaign: { slug: string } | null;
};

const POST_SELECT = {
  id: true,
  title: true,
  channel: true,
  body: true,
  firstComment: true,
  linkUrl: true,
  scheduledAt: true,
  status: true,
  campaign: { select: { slug: true } },
} as const;

function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://veeghub.veegsoft.com";
  return `${base}${path}`;
}

function postPath(id: string) {
  return `/admin/marketing/calendario/${id}`;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function alertEmailConfig() {
  const to = process.env.MARKETING_ALERT_EMAIL || process.env.LEAD_ALERT_EMAIL;
  const from = process.env.INVOICE_FROM_EMAIL;

  if (!to || !from || !process.env.RESEND_API_KEY) return null;
  return { to, from };
}

async function sendAlertEmail(subject: string, html: string) {
  const config = alertEmailConfig();
  if (!config) return false;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const response = await resend.emails.send({ ...config, subject, html });

    if (response.error) {
      console.error("[marketing] email falló", response.error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[marketing] email falló", error);
    return false;
  }
}

async function safePush(payload: Parameters<typeof sendPushToAdmins>[0]) {
  try {
    return (await sendPushToAdmins(payload)).sent;
  } catch (error) {
    console.error("[marketing] push falló", error);
    return 0;
  }
}

/**
 * «Llegó la hora» for a channel without API: the whole kit to publish by hand
 * travels in the email (text, first comment with UTM, where to open), and the
 * images are one click away in VeegHub — their signed URLs would expire long
 * before anyone opens the email.
 */
async function notifyDue(post: PostForAlert) {
  const channel = CHANNELS[post.channel];
  const utmUrl = buildUtmUrl({
    linkUrl: post.linkUrl,
    channel: post.channel,
    campaignSlug: post.campaign?.slug,
    postId: post.id,
  });
  const comment = channel.linkInComment
    ? renderFirstComment(post.firstComment, utmUrl)
    : null;

  const pushed = await safePush({
    title: `📣 Toca publicar en ${channel.short}`,
    body: `${post.title} · abre para copiar el texto y bajar las imágenes`,
    url: postPath(post.id),
    tag: `post-${post.id}`,
  });

  const pre = (text: string) =>
    `<pre style="white-space:pre-wrap;font-family:inherit;background:#f4f5f7;border-radius:8px;padding:12px">${escapeHtml(text)}</pre>`;

  const emailed = await sendAlertEmail(
    `Toca publicar: ${post.title}`,
    `
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(channel.label)} · ${escapeHtml(formatDate(post.scheduledAt))}</p>
      <p><a href="${appUrl(postPath(post.id))}">Abrir en VeegHub</a> (copiar texto y descargar imágenes) · <a href="${channel.openUrl}">Abrir ${escapeHtml(channel.short)}</a></p>
      <h3>Texto</h3>
      ${pre(post.body)}
      ${comment ? `<h3>Primer comentario</h3>${pre(comment)}` : ""}
      ${!comment && utmUrl ? `<h3>Enlace</h3>${pre(utmUrl)}` : ""}
      <p>Cuando esté publicado, márcalo en VeegHub con su URL.</p>
    `,
  );

  return { pushed, emailed };
}

async function notifyTomorrow(posts: (PostForAlert & { status: string })[]) {
  const pending = posts.filter((post) => post.status !== "APROBADO");
  const lines = posts.map(
    (post) =>
      `${CHANNELS[post.channel].short} · ${post.title}${post.status === "APROBADO" ? "" : " (sin aprobar)"}`,
  );

  const pushed = await safePush({
    title:
      posts.length === 1
        ? "🗓️ Mañana se publica 1 post"
        : `🗓️ Mañana se publican ${posts.length} posts`,
    body: pending.length
      ? `${pending.length} sin aprobar. ${lines.join(" · ")}`
      : lines.join(" · "),
    url: "/admin/marketing/calendario?vista=lista",
    tag: "marketing-manana",
  });

  const emailed = await sendAlertEmail(
    `Mañana: ${posts.length} publicación${posts.length === 1 ? "" : "es"}`,
    `
      <p>Programado para mañana:</p>
      <ul>${posts
        .map(
          (post) =>
            `<li><a href="${appUrl(postPath(post.id))}">${escapeHtml(post.title)}</a> — ${escapeHtml(CHANNELS[post.channel].label)}, ${escapeHtml(formatDate(post.scheduledAt))}${post.status === "APROBADO" ? "" : " · <strong>sin aprobar</strong>: sólo se avisa a la hora si está aprobado"}</li>`,
        )
        .join("")}</ul>
    `,
  );

  return { pushed, emailed };
}

export type MarketingCronResult = {
  due: number;
  tomorrow: number;
  pushed: number;
  emailed: number;
};

/**
 * One pass of `/api/cron/marketing` (every 15 minutes).
 *
 * 1. Approved posts whose time has come. There is no publishing API yet (F6),
 *    so every channel is manual: alert by push and email and move the post to
 *    PROGRAMADO until someone marks it published with its URL. F6 plugs in
 *    here — publish when the channel has a `ChannelConnection`.
 * 2. From 8:00 Ecuador, a digest of tomorrow's posts, including the ones not
 *    approved yet: the reminder is the chance to approve them in time.
 *
 * Every alert first claims its row with a conditional update, so two
 * overlapping runs (a retry, a manual call) never alert twice.
 */
export async function runMarketingCron(now = new Date()): Promise<MarketingCronResult> {
  const result: MarketingCronResult = { due: 0, tomorrow: 0, pushed: 0, emailed: 0 };

  const due = await prisma.contentPost.findMany({
    where: { status: "APROBADO", scheduledAt: { lte: now }, dueNotifiedAt: null },
    select: POST_SELECT,
    orderBy: { scheduledAt: "asc" },
  });

  for (const post of due) {
    const claim = await prisma.contentPost.updateMany({
      where: { id: post.id, status: "APROBADO", dueNotifiedAt: null },
      data: { status: "PROGRAMADO", dueNotifiedAt: now },
    });
    if (claim.count !== 1) continue;

    result.due += 1;
    const sent = await notifyDue(post);
    result.pushed += sent.pushed;
    if (sent.emailed) result.emailed += 1;
  }

  const window = scheduleWindow(now);

  if (window.reminderHourReached) {
    const candidates = await prisma.contentPost.findMany({
      where: {
        status: { in: [...PENDING_FOR_REMINDER] },
        scheduledAt: { gte: window.tomorrowStart, lt: window.dayAfterStart },
        reminderSentAt: null,
      },
      select: POST_SELECT,
      orderBy: { scheduledAt: "asc" },
    });

    const claimed: typeof candidates = [];
    for (const post of candidates) {
      const claim = await prisma.contentPost.updateMany({
        where: { id: post.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claim.count === 1) claimed.push(post);
    }

    if (claimed.length) {
      result.tomorrow = claimed.length;
      const sent = await notifyTomorrow(claimed);
      result.pushed += sent.pushed;
      if (sent.emailed) result.emailed += 1;
    }
  }

  return result;
}
