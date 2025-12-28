# Invoice Create Flow – Review (Stand: dev\_Prisma)

## A) Relevante Komponenten/Dateien
- **Frontend**
  - `frontend/src/modules/App.tsx`: `InvoiceFormModal` (Create/Edit UI + Validierung), Create-Route, Navigation nach Erfolg; `InvoiceDetailPage` (Post-Create Ziel).
  - `frontend/src/modules/api.ts`: `createInvoice`, `listCustomers`, `listCategories`, `getNextInvoiceNumber`.
- **Backend**
  - `backend/src/routes/invoice.routes.js`: POST `/api/invoices`, GET `/api/invoices/next-number`, GET `/api/invoices/:id`.
  - `backend/src/controllers/invoice.controller.js`: `createInvoice`, `getInvoiceById`, `calculateTotals`, PDF-Metadaten in `ensureInvoicePdf`.
  - `backend/prisma/schema.prisma`: Modelle `invoices`, `invoice_items`, `recipients`.

## B) Request/Response Shapes
- **POST /api/invoices** (Frontend-Payload)
  ```json
  {
    "recipient": { "name": "...", "street": "...", "zip": "...", "city": "...", "email": "...?" },
    "invoice": {
      "invoice_number": "",          // optional, server generiert falls leer
      "date": "YYYY-MM-DD",
      "b2b": false,
      "ust_id": null,
      "category": "key|null",
      "reservation_request_id": null
    },
    "items": [
      { "description": "...", "quantity": 1, "unit_price_gross": 99.99, "vat_key": 1 }
    ]
  }
  ```
- **201 Response**: `{ "message": "Rechnung erfolgreich erstellt", "invoice_id": <number> }`
- **GET /api/invoices/next-number**: `{ "next": "YYYYMMxxx" }`
- **GET /api/customers**, **GET /api/categories**: Listen für Form-Vorschläge.
- **GET /api/invoices/:id** (Detail nach Create): `{ invoice, items, pdf }` inkl. `gross_total`, `net_19/net_7`, `vat_19/vat_7`, PDF `location/url`.

## C) Ist-Ablauf (Steps)
1. Beim Öffnen der Create-Ansicht lädt das Frontend parallel: `listCustomers()`, `listCategories()`, `getNextInvoiceNumber()`; setzt initiale Rechnungsnummer, Items-Array `[ {description:"", quantity:1, unit_price_gross:0, vat_key:1} ]`.
2. Nutzer füllt Empfänger, Rechnungsdaten, Positionen. OnChange von Mengen/Preisen werden Strings via `normalizeNumberInput` (Komma → Punkt, leere Strings bleiben leer) gespeichert; beim Submit werden Zahlen via `parseNumberValue` geprüft.
3. Frontend-Validierung: Empfängername + Straße/PLZ/Ort required; Datum required; mind. 1 Position; jede Position Beschreibung + quantity>0 + unit_price>0; bei B2B ust\_id required.
4. Submit: `createInvoice(payload)` → bei Erfolg: `onSaved(invoice_id, invoice_number)` navigiert zur Detailseite und zeigt Toast.
5. Backend `createInvoice`: Validiert dieselben Pflichtfelder; `parseDecimalInput` akzeptiert Komma-Zahlen; `calculateTotals` summiert nach vat\_key (1=19%, 2=7%) und schreibt `net_19/net_7/vat_19/vat_7/gross_*`; fehlende Rechnungsnummer wird via `computeNextInvoiceNumber()` generiert.
6. Datenbank: Empfänger wird gesucht/angelegt (name+street+zip+city), `invoices` Zeile mit Totals angelegt, `invoice_items` per `createMany` mit `line_total_gross = quantity * unit_price_gross`.
7. Detail-View lädt `/api/invoices/:id`, zeigt Betrag/Status/PDF-Infos; PDF-URL `/api/invoices/:id/pdf?mode=inline`.

