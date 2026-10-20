import { Readable } from "stream";

export interface StorageStreamResult {
  stream: Readable;
  contentLength: number;
  contentType: string;
}

export interface StorageDriver {
  put(
    key: string,
    data: Buffer | Readable,
    contentType: string
  ): Promise<void>;

  getStream(
    key: string,
    range?: { start: number; end?: number }
  ): Promise<StorageStreamResult>;

  delete(key: string): Promise<void>;

  getSignedUrl(
    key: string,
    expiresInSeconds: number,
    attachmentId?: string
  ): Promise<string>;
}
