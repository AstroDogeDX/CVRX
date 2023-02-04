const util = require('util');

const WebSocket = require('ws');
const WebSocketAddress = 'wss://api.abinteractive.net/1/users/ws';
// const WebSocketAddress = 'ws://localhost';

const events = require('events');
const { app, dialog } = require('electron');
const EventEmitter = new events.EventEmitter();
exports.EventEmitter = EventEmitter;

const MaxReconnectionAttempts = 5;

let currentUsername;
let currentAccessKey;
let socket;

let reconnectAttempts = 0;

const RESPONSE_TYPE = Object.freeze({
    MENU_POPUP: 0,
    HUD_MESSAGE: 1,
    ONLINE_FRIENDS: 10,
    INVITES: 15,
    REQUEST_INVITES: 20,
    FRIEND_REQUESTS: 25,
});
exports.ResponseType = RESPONSE_TYPE;


function Wait5Seconds() {
    return new Promise((resolve) => {
        setTimeout(resolve, 5000);
    });
}

exports.ConnectWithCredentials = async (username, accessKey) => {

    // If we have a socket connected and the credentials changed, lets nuke it
    if ((username !== currentUsername || accessKey !== currentAccessKey) && socket) {
        await exports.DisconnectWebsocket();
    }

    currentUsername = username;
    currentAccessKey = accessKey;

    await ConnectWebsocket(username, accessKey);
};


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


async function ConnectWebsocket(username, accessKey) {

    return new Promise((resolve, _reject) => {

        if (socket) {
            console.error('The socket was already connected!');
            resolve();
        }

        socket = new WebSocket(WebSocketAddress, {
            perMessageDeflate: false,
            headers: {
                'Username': username,
                'AccessKey': accessKey,
            },
        });

        socket.on('error', async (error) => {
            console.error(error);
            // try {
            //     await dialog.showErrorBox(
            //         'Failed to CVR Socket Server',
            //         error.toString(),
            //     );
            // }
            // catch (e) {
            //     console.error(e);
            // }
            //throw new Error(`[Socket] Error while trying to connect to the socket! ${error}`);
        });

        socket.on('open', () => {
            console.log('\n[Socket] Opened!');
            reconnectAttempts = 0;
            resolve();
        });

        if (process.env.DEBUG_ALL_WS === 'true') {
            socket.on('ping', (data) => {
                console.log(`\n\n[Socket] Received Ping: ${data.toString()}`);
            });
            socket.on('pong', (data) => {
                console.log(`\n\n[Socket] Received Pong: ${data.toString()}`);
            });
            socket.on('redirect', (url, request) => {
                console.log(`\n\n[Socket] Received Redirect Request: ${url}`);
                LogRequestResponse(request);
            });
            socket.on('unexpected-response', (request, response) => {
                console.log('\n\n[Socket] Unexpected Response!');
                console.log('\t[Request]');
                LogRequestResponse(request);
                console.log('\n\t[Response]');
                LogRequestResponse(response);
            });
            socket.on('upgrade', (response) => {
                console.log(`\n\n[Socket] Upgrade: \n${response}`);
                LogRequestResponse(response);
            });
        }

        socket.on('close', async (code, reason) => {
            console.log(`\n[Socket] Closed! Code: ${code}, Reason: ${reason.toString()}`);
            socket = null;
            if (code === 1001 || code === 1005 || code === 1006) {
                if (reconnectAttempts >= MaxReconnectionAttempts) {
                    try {
                        await dialog.showErrorBox(
                            'Failed to reconnect to CVR Servers...',
                            'Our 5 attempts to connect/reconnect to CVR Socket failed. The app will close!',
                        );
                    }
                    catch (e) {
                        console.error(e);
                    }
                    app.quit();
                    throw new Error('[Socket] Failed to connect to CVR Websocket, attempted 5 times!');
                }
                console.log(`\n[Socket] Reconnecting in 5 seconds... Attempt: ${reconnectAttempts + 1}`);
                await Wait5Seconds();
                reconnectAttempts++;
                try {
                    await ConnectWebsocket(currentUsername, currentAccessKey);
                }
                catch (e) {
                    console.error(e);
                }
            }
        });

        socket.on('message', (messageBuffer, isBinary) => {
            console.log(`\n[Socket] Received Message! isBinary: ${isBinary}, Data:`);
            if (process.env.LOG_WS_MESSAGES === 'true') console.log(util.inspect(messageBuffer.toString(), {showHidden: false, depth: null, colors: true}));

            // Attempt to parse json
            try {
                const { responseType, message, data } = JSON.parse(messageBuffer.toString());
                if (Object.values(RESPONSE_TYPE).includes(responseType)) {
                    EventEmitter.emit(responseType, data, message);
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
}

const RequestType = Object.freeze({
    FRIEND_REQUEST_SEND: 5,
    FRIEND_REQUEST_ACCEPT: 6,
    FRIEND_REQUEST_DECLINE: 7,
    UNFRIEND: 8,
    BLOCK_USER: 30,
    UNBLOCK_USER: 31,
});
const GetRequestName = (value) => Object.keys(RequestType).find(key => RequestType[key] === value);

async function SendRequest(requestType, data) {
    if (!socket) {
        console.error(`Attempted to send a ${GetRequestName(requestType)} request while the socket was disconnected!`);
        return;
    }
    // Prepare the request json and send
    await socket.send(JSON.stringify({
        RequestType: requestType,
        Data: data,
    }));
}

// Friendship
exports.SendFriendRequest = async (userId) => await SendRequest(RequestType.FRIEND_REQUEST_SEND, {id: userId});
exports.AcceptFriendRequest = async (userId) => await SendRequest(RequestType.FRIEND_REQUEST_ACCEPT, {id: userId});
exports.DeclineFriendRequest = async (userId) => await SendRequest(RequestType.FRIEND_REQUEST_DECLINE, {id: userId});
exports.Unfriend = async (userId) => await SendRequest(RequestType.UNFRIEND, {id: userId});

// Moderation
exports.BlockUser = async (userId) => await SendRequest(RequestType.BLOCK_USER, {id: userId});
exports.UnblockUser = async (userId) => await SendRequest(RequestType.UNBLOCK_USER, {id: userId});
