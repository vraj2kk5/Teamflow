import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load environment variables (.env.test if in test mode, otherwise .env)
const isTest = process.env.NODE_ENV === "test";
if (isTest) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });
}
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(5000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
    COOKIE_SAMESITE: z.enum(["lax", "none", "strict"]).default("lax"),
    COOKIE_SECURE: z
      .union([z.boolean(), z.string()])
      .transform((val) => val === true || val === "true")
      .default(false),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    LOCAL_UPLOAD_DIR: z.string().default("uploads"),
    FILE_TOKEN_SECRET: z.string().min(32, "FILE_TOKEN_SECRET must be at least 32 characters"),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    MAX_AUDIO_MB: z.coerce.number().default(25),
    MAX_VIDEO_MB: z.coerce.number().default(100),
    MAX_IMAGE_MB: z.coerce.number().default(5),
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_DRIVER === "s3") {
      if (!data.S3_BUCKET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "S3_BUCKET is required when STORAGE_DRIVER is 's3'",
          path: ["S3_BUCKET"],
        });
      }
      if (!data.S3_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "S3_ACCESS_KEY_ID is required when STORAGE_DRIVER is 's3'",
          path: ["S3_ACCESS_KEY_ID"],
        });
      }
      if (!data.S3_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER is 's3'",
          path: ["S3_SECRET_ACCESS_KEY"],
        });
      }
    }
  });

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables configuration:");
    result.error.issues.forEach((issue) => {
      console.error(`   - [${issue.path.join(".")}]: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
