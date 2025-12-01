
⸻

📄 README.md

🌲 Re-WebAPP

Rechnungs- und Verwaltungs-System für den Heidekönig
Version: 0.2.3 (2025)

⸻

⭐ Über das Projekt

Die Re-WebAPP ist ein vollwertiges, browserbasiertes Rechnungs- & Verwaltungs-System bestehend aus:
	•	Benutzer- & Rollenverwaltung
	•	Kundenmanagement
	•	Rechnungsgenerator
	•	PDF-Export über Puppeteer
	•	SEPA-QR-Code Unterstützung
	•	Reverse-Charge / B2B-Funktion
	•	Automatische Rechnungsnummern nach Schema YYYYMM001
	•	Apple-like UI, Lade-Popups, Animationen

Ziel ist eine moderne, robuste und erweiterbare Plattform für Rechnungen, Nutzerverwaltung und interne Prozesse.

⸻

🧰 Technologien

Bereich	Technologie
Backend	Node.js (ESM), Express
Frontend	HTML, CSS, Vanilla-JS
Datenbank	PostgreSQL
PDF	Puppeteer
Authentication	JWT-Cookies
Deployment	PM2
QR-Code Generator	qrcode NPM-Package


⸻

🗂 1. Projektwurzel

Pfad:

/root/rechnungsapp/

Ordner und Dateien für Backend, Frontend, Konfiguration & PDF-Generierung.

⸻

🟦 2. Backend – Hauptprojekt

Pfad:

/root/rechnungsapp/backend/

⚙ Backend-Kerndateien

Datei	Zweck
backend/package.json	Dependencies & Skripte
backend/package-lock.json	Lockfile
backend/ecosystem.config.cjs	PM2 Konfiguration
backend/.env	Umgebungsvariablen (DB, Secrets, etc.)

⚙ Server & App-Setup

Datei	Beschreibung
backend/src/server.js	Express App + Routerregistrierung
backend/src/index.js	App-Startpunkt (Port, Middleware, Initialisierung)


⸻

🟦 3. Backend – Utils

Pfad:

backend/src/utils/db.js

✨ db.js – Aufgaben:
	•	PostgreSQL-Pool
	•	Query-Funktionen
	•	Verbindungstest
	•	Fehler-Logging

⸻

🟦 4. Backend – Controllers

Pfad:

backend/src/controllers/

Controller	Funktion
auth.controller.js	Login, Logout, Token-Handling, User-Daten
customer.controller.js	Kundenverwaltung: Erstellen, Bearbeiten, Suche
invoice.controller.js	Herzstück der Anwendung: Rechnungslogik, PDF-Rendering, SEPA-QR
user.controller.js	Benutzerverwaltung
role.controller.js	Rollen & Rechte (selbst implementiert)

🔥 Wichtige Funktionen in invoice.controller.js:
	•	createInvoice() → Rechnung + Positionen + Empfänger speichern
	•	getAllInvoices() → Übersichtsliste
	•	getInvoiceById() → Detaildaten
	•	getInvoicePdf() → PDF generieren (Puppeteer)
	•	generateInvoiceHtml() → HTML-Vorlage mit Logo, Knickmarken, Reverse-Charge etc.
	•	getNextInvoiceNumber() → Automatische Nummernvergabe YYYYMM001
	•	markSent(), markPaid() → Status ändern
	•	deleteInvoice() → Rechnung + PDF löschen

⸻

🟦 5. Backend – Routes

Pfad:

backend/src/routes/

Datei	Zweck
auth.routes.js	Login, Logout, Registrierung
customer.routes.js	Kunden-Endpunkte
invoice.routes.js	Rechnungs-Endpunkte, PDF Export
user.routes.js	User-Management
role.routes.js	Rollenverwaltung
test.routes.js	Debug / Healthcheck


⸻

🟦 6. Backend – Middleware

Pfad:

backend/src/middleware/

Datei	Beschreibung
auth.middleware.js	JWT-Prüfung, Zugriffsschutz für geschützte Routen


⸻

🟦 7. Backend – Öffentliche Dateien (Frontend)

Pfad:

backend/public/


⸻

📄 HTML-Seiten:

