// Kameralabor – ein Programm für USB (Windows) und Bluetooth-UART (iPad).
// Taste A zeigt ohne App ein Herz: schneller Test, ob dieses Programm läuft.
function showSymbol(value: string) {
    if (value == "OFF") basic.clearScreen()
    else if (value == "HEART") basic.showIcon(IconNames.Heart)
    else if (value == "SMILE") basic.showIcon(IconNames.Happy)
    else if (value == "LEFT") basic.showArrow(ArrowNames.West)
    else if (value == "RIGHT") basic.showArrow(ArrowNames.East)
    else if (value == "UP") basic.showArrow(ArrowNames.North)
    else if (value == "DOWN") basic.showArrow(ArrowNames.South)
    else if (value == "CHECK") basic.showIcon(IconNames.Yes)
    else if (value == "CROSS") basic.showIcon(IconNames.No)
    else if (value == "SQUARE") basic.showIcon(IconNames.Square)
}
function known(value: string): boolean {
    return value == "OFF" || value == "HEART" || value == "SMILE" || value == "LEFT" || value == "RIGHT" || value == "UP" || value == "DOWN" || value == "CHECK" || value == "CROSS" || value == "SQUARE"
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
