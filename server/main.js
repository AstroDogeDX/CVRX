const dotenv = require('dotenv');
dotenv.config();

const { app, BrowserWindow } = require('electron');

// Prevent app launching multiple times
if (require('electron-squirrel-startup')) return;

const path = require('path');

const Config = require('./config');
const { Core } = require('./data');
const CVRWebsocket = require('./api_cvr_ws');
const Cache = require('./cache');


// // Test server
// const WebSocket = require('ws');
// const util = require('util');
// function ConnectTest() {
//     let connected = false;
//     let nuked = false;
//     const wss = new WebSocket.WebSocketServer({ port: 80 });
//     wss.on('connection', (ws, request) => {
//         connected = true;
//         ws.on('error', console.error);
//         ws.on('message', (data) => {
//             console.log('received: %s', data);
//         });
//         ws.send(JSON.stringify( { responseType: -1, message: 'You have connected!', data: null }));
//         console.log('\n\n\n[Server] Headers:');
//         console.log(`${util.inspect(request.headers, {showHidden: false, depth: null, colors: true})}`);
//         ipcMain.on('close-socket-server', (_event, closeId, closeServer = null) => {
//             if (nuked) return;
//             ws.close(closeId, 'test close');
//             if (closeServer === true && connected) {
//                 wss.close();
//                 connected = false;
//             }
//             else if(closeServer === false && !connected) {
//                 nuked = true;
//                 ConnectTest();
//             }
//         });
//     });
// }
// ConnectTest();


const createWindow = async () => {

    // Create the browser window.
    const mainWindow = new BrowserWindow({
        minWidth: 800,
        minHeight: 600,
        width: 1280,
        height: 720,
        icon: './client/img/cvrx-ico.ico',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Load the config
    await Config.Load();
    await Config.ImportCVRCredentials();

    let activeCredentials = Config.GetActiveCredentials();
    // console.log(`\nActive Credentials:`);
    // console.log(util.inspect(activeCredentials, {showHidden: false, depth: null, colors: true}));

    // const availableCredentials = Config.GetAvailableCredentials();
    // console.log(`\nAvailable Credentials:`);
    // console.log(util.inspect(availableCredentials, {showHidden: false, depth: null, colors: true}));

    if (!activeCredentials) {

        const autoLoginCredentials = Config.GetAutoLoginCredentials();
        // console.log(`\nAuto Login Credentials:`);
        // console.log(util.inspect(autoLoginCredentials, {showHidden: false, depth: null, colors: true}));

        // console.log(`\nActivating credential: ${autoLoginCredentials.Username}`);
        await Config.SetActiveCredentials(autoLoginCredentials.Username);
    }

    activeCredentials = Config.GetActiveCredentials();
    console.log('Logging with: ' + activeCredentials.Username);

    // console.log(`\nActive Credentials:`);
    // console.log(util.inspect(activeCredentials, {showHidden: false, depth: null, colors: true}));

    // Initialize the core and Load the listeners
    const core = new Core(mainWindow);

    // and load the index.html of the app.
    await mainWindow.loadFile('client/index.html');

    // Initialize Cache
    Cache.Initialize(mainWindow);

    // And now we can do our stuff
    await core.Initialize(activeCredentials.Username, activeCredentials.AccessKey);
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
