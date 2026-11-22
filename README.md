# Teachable Labor

Statische Web-App für iPad und Windows zum Trainieren einer Kamera-KI mit dem micro:bit.

## Lernablauf

1. Klassen frei anlegen oder löschen und vielfältige Kamerabilder sammeln.
2. Die belegten Klassen lokal im Browser trainieren.
3. Mit neuen Ansichten testen; die Live-Ansicht zeigt die führende Klasse groß und bietet Testaufgaben.
4. Optional einen micro:bit verbinden und einzelnen Klassen eine der Zahlen 1–10 zuordnen.

Die Anzahl der KI-Klassen ist nicht auf fünf begrenzt. Die 10 micro:bit-Zahlen sind davon getrennt: Klassen können ohne micro:bit-Aktion trainiert und erkannt werden.

Bilder, Lernmerkmale und trainierte Modelle bleiben lokal im Browser. Projektdateien verwenden aus Kompatibilitätsgründen weiterhin das Format `microbit-kameralabor-v1`, sodass ältere Fünf-Klassen-Projekte geöffnet werden können.

## micro:bit-Befehle

Die App sendet bei stabiler Erkennung optional `1` bis `10` über USB oder Bluetooth-UART. Das aktuelle [Schülerprogramm](Kameralabor-Schuelerprogramm-v3.mkcd) öffnet in MakeCode blockbasiert mit leerer Programmierfläche. In der Werkzeugleiste steht die Erweiterung „Teachable Labor“ mit den Ereignissen „wenn Zahl 1 empfangen“ bis „wenn Zahl 10 empfangen“ bereit. Die Erweiterung `Teachable Labor` übernimmt verborgen `PING` → `PONG`, USB, Bluetooth-UART und `OK:<Zahl>`.


## MakeCode-Erweiterung

Das Repository ist gleichzeitig eine MakeCode-Erweiterung. Die Datei `pxt.json` lädt `teachable-labor.ts`. Die Erweiterung stellt zehn einfache Ereignisblöcke bereit, startet die Kommunikation automatisch und kapselt die komplette Kommunikation mit der Web-App. Dadurch kann die Schüler-Arbeitsfläche vollständig leer starten. Das ältere `Kameralabor-Startprogramm-v2.mkcd` bleibt aus Kompatibilitätsgründen im Repository; für neue Unterrichtsprojekte ist `Kameralabor-Schuelerprogramm-v3.mkcd` vorgesehen.


## iPad-Workflow

Das Schülerprogramm verwendet **JustWorks-Pairing** statt „No Pairing Required“. Dadurch kann der micro:bit mit der offiziellen micro:bit-iOS-App gekoppelt bleiben und später erneut per Bluetooth programmiert werden.

Ablauf: Bluefy trennen → Programm in der micro:bit-App ändern und herunterladen → micro:bit-App trennen → Bluefy öffnen → Teachable Labor verbinden.


## Töne und längere Aktionen

Die Teachable-Labor-Ereignisse werden serialisiert: Es läuft immer nur eine Schüleraktion gleichzeitig. Während einer längeren Aktion, zum Beispiel einem Ton oder einer Melodie, wird höchstens die zuletzt erkannte andere Zahl vorgemerkt. Dadurch überlappen sich Aktionen nicht mehr unkontrolliert.
