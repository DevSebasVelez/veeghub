import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret =
    process.env.CREDENTIALS_ENCRYPTION_KEY ??
    process.env.AUTH_SECRET ??
    "veeghub-development-credentials-secret";

  if (process.env.NODE_ENV === "production" && !process.env.CREDENTIALS_ENCRYPTION_KEY) {
    throw new Error("Define CREDENTIALS_ENCRYPTION_KEY para cifrar credenciales.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    encryptedSecret: encrypted.toString("base64"),
    secretIv: iv.toString("base64"),
    secretTag: tag.toString("base64"),
    secretPreview: maskSecret(secret),
  };
}

export function decryptSecret({
  encryptedSecret,
  secretIv,
  secretTag,
}: {
  encryptedSecret: string;
  secretIv: string;
  secretTag: string;
}) {
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(secretIv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(secretTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedSecret, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function maskSecret(secret: string) {
  if (secret.length <= 4) return "••••";

  return `•••• ${secret.slice(-4)}`;
}
