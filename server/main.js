const dotenv = require('dotenv');
dotenv.config();

const { app, BrowserWindow } = require('electron');

// Prevent app launching multiple times during the installation
if (require('electron-squirrel-startup')) {
    app.quit();
    return;
}

// Prevent a second instance!
if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
}

const log = require('./logger').GetLogger('Main');


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
//         ws.on('error', (err) => log.error('[TestServer] [onError]', err));
//         ws.on('message', (data) => {
//             log.info('[TestServer] Received:', data);
//         });
//         ws.send(JSON.stringify( { responseType: -1, message: 'You have connected!', data: null }));
//         log.info('[TestServer] Headers:', request.headers);
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


const CreateWindow = async () => {

    log.info(`Starting CVRX... Version: ${app.getVersion()}`);

    // Create the browser window.
    const mainWindow = new BrowserWindow({
        minWidth: 800,
        minHeight: 600,
        width: 1280,
        height: 720,
        icon: './client/img/cvrx-ico.ico',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            devTools: !app.isPackaged,
        },
    });

    // Remove the menu in the packaged version
    if (app.isPackaged) mainWindow.removeMenu();

    // Load the config
    await Config.Load();
    await Config.ImportCVRCredentials();

    let activeCredentials = Config.GetActiveCredentials();
    log.info(`[CreateWindow] Fetching active user, found: ${activeCredentials?.Username}`);

    if (!activeCredentials) {
        log.info('[CreateWindow] No active user found, attempting to fetch credentials...');

        const autoLoginCredentials = Config.GetAutoLoginCredentials();
        log.info(`[CreateWindow] Looking for auto login credentials, found: ${autoLoginCredentials.Username}`);

        log.info(`[CreateWindow] [SetActiveCredentials] Activating credentials for: ${autoLoginCredentials.Username}`);
        await Config.SetActiveCredentials(autoLoginCredentials.Username);
    }

    activeCredentials = Config.GetActiveCredentials();
    log.info(`Authenticating with the username: ${activeCredentials.Username}`);

    // Initialize the core and Load the listeners
    const core = new Core(mainWindow);

    // and load the index.html of the app.
    await mainWindow.loadFile('client/index.html');

    // Initialize Cache
    Cache.Initialize(mainWindow);

    // And now we can do our stuff
    await core.Initialize(activeCredentials.Username, activeCredentials.AccessKey);

    return mainWindow;
};

app.whenReady().then(async () => {
    const mainWindow = await CreateWindow();
    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
    app.on('activate', () => {
        // On macOS, it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            CreateWindow();
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
