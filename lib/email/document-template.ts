import { COMPANY } from "@/lib/company";
import { escHtml, getLogoBase64 } from "@/lib/email/invoice-template";

// Email that carries a receipt or an account statement as a PDF attachment.
// Same quiet look as the invoice email: one card, a few label/value rows and
// the figure that matters set large.

export type DocumentEmailData = {
  clientName: string;
  /** Short heading line under the greeting. */
  intro: string;
  customMessage?: string | null;
  rows: Array<{ label: string; value: string; mono?: boolean }>;
  figureLabel: string;
  figure: string;
  figureTone?: "ink" | "emerald" | "red";
  attachmentName: string;
  docLabel: string;
  docCode: string;
};

const TONE = { ink: "#111111", emerald: "#047857", red: "#b91c1c" };

export function buildDocumentEmailHtml(data: DocumentEmailData): string {
  const logoSrc = getLogoBase64();
  const logoBlock = logoSrc
    ? `<img src="${logoSrc}" alt="${COMPANY.brand}" height="24" style="display:block;height:24px;max-width:160px;" />`
    : `<span style="color:#111111;font-size:17px;font-weight:600;letter-spacing:-0.3px;">${COMPANY.brand}</span>`;

  const message = data.customMessage
    ? escHtml(data.customMessage).replace(/\n/g, "<br/>")
    : escHtml(data.intro);

  const rows = data.rows
    .map(
      (row) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;color:#999999;font-size:13px;">${escHtml(row.label)}</td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #f0f0f0;color:#111111;font-size:13px;font-weight:500;${row.mono ? "font-family:monospace;" : ""}">${escHtml(row.value)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${escHtml(data.docLabel)} ${escHtml(data.docCode)} · ${COMPANY.brand}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f7;">
    <tr>
      <td align="center" style="padding:48px 16px 56px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 0 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">${logoBlock}</td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="color:#999999;font-size:12px;">${escHtml(data.docLabel)}</span>
                    <span style="color:#111111;font-size:14px;font-weight:600;font-family:monospace;display:block;">${escHtml(data.docCode)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:18px;border:1px solid #e8e8e8;padding:40px;">
              <h1 style="color:#111111;font-size:24px;font-weight:600;letter-spacing:-0.4px;margin:0 0 12px 0;line-height:1.25;">Hola, ${escHtml(data.clientName)}</h1>
              <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 28px 0;">${message}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:12px;border:1px solid #f0f0f0;">
                <tr>
                  <td style="padding:22px 26px;">
                    <span style="display:block;color:#999999;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;">${escHtml(data.figureLabel)}</span>
                    <span style="display:block;color:${TONE[data.figureTone ?? "ink"]};font-size:34px;font-weight:600;letter-spacing:-1.2px;line-height:1.2;margin:6px 0 10px;">${escHtml(data.figure)}</span>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
                  </td>
                </tr>
              </table>

              <p style="color:#777777;font-size:13px;line-height:1.6;margin:20px 0 0;">
                &#128206;&nbsp; Adjunto: <strong style="color:#333333;font-weight:600;">${escHtml(data.attachmentName)}</strong>
              </p>

              <p style="color:#aaaaaa;font-size:13px;margin:28px 0 0;padding-top:22px;border-top:1px solid #f0f0f0;line-height:1.6;">
                ¿Alguna pregunta? Responde este correo o escríbenos a
                <a href="mailto:${COMPANY.email}" style="color:#111111;text-decoration:none;font-weight:500;">${COMPANY.email}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 8px 0;">
              <p style="color:#aaaaaa;font-size:12px;margin:0 0 6px 0;font-weight:500;">${COMPANY.brand} &nbsp;&middot;&nbsp; ${escHtml(COMPANY.tagline)}</p>
              <a href="https://${COMPANY.website}" style="color:#aaaaaa;font-size:12px;text-decoration:none;">${COMPANY.website}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
