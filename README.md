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

## MakeCode und Übertragung

Für das Schülerprogramm mit Bluetooth und dem normalen Musikblock „spiele Ton“ verwenden wir [MakeCode 7](https://makecode.microbit.org/v7). Im Editor das Projekt importieren und als HEX herunterladen. Hintergrund: [MakeCode-Fehler 070 bei Bluetooth und Musik](https://github.com/microsoft/pxt-microbit/issues/6629).

- iPad: Die erzeugte HEX-Datei mit der micro:bit-App öffnen, Bluefy trennen und die gespeicherte Datei unter „My Programs“ mit „Send to micro:bit“ übertragen. Danach wieder in Bluefy verbinden.
- Windows: Das in MakeCode 7 erzeugte Programm per USB übertragen und das Labor per Web Serial verbinden.

## MakeCode-Erweiterung

Das Repository ist gleichzeitig die MakeCode-Erweiterung **teachable-labor**. `pxt.json` laedt `teachable-labor.ts`.
