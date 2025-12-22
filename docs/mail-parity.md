# Mail Parity (dev_DOCKER vs dev_Prisma)

## Erwartetes Verhalten
- SMTP Priorität: Kategorie-SMTP (falls gesetzt) > globale DB-SMTP > ENV-Fallback.
- From/Reply-To: aus Kategorie-Mailkonto, sonst global SMTP `from`, sonst ENV. Reply-To aus Kategorie oder globalem `reply_to`.
- Templates: Betreff und Body verwenden Platzhalter (u.a. Rechnungsnummer, Empfängername, Betrag). Kategorie-Template überschreibt globale Fallbacks.
- Subject sollte die Rechnungsnummer enthalten; Body enthält Empfängername und Positions-/Summeninformationen.
- DATEV/BCC: Export/Adressierung nur, wenn DATEV-Mail konfiguriert und Option aktiviert (Send-Endpoint kann BCC/Anhang ergänzen); im Preview sichtbar, ob DATEV konfiguriert ist.
- Send-Safe-Mode: `EMAIL_SEND_DISABLED=1` oder `EMAIL_REDIRECT_TO` führt zu Dry-Run/Redirect statt echtem Versand. Kategorie- bzw. globale SMTP wird dennoch als Quelle verwendet.

## Relevante Dateien
- `backend/src/controllers/invoice.controller.js` (buildEmailContent, sendInvoiceEmail, email-preview)
- `backend/src/controllers/category.controller.js` (Template/SMTP je Kategorie)
- `backend/src/utils/smtpSettings.js` (globale SMTP-Auflösung)
- `backend/src/utils/categoryTable.js` (Kategorie-Daten)

## Test (automatisiert)
- `npm --prefix backend run check:mail-parity`
  - Legt Kategorie mit Template + SMTP an
  - Legt Kunden + Rechnung an (mit Kategorie)
  - Prüft Email-Preview: Subject enthält Rechnungsnummer, Body enthält Empfängername und Template-Marker
  - Optionaler Send nur im Safe-Mode (EMAIL_SEND_DISABLED/REDIRECT oder CHECK_ALLOW_EMAIL=1)
  - Cleanup am Ende (Invoice, Customer, Category)
