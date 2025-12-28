# DATEV Parity – dev_DOCKER vs dev_Prisma

## Endpoints & Preconditions
- Endpoint: `POST /api/invoices/:id/datev-export`
- Voraussetzungen für Erfolg:
  - DATEV-E-Mail in Settings gesetzt (`/api/settings/datev` → field `email`)
  - SMTP verfügbar (Kategorie-SMTP > globale DB-SMTP > ENV)
  - Rechnung existiert; PDF wird via `ensureInvoicePdf` erzeugt (Status sent/paid aktuell nicht erzwungen)
- Response: bei Erfolg 200, Mail wird an DATEV-E-Mail gesendet; Body/Text enthält Bankdaten. Bei fehlenden Settings 400.

## Gründe für 400 (typisch)
- DATEV-E-Mail fehlt → 400 "Keine DATEV-E-Mail hinterlegt"
- SMTP fehlt → 400 "Kein SMTP-Konto hinterlegt"

## Parity-Check Empfehlung
- Vor Export: DATEV-E-Mail in Settings setzen (Testadresse)
- SMTP sicherstellen (DB oder ENV)
- Optional Rechnung auf sent setzen, falls dies in dev_DOCKER Voraussetzung war (derzeit nicht erzwungen).

## Automated Test (siehe check-datev-parity.mjs)
- Login → Kategorie/Kunde/Rechnung anlegen → DATEV-E-Mail temporär setzen → Export → asserts 200 & PDF-Attachment Content-Type.
- Cleanup: Invoice/Customer/Category, DATEV Setting zurücksetzen.
