// --- ENV LADEN ---
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// .env LADEN – EIN ORDNER HÖHER
dotenv.config({ path: path.join(__dirname, "../.env") });

// --- EXPRESS APP IMPORTIEREN ---
import app from "./server.js";

// --- HTTPS MODULE (ESM) ---
import https from "https";
import fs from "fs";

// Use app-specific env vars to avoid collision with system SSL_CERT_DIR
const certificateDir = process.env.APP_SSL_CERT_DIR || path.join(__dirname, "../certificates/rechnung.intern");
const keyPath = process.env.APP_SSL_KEY_PATH || path.join(certificateDir, "privkey.pem");
const certPath = process.env.APP_SSL_CERT_PATH || path.join(certificateDir, "fullchain.pem");
const httpsPort = Number(process.env.APP_HTTPS_PORT || 443);
const appDomain = process.env.APP_DOMAIN || "https://rechnung.intern";

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
https.createServer(httpsOptions, app).listen(httpsPort, () => {
  console.log(`HTTPS Server läuft auf Port ${httpsPort} für ${appDomain}`);
});