## D) Findings (max 10)
- [RISK] Totals-Berechnung im Backend nutzt einfache Division für VAT (gross/(1+rate)), aber speichert keine Rundung → potenzielle Rundungsdifferenzen zwischen Frontend, PDF und DB.
- [RISK] `calculateTotals` ordnet vat\_key nur 19% oder 7% zu; andere Keys würden still als 7% behandelt (Backend-Validierung lässt nur 1|2 zu, aber Mapping ist implizit).
- [UX] Frontend erlaubt leere Rechnungsnummer bei Create; Suggestion kommt erst nach Laden. Bei langsamer API könnte der Nutzer tippen, bevor `next-number` kommt.
- [UX] Komma-Handling erfolgt erst beim Submit/State-Normalisierung; Fehlermeldung bleibt generisch (“Preis > 0”) statt zu sagen, dass die Zahl ungültig war.
- [CLEANUP] Detail-View berechnet VAT-Summary mit lokalem Map, obwohl aggregierte Felder vorhanden; Doppelberechnung erhöht Risiko von Abweichungen.
- [CLEANUP] Fehlende exhaustive-deps Warnings bleiben (intentional), könnten aber echte Race Conditions maskieren.
- [BUG] `pdfFilename`-Ableitung/URL in Detail nutzt `window` und `URL` ohne Guards; serverseitig (SSR) wäre das brüchig. (Derzeit nur CSR, aber Risiko bei Tests.)
- [RISK] Empfänger-Deduplikation basiert nur auf name+street+zip+city, Mail/Phone werden nicht geprüft → kann unerwartet zusammenführen, wenn gleiche Adresse aber anderer Kontakt.
- [CLEANUP] Items mit vat\_key != {1,2} werden bereits im Backend blockiert; Frontend-Select hartcodiert 19/7, kein Fallback/Label aus Backend.
- [UX] Nach Create sofortiger Navigation zur Detailseite; kein expliziter Hinweis auf generierte Nummer oder PDF-Status, außer Toast im Caller.

## E) Fixplan (geordnet, minimal-invasiv)
1) **Validierung/Kommunikation (Frontend)**  
   - Datei: `frontend/src/modules/App.tsx`  
   - Verbessere Fehlermeldungen bei ungültigen Zahlen (z.B. “Zahl ungültig, bitte Punkt/Komma verwenden”) und nutze das früh im OnChange-Parsing.
2) **Totals/Rundung transparenter machen (Backend)**  
   - Datei: `backend/src/controllers/invoice.controller.js`  
   - Runde Zwischensummen (z.B. auf 2 Nachkommastellen) konsistent und dokumentiere die Logik; ggf. Kommentar zu 19/7-Schlüssel.
3) **VAT-Summary auf Detail vereinfachen**  
   - Datei: `frontend/src/modules/App.tsx` (InvoiceDetailPage)  
   - Nutze, falls vorhanden, die aggregierten Felder `net_19/net_7/vat_19/vat_7/gross_total` als Primärquelle; Item-Recalc nur als Fallback.
4) **`window`/`URL` Guards**  
   - Datei: `frontend/src/modules/App.tsx` (pdfFilename Ableitung)  
   - Wrap in `typeof window !== "undefined"` / try-catch; Fallback auf simple String-Splits ohne DOM-APIs.
5) **Empfänger-Deduplikation Klarstellen**  
   - Datei: `backend/src/controllers/invoice.controller.js`  
   - Kommentar/Optional: Match zusätzlich auf E-Mail, oder Hinweis in Code/Doc, damit ungewolltes Merge vermieden wird.
6) **Exhaustive-deps Aufräumen (selektiv)**  
   - Datei: `frontend/src/modules/App.tsx`, `frontend/src/modules/AuthProvider.tsx`  
   - Prüfe Warnungen, füge bewusst fehlende Abhängigkeiten hinzu oder kommentiere sie mit Begründung, um Signal-Rauschen zu reduzieren.
