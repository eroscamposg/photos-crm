import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function isStorageConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export function storageClient() {
  if (!isStorageConfigured()) throw new Error("Storage is not configured");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export function bucketName() {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET is not set");
  return bucket;
}

export async function presignPut(key: string, contentType: string, expiresIn = 900) {
  return getSignedUrl(
    storageClient(),
    new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export async function presignGet(key: string, expiresIn = 900) {
  return getSignedUrl(storageClient(), new GetObjectCommand({ Bucket: bucketName(), Key: key }), { expiresIn });
}

export async function objectExists(key: string) {
  await storageClient().send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
}

export async function readObject(key: string) {
  const response = await storageClient().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  if (!response.Body) throw new Error(`Empty object ${key}`);
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function writeObject(key: string, body: Buffer, contentType: string) {
  await storageClient().send(
    new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function storageHealth(): Promise<"ok" | "not_configured" | "error"> {
  if (!isStorageConfigured()) return "not_configured";
  try {
    await storageClient().send(new HeadBucketCommand({ Bucket: bucketName() }));
    return "ok";
  } catch (error) {
    console.error("[storage] health check failed", error);
    return "error";
  }
}

export function normalizeUploadType(filename: string, contentType: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (contentType === "image/jpeg" || contentType === "image/webp" || contentType === "image/heic" || contentType === "image/heif") {
    return contentType === "image/heif" ? "image/heic" : contentType;
  }
  return null;
}

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
