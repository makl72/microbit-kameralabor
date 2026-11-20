/**
 * Teachable Labor
 * Die App sendet die Zahlen 1 bis 10.
 * USB-Serial, Bluetooth-UART, PING/PONG und OK-Bestaetigungen bleiben
 * in dieser Erweiterung verborgen. Im Schuelerprojekt sind nur die
 * zehn Ereignisbloecke sichtbar.
 */

//% color="#7B24C9" block="Teachable Labor" weight=100
namespace teachableLabor {
    const EVENT_SOURCE = 9100
    let started = false

    function commandNumber(value: string): number {
        if (value == "1") return 1
        if (value == "2") return 2
        if (value == "3") return 3
        if (value == "4") return 4
        if (value == "5") return 5
        if (value == "6") return 6
        if (value == "7") return 7
        if (value == "8") return 8
        if (value == "9") return 9
        if (value == "10") return 10
        return 0
    }

    function processCommand(value: string, viaBluetooth: boolean): void {
        if (value == "PING") {
            if (viaBluetooth) bluetooth.uartWriteLine("PONG")
            else serial.writeLine("PONG")
            return
        }

        const number = commandNumber(value)
        if (number == 0) return

        const answer = "OK:" + value
        if (viaBluetooth) bluetooth.uartWriteLine(answer)
        else serial.writeLine(answer)

        control.raiseEvent(EVENT_SOURCE, number)
    }

    function startCommunication(): void {
        if (started) return
        started = true

        serial.redirectToUSB()
        serial.setBaudRate(115200)
        bluetooth.startUartService()

        serial.onDataReceived("\n", function () {
            processCommand(serial.readUntil("\n"), false)
        })
        bluetooth.onUartDataReceived("\n", function () {
            processCommand(bluetooth.uartReadUntil("\n"), true)
        })
    }

    function register(number: number, handler: () => void): void {
        startCommunication()
        control.onEvent(EVENT_SOURCE, number, handler)
    }

    /**
     * Startet die Kommunikation. Wird vom Schülerprojekt unsichtbar aufgerufen.
     */
    //% blockHidden=true
    export function start(): void {
        startCommunication()
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 1 sendet.
     */
    //% blockId=teachable_labor_on_1 block="wenn Zahl 1 empfangen"
    //% weight=100
    export function on1(handler: () => void): void {
        register(1, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 2 sendet.
     */
    //% blockId=teachable_labor_on_2 block="wenn Zahl 2 empfangen"
    //% weight=99
    export function on2(handler: () => void): void {
        register(2, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 3 sendet.
     */
    //% blockId=teachable_labor_on_3 block="wenn Zahl 3 empfangen"
    //% weight=98
    export function on3(handler: () => void): void {
        register(3, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 4 sendet.
     */
    //% blockId=teachable_labor_on_4 block="wenn Zahl 4 empfangen"
    //% weight=97
    export function on4(handler: () => void): void {
        register(4, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 5 sendet.
     */
    //% blockId=teachable_labor_on_5 block="wenn Zahl 5 empfangen"
    //% weight=96
    export function on5(handler: () => void): void {
        register(5, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 6 sendet.
     */
    //% blockId=teachable_labor_on_6 block="wenn Zahl 6 empfangen"
    //% weight=95
    export function on6(handler: () => void): void {
        register(6, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 7 sendet.
     */
    //% blockId=teachable_labor_on_7 block="wenn Zahl 7 empfangen"
    //% weight=94
    export function on7(handler: () => void): void {
        register(7, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 8 sendet.
     */
    //% blockId=teachable_labor_on_8 block="wenn Zahl 8 empfangen"
    //% weight=93
    export function on8(handler: () => void): void {
        register(8, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 9 sendet.
     */
    //% blockId=teachable_labor_on_9 block="wenn Zahl 9 empfangen"
    //% weight=92
    export function on9(handler: () => void): void {
        register(9, handler)
    }

    /**
     * Fuehrt die eingefuegten Bloecke aus, wenn die App Zahl 10 sendet.
     */
    //% blockId=teachable_labor_on_10 block="wenn Zahl 10 empfangen"
    //% weight=91
    export function on10(handler: () => void): void {
        register(10, handler)
    }

    // Kommunikation startet automatisch, ohne sichtbaren Block im Schülerprojekt.
    startCommunication()
}
