# Design-Diff (A1–A7) Kurzüberblick

## Was geändert wurde
- **A1**: Fixes Shell-Layout (Sidebar/Topbar fix, Content scrollt).
- **A2**: Apple-like UI-Komponenten (Buttons/Inputs/Cards/Alerts).
- **A3**: Tabellen ohne Horizontal-Scroll (Invoices, Customers, Dashboard u.a.).
- **A4**: Invoice Detail als Inspector-Layout (2 Spalten).
- **A5**: Settings im macOS-Preferences Look (Nav + Pane).
- **A6**: Subtile Motion, respects prefers-reduced-motion.
- **A7**: Cross-Platform Polish (macOS/Windows Font Stack, Scrollbar light-touch).

## Wo Styles/Komponenten liegen
- `frontend/src/index.css`: globale Typo, Scrollbar, Motion, Inputs/Buttons (klassische Klassen).
- `frontend/src/modules/ui.tsx`: Buttons, Inputs, Modal, MoreMenu, Alerts, etc.
- Layouts: `frontend/src/modules/App.tsx` (Shell, Seiten-Layouts).

## Do / Don’t Guidelines
- **Do**: Eine Primary Action pro Block, weitere in MoreMenu.
- **Do**: Keep tables vertical-scroll-only; stack secondary info statt viele Spalten.
- **Do**: Fokus sichtbar lassen; Motion nur über motion-safe (respect reduce).
- **Don’t**: Keine Inline-Button-Wände; keine h-scrollbars hinzufügen.
- **Don’t**: Keine harten Color-Overrides (Farbschema bleibt).
- **Don’t**: Keine großen Font-Experimente (System Stack belassen).
