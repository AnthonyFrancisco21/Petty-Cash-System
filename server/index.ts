import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { createServer } from "http";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

(async () => {
  const app = express();

  // Standard Middlewares
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));

  // Logging Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.path.startsWith("/api")) {
        log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  });

  // 1. Initialize Auth first
  setupAuth(app);

  // 2. Initialize Routes
  const httpServer = createServer(app);
  await registerRoutes(app);

  // 3. Error Handling
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // 4. Vite / Static Files
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  } else {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
