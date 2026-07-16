# RE-Assistant

IREB-orientierter Requirements-Engineering-Assistent mit KI-Unterstützung (Vue 3 + TypeScript + Vite).

## Kurzüberblick

- Interaktive RE-Werkzeuge für Ermittlung, Dokumentation, Validierung und Management
- KI-Provider: Gemini und Anthropic
- Atlassian-Integration für Jira und Confluence
- Lokaler MCP- und Confluence-Proxy für stabile Entwicklung

## Voraussetzungen

1. Node.js
- Empfohlen: 22.12+ (oder 20.19+)

2. npm
- Wird mit Node.js installiert

3. Keine globalen Tools erforderlich
- Kein globales Vite
- Kein Docker
- Keine lokale Datenbank

4. Atlassian Cloud (nur für Jira/Confluence-Features)
- Atlassian-Domain, z. B. your-company.atlassian.net
- E-Mail + API-Token
- Jira-Projektschlüssel, z. B. REQ
- Optional: Confluence-Space-Key

5. Freie lokale Ports
- 5173 (Vite)
- 4000 (MCP-Proxy)
- 8788 (Confluence-Proxy)

Schnellcheck:

```bash
node -v
npm -v
```

## Installation

```bash
npm install
```

## Lokale Konfiguration

1. Datei `.env.local` anlegen (oder aus `.env.example` ableiten)
2. Optional Domain und Proxy-Defaults setzen:

```env
VITE_ATLASSIAN_DOMAIN=your-company.atlassian.net
VITE_MCP_PROXY_URL=http://localhost:4000/api/mcp
VITE_CONFLUENCE_PROXY_URL=http://localhost:8788
```

Siehe vollständige Variablen in [.env.example](.env.example).

## Lokaler Start

Empfohlen (alles in einem Befehl):

```bash
npm run dev:local
```

Das startet:
- Vite Dev Server: http://localhost:5173/
- MCP Proxy: http://localhost:4000
- Confluence Proxy: http://localhost:8788

Health-Checks:
- http://localhost:4000/health
- http://localhost:8788/health

Alternativ getrennt:

```bash
npm run mcp:proxy
npm run confluence:proxy
npm run dev
```

## Wichtige Skripte

- `npm run dev` startet nur den Vite-Devserver
- `npm run dev:local` startet lokalen Gesamt-Stack
- `npm run build` führt Typecheck + Production Build aus
- `npm run lint` führt ESLint aus
- `npm run test` führt Vitest aus

## Atlassian in der App konfigurieren

1. In der App auf das Schluessel-Symbol klicken
2. `Atlassian Cloud (Jira + Confluence)` waehlen
3. Domain, E-Mail, API-Token und Jira-Projektschluessel eintragen
4. `Verbindung testen` und danach `Speichern`

Hinweis: Zugangsdaten werden lokal im Browser (localStorage) gespeichert.

## Hinweis zu MCP im UI

Der Eintrag `MCP Atlassian` ist im Konfigurationsdialog aktuell sichtbar, aber deaktiviert (`aktuell nicht genutzt`).
MCP-Kontext wird weiterhin ueber den lokalen Proxy und die Umgebungsvariablen unterstuetzt.

## Smoke-Test Checkliste

Technisch:

```bash
npm run lint
npm run test
npm run build
```

Funktional:

1. App startet unter http://localhost:5173/
2. Health-Endpunkte beider Proxies liefern 200
3. Atlassian-Verbindung im Modal erfolgreich
4. Jira-Uebergabe einer Beispielanforderung funktioniert
5. Confluence-Sync erstellt oder aktualisiert Seite

## Sicherheit

- API-Keys und Atlassian-Credentials liegen lokal im Browser
- Nur auf vertrauenswuerdigen Geraeten verwenden
- Fuer Produktion ist ein abgesicherter Backend/Proxy-Ansatz empfohlen

## Projektdateien

- [src/App.vue](src/App.vue)
- [src/stores/project.ts](src/stores/project.ts)
- [src/stores/settings.ts](src/stores/settings.ts)
- [src/services/ai.ts](src/services/ai.ts)
- [src/services/mcp.ts](src/services/mcp.ts)
- [package.json](package.json)
- [CONTRIBUTING.md](CONTRIBUTING.md)
