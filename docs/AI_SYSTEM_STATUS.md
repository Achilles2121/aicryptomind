# Vision AI Mind - System Status, Abhaengigkeiten, Funktionsweise

Dieses Dokument beschreibt:
- Welche offenen Probleme/Schwachstellen aktuell sichtbar sind
- Was benoetigt wird, um die Schwachstellen zu schliessen
- Wie das Assistenzsystem arbeitet (auf hoher Ebene)
- Worin die Informationsbasis besteht und welche Grenzen gelten

---

## 1) Aktuelle, sichtbare Probleme / Risiken

- Unvollstaendige End-to-End-Tests: Es gibt keine automatisierten Tests, die die komplette Kette (API -> UI -> WS) absichern.
- Externe Abhaengigkeiten: Binance, Kraken, CoinGecko koennen throttlen oder ausfallen; ohne Monitoring sieht man das erst im UI.
- WebSocket-Qualitaet: WS kann schlafen/abbrechen; ohne durchgehende Health-Metriken ist die Sichtbarkeit begrenzt.
- Datenkonsistenz: REST-Preise vs. WS-Preise koennen voneinander abweichen; Integrity-Check ist vorhanden, aber nur stichprobenartig.
- Navigations- und Render-Risiken: Bei Router/Store Sync kann es zu Update-Schleifen kommen, wenn Checks fehlen.

---

## 2) Was ich brauche, um diese Schwachstellen abzudecken

Technik/Monitoring:
- API-Latenz-Messungen und Fehlerquoten pro Quelle (Binance/Kraken/CoinGecko), idealerweise via Monitoring-Tool oder Logs.
- Zugriff auf Prod-/Staging-Logs fuer konkrete Error-Patterns (HTTP Status, Payloads, Timing).
- Definierte Rate-Limit-Budgets (max. RPS, Burst), damit ich Backoff/Circuit-Breaker korrekt einstellen kann.

Tests/Qualitaet:
- Mindestens ein E2E-Szenario (z.B. Playwright) fuer Navigation + Preisfeed.
- Vertragstests fuer API-Antworten (Schemas fuer /api/coins, /api/price, /api/ohlc).

Produkt/UX:
- Definition, wie "stabilste Quelle" priorisiert wird (Latenz vs. Fehlerquote vs. Preisstabilitaet).
- Definition der Fallback-Schwelle: Ab wann wird eine Quelle deaktiviert/gesperrt?

Sicherheit/Compliance:
- API-Keys (falls erforderlich) und Hinweise zu erlaubten Endpunkten.
- Klarer Hinweis, welche Quellen in welchem Deployment erlaubt sind.

---

## 3) Wie ich funktioniere (hohe Ebene)

Ich bin ein Sprachmodell (Transformer-Architektur). Ich verarbeite Eingaben als Token,
berechne Wahrscheinlichkeiten fuer die naechsten Token und generiere daraus Antworten.

Wichtig:
- Ich habe kein eigenes Langzeitgedaechtnis. Alles, was ich "weiss", kommt aus dem aktuellen Kontext
  (User-Input + geladene Dateien).
- Ich kann Tools/Dateien verwenden, wenn mir Zugriff gegeben wird.
- Ich garantiere keine absolute Korrektheit; ich liefere die bestmoegliche Antwort basierend auf dem Kontext.

---

## 4) Worauf ich basiere / Aus welchen Bestaenden

Meine Wissensbasis stammt aus einem gemischten Trainingskorpus:
- Allgemeiner Text (oeffentlich verfuegbar, lizenziert, oder von Menschen erstellt)
- Programmier- und Techniktexte
- Beispielcode und Dokumentation

Ich habe keinen direkten Zugriff auf proprietaere Daten oder private Quellen, ausser sie werden mir
im Projektkontext gegeben (z.B. lokale Dateien, Logs, Konfigurationen).

---

## 5) Wie ich rechne / Entscheidungen treffe

Kurzform:
- Eingabe wird tokenisiert
- Das Modell berechnet fuer jeden Schritt die naechstwahrscheinlichsten Token
- Antworten entstehen stochastisch, aber kontextgeführt

In der Praxis:
- Ich suche Muster im Code, erkenne Abhaengigkeiten, und schlage Aenderungen vor
- Ich kann keine "Wahrheit" garantieren, sondern optimiere fuer Plausibilitaet und Konsistenz

---

## 6) Konkrete Abhaengigkeiten im Projekt (relevant)

Externe Quellen:
- Binance API (REST/WS)
- Kraken API (REST)
- CoinGecko API (REST)

Lokale Schluesselstellen:
- /api/coins.ts (Markt-Assets + Preise)
- /api/price.ts (Einzelpreis)
- /api/ohlc.ts (Kerzendaten)
- UI Stores und Komponenten (MarketTable, AppNavbar, App)

---

## 7) Empfehlungen zur Absicherung (Minimal-Plan)

1. Monitoring aktivieren (Latenz, Error Rate, Source-Switch-Events)
2. Circuit-Breaker fuer API-Quellen (bei X Fehlern in Y Sekunden)
3. E2E-Test fuer Navigation + WS + REST
4. Schema-Validation fuer API-Antworten
5. Explizite Fallback-Policy dokumentieren (Prioritaet und Cooldown)

---

## 8) Offen / Rueckfragen

Bitte beantworte kurz:
- Welche Quelle soll bei gleicher Stabilitaet gewinnen (Latenz vs. Preisqualitaet)?
- Gibt es feste API-Keys oder Proxy-Endpoints?
- Gibt es eine bevorzugte Monitoring-Umgebung?

