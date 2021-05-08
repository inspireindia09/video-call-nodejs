const express = require("express");
const http = require("http");
const app = express();
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
const server = http.createServer(app);
app.listen()
const socket = require("socket.io");
const io = socket(server);

var DbOpration = require("./DbCaller.js");
let config = require("./config.js");

const winston = require("winston");
require("winston-daily-rotate-file");
var path = require("path");
var transports = [];

transports.push(
    new winston.transports.DailyRotateFile({
        name: "file",
        datePattern: "yyyy-MM-DD-HH",
        filename: path.join("LogFiles", "NodeJs.log"),
    })
);
// Logger configuration

const logConfiguration = {
    transports: transports,
};

// Create the logger
const logger = winston.createLogger(logConfiguration);

const users = {}
let userData;
let storeStatus = false;

io.on('connection', socket => {
    socket.on('mobileNumber', mobileNo => {
        const userid = mobileNo;
        console.log('user connected ', mobileNo);
        if (!users[userid]) {
            users[userid] = socket.id
        }
        socket.emit('yourID', userid)
        io.sockets.emit('allUsers', users)

        socket.on('userDetails', data => {
            console.log('userDetails 29', data);
            handleGetFBID(data);
            // console.log('userData',userData);
            io.to(users[userData.userToCall]).emit('callerDetails', data);
            handelSendFirebaseMessageById(data.mobile, 'mayank', data)
        });

        socket.on('disconnect', () => {
            console.log('user disconnected', userid);
            delete users[userid]
        })

        socket.on('storemanagerStatus', data => {
            console.log('storeStatus 40', storeStatus)
            console.log('storeStatusdata 41', data)
            storeStatus = data;
        });

        socket.on('callUser', (data) => {
            console.log('calling user ', data);
            userData = data;
            console.log('storeStatus 48', storeStatus)
            if (!storeStatus) {
                io.to(users[data.userToCall]).emit('hey', { signal: data.signalData, from: data.from })
            }
            else {
                io.to(users[data.from]).emit('mangerStatus', storeStatus)
                io.to(users[data.userToCall]).emit('mangerStatus', storeStatus)
            }
            // io.to(users[data.from]).emit('mangerStatus', storeStatus)
            // io.to(users[data.userToCall]).emit('mangerStatus', storeStatus)
        })

        socket.on('acceptCall', (data) => {
            console.log('accept call', data);
            io.to(users[data.to]).emit('callAccepted', data.signal)
        })

        socket.on('close', (data) => {
            io.to(users[data.to]).emit('close')
        })

        socket.on('rejected', (data) => {
            io.to(users[data.to]).emit('rejected')
        })

        socket.on('partnerOnline', (data1, data2) => {
            io.to(users[userData.from]).emit('callerStatus');
        })

        socket.on('updatedVideo', (data) => {
            console.log('inside updatedVideo')
            io.to(users[data.userToCall]).emit('updatedReciverEnd', data)
        })
    })
})

function handleGetFullDateTimes() {
    var today = new Date();

    var date =
        today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();

    var time =
        today.getHours() +
        ":" +
        today.getMinutes() +
        ":" +
        today.getSeconds() +
        ":" +
        today.getMilliseconds();

    var dateTime = date + " " + time;
    return dateTime;
}


function handleGetFBID(params) {
    var dataParam = {};
    dataParam.ProgramCode = params.programCode;
    dataParam.MobileNo = params.mobile;
    dataParam.StoreCode = params.storeCode;
    if (config.ErrorLog) {
        logger.log({
            message:
                "Time: " +
                handleGetFullDateTimes() +
                ": Request| CallGetCustomerFBIDSP : " +
                JSON.stringify(dataParam),
            level: "info",
        });
    }

    console.log('dataParam',dataParam);

    try {
        DbOpration.handleDbGetCustomerFBIDSPCalling(
            dataParam,
            function (responseData) {
                if (config.ErrorLog) {
                    logger.log({
                        message:
                            "Time: " +
                            handleGetFullDateTimes() +
                            ": Response| CallGetCustomerFBIDSP : " +
                            JSON.stringify(responseData),
                        level: "info",
                    });

                    if (responseData[0]) {
                        handelSendFirebaseMessageById(
                            params.mobile,
                            params.customerName+' is calling in shopster',
                            responseData[0]
                        );
                    }
                }
            }
        );
    } catch (error) {
        if (config.ErrorLog) {
            logger.log({
                message:
                    "Time: " +
                    handleGetFullDateTimes() +
                    ": Request| CallUpdateChatNotificationSP : " +
                    error,
                level: "error",
            });
        }
        console.log(error, "---CallUpdateChatNotificationSP");
    }
}

function handelSendFirebaseMessageById(mobileNo, Message, token) {
    console.log('log at line 188',mobileNo, Message, token)
    for (let i = 0; i < token.length; i++) {
        var custName = "";
        if (token[i].CustomerName) {
            custName = token[i].CustomerName;
        } else {
            custName = "DirectMember";
        }
        if (token[i].FBNID) {
            const data = {
                to: token[i].FBNID,
                collapse_key: "type_a",
                notification: {
                    title: custName + ": " + mobileNo,
                    body: Message || "",
                },
                data: {
                    title: custName + ": " + mobileNo,
                    body: Message || "",
                },
            };
            const dataString = JSON.stringify(data);
            var headerKey = "";
            if (token[i].DeviceSource) {
                if (token[i].DeviceSource.toLowerCase() == "android".toLowerCase()) {
                    headerKey = "key=" + config.fireBaseServerkey_Android;
                } else {
                    headerKey = "key=" + config.fireBaseServerkey_IOS;
                }
            } else {
                return false;
            }

            const headers = {
                Authorization: headerKey,
                "Content-Type": "application/json",
                "Content-Length": dataString.length,
            };

            const options = {
                uri: "https://fcm.googleapis.com/fcm/send",
                method: "POST",
                headers: headers,
                json: data,
            };

            const request = require("request");

            request(options, function (err, res, body) {
                console.log('err 235',err)
                if (err) throw err;
                else console.log(body);
            });
        }
    }
} 

const port = process.env.PORT || 3000

server.listen(port, () => {
    console.log(`Server running on port ${port}`)
})