# Mitwirken

Danke, dass du an diesem Projekt mitarbeitest! Diese Konventionen halten den Code konsistent
und das Deployment stabil.

## Workflow

1. Aktuellen Stand holen: `git pull` auf `main`.
2. Feature-Branch erstellen: `git checkout -b feature/<kurzbeschreibung>`.
3. Änderungen umsetzen, lokal prüfen: `npm run lint && npm run build`.
4. Commit (siehe Konventionen unten), pushen, **Merge Request** gegen `main` öffnen.
5. Mindestens ein Review, grüne Pipeline → Merge.

> `main` ist geschützt. Direkte Pushes sind nicht erlaubt; Änderungen laufen über MRs.

## Branch-Namen

- `feature/<thema>` – neue Funktionen
- `fix/<thema>` – Fehlerbehebungen
- `chore/<thema>` – Wartung, Abhängigkeiten, Build

## Commit-Nachrichten

Wir verwenden [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: Werkzeug "Stakeholder-Radar" mit Mehrfachauswahl
fix: API-Fehlermeldung bei ungültigem Gemini-Key
chore: Abhängigkeiten aktualisiert
docs: README zur KI-Anbindung ergänzt
```

## Code-Stil

- ESLint + Prettier sind verbindlich (`npm run lint`, `npm run format`).
- Vue-Komponenten in `<script setup lang="ts">`.
- Keine neuen Abhängigkeiten ohne Absprache.

## Ein neues Werkzeug ergänzen

Die meisten Werkzeuge sind rein datengetrieben:

1. In `src/config/menu.ts` einen Eintrag in der passenden Säule (`children`) ergänzen –
   inkl. `promptPattern` (oder `promptPatterns` für Varianten) und `why`-Text.
2. Die generische `ToolView.vue` rendert Eingabe, Prompt-Editor und Ergebnis automatisch.
3. Nur für Spezial-Abläufe (z. B. mehrstufige Wizards, Backlog-Tabelle) eine eigene
   Komponente anlegen und in `App.vue` einbinden.
