const WebSocket = require('ws');
const WebSocketAddress = 'wss://api.abinteractive.net/1/users/ws';
// const WebSocketAddress = 'ws://localhost';

const log = require('./logger').GetLogger('API_WS');

const events = require('events');
const utils = require('./utils');
const EventEmitter = new events.EventEmitter();
exports.EventEmitter = EventEmitter;

const MaxReconnectionAttempts = 5;

let currentUsername;
let currentAccessKey;
let socket;
let disconnected = true;

let reconnectAttempts = 0;

const SOCKET_EVENTS = Object.freeze({
    CONNECTED: Symbol(),
    DEAD: Symbol(),
    RECONNECTION_FAILED: Symbol(),
});
exports.SocketEvents = SOCKET_EVENTS;

const RESPONSE_TYPE = Object.freeze({
    MENU_POPUP: 0,
    HUD_MESSAGE: 1,
    ONLINE_FRIENDS: 10,
    INVITES: 15,
    REQUEST_INVITES: 20,
    FRIEND_REQUESTS: 25,
});
exports.ResponseType = RESPONSE_TYPE;
const GetResponseTypeName = (value) => Object.keys(RESPONSE_TYPE).find(key => RESPONSE_TYPE[key] === value);


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

exports.Reconnect = async () => {

    if (socket && socket.connected) {
        EventEmitter.emit(SOCKET_EVENTS.RECONNECTION_FAILED, 'The socket is already connected...');
        return;
    }

    if (!currentUsername || !currentAccessKey) {
        EventEmitter.emit(SOCKET_EVENTS.RECONNECTION_FAILED, 'Missing current credentials... Close the CVRX and try again.');
        return;
    }

    await ConnectWebsocket(currentUsername, currentAccessKey);
};


exports.DisconnectWebsocket = async () => {
    disconnected = true;
    if (socket) {
        await socket.close();
        socket = null;
        log.info('[DisconnectWebsocket] The socket has been closed.');
    }
};


function ConnectWebsocket(username, accessKey) {

    return new Promise((resolve, _reject) => {

        if (socket) {
            log.error('[ConnectWebsocket] The socket was already connected!');
            resolve();
        }

        socket = new WebSocket(WebSocketAddress, {
            perMessageDeflate: false,
            headers: {
                'Username': username,
                'AccessKey': accessKey,
                'User-Agent': utils.GetUserAgent(),
            },
        });

        socket.on('error', async (error) => {
            log.error('[ConnectWebsocket] [onError]', error);
        });

        socket.on('open', () => {
            log.info('[ConnectWebsocket] [onOpen] Opened!');
            disconnected = false;
            reconnectAttempts = 0;
            EventEmitter.emit(SOCKET_EVENTS.CONNECTED);
            resolve();
        });

        socket.on('ping', (data) => {
            log.verbose('[ConnectWebsocket] [onPing] Received Ping', data.toString());
        });
        socket.on('pong', (data) => {
            log.verbose('[ConnectWebsocket] [onPong] Received Pong', data.toString());
        });
        socket.on('redirect', (url, _request) => {
            log.verbose(`[ConnectWebsocket] [onRedirect] Received Redirect Request: ${url}`);
        });
        socket.on('unexpected-response', (request, response) => {
            log.debug(`[ConnectWebsocket] [onUnexpectedResponse] Unexpected Response! Request Code: ${request.code}, Response Code: ${response.code}`);
        });
        socket.on('upgrade', (response) => {
            log.verbose(`[ConnectWebsocket] [onUpgrade] Upgrade: Response Code: ${response.code}`);
        });

        socket.on('close', async (code, reason) => {
            log.warn(`[ConnectWebsocket] [onClose] Closed! Code: ${code}, Reason: ${reason.toString()}`);
            socket = null;
            // Only reconnect if we didn't disconnect ourselves and the close code is one of the following:
            if (!disconnected && (code === 1001 || code === 1005 || code === 1006)) {
                if (reconnectAttempts >= MaxReconnectionAttempts) {
                    log.error(`[ConnectWebsocket] [onClose] Failed to connect to CVR Websocket, attempted ${reconnectAttempts} times!`);
                    EventEmitter.emit(SOCKET_EVENTS.DEAD);
                    return;
                }
                log.info(`[ConnectWebsocket] [onClose] Reconnecting in 5 seconds... Attempt: ${reconnectAttempts + 1}`);
                await Wait5Seconds();
                reconnectAttempts++;
                try {
                    socket = null;
                    disconnected = true;
                    await ConnectWebsocket(currentUsername, currentAccessKey);
                }
                catch (e) {
                    log.error(e);
                }
            }
        });

        socket.on('message', (messageBuffer, isBinary) => {

            // Ignore binary messages, but log them
            if (isBinary) {
                log.warn('[ConnectWebsocket] [onMessage] Received Message in binary...', messageBuffer?.toString());
                return;
            }

            // Attempt to parse json
            try {
                const { responseType, message, data } = JSON.parse(messageBuffer.toString());
                if (Object.values(RESPONSE_TYPE).includes(responseType)) {
                    EventEmitter.emit(responseType, data, message);
                    log.debug(`[ConnectWebsocket] [onMessage] Type: ${GetResponseTypeName(responseType)} (${responseType}), Msg: ${message}`, data);
                }
                else {
                    log.warn(`[ConnectWebsocket] [onMessage] Response type ${responseType} is not mapped! Msg: ${message}`, data);
                }
            } catch (e) {
                log.error(e);
                log.error('[ConnectWebsocket] [onMessage] Failed to parse the base message. This could mean the API changed...', messageBuffer?.toString());
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
        log.error(`[SendRequest] Attempted to send a ${GetRequestName(requestType)} request while the socket was disconnected!`);
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
