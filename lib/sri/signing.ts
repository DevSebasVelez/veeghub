import { signInvoiceXml } from "ec-sri-invoice-signer";

import type { SriEnvironment } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import {
  SriCertificateError,
  certificatePassword,
  decryptCertificate,
  encryptCertificate,
  readCertificate,
} from "@/lib/sri/certificate";

// XAdES-BES signature of an SRI factura with the stored .p12, through
// ec-sri-invoice-signer (tested with Security Data certificates). Every
// signature leaves an SriSigningEvent.

/** Pure: signs with a .p12 already in memory. Used by signStoredInvoice and the tests. */
export function signInvoiceWith(xml: string, p12: Buffer, password: string) {
  try {
    return signInvoiceXml(xml, p12, { pkcs12Password: password });
  } catch (error) {
    const name = error instanceof Error ? error.constructor.name : "";
    const message = error instanceof Error ? error.message : "";
    if (name === "UnsuportedPkcs12Error" || /pkcs#?12|invalid password/i.test(message)) {
      throw new SriCertificateError("La firma electrónica no se pudo usar: archivo o clave incorrectos.");
    }
    throw error;
  }
}

export async function getActiveCertificate() {
  return prisma.sriCertificate.findFirst({
    where: { active: true },
    select: {
      id: true,
      holder: true,
      holderId: true,
      issuer: true,
      serialNumber: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
    },
  });
}

/**
 * Signs an unsigned factura with the active certificate and logs it. Refuses
 * when there is no certificate or it is not valid today: the SRI would
 * answer error 39 anyway.
 */
export async function signStoredInvoice(
  xml: string,
  context: {
    accessKey: string;
    environment: SriEnvironment;
    invoiceId?: string | null;
    purpose: string;
  },
) {
  const stored = await prisma.sriCertificate.findFirst({ where: { active: true } });
  if (!stored) {
    throw new SriCertificateError("No hay firma electrónica cargada. Súbela en Finanzas › Impuestos.");
  }
  const now = new Date();
  if (stored.validTo < now) throw new SriCertificateError("La firma electrónica está caducada.");
  if (stored.validFrom > now) throw new SriCertificateError("La firma electrónica aún no está vigente.");

  const signed = signInvoiceWith(xml, decryptCertificate(stored), certificatePassword());

  await prisma.sriSigningEvent.create({
    data: {
      certificateId: stored.id,
      invoiceId: context.invoiceId ?? null,
      accessKey: context.accessKey,
      environment: context.environment,
      purpose: context.purpose,
    },
  });
  return signed;
}

/**
 * Stores a new .p12: opens it with SRI_CERT_PASSWORD (so a wrong file or
 * password fails here, not at the first invoice), encrypts it and makes it the
 * only active one. Returns the certificate's description, never the file.
 */
export async function storeCertificate(p12: Buffer) {
  const info = readCertificate(p12, certificatePassword());
  if (info.validTo < new Date()) {
    throw new SriCertificateError("Esa firma electrónica ya caducó.");
  }
  // Fails before touching the database if it cannot actually sign.
  signInvoiceWith(PROBE_XML, p12, certificatePassword());

  const encrypted = encryptCertificate(p12);
  await prisma.$transaction([
    prisma.sriCertificate.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.sriCertificate.create({ data: { ...encrypted, ...info, active: true } }),
  ]);
  return info;
}

/** Minimal factura the signer accepts, to prove a new .p12 can sign. Never sent. */
const PROBE_XML =
  '<factura id="comprobante" version="1.1.0"><infoTributaria><ambiente>1</ambiente></infoTributaria></factura>';
