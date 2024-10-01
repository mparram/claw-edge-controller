const {Board, Stepper, Relay, Switch} = require("johnny-five");

const board = new Board({
    repl: false
});

const readline = require('readline');
// import socket.io-client
var wsport = process.env.WS_PORT || 8080;
var connectorsvc = process.env.CONNECTOR_SVC || "edge-ws-connector.edge-ws-connector.svc.cluster.local";
const { io } = require('socket.io-client');
var inAction = [];

const socket = io("http://" + connectorsvc + ":" + wsport, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity
}); 
socket.on("connect", () => {
    socket.emit("component", "hw01");
    console.log("io connected");
});
socket.on("disconnect", () => {
    console.log("io disconnected");
});
socket.on("panic", () => {
    console.log("panic");
    process.exit();
});

board.on("ready", () => {
    console.log("board ready");
    //I2C color sensor
    board.i2cConfig();
    const ADDRESS = 0x29;
    const COMMAND_BIT = 0x80;
    const ENABLE_REGISTER = 0x00;
    const ATIME_REGISTER = 0x01; // 700 ms - 256-Cycles
    const CONTROL_REGISTER = 0x0F;
    const CDATAL_REGISTER = 0x14;
    // Enable the device (Power On and ADC Enable)
    board.i2cWriteReg(ADDRESS, COMMAND_BIT | ENABLE_REGISTER, 0x03);
    // Set integration time to 154 ms
    board.i2cWriteReg(ADDRESS, COMMAND_BIT | ATIME_REGISTER, 0xD5);
    // Set gain to 4x
    board.i2cWriteReg(ADDRESS, COMMAND_BIT | CONTROL_REGISTER, 0x02);
  


    var relaylight = new Relay(23);
    var inactiveTime = 600000;
    var inactiveTimeout = setTimeout(() => {
        relaylight.open();
    }, inactiveTime);
    socket.on("user_on", (status) => {
        if (status){
            console.log("user_on status: " + status);
            relaylight.close();
            //reiniciar el timeout
            clearTimeout(inactiveTimeout);
            inactiveTimeout = setTimeout(() => {
                relaylight.open();
            }, inactiveTime);
        } else {
            console.log("user_on status: " + status);
            relaylight.open();
        }
    });


    const endx0 = new Switch(49);
    const endx1 = new Switch(51);
    const endy0 = new Switch(53);
    const endy1 = new Switch(47);
    var endxDown = true;
    var endxUp = true;
    var endyDown = true;
    var endyUp = true;
    endx0.on("close", () => endxUp = true);
    endx0.on("open", () => endxUp = false);
    endx1.on("close", () => endxDown = false);
    endx1.on("open", () => endxDown = true);
    endy0.on("close", () => endyUp = false);
    endy0.on("open", () => endyUp = true);
    endy1.on("close", () => endyDown = true);
    endy1.on("open", () => endyDown = false);
    var relay = new Relay(25);
    // x axis
    const xStepper = new Stepper({
        type: Stepper.TYPE.DRIVER,
        stepsPerRev: 200,
        pins: {
            step: 2,
            dir: 5
        },
        rpm: 2880,
    });
    // y axis
    const yStepper = new Stepper({
        type: Stepper.TYPE.DRIVER,
        stepsPerRev: 200,
        pins: {
            step: 3,
            dir: 6
        },
        rpm: 2880,
    });
    // z axis
    const zStepper = new Stepper({
        type: Stepper.TYPE.DRIVER,
        stepsPerRev: 200,
        pins: {
            step: 4,
            dir: 7
        },
        rpm: 180,
    });
    let xStepperMove = 0;
    let yStepperMove = 0;
    let zStepperMove = 0;
    zStepper.rpm(180).ccw();
    zStepper.step(800, () => {
        socket.on("control", (control, act) => {
            console.log("control: " + control + " act: " + act + " xStepperMove: " + xStepperMove + " yStepperMove: " + yStepperMove + " endxUp: " + endxUp + " endxDown: " + endxDown + " endyUp: " + endyUp + " endyDown: " + endyDown);
            if (act == "down") {
                if ((control == "ArrowUp") && (endyUp)) {
                    if (yStepperMove >= 0) {
                        yStepperMove = 1;
                        var upInterval = setInterval(() => {
                            if ((!endyUp) || (yStepperMove != 1)) {
                                clearInterval(upInterval);
                            }
                            moveClaw(yStepper, 400, 0);
                        }, 87);
                    }
                } else if ((control == "ArrowDown") && (endyDown)) {
                    if (yStepperMove >= 0) {
                        yStepperMove = 2;
                        var downInterval = setInterval(() => {
                            if ((!endyDown) || (yStepperMove != 2)) {
                                clearInterval(downInterval);
                            }
                            moveClaw(yStepper, 400, 1);
                        }, 87);
                    }
                } else if (control == "Space") {
                    console.log("space");
                    active = false;
                    launchClaw(relay);
                } else if ((control == "ArrowLeft") && (endxUp)) {
                    if (xStepperMove >= 0) {
                        xStepperMove = 1;
                        var leftInterval = setInterval(() => {
                            if ((!endxUp) || (xStepperMove != 1)) {
                                clearInterval(leftInterval);
                            }
                            moveClaw(xStepper, 400, 1);
                        }, 87);
                    }
                } else if ((control == "ArrowRight") && (endxDown)){
                    if (xStepperMove >= 0) {
                        xStepperMove = 2;
                        var rightInterval = setInterval(() => {
                            if ((!endxDown) || (xStepperMove != 2)) {
                                clearInterval(rightInterval);
                            }
                            moveClaw(xStepper, 400, 0);
                        }, 87);
                    }
                }
            } else if (act == "up") {
                if ((control == "ArrowUp") && (yStepperMove == 1)) {
                    yStepperMove = 0;
                    stopClaw(yStepper, 0);
                    
                } else if ((control == "ArrowDown") && (yStepperMove == 2)) {
                    yStepperMove = 0;
                    stopClaw(yStepper, 1);
                } else if ((control == "ArrowLeft") && (xStepperMove == 1)) {
                    xStepperMove = 0;
                    stopClaw(xStepper, 1);
                } else if ((control == "ArrowRight") && (xStepperMove == 2)){
                    xStepperMove = 0;
                    stopClaw(xStepper, 0);
                }
            }
        });
        //DEBUG KEYBOARD
        process.stdin.on('keypress', (str, key) => {
            if (key && key.ctrl && key.name == 'c') process.exit();
            if ((key.name == "up") && (!endyUp)){
                moveClaw(yStepper, 400, 0);
            } else if ((key.name == "down") && (endyDown)) {
                moveClaw(yStepper, 400, 1);
            } else if (key.name == "space") {
                active = false;
                launchClaw(relay);
            } else if ((key.name == "left") && (endxUp)){
                moveClaw(xStepper, 400, 1);
            } else if ((key.name == "right") && (endxDown)){
                moveClaw(xStepper, 400, 0);
            }
        })
    });
    function launchClaw(relay) {
        clearTimeout(inactiveTimeout);
        inactiveTimeout = setTimeout(() => {
            relaylight.open();
        }, inactiveTime);
        zStepper.rpm(180).cw();
        console.log("launching claw");
        socket.emit("endgame", "launch claw");
        socket.emit("readytoplay", false);
         zStepper.step({
            steps: 769
        }, () => {
            setTimeout(() => {
                relay.toggle();
            }, 500);
            console.log("launched claw");
            setTimeout(() => {
                console.log("uploading claw");
                zStepper.step({
                    steps: 769,
                    direction: Stepper.DIRECTION.CCW
                }, () => {
                    console.log("uploaded claw");
                    setTimeout(() => {
                        var gotohome = setInterval(() => {
                            if (endyDown) {
                                moveClaw(yStepper, 400, 1);
                            }else if (endxUp) {
                                moveClaw(xStepper, 400, 1);
                            } else {
                                const colors = [
                                    // need to adjust the colors
                                    { name: "orange", r: 1625, g: 926, b: 682, c: 3432},
                                    { name: "orange", r: 2307, g: 1164, b: 856, c: 4504},
                                    { name: "orange", r: 3146, g: 1510, b: 1054, c: 6007},
                                    { name: "orange", r: 1190, g: 657, b: 503, c: 2445},
                                    { name: "orange", r: 2009, g: 1016, b: 749, c: 3956},
                                    { name: "orange", r: 761, g: 450, b: 359, c: 1596},
                                    { name: "orange", r: 1617, g: 851, b: 637, c: 3226},
                                    { name: "orange", r: 1470, g: 866, b: 633, c: 3089},
                                    { name: "orange", r: 1663, g: 990, b: 728, c: 3525},
                                    { name: "green", r: 456, g: 761, b: 541, c: 1890},
                                    { name: "green", r: 561, g: 1113, b: 708, c: 2506},
                                    { name: "green", r: 595, g: 1229, b: 755, c: 2744},
                                    { name: "green", r: 728, g: 1394, b: 1086, c: 3402},
                                    { name: "green", r: 867, g: 2031, b: 1194, c: 4484},
                                    { name: "green", r: 358, g: 626, b: 445, c: 1479},
                                    { name: "green", r: 561, g: 1084, b: 728, c: 2500},
                                    { name: "green", r: 976, g: 2126, b: 1268, c: 4767},
                                    { name: "green", r: 909, g: 1861, b: 1125, c: 4185},
                                    { name: "blue", r: 522, g: 1027, b: 1172, c: 2831},
                                    { name: "blue", r: 493, g: 958, b: 1091, c: 2637},
                                    { name: "blue", r: 335, g: 575, b: 624, c: 1572},
                                    { name: "blue", r: 330, g: 637, b: 723, c: 1770},
                                    { name: "blue", r: 679, g: 1326, b: 1492, c: 3674},
                                    { name: "blue", r: 577, g: 1357, b: 1611, c: 3809},
                                    { name: "blue", r: 315, g: 545, b: 598, c: 1490},
                                    { name: "blue", r: 607, g: 1242, b: 1429, c: 3441},
                                    { name: "blue", r: 634, g: 1172, b: 1286, c: 3288},
                                    { name: "blue", r: 307, g: 505, b: 538, c: 1379},
                                    { name: "blue", r: 496, g: 937, b: 1049, c: 2593},
                                    { name: "blue", r: 457, g: 817, b: 888, c: 2282},
                                    { name: "blue", r: 1002, g: 2065, b: 2279, c: 5730},
                                    { name: "blue", r: 976, g: 2126, b: 1268, c: 4767},
                                    { name: "blue", r: 909, g: 1861, b: 1125, c: 4185},
                                    { name: "yellow", r: 575, g: 571, b: 364, c: 1545},
                                    { name: "yellow", r: 1223, g: 1056, b: 536, c: 2946},
                                    { name: "yellow", r: 1832, g: 1679, b: 793, c: 4607},
                                    { name: "yellow", r: 904, g: 816, b: 432, c: 2238},
                                    { name: "yellow", r: 1351, g: 1256, b: 665, c: 3433},
                                    { name: "yellow", r: 655, g: 623, b: 373, c: 1714},
                                    { name: "yellow", r: 1734, g: 1588, b: 790, c: 4396},
                                    { name: "yellow", r: 1472, g: 1330, b: 688, c: 3682},
                                    { name: "yellow", r: 1906, g: 1770, b: 888, c: 4871},
                                    { name: "yellow", r: 738, g: 697, b: 404, c: 1913},
                                    { name: "yellow", r: 1433, g: 1316, b: 673, c: 3635},
                                    { name: "yellow", r: 860, g: 863, b: 647, c: 2516},
                                    { name: "yellow", r: 1058, g: 934, b: 523, c: 2642},
                                    { name: "yellow", r: 2304, g: 2130, b: 1023, c: 5885},
                                    { name: "yellow", r: 2490, g: 2193, b: 1044, c: 6105},
                                    { name: "yellow", r: 2509, g: 2209, b: 1051, c: 6154},
                                    { name: "yellow", r: 2567, g: 2442, b: 1135, c: 6732},
                                    { name: "yellow", r: 1173, g: 1066, b: 537, c: 2929},
                                    { name: "yellow", r: 1938, g: 1968, b: 925, c: 5329}
                                ];
                                let minDistance = 100;
                                let closestColor = "empty";
                                setTimeout(() => {
                                    // Read color with TCS34725 RGB sensor 
                                    board.i2cReadOnce(ADDRESS, COMMAND_BIT | CDATAL_REGISTER, 8, function(bytes) {
                                        var c = bytes[1] << 8 | bytes[0];
                                        var r = bytes[3] << 8 | bytes[2];
                                        var g = bytes[5] << 8 | bytes[4];
                                        var b = bytes[7] << 8 | bytes[6];
                                        if (c > 1100) {
                                            for (let color of colors) {
                                                const distance = Math.sqrt(Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2) + Math.pow((c/10) - (color.c/10), 2));
                                                console.log("color: " + color.name + " distance: " + distance + " minDistance: " + minDistance);
                                                if (distance < minDistance) {
                                                    minDistance = distance;
                                                    closestColor = color.name;
                                                }
                                            }
                                        }
                                        console.log("color: " + closestColor);
                                        console.log("R: " + r + " G: " + g + " B: " + b + " C: " + c);
                                    });
                                    setTimeout(() => {
                                        if (closestColor == "empty") {
                                            board.i2cReadOnce(ADDRESS, COMMAND_BIT | CDATAL_REGISTER, 8, function(bytes) {
                                                var c = bytes[1] << 8 | bytes[0];
                                                var r = bytes[3] << 8 | bytes[2];
                                                var g = bytes[5] << 8 | bytes[4];
                                                var b = bytes[7] << 8 | bytes[6];
                                                if (c > 1100) {
                                                    for (let color of colors) {
                                                        const distance = Math.sqrt(Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2) + Math.pow((c/10) - (color.c/10), 2));
                                                        console.log("color: " + color.name + " distance: " + distance + " minDistance: " + minDistance);
                                                        if (distance < minDistance) {
                                                            minDistance = distance;
                                                            closestColor = color.name;
                                                        }
                                                    }
                                                }
                                                console.log("color: " + closestColor);
                                                socket.emit("color", closestColor);
                                                console.log("R: " + r + " G: " + g + " B: " + b + " C: " + c);
                                            });
                                        } else {
                                            socket.emit("color", closestColor);
                                        }
                                        relay.toggle();
                                        active = true;
                                        socket.emit("readytoplay", true);
                                    }, 500);
                                },1000);
                                clearInterval(gotohome);
                            }
                        }, 87);
                    }, 200)
                });
            }, 2000);
        });   
    }
    function moveClaw(stepper, steps, direction) {
        if (direction == 1) {
            stepper.rpm(2880).ccw();
        }else if (direction == 0) {
            stepper.rpm(2880).cw();
        }
        stepper.step({
            steps: steps,
            accel: 0,
            decel: 0
        }, () => {
        });
    }
    function stopClaw(stepper, direction) {
        stepper.rpm(0).step({
            steps: 0
        }, () => {
        });
    }
});