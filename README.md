# RE AI Assistant (RE-Assistant)

Ein leichtgewichtiges, lokal laufendes Frontend für KI-gestützte Requirements-Engineering-Werkzeuge (IREB CPRE).

Kurzüberblick
- **Zweck:** Sammlung von interaktiven RE-Werkzeugen (Zielbaum, Stakeholder-Analyse, Persona, Glossar, NFR-Ableitung u. v. m.), die KI-Prompts nutzen, um Anforderungen zu ermitteln, zu dokumentieren und zu modellieren.
- **Tech-Stack:** Vue 3, TypeScript, Vite, Pinia, TailwindCSS.

Wichtige Funktionen und Bestandteile
- `src/main.ts` — Startpunkt der App; initialisiert Pinia, Theme und lädt persistierten Projektzustand. [src/main.ts](src/main.ts#L1)
- `src/App.vue` — Root-Komponente; Sidebar, Header, Hauptansichten und globale Modals. [src/App.vue](src/App.vue#L1)
- Stores:
  - `src/stores/project.ts` — Projektzustand: Anforderungen, Glossar, Favoriten, Custom-Prompts, Persistenz (localStorage). [src/stores/project.ts](src/stores/project.ts#L1)
  - `src/stores/settings.ts` — Speicherung von API-Keys, Provider-Auswahl und Theme-Handling. [src/stores/settings.ts](src/stores/settings.ts#L1)
- Services:
  - `src/services/ai.ts` — Kern-Wrapper für KI-Aufrufe (Gemini / Anthropic), Fehlerbehandlung und Retry-Logik. [src/services/ai.ts](src/services/ai.ts#L1)
  - `src/services/mcp.ts` — Fetch/Serialisierung von MCP-Kontextdaten; Proxy-URL / Bearer-Token-Unterstützung. [src/services/mcp.ts](src/services/mcp.ts#L1)
  - `src/services/prompts.ts` — Prompt-Muster parsen und effektive System/User-Prompts erzeugen. [src/services/prompts.ts](src/services/prompts.ts#L1)
- Komponenten:
  - UI: `TheHeader`, `TheSidebar`, `ApiModal`, `ToastContainer`, `MermaidView` uvm. (siehe `src/components`).
  - `src/composables/useToast.ts` — Einfacher, reaktiver Toast-Mechanismus. [src/composables/useToast.ts](src/composables/useToast.ts#L1)
- Konfiguration: `src/config/menu.ts` enthält die vollständige Werkzeug-/Prompt-Struktur (IREB-Phasen & Werkzeuge). [src/config/menu.ts](src/config/menu.ts#L1)

Installation & Entwickeln
1. Abhängigkeiten installieren:

```bash
npm install
```

2. Entwicklung starten:

```bash
npm run dev
```

Build & Vorschau

```bash
npm run build
npm run preview
```

Wichtige npm-Skripte (aus `package.json`)
- `dev` — startet Vite-Devserver
- `build` — Type-Checking (`vue-tsc`) und Vite-Build
- `preview` — lokale Vorschau des Builds
- `lint` / `format` / `test`

API- & MCP-Konfiguration
- Die App speichert API-Keys und MCP-Einstellungen lokal im Browser. Unterstützte Provider: `gemini`, `anthropic`. Den MCP Bearer Token und die MCP-Endpunkt-URL direkt in den App-Einstellungen (Schlüssel-Icon) hinterlegen – keine Umgebungsvariablen nötig.
- Optional können die Umgebungsvariablen `VITE_MCP_URL` und `VITE_MCP_PROXY_URL` als vorausgefüllte Standard-URL gesetzt werden. Der hart codierte Fallback ist `https://mcp.atlassian.com/v1/mcp`.

Projektstruktur (Auszug)
- `src/` — Quellcode (Components, Stores, Services, Composables, Config)
- `public/` — statische Assets
- `package.json` — Skripte & Abhängigkeiten. [package.json](package.json#L1)
- `CONTRIBUTING.md` — Hinweise zur Mitarbeit. [CONTRIBUTING.md](CONTRIBUTING.md#L1)

Weiteres & Mitwirken
- Fehler, Feature-Requests oder Pull-Requests bitte via GitHub-Repository öffnen (siehe `CONTRIBUTING.md`).

Lizenz
- In diesem Repository ist keine spezifische Lizenzdatei enthalten; falls gewünscht, bitte eine passende `LICENSE`-Datei ergänzen.

Kontakt
- Projekt und Dokumentation befinden sich im Repository-Root.
# RE-Assistant

A lightweight IREB-aligned assistant with local API key storage for Google Gemini and Anthropic Claude.

## Supported AI Providers

- `gemini`: Google Gemini
- `anthropic`: Anthropic Claude

## Atlassian MCP Support

This app does not use Rovo. For Atlassian MCP integration, configure a backend proxy and set `VITE_MCP_PROXY_URL` in `.env` or `.env.local`.

A helper is available in `src/services/mcp.ts` to fetch MCP-derived context from your proxy.
