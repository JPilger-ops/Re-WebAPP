# UI Guidelines: One-Button Rule & MoreMenu Pattern

## One-Button Rule
- Auf allen Seiten (außer Einstellungen) pro Block/Zeile nur **einen sichtbaren Primärbutton** (z. B. „Neu“).
- Alle weiteren Aktionen wandern in ein Overflow-Menü („Mehr …“) per `MoreMenu`.
- Kritische Aktionen (Löschen) erhalten Confirm-Dialog und `danger`-Styling.

## MoreMenu Component
- Nutzung: `<MoreMenu items={[{ label, onClick, icon?, danger?, disabled? }]} />`
- Keyboard-freundlich (Enter/Space auf dem Summary), schließt nach Klick.
- Danger-Items rot, Disabled reduziert und ohne Aktion.
- Für Confirm: Aktion im Item ruft vorab den Confirm-Dialog auf.

## Empfehlungen
- Refresh/Aktualisieren als Menü-Eintrag, nicht als extra Button.
- Toolbars: 1 Primäraktion (z. B. „Neu“), Rest via MoreMenu.
- Tabellenzeilen: keine Button-Wände; Overflow-Menü je Zeile.
- Admin/Settings können mehr Aktionen haben, folgen aber dem Muster.
