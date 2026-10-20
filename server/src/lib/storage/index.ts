import { StorageDriver } from "./storage.interface";
import { LocalDiskDriver } from "./local-disk.driver";
import { S3Driver } from "./s3.driver";
import { env } from "../../config/env";

let storageDriverInstance: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (storageDriverInstance) {
    return storageDriverInstance;
  }

  if (env.STORAGE_DRIVER === "s3") {
    storageDriverInstance = new S3Driver();
  } else {
    storageDriverInstance = new LocalDiskDriver(env.LOCAL_UPLOAD_DIR);
  }

  return storageDriverInstance;
}

export * from "./storage.interface";
export * from "./local-disk.driver";
export * from "./s3.driver";
