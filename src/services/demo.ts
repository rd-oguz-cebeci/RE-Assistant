const MODELING_DEMOS: Record<string, string> = {
    usecase: `flowchart LR
    Mitarbeiter((Marktmitarbeiter)) --> UC1([MHD pruefen])
    Mitarbeiter --> UC2([Out-of-Stock melden])
    Leitung((Abteilungsleitung)) --> UC3([Kritische Artikel uebersicht sehen])
    Lager((Lagerpersonal)) --> UC4([OoS-Meldung empfangen])
    WWS((Warenwirtschaftssystem)) --> UC1
    WWS --> UC2`,
    activity: `graph TD;
    A[Mitarbeiter scannt Artikel-Barcode] --> B{WLAN verfuegbar?};
    B -- Ja --> C[WWS-API abfragen: Artikel + MHD];
    B -- Nein --> D[Lokalen Cache abfragen];
    C --> E{Artikel gefunden?};
    D --> E;
    E -- Nein --> F[Fehler: Artikel unbekannt];
    E -- Ja --> G{MHD <= 3 Tage?};
    G -- Nein --> H[Anzeige: OK];
    G -- Ja --> I{MHD <= 1 Tag?};
    I -- Nein --> J[Anzeige: Reduktion -30%];
    I -- Ja --> K[Anzeige: Sofort aus Regal nehmen];`,
    class: `classDiagram
    class Artikel {
      +ean: string
      +name: string
      +mhd: date
      +preis: number
    }
    class ScanVorgang {
      +zeitpunkt: datetime
      +offline: boolean
    }
    class OoSMeldung {
      +regalId: string
      +status: string
    }
    class Warenwirtschaftssystem {
      +holeArtikeldaten()
      +sendeOoSMeldung()
    }
    ScanVorgang --> Artikel
    OoSMeldung --> Artikel
    OoSMeldung --> Warenwirtschaftssystem`,
    state: `stateDiagram-v2
    [*] --> Bereit
    Bereit --> Scannt : Barcode gescannt
    Scannt --> OnlinePruefung : WLAN verfuegbar
    Scannt --> OfflinePruefung : kein WLAN
    OnlinePruefung --> ArtikelGefunden
    OfflinePruefung --> ArtikelGefunden
    OnlinePruefung --> Fehler : Artikel unbekannt
    OfflinePruefung --> Fehler : nicht im Cache
    ArtikelGefunden --> Kritisch : MHD <= 3 Tage
    ArtikelGefunden --> Unkritisch : MHD > 3 Tage
    Kritisch --> AktionEmpfohlen
    Unkritisch --> Bereit
    AktionEmpfohlen --> Bereit
    Fehler --> Bereit`,
    sequence: `sequenceDiagram
    participant M as Mitarbeiter
    participant A as Scanner-App
    participant C as Lokaler Cache
    participant W as WWS
    M->>A: Barcode scannen
    A->>W: Artikeldaten anfragen
    alt WLAN verfuegbar
      W-->>A: MHD + Preis + Regel
    else Kein WLAN
      A->>C: Cache lesen
      C-->>A: Zuletzt synchronisierte Artikeldaten
    end
    A-->>M: Anzeige MHD, Rabatt, Aktion
    M->>A: OoS bestaetigen
    A->>W: OoS-Meldung senden`
}

