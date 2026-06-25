import { createHash, randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ATTACHMENT_FILE_NAME_MAX_LENGTH = 120;
const MAX_FILE_SIZE_BYTES = 125_000_000;
const PRESIGNED_URL_TTL_SECONDS = 900;

export type R2BucketConfig = {
  bucketName: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export type PresignedUploadIntent = {
  objectKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  downloadUrl: string;
  expiresAt: string;
  ttlSeconds: number;
};

export type PresignedDownloadIntent = {
  downloadUrl: string;
  expiresAt: string;
  ttlSeconds: number;
};

export const DEFAULT_R2_REGION = "auto";

export function getR2BucketConfigFromEnv(): R2BucketConfig {
  const bucketName = (process.env.R2_BUCKET_NAME ?? "").trim();
  const endpoint = (process.env.R2_ENDPOINT ?? "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();

  if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 configuration is incomplete.");
  }

  return {
    bucketName,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: (process.env.R2_REGION ?? DEFAULT_R2_REGION).trim() || DEFAULT_R2_REGION,
  };
}

export function createAttachmentObjectKey(input: {
  uploaderId: string;
  fileName: string;
}): string {
  const safeFileName = sanitizeFileName(input.fileName);
  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const keySuffix = randomUUID().replace(/-/g, "");

  return `attachments/${input.uploaderId}/${datePrefix}/${keySuffix}-${safeFileName}`;
}

export function getAttachmentValidationLimits() {
  return {
    maxFileNameLength: ATTACHMENT_FILE_NAME_MAX_LENGTH,
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    uploadTtlSeconds: PRESIGNED_URL_TTL_SECONDS,
  } as const;
}

export function createPresignedUploadIntent(input: {
  config: R2BucketConfig;
  objectKey: string;
  contentType: string;
  ttlSeconds?: number;
}): Promise<PresignedUploadIntent> {
  const ttlSeconds = input.ttlSeconds ?? PRESIGNED_URL_TTL_SECONDS;

  const s3Client = createS3Client(input.config);
  const putCommand = new PutObjectCommand({
    Bucket: input.config.bucketName,
    Key: input.objectKey,
    ContentType: input.contentType,
  });

  const objectExpiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const downloadCommand = new GetObjectCommand({
    Bucket: input.config.bucketName,
    Key: input.objectKey,
  });

  return Promise.all([
    getSignedUrl(s3Client, putCommand, {
      expiresIn: ttlSeconds,
    }),
    getSignedUrl(s3Client, downloadCommand, {
      expiresIn: ttlSeconds,
    }),
  ]).then(([uploadUrl, downloadUrl]) => ({
    objectKey: input.objectKey,
    uploadUrl,
    uploadHeaders: {
      "content-type": input.contentType,
    },
    downloadUrl,
    expiresAt: objectExpiresAt.toISOString(),
    ttlSeconds,
  }));
}

export function createPresignedDownloadIntent(input: {
  config: R2BucketConfig;
  objectKey: string;
  ttlSeconds?: number;
}): Promise<PresignedDownloadIntent> {
  const ttlSeconds = input.ttlSeconds ?? PRESIGNED_URL_TTL_SECONDS;

  const s3Client = createS3Client(input.config);
  const downloadCommand = new GetObjectCommand({
    Bucket: input.config.bucketName,
    Key: input.objectKey,
  });

  return getSignedUrl(s3Client, downloadCommand, {
    expiresIn: ttlSeconds,
  }).then((downloadUrl) => ({
    downloadUrl,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    ttlSeconds,
  }));
}

function createS3Client(config: R2BucketConfig) {
  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    region: config.region ?? DEFAULT_R2_REGION,
    endpoint: config.endpoint,
    forcePathStyle: true,
  });
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/\s+/g, "_");

  if (normalized.length === 0) {
    throw new Error("File name is required.");
  }

  if (normalized.length > ATTACHMENT_FILE_NAME_MAX_LENGTH) {
    throw new Error("File name is too long.");
  }

  const hash = createHash("sha1")
    .update(normalized)
    .digest("base64url")
    .slice(0, 6);

  const safeName = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();

  const extensionIndex = safeName.lastIndexOf(".");
  if (extensionIndex === -1) {
    return `${safeName}-${hash}`;
  }

  const name = safeName.slice(0, extensionIndex) || "attachment";
  const extension = safeName.slice(extensionIndex);
  return `${name}.${extension}`;
}
