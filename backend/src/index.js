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
import http from "http";
import fs from "fs";

// --- HTTPS OPTIONEN ---
const httpsOptions = {
  key: fs.readFileSync("/etc/ssl/private/webapp.key"),
  cert: fs.readFileSync("/etc/ssl/certs/webapp.crt")
};

// --- HTTPS SERVER STARTEN ---
https.createServer(httpsOptions, app).listen(443, () => {
  console.log("HTTPS Server läuft auf Port 443");
});

