Zertifikate für die Subdomain `rechnung.intern`
===============================================

Lege hier das SSL-Zertifikat für `rechnung.intern` ab, damit der Server es aus der Projektstruktur laden kann.

Erwartete Dateien (Standard):
- `privkey.pem` – privater Schlüssel
- `fullchain.pem` – Zertifikat inkl. Chain

Konfiguration:
- Standardpfad: `backend/certificates/rechnung.intern/`
- Überschreibbar per Env (app-spezifisch, um Konflikte mit System-Variablen zu vermeiden):
  - `APP_SSL_CERT_DIR`, `APP_SSL_KEY_PATH`, `APP_SSL_CERT_PATH`
  - `APP_HTTPS_PORT`, `APP_DOMAIN`, `CORS_ORIGINS`

UniFi-Hinweis:
1. Zertifikat/Key aus dem UniFi-Controller exportieren bzw. das Let's-Encrypt-Zertifikat in PEM wandeln.
2. `privkey.pem` und `fullchain.pem` hier ablegen.
3. Dateirechte auf 600/640 setzen, Eigentümer = Benutzer, der die Node-App startet.
4. Server/PM2 neu starten.

Wichtig: Diese Dateien gehören nicht ins Git-Repo (werden per `.gitignore` ausgeschlossen).
