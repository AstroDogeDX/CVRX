const dotenv = require('dotenv');
dotenv.config();

const { app, BrowserWindow, Menu } = require('electron');

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
const Updater = require('./updater');


// // Test server
// const WebSocket = require('ws');
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
//         // ipcMain.on('close-socket-server', (_event, closeId, closeServer = null) => {
//         //     if (nuked) return;
//         //     ws.close(closeId, 'test close');
//         //     if (closeServer === true && connected) {
//         //         wss.close();
//         //         connected = false;
//         //     }
//         //     else if(closeServer === false && !connected) {
//         //         nuked = true;
//         //         ConnectTest();
//         //     }
//         // });
//     });
// }
// ConnectTest();

// Remove the menu when the app is packaged
if (app.isPackaged) Menu.setApplicationMenu(null);

// Set the max limit for renderer process to 4092Mb
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4092');

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

    // Load the config
    await Config.Load();

    // Initialize the core and Load the listeners
    const core = new Core(mainWindow, app);

    // and load the index.html of the app.
    await mainWindow.loadFile('client/index.html');

    // Initialize Cache
    Cache.Initialize(mainWindow);

    const activeCredentials = Config.GetActiveCredentials();

    if (activeCredentials) {
        await core.Authenticate(activeCredentials.Username, activeCredentials.AccessKey, true, true);
    }
    else {
        await core.SendToLoginPage();
    }

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
    mainWindow.webContents.on('will-prevent-unload', (event) => {
        log.warn('will-prevent-unload', event);
        // Todo: Does this prevent unloading?
        // const choice = dialog.showMessageBoxSync(mainWindow, {
        //     type: 'question',
        //     buttons: ['Leave', 'Stay'],
        //     title: 'Do you want to leave this site?',
        //     message: 'Changes you made may not be saved.',
        //     defaultId: 0,
        //     cancelId: 1,
        // });
        // const leave = (choice === 0);
        // if (leave) {
        //     event.preventDefault();
        // }
    });
    mainWindow.webContents.on('render-process-gone', (event, detailed) => {
        log.warn('render-process-gone ' + detailed.reason + ', exitCode = ' + detailed.exitCode);
        log.warn('render-process-gone', { event, detailed });
        //  logger.info("!crashed, reason: " + detailed.reason + ", exitCode = " + detailed.exitCode)
        // if (detailed.reason == "crashed"){
        //     // relaunch app
        //     app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) })
        //     app.exit(0)
        // }
    });

    await Updater.Setup(mainWindow);
});

app.on('window-all-closed', () => app.quit());

app.on('will-quit', async () => {
    // This won't be called if the application is quit by a Windows shutdown/logout/restart
    // On quitting let's close our socket if exist
    await CVRWebsocket.DisconnectWebsocket();
});
