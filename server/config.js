const fs = require('fs');
const path = require('path');
const XML = require('xml2js');
const { app, dialog } = require('electron');

const log = require('./logger').GetLogger('Config');

const AppDataPath = app.getPath('userData');
const ConfigsPath = path.join(AppDataPath, 'CVRConfigs');
const ConfigFileName = 'config.json';
const ConfigCredentialsFileName = 'credentials.json';

const FileVersion = 1;

const CVRExecutableDefaultFolderPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ChilloutVR';
const CVRExecutableName = 'ChilloutVR.exe';
const CVRDataFolderName = 'ChilloutVR_Data';

const FileType = Object.freeze({
    CONFIG: 'CONFIG',
    CREDENTIALS: 'CREDENTIALS',
});


let config;
let credentials;


const GetCVRPath = () => path.dirname(config.CVRExecutable);
const GetCVRAppdataPath = () => path.join(GetCVRPath(), CVRDataFolderName);


function MergeDefaultConfig(config, defaultConfig) {
    for (let key in defaultConfig) {
        if(Object.prototype.hasOwnProperty.call(defaultConfig, key)) {

            if (typeof defaultConfig[key] === 'object' && defaultConfig[key] !== null) {
                if(Object.prototype.hasOwnProperty.call(config, key)) {
                    MergeDefaultConfig(config[key], defaultConfig[key]);
                }
                else {
                    config[key] = defaultConfig[key];
                }
            }
            else {
                if(!Object.prototype.hasOwnProperty.call(config, key)) {
                    config[key] = defaultConfig[key];
                }
            }
        }
    }
}


exports.Load = async () => {

    // Load the config file
    const defaultObjectConfig = {
        ActiveUsername: null,
        ActiveUserID: null,
        CacheMaxSizeInMegabytes: 1000,
        CloseToSystemTray: false,
        ThumbnailShape: 'hexagonal',
        OnlineFriendsThumbnailShape: 'rounded',
        CVRExecutable: path.join(CVRExecutableDefaultFolderPath, CVRExecutableName),
        UpdaterIgnoreVersion: null,
        RecentActivityMaxCount: 25,
        ShowFriendNotifications: true,
        FriendNotificationsList: {},
        ShowInviteNotifications: true,
        ShowInviteRequestNotifications: true,
        UseCustomNotifications: true,
        CustomNotificationTimeout: 5000,
        CustomNotificationMaxCount: 5,
        CustomNotificationCorner: 'bottom-right',
        NotificationSoundsEnabled: true,
    };
    config = await GetOrCreateJsonFile(ConfigsPath, ConfigFileName, defaultObjectConfig);
    MergeDefaultConfig(config, defaultObjectConfig);

    // Load the credentials file
    credentials = await GetOrCreateJsonFile(ConfigsPath, ConfigCredentialsFileName, {});
};

async function UpdateJsonFile(fileType) {

    switch (fileType) {
        case FileType.CONFIG:
            await WriteToJsonFile(ConfigsPath, ConfigFileName, config);
            break;
        case FileType.CREDENTIALS:
            await WriteToJsonFile(ConfigsPath, ConfigCredentialsFileName, credentials);
            break;
        default:
            log.error(`[UpdateJsonFile] Attempted to Update a file of type ${fileType}, but that type is not supported!`);
    }
}

async function WriteToJsonFile(folderPath, fileName, data = {}) {
    const objectToWrite = { FileVersion: FileVersion, data: data };
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(path.join(folderPath, fileName), JSON.stringify(objectToWrite, null, 4), 'utf8');
}

