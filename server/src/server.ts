import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 TeamFlow Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`   - Client Origin: ${env.CLIENT_ORIGIN}`);
  logger.info(`   - Storage Driver: ${env.STORAGE_DRIVER}`);
  logger.info(`   - Health check: http://localhost:${env.PORT}/api/health`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
