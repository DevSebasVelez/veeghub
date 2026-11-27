import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import forge from "node-forge";

// The electronic signature (.p12) is the emitter's legal signature (plan §3.4):
// - encrypted at rest with AES-256-GCM under SRI_CERT_KEY (32 random bytes,
//   base64). No fallback key, not even in development.
// - its password lives only in SRI_CERT_PASSWORD; no screen asks for it.
// - nothing here logs, returns or serializes the file or the password.

export class SriCertificateError extends Error {}

/** process.env, or a stand-in in tests. */
type Env = Record<string, string | undefined>;

const ALGORITHM = "aes-256-gcm";
/** Binds the ciphertext to its purpose: a blob from another feature won't decrypt. */
const AAD = Buffer.from("veeghub:sri-certificate:v1");

function certificateKey(env: Env = process.env) {
  const raw = env.SRI_CERT_KEY;
  if (!raw) {
    throw new SriCertificateError(
      "Falta SRI_CERT_KEY (32 bytes en base64, p. ej. `openssl rand -base64 32`).",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new SriCertificateError("SRI_CERT_KEY debe ser de 32 bytes en base64.");
  }
  return key;
}

export function certificatePassword(env: Env = process.env) {
  const password = env.SRI_CERT_PASSWORD;
  if (password == null || password === "") {
    throw new SriCertificateError("Falta SRI_CERT_PASSWORD, la clave del archivo .p12.");
  }
  return password;
}

export type EncryptedCertificate = { encryptedData: string; iv: string; authTag: string };

export function encryptCertificate(p12: Buffer, env?: Env): EncryptedCertificate {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, certificateKey(env), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(p12), cipher.final()]);
  return {
    encryptedData: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptCertificate(stored: EncryptedCertificate, env?: Env) {
  try {
    const decipher = createDecipheriv(ALGORITHM, certificateKey(env), Buffer.from(stored.iv, "base64"));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(stored.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(stored.encryptedData, "base64")),
      decipher.final(),
    ]);
  } catch (error) {
    if (error instanceof SriCertificateError) throw error;
    throw new SriCertificateError(
      "No se pudo descifrar la firma electrónica. ¿Cambió SRI_CERT_KEY? Vuelve a subir el .p12.",
    );
  }
}

export type CertificateInfo = {
  holder: string;
  holderId: string | null;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
};

function attribute(name: forge.pki.Certificate["subject"], ...keys: string[]) {
  for (const key of keys) {
    const found = name.attributes.find((a) => a.shortName === key || a.name === key || a.type === key);
    if (found?.value) return String(found.value);
  }
  return null;
}

/**
 * Opens the .p12 with its password and describes the signing certificate:
 * the one paired with the private key (a .p12 may also carry the CA chain).
 */
export function readCertificate(p12: Buffer, password: string): CertificateInfo {
  let pkcs12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12.toString("binary")));
    pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    throw new SriCertificateError(
      "No se pudo abrir el .p12: el archivo no es válido o SRI_CERT_PASSWORD no es su clave.",
    );
  }

  const keyBags = [
    ...(pkcs12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(pkcs12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const certBags = pkcs12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const key = keyBags.find((bag) => bag.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!key) throw new SriCertificateError("El .p12 no contiene una llave privada.");

  const certificate = certBags
    .map((bag) => bag.cert)
    .find((cert): cert is forge.pki.Certificate => {
      const publicKey = cert?.publicKey as forge.pki.rsa.PublicKey | undefined;
      return Boolean(publicKey?.n && publicKey.n.equals(key.n));
    });
  if (!certificate) throw new SriCertificateError("El .p12 no contiene el certificado de su llave.");

  return {
    holder: attribute(certificate.subject, "CN") ?? "(sin nombre)",
    // Security Data and other Ecuadorian CAs put the cédula/RUC in
    // serialNumber (2.5.4.5) of the subject.
    holderId: attribute(certificate.subject, "serialNumber", "2.5.4.5"),
    issuer: attribute(certificate.issuer, "CN", "O") ?? "(sin emisor)",
    serialNumber: certificate.serialNumber,
    validFrom: certificate.validity.notBefore,
    validTo: certificate.validity.notAfter,
  };
}

const DAY_MS = 86_400_000;

/** Days until the certificate expires (negative once expired). */
export function daysUntilExpiry(validTo: Date, now = new Date()) {
  return Math.floor((validTo.getTime() - now.getTime()) / DAY_MS);
}

/** Warn this many days before expiry (plan §3.4). */
export const EXPIRY_WARNING_DAYS = 30;
