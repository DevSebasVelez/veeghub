import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

function getR2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Configura las variables de Cloudflare R2 antes de subir archivos.");
  }

  return {
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
}

function getClient() {
  if (client) return client;

  const config = getR2Config();

  client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: config.credentials,
  });

  return client;
}

export async function uploadToR2({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const { bucket } = getR2Config();

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getR2DownloadUrl(key: string) {
  const { bucket } = getR2Config();

  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: 60 * 5 },
  );
}

export async function getR2ObjectBuffer(key: string) {
  const { bucket } = getR2Config();
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("No se pudo leer el archivo desde R2.");
  }

  const bytes = await response.Body.transformToByteArray();

  return Buffer.from(bytes);
}
