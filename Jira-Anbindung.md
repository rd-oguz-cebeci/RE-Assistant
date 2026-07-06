# Jira & Confluence Anbindung – Use Cases, How-To und Sinn dahinter

Der RE-Assistent integriert Atlassian Jira und Confluence entlang von drei klar abgegrenzten
Requirements-Engineering-Use-Cases. Jeder Use Case ist einer der vier IREB-Säulen zugeordnet
und hat einen fachlich begründeten Zweck – kein Feature ist hier nur „weil man Jira eben hat".

---

## Voraussetzungen

Bevor du einen der Use Cases nutzen kannst, muss Atlassian Cloud einmalig konfiguriert werden:

1. In der App oben auf das **Schlüssel-Symbol** klicken.
2. In der Auswahl **„Atlassian Cloud (Jira + Confluence)"** wählen.
3. Felder ausfüllen:
   - **Atlassian-Domain** (ohne `https://`), z. B. `meinefirma.atlassian.net`
   - **E-Mail** des Atlassian-Accounts
   - **API-Token** (erstellen unter: https://id.atlassian.com/manage-profile/security/api-tokens)
   - **Jira-Projektschlüssel**, z. B. `REQ`
   - **Confluence-Space-Key** (optional), z. B. `RE`
4. **„Verbindung testen"** ausführen – die Diagnose zeigt Auth, Projektsichtbarkeit und Board-Zugriff getrennt.
5. **„Speichern"**.

> **Lokal (npm run dev):** Zusätzlich `VITE_ATLASSIAN_DOMAIN=meinefirma.atlassian.net` in `.env.local` eintragen.
> Der lokale Vite-Dev-Proxy routet alle `/api/atlassian/*`-Anfragen darüber.
> Credentials werden lokal im Browser-`localStorage` gespeichert – kein Backend nötig.

---

## Use Case 1 – Jira-Übergabe (Management)

### Worum geht es?

Anforderungen, die im RE-Assistenten ermittelt, dokumentiert und validiert wurden,
werden als einzelner, abschließender Schritt nach Jira übergeben.
Jira ist dabei das **Zielsystem für die Umsetzungssteuerung**, nicht der Ort der Anforderungsermittlung.

### Warum nach IREB?

IREB trennt Anforderungsermittlung, -dokumentation und -management klar voneinander.
Erst wenn eine Anforderung formuliert, validiert und priorisiert ist, geht sie in die Umsetzungssteuerung.
Eine direkte Übergabe nach Jira aus dem Backlog stellt sicher, dass nur „reife" Anforderungen
im Entwicklungs-Ticket-System landen – nicht Rohnotizen oder ungeprüfte Entwürfe.
Die gespeicherte Verknüpfung (Jira-Key ↔ Requirement-ID) sichert die Pre-RS-Traceability.

### Workflow

```
Ermittlung → Dokumentation → Validierung → Backlog & Jira-Übergabe
```

1. Anforderungen im Assistenten erstellen, z. B. über **„Natürlichsprachlich"** in der Dokumentation.
2. Anforderungen validieren (Smells, DoR, BVA, Perspektiven).
3. In den Bereich **„Management"** wechseln.
4. Tool **„Backlog, Prio & Jira-Übergabe"** öffnen.
5. Optional: Anforderungen per KI schätzen lassen (Komplexität, MoSCoW).
6. Einzelne Anforderung: **„Nach Jira übergeben"** klicken.
   Oder alle noch nicht übergebenen: **„Jira-Übergabe"** klicken.

### Was passiert technisch?

- Jira-Issue wird als **Story** angelegt.
- Summary: `[REQ-003] Das System muss …` (ID + gekürzter Anforderungstext).
- Description: vollständiger Anforderungstext.
- Labels: `ireb-re-assistant`, optional Typ und Komplexität.
- Priorität: MoSCoW wird gemappt – Must → Highest, Should → High, Could → Medium, Won't → Low.
- Der zurückgelieferte **Jira-Key** wird am Requirement gespeichert.
- Bereits übergebene Anforderungen werden beim nächsten Batch-Lauf übersprungen.

### Ergebnis

Jedes übergebene Requirement zeigt in der Backlog-Ansicht einen direkten Link auf das Jira-Issue.
Das RE-Health-Dashboard (Use Case 3) kann danach die Traceability-Abdeckung messen.

---

## Use Case 2 – Jira-Ticket-Review (Validierung)

### Worum geht es?

Bestehende Jira-Tickets aus dem Projekt werden in den Assistenten geladen
und einzeln durch die KI auf IREB-Qualität geprüft.
Dieser Use Case ist besonders nützlich, wenn Tickets **nicht** aus dem RE-Assistenten stammen,
z. B. weil sie direkt in Jira angelegt wurden, von Entwicklern kamen oder aus einem Legacy-System migriert wurden.

### Warum nach IREB?

Jira-Tickets sind meistens keine sauberen IREB-Anforderungen. Sie enthalten häufig:
- Weichmacher und Universalquantoren („immer", „schnell", „benutzerfreundlich")
- fehlende Bedingungen, Akteure oder Prozessworte
- keine ableitbaren Abnahmekriterien
- unklare Formulierungen im Passiv

IREB fordert, dass Anforderungen eindeutig, vollständig, prüfbar, konsistent und notwendig sind.
Ein strukturierter Review bevor ein Ticket in den Sprint geht, ist ein methodisches Quality Gate.

### Workflow

```
Jira-Tickets laden → je Ticket: Qualität prüfen → Ticket in Jira manuell nachbessern
```

1. In den Bereich **„Validierung"** wechseln.
2. Tool **„Jira-Ticket-Review"** öffnen.
3. **„Jira-Tickets laden"** klicken (lädt bis zu 50 aktuelle Tickets aus dem konfigurierten Projekt).
4. Bei einem Ticket **„Qualität prüfen"** klicken.
5. Die KI zeigt:
   - Checkliste ✅/❌ für Klarheit, Vollständigkeit, Testbarkeit und IREB-Qualitätskriterien
   - konkrete Verbesserungsvorschläge je Punkt
6. Ticket in Jira manuell anpassen.

### Was passiert technisch?

- Der Assistent ruft `GET /rest/api/3/issue/{key}` ab, um Titel und Beschreibung zu laden.
- Die Beschreibung liegt im Atlassian Document Format (ADF) vor und wird in Klartext gewandelt.
- Falls die Beschreibung nicht geladen werden kann, wird nur der Ticket-Titel geprüft
  (ein Hinweis dazu erscheint im Ergebnis).
- Der KI-Prompt prüft: Smells & Weichmacher, Vollständigkeit (Akteur, Prozesswort, Objekt),
  Testbarkeit (ableitbare Abnahmekriterien), IREB-Qualitätskriterien (Adäquat, Notwendig, Eindeutig, Vollständig, Prüfbar).

### Ergebnis

Für jedes geprüfte Ticket erscheint das KI-Review inline unter dem Ticket-Titel.
Die Ergebnisse sind nicht persistent – sie dienen als Arbeitshilfe während des Review-Meetings
oder zur eigenen Vorbereitung. Korrekturen werden direkt in Jira vorgenommen.

---

## Use Case 3 – Jira RE-Health Dashboard (Management)

### Worum geht es?

Das Dashboard liest aktuelle Jira-Tickets ein und bewertet sie aus Requirements-Management-Sicht.
Es zeigt nicht nur Delivery-Status (Done/In Progress/To Do), sondern vor allem:
- Welche Jira-Tickets haben **keine nachvollziehbare RE-Herkunft** (keine Traceability)?
- Welche Tickets sehen nach **methodischer Nacharbeit** aus (schwache Titel)?
- Wie hoch ist die **Traceability-Abdeckung** gegenüber den im Assistenten gespeicherten Anforderungen?

### Warum nach IREB?

Requirements Management sichert Nachvollziehbarkeit (Traceability), Vollständigkeit und Änderbarkeit.
Ein Jira-Projekt mit vielen Tickets, die keiner dokumentierten Anforderung zugeordnet sind,
ist ein klares Traceability-Risiko: Woher kam dieses Feature? Warum ist es priorisiert?
Welche Anforderung deckt es ab? Das Dashboard macht diese Lücken sichtbar.

### Workflow

```
RE-Health aktualisieren → Traceability-Lücken analysieren → Review-Kandidaten prüfen
```

1. In den Bereich **„Management"** wechseln.
2. Tool **„Jira RE-Health Dashboard"** öffnen.
3. **„RE-Health aktualisieren"** klicken.
4. Das Dashboard zeigt:
   - **RE-Health Übersicht:** Gesamttickets, verknüpfte, Lücken, Review-Kandidaten, Done/In Progress/To Do
   - **Traceability-Lücken:** Tickets ohne Verknüpfung zu einer Anforderung im Assistenten
   - **Kandidaten für IREB-Review:** Tickets mit kurzen, unklaren oder generischen Titeln
   - **Status-Verteilung** und **Prioritäten-Verteilung**
   - **Zuletzt aktualisierte Tickets**
   - **Potenzielle Blocker** (heuristische Erkennung über Stichwörter im Titel)

### Was passiert technisch?

- Der Assistent lädt bis zu 120 Jira-Issues über JQL (`project = KEY ORDER BY updated DESC`).
- Er vergleicht die Jira-Keys mit den gespeicherten `jiraKey`-Feldern der Anforderungen im Assistenten.
- Traceability-Lücken = Jira-Tickets ohne passenden `jiraKey` im lokalen Backlog.
- Review-Kandidaten werden heuristisch erkannt: Titel kürzer als 25 Zeichen, generische Begriffe
  (Todo, TBD, Fix, Optimieren, …) oder fehlende RE-Signalworte (muss, soll, als, damit, …).
- Das Ergebnis wird als Markdown-Dashboard im Ergebnis-Bereich angezeigt.

### Ergebnis

Der RE sieht auf einen Blick, wie gut der aktuelle Jira-Stand mit dem erarbeiteten RE-Kontext verknüpft ist.
Das Dashboard ist kein Delivery-Statusbericht für die Projektleitung, sondern ein methodisches
Controlling-Instrument für den Requirements Engineer.

---

## Confluence – Projektdokumentation als Baseline

### Worum geht es?

Confluence dient als externes Dokumentationsziel für den gesamten IREB-Projektkontext.
Der Assistent kann Vision, Systemkontext, Stakeholder, Personas, Anforderungen und Glossar
als eine strukturierte Confluence-Seite veröffentlichen.

### Warum nach IREB?

IREB fordert, dass Anforderungsdokumentationen dauerhaft, verständlich und für alle
Beteiligten zugänglich sind. Confluence ist in vielen Unternehmen das gemeinsame Wissenssystem.
Der Sync erzeugt aus dem interaktiv erarbeiteten RE-Kontext eine lesbare, verlinkbare Baseline –
kein manuelles Kopieren, kein Medienbruch.

### Workflow

1. In den Bereich **„Management"** wechseln.
2. Tool **„Export für Claude Code"** öffnen.
3. **„Nach Confluence"** klicken.
4. Beim ersten Aufruf wird eine neue Seite im konfigurierten Space angelegt.
5. Bei Folgeaufrufen wird die bestehende Seite aktualisiert (Upsert mit Versionsinkrement).

### Was passiert technisch?

- Die Seite enthält: Projektvision, Stakeholder, Personas, Anforderungstabelle (mit Jira-Links) und Glossar.
- Der Assistent speichert die zurückgelieferte **Page-ID** im Projektstate, um Folge-Updates zu ermöglichen.
- Der Confluence-Sync läuft über `POST /wiki/rest/api/content` bzw. `PUT /wiki/rest/api/content/{id}`.

### Ergebnis

Die Confluence-Seite ist die lebende Projektdokumentation. Sie wird immer dann aktualisiert,
wenn neue Anforderungen dazukommen, das Glossar wächst oder der Kontext sich ändert.
Sie ist die Baseline, auf die sich alle Projektbeteiligten beziehen können.

---

## Zusammenfassung: IREB-Flow mit Atlassian-Anbindung

```
① Ermittlung          → Ziele, Stakeholder, Personas, Interviews, Rohtext
② Dokumentation       → Anforderungen formulieren, Glossar, UML-Modelle
                         → Confluence als Baseline veröffentlichen
③ Validierung         → Smells, Tests, DoR, BVA
                         → Jira-Ticket-Review für fremde Tickets
④ Management          → Backlog, Priorisierung, Jira-Übergabe
                         → RE-Health Dashboard für Traceability-Controlling
```

Jira ist in diesem Modell kein Ersatz für das RE – es ist das Übergabe- und Steuerungssystem,
das erst dann benutzt wird, wenn Anforderungen methodisch reif sind.