Datei	Beschreibung
login.html	Loginmaske
index.html	Dashboard
invoices.html	Rechnungsübersicht
invoice.html	Rechnungsdetailseite
create.html	Rechnung erstellen
customers.html	Kundenverwaltung
user-management.html	Benutzerverwaltung
role-management.html	Rollenverwaltung
account.html	Eigenes Profil


⸻

🎨 CSS:

Datei
style.css


⸻

🧠 JavaScript Frontend:

Datei	Zweck
nav.js	Navigation & UI
main.js	Dashboard
login.js	Login-Logik
invoices.js	Anzeigen, filtern, verwalten
create.js	Rechnung erstellen: Positionen, B2B, QR, Popup
customers.js	Kundenverwaltung
user-management.js	Benutzerverwaltung
role-management.js	Rollenverwaltung
account.js	Passwörter ändern etc.


⸻

🖼 Assets:

backend/public/HK_LOGO.png


⸻

🟦 8. PDFs / Export

Pfad:

backend/pdfs/

Inhalt:
	•	Generierte Rechnungs-PDFs
	•	Dateiname: RE-<Nummer>.pdf

⸻

🟦 9. Temporäre / Debug-Dateien

Diese liegen im System /mnt/data (nicht Teil der App):
	•	/mnt/data/*.js
	•	/mnt/data/*.html
	•	/mnt/data/*.png
	•	/mnt/data/*.zip

Sie werden nicht geladen und gehören nicht ins Repo.

⸻

🟦 10. Datenbank / SQL-Schema

Beispielpfad:

backend/schema.sql

Beinhaltet:
	•	Tabellen: invoices, invoice_items, recipients, users, roles, role_permissions
	•	Views und Indexe (optional)

⸻

🗂 11. Gesamtübersicht (Baumdarstellung)

backend
├── .env
├── package.json
├── package-lock.json
├── ecosystem.config.cjs
├── pdfs/
├── public/
│   ├── index.html
│   ├── login.html
│   ├── invoices.html
│   ├── invoice.html
│   ├── create.html
│   ├── customers.html
│   ├── user-management.html
│   ├── role-management.html
│   ├── account.html
│   ├── style.css
│   ├── main.js
│   ├── login.js
│   ├── invoices.js
│   ├── create.js
│   ├── customers.js
│   ├── user-management.js
│   ├── role-management.js
│   ├── account.js
│   ├── nav.js
│   ├── HK_LOGO.png
│
└── src/
    ├── index.js
    ├── server.js
    ├── utils/
    │   └── db.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── customer.controller.js
    │   ├── invoice.controller.js
    │   ├── user.controller.js
    │   └── role.controller.js
    ├── middleware/
    │   └── auth.middleware.js
    └── routes/
        ├── auth.routes.js
        ├── customer.routes.js
        ├── invoice.routes.js
        ├── user.routes.js
        ├── role.routes.js
        └── test.routes.js


⸻

🔢 Rechnungsnummern-System

Schema:

YYYYMM001

	•	Monatsbasierter Reset
	•	Kollisionssicher
	•	DB-Feld: VARCHAR(20)

⸻

🧾 B2B-Modus (Reverse Charge)

Bereich	Beschreibung
Frontend	Checkbox, USt-ID-Feld & Netto-Endbetrag
Backend	b2b & ust_id Felder, Netto-Endsumme
PDF	„Rechnung (B2B)“, Reverse-Charge Hinweis


⸻

🖨 PDF-Renderer
	•	Puppeteer Headless
	•	HTML-Template mit DIN-5008 Knickmarken
	•	SEPA-QR-Code Integration
	•	Branding über Base64 Logo
	•	Netto- oder Brutto-Endbetrag abhängig von B2B

⸻

🛠 Installation

git clone <repo-url>
cd rechnungsapp/backend
npm install
npm run start      # oder pm2 start


⸻

🔐 Environment Variablen

DATABASE_URL=postgres://user:pass@localhost:5432/rechnungsdb
JWT_SECRET=supersecret
SEPA_CREDITOR=Heidekönig
SEPA_IBAN=DE...
SEPA_BIC=GENODE...

