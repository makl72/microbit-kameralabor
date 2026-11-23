# Teachable Labor

Statische Web-App fuer iPad und Windows zum Trainieren einer Kamera-KI mit dem micro:bit.

[Teachable Labor öffnen](https://makl72.github.io/teachable-labor/)

## Lernablauf

1. Klassen frei anlegen oder loeschen und vielfaeltige Kamerabilder sammeln.
2. Die belegten Klassen lokal im Browser trainieren.
3. Mit neuen Ansichten testen.
4. Klassen optional einer Zahl von 1 bis 10 zuordnen.
5. Den micro:bit ueber USB oder Bluetooth verbinden.

Bilder, Lernmerkmale und trainierte Modelle bleiben lokal im Browser.

## Schuelerprogramm

Das aktuelle MakeCode-Projekt ist:

[Teachable-Labor-Schuelerprogramm.mkcd herunterladen](https://makl72.github.io/teachable-labor/Teachable-Labor-Schuelerprogramm.mkcd)

Es startet mit leerer Blockflaeche. In der Werkzeugleiste erscheint die Erweiterung **Teachable Labor** mit den Ereignissen **wenn Zahl 1 empfangen** bis **wenn Zahl 10 empfangen**.

Die Erweiterung uebernimmt im Hintergrund:
- USB-Serial
- Bluetooth-UART
- PING / PONG
- OK-Antworten fuer Zahlen 1 bis 10
- serialisierte Ereignisse, damit laengere Aktionen wie Toene oder Melodien nicht unkontrolliert ueberlappen

## iPad

Bluefy trennen -> Projekt in der offiziellen micro:bit-App bearbeiten und per Bluetooth uebertragen -> micro:bit-App verlassen -> micro:bit Reset -> Teachable Labor wieder in Bluefy verbinden.

## Windows

MakeCode im Browser verwenden und den micro:bit per USB uebertragen bzw. mit Teachable Labor per Web Serial verbinden.

## MakeCode-Erweiterung

Das Repository ist gleichzeitig die MakeCode-Erweiterung **teachable-labor**. `pxt.json` laedt `teachable-labor.ts`.
