# Roadmap: Deployment Wizard, Guided Update, README, Admin-Setup, npm Warnfixes

## Ziele
- Geführtes Setup/Update per Script (Wizard), inkl. “current”-Symlink-Rollout.
- Klare Installationsanleitung in README.
- Admin-User beim Setup mit Standard-PW `admin` setzen (danach änderbar).
- npm Warnungen (deprecated) nach Möglichkeit eliminieren.

## Arbeitspakete
1) Wizard/Install-Script
   - Bestehendes Script prüfen/umstellen auf geführte Eingaben (Pfad, .env, Ports, DB, PDF-Pfade).
   - “current”-Symlink-Option: Deploy in versions/RELEASE_HASH, Symlink `current` umschalten, optional Rollback-Hinweis.
   - Optionen: fresh install vs. update; optional seed; set admin user (username+PW=admin) sofern nicht vorhanden.
2) Guided Update (Git + Symlink)
   - Script-Schritt: git fetch/pull, build, migrations, assets; dann Symlink `current` atomar umstellen.
   - Prüfschritt vor Switch: healthcheck (npm typecheck, docker compose build optional).
3) README / Doku
   - Install/Update Abschnitt: Voraussetzungen (Docker/Compose), Schritte mit Wizard, Symlink-Modell, Admin-Login default.
   - Hinweis: Standard-PW nach erstem Login ändern.
4) Admin-User Setup
   - Script ruft API/DB Helper: falls kein admin existiert, create admin/admin; sonst überspringen.
   - Ausgabemeldung mit Warnung zum Passwortwechsel.
5) npm deprecated Warnungen
   - `npm --prefix frontend/backend ls` oder `npm audit` minimal check; gezielt ersetzbare Pakete updaten (ohne Breaking).
   - Nur Warnfixes, keine großen Refactors.

## Checks
- `npm --prefix frontend run typecheck`
- `docker compose build`
- `curl /api/version` (sha != unknown, number gesetzt)

## Rollout-Hinweise
- Migrationen beachten (falls für Admin/Setup benötigt).
- Symlink-Deploy: sicherstellen, dass docker-compose Pfade relativ zu `current` funktionieren (Volume/Binds).
