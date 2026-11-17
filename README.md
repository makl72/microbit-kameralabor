# Teachable Labor

Statische Web-App für iPad und Windows zum Trainieren einer einfachen Kamera-KI mit dem micro:bit. In GitHub Pages: main / (root).

Die Bilder und Projekte liegen lokal im Browser. Vor dem Wechsel der Adresse Projektdatei (.json) aus der alten Kameralabor-Version speichern und unter der neuen Adresse wieder öffnen.

## micro:bit-Befehle

Die App sendet bei Erkennung `1` bis `10` über USB oder Bluetooth-UART. Das aktuelle [Startprogramm](Kameralabor-Startprogramm-v2.mkcd) zeigt für jede Zahl ein eigenes LED-Muster. Der Verbindungstest bleibt `PING` → `PONG`; jeder gültige Befehl wird vor der LED-Anzeige mit `OK:<Zahl>` bestätigt. Nach dem Einschalten erscheint die Giraffe, Taste A zeigt das Muster für 2.