const DEMO_RESPONSES: Record<string, string> = {
    goals: `**UND/ODER-Zielbaum: Scanner-App fuer MHD & Out-of-Stock**

**Stakeholder-Ziele:**
- (Filialleitung) Warenabschriften durch abgelaufene Ware senken UND Out-of-Stock-Situationen reduzieren
- (Marktmitarbeiter Klaus) Taegliche MHD-Runde schneller und fehlerfreier erledigen
- (Lager) Out-of-Stock-Meldungen strukturiert empfangen ODER priorisiert bearbeiten

**Systemziele / Hard Goals (messbar):**
- Das System MUSS die taegliche MHD-Pruefzeit pro Mitarbeiter um >= 50% reduzieren (von 60 Min auf < 30 Min)
- Das System MUSS MHD-kritische Artikel automatisch kennzeichnen, wenn <= 3 Tage bis zum Ablauf verbleiben
- Das System MUSS Out-of-Stock-Meldungen innerhalb von 5 Minuten an das Lagersystem uebermitteln
- Das System MUSS eine Verfuegbarkeit von >= 99% waehrend Oeffnungszeiten (06:00-22:00 Uhr) gewaehrleisten

**Soft Goals / Qualitaetsziele:**
- Das System SOLL sich fuer Mitarbeiter ohne IT-Vorkenntnisse intuitiv bedienen lassen (max. 30 Min Einarbeitung)
- Das System SOLL auch bei schlechtem WLAN reaktionsschnell bleiben (Offline-Faehigkeit)

**Zielkonflikte (UND-Relation):**
- Echtzeit-Synchronisation mit WWS UND Offline-Faehigkeit bei WLAN-Ausfall -> erfordert lokalen Cache auf dem MDE-Geraet`,
    matrix: `**Methoden-Matrix fuer die Supermarkt-Demo**

| Kontextfaktor | Bewertung | Geeignete Methode |
|---|---|---|
| Hoher Zeitdruck im Markt | Hoch | Interviews + Apprenticing |
| Mehrere Stakeholder-Gruppen | Hoch | Stakeholder-Radar + Workshop |
| Bestehendes Legacy-/WWS-Umfeld | Hoch | Systemarchaeologie |
| Innovationspotenzial fuer neue Features | Mittel | SCAMPER + Kano |

**Empfohlene Reihenfolge:**
1. Zieldefinition
2. Systemkontext
3. Stakeholder-Radar
4. Personas
5. Interviews / Rohtext-Extraktion`,
    context: `**1. Geplantes System (Scope):**
- Scanner-App auf mobilen MDE-Handscannern (Android-basiert, Zebra TC57)
- Modul A: MHD-Ueberwachung
- Modul B: Out-of-Stock-Meldung

**2. Systemgrenze (Schnittstellen):**
- REST-API-Schnittstelle zum Warenwirtschaftssystem (WWS)
- Integrierter Hardware-Barcode-Scanner des MDE-Geraets
- WLAN-Infrastruktur der Filiale

**3. Systemkontext (relevante Umgebung):**
- Warenwirtschaftssystem (WWS): Liefert Artikeldaten & MHD, empfaengt OoS-Meldungen
- Filialleitung: Definiert Reduktionsrichtlinien
- Lagerpersonal: Empfaengt Out-of-Stock-Benachrichtigungen zur Nachfuellung
- Kassiersystem: Setzt Preisreduktionen technisch um

**4. Kontextgrenze (ausserhalb Scope):**
- Personalplanung & Schichtkalender
- Buchhaltungssystem
- Kassiersystem (empfaengt Daten, ist aber nicht Teil des Systems)`,
    stakeholder: `**1. Direkte Systemnutzer (Kern):**
- *Marktmitarbeiter (z.B. Klaus, Frische-Abteilung):* Fuehrt taeglich MHD-Runden durch. Hoher Zeitdruck, wenig IT-Affinitaet. Einfluss: Hoch.
- *Abteilungsleitung (z.B. Sandra, Molkerei):* Steuert Reduktions-Aktionen und traegt Verantwortung fuer Warenabschriften. Einfluss: Hoch.

**2. Sponsoren/Management:**
- *Filialleitung:* Will Warenabschriften senken. Einfluss: Sehr hoch.
- *Zentrale IT & Einkauf:* Entscheidet ueber WWS-Schnittstellen und Investitionsbudget. Einfluss: Sehr hoch.

**3. IT & Wartung:**
- *WWS-Dienstleister:* Ist Schnittstellen-Gatekeeper. Einfluss: Mittel.
- *Filial-IT:* Verwaltet MDE-Geraete, WLAN und MDM-System. Einfluss: Mittel.

**4. Externe Stakeholder:**
- *Lagerpersonal:* Empfaengt OoS-Meldungen und reagiert auf Nachfuell-Auftraege. Einfluss: Mittel.
- *Lebensmittelkontrolle:* Prueft korrekte MHD-Handhabung. Regulatorischer Einfluss.`,
    persona: `**Persona 1: Klaus, Marktmitarbeiter Frische (48 Jahre)**
**Motto:** "Ich will meinen Job erledigen, ohne IT-Probleme."
**Ziele:** MHD-Runde schnell abschliessen, um Zeit fuer Regaleinraeumen zu haben.
**Schmerzpunkte:** Tippt taeglich rund 1 Stunde abgelaufene Artikel in Excel. Der Handscanner ist langsam. Fuehlt sich von komplizierten Apps gebremst.
**Beduerfnisse:** Eine App, die sofort startet, mit einem Scan alle Infos zeigt und keine langen Einarbeitungszeiten erfordert.

---
**Persona 2: Sandra, Abteilungsleiterin Molkerei (34 Jahre)**
**Motto:** "Ich brauche eine klare Uebersicht, bevor der Tag anfaengt."
**Ziele:** Warenabschriften minimieren. Out-of-Stock-Meldungen sollen das Lager vor 10 Uhr erreichen.
**Schmerzpunkte:** OoS-Meldungen kommen oft zu spaet. Reduktions-Aktionen muessen manuell ins Kassiersystem eingetippt werden.
**Beduerfnisse:** Tages-Uebersicht kritischer Artikel, automatische Eskalation bei MHD-Verstoessen.`,
    prep: `**Interview-Leitfaden fuer Klaus (Marktmitarbeiter Frische):**

1. Wie laeuft Ihre taegliche MHD-Pruefrunde heute genau ab - Schritt fuer Schritt?
2. Was sind die groessten Zeitfresser bei der aktuellen Vorgehensweise?
3. Wann und wie erfahren Sie heute, dass ein Artikel im Regal fehlt (Out-of-Stock)?
4. Was waere fuer Sie das ideale Werkzeug, um diese Aufgabe schneller und sicherer zu erledigen?`,
    'prep-sim': `**Simuliertes Interview mit Klaus (Marktmitarbeiter Frische):**

**RE:** Wie laeuft Ihre MHD-Runde heute ab?
**Klaus:** "Ich geh mit meinem Zettel durch die Kuehlregale, schaue bei jedem Artikel auf das Datum und notier mir alles mit Stift. Danach tippe ich das in den PC - das dauert ewig."

**RE:** Was sind die groessten Zeitfresser?
**Klaus:** "Das Abtippen. Und manchmal weiss ich nicht, was die genaue Reduktionsregel ist - 20% oder 30%? Ich ruf dann Sandra an. Das kostet uns beide Zeit."

**RE:** Wann erfahren Sie von Out-of-Stock?
**Klaus:** "Wenn das Regal leer ist und der Kunde mich anspricht. Dann ruf ich ins Lager. Manchmal weiss die dort auch nicht Bescheid."

**RE:** Was waere Ihr ideales Werkzeug?
**Klaus:** "Einfach scannen, und der Handscanner sagt mir sofort: Artikel X laeuft in 2 Tagen ab, reduziere auf 50 Cent. Kein Zettel, kein Abtippen."`,
    questionnaire: `**Mitarbeiter-Fragebogen: Scanner-App (anonym, ca. 5 Minuten)**

**Teil A: Ihre Arbeitssituation**
1. In welcher Abteilung arbeiten Sie? (Frische / Molkerei / Obst & Gemuese / Tiefkuehl / Sonstiges)
2. Wie viele Stunden pro Woche verbringen Sie mit MHD-Pruefungen? (< 1h / 1-3h / 3-5h / > 5h)

**Teil B: Schmerzpunkte**
3. Was nervt Sie bei der aktuellen MHD-Pruefung am meisten?
   a) Manuelles Notieren auf Papier
   b) Abtippen ins System danach
   c) Unklare Reduktionsregeln
   d) Schlechte Lesbarkeit von MHD-Aufdrucken

**Teil C: Bewertung (Likert-Skala 1-5)**
4. Wie hilfreich waere eine App, die direkt nach dem Scan die Reduktionsregel anzeigt?
5. Wie wichtig ist es Ihnen, auch ohne WLAN arbeiten zu koennen?
6. Wie komfortabel fuehlen Sie sich mit der Nutzung einer App auf dem Handscanner?`,
    apprenticing: `**Apprenticing-Erkenntnisse: Beobachtung mit Klaus (MHD-Runde, 08:00-09:30 Uhr)**

**1. Versteckte Geschaeftsregeln:**
- Eigenmarken erhalten 3 Tage vor MHD-Ablauf 30% Rabatt, Markenartikel nur 20%.
- Bei Milchprodukten findet die MHD-Runde zweimal taeglich statt (08:00 und 14:00 Uhr).
- Artikel mit MHD = heute werden sofort aus dem Regal genommen, nicht reduziert.

**2. Workarounds & Schmerzpunkte:**
- Klaus fuehrt eine private Excel-Tabelle auf seinem Firmenhandy, weil das offizielle System zu langsam ist.
- Out-of-Stock-Meldungen werden per WhatsApp an die Lager-Gruppe geschickt.
- Wenn der Handscanner haengt, werden Artikel mit Kugelschreiber auf der Verpackung markiert.

**3. Unausgesprochene Annahmen:**
- Das Team geht davon aus, dass das WWS immer aktuelle MHD-Daten hat. Tut es nicht - der Lieferantenimport laeuft nur 1x taeglich um 06:00 Uhr.`,
    archaeology: `**Fachliche Geschaeftsregeln aus dem WWS-Legacy-System:**

1. **MHD-Warnschwelle:** Artikel gelten als kritisch, wenn MHD - heute <= 3 Tage.
2. **Reduktionsstaffelung:** Eigenmarken <= 3 Tage: 30% Rabatt | Markenartikel <= 3 Tage: 20% | Alle Artikel <= 1 Tag: 50%.
3. **Warenfluss-Batch:** Bestandsabgleich zwischen Lager und Regal findet nur einmal taeglich statt (Batch-Job um 06:00 Uhr).
4. **Geraete-Bindung:** MDE-Geraete sind ueber ihre Seriennummer einem Mitarbeiter und einer Abteilung fest zugeordnet.`,
    scamper: `**SCAMPER fuer die Scanner-App (MHD & Out-of-Stock):**

- **Substitute:** Papier und Excel durch automatische Scan-Erkennung ersetzen.
- **Combine:** MHD-Runde und OoS-Meldung in einem Scan-Workflow kombinieren.
- **Adapt:** Pick-by-Light-Prinzip aus der Logistik adaptieren: gruene, gelbe und rote Zustandsanzeigen.
- **Modify:** Gamification einbauen - Mitarbeiter sehen, wie viele Artikel sie heute gerettet haben.
- **Put to another use:** Gesammelte MHD-Daten fuer Bestellprognosen nutzen.`,
    kano: `**Kano-Klassifikation fuer 3 Features der Scanner-App:**

**Feature 1: Automatische Anzeige kritischer MHD-Artikel**
- Funktionale Frage: Wie wuerden Sie sich fuehlen, wenn die App beim Start automatisch alle Artikel zeigt, die heute oder in 2 Tagen ablaufen?
- Dysfunktionale Frage: Wie wuerden Sie sich fuehlen, wenn Sie jeden Artikel manuell scannen muessen, um das MHD zu pruefen?
- **Einordnung: Leistungsmerkmal**

**Feature 2: Offline-Modus**
- Funktionale Frage: Wie wuerden Sie sich fuehlen, wenn die App auch im WLAN-toten Kuehlregal-Bereich funktioniert?
- **Einordnung: Basismerkmal**

**Feature 3: Foto-Upload bei OoS-Meldung**
- Funktionale Frage: Wie wuerden Sie sich fuehlen, wenn Sie ein Foto des leeren Regals direkt ans Lager senden koennen?
- **Einordnung: Begeisterungsmerkmal**`,
    workshop: `**Workshop-Agenda: Scanner-App fuer MHD & OoS (2,5 Stunden)**

**1. Kick-off & Problemraum (15 Min)**
Vorstellung der Ausgangssituation und aktueller Warenabschriften.

**2. Empathy Mapping (45 Min)**
Gruppenarbeit mit Persona-Postern Klaus und Sandra.

**3. Wie-koennte-man-Fragen (20 Min)**
Jeder schreibt 3 HMW-Fragen auf Post-Its.

**4. Loesungs-Brainwriting (30 Min)**
Stilles Erarbeiten und Weitergeben von Ideen.

**5. Dot-Voting & Priorisierung (15 Min)**
Top-5 Ideen werden im naechsten Sprint als User Stories ausgearbeitet.

*Materialien: Persona-Poster, Abschriften-Statistik, Post-Its, Dot-Sticker*`,
    extract_req: `**Klassifikation der ermittelten Rohnotizen:**

**Funktionale Anforderungen (FA):**
- FA-01: Das System MUSS nach dem Scan eines Artikels dessen MHD anzeigen und mit dem Tagesdatum vergleichen.
- FA-02: Das System MUSS bei Artikeln mit MHD <= 3 Tagen automatisch die gueltige Reduktionsregel anzeigen.
- FA-03: Das System MUSS es dem Mitarbeiter ermoeglichen, einen Artikel per Scan als Out-of-Stock zu markieren und die Meldung ans WWS zu senden.
- FA-04: Das System MUSS eine tagesaktuelle Prioritaetsliste aller kritischen MHD-Artikel pro Abteilung anzeigen.

**Qualitaetsanforderungen / NFRs:**
- NFR-01 (Performance): Scan bis Anzeige MUSS in < 1,5 Sekunden erfolgen.
- NFR-02 (Usability): Ungeschulter Mitarbeiter MUSS nach max. 30 Min Einweisung selbstaendig arbeiten koennen.
- NFR-03 (Zuverlaessigkeit): App MUSS bei WLAN-Ausfall im Offline-Modus funktionieren und Meldungen puffern.

**Randbedingungen (Constraints):**
- RB-01: App MUSS auf vorhandenen MDE-Geraeten (Zebra TC57, Android 11) lauffaehig sein.
- RB-02: Datenaustausch MUSS ueber die bestehende WWS-REST-API erfolgen. Direkter DB-Zugriff ist untersagt.`,
    formulate: `**User Story 1: MHD-Scan mit sofortiger Aktion**
*Als Marktmitarbeiter moechte ich nach dem Scannen eines Artikels sofort sehen, ob und wie stark ich ihn reduzieren muss, damit ich keine Zeit mit dem Nachschlagen von Regeln verbringe.*
**Akzeptanzkriterien (Given-When-Then):**
- GIVEN ich scanne Artikel "Bio-Joghurt 500g" AND das MHD liegt 2 Tage in der Zukunft
  WHEN der Scan abgeschlossen ist
  THEN zeigt die App: MHD-kritisch | Regel: -30% | Neuer Preis: 0,91 EUR

---

**User Story 2: Out-of-Stock melden**
*Als Marktmitarbeiter moechte ich ein leeres Regal per Scan direkt ans Lager melden, damit die Nachlieferung ohne Telefonat angestossen wird.*
**Akzeptanzkriterien:**
- GIVEN ich stehe vor einem leeren Regalfach und scanne die Regaletikette
  WHEN ich "Leer melden" in der App bestaetige
  THEN wird eine OoS-Meldung mit Regal-ID, Artikel-EAN und Zeitstempel ans WWS gesendet
  AND ich erhalte die Bestaetigung: "Meldung erfolgreich - Lager informiert"`,
    nfr: `**3 kritische NFRs (abgeleitet aus FA-01, FA-03):**

**1. Performance-Effizienz:**
Das System MUSS nach dem Hardware-Scan eines Barcodes die zugehoerigen MHD-Daten in unter **1,5 Sekunden** auf dem Bildschirm des MDE-Geraets anzeigen.

**2. Zuverlaessigkeit:**
Das System MUSS bei unterbrochenem WLAN alle OoS-Meldungen lokal puffern und bei Wiederherstellung der Verbindung **automatisch und verlustfrei** ans WWS senden.

**3. Bedienbarkeit:**
Ein neuer Mitarbeiter ohne Vorkenntnisse MUSS nach einer **einmaligen Einweisung von max. 30 Minuten** selbstaendig eine vollstaendige MHD-Runde durchfuehren koennen.`,
    glossary_extract: `| Begriff | Definition |
|---|---|
| **MHD** | Mindesthaltbarkeitsdatum. Das Datum, bis zu dem ein Lebensmittel bei richtiger Lagerung seine Eigenschaften behaelt. |
| **MDE-Geraet** | Mobiles Datenerfassungsgeraet. Handscanner mit integriertem Barcode-Lesegeraet und Android-OS. |
| **WWS** | Warenwirtschaftssystem. Die zentrale Software zur Verwaltung aller Artikel, Bestaende, Preise und Bestellungen. |
| **Out-of-Stock (OoS)** | Zustand, bei dem ein Artikel im Verkaufsregal nicht verfuegbar ist, obwohl er laut WWS im Bestand sein sollte. |
| **Reduktionsregel** | Interne Preisregel, die festlegt, um wie viel Prozent ein Artikel je nach MHD-Restlaufzeit reduziert wird. |`,
    glossary_manage: `**Projekt-Glossar (Demo-Modus)**

Das Glossar ist jetzt die Single Source of Truth fuer die Demo-Journey. Verwenden Sie insbesondere die Begriffe **MHD**, **MDE-Geraet**, **WWS**, **OoS** und **Reduktionsregel** konsistent in allen Anforderungen, Tests und Praesentationen.`,
    smells: `**Anforderung unter Analyse:**
"Das System soll abgelaufene Ware moeglichst schnell anzeigen und einfach meldbar machen."

**1. Weichmacher identifiziert:**
- "moeglichst schnell" -> Nicht messbar.
- "einfach meldbar" -> Nicht testbar.

**2. Unpraezise Begriffe:**
- "abgelaufene Ware" ist zu eng. Es geht auch um bald ablaufende Ware (<= 3 Tage).

**3. Passiv-/Unklarheitsprobleme:**
- "meldbar machen" laesst offen, wer was genau tut.

**4. Fazit:** Die Anforderung ist **nicht testbar** und **nicht eindeutig**.

**5. Verbesserungsvorschlaege:**
- Das System MUSS nach einem Hardware-Barcode-Scan die MHD-Information in unter 1,5 Sekunden anzeigen.
- Das System MUSS dem Marktmitarbeiter ermoeglichen, einen gescannten Artikel mit genau 2 Bestaetigungs-Klicks als Out-of-Stock ans WWS zu melden.`,
    tests: `**Abnahmekriterien fuer FA-01 (MHD-Scan):**

**Szenario 1 (Happy Path): Kritischer Artikel erkannt**
GIVEN Mitarbeiter Klaus ist eingeloggt AND Geraet hat WLAN-Verbindung AND Artikel "Bio-Joghurt 500g" hat MHD = uebermorgen
WHEN Klaus den Barcode scannt
THEN zeigt die App innerhalb von 1,5s: "MHD-kritisch | Noch 2 Tage | Reduktion: -30% | Neuer Preis: 0,91 EUR"

**Szenario 2 (Negativ): Unbekannter Artikel**
GIVEN das Geraet hat WLAN-Verbindung
WHEN Klaus einen Artikel scannt, der nicht im WWS hinterlegt ist
THEN zeigt die App: "Artikel nicht gefunden. Bitte Vorgesetzte informieren."

**Szenario 3 (Offline-Fall): Kein WLAN im Kuehlregal**
GIVEN das Geraet hat kein WLAN-Signal AND lokaler Cache wurde heute um 06:00 Uhr aktualisiert
WHEN Klaus einen Artikel scannt
THEN zeigt die App die MHD-Information aus dem Cache AND ein Offline-Symbol.`,
    perspective: `**Perspektiven-Check fuer FA-03 (Out-of-Stock melden):**

**1. Sicht des Entwicklers:**
Die WWS-API erlaubt OoS-Meldungen bisher nur im Batch-Modus. Fuer Echtzeit-Meldungen wird ein neuer API-Endpunkt benoetigt.

**2. Sicht des Testers:**
Der Offline-Puffer muss unter Last getestet werden. Was passiert bei 50 gepufferten Meldungen und spaeterer Synchronisation?

**3. Sicht des Business Sponsors:**
Das Lager braucht sichtbare Push-Benachrichtigungen statt nur technischer Dateneintraege.`,
    conflict: `**Konflikt-Analyse: FA-03 (Echtzeit-Meldung) vs. NFR-03 (Offline-Faehigkeit)**

**Anforderung A:** OoS-Meldungen MUESSEN in Echtzeit ans WWS uebermittelt werden.
**Anforderung B:** Die App MUSS bei WLAN-Ausfall im Offline-Modus funktionieren.

**1. Konflikttyp (IREB):** Sachkonflikt.

**2. Stakeholder-Interessen:**
- Filialleitung will sofortiges Handeln des Lagers.
- IT weiss, dass WLAN im Kuehlregal-Bereich unzuverlaessig ist.

**3. Aufloesungstechnik:** Guaranteed Delivery.
Die App sendet Meldungen sofort bei Verbindung und puffert sie bei WLAN-Ausfall lokal, mit automatischer Nachsendung spaetestens 5 Minuten nach Wiederherstellung.`,
    devil: `**Teufelsadvokat-Szenarien fuer die Scanner-App:**

**1. Was, wenn das MHD auf der Verpackung unleserlich oder falsch gedruckt ist?**
Das Scannen ergibt kein oder ein falsches Datum. Brauchen wir einen manuellen MHD-Override-Modus?

**2. Was, wenn zwei Mitarbeiter gleichzeitig denselben Artikel als Out-of-Stock melden?**
Das WWS erzeugt zwei identische Nachbestellungen. Duplikat-Pruefung erforderlich.

**3. Was, wenn der Cache nach einer Nacht-Lieferung veraltet ist?**
Neue Artikel werden als unbekannt gemeldet. Brauchen wir einen manuellen Cache-Aktualisieren-Button?

**4. Was, wenn das MDE-Geraet mitten in der Runde den Akku verliert?**
Offline-Meldungen duerfen nicht verloren gehen. Persistenter Puffer erforderlich.`,
    compliance: `**Compliance-Scan fuer die Scanner-App:**

**1. DSGVO / Datenschutz:**
- Mitarbeiter-Tracking kann ein Leistungsprofil erzeugen. Betriebsrat einbeziehen.
- Kundendaten werden nicht verarbeitet.
- Gepufferte lokale Daten erfordern Geraeteverschluesselung und Remote-Wipe.

**2. Lebensmittelrecht:**
- Die App unterstuetzt die korrekte MHD-Ueberwachungspflicht.
- Falsch positive OK-Anzeigen koennen rechtliche Risiken erzeugen. Fallback-Protokoll definieren.

**3. Barrierefreiheit:**
- Farbkodierung sollte durch Icons ergaenzt werden, damit farbenblinde Mitarbeiter nicht benachteiligt werden.`,
    bva: `**BVA & EP Analyse: NFR-01 (Antwortzeit) & FA-02 (Reduktionsstaffelung)**

**NFR-01:** Scan bis Anzeige MUSS in < 1,5 Sekunden erfolgen.

**Aequivalenzklassen fuer Antwortzeit:**
| Klasse | Bereich | Typ |
|---|---|---|
| EK1 | 0,0s - 1,499s | Gueltig |
| EK2 | 1,500s - unendlich | Ungueltig |
| EK3 | Kein WWS-Response (Timeout) | Ungueltig |

**Grenzwerte:**
- 1,499s -> OK
- 1,500s -> SLA verletzt

**FA-02 Reduktionsstaffelung:**
- 4 Tage -> OK
- 3 Tage -> -30%
- 1 Tag -> -50%
- 0 Tage -> Sofort entfernen`,
    dor_invest: `**Definition of Ready - INVEST (User Story 1: MHD-Scan):**

- **Independent:** Kann isoliert entwickelt werden.
- **Negotiable:** Cache-Implementierung ist noch verhandelbar.
- **Valuable:** Spart Klaus taeglich rund 30 Minuten.
- **Estimable:** Aufwand bekannt (5 Story Points).
- **Small:** Fokus auf MHD-Anzeige.
- **Testable:** Noch nicht vollstaendig, weil der Barcode-Fehlerfall fehlt.

**Fazit:** Fast Ready. Negativ-Szenario "Barcode nicht lesbar" ergaenzen.`,
    dor_ireb: `**Definition of Ready - IREB (User Story 1: MHD-Scan):**

1. Adaequat: Ja
2. Notwendig: Ja
3. Eindeutig: Ja
4. Vollstaendig: Nein - Barcode-Fehlerfall fehlt
5. Nachvollziehbar: Ja
6. Konsistent: Ja
7. Pruefbar: Ja
8. Realisierbar: Ja
9. Bewertet: Ja

**Fazit:** Fast Ready. Barcode-Fehlerfall als Akzeptanzkriterium ergaenzen.`,
    dor_kombiniert: `**Definition of Ready - INVEST & IREB kombiniert (User Story 1: MHD-Scan):**

**INVEST:**
- Independent, Negotiable, Valuable, Estimable, Small: erfuellt
- Testable: noch nicht vollstaendig

**IREB:**
- Adaequat, Notwendig, Eindeutig, Nachvollziehbar, Konsistent, Pruefbar, Realisierbar, Bewertet: erfuellt
- Vollstaendig: Barcode-Fehlerfall fehlt

**Fazit:** Fast Ready - ein fehlendes Negativszenario trennt die Story noch von der Sprint-Freigabe.`,
    poker: `**Planning Poker: User Story 2 - Out-of-Stock melden (per Scan)**

**Frontend-Dev (Maja):** Das UI ist simpel. Ich bin bei 2-3 Story Points.

**Backend-Dev (Rafael):** Fuer Echtzeit-Meldungen brauchen wir eine API-Erweiterung beim WWS-Hersteller. Ich sage 8 Story Points.

**Mobile-Dev (Jonas):** Offline-Puffer mit persistenter Retry-Logik ist solide Arbeit. 5 Story Points.

**Diskussion:** Der WWS-Dienstleister braucht 2 Wochen Vorlaufzeit fuer die API-Erweiterung.

**Konsens: 8 Story Points.** Voraussetzung: WWS-API-Spezifikation liegt vor Sprint-Start vor.`,
    traceability: `| Quell-ID | Ziel-ID | Art der Abhaengigkeit |
|---|---|---|
| FA-01 (MHD-Scan) | NFR-01 (Antwortzeit <= 1,5s) | Qualifiziert FA-01 |
| FA-01 (MHD-Scan) | FA-02 (Reduktionsregel anzeigen) | Voraussetzung |
| FA-03 (OoS-Meldung) | NFR-03 (Offline-Faehigkeit) | Konflikt - geloest durch Offline-Puffer |
| FA-03 (OoS-Meldung) | RB-01 (MDE Zebra TC57) | Randbedingung |
| FA-04 (Prioritaetsliste) | FA-01 (MHD-Scan) | Aggregiert Ergebnisse |`,
    impact: `**Change Request:** "Das WWS soll durch eine neue Cloud-Loesung ersetzt werden."

**1. Scope:** Vollstaendiger Austausch des Warenwirtschaftssystems.

**2. Direkte Abhaengigkeiten:**
- FA-01 greift auf WWS-Artikelstammdaten zu -> neu entwickeln.
- FA-02 nutzt WWS-Preislogik -> Reduktionsregeln migrieren.
- FA-03 sendet Daten ans WWS -> API-Endpunkt im neuen SaaS definieren.
- RB-02 wird obsolet -> alle API-Integrationen neu spezifizieren.

**3. Ripple-Effekte:**
- Offline-Cache basiert auf dem alten WWS-Datenmodell.
- Der 06:00-Uhr-Batch entfaellt; neues Echtzeit-Modell definieren.

**4. Risikobewertung:** Sehr hoch - der Change betrifft nahezu alle Anforderungen.

**5. Empfehlung:** Erst nach Go-Live v1.0 bewerten und sofort die API-Spezifikation des neuen SaaS-Anbieters anfordern.`,
    translate: `**Release Notes - Scanner-App v1.0 (Mitarbeiter-Infoscreen):**

Die neue Scan-App ist live.

- **MHD im Blick:** Scannt einen Artikel und seht sofort, ob er reduziert werden muss und um wie viel Prozent.
- **Leeres Regal? 2 Klicks zur Meldung:** Regaletikette scannen, "Leer melden" druecken - das Lager ist sofort informiert.
- **Offline? Kein Problem:** Die App funktioniert auch ohne WLAN im Kuehlregal-Bereich. Meldungen werden automatisch gesendet, sobald wieder Empfang besteht.

Die Einschulung findet diese Woche in eurer Abteilung statt. Bei Fragen: Sandra oder IT-Rufnummer 1234.`,
}

