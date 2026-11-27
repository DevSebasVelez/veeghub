import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  accessKeyCheckDigit,
  findAccessKey,
  isValidAccessKey,
  parseAccessKey,
} from "@/lib/sri/access-key";
import { SriXmlError, parseSriInvoiceXml } from "@/lib/sri/invoice-xml";

// Real invoice downloaded from the SRI facturador (buyer anonymized,
// signature removed). Bare signed <factura>, no authorization wrapper.
const BARE = readFileSync(path.join(process.cwd(), "lib/sri/fixtures/factura-sri-facturador.xml"), "utf8");
const KEY = "1305202601010488569400120010010000000016329301616";
const factura = BARE.replace(/^<\?xml[^>]*\?>/, "");

const authorized = (comprobante: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><autorizacion><estado>AUTORIZADO</estado>` +
  `<numeroAutorizacion>${KEY}</numeroAutorizacion>` +
  `<fechaAutorizacion>2026-05-13T10:22:33-05:00</fechaAutorizacion>` +
  `<ambiente>PRODUCCIÓN</ambiente><comprobante>${comprobante}</comprobante><mensajes/></autorizacion>`;

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const VARIANTS: Record<string, string> = {
  "factura firmada sin envoltura (facturador del SRI)": BARE,
  "autorización con CDATA": authorized(`<![CDATA[<?xml version="1.0" encoding="UTF-8"?>${factura}]]>`),
  "autorización con el comprobante escapado": authorized(escape(`<?xml version="1.0" encoding="UTF-8"?>${factura}`)),
  "respuesta SOAP del web service de autorización":
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>` +
    `<ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion">` +
    `<RespuestaAutorizacionComprobante><claveAccesoConsultada>${KEY}</claveAccesoConsultada>` +
    `<numeroComprobantes>1</numeroComprobantes><autorizaciones>` +
    authorized(`<![CDATA[${factura}]]>`).replace(/^<\?xml[^>]*\?>/, "") +
    `</autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`,
};

describe("access key", () => {
  it("validates the real clave", () => {
    assert.equal(isValidAccessKey(KEY), true);
    assert.equal(accessKeyCheckDigit(KEY.slice(0, 48)), 6);
  });

  it("splits it into its parts", () => {
    assert.deepEqual(parseAccessKey(KEY), {
      issueDay: "2026-05-13",
      docType: "01",
      ruc: "0104885694001",
      environment: "PRODUCCION",
      establishment: "001",
      emissionPoint: "001",
      sequential: "000000001",
      numericCode: "63293016",
      emissionType: "1",
      checkDigit: 6,
    });
  });

  it("rejects a wrong check digit or length", () => {
    assert.equal(parseAccessKey(KEY.slice(0, 48) + "7"), null);
    assert.equal(parseAccessKey(KEY.slice(1)), null);
  });

  it("finds the clave inside RIDE text, even wrapped or spaced", () => {
    assert.equal(findAccessKey(`NÚMERO DE AUTORIZACIÓN\n${KEY}\nAMBIENTE: PRODUCCIÓN`), KEY);
    assert.equal(findAccessKey(`Clave: ${KEY.slice(0, 25)}\n${KEY.slice(25)}`), KEY);
    assert.equal(findAccessKey(`RUC 0104885694001 Tel 0960004989`), null);
  });
});

describe("parseSriInvoiceXml", () => {
  for (const [name, xml] of Object.entries(VARIANTS)) {
    it(`reads ${name}`, () => {
      const inv = parseSriInvoiceXml(xml);
      assert.equal(inv.accessKey, KEY);
      assert.equal(inv.number, "001-001-000000001");
      assert.equal(inv.issueDay, "2026-05-13");
      assert.equal(inv.environment, "PRODUCCION");
      assert.equal(inv.emitter.ruc, "0104885694001");
      assert.equal(inv.emitter.tradeName, "VEEGSOFT");
      assert.equal(inv.emitter.rimpeLegend, "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
      assert.equal(inv.buyer.id, "0102030405");
      assert.equal(inv.buyer.name, "CLIENTE DE PRUEBA S.A.");
      assert.equal(inv.subtotalCents, 100);
      assert.equal(inv.vatCents, 0);
      assert.equal(inv.vatRate, 0);
      assert.equal(inv.totalCents, 100);
      assert.equal(inv.items.length, 1);
      assert.equal(inv.items[0].totalCents, 100);
      assert.equal(inv.additional.Email, "cliente@example.com");
      assert.deepEqual(inv.warnings, []);
    });
  }

  it("keeps the authorization data when the wrapper is present", () => {
    const inv = parseSriInvoiceXml(VARIANTS["autorización con CDATA"]);
    assert.equal(inv.authorization?.status, "AUTORIZADO");
    assert.equal(inv.authorization?.number, KEY);
    assert.equal(inv.authorization?.at, "2026-05-13T10:22:33-05:00");
    assert.equal(parseSriInvoiceXml(BARE).authorization, null);
  });

  it("reads a 15% IVA invoice", () => {
    const xml = BARE.replace(
      /<totalConImpuestos>[\s\S]*<\/totalConImpuestos>/,
      "<totalConImpuestos><totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>" +
        "<baseImponible>1.00</baseImponible><valor>0.15</valor></totalImpuesto></totalConImpuestos>",
    ).replace("<importeTotal>1.00</importeTotal>", "<importeTotal>1.15</importeTotal>");
    const inv = parseSriInvoiceXml(xml);
    assert.equal(inv.vatCents, 15);
    assert.equal(inv.vatRate, 15);
    assert.equal(inv.totalCents, 115);
    assert.deepEqual(inv.warnings, []);
  });

  it("warns when totals do not add up", () => {
    const inv = parseSriInvoiceXml(BARE.replace("<importeTotal>1.00</importeTotal>", "<importeTotal>2.00</importeTotal>"));
    assert.match(inv.warnings.join(" "), /total no cuadra/);
  });

  it("warns when the clave does not match the fields", () => {
    const inv = parseSriInvoiceXml(BARE.replace("<secuencial>000000001</secuencial>", "<secuencial>000000002</secuencial>"));
    assert.match(inv.warnings.join(" "), /no coincide con el secuencial/);
  });

  it("warns about the test environment", () => {
    const first48 = KEY.slice(0, 23) + "1" + KEY.slice(24, 48);
    const testKey = first48 + accessKeyCheckDigit(first48);
    const xml = BARE.replace(KEY, testKey).replace("<ambiente>2</ambiente>", "<ambiente>1</ambiente>");
    const inv = parseSriInvoiceXml(xml);
    assert.equal(inv.environment, "PRUEBAS");
    assert.deepEqual(inv.warnings, ["La factura es del ambiente de PRUEBAS del SRI: no tiene validez tributaria."]);
  });

  it("warns when the SRI did not authorize it", () => {
    const xml = VARIANTS["autorización con CDATA"].replace(">AUTORIZADO<", ">NO AUTORIZADO<");
    assert.match(parseSriInvoiceXml(xml).warnings.join(" "), /no autorizó/);
  });

  it("rejects files that are not an SRI invoice", () => {
    assert.throws(() => parseSriInvoiceXml("no es xml <"), SriXmlError);
    assert.throws(() => parseSriInvoiceXml("<html><body/></html>"), SriXmlError);
    assert.throws(
      () => parseSriInvoiceXml(BARE.replace("<codDoc>01</codDoc>", "<codDoc>04</codDoc>")),
      /no una factura/,
    );
  });
});
