const dotenv = require('dotenv');
dotenv.config();

const { app, BrowserWindow, Menu, ipcMain, nativeImage, Tray } = require('electron');

app.setAppUserModelId('com.squirrel.CVRX.CVRX');

// Prevent app launching multiple times during the installation
if (require('electron-squirrel-startup')) {
    app.quit();
    return;
}

const { existsSync } = require('fs');

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
const NotificationManager = require('./notification-manager');
const NotificationHelper = require('./notification-helper');

// Is what platform
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const isLinux = process.platform ==='linux';

// Remove the menu when the app is packaged
if (app.isPackaged) Menu.setApplicationMenu(null);

//determine window icon
const iconFile = isWindows ? 'cvrx-ico.ico' : 'cvrx-logo-512.png' //linux appinage fails to load .ico files

// Set the max limit for renderer process to 4092Mb
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4092');

// Store reference to main window for access in IPC handlers
let mainWindow = null;

const CreateWindow = async () => {
    log.info(`Starting CVRX... Version: ${app.getVersion()}`);

    // Create the browser window.
    mainWindow = new BrowserWindow({
        minWidth: 1320,
        minHeight: 820,
        width: 1460,
        height: 840,
        icon: path.resolve(app.getAppPath(), "client", "img", iconFile),
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
        await core.Authenticate(
            activeCredentials.Username,
            activeCredentials.AccessKey,
            true,
            true,
        );
    } else {
        await core.SendToLoginPage();
    }

    return mainWindow;
};


const BuildTray = async (mainWindow) => {

    // Skip tray on non-tested OS since it might crash the app
    if (!isWindows && !isMac && !isLinux)
        return;
    
    // Pick which icon to use
    const trayIcon = isMac
        ? path.resolve(app.getAppPath(), "client", "img", "cvrx-tray-mac.png")
        : path.resolve(app.getAppPath(), "client", "img", "cvrx-logo-1028.png")
    
    // Prevent app from crashing by not initializing the tray
    if (!existsSync(trayIcon)) {
        log.error(`Icon file does not exist at path: ${trayIcon}. Skipping initializing tray icon`);
        return;
    }

    log.info(`Building tray. Using icon from: ${trayIcon}`);

    const nativeIconImg = nativeImage.createFromPath(trayIcon);

    // Pick the correct resolution for each platform
    const resizeConfig = {width: 32, height: isMac ? 16 : 32};

    const resizedTrayImg = nativeIconImg.resize(resizeConfig);

    // Mark as template (on macOS makes it respect dark mode, requires white image)
    resizedTrayImg.isMacTemplateImage = true;

    // Set the tray icon
    const tray = new Tray(resizedTrayImg);

    // Add tooltip to tray icon for clarity
    tray.setToolTip('CVRX');

    // Set the tray menu functionality
    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: 'Show CVRX',
                click: function () {
                    mainWindow.show();
                },
            },
            {
                label: 'Exit CVRX',
                click: function () {
                    // We use destroy here to skip emitting the close event
                    // Source: https://www.electronjs.org/docs/latest/api/browser-window#windestroy
                    mainWindow.destroy();
                },
            },
        ]),
    );
    tray.on('double-click', () => {
        mainWindow.show();
    });
};

app.whenReady().then(async () => {
    await CreateWindow();

    await BuildTray(mainWindow, app);

    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.

        log.info('Received a second instance event... ');

        // Show if it's hidden (tray) or minimized
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.show();
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

    // Override default close event to close to taskbar instead
    mainWindow.on('close', (event) => {

        log.info('Received a close event...');

        // Check if we're in the middle of an update installation
        // If so, allow the app to quit properly regardless of tray settings
        if (Updater.IsInstallingUpdate()) {
            log.info('Update installation in progress, allowing app to quit properly...');
            return; // Don't prevent default action, let the app quit
        }

        // Prevent default action
        event.preventDefault();

        let minimizeNotification = {
            title: 'CVRX',
            body: 'CVRX is still running in the System Tray',
        };

        // Check if we should close to taskbar
        if (Config.GetCloseToSystemTray()) {
            mainWindow.hide();
            NotificationHelper.showMinimizeNotification();
        } else {
            mainWindow.destroy();
        }
    });

    await Updater.Setup(mainWindow);
});

