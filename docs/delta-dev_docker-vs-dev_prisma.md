# Delta: dev_DOCKER vs dev_Prisma

Alle Angaben Stand dieses Commit. Fokus auf Unterschiede zwischen legacy dev_DOCKER (statisches HTML/JS) und dev_Prisma (React/Tailwind + Prisma + Docker Compose).

## Navigation / Pages
| Feature/Seite | dev_DOCKER (Route/Datei) | dev_Prisma (Route/Datei) | Status | Notizen | Abhängigkeiten |
| --- | --- | --- | --- | --- | --- |
| Login | `public/login.html` | `/login` (SPA) | ✅ | SPA ersetzt statisch; Cookie-Login bleibt | Auth-API |
| Dashboard | `public/index.html` | `/dashboard` | ✅ | Quick-Links statt Legacy-Widgets | Auth |
| Customers/Recipients | `public/customers.html` | `/customers` | ✅ | CRUD + Suche, keine Exporte | Customers API |
| Invoices | `public/invoice.html` | `/invoices` | ✅ | CRUD, PDF, Status, Email, DATEV, Filter | Invoice API, PDF, DATEV, SMTP |
| Categories | `public/categories.html` | `/categories` | ✅ | CRUD, Logo Upload, Template/SMTP | Category APIs, uploads |
| Settings | `public/settings/*.html` | `/settings` | ✅ | SMTP, Header, Bank/Tax, DATEV, HKForms, API-Keys | Settings APIs |
| Stats | `public/stats.html` | `/stats` | ✅ | KPIs + Filter (Jahr/Kategorie) | Stats API |
| Admin Users | `public/users.html` | `/admin/users` | ✅ | CRUD inkl. aktiv/inaktiv | Users API |
| Admin Roles | `public/roles.html` | `/admin/roles` | ✅ | Permissions-Matrix | Roles/Permissions APIs |

## Features / Flows
| Feature | dev_DOCKER | dev_Prisma | Status | Notizen | Abhängigkeiten |
| --- | --- | --- | --- | --- | --- |
| Auth/Cookies | JWT Cookie, Login/Register | JWT Cookie, Login | ✅ | Register-Flow entfallen, Login stabil | Auth API, trust proxy |
| Recipients CRUD | Ja | Ja | ✅ | Parität | Customers API |
| Invoices CRUD | Ja | Ja | ✅ | Kategorie-Feld ergänzt | Invoice API |
| PDF Generate | Ja | Ja | ✅ | Puppeteer, tmp->rename | PDF deps |
| PDF Regenerate | Teilweise | Ja | ✅ | Button/Endpoint vorhanden | Invoice/PDF |
| Invoice Status sent/paid | Ja | Ja | ✅ | Buttons in Detail/Liste | Invoice status endpoints |
| Invoice Email Preview/Send | Ja | Ja | ✅ | Dry-run/redirect Hinweise | SMTP/Kat-Template |
| DATEV Export | Ja | Ja | ✅ | UI-Trigger vorhanden | DATEV settings |
| Categories: Logo/Template/SMTP | Ja | Ja | ✅ | Upload + Tests | Category APIs, upload size |
| Stats | Ja | Ja | ✅ | KPIs, Filter | Stats API |
| API Keys | Nein | Ja | ✅ | Neues Feature | Settings API keys |
| HKForms Sync | Ja | Ja | ✅ | Settings + Test; Sync Jobs behalten | hkformsSettings, hkformsSync |

## Jobs / Background
| Job | dev_DOCKER | dev_Prisma | Status | Notizen |
| --- | --- | --- | --- | --- |
| Overdue Marking | Job aktiv (server.js) | Job aktiv (server.js) | ✅ | nutzt HKForms Sync best effort |
| HKForms Sync | vorhanden | vorhanden | ✅ | nutzt Settings (DB/env) |
| DATEV Export (batch) | ad-hoc via API | ad-hoc via API | ✅ | kein separater Cron |

