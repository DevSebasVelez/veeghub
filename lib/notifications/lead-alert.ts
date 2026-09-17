import { sendPushToAdmins } from "@/lib/notifications/push";

type LeadAlert = {
  id: string;
  name: string;
  phone: string | null;
  serviceTag: string | null;
  campaign: string | null;
};

function alertBody(lead: LeadAlert) {
  return (
    [lead.campaign, lead.serviceTag, lead.phone].filter(Boolean).join(" · ") ||
    "Lead nuevo desde Meta"
  );
}

/**
 * Alerts every device about a new lead, falling back to email when no device is
 * registered or every push failed. A lead nobody hears about is the failure this
 * whole module exists to prevent, so the fallback must never throw either.
 */
export async function notifyNewLead(lead: LeadAlert) {
  let pushed = 0;

  try {
    const result = await sendPushToAdmins({
      title: `🔥 Nuevo lead: ${lead.name}`,
      body: alertBody(lead),
      url: `/admin/leads/${lead.id}`,
      tag: `lead-${lead.id}`,
    });

    pushed = result.sent;
  } catch (error) {
    console.error("[push] error inesperado", error);
  }

  if (pushed > 0) return;

  await sendEmailFallback(lead);
}

async function sendEmailFallback(lead: LeadAlert) {
  const to = process.env.LEAD_ALERT_EMAIL;
  const from = process.env.INVOICE_FROM_EMAIL;

  if (!to || !from || !process.env.RESEND_API_KEY) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const base = process.env.NEXT_PUBLIC_APP_URL || "https://veeghub.veegsoft.com";

    await resend.emails.send({
      from,
      to,
      subject: `Nuevo lead: ${lead.name}`,
      html: `
        <h2>${lead.name}</h2>
        <p>${alertBody(lead)}</p>
        ${lead.phone ? `<p><a href="https://wa.me/${lead.phone.replace(/\D/g, "")}">Escribir por WhatsApp</a></p>` : ""}
        <p><a href="${base}/admin/leads/${lead.id}">Ver el lead en Veeghub</a></p>
      `,
    });
  } catch (error) {
    console.error("[push] fallback por email falló", error);
  }
}
