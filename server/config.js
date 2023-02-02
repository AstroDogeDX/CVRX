const fs = require('fs');
const path = require('path');
const XML = require('xml2js');
const { app, dialog } = require('electron');

const AppDataPath = app.getPath('userData');
const ConfigsPath = path.join(AppDataPath, 'CVRConfigs');
const ConfigFileName = 'config.json';
const ConfigCredentialsFileName = 'credentials.json';

const FileVersion = 1;

const CVRExecutableDefaultFolderPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ChilloutVR';
const CVRExecutableName = 'ChilloutVR.exe';
const CVRDataFolderName = 'ChilloutVR_Data';
const CVRDefaultAutologinProfileName = 'autologin.profile';

const FileType = Object.freeze({
   CONFIG: 'CONFIG',
   CREDENTIALS: 'CREDENTIALS',
});


let config;
let credentials;


const GetCVRPath = () => path.dirname(config.CVRExecutable);
const GetCVRAppdataPath = () => path.join(GetCVRPath(), CVRDataFolderName);

exports.Load = async () => {

    // Load the config file
    config = await GetOrCreateJsonFile(ConfigsPath, ConfigFileName, {
        ActiveUsername: null,
        CacheMaxSizeInMegabytes: 1000,
        CVRExecutable: path.join(CVRExecutableDefaultFolderPath, CVRExecutableName),
    });

    // Load the credentials file
    credentials = await GetOrCreateJsonFile(ConfigsPath, ConfigCredentialsFileName, {});
}

async function UpdateJsonFile(fileType) {

    switch (fileType) {
        case FileType.CONFIG:
            await WriteToJsonFile(ConfigsPath, ConfigFileName, config);
            break;
        case FileType.CREDENTIALS:
            await WriteToJsonFile(ConfigsPath, ConfigCredentialsFileName, credentials);
            break;
        default:
            console.error(`Attempted to Update a file of type ${fileType}, but that type is not supported!`)
    }
}

async function WriteToJsonFile(folderPath, fileName, data = {}) {
    const objectToWrite = { FileVersion: FileVersion, data: data }
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
    const fileContents = await fs.promises.readFile(filePath, 'utf8');
    const parsedFile = JSON.parse(fileContents);
    return parsedFile.data;
}


exports.ImportCVRCredentials = async () => {

    const cvrDataFolder = GetCVRAppdataPath();

    // If the ChilloutVR.exe doesn't exist means we got our path wrong!
    if (!fs.existsSync(cvrDataFolder)) {

        console.log('[ImportCVRCredentials] CVR folder not found... Prompt for the CVR Executable!');

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
            console.error(err);
            await dialog.showErrorBox(
                `Credentials Error`,
                `Currently CVRX can only authenticate using the autologin.profile files from CVR.\nSo we ` +
                `need a valid path to it.\nThe application will close since you didn't point us to the ` +
                `${CVRExecutableName} file...`,
            );
            app.quit();
            throw new Error(err);
        }

        // User actually provided a file!
        else {
            const providedPath = filePaths[0];
            // Check if the user provided the path to ChilloutVR.exe and not something else
            if (path.basename(providedPath) !== CVRExecutableName) {
                const err = `Provided ${providedPath} as a path for ${CVRExecutableName}`;
                console.error(err);
                await dialog.showErrorBox(
                    `Credentials Error`,
                    `You pointed to a ${path.basename(providedPath)} file, we need ${CVRExecutableName}...`,
                );
                app.quit();
                throw new Error(err);
            }

            // The user actually provided the ChilloutVR.exe path!!!
            config.CVRExecutable = providedPath;
            await UpdateJsonFile(FileType.CONFIG);
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

            console.log(`[ImportCVRCredentials] Found credentials for ${username}!`);
            let isDefaultAutoLogin = fileName === CVRDefaultAutologinProfileName;

            // Since we found the default auto login, we're going to set all is auto login to false
            if (isDefaultAutoLogin) {
                for (const credential of Object.values(credentials)) {
                    credential.IsAutoLogin = false;
                }
            }

            updated = true;
            credentials[username] = {
                Username: username,
                AccessKey: accessKey,
                IsAutoLogin: isDefaultAutoLogin,
            };
        }
    }

    // Update the credential file if we actually added something
    if (updated) await UpdateJsonFile(FileType.CREDENTIALS);


    return credentials;
}

exports.GetAvailableCredentials = () => Object.keys(credentials);
exports.GetActiveCredentials = () => credentials?.[config?.ActiveUsername];
exports.GetAutoLoginCredentials = () => Object.values(credentials).find(cred => cred.IsAutoLogin);


exports.SaveCredential = async (username, accessKey) => {
    if (username && accessKey) {
        const wasAutoLogin = credentials[username]?.IsAutoLogin ?? false;
        credentials[username] = { Username: username, AccessKey: accessKey, IsAutoLogin: wasAutoLogin };
        await UpdateJsonFile(FileType.CREDENTIALS);
    }
    else {
        console.error(`Attempted to save credentials, but either the username or access key were null/empty.`)
    }
}

exports.SetActiveCredentials = async (username) => {
    if (!credentials?.[username]) {
        console.error(`There are no credentials for the user ${username}!`);
    }
    config.ActiveUsername = username;
    await UpdateJsonFile(FileType.CONFIG);
};

exports.GetMaxCacheSize = () => config.CacheMaxSizeInMegabytes;