async function GetOrCreateJsonFile(folderPath, fileName, defaultObject = {}) {

    const filePath = path.join(folderPath, fileName);
    if (!fs.existsSync(filePath)) {
        // Create the file, using the default object as a start
        await WriteToJsonFile(folderPath, fileName, defaultObject);
    }

    // Get and parse the json file
    try {
        const fileContents = await fs.promises.readFile(filePath, 'utf8');
        const parsedFile = JSON.parse(fileContents);
        return parsedFile.data;
    }
    catch (err) {
        // If we fail to read the config, let's reset the config file (needs improvement)
        log.error('[GetOrCreateJsonFile] Failed to read the config file!', err.toString(), err.message?.toString());
        log.info('[GetOrCreateJsonFile] Generating a new one, using the default config...');
        await WriteToJsonFile(folderPath, fileName, defaultObject);
        const fileContents = await fs.promises.readFile(filePath, 'utf8');
        const parsedFile = JSON.parse(fileContents);
        return parsedFile.data;
    }
}


exports.ImportCVRCredentials = async () => {

    let cvrDataFolder = GetCVRAppdataPath();

    log.debug(`Looking in the ${cvrDataFolder} for the auto profiles.`);

    // If the ChilloutVR.exe doesn't exist means we got our path wrong!
    if (!fs.existsSync(cvrDataFolder)) {

        log.info('[ImportCVRCredentials] CVR folder not found... Prompting for the CVR Executable!');

        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: `Find the ${CVRExecutableName}, so we know where the CVR folder is!`,
            message: `Find the ${CVRExecutableName}, so we know where the CVR folder is!`,
            defaultPath: path.join(CVRExecutableDefaultFolderPath, CVRExecutableName),
            filters: [{ name: 'ChilloutVR', extensions: ['exe'] }],
            properties: ['openFile'],
        });

        // User canceled the dialog ;_;
        if (canceled) {
            const err = `Canceled the dialog where it's asking for the path to ${CVRExecutableName}`;
            log.error(`[ImportCVRCredentials] ${err}`);
            await dialog.showErrorBox(
                'Credentials Error',
                'Currently CVRX can only authenticate using the autologin.profile files from CVR.\nSo we ' +
                'need a valid path to it.\nThe application will close since you didn\'t point us to the ' +
                `${CVRExecutableName} file...`,
            );
            throw new Error(err);
        }

        // User actually provided a file!
        else {
            const providedPath = filePaths[0];
            // Check if the user provided the path to ChilloutVR.exe and not something else
            if (path.basename(providedPath) !== CVRExecutableName) {
                const err = `Provided ${providedPath} as a path for ${CVRExecutableName}`;
                log.error(`[ImportCVRCredentials] ${err}`);
                await dialog.showErrorBox(
                    'Credentials Error',
                    `You pointed to a ${path.basename(providedPath)} file, we need ${CVRExecutableName}...`,
                );
                throw new Error(err);
            }

            // The user actually provided the ChilloutVR.exe path!!!
            config.CVRExecutable = providedPath;
            await UpdateJsonFile(FileType.CONFIG);
            // Update the executable path
            cvrDataFolder = GetCVRAppdataPath();
        }
    }

    const fileNames = await fs.promises.readdir(cvrDataFolder);

    let updated = false;
    for (const fileName of fileNames) {

        // We're only looking for the auto login files!
        if (!fileName.startsWith('autologin') || !fileName.endsWith('.profile')) continue;

        const filePath = path.join(cvrDataFolder, fileName);
        const fileContents = await fs.promises.readFile(filePath);
        const autoProfile = await XML.parseStringPromise(fileContents);
        const username = autoProfile?.LoginProfile?.Username?.[0];
        const accessKey = autoProfile?.LoginProfile?.AccessKey?.[0];
        if (username && accessKey) {
            log.debug(`[ImportCVRCredentials] Found credentials for ${username}!`);
            updated = true;
            await exports.SaveCredential(username, accessKey);
        }
    }

    // Update the credential file if we actually added something
    if (updated) await UpdateJsonFile(FileType.CREDENTIALS);
};

exports.GetAvailableCredentials = () => JSON.parse(JSON.stringify(Object.values(credentials)));

exports.GetActiveCredentials = () => credentials?.[config?.ActiveUsername];

exports.SaveCredential = async (username, accessKey) => {
    if (username && accessKey) {
        credentials[username] ??= {};
        credentials[username].Username = username;
        credentials[username].AccessKey = accessKey;
        await UpdateJsonFile(FileType.CREDENTIALS);
    }
    else {
        log.error('[SaveCredential] Attempted to save credentials, but either the username or access key were null/empty.');
    }
};

