import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initializeDefaultUsers } from "./init-users";
import { startTaskTracking } from "./task-ledger";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PgStore = pgSession(session);

// Trust proxy for production (behind reverse proxy)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "qms-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  })
);

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

      log(logLine);
    }
  });

  next();
});

// Express 4 does not catch errors from async route handlers, so one failing query (e.g. /api/documents/null/links)
// crashed the whole server. Send every handler's rejected promise to the error handler instead.
for (const method of ["get", "post", "put", "patch", "delete"] as const) {
  const register = (app as any)[method].bind(app);
  (app as any)[method] = (path: unknown, ...handlers: unknown[]) => {
    if (handlers.length === 0) return register(path); // app.get("setting")
    return register(path, ...handlers.map((handler) =>
      typeof handler === "function" && handler.length < 4
        ? (req: Request, res: Response, next: NextFunction) => {
            try {
              const result = handler(req, res, next);
              if (result && typeof result.catch === "function") result.catch(next);
            } catch (err) {
              next(err);
            }
          }
        : handler));
  };
}

(async () => {
  await initializeDefaultUsers();
  await registerRoutes(httpServer, app);
  startTaskTracking();

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error(`Error handling ${req.method} ${req.path}:`, err);
    if (res.headersSent) return;
    // Internal errors (e.g. database messages) are logged, not sent to the browser
    res.status(status).json({ message: status >= 500 ? "Something went wrong. Please try again." : err.message || "Request failed" });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
