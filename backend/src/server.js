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


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const allowedOrigins = (process.env.CORS_ORIGINS || "https://rechnung.intern")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Rate limits (lightweight defaults)
const loginLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
});
const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use((req, res, next) => {
  res.removeHeader("WWW-Authenticate");
  next();
});

/* -------------------------
   🔧 MIDDLEWARES (MÜSSEN ZUERST!)
-------------------------- */
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: httpsDisabled ? false : undefined, // disable HSTS when running HTTP behind proxy
}));
if ((process.env.NODE_ENV || "development") !== "production") {
  app.use(morgan("dev"));
}
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(generalLimiter);

/* -------------------------
   📁 STATIC FILES
-------------------------- */
app.use(express.static(path.join(__dirname, "../public")));

/* -------------------------
   🚀 API ROUTES
-------------------------- */
app.use("/api/auth", loginLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/customers", authRequired, customerRoutes);
app.use("/api/stats", authRequired, statsRoutes);
app.use("/api/testdb", authRequired, testRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/version", versionRoutes);

/* -------------------------
   🌐 FRONTEND ROUTE
-------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// SPA fallback für alles außer /api/*
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Hintergrundjob: Überfällig-Markierung + HKForms Sync
startOverdueJob();
export default app;
