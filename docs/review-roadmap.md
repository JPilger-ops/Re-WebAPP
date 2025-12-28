# Review-Roadmap: PDF, Rechnungen, Kunden, E-Mail

## Ziele
- Vollständige Sicht auf die Erstellungs- und Versandstrecken (PDF, Rechnung, Kunde, E-Mail).
- Fehlerquellen dokumentieren, ohne laufenden Flow zu verändern.
- Klare nächste Schritte pro Bereich priorisieren.

## Relevante Komponenten (Orientierung)
- Backend: `backend/src/controllers/invoice.controller.js`, `services/pdf.service.js` (falls vorhanden), Prisma-Schema und Migrations, Mail-Services.
- Frontend: `frontend/src/modules/App.tsx` (InvoiceFormModal, Invoices/Detail, Mail-Senden), `frontend/src/modules/api.ts` (API-Wrapper), UI-Komponenten (Modal/Spinner).
- PDF-Assets: `backend/public`/`pdf` Templates, Ablage unter `/app/pdfs`.
- E-Mail: Preview/Send Endpoints, Kategorie-Templates (Category Logos/SMTP).

## Bereichsweise Review & potenzielle Fehlerquellen

### 1) PDF-Erstellung & Auslieferung
- Rendering-Trigger: `regenerateInvoicePdf` wird nach erfolgreichem Erstellen explizit angestoßen; Öffnen liefert vorhandene PDFs, Force verschiebt alte Datei nach `pdfs/trash/`.
- Speicherort/Locking: DATEV-Export gesperrte PDFs werden nur gelesen, nicht überschrieben (423). Force überschreibt sonst (mit Move).
- Mögliche Fehlerquellen:
  - [BUG] Force/Trash: fehlende Rechte oder fehlender Pfad auf Ziel (`/app/pdfs/trash`) könnten zu 500 führen.
  - [RISK] PDF-Dateiname/Location nur implizit aus ID/Number abgeleitet; Inkonsistenz möglich, wenn Templates angepasst werden.
  - [RISK] Keine dedizierten Checks auf korruptes PDF; Lesen per `fs.readFileSync` wirft 500 statt saubere 4xx.

### 2) Rechnungserstellung (Backend/Frontend)
- Frontend: InvoiceFormModal validiert Pflichtfelder, auto-fill Kunde per Name, sendet `recipient.id` bei Match; Preiseingabe trennt Input-String und Parsing.
- Backend: `createInvoice` validiert Empfänger/Items, nutzt vorhandene `recipient_id` (falls übermittelt), dedupliziert sonst über name/street/zip/city, berechnet Summen 19%/7% und schreibt Items.
- Mögliche Fehlerquellen:
  - [BUG] recipient_id ungültig (z.B. gelöschter Kunde) -> 400; Frontend bietet keinen expliziten Fallback außer manuelle Anpassung.
  - [RISK] Summenberechnung hängt an zwei VAT-Keys (1/2); falsche Konfiguration könnte unerwartete Keys zulassen (Validierung schützt teilweise).
  - [RISK] Nummernkonflikt 409: Frontend übernimmt Vorschlag, aber kein Retry-Auto-Flow.

### 3) Kunden-Erstellung & Pflege
- Frontend: CustomerFormModal (Name Pflicht, rest optional), InvoiceFormModal auto-fill per exaktem Namensmatch (case-insensitive).
- Backend: `recipients` dedupe auf name+street+zip+city; Aktualisierung von company/email/phone nur, wenn leer.
- Mögliche Fehlerquellen:
  - [BUG] Mehrdeutige Kundennamen ohne Straße/PLZ im Frontend führen zu keinem Match → manuelle Doppelanlage möglich.
  - [RISK] Teilweise leere Adressen (street/zip/city optional im Customer-Modal, aber Pflicht in Invoice) können zu Inkonsistenzen führen.
  - [RISK] Keine weiche Suche im Frontend (nur exact match) → User könnte bestehende Kunden übersehen.

### 4) E-Mail-System
- Frontend: Preview/Send Modal, Category-basierte SMTP/Template-Auswahl, optional DATEV-Adresse.
- Backend: `getInvoiceEmailPreview`, `sendInvoiceEmailApi` (per Category SMTP, Logo, Template).
- Mögliche Fehlerquellen:
  - [BUG] Fehlende SMTP-Konfiguration führt zu Laufzeitfehlern; derzeit eher generische Fehlermeldung.
  - [RISK] HTML/Text Template Divergenz zu PDF (z.B. Totals oder VAT-Rates) bei Template-Änderungen.
  - [RISK] Kein dediziertes Rate-Limit/Retry, potenziell mehrfaches Senden bei UI-Doppelclicks.

## Nächste Schritte (empfohlen)
1) PDF-Härtung  
   - Fehlerpfad für fehlgeschlagenes Lesen (korrupt/fehlende Datei) in 404/410 übersetzen statt 500.  
   - Sicherstellen, dass `pdfs/trash` immer existiert (mkdirp beim Force).
2) Rechnungserstellung Robustheit  
   - recipient_id Fallback: Wenn 400 durch fehlenden Empfänger, UI-Hinweis + Auswahl vorhandener Kunden anbieten.  
   - Nummernkonflikt: Automatisch neuen Vorschlag übernehmen und erneut senden (optional Confirm).
3) Kunden-Suche verbessern  
   - Fuzzy/Prefix-Suche in Vorschlagsliste (nicht nur Exact Match).  
   - Optional: Anzeige weiterer Treffer (Adresse) im Suggest, um Doppelanlagen zu vermeiden.
4) E-Mail-Transparenz  
   - Spezifischere Fehlermeldungen bei fehlender SMTP-Konfiguration.  
   - Optional: Logs/Status im UI anzeigen (letzter Sendeversuch).
