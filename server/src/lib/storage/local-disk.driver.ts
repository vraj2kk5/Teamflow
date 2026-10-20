import fs from "fs";
import path from "path";
import { Readable } from "stream";
import crypto from "crypto";
import { StorageDriver, StorageStreamResult } from "./storage.interface";
import { logger } from "../logger";
import { env } from "../../config/env";
import { NotFoundError } from "../errors";

export class LocalDiskDriver implements StorageDriver {
  private baseDir: string;

  constructor(uploadDir = "uploads") {
    this.baseDir = path.isAbsolute(uploadDir)
      ? uploadDir
      : path.resolve(process.cwd(), uploadDir);

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    logger.warn(
      "⚠️ [STORAGE] LocalDiskDriver initialized. Files stored in: " +
        this.baseDir +
        ". This driver is for local development only and NOT suitable for production deployment."
    );
  }

  private resolvePath(key: string): string {
    const safeKey = key.replace(/\.\./g, "");
    return path.join(this.baseDir, safeKey);
  }

  async put(
    key: string,
    data: Buffer | Readable,
    contentType: string
  ): Promise<void> {
    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (Buffer.isBuffer(data)) {
      await fs.promises.writeFile(filePath, data);
    } else {
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(filePath);
        data.pipe(out);
        out.on("finish", () => resolve());
        out.on("error", (err) => reject(err));
      });
    }

    // Write a tiny metadata companion file to store content-type
    const metaPath = `${filePath}.meta.json`;
    await fs.promises.writeFile(
      metaPath,
      JSON.stringify({ contentType, createdAt: new Date().toISOString() })
    );
  }

  async getStream(
    key: string,
    range?: { start: number; end?: number }
  ): Promise<StorageStreamResult> {
    const filePath = this.resolvePath(key);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("File not found on storage disk");
    }

    const stat = await fs.promises.stat(filePath);
    const totalSize = stat.size;

    let contentType = "application/octet-stream";
    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(await fs.promises.readFile(metaPath, "utf-8"));
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // fallback
      }
    }

    if (range) {
      const start = range.start;
      const end = range.end !== undefined ? range.end : totalSize - 1;
      const stream = fs.createReadStream(filePath, { start, end });
      const contentLength = end - start + 1;
      return { stream, contentLength, contentType };
    }

    const stream = fs.createReadStream(filePath);
    return { stream, contentLength: totalSize, contentType };
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    const metaPath = `${filePath}.meta.json`;

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      if (fs.existsSync(metaPath)) {
        await fs.promises.unlink(metaPath);
      }
    } catch (err) {
      logger.error(`Failed to delete local file for key: ${key}`, err);
    }
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds: number,
    attachmentId?: string
  ): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const payload = JSON.stringify({ key, expiresAt, attachmentId });
    const payloadB64 = Buffer.from(payload).toString("base64url");

    const hmac = crypto
      .createHmac("sha256", env.FILE_TOKEN_SECRET)
      .update(payloadB64)
      .digest("base64url");

    const token = `${payloadB64}.${hmac}`;
    return `/api/files/${token}`;
  }

  public verifyToken(
    token: string
  ): { key: string; expiresAt: number; attachmentId?: string } | null {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, hmac] = parts;
    const expectedHmac = crypto
      .createHmac("sha256", env.FILE_TOKEN_SECRET)
      .update(payloadB64)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(hmac),
        Buffer.from(expectedHmac)
      )
    ) {
      return null;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf-8")
      );
      if (Date.now() > decoded.expiresAt) {
        return null; // Expired
      }
      return decoded;
    } catch {
      return null;
    }
  }
}
