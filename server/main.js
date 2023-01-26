const dotenv = require("dotenv");
dotenv.config();

const { app, BrowserWindow } = require('electron');
const path = require('path');

const { Core } = require('./data');

const CVRHttp = require('./api_cvr_http');
const CVRWebsocket = require('./api_cvr_ws');


// // Test server
// const WebSocket = require('ws');
// const util = require('util');
// const wss = new WebSocket.WebSocketServer({ port: 80 });
// wss.on('connection', function connection(ws, request) {
//     ws.on('error', console.error);
//     ws.on('message', function message(data) {
//         console.log('received: %s', data);
//     });
//     ws.send(JSON.stringify( { responseType: -1, message: "You have connected!", data: null }));
//     console.log(`\n\n\n[Server] Headers:`);
//     console.log(`${util.inspect(request.headers, {showHidden: false, depth: null, colors: true})}`);
// });


const createWindow = async () => {

    // Create the browser window.
    const mainWindow = new BrowserWindow({
        minWidth: 800,
        minHeight: 600,
        width: 1280,
        height: 720,
        icon: './client/img/ico.ico',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    // and load the index.html of the app.
    await mainWindow.loadFile('index.html');
    // And now we can do our stuff
    const core = new Core(mainWindow);

    // Fetch and update the friends
    if (process.env.HTTP_REQUESTS === 'true') core.updateFriendsInfo(await CVRHttp.GetMyFriends());

    // Add listener for friends state updates
    CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.ONLINE_FRIENDS, core.updateFriendsInfo.bind(core));

    // Initialize the websocket
    if (process.env.CONNECT_TO_SOCKET === 'true') await CVRWebsocket.ConnectWebsocket();
};

app.whenReady().then(async () => {
    await createWindow();
    app.on('activate', () => {
        // On macOS, it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', async () => {
    // This won't be called if the application is quit by a Windows shutdown/logout/restart
    // On quitting let's close our socket if exist
    await CVRWebsocket.DisconnectWebsocket();
});
