/**
 * Teachable Labor: USB serial and Bluetooth UART share one line protocol.
 */
//% color="#7B24C9" block="Teachable Labor" weight=100
namespace teachableLabor {
    let started = false
    let running = 0
    let waiting = 0
    const numbers: number[] = []
    const actions: (() => void)[] = []

    function register(number: number, handler: () => void): void {
        numbers.push(number)
        actions.push(handler)
        start()
    }

    function schedule(number: number): void {
        if (running != 0) {
            waiting = number == running ? 0 : number
            return
        }
        running = number
        control.inBackground(function () {
            while (running != 0) {
                for (let i = 0; i < numbers.length; i++) {
                    if (numbers[i] == running) actions[i]()
                }
                running = waiting
                waiting = 0
            }
        })
    }

    function receive(line: string, wireless: boolean): void {
        if (line.length > 0 && line.charAt(line.length - 1) == "\r") {
            line = line.substr(0, line.length - 1)
        }
        let number = 0
        let reply = "PONG"
        if (line != "PING") {
            for (let i = 1; i <= 10; i++) {
                if (line == "" + i) number = i
            }
            if (number == 0) return
            reply = "OK:" + line
        }
        if (wireless) bluetooth.uartWriteString(reply + "\n")
        else serial.writeString(reply + "\n")
        if (number != 0) schedule(number)
    }

    //% blockHidden=true
    export function start(): void {
        if (started) return
        started = true
        serial.redirectToUSB()
        serial.setBaudRate(115200)
        serial.onDataReceived("\n", function () {
            receive(serial.readUntil("\n"), false)
        })
        bluetooth.startUartService()
        bluetooth.onUartDataReceived("\n", function () {
            receive(bluetooth.uartReadUntil("\n"), true)
        })
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

    start()
}
