import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { startOverdueJob } from "./jobs/overdueJob.js";

import authRoutes from "./routes/auth.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import testRoutes from "./routes/test.routes.js";
import customerRoutes from "./routes/customer.routes.js"; // NEU
import { authRequired } from "./middleware/auth.middleware.js";
import userRoutes from "./routes/user.routes.js";
import roleRoutes from "./routes/role.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import versionRoutes from "./routes/version.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import backupRoutes from "./routes/backup.routes.js";
import { resolveFaviconPath } from "./utils/favicon.js";
import { startBackupScheduler } from "./jobs/backupScheduler.js";
import {
  setNetworkDefaults,
  loadNetworkSettingsCache,
  getAllowedOrigins,
  setNetworkApp,
} from "./utils/networkSettings.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_ROOT = path.resolve("public");

const app = express();
app.disable("x-powered-by");

// Recognize forwarded proto/host when running behind a reverse proxy
// TRUST_PROXY can be 0/1/true/false
const trustProxyEnv = (process.env.TRUST_PROXY || "1").toLowerCase();
const trustProxy =
  trustProxyEnv === "1" ||
  trustProxyEnv === "true" ||
  trustProxyEnv === "yes" ||
  trustProxyEnv === "on";
app.set("trust proxy", trustProxy ? 1 : 0);

// Etags/Caching für API unterdrücken, damit /api/auth/me nicht mit 304 beantwortet wird
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const httpsDisabled = ["true", "1", "yes"].includes((process.env.APP_HTTPS_DISABLE || "true").toLowerCase());
const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
const permissionsPolicyHeader = [
  "accelerometer=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
  "clipboard-write=(self)",
  "fullscreen=(self)",
].join(", ");

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "https://rechnung.intern,http://rechnung.intern"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

setNetworkDefaults({
  cors_origins: allowedOrigins,
  trust_proxy: trustProxy,
});
setNetworkApp(app);
loadNetworkSettingsCache().catch((err) => {
  console.error("Network settings konnten nicht geladen werden, nutze Defaults:", err?.message || err);
});

const rateLimitEnabled = !["0", "false", "no"].includes(
  (process.env.RATE_LIMIT_ENABLED || "1").toLowerCase()
);

// Rate limits (lightweight defaults)
const loginLimiter = rateLimitEnabled
  ? rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 60_000),
      max: Number(process.env.RATE_LIMIT_AUTH_MAX || 20),
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next();
const generalLimiter = rateLimitEnabled
  ? rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
      max: Number(process.env.RATE_LIMIT_MAX || 300),
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next();

app.use((req, res, next) => {
  res.removeHeader("WWW-Authenticate");
  next();
});

/* -------------------------
   🔧 MIDDLEWARES (MÜSSEN ZUERST!)
--------------------------- */
const corsOptionsDelegate = (req, callback) => {
  const origin = req.header("Origin");
  const list = getAllowedOrigins();
  if (!origin || list.includes(origin)) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(null, { origin: false });
  }
};
app.use(cors(corsOptionsDelegate));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: httpsDisabled ? false : undefined, // disable HSTS when running HTTP behind proxy
}));
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", permissionsPolicyHeader);
  next();
});
if ((process.env.NODE_ENV || "development") !== "production") {
  app.use(morgan("dev"));
}
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(generalLimiter);

/* -------------------------
   📁 STATIC FILES
-------------------------- */
app.get("/favicon.ico", async (_req, res, next) => {
  try {
    const resolved = await resolveFaviconPath();
    res.set("Cache-Control", "public, max-age=0, must-revalidate");
    return res.sendFile(resolved.path);
  } catch (err) {
    return next(err);
  }
});
app.use(express.static(PUBLIC_ROOT));

/* -------------------------
   🚀 API ROUTES
-------------------------- */
app.use("/api/auth", loginLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/customers", authRequired, customerRoutes);
app.use("/api/stats", authRequired, statsRoutes);
if (!isProd) {
  app.use("/api/testdb", authRequired, testRoutes);
}
app.use("/api/categories", categoryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/backups", backupRoutes);
app.use("/api/version", versionRoutes);

// DEV-only HKForms Mock (bypass auth), can be enabled in prod via HKFORMS_MOCK_ENABLE=1 for tests
const enableHkformsMock =
  ["1", "true", "yes"].includes((process.env.HKFORMS_MOCK_ENABLE || "").toLowerCase());
if (enableHkformsMock) {
  let hkformsLog = [];
  const MAX_LOG = 50;

  app.post(/^\/api\/test\/hkforms-mock\/.*$/, (req, res) => {
    const entry = {
      time: new Date().toISOString(),
      path: req.path,
      headers: {
        "x-hkforms-crm-token": req.headers["x-hkforms-crm-token"] || null,
        "x-hkforms-org": req.headers["x-hkforms-org"] || null,
      },
      body: req.body || null,
    };
    hkformsLog.unshift(entry);
    if (hkformsLog.length > MAX_LOG) hkformsLog = hkformsLog.slice(0, MAX_LOG);
    res.json({ ok: true });
  });

  app.get("/api/test/hkforms-mock/log", (_req, res) => {
    res.json(hkformsLog);
  });
}

/* -------------------------
   🌐 FRONTEND ROUTE
-------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_ROOT, "index.html"));
});

// SPA fallback für alles außer /api/*
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_ROOT, "index.html"));
});

// Hintergrundjob: Überfällig-Markierung + HKForms Sync
startOverdueJob();
startBackupScheduler().catch((err) => console.error("[backup] scheduler start failed:", err));
export default app;
