// --- ENV LADEN ---
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import https from "https";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// .env LADEN – EIN ORDNER HÖHER
dotenv.config({ path: path.join(__dirname, "../.env") });

// --- EXPRESS APP IMPORTIEREN ---
import app from "./server.js";

const httpsDisabled = ["true", "1", "yes"].includes((process.env.APP_HTTPS_DISABLE || "").toLowerCase());
const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
const appDomain = process.env.APP_DOMAIN || (httpsDisabled ? "http://localhost:3030" : "https://rechnung.intern");
const port = Number(process.env.APP_PORT || process.env.APP_HTTPS_PORT || 3030);
const bindHost = process.env.APP_HOST || process.env.APP_BIND_IP || "0.0.0.0";
const publicPort = Number(process.env.APP_PUBLIC_PORT || process.env.APP_HTTPS_PORT || process.env.APP_PORT || 3031);
const trustProxyEnv = (process.env.TRUST_PROXY || "1");
const corsOrigins = (process.env.CORS_ORIGINS || "https://rechnung.intern");
const publicUrl = process.env.APP_PUBLIC_URL || appDomain;

const enforceProdSecrets = () => {
  if (!isProd) return;
  const errors = [];
  const warnings = [];

  const requireSecret = (key, value, forbidden = []) => {
    if (!value) {
      errors.push(`${key} fehlt.`);
      return;
    }
    if (forbidden.includes(value)) {
      errors.push(`${key} nutzt einen Standardwert.`);
    }
  };

  requireSecret("JWT_SECRET", process.env.JWT_SECRET, ["change_me_jwt", "dev-secret-change-me"]);
  requireSecret("SESSION_SECRET", process.env.SESSION_SECRET, ["change_me_session", "change_me"]);

  const createPin = process.env.APP_CREATE_PIN || "";
  if (!createPin) {
    warnings.push("APP_CREATE_PIN fehlt (Registrierung ist deaktiviert).");
  } else if (createPin === "change_me_strong") {
    warnings.push("APP_CREATE_PIN nutzt den Beispielwert.");
  }

  if (warnings.length) {
    warnings.forEach((msg) => console.warn("[security warning]", msg));
  }
  if (errors.length) {
    console.error("[security] Unsichere Prod-Konfiguration:");
    errors.forEach((msg) => console.error(`- ${msg}`));
    process.exit(1);
  }
};

console.log("[config] httpsDisabled:", httpsDisabled, "| listen:", `${bindHost}:${port}`, "| publicPort:", publicPort, "| trustProxy:", trustProxyEnv);
console.log("[config] CORS_ORIGINS:", corsOrigins);
console.log("[config] APP_PUBLIC_URL:", publicUrl);

enforceProdSecrets();

if (httpsDisabled) {
  http.createServer(app).listen(port, bindHost, () => {
    console.log(`HTTP Server läuft auf ${bindHost}:${port} (public: ${publicUrl})`);
  });
} else {
  // Use app-specific env vars to avoid collision with system SSL_CERT_DIR
  const certificateDir = process.env.APP_SSL_CERT_DIR || path.join(__dirname, "../certificates/rechnung.intern");
  const keyPath = process.env.APP_SSL_KEY_PATH || path.join(certificateDir, "privkey.pem");
  const certPath = process.env.APP_SSL_CERT_PATH || path.join(certificateDir, "fullchain.pem");
  const httpsPort = Number(process.env.APP_HTTPS_PORT || process.env.APP_PORT || 443);

  const missingPaths = [keyPath, certPath].filter((filePath) => !fs.existsSync(filePath));

  if (missingPaths.length) {
    console.error("SSL-Zertifikate nicht gefunden. Erwartete Pfade:");
    missingPaths.forEach((filePath) => console.error(`- ${filePath}`));
    process.exit(1);
  }

  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };

  // --- HTTPS SERVER STARTEN ---
  https.createServer(httpsOptions, app).listen(httpsPort, bindHost, () => {
    console.log(`HTTPS Server läuft auf ${bindHost}:${httpsPort} (public: ${publicUrl})`);
  });
}
