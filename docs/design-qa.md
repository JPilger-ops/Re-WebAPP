# Design QA (Apple-Look) – Schnell-Check

## Kernregeln (Must-have)
- Keine horizontalen Scrollbars in Tabellen.
- Sidebar bleibt fix, nur Content scrollt; Sidebar kollabierbar (State persistiert).
- One-Primary-Action pro Block, weitere Aktionen im MoreMenu.
- Fokus sichtbar (Keyboard), Hover/Active subtil.
- prefers-reduced-motion respektiert (Animationen werden deaktiviert).
- System-Font-Stack für macOS/Windows.

## Schneller 5-Minuten-Walkthrough (UI Smoke)
1) Login: `/login` – Formular lädt, Fokus-Ring sichtbar, kein H-Scroll.
2) Dashboard: `/dashboard` – Cards + “Letzte Rechnungen” Liste ohne H-Scroll, MoreMenu je Zeile.
3) Customers: `/customers` – Filter + Liste ohne H-Scroll, Modal öffnen/schließen smooth.
4) Invoices List: `/invoices` – Filter sticky, Tabelle scrollt vertikal im Container, keine H-Scroll, MoreMenu je Zeile.
5) Invoice Detail: `/invoices/:id` – Inspector-Layout (2 Spalten auf Desktop), keine H-Scroll, MoreMenu Aktionen.
6) Categories: `/categories` – Liste gestapelt, MoreMenu, keine H-Scroll.
7) Stats: `/stats` – KPIs/Tabellen ohne H-Scroll.
8) Settings: `/settings` – macOS-Preferences-Look, Linke Nav + Pane, Tabs/Abschnitte prüfen:
   - Branding/Favicon (Preview, Reset)
   - Mail/SMTP (Test-Mail UX)
   - E-Mail Vorlagen (Speichern + Preview)
   - PDF Path (Test)
   - Network (Origins + Diagnostics)
   - HKForms/API Keys, DATEV, Bank/Steuer, Sicherheit
9) Admin: `/admin/users`, `/admin/roles` – Listen ohne H-Scroll, MoreMenu; Rollen/Permissions ohne Matrix-Overflow.

## Seiten + Expected Outcomes
- **/login**: Form klar, Fokus sichtbar, kein Layout-Shift.
- **/dashboard**: Sidebar fix, Content scrollt; “Letzte Rechnungen” gestapelt, MoreMenu.
- **/customers**: Gestapelte Zeilen (Name, Kontakt, Adresse), Actions im MoreMenu, keine H-Scroll.
- **/invoices**: Filter sticky, Tabelle vertikal scrollbar, Zeilen gestapelt (Nr/Kunde/Kat/Datum/Status/DATEV), Actions im MoreMenu.
- **/invoices/:id**: Inspector-Layout; Overview, Empfänger, Positionen als Cards; Meta/Timeline rechts; keine Button-Wand.
- **/categories**: Logos/Infos gestapelt, MoreMenu für Aktionen, keine H-Scroll.
- **/stats**: Tabellen/Listen ohne H-Scroll; Filter oben.
- **/settings**: macOS-Preferences Pane; pro Tab klare Beschriftungen, Status/Save/Test Buttons konsistent.
- **/admin/users**, **/admin/roles**: Listen gestapelt; Permissions je Rolle ohne horizontale Matrix (Listen/Wrap), MoreMenu für Aktionen.

## Wie testen (kurz)
- Lokal/Browser: Fenster schmal ziehen (z.B. 1200→800px): keine H-Scroll auf oben genannten Seiten.
- Keyboard: Tab-Reihenfolge, Fokus-Ring sichtbar; MoreMenu/Modal per Keyboard erreichbar.
- Motion: In DevTools “prefers-reduced-motion” aktivieren → Animationen praktisch aus; sonst subtile Fade/Slide.
- Fonts: Prüfen auf macOS + Windows (system fonts), keine UI-Sprünge.

## Nach UI-Änderungen
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `docker compose up -d --build` + Smoke-Checks (`check:api`, `check:pdf`, `check:invoice`)
- Optional: `npm --prefix backend run check:roadmap`
- Manuelle Design-QA mit obiger Checkliste.
