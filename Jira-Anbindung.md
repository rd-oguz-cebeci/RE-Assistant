# Jira und Confluence Anbindung - Umgesetzte Features

Dieses Dokument beschreibt alle Erweiterungen, die für die Atlassian-Anbindung im RE-Assistant umgesetzt wurden.

## 1. Atlassian Konfiguration in der App

Kurzbeschreibung:
Nutzer koennen Jira und Confluence direkt in der App konfigurieren.

Umgesetzt:
- Neue Konfigurationsoption Atlassian Cloud (Jira + Confluence) im KI-Anbindungs-Modal
- Felder fuer Domain, E-Mail, API-Token, Jira-Projektschluessel und Confluence-Space
- Verbindungstest direkt im Modal
- Speicherung der Konfiguration im lokalen Browser (localStorage)

Nutzen:
Keine manuelle Code-Anpassung mehr noetig, Konfiguration ist fuer Pilotnutzer einfach bedienbar.

## 2. Persistente Atlassian Settings

Kurzbeschreibung:
Alle Atlassian-Zugangsdaten und Zielparameter werden dauerhaft im Settings-Store gehalten.

Umgesetzt:
- Erweiterung des Settings-Store um Atlassian-Domain, E-Mail, Token, Jira-Projekt, Confluence-Space
- Getter fuer Konfigurationsvollstaendigkeit
- Setter zum Speichern und Normalisieren (z. B. Uppercase fuer Keys)

Nutzen:
Konfiguration bleibt ueber Reloads erhalten und steht allen Jira/Confluence-Funktionen zentral zur Verfuegung.

## 3. Lokaler Atlassian Proxy ueber Vite

Kurzbeschreibung:
REST-Aufrufe an Atlassian laufen ueber lokale Proxy-Routen.

Umgesetzt:
- Proxy-Route fuer Jira REST v3
- Proxy-Route fuer Jira Agile REST v1.0
- Proxy-Route fuer Confluence REST
- Nutzung der Umgebungsvariable VITE_ATLASSIAN_DOMAIN
- Korrektur der Proxy-Reihenfolge, damit jira-agile nicht von jira ueberschrieben wird

Nutzen:
Browserseitige Integration ist in der lokalen Entwicklungsumgebung moeglich.

## 4. Jira Issue Erstellung aus dem Backlog

Kurzbeschreibung:
Anforderungen aus dem Backlog koennen als Jira-Issues angelegt werden.

Umgesetzt:
- Einzel-Export einer Anforderung nach Jira
- Batch-Export aller noch nicht synchronisierten Anforderungen
- Mapping von Requirement-Feldern auf Jira-Issue-Felder
- Speicherung des erzeugten Jira-Keys je Requirement
- Direkter Link auf das Jira-Issue in der Backlog-Ansicht

Nutzen:
RE-Ergebnisse lassen sich ohne Medienbruch in Jira ueberfuehren.

## 5. Confluence Sync als Projektdokumentation

Kurzbeschreibung:
Der aktuelle Projektstand kann als Confluence-Seite erstellt und aktualisiert werden.

Umgesetzt:
- Erstellung einer Confluence-Seite beim ersten Sync
- Upsert-Logik fuer Folgeaufrufe (Update mit Versionsinkrement)
- Speicherung der Confluence-Page-ID im Projektstore
- Sync aus Export-Kontext mit Vision, Stakeholdern, Personas, Anforderungen und Glossar

Nutzen:
Ein lebendes Projektdokument entsteht automatisch und bleibt aktuell.

## 6. Jira Projekt-Dashboard als neues Management-Tool

Kurzbeschreibung:
Neues Tool in der Management-Saeule, das Jira-Tickets einliest und Kennzahlen erzeugt.

Umgesetzt:
- Neues Tool Jira Projekt-Dashboard in der Menuestruktur
- Einlesen aktueller Tickets des Jira-Projekts
- KPI-Berechnung: Gesamt, Done, In Progress, To Do, Unklassifiziert
- Verteilungen nach Status und Prioritaet
- Liste zuletzt aktualisierter Tickets
- Heuristische Blocker-Erkennung

Nutzen:
Projektleitung bekommt direkt in der App ein Management-Bild zum aktuellen Umsetzungsstand.

## 7. Jira API Migration und Stabilisierung

Kurzbeschreibung:
Anpassungen fuer Atlassian API-Aenderungen und robuste Datenermittlung.

Umgesetzt:
- Migration von Search-Endpunkt auf /rest/api/3/search/jql
- Direkter Projektcheck ueber /project/{key}
- Fallback auf Board-Issues ueber Jira Agile API, wenn JQL 0 Ergebnisse liefert

Nutzen:
Hoehere Zuverlaessigkeit trotz Jira-API-Umstellungen und unterschiedlicher Projekt-/Board-Setups.

## 8. Verbesserte Verbindungsdiagnose

Kurzbeschreibung:
Der Verbindungstest liefert jetzt konkrete Ursachen statt generischer Fehler.

Umgesetzt:
- Getrennte Diagnose fuer Authentifizierung, Projektsichtbarkeit und Boardzugriff
- Praezise Rueckmeldung im Modal (z. B. Auth ok, aber Projekt nicht sichtbar)

Nutzen:
Schnellere Fehleranalyse bei 401, 403, 404 und Rollen-/Berechtigungsproblemen.

## 9. Erweiterungen im Projektmodell

Kurzbeschreibung:
Das interne Datenmodell wurde fuer Jira/Confluence-Verknuepfung erweitert.

Umgesetzt:
- Requirement um jiraKey erweitert
- Projektstate um confluencePageId erweitert
- Neue Store-Aktionen zum Setzen von jiraKey und confluencePageId

Nutzen:
Nachvollziehbare Verknuepfung zwischen RE-Artefakten und externen Atlassian-Objekten.

## 10. Export-Erweiterung

Kurzbeschreibung:
Der Markdown-Export enthaelt nun Jira-Bezug.

Umgesetzt:
- Jira-Spalte im Anforderungstableau des Exports

Nutzen:
Traceability bleibt auch im exportierten Kontext erhalten.

## 11. Dokumentation und Betriebsfaehigkeit

Kurzbeschreibung:
Dokumentation fuer Setup, Test und Troubleshooting wurde erweitert.

Umgesetzt:
- README mit kompletter Anleitung fuer Jira/Confluence-Setup
- Smoke-Test Ablauf
- Troubleshooting fuer Node, Proxy und Atlassian-Auth

Nutzen:
Pilot-Teams koennen die Integration strukturiert einrichten und testen.