function classifyBacklogInput(input: string): string {
    const normalized = input.toLowerCase()
    if (
        normalized.includes('ablaufdatum') ||
        normalized.includes('reduktionsregel') ||
        normalized.includes('mhd') ||
        normalized.includes('fa-0')
    ) {
        return '[Hoch] | [Must Have]'
    }
    if (
        normalized.includes('out-of-stock') ||
        normalized.includes('wws') ||
        normalized.includes('leer melden') ||
        normalized.includes('lager melden')
    ) {
        return '[Mittel] | [Should Have]'
    }
    if (
        normalized.includes('offline') ||
        normalized.includes('puffern') ||
        normalized.includes('synchronisieren')
    ) {
        return '[Mittel] | [Should Have]'
    }
    if (
        normalized.includes('foto') ||
        normalized.includes('gamification') ||
        normalized.includes('bestellprognose')
    ) {
        return '[Niedrig] | [Could Have]'
    }
    return '[Mittel] | [Should Have]'
}

export function getDemoResponse(toolId: string, input: string, subKey?: string): string {
    if (toolId === 'prep') {
        return subKey === 'simulation' ? DEMO_RESPONSES['prep-sim'] ?? DEMO_RESPONSES.prep : DEMO_RESPONSES.prep
    }

    if (toolId === 'modeling') {
        return MODELING_DEMOS[subKey ?? 'activity'] ?? MODELING_DEMOS.activity
    }

    if (toolId === 'dor') {
        if (subKey === 'ireb') return DEMO_RESPONSES.dor_ireb
        if (subKey === 'kombiniert') return DEMO_RESPONSES.dor_kombiniert
        return DEMO_RESPONSES.dor_invest
    }

    if (toolId === 'backlog') {
        return classifyBacklogInput(input)
    }

    if (toolId === 'translate') {
        if (subKey === 'sponsor') {
            return `**Management-Pitch (Filialleitung & Zentrale):**

"Wir verlieren jeden Monat Tausende Euro durch Warenabschriften - Lebensmittel, die abgelaufen im Regal stehen, weil unsere Mitarbeiter die taegliche MHD-Kontrolle mit Stift und Zettel kaum effizient bewaeltigen. Gleichzeitig entgehen uns taeglich Umsaetze durch leere Regale, die zu spaet nachgefuellt werden.

Mit der Scanner-App loesen wir beides: Mitarbeiter scannen Artikel und bekommen sofort die Ampel-Anzeige und die korrekte Reduktionsregel. Out-of-Stock-Meldungen erreichen das Lager in Echtzeit statt per WhatsApp.

Business Case: Bei 5 Filialen reduzieren wir Abschriften um rund 40% und OoS-Fehlmengen um rund 25%. Das entspricht einem Einsparpotenzial von etwa 120.000 EUR jaehrlich. Die Investition amortisiert sich in unter 8 Monaten."`
        }
        return DEMO_RESPONSES.translate
    }

    return DEMO_RESPONSES[toolId] ?? 'Dies ist eine Standard-Demo-Antwort. Bitte hinterlegen Sie einen API-Key fuer echte Analysen.'
}