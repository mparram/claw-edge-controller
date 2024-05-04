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
});
socket.on("disconnect", () => {
    console.log("io disconnected");
});
socket.on("panic", () => {
    console.log("panic");
    process.exit();
});

board.on("ready", () => {
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
        rpm: 180,
    });
    // y axis
    const yStepper = new Stepper({
        type: Stepper.TYPE.DRIVER,
        stepsPerRev: 200,
        pins: {
            step: 3,
            dir: 6
        },
        rpm: 180,
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
                            moveClaw(yStepper, 100, 0);
                        }, 170);
                    }
                } else if ((control == "ArrowDown") && (endyDown)) {
                    if (yStepperMove >= 0) {
                        yStepperMove = 2;
                        var downInterval = setInterval(() => {
                            if ((!endyDown) || (yStepperMove != 2)) {
                                clearInterval(downInterval);
                            }
                            moveClaw(yStepper, 100, 1);
                        }, 170);
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
                            moveClaw(xStepper, 100, 1);
                        }, 170);
                    }
                } else if ((control == "ArrowRight") && (endxDown)){
                    if (xStepperMove >= 0) {
                        xStepperMove = 2;
                        var rightInterval = setInterval(() => {
                            if ((!endxDown) || (xStepperMove != 2)) {
                                clearInterval(rightInterval);
                            }
                            moveClaw(xStepper, 100, 0);
                        }, 170);
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
                moveClaw(yStepper, 20, 0);
            } else if ((key.name == "down") && (endyDown)) {
                moveClaw(yStepper, 20, 1);
            } else if (key.name == "space") {
                active = false;
                launchClaw(relay);
            } else if ((key.name == "left") && (endxUp)){
                moveClaw(xStepper, 20, 1);
            } else if ((key.name == "right") && (endxDown)){
                moveClaw(xStepper, 20, 0);
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
                                moveClaw(yStepper, 100, 1);
                            }else if (endxUp) {
                                moveClaw(xStepper, 100, 1);
                            } else {
                                setTimeout(() => {
                                    relay.toggle();
                                    active = true;
                                    socket.emit("readytoplay", true);
                                }, 1000);
                                clearInterval(gotohome);
                            }
                        }, 170);
                    }, 200)
                });
            }, 2000);
        });   
    }
    function moveClaw(stepper, steps, direction) {
        if (direction == 1) {
            stepper.rpm(180).ccw();
        }else if (direction == 0) {
            stepper.rpm(180).cw();
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