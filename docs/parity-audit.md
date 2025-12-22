# Parity Audit – main vs dev_Prisma (Stand: current)

Fixdaten: Domain `https://rechnung.intern` (NPM 192.168.50.100 → Host 192.200.255.225:3031), App intern HTTP 3030, TLS nur im NPM.

## Navigation / Pages
| Seite/Route                    | main (Status)                          | dev_Prisma (Status) | Notes / Lücken | Abhängigkeiten |
|--------------------------------|----------------------------------------|----------------------|----------------|----------------|
| Login                          | ✅ klassisches HTML                     | ✅ React SPA, stabil | –              | –              |
| Dashboard                      | ✅ Überblick                            | ⚠️ Quick-Links, keine Widgets | Kennzahlen/Statistik fehlen | Stats-Endpunkte/Charts |
| Customers/Recipients           | ✅ CRUD                                 | ✅ CRUD, Search, Modals | UX ok, kein Export | – |
| Invoices                       | ✅ CRUD, PDF, Status, Export/Email      | ⚠️ CRUD+PDF+Regenerate, Detail-Modal | Mark sent/paid, Datev-Export/Email senden fehlen im UI; keine Liste-Filter nach Kategorie/Datev | Datev/Email Settings |
| Settings (Bank/DATEV/Tax)      | ✅                                     | ⚠️ UI teils noch nicht migriert (Bank/Datev/Tax nicht in SPA) | Routen/Forms fehlen | API existiert |
| Settings (SMTP)                | ✅                                     | ✅ (Admin) | – | – |
| Settings (Invoice Header)      | ✅                                     | ✅ (Admin) | – | – |
| Settings (API Keys)            | –                                      | ✅ (Admin) | Neu in dev_Prisma | – |
| Roles/Users/Permissions        | ✅ Listen/Assign                        | ❌ kein UI, API vorhanden | Vollständige Verwaltung fehlt | Roles/Permissions APIs |
| Categories / Templates / Email | ✅ Kategorie-Logos, Vorlagen, Mail-Accounts | ❌ kein UI, API existiert | Logo/Template/SMTP per Kategorie fehlt | Kategorie-APIs, Upload-Handling |
| Stats                          | ✅ Kennzahlen/Charts                    | ❌ kein UI           | Charts/Export fehlen | Stats API |
| HKForms Integration            | ✅ Settings + Status                    | ❌ kein UI           | HKForms Einstellen/Tests fehlen im UI | HKForms API |
| Datev Export                   | ✅ Export-Flow                          | ❌ kein UI           | DATEV-Export-Auslöser/Status fehlen | DATEV Settings |
| PDF/Assets                     | ✅                                      | ✅ PDF generiert, Header Settings greifen | – | – |

## Features / Flows
| Feature/Flow                          | main | dev_Prisma | Notes / Lücken | Abhängigkeiten |
|---------------------------------------|------|------------|----------------|----------------|
| Auth/Login                            | ✅    | ✅         | –              | –              |
| Admin User/Permissions seed           | ✅    | ✅ (seed)  | UI zur Verwaltung fehlt | Roles API |
| Recipients CRUD                       | ✅    | ✅         | –              | –              |
| Invoices CRUD                         | ✅    | ✅         | Keine Kategorie-Wahl, begrenzte Status-Funktionen | Kategorie-UI |
| Invoice PDF                           | ✅    | ✅         | Regenerate vorhanden | – |
| Invoice Email send                    | ✅    | ❌ UI fehlt | Backend Endpoint da, UI nicht | SMTP/Template/Kategorie UI |
| Invoice mark sent/paid                | ✅    | ❌ UI fehlt | Buttons/Flows fehlen | – |
| Invoice Datev Export                  | ✅    | ❌ UI fehlt | Export/Status fehlt | DATEV UI |
| Invoice Templates (per Category)      | ✅    | ❌ UI fehlt | Template-Editor fehlt | Kategorie-UI |
| Invoice Categories                    | ✅    | ❌ UI fehlt | CRUD/Logo fehlt | Upload handling |
| Stats Dashboard                       | ✅    | ❌         | Keine Charts/Stats | Stats API |
| Bank/SEPA Settings                    | ✅    | ❌ UI fehlt | API da, UI nicht | – |
| Tax Settings                          | ✅    | ❌ UI fehlt | API da, UI nicht | – |
| Datev Settings                        | ✅    | ❌ UI fehlt | API da, UI nicht | – |
| HKForms Settings/Test                 | ✅    | ❌ UI fehlt | API da, UI nicht | – |
| API Keys                              | –     | ✅         | Neu in dev_Prisma | – |
| SMTP Settings                         | ✅    | ✅         | –              | – |
| Invoice Header Settings               | ✅    | ✅         | –              | – |

## Permissions / Roles (Hauptpunkte aus main)
- Rollen: admin, user (seed vorhanden).
- Permissions (Auszug): categories.read/write/delete, settings.general, stats.view, recipients.*, invoices.*, roles/users.*.
- dev_Prisma: Permissions und Rollen via seed, aber kein UI zur Verwaltung; Admin-Guard für Settings/API-Keys vorhanden.

## Priorisierte nächste Meilensteine (Vorschlag)
1) Settings-UI komplettieren: Bank/Tax/Datev/HKForms, Kategorie-Settings (Logos/Templates/SMTP per Kategorie).
2) Invoices UI erweitern: Mark sent/paid, Email senden, Datev Export, Kategorie-Auswahl, Filter/Sort nach Datum/Kategorie/Status.
3) Roles/Users UI: Rollen/Permissions anzeigen/zuweisen, User verwalten.
4) Stats Dashboard: einfache Kennzahlen/Charts, Export falls vorhanden.
5) HKForms + Datev UX: Einstellen/Testen, Statusanzeigen.
6) Polish/QA: Playwright smoke (Login → Customers → Invoices → Settings), Fehlermeldungen/Caching/Empty States überall prüfen.
