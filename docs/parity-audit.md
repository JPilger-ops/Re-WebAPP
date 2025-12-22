# Parity Audit – main vs dev_Prisma (Stand: current)

Fixdaten: Domain `https://rechnung.intern` (NPM 192.168.50.100 → Host 192.200.255.225:3031), App intern HTTP 3030, TLS nur im NPM.

## Navigation / Pages
| Seite/Route                    | main (Status)                          | dev_Prisma (Status) | Notes / Lücken | Abhängigkeiten |
|--------------------------------|----------------------------------------|----------------------|----------------|----------------|
| Login                          | ✅ klassisches HTML                     | ✅ React SPA, stabil | –              | –              |
| Dashboard                      | ✅ Überblick                            | ✅ Quick-Links, kompakt | – | – |
| Customers/Recipients           | ✅ CRUD                                 | ✅ CRUD, Search, Modals | UX ok, kein Export | – |
| Invoices                       | ✅ CRUD, PDF, Status, Export/Email      | ✅ CRUD + PDF + Regenerate, Status, Email, DATEV, Filter | – | – |
| Settings (Bank/DATEV/Tax)      | ✅                                     | ✅ (SPA) | – | – |
| Settings (SMTP)                | ✅                                     | ✅ (Admin) | – | – |
| Settings (Invoice Header)      | ✅                                     | ✅ (Admin) | – | – |
| Settings (API Keys)            | –                                      | ✅ (Admin) | Neu in dev_Prisma | – |
| Roles/Users/Permissions        | ✅ Listen/Assign                        | ✅ UI + CRUD | – | – |
| Categories / Templates / Email | ✅ Kategorie-Logos, Vorlagen, Mail-Accounts | ✅ CRUD, Logo Upload, Template/SMTP | – | – |
| Stats                          | ✅ Kennzahlen/Charts                    | ✅ KPIs + Filter | Charts minimal | – |
| HKForms Integration            | ✅ Settings + Status                    | ✅ Settings + Test (API-Key masked) | – | – |
| Datev Export                   | ✅ Export-Flow                          | ✅ UI-Trigger vorhanden | – | – |
| PDF/Assets                     | ✅                                      | ✅ PDF generiert, Header Settings greifen | – | – |

## Features / Flows
| Feature/Flow                          | main | dev_Prisma | Notes / Lücken | Abhängigkeiten |
|---------------------------------------|------|------------|----------------|----------------|
| Auth/Login                            | ✅    | ✅         | –              | –              |
| Admin User/Permissions seed           | ✅    | ✅ (seed)  | UI zur Verwaltung fehlt | Roles API |
| Recipients CRUD                       | ✅    | ✅         | –              | –              |
| Invoices CRUD                         | ✅    | ✅         | Keine Kategorie-Wahl, begrenzte Status-Funktionen | Kategorie-UI |
| Invoice PDF                           | ✅    | ✅         | Regenerate vorhanden | – |
| Invoice Email send                    | ✅    | ✅         | –              | – |
| Invoice mark sent/paid                | ✅    | ✅         | –              | – |
| Invoice Datev Export                  | ✅    | ✅         | –              | DATEV UI |
| Invoice Templates (per Category)      | ✅    | ✅         | –              | Kategorie-UI |
| Invoice Categories                    | ✅    | ✅         | –              | Upload handling |
| Stats Dashboard                       | ✅    | ✅         | KPIs, Filter | – |
| Bank/SEPA Settings                    | ✅    | ✅         | –              | – |
| Tax Settings                          | ✅    | ✅         | –              | – |
| Datev Settings                        | ✅    | ✅         | –              | – |
| HKForms Settings/Test                 | ✅    | ✅         | –              | – |
| API Keys                              | –     | ✅         | Neu in dev_Prisma | – |
| SMTP Settings                         | ✅    | ✅         | –              | – |
| Invoice Header Settings               | ✅    | ✅         | –              | – |

## Permissions / Roles (Hauptpunkte aus main)
- Rollen: admin, user (seed vorhanden).
- Permissions (Auszug): categories.read/write/delete, settings.general, stats.view, recipients.*, invoices.*, roles/users.*.
- dev_Prisma: Permissions und Rollen via seed, UI zur Verwaltung vorhanden (Admin).

## Status
- Parität erreicht (Stand dev_Prisma): alle Kernfeatures aus main sind in der React/Tailwind UI vorhanden, inkl. Kategorien, DATEV/Email, Status, Stats, Admin Users/Roles, Settings (Bank/Tax/DATEV/HKForms/SMTP/Header/API Keys).
- Weiteres Fein-Tuning: Charts/Exports können erweitert werden, Playwright-E2E optional.