exports.SetActiveUserImage = async (imageUrl) => {
    if (!imageUrl || !(config.ActiveUsername in credentials)) return;
    credentials[config.ActiveUsername].ImageUrl = imageUrl;
    await UpdateJsonFile(FileType.CREDENTIALS);
};

exports.SetActiveCredentials = async (username, userID) => {
    if (!credentials?.[username]) {
        const err = `[SetActiveCredentials] There are no credentials for the user ${username}!`;
        log.error(err);
        throw new Error(err);
    }
    config.ActiveUsername = username;
    config.ActiveUserID = userID;
    await UpdateJsonFile(FileType.CONFIG);
};

exports.ClearActiveCredentials = async () => {
    config.ActiveUsername = null;
    config.ActiveUserID = null;
    await UpdateJsonFile(FileType.CONFIG);
};

exports.ClearCredentials = async (username) => {
    if (config.ActiveUsername === username) {
        await exports.ClearActiveCredentials();
    }
    delete credentials[username];
    await UpdateJsonFile(FileType.CREDENTIALS);
};

exports.UpdateConfig = async (newConfigSettings) => {

    log.info('[UpdateConfig] Attempting to update the config', newConfigSettings);

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'CacheMaxSizeInMegabytes')) {
        const cacheSize = newConfigSettings.CacheMaxSizeInMegabytes;

        if (!Number.isInteger(cacheSize) || cacheSize < 500 || cacheSize > 2000) {
            throw new Error('[UpdateConfig] CacheMaxSizeInMegabytes should be an integer between 500 and 2000.');
        }

        config.CacheMaxSizeInMegabytes = cacheSize;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'CloseToSystemTray')) {
        const closeToTray = newConfigSettings.CloseToSystemTray;

        if (typeof closeToTray !== 'boolean') {
            throw new Error('[UpdateConfig] CloseToSystemTray should be a boolean value.');
        }

        config.CloseToSystemTray = closeToTray;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'ThumbnailShape')) {
        const thumbnailShape = newConfigSettings.ThumbnailShape;
        const validShapes = ['hexagonal', 'square', 'rounded', 'circle'];

        if (typeof thumbnailShape !== 'string' || !validShapes.includes(thumbnailShape)) {
            throw new Error('[UpdateConfig] ThumbnailShape should be one of: hexagonal, square, rounded, circle.');
        }

        config.ThumbnailShape = thumbnailShape;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'OnlineFriendsThumbnailShape')) {
        const onlineFriendsThumbnailShape = newConfigSettings.OnlineFriendsThumbnailShape;
        const validShapes = ['hexagonal', 'square', 'rounded', 'circle'];

        if (typeof onlineFriendsThumbnailShape !== 'string' || !validShapes.includes(onlineFriendsThumbnailShape)) {
            throw new Error('[UpdateConfig] OnlineFriendsThumbnailShape should be one of: hexagonal, square, rounded, circle.');
        }

        config.OnlineFriendsThumbnailShape = onlineFriendsThumbnailShape;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'CVRExecutable')) {
        const cvrExecutable = newConfigSettings.CVRExecutable;

        if (typeof cvrExecutable !== 'string' || cvrExecutable.trim() === '') {
            throw new Error('[UpdateConfig] CVRExecutable should be a non-empty string path.');
        }

        // Validate that the path ends with ChilloutVR.exe
        if (path.basename(cvrExecutable) !== CVRExecutableName) {
            throw new Error(`[UpdateConfig] CVRExecutable should point to ${CVRExecutableName}.`);
        }

        // Validate that the file exists
        if (!fs.existsSync(cvrExecutable)) {
            throw new Error('[UpdateConfig] CVRExecutable path does not exist.');
        }

        config.CVRExecutable = cvrExecutable;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'RecentActivityMaxCount')) {
        const maxCount = newConfigSettings.RecentActivityMaxCount;
        const validCounts = [25, 50, 75, 100, 500, 1000];

        if (!Number.isInteger(maxCount) || !validCounts.includes(maxCount)) {
            throw new Error('[UpdateConfig] RecentActivityMaxCount should be one of: 25, 50, 75, 100.');
        }

        config.RecentActivityMaxCount = maxCount;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'ShowFriendNotifications')) {
        const enabled = newConfigSettings.ShowFriendNotifications;

        if (typeof enabled !== 'boolean') {
            throw new Error('[UpdateConfig] ShowFriendNotifications should be a boolean value.');
        }

        config.ShowFriendNotifications = enabled;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'FriendNotificationsList')) {
        const friendsList = newConfigSettings.FriendNotificationsList;

        if (typeof friendsList !== 'object' || friendsList === null || Array.isArray(friendsList)) {
            throw new Error('[UpdateConfig] FriendNotificationsList should be an object.');
        }

        config.FriendNotificationsList = friendsList;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'ShowInviteNotifications')) {
        const enabled = newConfigSettings.ShowInviteNotifications;

        if (typeof enabled !== 'boolean') {
            throw new Error('[UpdateConfig] ShowInviteNotifications should be a boolean value.');
        }

        config.ShowInviteNotifications = enabled;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'ShowInviteRequestNotifications')) {
        const enabled = newConfigSettings.ShowInviteRequestNotifications;

        if (typeof enabled !== 'boolean') {
            throw new Error('[UpdateConfig] ShowInviteRequestNotifications should be a boolean value.');
        }

        config.ShowInviteRequestNotifications = enabled;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'UseCustomNotifications')) {
        const enabled = newConfigSettings.UseCustomNotifications;

        if (typeof enabled !== 'boolean') {
            throw new Error('[UpdateConfig] UseCustomNotifications should be a boolean value.');
        }

        config.UseCustomNotifications = enabled;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'CustomNotificationTimeout')) {
        const timeout = newConfigSettings.CustomNotificationTimeout;

        if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30000) {
            throw new Error('[UpdateConfig] CustomNotificationTimeout should be an integer between 1000 and 30000 milliseconds.');
        }

        config.CustomNotificationTimeout = timeout;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'CustomNotificationMaxCount')) {
        const maxCount = newConfigSettings.CustomNotificationMaxCount;

        if (!Number.isInteger(maxCount) || maxCount < 1 || maxCount > 10) {
            throw new Error('[UpdateConfig] CustomNotificationMaxCount should be an integer between 1 and 10.');
        }

        config.CustomNotificationMaxCount = maxCount;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'CustomNotificationCorner')) {
        const corner = newConfigSettings.CustomNotificationCorner;
        const validCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

        if (typeof corner !== 'string' || !validCorners.includes(corner)) {
            throw new Error('[UpdateConfig] CustomNotificationCorner should be one of: top-left, top-right, bottom-left, bottom-right.');
        }

        config.CustomNotificationCorner = corner;
    }

    if (Object.prototype.hasOwnProperty.call(newConfigSettings, 'NotificationSoundsEnabled')) {
        const enabled = newConfigSettings.NotificationSoundsEnabled;

        if (typeof enabled !== 'boolean') {
            throw new Error('[UpdateConfig] NotificationSoundsEnabled should be a boolean value.');
        }

        config.NotificationSoundsEnabled = enabled;
    }

    await UpdateJsonFile(FileType.CONFIG);

    return exports.GetConfig();
};


