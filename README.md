# RE-Assistant

IREB-orientierter Requirements-Engineering-Assistent mit KI-Unterstützung.

Die Anwendung unterstützt jetzt neben AI-Prompts auch eine direkte Jira-/Confluence-Anbindung (Atlassian Cloud). Jira wird entlang von drei klaren RE-Use-Cases genutzt: Übergabe dokumentierter Anforderungen, Review importierter Tickets und RE-Health/Traceability im Management.

## Features (Kurzüberblick)

- IREB-Berater-Flow für Ermittlung, Dokumentation, Validierung und Management
- Tool-Ansichten für Anforderungen, Glossar, Modellierung, Validierung usw.
- Jira-Übergabe einzelner oder aller Anforderungen aus dem Backlog
- Jira-Ticket-Review gegen IREB-Qualitätskriterien
- Jira RE-Health Dashboard für Traceability-Lücken und Review-Kandidaten
- Confluence-Sync als Projektseite (inkl. Anforderungen, Glossar, Kontext)
- Optionale MCP-Kontextanreicherung für AI-Prompts

## Voraussetzungen

1. Node.js
- Empfohlen: `22.12+` (oder `20.19+`)
- Hinweis: mit `22.11.0` kann `vite` zwar starten, `build` und `test` sind oft instabil.

2. Atlassian Cloud Zugriff
- Ein API-Token mit Lese-/Schreibrechten für Jira Cloud und Confluence Cloud
- Deine Atlassian-Domain, z. B. `firma.atlassian.net`
- Jira-Projektschlüssel, z. B. `REQ`
- Optional: Confluence-Space-Key, z. B. `RE`

## Installation

```bash
npm install
```

Bei Windows/Node-Kombinationen mit optional-dependency-Problemen kann dieses zusätzliche Paket helfen:

```bash
npm install -D @rolldown/binding-win32-x64-msvc@1.0.3
```

## Lokale Konfiguration

1. `.env.local` anlegen (oder aus `.env.example` ableiten).

2. Atlassian-Domain setzen (wichtig für den lokalen Vite-Proxy):

```env
VITE_ATLASSIAN_DOMAIN=your-company.atlassian.net
```

3. Optional MCP konfigurieren:

```env
VITE_MCP_PROXY_URL=http://localhost:4000/api/mcp
# oder
# VITE_MCP_URL=https://mcp.atlassian.com/v1/mcp
```

## App starten

```bash
npm run dev
```

Standardmäßig läuft die App dann auf `http://localhost:5173/`.

## Jira-/Confluence-Anbindung einrichten

In der laufenden App:

1. Oben auf das Schlüssel-Symbol klicken
2. In der Auswahl `Atlassian Cloud (Jira + Confluence)` wählen
3. Felder ausfüllen:
- Atlassian-Domain (ohne `https://`)
- E-Mail (Atlassian-Account)
- API-Token
- Jira-Projektschlüssel
- Optional Confluence-Space-Key
4. `Verbindung testen` ausführen
5. `Speichern`

Hinweis: Die Zugangsdaten werden lokal im Browser (`localStorage`) gespeichert.

## Nutzung: Jira

Die Jira-Anbindung folgt drei Use Cases:

1. **Jira-Übergabe:** Dokumentierte Anforderungen aus dem Backlog als Jira-Issues erstellen.
2. **Jira-Review:** Bestehende Jira-Tickets in der Validierung auf IREB-Qualität prüfen.
3. **RE-Health:** Jira im Management auf Traceability-Lücken, Review-Kandidaten und Status prüfen.

### Einzelne Anforderung nach Jira

1. In den Bereich `Management` wechseln
2. Tool `Backlog, Prio & Jira-Übergabe` öffnen
3. Bei einer Anforderung auf `Nach Jira übergeben` klicken

Ergebnis:
- Es wird ein Jira-Issue erzeugt (Issue Type: Story)
- Der Jira-Key wird am Requirement gespeichert und als Link angezeigt

### Alle Anforderungen nach Jira

1. Gleicher Bereich (`Backlog, Prio & Jira-Übergabe`)
2. Auf `Jira-Übergabe` klicken

Ergebnis:
- Alle noch nicht synchronisierten Anforderungen werden erstellt
- Bereits verknüpfte Anforderungen werden übersprungen

### Jira-Tickets prüfen

1. In den Bereich `Validierung` wechseln
2. Tool `Jira-Ticket-Review` öffnen
3. `Jira-Tickets laden` ausführen
4. Bei relevanten Tickets `Qualität prüfen` klicken

Ergebnis:
- Die KI prüft Ticket-Titel und Beschreibung gegen IREB-Kriterien
- Das Ergebnis zeigt Smells, fehlende Informationen, Testbarkeit und Verbesserungsvorschläge

### RE-Health Dashboard

1. In den Bereich `Management` wechseln
2. Tool `Jira RE-Health Dashboard` öffnen
3. `RE-Health aktualisieren` ausführen

Ergebnis:
- Übersicht zu Traceability, Review-Kandidaten, Status, Prioritäten und potenziellen Blockern

## Nutzung: Confluence

1. In `Management` das Tool `Export für KI` öffnen
2. Auf `Nach Confluence` klicken

Ergebnis:
- Es wird eine Confluence-Seite erstellt oder aktualisiert (Upsert)
- Enthalten sind u. a. Vision, Stakeholder, Personas, Anforderungen und Glossar

## Smoke-Test Checkliste

### 1) Technischer Smoke-Test

```bash
npm run lint
npm run dev
```

Optional (mit kompatibler Node-Version):

```bash
npm run test
npm run build
```

### 2) Funktionaler Smoke-Test (Atlassian)

1. Atlassian-Konfiguration in der App speichern
2. `Verbindung testen` muss erfolgreich sein
3. Eine Beispielanforderung nach Jira pushen
4. Prüfen, ob Jira-Key in der Backlog-Liste erscheint
5. Nach Confluence synchronisieren
6. Prüfen, ob Seite im gewünschten Space erstellt/aktualisiert wurde

## Troubleshooting

### Node-Version zu alt

Symptom:
- `Vite requires Node.js version 20.19+ or 22.12+`

Lösung:
- Node auf mindestens `22.12` (besser `22.13+`) aktualisieren

### Fehlendes Rolldown Native Binding

Symptom:
- `Cannot find native binding`
- `Cannot find module @rolldown/binding-win32-x64-msvc`

Lösung:

```bash
npm install -D @rolldown/binding-win32-x64-msvc@1.0.3
```

Falls weiterhin Probleme bestehen:

```bash
rm -r node_modules package-lock.json
npm install
```

Unter Windows stattdessen in PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### 401/403 bei Jira oder Confluence

- Domain, E-Mail und API-Token prüfen
- Rechte des Tokens im Zielprojekt/Space prüfen
- Jira-Projektschlüssel und Confluence-Space-Key prüfen

## Sicherheitshinweis

- API-Keys und Atlassian-Credentials werden lokal im Browser gespeichert
- Für Produktion wird ein eigener Backend-/Proxy-Ansatz empfohlen
- Keine hochprivilegierten Tokens auf nicht vertrauenswürdigen Geräten verwenden
