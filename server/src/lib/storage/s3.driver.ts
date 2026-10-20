import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { StorageDriver, StorageStreamResult } from "./storage.interface";
import { env } from "../../config/env";
import { logger } from "../logger";
import { NotFoundError } from "../errors";

export class S3Driver implements StorageDriver {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error(
        "S3Driver startup failure: Missing required S3 configuration (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)"
      );
    }

    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION || "auto",
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    logger.info(`[STORAGE] S3Driver initialized for bucket: ${this.bucket}`);
  }

  async put(
    key: string,
    data: Buffer | Readable,
    contentType: string
  ): Promise<void> {
    const body = Buffer.isBuffer(data) ? data : await this.streamToBuffer(data);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async getStream(
    key: string,
    range?: { start: number; end?: number }
  ): Promise<StorageStreamResult> {
    const rangeHeader = range
      ? `bytes=${range.start}-${range.end !== undefined ? range.end : ""}`
      : undefined;

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: rangeHeader,
        })
      );

      if (!response.Body) {
        throw new NotFoundError("Object stream body is empty");
      }

      return {
        stream: response.Body as Readable,
        contentLength: response.ContentLength || 0,
        contentType: response.ContentType || "application/octet-stream",
      };
    } catch (err: unknown) {
      logger.error(`S3 getStream failed for key ${key}`, err);
      throw new NotFoundError("Object not found in S3 bucket");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
    } catch (err) {
      logger.error(`S3 delete failed for key ${key}`, err);
    }
  }

  async getSignedUrl(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expiresInSeconds: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    attachmentId?: string
  ): Promise<string> {
    // S3 presigned URL fallback or endpoint generator
    const endpoint = env.S3_ENDPOINT?.replace(/\/$/, "") || `https://${this.bucket}.s3.amazonaws.com`;
    return `${endpoint}/${key}`;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }
}
