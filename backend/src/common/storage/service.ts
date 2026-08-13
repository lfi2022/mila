import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileTypeFromBuffer } from "file-type";
import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { RedisService } from "../redis/client.js";
import { readImageDimensions } from "../security/external-url.js";

export type UploadPurpose =
  "product-image" | "list-cover" | "user-upload" | "media-message" | "export";
type UploadPolicy = { bucket: string; mime: RegExp; maxBytes: number; extensions: string[] };

export class StorageService {
  readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly policies: Record<UploadPurpose, UploadPolicy>;

  constructor(
    private readonly config: AppConfig,
    private readonly redis?: RedisService,
  ) {
    this.client = new S3Client({
      endpoint: config.STORAGE_ENDPOINT,
      region: config.STORAGE_REGION,
      forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.STORAGE_ACCESS_KEY,
        secretAccessKey: config.STORAGE_SECRET_KEY,
      },
    });
    this.signingClient = new S3Client({
      endpoint: config.STORAGE_PUBLIC_ENDPOINT,
      region: config.STORAGE_REGION,
      forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.STORAGE_ACCESS_KEY,
        secretAccessKey: config.STORAGE_SECRET_KEY,
      },
    });
    this.policies = {
      "product-image": {
        bucket: config.STORAGE_BUCKET_PRODUCT_IMAGES,
        mime: /^image\/(jpeg|png|webp)$/,
        maxBytes: 8_388_608,
        extensions: ["jpg", "png", "webp"],
      },
      "list-cover": {
        bucket: config.STORAGE_BUCKET_LIST_COVERS,
        mime: /^image\/(jpeg|png|webp)$/,
        maxBytes: 8_388_608,
        extensions: ["jpg", "png", "webp"],
      },
      "user-upload": {
        bucket: config.STORAGE_BUCKET_USER_UPLOADS,
        mime: /^(image\/(jpeg|png|webp)|application\/pdf)$/,
        maxBytes: config.STORAGE_MAX_UPLOAD_BYTES,
        extensions: ["jpg", "png", "webp", "pdf"],
      },
      "media-message": {
        bucket: config.STORAGE_BUCKET_MEDIA_MESSAGES,
        mime: /^(audio\/(mpeg|mp4|ogg|webm)|video\/(mp4|webm))$/,
        maxBytes: config.MEDIA_VIDEO_MAX_BYTES,
        extensions: ["mp3", "mp4", "ogg", "webm"],
      },
      export: {
        bucket: config.STORAGE_BUCKET_EXPORTS,
        mime: /^(application\/(json|pdf|zip)|text\/csv)$/,
        maxBytes: config.STORAGE_MAX_UPLOAD_BYTES,
        extensions: ["json", "pdf", "zip", "csv"],
      },
    };
  }

  async ensureBuckets(): Promise<void> {
    for (const bucket of new Set(Object.values(this.policies).map(({ bucket }) => bucket))) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      }
    }
  }

  async check(): Promise<"up" | "down"> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.config.STORAGE_BUCKET_USER_UPLOADS }),
      );
      return "up";
    } catch {
      return "down";
    }
  }

  async presignUpload(userId: string, purpose: UploadPurpose, mimeType: string, sizeBytes: number) {
    const policy = this.policy(purpose, mimeType, sizeBytes);
    const extension = extensionForMime(mimeType);
    if (!policy.extensions.includes(extension))
      throw new AppError(415, "UPLOAD_TYPE_UNSUPPORTED", "File type is not supported");
    const key = `${userId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: policy.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
      Metadata: { owner: userId, purpose, scan: "pending" },
    });
    return {
      key,
      bucket: policy.bucket,
      method: "PUT" as const,
      headers: { "content-type": mimeType },
      expiresIn: this.config.STORAGE_SIGNED_URL_TTL_SECONDS,
      uploadUrl: await getSignedUrl(this.signingClient, command, {
        expiresIn: this.config.STORAGE_SIGNED_URL_TTL_SECONDS,
      }),
    };
  }

  async verifyUpload(
    userId: string,
    purpose: UploadPurpose,
    key: string,
    mimeType: string,
    sizeBytes: number,
  ) {
    this.assertOwnedKey(userId, key);
    const policy = this.policy(purpose, mimeType, sizeBytes);
    const head = await this.client.send(new HeadObjectCommand({ Bucket: policy.bucket, Key: key }));
    if (
      head.ContentLength !== sizeBytes ||
      head.ContentType !== mimeType ||
      head.Metadata?.["owner"] !== userId ||
      head.Metadata?.["purpose"] !== purpose
    ) {
      throw new AppError(
        422,
        "UPLOAD_MISMATCH",
        "Uploaded object does not match its signed declaration",
      );
    }
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: policy.bucket, Key: key, Range: "bytes=0-4095" }),
    );
    const bytes = object.Body
      ? Buffer.from(await object.Body.transformToByteArray())
      : Buffer.alloc(0);
    const detected = await fileTypeFromBuffer(bytes);
    if (detected && detected.mime !== mimeType)
      throw new AppError(
        415,
        "UPLOAD_SIGNATURE_MISMATCH",
        "File signature does not match MIME type",
      );
    if (!detected && !["application/json", "text/csv"].includes(mimeType))
      throw new AppError(415, "UPLOAD_SIGNATURE_UNKNOWN", "File signature could not be validated");
    const complete = await this.client.send(
      new GetObjectCommand({ Bucket: policy.bucket, Key: key }),
    );
    const checksum = createHash("sha256")
      .update(
        complete.Body ? Buffer.from(await complete.Body.transformToByteArray()) : Buffer.alloc(0),
      )
      .digest("hex");
    if (this.redis) {
      if (this.redis.client.status === "wait") await this.redis.client.connect();
      await this.redis.client.xadd(
        "stream:media-scan",
        "*",
        "bucket",
        policy.bucket,
        "key",
        key,
        "owner",
        userId,
        "createdAt",
        new Date().toISOString(),
      );
    }
    return { bucket: policy.bucket, key, checksum, scanStatus: "PENDING" as const };
  }

  async signedDownload(purpose: UploadPurpose, key: string) {
    const policy = this.policies[purpose];
    return getSignedUrl(
      this.signingClient,
      new GetObjectCommand({ Bucket: policy.bucket, Key: key }),
      { expiresIn: this.config.STORAGE_SIGNED_URL_TTL_SECONDS },
    );
  }

  async storeRemoteProductImage(key: string, body: Buffer, contentType: string) {
    if (!key.startsWith("remote/") || key.includes("..")) {
      throw new AppError(400, "STORAGE_KEY_INVALID", "Remote media key is invalid");
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.STORAGE_BUCKET_PRODUCT_IMAGES,
        Key: key,
        Body: body,
        ContentLength: body.length,
        ContentType: contentType,
        Metadata: { purpose: "product-image", scan: "clean", origin: "authorized-remote" },
      }),
    );
  }

  async signedCleanDownload(purpose: UploadPurpose, key: string) {
    const policy = this.policies[purpose];
    const head = await this.client.send(new HeadObjectCommand({ Bucket: policy.bucket, Key: key }));
    if (head.Metadata?.["scan"] !== "clean") {
      throw new AppError(409, "MEDIA_SCAN_PENDING", "Media is unavailable until scanning succeeds");
    }
    return this.signedDownload(purpose, key);
  }

  async uploadScanStatus(purpose: UploadPurpose, key: string) {
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.policies[purpose].bucket, Key: key }),
    );
    return head.Metadata?.["scan"] ?? "pending";
  }

  async markScanStatus(bucket: string, key: string, status: "clean" | "infected") {
    const allowed = new Set(Object.values(this.policies).map((policy) => policy.bucket));
    if (!allowed.has(bucket)) throw new AppError(400, "STORAGE_BUCKET_INVALID", "Unknown bucket");
    const head = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    await this.client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: key,
        CopySource: `${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
        ContentType: head.ContentType,
        MetadataDirective: "REPLACE",
        Metadata: { ...head.Metadata, scan: status },
      }),
    );
  }

  async validateUploadedImage(bucket: string, key: string) {
    const imageBuckets = new Set([
      this.config.STORAGE_BUCKET_PRODUCT_IMAGES,
      this.config.STORAGE_BUCKET_LIST_COVERS,
    ]);
    if (!imageBuckets.has(bucket)) {
      throw new AppError(
        503,
        "MALWARE_SCANNER_REQUIRED",
        "Non-image media requires a malware scanner",
      );
    }
    const object = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = object.Body
      ? Buffer.from(await object.Body.transformToByteArray())
      : Buffer.alloc(0);
    const detected = await fileTypeFromBuffer(body);
    if (
      !detected ||
      !/^image\/(jpeg|png|webp)$/.test(detected.mime) ||
      detected.mime !== object.ContentType
    ) {
      await this.markScanStatus(bucket, key, "infected");
      throw new AppError(415, "UPLOAD_SIGNATURE_MISMATCH", "Uploaded image signature is invalid");
    }
    const dimensions = readImageDimensions(body, detected.mime);
    if (dimensions && dimensions.width * dimensions.height > this.config.MAX_IMAGE_PIXELS) {
      await this.markScanStatus(bucket, key, "infected");
      throw new AppError(413, "IMAGE_DIMENSIONS_TOO_LARGE", "Uploaded image dimensions are unsafe");
    }
    await this.markScanStatus(bucket, key, "clean");
  }

  async readObject(purpose: UploadPurpose, key: string, requireClean = false) {
    const policy = this.policies[purpose];
    if (requireClean) {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: policy.bucket, Key: key }),
      );
      if (head.Metadata?.["scan"] !== "clean") {
        throw new AppError(404, "ASSET_NOT_AVAILABLE", "Asset is not available");
      }
    }
    return this.client.send(new GetObjectCommand({ Bucket: policy.bucket, Key: key }));
  }

  async deleteOwned(userId: string, purpose: UploadPurpose, key: string): Promise<void> {
    this.assertOwnedKey(userId, key);
    const policy = this.policies[purpose];
    const head = await this.client.send(new HeadObjectCommand({ Bucket: policy.bucket, Key: key }));
    if (head.Metadata?.["owner"] !== userId) {
      throw new AppError(403, "UPLOAD_NOT_OWNED", "Object does not belong to this account");
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: policy.bucket, Key: key }));
  }

  assertOwnedKey(userId: string, key: string): void {
    if (!key.startsWith(`${userId}/`) || key.includes("..")) {
      throw new AppError(403, "UPLOAD_KEY_INVALID", "Upload key is invalid");
    }
  }

  async close() {
    this.client.destroy();
    this.signingClient.destroy();
  }

  private policy(purpose: UploadPurpose, mimeType: string, sizeBytes: number) {
    const policy = this.policies[purpose];
    if (!policy.mime.test(mimeType) || sizeBytes < 1 || sizeBytes > policy.maxBytes) {
      throw new AppError(413, "UPLOAD_POLICY_REJECTED", "Upload type or size is not allowed");
    }
    return policy;
  }
}

function extensionForMime(mime: string) {
  return (
    (
      {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
        "application/json": "json",
        "application/zip": "zip",
        "text/csv": "csv",
        "audio/mpeg": "mp3",
        "audio/mp4": "mp4",
        "audio/ogg": "ogg",
        "audio/webm": "webm",
        "video/mp4": "mp4",
        "video/webm": "webm",
      } as Record<string, string>
    )[mime] ?? ""
  );
}
