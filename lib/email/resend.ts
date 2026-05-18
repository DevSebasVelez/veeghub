import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
  if (resend) return resend;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("Define RESEND_API_KEY antes de enviar correos.");
  }

  resend = new Resend(process.env.RESEND_API_KEY);

  return resend;
}

export async function sendInvoiceEmail({
  to,
  cc,
  subject,
  html,
  attachments,
}: {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
  }>;
}) {
  const from = process.env.INVOICE_FROM_EMAIL;

  if (!from) {
    throw new Error("Define INVOICE_FROM_EMAIL para enviar facturas.");
  }

  const response = await getResend().emails.send({
    from,
    to,
    cc: cc || undefined,
    subject,
    html,
    attachments,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.id;
}
