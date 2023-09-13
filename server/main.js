const dotenv = require("dotenv");
dotenv.config();

const { app, BrowserWindow, Menu, ipcMain, Tray } = require("electron");

// Prevent app launching multiple times during the installation
if (require("electron-squirrel-startup")) {
	app.quit();
	return;
}

// Prevent a second instance!
if (!app.requestSingleInstanceLock()) {
	app.quit();
	return;
}

const log = require("./logger").GetLogger("Main");

const path = require("path");

const Config = require("./config");
const { Core } = require("./data");
const CVRWebsocket = require("./api_cvr_ws");
const Cache = require("./cache");
const Updater = require("./updater");

// Remove the menu when the app is packaged
if (app.isPackaged) Menu.setApplicationMenu(null);

// Set the max limit for renderer process to 4092Mb
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=4092");

// Temporary setting for close to taskbar feature
const closeToTaskbar = true;

const CreateWindow = async () => {
	log.info(`Starting CVRX... Version: ${app.getVersion()}`);

	// Create the browser window.
	const mainWindow = new BrowserWindow({
		minWidth: 800,
		minHeight: 600,
		width: 1280,
		height: 720,
		icon: "./client/img/cvrx-ico.ico",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			devTools: !app.isPackaged,
		},
	});

	// Load the config
	await Config.Load();

	// Initialize the core and Load the listeners
	const core = new Core(mainWindow, app);

	// and load the index.html of the app.
	await mainWindow.loadFile("client/index.html");

	// Initialize Cache
	Cache.Initialize(mainWindow);

	const activeCredentials = Config.GetActiveCredentials();

	if (activeCredentials) {
		await core.Authenticate(
			activeCredentials.Username,
			activeCredentials.AccessKey,
			true,
			true
		);
	} else {
		await core.SendToLoginPage();
	}

	return mainWindow;
};

// Function returns the built tray object.
const BuildTray = async (mainWindow) => {
	log.info(`Building tray`);

	// Set the tray icon
	let tray = new Tray("./client/img/cvrx-ico.ico");

	// Setup the tray menu functionality
	tray.setContextMenu(
		Menu.buildFromTemplate([
			{
				label: "Show CVRX",
				click: function () {
					mainWindow.show();
				},
			},
			{
				label: "Exit CVRX",
				click: function () {
					isQuitting = true;
					// We use destroy here to skip emitting the close event
					// Source: https://www.electronjs.org/docs/latest/api/browser-window#windestroy
					mainWindow.destroy();
				},
			},
		])
	);
};

app.whenReady().then(async () => {
	const mainWindow = await CreateWindow();
	// Build tray menu
	let tray = await BuildTray(mainWindow, app);

	app.on("second-instance", () => {
		// Someone tried to run a second instance, we should focus our window.
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
	});
	app.on("activate", () => {
		// On macOS, it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			CreateWindow();
		}
	});
	mainWindow.webContents.on("will-prevent-unload", (event) => {
		log.warn("will-prevent-unload", event);
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
	mainWindow.webContents.on("render-process-gone", (event, detailed) => {
		log.warn(
			"render-process-gone " +
				detailed.reason +
				", exitCode = " +
				detailed.exitCode
		);
		log.warn("render-process-gone", { event, detailed });
		//  logger.info("!crashed, reason: " + detailed.reason + ", exitCode = " + detailed.exitCode)
		// if (detailed.reason == "crashed"){
		//     // relaunch app
		//     app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) })
		//     app.exit(0)
		// }
	});

	// Override default close event to close to taskbar instead
	mainWindow.on("close", (event, detailed) => {
		// Prevent default action
		event.preventDefault();

		// Check if we should close to taskbar
		if (closeToTaskbar) {
			mainWindow.hide();
		} else {
			mainWindow.destroy();
		}
	});

	await Updater.Setup(mainWindow);
});

app.on("ready", () => {
	let appVersion = app.getVersion();
	// Send version info to renderer process
	ipcMain.on("get-app-version", (event) => {
		event.sender.send("app-version", appVersion);
	});
});

app.on("window-all-closed", () => app.quit());

app.on("will-quit", async () => {
	// This won't be called if the application is quit by a Windows shutdown/logout/restart
	// On quitting let's close our socket if exist
	await CVRWebsocket.DisconnectWebsocket(
		true,
		"The CVRX Application is closing..."
	);
});
