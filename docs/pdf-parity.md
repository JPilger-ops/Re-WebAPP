# PDF Parity – Erwartete Marker (dev_DOCKER vs dev_Prisma)

Ziel: Sicherstellen, dass die gerenderten Rechnungs-PDFs in dev_Prisma die gleichen Kerninhalte wie dev_DOCKER enthalten. Marker werden im HTML vor dem Rendern geprüft (ohne OCR).

## Erwartete Pflicht-Marker im PDF-HTML
- Company Name (Header) – `company_name`
- Anschrift (address_line1/2, zip, city, country) – in Sender/Brand/Sender-Line
- Invoice Number – `invoice.invoice_number`
- Invoice Date – formatiert `dd.mm.yyyy`
- Recipient Name + Adresse – `invoice.recipient.*`
- Beträge (net_19/net_7/gross_total) – in Tabellen/Final-Summe
- IBAN – aus Header oder Bank Settings (mit Spaces)
- BIC – aus Header oder Bank Settings
- Footer Text – `footer_text`
- VAT ID – `vat_id`

## Optionale Marker
- Kategorie-Logo: eingebettet als Base64/URL, falls gesetzt
- SEPA/EPC QR: QR-Image vorhanden (Base64) und Verwendungszweck „Rechnung <nr> / <name>“
- Reverse-Charge Hinweis: nur bei B2B
- DATEV-Info: nicht im PDF, aber relevant für Mail/Export

## Differenzen dev_DOCKER vs dev_Prisma (bekannt)
- Layout ähnlich, aber React/Prisma Version nutzt Header-Settings + Bank-Fallback; Logo-Pfad kann Base64 oder `/logos/<file>` sein.
- PDF-Titel wird auf Dateiname gesetzt; tmp->rename für Atomic Write.
- SEPA-QR wird immer erzeugt (auch wenn B2B=false).

## Testskript
- `npm --prefix backend run check:pdf-parity`
- Schritte: Header/Bank temporär setzen → Kategorie+Logo, Kunde, Rechnung anlegen → PDF + Regenerate → Marker im HTML prüfen → Cleanup + Settings zurücksetzen.
- Marker: company_name, IBAN, BIC, invoice_number, recipient_name, footer_text.

