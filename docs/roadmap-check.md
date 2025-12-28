# Roadmap Check / Manual QA

## Automatische Checks
- `npm --prefix backend run check:roadmap`
  - ruft intern auf: check:api, check:pdf, check:invoice, check:parity, check:pdf-parity, check:mail-parity, check:datev-parity, check:hkforms-parity
  - prüft zusätzlich:
    - /api/me unauth -> 401, Login ok
    - Netzwerk Settings: Validation (keine Wildcards), Update/Restore, Diagnostics
    - E-Mail Templates: Roundtrip speichern/restore
    - Favicon Reset (ohne Upload)
    - Invoice Flow: auto-number, HKForms-ID speichern, PDF + Regenerate, DATEV nicht 5xx
    - Stats Endpoint 200
    - API Keys: create -> revoke -> delete
  - Ausgabe: ✅/⚠️ Zusammenfassung

Env für Checks:
- `CHECK_BASE_URL` oder `CHECK_HOST`/`CHECK_PORT` (Default http://192.200.255.225:3031)
- `CHECK_USERNAME`/`CHECK_PASSWORD` (Default admin/admin)
- `CHECK_ALLOW_EMAIL` optional

## Manuelle UI-Checkliste
1) Login/Redirect
   - Inkognito -> /invoices -> Redirect /login -> Login -> zurück zu /invoices
2) Idle Logout (5 min)
   - 5 Minuten ohne Interaktion -> Redirect /login?reason=idle
3) Navigation/Native Feel
   - Sidebar/Topbar bleiben stehen, nur Content scrollt; Mobile Drawer funktioniert; kein Body-Scroll-Bounce
4) One-Button-Rule / MoreMenu
   - Dashboard, Customers, Categories, Invoices: nur 1 Primary, Aktionen im MoreMenu
5) Invoices Table UX
   - Filter sticky, Tabelle scrollt im Container, keine Body-Doppelscroll
6) Invoice Create Page
   - /invoices/new lädt, Nummer wird vorgeschlagen, Speichern -> Detail
7) Settings Tabs
   - PDF Path testen
   - Branding/Favicon Upload/Reset (Hard Reload)
   - Netzwerk: Origins/Trust-Proxy editieren + Diagnose
   - Mail/SMTP: Testmail UX
   - E-Mail Vorlagen: speichern + Preview mit Invoice ID
   - Rechnungskopf: ändern -> Regenerate -> PDF zeigt neue Daten
   - HKForms/API Keys: create/rotate/revoke/delete
8) DATEV
   - Export aus Invoice Detail -> Status/Timestamp sichtbar, keine 500

## Befehle (Schnellstart)
```bash
docker compose up -d --build
npm --prefix frontend run typecheck
npm --prefix frontend run build
CHECK_HOST=192.200.255.225 CHECK_PORT=3031 npm --prefix backend run check:roadmap
```
