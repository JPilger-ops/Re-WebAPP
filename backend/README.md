# DATEV Export

Neue DATEV-Funktion im Rechnungsmodul:

- **Einstellungen → DATEV**: Tab zum Hinterlegen der DATEV-Export-E-Mail (nur mit Permission `settings.general`). Adresse muss gültig sein, Speicherung erfolgt in `datev_settings`.
- **Rechnungsübersicht**: Button `DATEV EXPORT` pro Rechnung sendet die PDF direkt an die DATEV-Adresse. Statusfeld zeigt `DATEV: Offen/Gesendet/Fehlgeschlagen`.
- **E-Mail-Versand**: Im Versand-Modal gibt es `Senden + DATEV`. Die Kunde-Mail wird dabei per BCC auch an DATEV geschickt (Adresse bleibt für den Kunden verborgen).

Statusfelder in der Tabelle `invoices`:

- `datev_export_status` (`NOT_SENT`, `SENT`, `FAILED`)
- `datev_exported_at`
- `datev_export_error`

API:

- `GET/PUT /api/settings/datev` (Datev-Adresse lesen/speichern)
- `POST /api/invoices/:id/datev-export` (PDF an DATEV schicken)
- `POST /api/invoices/:id/send-email` mit `include_datev: true` (Kunde + DATEV in einem Versandlauf)

Tests:

```bash
npm test
```
