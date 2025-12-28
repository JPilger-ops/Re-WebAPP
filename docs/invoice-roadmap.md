# Invoice creation roadmap

## Ziele
- Bestehende Kunden beim Ausfüllen erkennen und automatisch übernehmen.
- PDFs nur einmal rendern und bei späterem Öffnen aus dem bestehenden File ausliefern.
- Laufende Qualität sichern (Types, Builds, Version-Metadaten).

## Arbeitspakete (Schrittfolge)
1) Sichtung & Abgleich  
   - Frontend: InvoiceFormModal (Create-Flow), Kundenliste/Autovervollständigung.  
   - Backend: `createInvoice` Handling für Empfänger-Reuse und PDF-Auslieferung.  
   - PDF: Aufrufpfad beim Öffnen (inline), Konflikt/Lock-Verhalten (DATEV).
2) Kunden-Autofill ergänzen  
   - Namensabgleich (case-insensitive) gegen vorhandene Kunden.  
   - Bei Treffer: recipient_id setzen, Adress-/Kontakt-Felder füllen.  
   - Payload um recipient_id erweitern; Backend soll ID bevorzugt nutzen.
3) PDF-Reuse sicherstellen  
   - Beim Öffnen vorhandene Datei direkt liefern; kein Re-Render.  
   - Force/Neu-render nur via explizitem Trigger (verschiebt alte Datei in `pdfs/trash/`).  
   - UI: Kein Hard-Reload des PDFs nötig.
4) UI-Verbesserungen (aktuell)  
   - Erstellen-Flow: Button-Beschriftungen anpassen („Erstellen“, „Details öffnen“).  
   - Fehler-Dialog: Button „Löschen und Neu erstellen“ mit Sicherheitsabfrage.  
   - PDF direkt nach erfolgreichem Erstellen generieren/speichern.  
5) Qualität & Nachweise  
   - `npm --prefix frontend run typecheck`  
   - `docker compose build` (BuildKit aktiv).  
   - `curl /api/version` mit gesetztem sha/number.  
   - Commit/Push: `ci(version): inject build metadata from git`

## Offene Risiken / Beobachtungen
- Kundenabgleich sollte keine manuell abweichenden Adressen überschreiben. Lösung: nur bei exaktem Namens-Treffer auto-fillen, danach manuelle Anpassung zulassen.
- PDF-Konflikte sollten nicht mehr auftreten; falls doch, UI-Dialog für Rückfrage vorhalten.
