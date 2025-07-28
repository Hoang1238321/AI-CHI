import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { vectorService } from './vector-service';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// File upload will be handled by multer in routes.ts for specific endpoints

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Student Drive Service
  try {
    const { studentDriveService } = await import('./student-drive-service');
    await studentDriveService.initialize();
  } catch (error) {
    console.log('⚠️ Student Drive Service setup failed:', error.message);
  }

  // Initialize Google Drive Service and start WebDAV server
  try {
    const { googleDriveService } = await import('./google-drive');
    if (googleDriveService.isInitialized()) {
      console.log('🚀 Starting WebDAV server...');
      await googleDriveService.startWebDAVServer();
    }
  } catch (error) {
    console.log('⚠️ Google Drive WebDAV setup failed:', error.message);
  }

  // Initialize vector cleanup service
  console.log('🧹 Initializing vector cleanup service...');
  vectorService.startCleanupService();

  // Initialize Job Processor for external admin jobs
  try {
    const { jobProcessor } = await import('./job-processor');
    await jobProcessor.initialize();
    jobProcessor.startProcessing();
  } catch (error) {
    console.log('⚠️ Job Processor setup failed:', error.message);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
