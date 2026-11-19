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

Die App sendet bei stabiler Erkennung optional `1` bis `10` über USB oder Bluetooth-UART. Das aktuelle [Startprogramm](Kameralabor-Startprogramm-v2.mkcd) zeigt für jede Zahl ein eigenes LED-Muster. Der Verbindungstest bleibt `PING` → `PONG`; jeder gültige Befehl wird vor der LED-Anzeige mit `OK:<Zahl>` bestätigt. Nach dem Einschalten erscheint die Giraffe, Taste A zeigt das Muster für 2.
