# HKForms Parity – dev_DOCKER vs dev_Prisma

## Settings / Fallback
- DB-Tabelle `hkforms_settings` (id=1): base_url, organization, api_key (write-only)
- Fallbacks: ENV `HKFORMS_BASE_URL`, `HKFORMS_ORGANIZATION`, `HKFORMS_SYNC_TOKEN` (Base default `https://app.bistrottelegraph.de/api`)
- Priorität: DB > ENV > Default

## Triggers / Events
- `sendHkformsStatus` (utils/hkformsSync.js) wird aufgerufen bei:
  - Mark sent (invoice.controller -> markSent)
  - Mark paid (invoice.controller -> markPaid)
  - Overdue Job (jobs/overdueJob.js) setzt overdue + sendHkformsStatus
- Voraussetzung: reservation_request_id vorhanden und Token gesetzt; sonst Log „überspringe Sync“

## Endpoints/Jobs
- Settings: `/api/settings/hkforms` (GET/PUT), `/api/settings/hkforms/test` (Ping)
- Sync: HTTP POST an `<base_url>/reservations/:reservationId/:endpoint` mit Headern `X-HKFORMS-CRM-TOKEN`, optional `X-HKFORMS-ORG`.
- Overdue Job: gestartet in `server.js` (startOverdueJob) – prüft überfällige Rechnungen und sendet Status.

## Safe-Mode / Mock
- Für Tests kann base_url auf einen lokalen Mock gesetzt werden (siehe `check-hkforms-parity.mjs`).
- Ohne reservation_request_id oder Token wird nichts gesendet (nur Warnung/Log).

## Test (automatisiert)
- `npm --prefix backend run check:hkforms-parity`
  - Setzt HKForms Settings temporär (Base URL auf lokalen Mock, Dummy-Token)
  - Legt Kategorie/Kunde/Rechnung mit reservation_request_id an
  - Trigger markSent + markPaid, optional Overdue Job (wenn Mock verfügbar)
  - Mock loggt die Requests; Skript prüft Anzahl/Status im Mock-Log
  - Cleanup + Settings restore
