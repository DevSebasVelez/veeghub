import fs from "fs";
import path from "path";

function getLogoBase64(): string {
  try {
    const logoPath = path.join(
      process.cwd(),
      "public/logos/logo-black-transarent-horizontal.png",
    );
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

export type InvoiceEmailData = {
  invoiceNumber: string | null;
  clientName: string;
  projectName?: string | null;
  issueDate?: string | null;
  subtotal?: string | null;
  taxAmount?: string | null;
  total: string;
  accessKey?: string | null;
  customMessage?: string | null;
};

export function buildInvoiceEmailHtml(data: InvoiceEmailData): string {
  const logoSrc = getLogoBase64();

  const logoBlock = logoSrc
    ? `<img src="${logoSrc}" alt="VEEGSOFT" height="24" style="display:block;height:24px;max-width:160px;" />`
    : `<span style="color:#111111;font-size:17px;font-weight:700;letter-spacing:-0.3px;">VEEGSOFT</span>`;

  const bodyText = data.customMessage
    ? `<p style="color:#555555;font-size:15px;line-height:1.75;margin:0 0 32px 0;">${data.customMessage.replace(/\n/g, "<br/>")}</p>`
    : `<p style="color:#555555;font-size:15px;line-height:1.75;margin:0 0 32px 0;">
        Te hacemos llegar los documentos correspondientes a la factura indicada. Adjunto a este correo encontrarás el <strong style="color:#111111;font-weight:600;">XML autorizado por el SRI</strong> y el <strong style="color:#111111;font-weight:600;">RIDE en formato PDF</strong>.<br/><br/>
        Ante cualquier consulta, no dudes en contactarnos.
      </p>`;

  const row = (label: string, value: string, mono = false) =>
    `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
        <span style="display:block;color:#999999;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">${label}</span>
        <span style="display:block;color:#111111;font-size:14px;font-weight:500;${mono ? "font-family:monospace;" : ""}">${value}</span>
      </td>
    </tr>`;

  const splitRow = (
    labelA: string,
    valueA: string,
    labelB: string,
    valueB: string,
  ) =>
    `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%">
              <span style="display:block;color:#999999;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">${labelA}</span>
              <span style="display:block;color:#111111;font-size:14px;font-weight:500;">${valueA}</span>
            </td>
            <td width="50%" align="right">
              <span style="display:block;color:#999999;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">${labelB}</span>
              <span style="display:block;color:#111111;font-size:14px;font-weight:500;">${valueB}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const invoiceNumberRow = row(
    "N° Factura",
    data.invoiceNumber ? escHtml(data.invoiceNumber) : "—",
    true,
  );

  const dateProjectRows = [
    data.issueDate && data.projectName
      ? splitRow(
          "Fecha de emisión",
          escHtml(data.issueDate),
          "Proyecto",
          escHtml(data.projectName),
        )
      : data.issueDate
        ? row("Fecha de emisión", escHtml(data.issueDate))
        : data.projectName
          ? row("Proyecto", escHtml(data.projectName))
          : "",
  ].join("");

  const amountsRow =
    data.subtotal && data.taxAmount
      ? splitRow(
          "Subtotal",
          escHtml(data.subtotal),
          "IVA",
          escHtml(data.taxAmount),
        )
      : "";

  const accessKeyRow = data.accessKey
    ? `<tr>
        <td style="padding:14px 0 0;">
          <span style="display:block;color:#999999;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">Clave de acceso SRI</span>
          <span style="display:block;color:#888888;font-size:11px;font-family:monospace;line-height:1.6;word-break:break-all;">${escHtml(data.accessKey)}</span>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Factura ${data.invoiceNumber ? escHtml(data.invoiceNumber) : ""} · VEEGSOFT</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f7;">
    <tr>
      <td align="center" style="padding:48px 16px 56px;">

        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- ── BRAND HEADER ── -->
          <tr>
            <td style="padding:0 0 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    ${logoBlock}
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="color:#999999;font-size:12px;font-weight:400;">Factura</span>
                    <span style="color:#111111;font-size:15px;font-weight:600;font-family:monospace;display:block;">${data.invoiceNumber ? escHtml(data.invoiceNumber) : "—"}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CARD ── -->
          <tr>
            <td style="background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e8e8e8;">

              <!-- Thin top accent -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#4f46e5;height:3px;line-height:3px;font-size:3px;">&nbsp;</td>
                </tr>
              </table>

              <!-- ── GREETING ── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 40px 0;">
                    <h1 style="color:#111111;font-size:26px;font-weight:700;letter-spacing:-0.5px;margin:0 0 12px 0;line-height:1.2;">Hola, ${escHtml(data.clientName)}</h1>
                    ${bodyText}
                  </td>
                </tr>
              </table>

              <!-- ── INVOICE DETAILS ── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 40px;">

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:12px;border:1px solid #f0f0f0;">
                      <tr>
                        <td style="padding:24px 28px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            ${invoiceNumberRow}
                            ${dateProjectRows}
                            ${amountsRow}

                            <!-- Total -->
                            <tr>
                              <td style="padding-top:20px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="vertical-align:bottom;">
                                      <span style="color:#999999;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;">Total</span>
                                    </td>
                                    <td align="right" style="vertical-align:bottom;">
                                      <span style="color:#111111;font-size:34px;font-weight:800;letter-spacing:-1.5px;line-height:1;">${escHtml(data.total)}</span>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>

                            ${accessKeyRow}
                          </table>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- ── ATTACHMENTS NOTICE ── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 40px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f7;border-radius:10px;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align:middle;padding-right:12px;color:#4f46e5;font-size:18px;line-height:1;">&#128206;</td>
                              <td style="vertical-align:middle;">
                                <span style="display:block;color:#333333;font-size:13px;font-weight:600;margin-bottom:2px;">Documentos adjuntos a este correo</span>
                                <span style="color:#777777;font-size:13px;line-height:1.5;">XML autorizado SRI &nbsp;&middot;&nbsp; RIDE PDF</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ── DIVIDER + CONTACT ── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 40px 36px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-top:1px solid #f0f0f0;padding-top:24px;">
                          <p style="color:#aaaaaa;font-size:13px;margin:0;line-height:1.6;">
                            ¿Alguna pregunta? Responde este correo o escríbenos a
                            <a href="mailto:info@veegsoft.com" style="color:#4f46e5;text-decoration:none;font-weight:500;">&nbsp;info@veegsoft.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:28px 8px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="color:#aaaaaa;font-size:12px;margin:0 0 6px 0;font-weight:500;">
                      VEEGSOFT &nbsp;&middot;&nbsp; Desarrollo de software a medida
                    </p>
                    <p style="margin:0;">
                      <a href="https://veegsoft.com" style="color:#aaaaaa;font-size:12px;text-decoration:none;">veegsoft.com</a>
                    </p>
                    <p style="color:#cccccc;font-size:11px;margin:12px 0 0;line-height:1.6;max-width:420px;">
                      Este correo y sus adjuntos son confidenciales y están destinados exclusivamente al destinatario indicado.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
