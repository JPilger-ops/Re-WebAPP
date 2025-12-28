# Roadmap: Statistiken, Einstellungen (PDF/Netzwerk/Sicherheit/Bank), Login-Logout-Timer

## Ziele
- Statistiken: Filter kompakter und intuitiver darstellen.
- Einstellungen: PDF-Pfade (archive/trash) konfigurierbar; Netzwerk-Settings über Buttons klarer; Zertifikat Upload/Download im Security-Tab; Bank/Steuer/Rechnungskopf Felder vereinfachen/zusammenführen.
- Login: Auto-Logout nach 5 Minuten Inaktivität inkl. Countdown-Anzeige neben Logout-Button.

## Arbeitspakete
1) Statistiken – kompakte Filter
   - Sichtung: Stats-UI/Seite und API-Parameter.
   - Design: Zwei-zeiliges kompaktes Grid (Desktop) mit klaren Platzhaltern; gleiche Funktionalität.
   - Umsetzung: Layout-Anpassung + optional Default-Sort; kein Logik-Refactor.

2) Einstellungen – PDF-Pfade konfigurierbar
   - Backend: ENV/DB Felder für `PDF_ARCHIVE_PATH` und `PDF_TRASH_PATH`; Fallback auf bisherige Pfade.
   - Admin-UI: Eingabefelder + Validierung (existiert/verzeichnis); Hilfe-Text, Save-Button.
   - Nutzung: `getPdfDir`/Archive/Trash-Lokation auf neue Settings umbauen, ohne Flow zu verändern.

3) Einstellungen – Netzwerk (Buttons & Klarheit)
   - Identifizieren der Netzwerk-Settings-Komponente.
   - Buttons statt freiem JSON: z.B. „Proxy testen“, „Reset“, klare Labels/Tooltips.
   - Keine Logik-Änderung, nur UI/UX.

4) Einstellungen – Zertifikat Upload/Download (Security-Tab)
   - UI: Upload-Button (accept .pem/.crt/.key), Download bestehender Chain/Key falls erlaubt.
   - Backend: Endpunkte für Upload (persistiert im vorgesehenen Pfad) und Download (ACL: admin).
   - Validierung: Größe/Typ prüfen, Fehler klar anzeigen.

5) Einstellungen – Bank/Steuer/Rechnungskopf zusammenführen
   - Sichtung der Tabs/Forms.
   - Zusammenlegen redundanter Felder (Bank/Steuer) oder Querverlinkung; einheitliche Speichern-Action.
   - Hilfetexte aktualisieren.

6) Login – Auto-Logout Timer (5 Min)
   - Frontend: Aktivitäts-Tracker (mousemove/keypress/visibility); Timer reset, Anzeige neben Logout-Button.
   - Bei Inaktivität: Warn-Toast/Modal + Auto-Logout; Aktivität setzt Timer zurück.
   - Optional: env-konfigurierbare Dauer mit Fallback 5 Min.

## Tests/Checks
- `npm --prefix frontend run typecheck`
- `docker compose build`
- `curl /api/version` (sha ≠ unknown, number gesetzt)

## Rollout/Notes
- Keine Änderung am PDF-Flow außer konfigurierbaren Pfaden; bestehende Archiv/Trash-Mechanik bleibt.
- DATEV-Sperren bleiben unberührt.