## Settings / Config
| Bereich | dev_DOCKER | dev_Prisma | Status | Notizen |
| --- | --- | --- | --- | --- |
| SMTP global | ENV + DB (pass write-only) | SPA + API | ✅ | Passwort maskiert; Test-Endpoint | 
| Invoice Header | DB | SPA + API | ✅ | Header/Footer/Logo | 
| Bank/Tax | ENV/DB | SPA + API | ✅ | IBAN/BIC Validierung | 
| DATEV | ENV/DB | SPA + API | ✅ | E-Mail Pflicht | 
| HKForms | ENV/DB | SPA + API | ✅ | API-Key write-only, Test | 
| Categories SMTP/Template | UI vorhanden | SPA + API | ✅ | Logo Upload begrenzt | 
| API Keys | Nein | SPA + API | ✅ | X-API-Key Header | 
| Certificates | `certificates/*` | unverändert | ✅ | CA-Download (admin) | 

## Kritische API Endpoints
| Bereich | Endpoint | Status | Notizen |
| --- | --- | --- | --- |
| PDF | `GET /api/invoices/:id/pdf`, `POST /api/invoices/:id/pdf/regenerate` | ✅ | tmp->rename, volume `backend/pdfs` |
| Mail preview/send | `GET /api/invoices/:id/email-preview`, `POST /api/invoices/:id/send-email` | ✅ | Dry-run/redirect Hinweise |
| DATEV Export | `POST /api/invoices/:id/datev-export` | ✅ | nutzt DATEV settings |
| HKForms | `GET/POST /api/invoices/by-reservation/:id/status`, `GET/PUT /api/settings/hkforms`, `POST /api/settings/hkforms/test` | ✅ | API-Key masked, test endpoint |
| Stats | `GET /api/stats/invoices` | ✅ | permission `stats.view` |

## Top-10 Risiken (mit Testidee)
1) PDF Inhalt-Parität (Logos/Header/Footer, Beträge) – Test: Vergleich Stichprobe PDFs main vs dev_Prisma.
2) DATEV Export Format/Adresse – Test: Export gegen Test-Mailadresse prüfen, Inhalt auf Felder/Kategorie.
3) HKForms Sync/Overdue – Test: Rechnung mit Reservation-ID anlegen, Statusänderung prüfen, Logs beobachten.
4) Kategorie-SMTP/Template Vorrang – Test: Kategorie-Mailkonto setzen, Email preview/send prüfen, From/Template korrekt.
5) API-Key Auth (X-API-Key) – Test: geschützter Endpoint mit/ohne Key, revoked Key, timingSafeEqual.
6) Rate Limits/Login 429 – Test: mehrfach falsche Logins, UI-Meldung verständlich, kein Lockout-Leak.
7) CORS/Cookie Secure hinter NPM – Test: Browser über `https://rechnung.intern`, Cookies gesetzt, /me 200.
8) Uploads (Logos) – Test: Größe/Typ-Grenzen, Pfad `/logos/` erreichbar im PDF/Frontend.
9) Stats Filter – Test: year/category Filter liefert erwartete Summen, 400 bei invalid year.
10) Seed/Permissions Drift – Test: seed erneut laufen lassen, Admin behält alle Rechte, UI spiegelt Permissions korrekt.

## Empfohlene Reihenfolge D1–D6
- D1: PDF/DATEV/HKForms Paritäts-Validierung (Risiken 1–3) – blockt Go-Live
- D2: Kategorie-SMTP/Template + API-Key Auth Verifikation (Risiken 4–5)
- D3: Security/Proxy Checks (CORS/Cookies/429) (Risiken 6–7)
- D4: Upload/Stats Kantenfälle (Risiken 8–9)
- D5: Seed/Permissions Konsistenz (Risiko 10)
- D6: Optional Playwright Smoke (Login → Customers → Invoices → Settings/Admin)
