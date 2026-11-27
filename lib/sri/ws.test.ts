import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { parseSriInvoiceXml } from "@/lib/sri/invoice-xml";
import { checkAuthorizationStatus, fetchAuthorization, sendToReception } from "@/lib/sri/ws";

// Responses captured from cel.sri.gob.ec (2026-11-27), plus an authorized one
// built from the same shape, with fetch stubbed: tests never call the SRI.
const KEY = "1305202601010488569400120010010000000016329301616";
const realFetch = globalThis.fetch;
let calls: Array<{ url: string; body: string }> = [];

function stub(...responses: Array<string | Error>) {
  calls = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body) });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return new Response(next ?? "", { status: 200 });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const EMPTY_AUTH =
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${KEY}</claveAccesoConsultada><numeroComprobantes>0</numeroComprobantes><autorizaciones/></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const FACTURA = `<factura id="comprobante" version="1.1.0"><infoTributaria><ambiente>2</ambiente><tipoEmision>1</tipoEmision><razonSocial>EMISOR</razonSocial><ruc>0104885694001</ruc><claveAcceso>${KEY}</claveAcceso><codDoc>01</codDoc><estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial></infoTributaria><infoFactura><fechaEmision>13/05/2026</fechaEmision><identificacionComprador>0102030405</identificacionComprador><razonSocialComprador>CLIENTE</razonSocialComprador><totalSinImpuestos>1.00</totalSinImpuestos><totalConImpuestos><totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje><baseImponible>1.00</baseImponible><valor>0.00</valor></totalImpuesto></totalConImpuestos><importeTotal>1.00</importeTotal></infoFactura></factura>`;

const AUTHORIZED =
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${KEY}</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${KEY}</numeroAutorizacion><fechaAutorizacion>2026-05-13T11:05:04-05:00</fechaAutorizacion><ambiente>PRODUCCIÓN</ambiente><comprobante><![CDATA[<?xml version="1.0" encoding="UTF-8"?>${FACTURA}]]></comprobante><mensajes/></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const OUT_OF_RANGE =
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:consultarEstadoAutorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.consultas"><EstadoAutorizacionComprobante><estadoConsulta>RECHAZADA</estadoConsulta><claveAcceso>${KEY}</claveAcceso><mensajes><mensaje><identificador>99</identificador><mensaje>ERROR AL CONSULTAR DATOS DEL SERVICIO WEB</mensaje><informacionAdicional>No es posible validar la clave de acceso ya que la fecha de emision esta fuera del rango permitido.</informacionAdicional><tipo>ERROR</tipo></mensaje></mensajes></EstadoAutorizacionComprobante></ns2:consultarEstadoAutorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

describe("SRI web services", () => {
  it("reports when the SRI does not serve the XML", async () => {
    stub(EMPTY_AUTH);
    assert.deepEqual(await fetchAuthorization(KEY, "PRODUCCION"), { found: false });
    assert.equal(calls[0].url, "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline");
    assert.match(calls[0].body, new RegExp(`<claveAccesoComprobante>${KEY}</claveAccesoComprobante>`));
  });

  it("returns the authorized XML, readable by the invoice parser", async () => {
    stub(AUTHORIZED);
    const result = await fetchAuthorization(KEY, "PRODUCCION");
    assert.equal(result.found, true);
    if (!result.found) return;
    assert.equal(result.status, "AUTORIZADO");
    const inv = parseSriInvoiceXml(result.xml);
    assert.equal(inv.accessKey, KEY);
    assert.equal(inv.authorization?.at, "2026-05-13T11:05:04-05:00");
    assert.equal(inv.totalCents, 100);
  });

  it("uses the test host for the PRUEBAS environment", async () => {
    stub(EMPTY_AUTH);
    await fetchAuthorization(KEY, "PRUEBAS");
    assert.match(calls[0].url, /^https:\/\/celcer\.sri\.gob\.ec\//);
  });

  it("reads the status query and its messages", async () => {
    stub(OUT_OF_RANGE);
    const status = await checkAuthorizationStatus(KEY, "PRODUCCION");
    assert.equal(status.state, "RECHAZADA");
    assert.equal(status.messages[0].text, "ERROR AL CONSULTAR DATOS DEL SERVICIO WEB");
    assert.match(status.messages[0].detail ?? "", /fuera del rango/);
  });

  it("retries once when the SRI hangs, then succeeds", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    stub(timeout, OUT_OF_RANGE);
    const status = await checkAuthorizationStatus(KEY, "PRODUCCION");
    assert.equal(calls.length, 2);
    assert.equal(status.state, "RECHAZADA");
  });

  it("gives a clear error when the SRI never answers", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    stub(timeout, timeout);
    await assert.rejects(() => checkAuthorizationStatus(KEY, "PRODUCCION"), /no respondió a tiempo/);
  });

  const RECEIVED =
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>RECIBIDA</estado><comprobantes/></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>`;
  const RETURNED =
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>DEVUELTA</estado><comprobantes><comprobante><claveAcceso>${KEY}</claveAcceso><mensajes><mensaje><identificador>43</identificador><mensaje>CLAVE ACCESO REGISTRADA</mensaje><tipo>ERROR</tipo></mensaje></mensajes></comprobante></comprobantes></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>`;

  it("sends the signed XML in base64 to the reception service of the given environment", async () => {
    stub(RECEIVED);
    const result = await sendToReception("<factura>ñ</factura>", "PRUEBAS");
    assert.deepEqual(result, { state: "RECIBIDA", messages: [] });
    assert.equal(calls[0].url, "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline");
    const sent = /<xml>([^<]+)<\/xml>/.exec(calls[0].body)![1];
    assert.equal(Buffer.from(sent, "base64").toString("utf8"), "<factura>ñ</factura>");
  });

  it("reads why a document came back", async () => {
    stub(RETURNED);
    const result = await sendToReception("<factura/>", "PRUEBAS");
    assert.equal(result.state, "DEVUELTA");
    assert.deepEqual(result.messages, [{ id: "43", text: "CLAVE ACCESO REGISTRADA", detail: null, type: "ERROR" }]);
  });

  it("never retries a reception: the outcome of a timeout is unknown", async () => {
    stub(Object.assign(new Error("t"), { name: "TimeoutError" }), RECEIVED);
    await assert.rejects(sendToReception("<factura/>", "PRUEBAS"), /no respondió a tiempo/);
    assert.equal(calls.length, 1);
  });
});

