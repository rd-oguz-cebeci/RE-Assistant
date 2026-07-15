import type { MenuSection } from '@/types'

/**
 * Vollständige Konfiguration der vier IREB-CPRE-Säulen mit allen Werkzeugen,
 * Erklärungen ("why") und Prompt-Mustern. 1:1 aus der ursprünglichen Anwendung
 * portiert, damit der fachliche Inhalt unverändert erhalten bleibt.
 */
export const menuStructure: MenuSection[] = [
    {
        id: 'elicitation',
        icon: 'search',
        color: 'indigo',
        label: '1. Ermittlung',
        title: 'Ermittlung (Elicitation)',
        desc: 'In dieser ersten Säule des IREB CPRE geht es darum, die wahren Bedürfnisse der Stakeholder herauszufinden und den Systemkontext abzugrenzen.',
        instruction: 'Wählen Sie ein Werkzeug aus der Ermittlungs-Phase aus:',
        why: 'Nach IREB ist die Ermittlung iterativ. Sie deckt unbewusste Anforderungen (Basisfaktoren) auf, detailliert bewusste (Leistungsfaktoren) und eruiert Begeisterungsfaktoren. Fehlt dieser Schritt, baut man mit höchster Wahrscheinlichkeit präzise das falsche System.',
        children: [
            {
                id: 'goals',
                category: 'Setup',
                icon: 'target',
                label: 'Zieldefinition (Zielbaum)',
                desc: 'Systemziele vor dem Kontextmodell definieren: Intentionale Anforderungsermittlung per UND/ODER-Zielbaum.',
                instruction: 'Beschreiben Sie grob die Projektsituation. Die KI erarbeitet einen UND/ODER-Zielbaum nach IREB.',
                why: 'IREB betont die intentionale Anforderungsermittlung. Ziele sind die Wurzel aller Anforderungen – ohne klare Ziele fehlt dem gesamten RE-Prozess das Fundament. Ein Zielbaum unterscheidet zwischen Hard Goals (messbar) und Soft Goals (qualitativ).',
                promptPattern:
                    'System-Prompt:\nRolle: Senior Requirements Engineer (IREB). Aufgabe: Erstelle einen strukturierten UND/ODER-Zielbaum für das Projekt. Trenne strikt: 1. Stakeholder-Ziele (Wer will was?) 2. Systemziele / Hard Goals (messbar, testbar) 3. Soft Goals / Qualitätsziele (nicht direkt messbar). Nutze Einrückungen und Symbole (UND / ODER) zur Darstellung der Zielrelationen. Format: Markdown.\n\nUser-Prompt:\nProjektsituation: [Eingabe Vision]',
            },
            {
                id: 'matrix',
                category: 'Setup',
                icon: 'table-2',
                label: 'Methoden-Matrix',
                desc: 'Auswahl der richtigen Ermittlungsmethode basierend auf Kontextfaktoren nach IREB.',
                instruction: 'Suchen Sie anhand der Rahmenbedingungen in der Matrix nach den "+" Symbolen, um die am besten geeignete Technik für Ihr Projekt zu finden.',
                why: 'IREB definiert spezifische Einflussfaktoren (z.B. Systemart, Reifegrad, Stakeholder-Verfügbarkeit), die zwingend bestimmen, welche Elicitation-Methode in der Praxis überhaupt effektiv sein kann.',
            },
            {
                id: 'context',
                category: 'Setup',
                icon: 'box-select',
                label: 'Systemkontext',
                desc: 'System, Kontext und irrelevante Umgebung hart abgrenzen.',
                instruction: 'Schreiben Sie Ihre Projektvision in das Textfeld.',
                why: 'Der Systemkontext trennt das System von seiner Umgebung über die Systemgrenze. Die Kontextgrenze trennt relevante von irrelevanten Aspekten. Missachtung führt schleichend zu Scope Creep.',
                promptPattern:
                    'System-Prompt:\nRolle: Senior Requirements Engineer. Aufgabe: Definiere Systemkontext nach IREB. Format: Markdown. Kategorisiere: 1. Geplantes System 2. Systemgrenze (Schnittstellen) 3. Systemkontext (relevante Umgebung) 4. Kontextgrenze & Irrelevante Umgebung.\n\nUser-Prompt:\nVision: [Eingabe Vision]',
            },
            {
                id: 'stakeholder',
                category: 'Setup',
                icon: 'radar',
                label: 'Stakeholder-Radar',
                desc: 'Identifikation aller relevanten Stakeholder-Gruppen.',
                instruction: 'Beschreiben Sie grob Ihre Projektidee.',
                why: 'IREB fordert die systematische Identifikation nach Relevanz, Einfluss und Einstellung. Übersehene Stakeholder sind die Hauptursache für späte, extrem teure Change Requests.',
                promptPattern:
                    'System-Prompt:\nRolle: Requirements Engineer. Aufgabe: Führe systematische Stakeholder-Analyse durch. Clustere nach IREB (Zwiebelmodell): 1. Direkte Systemnutzer 2. Sponsoren/Management 3. IT & Wartung 4. Externe (Regularien/Konkurrenz). Bewerte kurz Einfluss und Interesse.\n\nUser-Prompt:\nProjektidee: [Eingabe Vision]',
            },
            {
                id: 'persona',
                category: 'Setup',
                icon: 'users',
                label: 'Personas',
                desc: 'Nutzer im Fokus: Empathische Stakeholder-Profile generieren.',
                instruction: 'Überprüfen Sie den Kontext und lassen Sie KI typische Stakeholder erfinden.',
                why: 'Personas bündeln Stakeholder-Eigenschaften in greifbaren Profilen. Das verhindert das "Elastic User"-Antipattern in der Praxis, bei dem für einen völlig unrealistischen Durchschnittsnutzer entwickelt wird.',
                promptPattern:
                    'System-Prompt:\nRolle: UX & RE. Aufgabe: Erstelle 1 detaillierte, realistische Stakeholder-Persona für das Projekt.\n\nUser-Prompt:\nKontext: [Eingabe Kontext]',
            },
            {
                id: 'prep',
                category: 'Klassisch',
                icon: 'mic',
                label: 'Interviews (Leistung)',
                desc: 'Leistungsfaktoren: W-Fragen entwerfen & KI-Interview simulieren.',
                instruction: 'Generieren Sie Leitfragen und simulieren Sie anschließend das Interview.',
                why: 'Interviews eignen sich exzellent für Leistungsfaktoren. Offene, kontextfreie W-Fragen verhindern eine Voreingenommenheit (Bias) des Requirements Engineers.',
                promptPatterns: {
                    fragen:
                        'System-Prompt:\nRolle: RE. Aufgabe: Erstelle exakt 4 offene W-Fragen für ein Interview mit dieser Persona. Keine Ja/Nein-Fragen.\n\nUser-Prompt:\nProjektkontext:\n[Kontext]\n\nPersona:\n[Persona]',
                    simulation:
                        'System-Prompt:\nDu bist ein Rollenspieler im Requirements Engineering. Übernimm exakt die Rolle der folgenden Persona:\n\n[Persona]\n\nAntworte absolut authentisch, detailliert und aus der Ich-Perspektive auf Fragen im Kontext dieses Projekts:\n[Kontext]\n\nUser-Prompt:\nHier sind die Leitfragen des Requirements Engineers. Bitte beantworte sie einzeln und ehrlich aus deiner Sichtweise als Stakeholder:\n\n[Interview-Leitfaden]',
                },
                promptPattern:
                    'System-Prompt:\nRolle: RE. Aufgabe: Erstelle exakt 4 offene W-Fragen für ein Interview mit dieser Persona. Keine Ja/Nein-Fragen.\n\nUser-Prompt:\nProjektkontext:\n[Kontext]\n\nPersona:\n[Persona]',
            },
            {
                id: 'questionnaire',
                category: 'Klassisch',
                icon: 'clipboard-list',
                label: 'Fragebogen (Leistung)',
                desc: 'Leistungsfaktoren: Quantitative Umfragen entwerfen.',
                instruction: 'Geben Sie ein Thema ein, um welches sich die Umfrage drehen soll.',
                why: 'Fragebögen skalieren perfekt für sehr große Stakeholder-Gruppen (>50), um qualitativ ermittelte Leistungsfaktoren quantitativ und statistisch abzusichern.',
                promptPattern:
                    'System-Prompt:\nRolle: Requirements Engineer. Aufgabe: Erstelle einen methodisch sauberen quantitativen Fragebogen. Beinhaltet: 2 demografische Fragen, 3 Multiple-Choice Fragen zu Bedürfnissen und 2 Likert-Skala (1-5) Fragen.\n\nUser-Prompt:\nThema: [Eingabe Thema]',
            },
            {
                id: 'apprenticing',
                category: 'Innovation',
                icon: 'graduation-cap',
                label: 'Apprenticing (Basis)',
                desc: 'Basisfaktoren: Meister-Schüler-Prinzip / Beobachtungen.',
                instruction: 'Beschreiben Sie beobachtete Arbeitsschritte der Nutzer.',
                why: 'Basisfaktoren (Kano) sind Stakeholdern oft so selbstverständlich, dass sie in Interviews nicht genannt werden. Apprenticing (Beobachtung) deckt implizite Regeln zuverlässig auf.',
                promptPattern:
                    'System-Prompt:\nRolle: Requirements Engineer. Aufgabe: Analysiere die Notizen aus dem Apprenticing. Decke unbewusste Basisfaktoren auf. Identifiziere in Liste: 1. Versteckte Geschäftsregeln, 2. Workarounds/Schmerzpunkte, 3. Unausgesprochene Annahmen.\n\nUser-Prompt:\nBeobachtungsnotizen: [Eingabe]',
            },
            {
                id: 'archaeology',
                category: 'Innovation',
                icon: 'archive',
                label: 'Archäologie (Basis)',
                desc: 'Basisfaktoren: Systemarchäologie aus Legacy-Code.',
                instruction: 'Fügen Sie Code-Ausschnitte oder alte Handbuch-Texte ein.',
                why: 'Oftmals ist der Legacy-Code die einzige valide Quelle für vitale Geschäftsregeln, wenn die ursprünglichen Fachexperten das Unternehmen längst verlassen haben.',
                promptPattern:
                    'System-Prompt:\nRolle: Systemarchäologe / RE. Aufgabe: Extrahiere ausschließlich die zugrundeliegenden fachlichen Geschäftsregeln (Business Rules) aus diesem Legacy-Fragment. Ignoriere technische Schulden oder Syntax. Formuliere die Regeln im Klartext.\n\nUser-Prompt:\nLegacy Inhalt: [Code/Text]',
            },
            {
                id: 'scamper',
                category: 'Innovation',
                icon: 'sparkles',
                label: 'SCAMPER (Begeisterung)',
                desc: 'Begeisterungsfaktoren: Kreativitätstechnik für neue Features.',
                instruction: 'Geben Sie ein bestehendes Feature oder Konzept ein.',
                why: 'Reines Fragen führt oft nur zu inkrementellen Verbesserungen. Kreativitätstechniken brechen Denkmuster auf und wecken Begeisterungsfaktoren, nach denen Nutzer nie fragen würden.',
                promptPattern:
                    'System-Prompt:\nRolle: Innovationsmanager. Wende die SCAMPER-Methode auf das Konzept an, um völlig neue Feature-Ideen zu generieren. Gib jeweils 1-2 Sätze zu: Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse.\n\nUser-Prompt:\nBestehendes Konzept: [Eingabe]',
            },
            {
                id: 'kano',
                category: 'Innovation',
                icon: 'help-circle',
                label: 'Kano-Modell',
                desc: 'Unterstützend: Funktionale und dysfunktionale Fragen.',
                instruction: 'Geben Sie ein geplantes Feature ein.',
                why: 'Macht messbar, ob ein Feature tatsächlich Basis, Leistung oder Begeisterung ist. Das hilft dem Projektmanagement enorm bei der Release-Planung und Priorisierung.',
                promptPattern:
                    'System-Prompt:\nRolle: Requirements Engineer. Aufgabe: Erstelle für das geplante Feature genau EINE funktionale und EINE dysfunktionale Frage nach dem Kano-Modell.\n\nUser-Prompt:\nProjektkontext + Zielgruppe + Geplantes Feature: [Eingabe]',
            },
            {
                id: 'workshop',
                category: 'Klassisch',
                icon: 'presentation',
                label: 'RE Workshops',
                desc: 'Unterstützend: Gruppen-Workshops strukturieren.',
                instruction: 'Definieren Sie das Ziel und die Teilnehmer des Workshops.',
                why: 'Gruppentechniken sind laut IREB ideal, um rasch Konsens bei Interessenkonflikten zu finden und komplexe Lösungen kollaborativ zu erarbeiten.',
                promptPattern:
                    'System-Prompt:\nRolle: Senior RE / Moderator. Aufgabe: Entwirf eine strukturierte Agenda für diesen RE-Workshop. Nenne benötigte Materialien, zeitliche Blöcke und schlage konkrete Moderationstechniken (z.B. Brainwriting) vor.\n\nUser-Prompt:\nWorkshop Info: [Eingabe]',
            },
            {
                id: 'extract_req',
                category: 'Setup',
                icon: 'zap',
                label: 'Rohtext Extraktion',
                desc: 'Unterstützend: Rohtext aus Interviews in erste Anforderungen zerlegen.',
                instruction: 'Analysieren Sie das Transkript auf Requirements.',
                why: 'Ein RE muss qualitativen Rohtext methodisch in Funktionale Anforderungen, Qualitätsanforderungen und Randbedingungen (Constraints) klassifizieren, um nichts zu verlieren.',
                promptPattern:
                    'System-Prompt:\nRolle: RE. Aufgabe: Extrahiere funktionale Anforderungen, Qualitätsanforderungen und Randbedingungen. Format: Markdown Listen.\n\nUser-Prompt:\nRohtext: [Transkript]',
            },
        ],
    },
    {
        id: 'documentation',
        icon: 'file-edit',
        color: 'slate',
        label: '2. Dokumentation',
        title: 'Dokumentation (Documentation)',
        desc: 'Die zweite Säule befasst sich damit, gefundene Anforderungen unmissverständlich und strukturiert festzuhalten.',
        instruction: 'Wählen Sie ein Werkzeug aus der Dokumentations-Phase aus:',
        why: 'Gute Dokumentation ist dauerhaft, verständlich und eindeutig. Sie bildet die verbindliche vertragliche Basis (Baseline) für alle Folgeaktivitäten (Architektur, Test, Abnahme).',
        children: [
            {
                id: 'formulate',
                category: 'Klassisch',
                icon: 'file-edit',
                label: 'Natürlichsprachlich',
                desc: 'Rohe Notizen in formale Satzschablonen umwandeln.',
                instruction: 'Wählen Sie das Format und überarbeiten Sie Ihre Notiz.',
                why: 'Natürlichsprachliche Schablonen (z.B. Rupp/IREB) reduzieren syntaktische Ambiguität radikal und zwingen zu einer klaren und testbaren Systemreaktion.',
                promptPattern:
                    'System-Prompt:\nRolle: RE. Aufgabe: Übersetze Notiz in Dokumentation. Nutze Format [User Story | IREB Schablone (Bedingung + System/Nutzer + MUSS/SOLL/KANN + Prozesswort + Objekt) | Fully Dressed Use Case]. Trenne Elemente sauber.\n\nUser-Prompt:\nNotiz: [Rohtext]',
            },
            {
                id: 'nfr',
                category: 'Klassisch',
                icon: 'shield-check',
                label: 'NFR-Ableitung',
                desc: 'Nicht-funktionale Qualitätskriterien ableiten.',
                instruction: 'Wählen Sie eine Anforderung zur Analyse aus.',
                why: 'Qualitätsanforderungen (NFRs) nach ISO 25010 sind stark architekturtreibend. Werden Performance oder Security nicht früh dokumentiert, ist das System später oft nicht mehr refaktorierbar.',
                promptPattern:
                    'System-Prompt:\nRolle: Systems Engineer. Leite 3 kritische NFRs nach ISO 25010 ab.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
            {
                id: 'glossary_extract',
                category: 'Glossar',
                icon: 'search',
                label: 'Begriffe extrahieren',
                desc: 'Wichtige Domänen-Begriffe aus Texten identifizieren.',
                instruction: 'Fügen Sie einen Text ein. Die KI schlägt Fachbegriffe vor.',
                why: 'Ein zentrales Glossar löst Synonym- und Homonym-Probleme. Laut IREB ist die konsequente Begriffsklärung die effektivste Präventivmaßnahme gegen Missverständnisse.',
                promptPattern:
                    'System-Prompt:\nRolle: RE. Identifiziere Fachbegriffe und erstelle tabellarisches Glossar.\n\nUser-Prompt:\nText: [Eingabe Text]',
            },
            {
                id: 'glossary_manage',
                category: 'Glossar',
                icon: 'book-open',
                label: 'Projekt-Glossar',
                desc: 'Die Single Source of Truth verwalten.',
                instruction: 'Verwenden Sie diese Definitionen ab sofort konsequent.',
                why: 'Ein etabliertes Glossar zwingt Entwickler, Tester und Sponsoren, immer dasselbe mentale Modell der Domäne zu teilen.',
            },
            {
                id: 'modeling',
                category: 'Modellierung',
                icon: 'network',
                label: 'Modellierung (UML)',
                desc: 'Prozesse konzeptionell modellieren.',
                instruction: 'Wählen Sie den Typ und beschreiben Sie den Prozess.',
                why: 'Konzeptionelle UML-Modelle reduzieren die kognitive Last enorm. Ein Aktivitätsdiagramm zeigt komplexe Kontrollflüsse und Logikfehler oft besser als textuelle Spezifikationen.',
                promptPatterns: {
                    usecase:
                        'System-Prompt:\nRolle: RE / UML-Experte. Aufgabe: Übersetze den beschriebenen Prozess in reinen, validen Mermaid.js Code für ein Use-Case-Diagramm. Zeige Akteure und deren Use Cases. Nur Code, kein Markdown-Codeblock.\n\nUser-Prompt:\nProzess: [Eingabe Text]',
                    activity:
                        'System-Prompt:\nRolle: RE / UML-Experte. Aufgabe: Übersetze den beschriebenen Prozess in reinen, validen Mermaid.js Code für ein Aktivitätsdiagramm (flowchart TD). Zeige Entscheidungen als Rauten. Nur Code, kein Markdown-Codeblock.\n\nUser-Prompt:\nProzess: [Eingabe Text]',
                    class:
                        'System-Prompt:\nRolle: RE / UML-Experte. Aufgabe: Übersetze den beschriebenen Kontext in reinen, validen Mermaid.js Code für ein Klassendiagramm (classDiagram). Zeige Klassen, Attribute und Relationen. Nur Code, kein Markdown-Codeblock.\n\nUser-Prompt:\nKontext: [Eingabe Text]',
                    state:
                        'System-Prompt:\nRolle: RE / UML-Experte. Aufgabe: Übersetze den beschriebenen Prozess in reinen, validen Mermaid.js Code für ein Zustandsdiagramm (stateDiagram-v2). Zeige alle Zustände und Übergänge. Nur Code, kein Markdown-Codeblock.\n\nUser-Prompt:\nProzess: [Eingabe Text]',
                    sequence:
                        'System-Prompt:\nRolle: RE / UML-Experte. Aufgabe: Übersetze den beschriebenen Ablauf in reinen, validen Mermaid.js Code für ein Sequenzdiagramm (sequenceDiagram). Zeige alle Akteure und Nachrichten. Nur Code, kein Markdown-Codeblock.\n\nUser-Prompt:\nAblauf: [Eingabe Text]',
                },
                promptPattern:
                    'System-Prompt:\nRolle: RE / UML-Experte. Aufgabe: Übersetze den beschriebenen Prozess in reinen, validen Mermaid.js Code für ein Aktivitätsdiagramm (flowchart TD). Nur Code, kein Markdown-Codeblock.\n\nUser-Prompt:\nProzess: [Eingabe Text]',
            },
        ],
    },
    {
        id: 'validation',
        icon: 'check-square',
        color: 'teal',
        label: '3. Validierung',
        title: 'Validierung & Abstimmung',
        desc: 'In der dritten Säule werden Anforderungen auf Qualität (Smells) geprüft und mit Stakeholdern abgestimmt.',
        instruction: 'Wählen Sie ein Werkzeug aus der Validierungs-Phase aus:',
        why: 'Validierung prüft, ob das System den wahren Stakeholder-Wunsch trifft. Verifikation prüft, ob die Anforderung formal korrekt nach IREB-Standards formuliert ist (z.B. Prüfung auf Smells).',
        children: [
            {
                id: 'smells',
                category: 'Prüfung',
                icon: 'search-check',
                label: 'Smells & Qualität',
                desc: 'Weichmacher und unklare Passiv-Sätze aufspüren.',
                instruction: 'Wählen Sie die neu erstellte Anforderung.',
                why: 'Linguistische Defekte (Weichmacher, Universalquantoren) machen Anforderungen unprüfbar und lassen Entwicklern fatalen Interpretationsspielraum.',
                promptPattern:
                    "System-Prompt:\nRolle: Senior QA. Wende strenges 'Chain-of-Thought' an: 1. Isoliere Sätze, 2. Prüfe auf IREB-Smells (Weichmacher, Universalquantoren, Nominalisierung, unklare Bedingungen), 3. Prüfe Passiv, 4. Smells zusammenfassen, 5. Verbesserung vorschlagen.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]",
            },
            {
                id: 'jira_quality',
                category: 'Jira Review',
                icon: 'search-check',
                label: 'Jira-Ticket-Review',
                desc: 'Jira-Tickets importieren und mit KI auf IREB-Qualität prüfen.',
                instruction: 'Laden Sie Jira-Tickets und prüfen Sie deren RE-Qualität automatisch.',
                why: 'Validierung und Verifikation prüfen, ob Anforderungen verständlich, vollständig und testbar sind. Jira-Tickets aus externen Quellen brauchen genau diesen Review, bevor sie als belastbare Anforderungen in Umsetzung oder Baseline gehen.',
            },
            {
                id: 'tests',
                category: 'Prüfung',
                icon: 'beaker',
                label: 'Prüfbarkeit (Tests)',
                desc: 'Akzeptanzkriterien ableiten.',
                instruction: 'Wählen Sie eine Anforderung, zu der die KI Tests ableiten soll.',
                why: 'Test-First-Denken deckt logische Unschärfen sofort auf. Eine Anforderung, zu der keine präzisen Abnahmekriterien formuliert werden können, ist methodisch unvollständig.',
                promptPattern:
                    'System-Prompt:\nRolle: QA. Leite fachliche Abnahmekriterien (Given-When-Then) ab.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
            {
                id: 'perspective',
                category: 'Perspektiven',
                icon: 'eye',
                label: 'Perspektiven-Check',
                desc: 'Lesen aus Sicht von Entwickler, Tester und Sponsor.',
                instruction: 'Lassen Sie die KI aus 3 Sichten Feedback geben.',
                why: 'Der IREB-Standard empfiehlt den Perspektivenwechsel (Walkthrough), da Entwickler, Tester und Business-Sponsoren völlig unterschiedliche Qualitätsattribute priorisieren.',
                promptPattern:
                    'System-Prompt:\nRolle: Review-Team. Feedback aus Sicht: 1. Entwickler 2. Tester 3. Business Sponsor.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
            {
                id: 'conflict',
                category: 'Perspektiven',
                icon: 'git-merge',
                label: 'Konflikte',
                desc: 'Widersprüche zwischen Anforderungen analysieren.',
                instruction: 'Wählen Sie zwei Anforderungen aus.',
                why: 'Ziel-, Sach- oder Interessenkonflikte sind im RE völlig normal. Der RE darf sie nicht ignorieren, sondern muss sie aktiv managen und durch geeignete Techniken auflösen.',
                promptPattern:
                    "System-Prompt:\nRolle: Konfliktmanager. Wende 'Chain-of-Thought' an: 1. Analysiere A, 2. Analysiere B, 3. Identifiziere Konflikttyp nach IREB (Sach-, Interessen-, Werte-, Beziehungs- oder Strukturkonflikt), 4. Schlage Auflösungstechnik vor (Kompromiss, Einigung, Variante).\n\nUser-Prompt:\nReq A: [Anf. 1]\nReq B: [Anf. 2]",
            },
            {
                id: 'devil',
                category: 'Perspektiven',
                icon: 'alert-triangle',
                label: 'Teufelsadvokat',
                desc: 'Edge-Cases & Was-wäre-wenn-Szenarien generieren.',
                instruction: 'Wählen Sie eine Anforderung.',
                why: 'Stakeholder fokussieren meist nur den "Happy Path". Der RE muss Ausnahme-, Fehler- und Grenzfälle (Edge Cases) systematisch provozieren, um Robustheit zu garantieren.',
                promptPattern:
                    'System-Prompt:\nRolle: QA-Teufelsadvokat. Finde 3-5 fiese Edge-Cases (Was-wäre-wenn) und Grenzfälle für diese Anforderung.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
            {
                id: 'compliance',
                category: 'Prüfung',
                icon: 'scale',
                label: 'Compliance-Scanner',
                desc: 'Prüfung auf DSGVO, PII und Barrierefreiheit.',
                instruction: 'Wählen Sie eine Anforderung.',
                why: 'Regulatorische Randbedingungen (Constraints) wie DSGVO oder WCAG sind harte Schranken. Sie limitieren den Lösungsraum massiv und müssen validiert werden.',
                promptPattern:
                    'System-Prompt:\nRolle: Compliance Officer. Prüfe die Anforderung auf DSGVO-Implikationen (PII-Daten) und Barrierefreiheit (WCAG).\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
            {
                id: 'dor',
                category: 'Agil',
                icon: 'list-checks',
                label: 'Definition of Ready',
                desc: 'Prüft, ob eine Anforderung bereit für die Umsetzung ist.',
                instruction: 'Wählen Sie ein Schema und eine Anforderung für den finalen Readiness-Check.',
                why: 'Die Definition of Ready ist das finale Quality Gate zwischen RE und agiler Entwicklung. Nur vollständig ausdetaillierte, INVEST-konforme Anforderungen dürfen in den Sprint.',
                promptPatterns: {
                    invest:
                        'System-Prompt:\nRolle: Agile Coach / RE. Prüfe die Anforderung streng gegen alle 6 INVEST-Kriterien: Independent, Negotiable, Valuable, Estimable, Small, Testable. Erstelle eine Checkliste mit ✅/❌ und einem klaren Fazit: Ready oder Not Ready.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
                    ireb:
                        'System-Prompt:\nRolle: IREB-zertifizierter Requirements Engineer. Prüfe die Anforderung streng gegen alle 9 IREB-Qualitätskriterien: 1. Adäquat 2. Notwendig 3. Eindeutig 4. Vollständig 5. Nachvollziehbar 6. Konsistent 7. Prüfbar 8. Realisierbar 9. Bewertet. Erstelle eine Checkliste mit ✅/❌ und einem klaren Fazit.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
                    kombiniert:
                        'System-Prompt:\nRolle: Agile Coach und IREB-zertifizierter RE. Prüfe die Anforderung gegen BEIDE Schemata: (A) Alle 6 INVEST-Kriterien und (B) Alle 9 IREB-Qualitätskriterien. Erstelle getrennte Checklisten mit ✅/❌ und einem kombinierten Fazit.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
                },
                promptPattern:
                    'System-Prompt:\nRolle: Agile Coach / RE. Prüfe die Anforderung streng gegen alle 6 INVEST-Kriterien: Independent, Negotiable, Valuable, Estimable, Small, Testable. Erstelle eine Checkliste mit ✅/❌ und einem klaren Fazit.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
            {
                id: 'bva',
                category: 'Prüfung',
                icon: 'sliders',
                label: 'Abnahmekriterien-Vervollständiger (BVA & EP)',
                desc: 'Wendet Grenzwertanalyse (BVA) und Äquivalenzklassenbildung (EP) an, um Abnahmekriterien zu vervollständigen.',
                instruction: 'Wählen Sie eine Anforderung. Die KI prüft auf numerische Werte und leitet vollständige Testfälle ab.',
                why: 'Klassische Testdesign-Verfahren wie BVA und EP sichern, dass exakte Zahlenwerte an ihren Rändern geprüft werden. Eine Anforderung mit "< 2 Sekunden" erfordert Testfälle für 1,9s, 2,0s und 2,1s – sonst ist sie formal unvollständig.',
                promptPattern:
                    'System-Prompt:\nRolle: QA-Experte (Testdesign). Wende auf die Anforderung die klassischen Testdesign-Verfahren an: 1. Äquivalenzklassenbildung (EP): Identifiziere alle gültigen und ungültigen Äquivalenzklassen. 2. Grenzwertanalyse (BVA): Leite für jeden numerischen Wert die exakten Grenzwerte ab (Wert-1, Wert, Wert+1 bzw. Wert-ε). Formuliere vollständige Given-When-Then Szenarien für jeden Grenzwert. Format: Markdown.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
        ],
    },
    {
        id: 'management',
        icon: 'database',
        color: 'blue',
        label: '4. Management',
        title: 'Anforderungsmanagement',
        desc: 'Die vierte Säule sichert den Lebenszyklus ab. Das Backlog verwalten und Prioritäten setzen.',
        instruction: 'Wählen Sie ein Werkzeug aus der Management-Phase aus:',
        why: 'Requirements Management sichert die Traceability (Verfolgbarkeit), steuert Versionen und koordiniert Änderungen (Change Requests) systematisch über den gesamten Projektlebenszyklus.',
        children: [
            {
                id: 'jira_dashboard',
                category: 'Health',
                icon: 'activity',
                label: 'Jira RE-Health Dashboard',
                desc: 'Prüft Jira-Tickets auf Traceability, Review-Bedarf und Anforderungsstatus.',
                instruction: 'Laden Sie die aktuellen Jira-Issues und erstellen Sie ein RE-Health-Dashboard.',
                why: 'Requirements Management sichert Nachvollziehbarkeit, Abdeckung und Änderbarkeit. Ein RE-Health-Dashboard zeigt deshalb nicht nur Delivery-Status, sondern vor allem fehlende Verknüpfungen, Review-Kandidaten und Traceability-Lücken.',
            },
            {
                id: 'export_context',
                category: 'Export',
                icon: 'download',
                label: 'Export für Claude Code',
                desc: 'Exportiert den aktuellen RE-Kontext als Markdown-Datei für Claude Code oder ähnliche KI-Werkzeuge.',
                instruction: 'Prüfen Sie die Vorschau und exportieren Sie anschließend den gesamten Projektkontext als Markdown-Datei.',
                why: 'Ein strukturierter Export macht den erarbeiteten RE-Kontext außerhalb des Assistenten wiederverwendbar. So lassen sich Vision, Systemkontext, Glossar und Backlog in externe KI-Workflows übernehmen, ohne Informationen manuell neu zusammenzustellen.',
            },
            {
                id: 'jira_handover',
                category: 'Übergabe',
                icon: 'arrow-up-right',
                label: 'Anforderung → Jira-Ticket',
                desc: 'Freigegebene Anforderungen KI-gestützt zu umsetzungsreifen Jira-Tickets aufbereiten und übergeben.',
                instruction: 'Bereiten Sie je Anforderung ein Ticket auf, prüfen Sie die Vorschau und legen Sie es in Jira an.',
                why: 'Die Übergabe an die Umsetzung ist der Zielpunkt des roten IREB-Pfads: Aus validierten Anforderungen entstehen nachvollziehbare, umsetzungsreife Jira-Tickets. Eine KI-gestützte Aufbereitung (prägnanter Titel, User Story, Akzeptanzkriterien) plus editierbare Vorschau stellt sicher, dass die im RE-Prozess erarbeitete Qualität nicht verloren geht.',
            },
            {
                id: 'backlog',
                category: 'Backlog',
                icon: 'list-todo',
                label: 'Backlog & Priorisierung',
                desc: 'Anforderungen verwalten, schätzen und priorisieren.',
                instruction: 'Schätzen Sie Komplexität und MoSCoW-Priorität Ihrer Anforderungen.',
                why: 'Nach der Dokumentation werden Anforderungen im Management priorisiert und versioniert. Eine belastbare Schätzung und MoSCoW-Priorisierung ist die Voraussetzung für eine sinnvolle Übergabe in die Umsetzung.',
                promptPattern:
                    'System-Prompt:\nSchätze die Anforderung ein. Output exakt im Format: [Komplexität] | [MoSCoW]\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
            {
                id: 'traceability',
                category: 'Analyse',
                icon: 'link',
                label: 'Traceability Matrix',
                desc: 'Logische Abhängigkeiten im Backlog aufdecken.',
                instruction: 'Lassen Sie die KI Ihr Backlog auswerten.',
                why: 'Pre- und Post-RS-Traceability beweist, warum ein Feature existiert (Quelle) und wie es abhängt. Das ist kritisch für System-Audits und zuverlässige Auswirkungsanalysen.',
                promptPattern:
                    'System-Prompt:\nRolle: RE Manager. Erstelle Markdown Tabelle (Quell-ID | Ziel-ID | Abhängigkeit) für das gesamte Backlog.\n\nUser-Prompt:\nBacklog: [JSON Array aller Anforderungen]',
            },
            {
                id: 'impact',
                category: 'Analyse',
                icon: 'git-pull-request',
                label: 'Change Impact',
                desc: 'Risiken bei Änderungsanfragen bewerten.',
                instruction: 'Wählen Sie eine Anforderung und beschreiben Sie die Änderung.',
                why: 'Bevor ein später Change Request bewilligt wird, muss zwingend der "Ripple-Effekt" auf abhängige Anforderungen, Architektur und Kosten ermittelt werden.',
                promptPattern:
                    'System-Prompt:\nRolle: Senior Change Manager. Chain-of-Thought: 1. Scope erfassen, 2. Direkte Abhängigkeiten im Backlog scannen, 3. Ripple-Effekte, 4. Risiken, 5. Zusammenfassung.\n\nUser-Prompt:\nOriginal: [Anf. Text]\nÄnderung: [Wunsch]\nBacklog: [Ganzes Backlog]',
            },
            {
                id: 'poker',
                category: 'Kommunikation',
                icon: 'users',
                label: 'KI-Planning-Poker',
                desc: 'Simulierte Schätz-Diskussion dreier Entwickler.',
                instruction: 'Wählen Sie eine Anforderung aus dem Backlog.',
                why: 'Interdisziplinäre Schätzrunden decken blinde technische Flecken auf. Der methodische Diskurs ist hierbei oft wertvoller als die finale Aufwandsschätzung in Story Points.',
                promptPattern:
                    'System-Prompt:\nSimuliere 3 Entwickler (Frontend, Backend, Datenbank-Admin). Lass sie kurz diskutieren und sich am Ende auf eine Komplexität einigen.\n\nUser-Prompt:\nAnforderung: [Gewählte Anforderung]',
            },
            {
                id: 'translate',
                category: 'Kommunikation',
                icon: 'megaphone',
                label: 'Mgmt.-Übersetzer',
                desc: 'Anforderungen in Business-Pitch oder Release Notes wandeln.',
                instruction: 'Wählen Sie das Zielformat und die Anforderung.',
                why: 'Stakeholder-gerechte Kommunikation ist zentral im PM. Der Sponsor braucht den Business Value (ROI), der Entwickler die technische Akzeptanzbedingung.',
                promptPatterns: {
                    sponsor:
                        'System-Prompt:\nÜbersetze die formale Anforderung in einen Sponsor-Pitch mit Business Value, Nutzen und plausibler Wirkung.\n\nUser-Prompt:\nAnforderung: [Anforderung]',
                    release:
                        'System-Prompt:\nÜbersetze die formale Anforderung in verständliche Release Notes für Mitarbeitende oder Endnutzer.\n\nUser-Prompt:\nAnforderung: [Anforderung]',
                },
                promptPattern:
                    'System-Prompt:\nÜbersetze die formale Anforderung in einen Sponsor-Pitch mit Business Value, Nutzen und plausibler Wirkung.\n\nUser-Prompt:\nAnforderung: [Anforderung]',
            },
        ],
    },
]

/** Schnelle Nachschlagetabelle: View-ID → Anzeigetitel. */
export const viewTitles: Record<string, string> = {
    home: 'Startseite',
    advisor: 'IREB Berater',
}
menuStructure.forEach((section) => {
    viewTitles[section.id] = section.title
    section.children.forEach((child) => {
        viewTitles[child.id] = child.label
    })
})

/** Findet ein Werkzeug anhand seiner ID über alle Säulen hinweg. */
export function findTool(toolId: string) {
    for (const section of menuStructure) {
        const tool = section.children.find((c) => c.id === toolId)
        if (tool) return { section, tool }
    }
    return null
}
