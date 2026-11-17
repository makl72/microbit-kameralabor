// Kameralabor – ein Programm für USB (Windows) und Bluetooth-UART (iPad).
// Taste A zeigt ohne App ein Herz: schneller Test, ob dieses Programm läuft.
// Befehle: 1 OFF, 2 HEART, 3 SMILE, 4 LEFT, 5 RIGHT, 6 UP,
// 7 CHECK, 8 CROSS, 9 SQUARE, 10 DOWN. PING bleibt ein Verbindungstest.
function showSymbol(value: string) {
    if (value == "1") basic.clearScreen()
    else if (value == "2") basic.showIcon(IconNames.Heart)
    else if (value == "3") basic.showIcon(IconNames.Happy)
    else if (value == "4") basic.showArrow(ArrowNames.West)
    else if (value == "5") basic.showArrow(ArrowNames.East)
    else if (value == "6") basic.showArrow(ArrowNames.North)
    else if (value == "7") basic.showIcon(IconNames.Yes)
    else if (value == "8") basic.showIcon(IconNames.No)
    else if (value == "9") basic.showIcon(IconNames.Square)
    else if (value == "10") basic.showArrow(ArrowNames.South)
}
function known(value: string): boolean {
    return value == "1" || value == "2" || value == "3" || value == "4" || value == "5" || value == "6" || value == "7" || value == "8" || value == "9" || value == "10"
}
function processCommand(value: string, viaBluetooth: boolean) {
    let answer = ""
    if (value == "PING") answer = "PONG"
    else if (known(value)) {
        showSymbol(value)
        answer = "OK:" + value
    }
    if (answer.length > 0) {
        if (viaBluetooth) bluetooth.uartWriteLine(answer)
        else serial.writeLine(answer)
    }
}
serial.redirectToUSB()
serial.setBaudRate(115200)
bluetooth.startUartService()
basic.showIcon(IconNames.SmallSquare)
input.onButtonPressed(Button.A, function () { basic.showIcon(IconNames.Heart) })
input.onButtonPressed(Button.B, function () { basic.showIcon(IconNames.SmallSquare) })
serial.onDataReceived("\n", function () { processCommand(serial.readUntil("\n"), false) })
bluetooth.onUartDataReceived("\n", function () { processCommand(bluetooth.uartReadUntil("\n"), true) })
