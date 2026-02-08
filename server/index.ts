import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import fs from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initAppMssqlPool, isAppMssqlConfigured } from "./mssql-app-db";
import { initUnifiedStorage } from "./unified-storage";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Health check endpoint - responds immediately without expensive operations
// This ensures deployment health checks pass before async initialization completes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Track database initialization status for API routes
let dbInitialized = false;
let dbInitError: Error | null = null;

// Middleware to check if database is ready (for non-health API routes)
app.use('/api', (req, res, next) => {
  // Allow health check to pass through
  if (req.path === '/health') return next();
  
  if (!dbInitialized) {
    if (dbInitError) {
      return res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'The application is starting up. Please try again in a moment.' 
      });
    }
    return res.status(503).json({ 
      error: 'Database initializing', 
      message: 'The application is starting up. Please try again in a moment.' 
    });
  }
  next();
});

(async () => {
  const sslCertPath = process.env.SSL_CERT_PATH;
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslPfxPath = process.env.SSL_PFX_PATH;
  const sslPfxPassphrase = process.env.SSL_PFX_PASSPHRASE;

  let server;
  let isHttps = false;

  if (sslPfxPath && !fs.existsSync(sslPfxPath)) {
    log(`WARNING: SSL_PFX_PATH is set to "${sslPfxPath}" but file not found - falling back to HTTP`);
  }
  if (sslCertPath && !fs.existsSync(sslCertPath)) {
    log(`WARNING: SSL_CERT_PATH is set to "${sslCertPath}" but file not found`);
  }
  if (sslKeyPath && !fs.existsSync(sslKeyPath)) {
    log(`WARNING: SSL_KEY_PATH is set to "${sslKeyPath}" but file not found`);
  }

  if (sslPfxPath && fs.existsSync(sslPfxPath)) {
    const sslOptions: any = {
      pfx: fs.readFileSync(sslPfxPath),
    };
    if (sslPfxPassphrase) {
      sslOptions.passphrase = sslPfxPassphrase;
    }
    server = createHttpsServer(sslOptions, app);
    isHttps = true;
    log("HTTPS mode enabled with PFX certificate");
  } else if (sslCertPath && sslKeyPath && fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
    const sslOptions = {
      cert: fs.readFileSync(sslCertPath),
      key: fs.readFileSync(sslKeyPath),
    };
    server = createHttpsServer(sslOptions, app);
    isHttps = true;
    log("HTTPS mode enabled with cert/key files");
  } else {
    server = createServer(app);
    log("HTTP mode (no SSL certificate configured)");
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    const protocol = isHttps ? 'https' : 'http';
    log(`Server listening on ${protocol}://0.0.0.0:${port} - starting database initialization...`);
  });

  // THEN: Initialize database and routes asynchronously
  try {
    // Initialize MS SQL app database if configured
    if (isAppMssqlConfigured()) {
      log("Initializing MS SQL app database...");
      await initAppMssqlPool();
    }

    // Initialize unified storage layer (connects to appropriate database)
    await initUnifiedStorage();

    await registerRoutes(app);

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

    // Mark database as initialized
    dbInitialized = true;
    log(`Database initialized successfully - application ready`);
  } catch (error) {
    dbInitError = error as Error;
    log(`Database initialization failed: ${(error as Error).message}`);
    // Don't exit - keep server running for health checks, but API routes will return 503
  }
})();
