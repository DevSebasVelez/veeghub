import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { describe, it } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";

import { buildInvoiceXml } from "@/lib/sri/build-invoice";
import {
  SriCertificateError,
  daysUntilExpiry,
  decryptCertificate,
  encryptCertificate,
  readCertificate,
} from "@/lib/sri/certificate";
import { SRI_EMITTER } from "@/lib/sri/emitter";
import { rimpeLegend } from "@/lib/sri/regime";
import { signInvoiceWith } from "@/lib/sri/signing";

// A throwaway self-signed .p12 made here, shaped like a Security Data one
// (CN = holder, serialNumber = cédula/RUC). Never the real signature.
function makeP12(password: string, { days = 365 } = {}) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "0a1b2c3d";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + days * 86_400_000);
  const subject = [
    { name: "commonName", value: "VELEZ PALOMEQUE CHRISTIAN SEBASTIAN" },
    { type: "2.5.4.5", value: "0104885694001" },
    { name: "countryName", value: "EC" },
  ];
  cert.setSubject(subject);
  cert.setIssuer([{ name: "commonName", value: "AUTORIDAD DE PRUEBA VEEGHUB" }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: "3des" });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");
}

const PASSWORD = "clave-de-prueba";
const P12 = makeP12(PASSWORD);
const ENV = { SRI_CERT_KEY: randomBytes(32).toString("base64") };

const UNSIGNED = buildInvoiceXml({
  environment: "PRUEBAS",
  emitter: SRI_EMITTER,
  rimpeLegend: rimpeLegend("RIMPE_NEGOCIO_POPULAR"),
  allowedVatRates: [0],
  establishment: "001",
  emissionPoint: "002",
  sequential: 1,
  issueDay: "2026-11-27",
  buyer: { idType: "07", id: "9999999999999", name: "CONSUMIDOR FINAL" },
  items: [{ description: "Prueba de firma", quantity: "1", unitPrice: "1", vatCode: "0" }],
  payments: [{ method: "20" }],
});

describe("SRI certificate", () => {
  it("describes the signing certificate of a .p12", () => {
    const info = readCertificate(P12, PASSWORD);
    assert.equal(info.holder, "VELEZ PALOMEQUE CHRISTIAN SEBASTIAN");
    assert.equal(info.holderId, "0104885694001");
    assert.equal(info.issuer, "AUTORIDAD DE PRUEBA VEEGHUB");
    assert.equal(info.serialNumber, "0a1b2c3d");
    assert.ok(daysUntilExpiry(info.validTo) >= 363);
  });

  it("refuses a wrong password or a file that is not a .p12", () => {
    assert.throws(() => readCertificate(P12, "otra"), SriCertificateError);
    assert.throws(() => readCertificate(Buffer.from("no soy un p12"), PASSWORD), SriCertificateError);
  });

  it("encrypts the file and its password at rest and gives them back", () => {
    const stored = encryptCertificate(P12, PASSWORD, ENV);
    assert.ok(!stored.encryptedData.includes(P12.toString("base64").slice(0, 40)));
    assert.ok(!JSON.stringify(stored).includes(PASSWORD));
    const opened = decryptCertificate(stored, ENV);
    assert.ok(opened.p12.equals(P12));
    assert.equal(opened.password, PASSWORD);
  });

  it("will not open the password from the file's columns or the other way round", () => {
    const stored = encryptCertificate(P12, PASSWORD, ENV);
    const swapped = {
      ...stored,
      encryptedData: stored.encryptedPassword,
      iv: stored.passwordIv,
      authTag: stored.passwordTag,
    };
    assert.throws(() => decryptCertificate(swapped, ENV), SriCertificateError);
  });

  it("refuses to decrypt with another key or a tampered blob", () => {
    const stored = encryptCertificate(P12, PASSWORD, ENV);
    const other = { SRI_CERT_KEY: randomBytes(32).toString("base64") };
    assert.throws(() => decryptCertificate(stored, other), SriCertificateError);

    const bytes = Buffer.from(stored.encryptedData, "base64");
    bytes[10] ^= 0xff;
    assert.throws(
      () => decryptCertificate({ ...stored, encryptedData: bytes.toString("base64") }, ENV),
      SriCertificateError,
    );
  });

  it("has no fallback key", () => {
    assert.throws(() => encryptCertificate(P12, PASSWORD, {}), /SRI_CERT_KEY/);
    assert.throws(() => encryptCertificate(P12, PASSWORD, { SRI_CERT_KEY: "corta" }), /32 bytes/);
  });
});

describe("SRI signature", () => {
  const signed = signInvoiceWith(UNSIGNED.xml, P12, PASSWORD);

  it("adds an enveloped XAdES-BES signature to the factura", () => {
    assert.match(signed, /<ds:Signature [^>]*Id="Signature-/);
    assert.match(signed, /<ds:Reference [^>]*URI="#comprobante"/);
    assert.match(signed, /<xades:SignedProperties /);
    assert.match(signed, /<xades:SigningTime>/);
    assert.match(signed, /<\/ds:Signature><\/factura>$/);
    // The document itself is untouched.
    assert.ok(signed.startsWith(UNSIGNED.xml.replace("</factura>", "")));
  });

  it("verifies cryptographically and breaks if the invoice changes", () => {
    const verify = (xml: string) => {
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const signature = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0];
      const cert = /<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/.exec(xml)![1].replace(/\s+/g, "");
      const sig = new SignedXml({
        publicCert: `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`,
        getCertFromKeyInfo: () => null,
      });
      sig.loadSignature(signature.toString());
      try {
        return sig.checkSignature(xml);
      } catch {
        return false;
      }
    };
    assert.equal(verify(signed), true);
    const tampered = signed.replace("<importeTotal>1.00</importeTotal>", "<importeTotal>9.00</importeTotal>");
    assert.notEqual(tampered, signed);
    assert.equal(verify(tampered), false);
  });

  it("still validates against the SRI XSD once signed", { skip: spawnSync("xmllint", ["--version"]).status !== 0 }, () => {
    const xsd = path.join(process.cwd(), "lib/sri/xsd/factura_V1.1.0.xsd");
    execFileSync("xmllint", ["--noout", "--schema", xsd, "-"], { input: signed, stdio: "pipe" });
  });

  it("explains a wrong password instead of a library error", () => {
    assert.throws(() => signInvoiceWith(UNSIGNED.xml, P12, "otra"), SriCertificateError);
  });
});