exports.GetConfig = () => ({
    CacheMaxSizeInMegabytes: config.CacheMaxSizeInMegabytes,
    CloseToSystemTray: config.CloseToSystemTray,
    ThumbnailShape: config.ThumbnailShape,
    OnlineFriendsThumbnailShape: config.OnlineFriendsThumbnailShape,
    CVRExecutable: config.CVRExecutable,
    RecentActivityMaxCount: config.RecentActivityMaxCount,
    ShowFriendNotifications: config.ShowFriendNotifications,
    FriendNotificationsList: config.FriendNotificationsList,
    ShowInviteNotifications: config.ShowInviteNotifications,
    ShowInviteRequestNotifications: config.ShowInviteRequestNotifications,
    UseCustomNotifications: config.UseCustomNotifications,
    CustomNotificationTimeout: config.CustomNotificationTimeout,
    CustomNotificationMaxCount: config.CustomNotificationMaxCount,
    CustomNotificationCorner: config.CustomNotificationCorner,
    NotificationSoundsEnabled: config.NotificationSoundsEnabled,
});


exports.GetMaxCacheSize = () => config.CacheMaxSizeInMegabytes;

exports.GetCloseToSystemTray = () => config.CloseToSystemTray;

exports.GetCVRPath = GetCVRPath;

