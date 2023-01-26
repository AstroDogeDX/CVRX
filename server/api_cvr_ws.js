const util = require('util');

const WebSocket = require('ws');
const WebSocketAddress = "wss://api.abinteractive.net/1/users/ws";
//const WebSocketAddress = "ws://localhost";

const events = require('events');
const EventEmitter = new events.EventEmitter();
exports.EventEmitter = EventEmitter;

let socket;


const RESPONSE_TYPE = Object.freeze({
    ONLINE_FRIENDS: 10,
    INVITES: 15,
    REQUEST_INVITES: 20,
    FRIEND_REQUESTS: 25,
});
exports.ResponseType = RESPONSE_TYPE;


function LogRequestResponse(res) {
    console.log(`\tCode: ${res.statusCode}`);
    console.log(`\tHeaders: ${util.inspect(res.headers, {showHidden: false, depth: null, colors: true})}`);
}


exports.DisconnectWebsocket = async () => {
    if (socket) {
        await socket.close();
        socket = null;
        console.info('The socket has been closed.');
    }
};




exports.ConnectWebsocket = async () => {

    return new Promise((resolve, _reject) => {

        if (socket) {
            console.error('The socket was already connected!');
            resolve();
        }

        socket = new WebSocket(WebSocketAddress, {
            perMessageDeflate: false,
            headers: {
                'Username': process.env.CVR_USERNAME,
                'AccessKey': process.env.CVR_ACCESS_KEY,
            },
        });

        socket.on('error', (error) => {
            console.error(error);
            throw new Error(error);
        });

        socket.on('open', function open() {
            console.log(`\n[Socket] Opened!`);
            resolve();
        });

        if (process.env.DEBUG_ALL_WS === 'true') {
            socket.on('ping', function ping(data) {
                console.log(`\n\n[Socket] Received Ping: ${data.toString()}`);
            });
            socket.on('pong', function pong(data) {
                console.log(`\n\n[Socket] Received Pong: ${data.toString()}`);
            });
            socket.on('redirect', function redirect(url, request) {
                console.log(`\n\n[Socket] Received Redirect Request: ${url}`);
                LogRequestResponse(request);
            });
            socket.on('unexpected-response', function unexpectedResponse(request, response) {
                console.log(`\n\n[Socket] Unexpected Response!`);
                console.log(`\t[Request]`);
                LogRequestResponse(request);
                console.log(`\n\t[Response]`);
                LogRequestResponse(response);
            });
            socket.on('upgrade', function upgrade(response) {
                console.log(`\n\n[Socket] Upgrade: \n${response}`);
                LogRequestResponse(response);
            });
        }

        socket.on('close', function close(code, reason) {
            console.log(`\n[Socket] Closed! Code: ${code}, Reason: ${reason.toString()}`);
        });

        socket.on('message', function message(messageBuffer, isBinary) {
            console.log(`\n[Socket] Received Message! isBinary: ${isBinary}, Data:`);
            if (process.env.LOG_WS_MESSAGES === 'true') console.log(util.inspect(messageBuffer.toString(), {showHidden: false, depth: null, colors: true}));

            // Attempt to parse json
            try {
                const { responseType, message, data } = JSON.parse(messageBuffer.toString());
                if (Object.values(RESPONSE_TYPE).includes(responseType)) {
                    EventEmitter.emit(responseType, data);
                }
                else {
                    console.warn(`Response type ${responseType} is not mapped! Msg: ${message}`);
                }
            } catch (e) {
                console.error(e);
                console.error('Failed to parse the base message. This could mean the API changed...');
            }
        });
    });
};