app.on('ready', () => {
    let appVersion = app.getVersion();
    // Send version info to renderer process
    ipcMain.on('get-app-version', (event) => {
        event.sender.send('app-version', appVersion);
    });

    // Custom notification system IPC handlers
    ipcMain.handle('custom-notification-show', async (event, notificationData) => {
        try {
            const window = await NotificationManager.showNotification(notificationData);
            return { success: true, windowId: window ? window.id : null };
        } catch (error) {
            log.error('Failed to show custom notification:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('custom-notification-close-all', async (event) => {
        try {
            NotificationManager.closeAllNotifications();
            return { success: true };
        } catch (error) {
            log.error('Failed to close all notifications:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('custom-notification-get-count', async (event) => {
        try {
            return {
                success: true,
                active: NotificationManager.getActiveNotificationCount(),
                queued: NotificationManager.getQueuedNotificationCount()
            };
        } catch (error) {
            log.error('Failed to get notification count:', error);
            return { success: false, error: error.message };
        }
    });

    // Handle notification window events
    ipcMain.on('notification-close', (event) => {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                NotificationManager.closeNotification(window);
            }
        } catch (error) {
            log.error('Failed to handle notification close:', error);
        }
    });

    ipcMain.on('notification-mouse-enter', (event) => {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                NotificationManager.handleMouseEnter(window);
            }
        } catch (error) {
            log.error('Failed to handle notification mouse enter:', error);
        }
    });

    ipcMain.on('notification-mouse-leave', (event) => {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                NotificationManager.handleMouseLeave(window);
            }
        } catch (error) {
            log.error('Failed to handle notification mouse leave:', error);
        }
    });

    ipcMain.on('notification-click', (event, actionData) => {
        try {
            log.info('Notification clicked:', actionData);
            
            // Bring CVRX window to front when notification is clicked
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
            }
        } catch (error) {
            log.error('Failed to handle notification click:', error);
        }
    });

    ipcMain.on('notification-action', (event, actionType, actionData) => {
        try {
            log.info('Notification action performed:', { actionType, actionData });
            
            // Handle specific notification actions
            switch (actionType) {
                case 'join-desktop':
                case 'join-vr':
                    if (actionData.instanceId) {
                        const isVR = actionType === 'join-vr';
                        
                        // Generate join link similar to frontend logic  
                        let formattedInstanceId = actionData.instanceId;
                        if (!actionData.instanceId.startsWith('i+')) {
                            formattedInstanceId = `i+${actionData.instanceId}`;
                        }
                        
                        const baseUrl = 'chilloutvr://instance/join';
                        const params = new URLSearchParams({
                            instanceId: formattedInstanceId,
                            startInVR: isVR.toString()
                        });
                        
                        const deepLink = `${baseUrl}?${params.toString()}`;
                        
                        // Open the deep link
                        require('electron').shell.openExternal(deepLink);
                        log.info(`[NotificationAction] Opened join link: ${deepLink}`);
                    }
                    break;
                    
                case 'download-update':
                    if (actionData.version) {
                        // Dismiss the update prompt in the main window to avoid UI conflicts
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('dismiss-update-prompt');
                        }
                        
                        // Trigger update download
                        Updater.HandleUpdateAction('download', actionData);
                        log.info(`[NotificationAction] Started download for version ${actionData.version}`);
                    }
                    break;
                    
                case 'dismiss-update':
                case 'later':
                    // Treat notification "Later" as "Ignore Until Restart" from main UI
                    if (actionData.tagName) {
                        // Dismiss the update prompt in the main window
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('dismiss-update-prompt');
                        }
                        
                        // Call the ignore action (same as "Ignore Until Restart")
                        Updater.HandleUpdateAction('ignore', actionData);
                        log.info(`[NotificationAction] Ignored update ${actionData.tagName} until restart`);
                    }
                    break;
                    
                default:
                    log.info(`[NotificationAction] Unhandled action type: ${actionType}`);
                    break;
            }
        } catch (error) {
            log.error('Failed to handle notification action:', error);
        }
    });

    // Forward notification window logs to main logging system
    ipcMain.on('notification-log-debug', (event, message, data) => {
        log.debug(message, data);
    });
    ipcMain.on('notification-log-info', (event, message, data) => {
        log.info(message, data);
    });
    ipcMain.on('notification-log-warn', (event, message, data) => {
        log.warn(message, data);
    });
    ipcMain.on('notification-log-error', (event, message, data) => {
        log.error(message, data);
    });
});

app.on('window-all-closed', () => app.quit());

app.on('will-quit', async () => {
    // This won't be called if the application is quit by a Windows shutdown/logout/restart
    
    // Close all custom notifications
    try {
        NotificationManager.closeAllNotifications();
        log.info('All custom notifications closed');
    } catch (error) {
        log.error('Failed to close custom notifications:', error);
    }
    
    // On quitting let's close our socket if exist
    await CVRWebsocket.DisconnectWebsocket(
        true,
        'The CVRX Application is closing...',
    );
});