exports.GetRecentActivityMaxCount = () => config.RecentActivityMaxCount;

exports.GetFriendNotificationsEnabled = () => config.ShowFriendNotifications;

exports.GetFriendNotificationsList = () => config.FriendNotificationsList;

exports.SetFriendNotificationForUser = async (userId, enabled) => {
    if (enabled) {
        config.FriendNotificationsList[userId] = true;
    } else {
        delete config.FriendNotificationsList[userId];
    }
    await UpdateJsonFile(FileType.CONFIG);
};

exports.IsFriendNotificationEnabled = (userId) => {
    const globalEnabled = config.ShowFriendNotifications;
    const userEnabled = config.FriendNotificationsList[userId] === true;
    const result = globalEnabled && userEnabled;
    
    log.info(`[IsFriendNotificationEnabled] Checking for userId: ${userId}`);
    log.info(`[IsFriendNotificationEnabled] Global notifications enabled: ${globalEnabled}`);
    log.info(`[IsFriendNotificationEnabled] User in notification list: ${userEnabled}`);
    log.info(`[IsFriendNotificationEnabled] Result: ${result}`);
    log.info(`[IsFriendNotificationEnabled] Full notification list: ${JSON.stringify(config.FriendNotificationsList)}`);
    
    return result;
};

exports.GetInviteNotificationsEnabled = () => config.ShowInviteNotifications;

exports.GetInviteRequestNotificationsEnabled = () => config.ShowInviteRequestNotifications;

exports.GetCustomNotificationsEnabled = () => config.UseCustomNotifications;

exports.GetCustomNotificationTimeout = () => config.CustomNotificationTimeout;

exports.GetCustomNotificationMaxCount = () => config.CustomNotificationMaxCount;

exports.GetCustomNotificationCorner = () => config.CustomNotificationCorner;

exports.GetNotificationSoundsEnabled = () => config.NotificationSoundsEnabled;

exports.GetUpdaterIgnoreVersion = () => config.UpdaterIgnoreVersion;

exports.SetUpdaterIgnoreVersion = async (versionToIgnore) => {
    config.UpdaterIgnoreVersion = versionToIgnore;
    await UpdateJsonFile(FileType.CONFIG);
};

exports.SelectCVRExecutable = async () => {
    log.debug('[SelectCVRExecutable] Prompting for CVR Executable path...');

    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: `Select ${CVRExecutableName}`,
        message: `Please select your ${CVRExecutableName} file`,
        defaultPath: config.CVRExecutable || path.join(CVRExecutableDefaultFolderPath, CVRExecutableName),
        filters: [{ name: 'ChilloutVR Executable', extensions: ['exe'] }],
        properties: ['openFile'],
    });

    if (canceled) {
        const err = 'User canceled CVR executable selection';
        log.info(`[SelectCVRExecutable] ${err}`);
        throw new Error(err);
    }

    const providedPath = filePaths[0];
    
    // Check if the user provided the path to ChilloutVR.exe and not something else
    if (path.basename(providedPath) !== CVRExecutableName) {
        const err = `Selected file is not ${CVRExecutableName}`;
        log.error(`[SelectCVRExecutable] ${err}: ${providedPath}`);
        throw new Error(err);
    }

    // Update the config
    config.CVRExecutable = providedPath;
    await UpdateJsonFile(FileType.CONFIG);
    
    log.info(`[SelectCVRExecutable] CVR executable path updated to: ${providedPath}`);
    return providedPath;
};
