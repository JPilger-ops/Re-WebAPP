# E-Mail Templates (Plain Text)

## Prinzipien
- Templates werden als reiner Text gepflegt (kein HTML-Eingabefeld).
- Zeilenumbrüche/Leerzeilen bleiben erhalten; im HTML-Preview werden sie 1:1 mit `<br>` dargestellt.
- Platzhalter nutzen doppelte geschweifte Klammern (`{{placeholder}}`) und werden beim Versand ersetzt.
- Reihenfolge: Kategorie-Template > globales Template > Fallback-Standardtext.

## Platzhalter-Referenz
- `{{recipient_name}}`
- `{{recipient_street}}`
- `{{recipient_zip}}`
- `{{recipient_city}}`
- `{{invoice_number}}`
- `{{invoice_date}}` (tt.mm.jjjj)
- `{{due_date}}` (tt.mm.jjjj, +14 Tage)
- `{{amount}}` (z. B. `1.234,00 €`)
- `{{bank_name}}`
- `{{iban}}`
- `{{bic}}`
- `{{company_name}}`
- `{{category_name}}`

## Beispiel
Subject:
```
Rechnung {{invoice_number}} für {{recipient_name}}
```

Body (Text):
```
Hallo {{recipient_name}},

anbei deine Rechnung Nr. {{invoice_number}} vom {{invoice_date}}.
Der Betrag von {{amount}} ist fällig bis {{due_date}}.

Bank:
{{bank_name}}
IBAN: {{iban}}
BIC: {{bic}}

Vielen Dank!
{{company_name}}
```
