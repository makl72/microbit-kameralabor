// Kameralabor: USB unter Windows, Bluetooth-UART auf dem iPad.
// Die App sendet 1 bis 10. Taste A zeigt zum Test das Muster für 2.
function known(value: string): boolean {
    return value == "1" || value == "2" || value == "3" || value == "4" || value == "5" || value == "6" || value == "7" || value == "8" || value == "9" || value == "10"
}

function showSymbol(value: string) {
    if (value == "1") basic.showLeds(`
        . . . . .
        . . . . .
        . . # . .
        . . . . .
        . . . . .
        `, 0)
    else if (value == "2") basic.showLeds(`
        . . . . .
        . # . . .
        . . . . .
        . . . # .
        . . . . .
        `, 0)
    else if (value == "3") basic.showLeds(`
        . . . . .
        . . . # .
        . . # . .
        . # . . .
        . . . . .
        `, 0)
    else if (value == "4") basic.showLeds(`
        . . . . .
        . # . # .
        . . . . .
        . # . # .
        . . . . .
        `, 0)
    else if (value == "5") basic.showLeds(`
        . . . . .
        . # . # .
        . . # . .
        . # . # .
        . . . . .
        `, 0)
    else if (value == "6") basic.showLeds(`
        . . . . .
        . # . # .
        . # . # .
        . # . # .
        . . . . .
        `, 0)
    else if (value == "7") basic.showLeds(`
        . . . . .
        . # . # .
        . # . # .
        . # # # .
        . . . . .
        `, 0)
    else if (value == "8") basic.showLeds(`
        . . . . .
        . # . # .
        . # # # .
        . # # # .
        . . . . .
        `, 0)
    else if (value == "9") basic.showLeds(`
        . . . . .
        . # # # .
        . # # # .
        . # # # .
        . . . . .
        `, 0)
    else if (value == "10") basic.showLeds(`
        . . # . .
        . # # # .
        . # # # .
        . # # # .
        . . . . .
        `, 0)
}

function processCommand(value: string, viaBluetooth: boolean) {
    let answer = ""
    if (value == "PING") answer = "PONG"
    else if (known(value)) answer = "OK:" + value
    if (answer == "") return
    // Erst antworten, dann LEDs zeichnen.
    if (viaBluetooth) bluetooth.uartWriteLine(answer)
    else serial.writeLine(answer)
    if (value != "PING") showSymbol(value)
}
serial.redirectToUSB()
serial.setBaudRate(115200)
bluetooth.startUartService()
basic.showIcon(IconNames.Giraffe)
input.onButtonPressed(Button.A, function () { showSymbol("2") })
input.onButtonPressed(Button.B, function () { basic.showIcon(IconNames.Giraffe) })
serial.onDataReceived("\n", function () { processCommand(serial.readUntil("\n"), false) })
bluetooth.onUartDataReceived("\n", function () { processCommand(bluetooth.uartReadUntil("\n"), true) })
