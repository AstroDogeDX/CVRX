const { ipcMain, dialog, shell } = require('electron');
const cache = require('./cache.js');
const CVRHttp = require('./api_cvr_http');
const CVRWebsocket = require('./api_cvr_ws');
const Config = require('./config');
const Updater = require('./updater');
const Utils = require('./utils');
const {CategoryType} = require('./api_cvr_http');
const path = require('path');

const log = require('./logger').GetLogger('Data');
const logRenderer = require('../server/logger').GetLogger('Renderer');
const openLogsFolder = require('./logger').OpenLogsFolder;

const recurringIntervalMinutes = 5;
let recurringIntervalId;


const ToastTypes = Object.freeze({
    GOOD: 'confirm',
    BAD: 'error',
    INFO: 'info',
});

const PublicContentType = Object.freeze({
    AVATARS: 'avatars',
    WORLDS: 'worlds',
    PROPS: 'props',
});

// const AvatarCategories = Object.freeze({
//     Public: 'avtrpublic',
//     Shared: 'avtrshared',
//     Mine: 'avtrmine',
// });

// const PropCategories = Object.freeze({
//     Mine: 'propmine',
//     Shared: 'propshared',
// });

const WorldCategories = Object.freeze({
    ActiveInstances: 'wrldactive',
    New: 'wrldnew',
    Trending: 'wrldtrending',
    Official: 'wrldofficial',
    Avatar: 'wrldavatars',
    Public: 'wrldpublic',
    RecentlyUpdated: 'wrldrecentlyupdated',
    Mine: 'wrldmine',
});

const ActivityUpdatesType = Object.freeze({
    Friends: 'friends',
    Invites: 'invites',
    InviteRequests: 'inviteRequests',
});

const htmlEscapeMap =  Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#039;',
});


function IsObjectEqualExcept(obj1, obj2, keysToIgnore) {
    return JSON.stringify(obj1, (key, value) => keysToIgnore.includes(key) ? undefined : value) ===
    JSON.stringify(obj2, (key, value) => keysToIgnore.includes(key) ? undefined : value);
}

async function LoadImage(url, obj) {
    if (!url) return;
    const hashedFileName = await cache.GetHash(url);
    cache.QueueFetchImage({url: url, hash: hashedFileName, obj: obj});
    obj.imageHash = hashedFileName;
}

async function LoadUserImages(userObject) {
    if (userObject?.imageUrl) {
        await LoadImage(userObject.imageUrl, userObject);
    }
    if (userObject?.avatar?.imageUrl) {
        await LoadImage(userObject.avatar.imageUrl, userObject.avatar);
    }
    if (userObject?.featuredBadge?.image) {
        await LoadImage(userObject.featuredBadge.image, userObject.featuredBadge);
    }
    if (userObject?.featuredGroup?.image) {
        await LoadImage(userObject.featuredGroup.image, userObject.featuredGroup);
    }
    if (userObject?.instance?.world?.imageUrl) {
        await LoadImage(userObject.instance.world.imageUrl, userObject.instance.world);
    }
}

function EscapeStringFromHtml(text) {
    return text.replace(/[&<>"']/g, (m) => { return htmlEscapeMap[m]; });
}

function EscapeHtml(obj, firstIteration = true) {
    if (obj) {
        // Deep clone to prevent affecting the original objects (we're caching some of those)
        if (firstIteration) obj = Utils.DeepClone(obj);
        for (let key in obj) {
            if(!Object.prototype.hasOwnProperty.call(obj, key)) continue;
            // Note: Array also show as object
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                EscapeHtml(obj[key], false);
            } else if (Object.prototype.toString.call(obj[key]) === '[object String]') {
                obj[key] = EscapeStringFromHtml(obj[key]);
            }
        }
    }
    return obj;
}


class Core {

    constructor(mainWindow, app) {

        this.mainWindow = mainWindow;

        this.app = app;

        this.#ResetCachingObjects();

        this.#SetupHandlers();

        // Expose core and api on globals for debugging
        if (!app.isPackaged){
            global.Core = this;
            global.CVRHttp = CVRHttp;
        }
    }

    #ResetCachingObjects() {

        this.friends = {};
        this.categories = {};

        this.friendRequests = {};

        this.recentActivity = [];
        this.recentActivityCache = {
            [ActivityUpdatesType.Friends]: {},
            [ActivityUpdatesType.Invites]: {},
            [ActivityUpdatesType.InviteRequests]: {},
        };
        this.recentActivityInitialFriends = false;

        this.activeInstancesDetails = {};

        this.nextInstancesRefreshAvailableExecuteTime = 0;

        this.blockedUserIds = [];
    }

    #SetupHandlers() {

        // Misc
        ipcMain.handle('is-packaged', (_event) => this.app.isPackaged);
        ipcMain.handle('get-locale', (_event) => {
            return {
                'getLocale': this.app.getLocale(),
                'getLocaleCountryCode': this.app.getLocaleCountryCode(),
                'getSystemLocale': this.app.getSystemLocale(),
                'getPreferredSystemLanguages': this.app.getPreferredSystemLanguages(),
            };
        });
        ipcMain.handle('is-dev-tools-opened', (_event) => this.mainWindow.webContents.isDevToolsOpened());
        ipcMain.handle('check-for-updates', (_event) => Updater.CheckLatestRelease(this.mainWindow, true));
        ipcMain.handle('update-action', async (_event, action, updateInfo) => {
            try {
                await Updater.HandleUpdateAction(action, updateInfo);
                return { success: true };
            } catch (error) {
                log.error(`[update-action] Failed to handle update action: ${error}`);
                throw error;
            }
        });
        ipcMain.handle('is-chilloutvr-running', async (_event) => {
            try {
                return await Utils.IsChilloutVRRunning();
            } catch (error) {
                log.error(`[is-chilloutvr-running] Failed to check ChilloutVR process: ${error}`);
                return false;
            }
        });

        // Setup on events for IPC
        ipcMain.on('refresh-user-stats', (_event) => this.RefreshFriendRequests());
        ipcMain.on('refresh-friend-requests', (_event) => this.RefreshFriendRequests());
        // ipcMain.on('refresh-worlds-category', (_event, worldCategoryId) => this.UpdateWorldsByCategory(worldCategoryId));
        ipcMain.handle('refresh-instances', async (_event, fromButton) => await this.RefreshInstancesManual(fromButton));

        // Active user
        ipcMain.on('active-user-refresh', (_event) => this.GetOurUserInfo());
        ipcMain.on('active-user-avatars-refresh', (_event) => this.GetOurUserAvatars());
        ipcMain.on('active-user-props-refresh',  (_event) => this.GetOurUserProps());
        ipcMain.on('active-user-worlds-refresh', (_event) => this.GetOurUserWorlds());

        // Logging
        ipcMain.on('log-debug', (_event, msg, data) => logRenderer.debug(msg, data));
        ipcMain.on('log-info', (_event, msg, data) => logRenderer.info(msg, data));
        ipcMain.on('log-warn', (_event, msg, data) => logRenderer.warn(msg, data));
        ipcMain.on('log-error', (_event, msg, data) => logRenderer.error(msg, data));

        // Setup handlers for IPC
        ipcMain.handle('get-user-by-id', async (_event, userId) => EscapeHtml(await this.GetUserById(userId)));
        ipcMain.handle('get-user-public-avatars', async (_event, userId) => EscapeHtml(await this.GetUserPublicContent(userId, PublicContentType.AVATARS)));
        ipcMain.handle('get-user-public-worlds', async (_event, userId) => EscapeHtml(await this.GetUserPublicContent(userId, PublicContentType.WORLDS)));
        ipcMain.handle('get-user-public-props', async (_event, userId) => EscapeHtml(await this.GetUserPublicContent(userId, PublicContentType.PROPS)));
        ipcMain.handle('set-friend-note', async (_event, userId, note) => (await CVRHttp.SetFriendNote(userId, note))?.message);

        ipcMain.handle('get-world-by-id', async (_event, worldId) => EscapeHtml(await this.GetWorldById(worldId)));
        ipcMain.handle('get-world-meta-by-id', async (_event, worldId) => EscapeHtml(await CVRHttp.GetWorldMetaById(worldId)));
        ipcMain.handle('get-world-portal-by-id', async (_event, worldId) => EscapeHtml(await CVRHttp.GetWorldPortalById(worldId)));
        ipcMain.handle('get-worlds-by-category', async (_event, categoryId, page, sort, direction) => EscapeHtml(await this.GetWorldsByCategory(categoryId, page, sort, direction)));
        ipcMain.handle('set-world-as-home', async (_event, worldId) => EscapeHtml(await CVRHttp.SetWorldAsHome(worldId)));
        ipcMain.handle('get-instance-by-id', async (_event, instanceId) => EscapeHtml(await this.GetInstanceById(instanceId)));
        ipcMain.handle('get-instance-portal-by-id', async (_event, instanceId) => EscapeHtml(await CVRHttp.GetInstancePortalById(instanceId)));
        ipcMain.handle('join-instance', async (_event, instanceId) => EscapeHtml(await CVRHttp.JoinInstance(instanceId)));
        ipcMain.handle('get-avatar-by-id', async (_event, avatarId) => EscapeHtml(await this.GetAvatarById(avatarId)));
        ipcMain.handle('get-prop-by-id', async (_event, propId) => EscapeHtml(await this.GetPropById(propId)));
        ipcMain.handle('get-props', async (_event) => EscapeHtml(await CVRHttp.GetProps()));
        ipcMain.handle('search', async (_event, term) => EscapeHtml(await this.Search(term)));

        // Avatar
        ipcMain.handle('set-current-avatar', async (_event, avatarId) => EscapeHtml(await CVRHttp.SetCurrentAvatar(avatarId)));

        // Get Random Content
        ipcMain.handle('get-random-avatars', async (_event, count) => EscapeHtml(await this.GetRandomContent(PublicContentType.AVATARS, count)));
        ipcMain.handle('get-random-worlds', async (_event, count) => EscapeHtml(await this.GetRandomContent(PublicContentType.WORLDS, count)));
        ipcMain.handle('get-random-props', async (_event, count) => EscapeHtml(await this.GetRandomContent(PublicContentType.PROPS, count)));

        // Content Shares (Get)
        ipcMain.handle('get-avatar-shares', async (_event, avatarId) => EscapeHtml(await this.GetContentShares(PublicContentType.AVATARS, avatarId)));
        ipcMain.handle('get-prop-shares', async (_event, propId) => EscapeHtml(await this.GetContentShares(PublicContentType.PROPS, propId)));
        // Content Shares (Add)
        ipcMain.handle('add-avatar-share', async (_event, avatarId, userId) => EscapeHtml(await this.AddContentShares(PublicContentType.AVATARS, avatarId, userId)));
        ipcMain.handle('add-prop-share', async (_event, propId, userId) => EscapeHtml(await this.AddContentShares(PublicContentType.PROPS, propId, userId)));
        // Content Shares (Remove)
        ipcMain.handle('remove-avatar-share', async (_event, avatarId, userId) => EscapeHtml(await this.RemoveContentShares(PublicContentType.AVATARS, avatarId, userId)));
        ipcMain.handle('remove-prop-share', async (_event, propId, userId) => EscapeHtml(await this.RemoveContentShares(PublicContentType.PROPS, propId, userId)));

        // Friendship
        ipcMain.handle('friend-request-send', (_event, userId) => CVRWebsocket.SendFriendRequest(userId));
        ipcMain.handle('friend-request-accept', async (_event, userId) => {
            try { await CVRWebsocket.AcceptFriendRequest(userId); } catch (err) { log.error('[#SetupHandlers] [friend-request-accept] [AcceptFriendRequest]', err); }
            this.RefreshFriendRequests().then().catch((err) => log.error('[#SetupHandlers] [friend-request-accept] [RefreshFriendRequests]', err));
            this.FriendsUpdate(true).then().catch((err) => log.error('[#SetupHandlers] [friend-request-accept] [FriendsUpdate]', err));
        });
        ipcMain.handle('friend-request-decline', async (_event, userId) => {
            await CVRWebsocket.DeclineFriendRequest(userId);
            await this.RefreshFriendRequests();
        });
        ipcMain.handle('unfriend', async (_event, userId) => {
            try { await CVRWebsocket.Unfriend(userId); } catch (err) { log.error('[#SetupHandlers] [unfriend] [CVRWebsocket.Unfriend]', err); }
            this.FriendsUpdate(true).then().catch((err) => log.error('[#SetupHandlers] [unfriend] [FriendsUpdate]', err));
        });

        // Credentials Management
        ipcMain.handle('login-authenticate', async (_event, credentialUser, credentialSecret, isAccessKey, saveCredentials) => {
            return await this.Authenticate(credentialUser, credentialSecret, isAccessKey, saveCredentials);
        });
        ipcMain.on('logout', async (_event) => await this.Disconnect('The CVRX User is logging out...'));
        ipcMain.handle('delete-credentials', async (_event, username) => Config.ClearCredentials(username));
        ipcMain.handle('import-game-credentials', async (_event) => {
            await Config.ImportCVRCredentials();
            await this.SendToLoginPage();
        });
        ipcMain.on('reconnect-web-socket',  (_event) => CVRWebsocket.Reconnect(true));

        // Moderation
        ipcMain.handle('block-user', (_event, userId) => CVRWebsocket.BlockUser(userId));
        ipcMain.handle('unblock-user', (_event, userId) => CVRWebsocket.UnblockUser(userId));

        // Config
        ipcMain.handle('config-get', () => Config.GetConfig());
        ipcMain.handle('config-update', (_event, newConfigSettings) => Config.UpdateConfig(newConfigSettings));

        // CVR Executable Selection
        ipcMain.handle('select-cvr-executable', async (_event) => {
            try {
                return await Config.SelectCVRExecutable();
            } catch (error) {
                throw error;
            }
        });

        // Account
        ipcMain.handle('get-mature-content-config', (_event) => EscapeHtml(this.matureContentConfig));
        ipcMain.handle('set-mature-content-visibility', async (_event, enabled) => await this.SetMatureContentVisibility(enabled));

        // Categories
        ipcMain.handle('get-categories', (_event) => EscapeHtml(this.categories));
        ipcMain.on('update-categories', (_event) => this.UpdateCategories());
        // Categories - Assign
        ipcMain.handle('assign-categories-friend', async (_event, userId, categoryIds) => await this.AssignCategory(CategoryType.FRIENDS, userId, categoryIds));
        ipcMain.handle('assign-categories-avatar', async (_event, avatarId, categoryIds) => await this.AssignCategory(CategoryType.AVATARS, avatarId, categoryIds));
        ipcMain.handle('assign-categories-prop', async (_event, propId, categoryIds) => await this.AssignCategory(CategoryType.PROPS, propId, categoryIds));
        ipcMain.handle('assign-categories-world', async (_event, worldId, categoryIds) => await this.AssignCategory(CategoryType.WORLDS, worldId, categoryIds));
        // Categories - Create Category
        ipcMain.handle('create-category-friend', async (_event, categoryName) => await this.CreateCategory(CategoryType.FRIENDS, categoryName));
        ipcMain.handle('create-category-avatar', async (_event, categoryName) => await this.CreateCategory(CategoryType.AVATARS, categoryName));
        ipcMain.handle('create-category-prop', async (_event, categoryName) => await this.CreateCategory(CategoryType.PROPS, categoryName));
        ipcMain.handle('create-category-world', async (_event, categoryName) => await this.CreateCategory(CategoryType.WORLDS, categoryName));
        // Categories - Delete Category
        ipcMain.handle('delete-category-friend', async (_event, categoryId) => await this.DeleteCategory(CategoryType.FRIENDS, categoryId));
        ipcMain.handle('delete-category-avatar', async (_event, categoryId) => await this.DeleteCategory(CategoryType.AVATARS, categoryId));
        ipcMain.handle('delete-category-prop', async (_event, categoryId) => await this.DeleteCategory(CategoryType.PROPS, categoryId));
        ipcMain.handle('delete-category-world', async (_event, categoryId) => await this.DeleteCategory(CategoryType.WORLDS, categoryId));
        // Categories - Reorder Categories
        ipcMain.handle('reorder-categories-friend', async (_event, newOrderedCategoryIds) => await this.ReorderCategories(CategoryType.FRIENDS, newOrderedCategoryIds));
        ipcMain.handle('reorder-categories-avatar', async (_event, newOrderedCategoryIds) => await this.ReorderCategories(CategoryType.AVATARS, newOrderedCategoryIds));
        ipcMain.handle('reorder-categories-prop', async (_event, newOrderedCategoryIds) => await this.ReorderCategories(CategoryType.PROPS, newOrderedCategoryIds));
        ipcMain.handle('reorder-categories-world', async (_event, newOrderedCategoryIds) => await this.ReorderCategories(CategoryType.WORLDS, newOrderedCategoryIds));

        // Cache
        ipcMain.handle('clear-cached-images', async (_event) => await cache.ClearAllCachedImages());

        // External Links
        ipcMain.handle('open-external', async (_event, url) => {
            try {
                if (!url || typeof url !== 'string') {
                    throw new Error('Invalid URL provided');
                }
                await shell.openExternal(url);
                return { success: true };
            } catch (error) {
                log.error(`[open-external] Failed to open external URL: ${error}`);
                throw error;
            }
        });
        // Logs Folder
        ipcMain.on('open-logs-folder', async (_event) => await openLogsFolder());

        // Socket Events
        CVRWebsocket.EventEmitter.on(CVRWebsocket.SocketEvents.CONNECTED, () => this.recentActivityInitialFriends = true);
        CVRWebsocket.EventEmitter.on(CVRWebsocket.SocketEvents.DEAD, () => this.SendToRenderer('socket-died'));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.SocketEvents.RECONNECTION_FAILED, (msg) => this.SendToRenderer('notification', msg, ToastTypes.BAD));

        // Setup Handlers for the websocket
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.ONLINE_FRIENDS, (friendsInfo) => this.FriendsUpdate(false, friendsInfo));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.INVITES, (invites) => this.InvitesUpdate(invites));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.REQUEST_INVITES, (requestInvites) => this.RequestInvitesUpdate(requestInvites));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.FRIEND_REQUESTS, (friendRequests) => this.UpdateFriendRequests(friendRequests, false));

        // Notifications
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.MENU_POPUP, (_data, msg) => this.SendToRenderer('notification', msg, ToastTypes.INFO));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.HUD_MESSAGE, (_data, msg) => this.SendToRenderer('notification', msg, ToastTypes.INFO));

        // Mature Content
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.MATURE_CONTENT_UPDATE, (matureContentInfo) => this.UpdateMatureContentConfigWs(matureContentInfo));

        // Advanced Avatar Settings
        ipcMain.handle('get-avatar-advanced-settings', async (_event, avatarId) => {
            try {
                return await this.GetAvatarAdvancedSettings(avatarId);
            } catch (error) {
                log.error(`Failed to get avatar advanced settings for ${avatarId}:`, error);
                throw error;
            }
        });

        ipcMain.handle('save-avatar-advanced-settings', async (_event, avatarId, settings) => {
            try {
                return await this.SaveAvatarAdvancedSettings(avatarId, settings);
            } catch (error) {
                log.error(`Failed to save avatar advanced settings for ${avatarId}:`, error);
                throw error;
            }
        });

        ipcMain.handle('has-avatar-advanced-settings', async (_event, avatarId) => {
            try {
                return await this.HasAvatarAdvancedSettings(avatarId);
            } catch (error) {
                log.error(`Failed to check avatar advanced settings for ${avatarId}:`, error);
                return {
                    hasSettings: false,
                    reason: 'error',
                    message: error.message,
                };
            }
        });
    }

    SendToRenderer(channel, ...args) {
        for (let i = 0; i < args.length; i++) {
            EscapeHtml(args[i]);
        }
        this.mainWindow.webContents.send(channel, ...args);
    }

    async Disconnect(reason) {

        // Disable the websocket reconnection
        if (recurringIntervalId) clearInterval(recurringIntervalId);
        await CVRWebsocket.DisconnectWebsocket(true, reason);
        await Config.ClearActiveCredentials();
        cache.Initialize(this.mainWindow);

        // Reset cached stuff
        this.#ResetCachingObjects();

        await this.SendToLoginPage();
    }

    async Authenticate(credentialUser, credentialSecret, isAccessKey, saveCredentials) {

        try {

            let authentication;
            if (isAccessKey) authentication = await CVRHttp.AuthenticateViaAccessKey(credentialUser, credentialSecret);
            else authentication = await CVRHttp.AuthenticateViaPassword(credentialUser, credentialSecret);

            // Save credentials and set them as active
            if (saveCredentials) {
                await Config.SaveCredential(authentication.username, authentication.accessKey);
                await Config.SetActiveCredentials(authentication.username, authentication.userId);
            }

            // Reset and stop image processing queue
            cache.ResetProcessQueue();

            this.blockedUserIds = authentication.blockedUsers;

            // Call more events to update the initial state
            await Promise.allSettled([
                this.GetOurUserInfo(authentication.userId),
                // this.GetOurUserAvatars(),
                // this.GetOurUserProps(),
                // this.GetOurUserWorlds(),
                this.FriendsUpdate(true),
                this.UpdateUserStats(),
                this.RefreshFriendRequests(),
                this.ActiveInstancesUpdate(true),
                this.UpdateCategories(),
                this.UpdateMatureContentConfig(),
            ]);

            // Initialize the websocket
            await CVRWebsocket.ConnectWithCredentials(authentication.username, authentication.accessKey);

            // Tell cache we're initialized to start loading images...
            cache.StartProcessQueue();

            // Tell the renderer to go to the home page
            this.SendToRenderer('page-home');

            // Schedule recurring API Requests every 5 minutes
            if (recurringIntervalId) clearInterval(recurringIntervalId);
            let failedTimes = 0;
            recurringIntervalId = setInterval(async () => {
                try {
                    await Promise.allSettled([
                        this.UpdateUserStats(),
                        // this.ActiveInstancesUpdate(true),
                    ]);
                    failedTimes = 0;
                }
                catch (e) {
                    if (failedTimes > 3) {
                        log.error('[Initialize] We failed to update player stats 3 times, stopping...', e);
                        if (recurringIntervalId) clearInterval(recurringIntervalId);
                        return;
                    }
                    log.error(`[Initialize] Updating the player stats (recurring every ${recurringIntervalMinutes} mins)...`, e);
                    failedTimes++;
                }
            }, recurringIntervalMinutes * 60 * 1000);

        }
        catch (e) {
            log.error('[Authenticate] Error while authentication or initial requests...', e.toString(), e.message?.toString());
            await dialog.showErrorBox(
                'Authentication/Initial Requests failed',
                'Something went wrong during CVRX Startup. Make sure you have an internet connection.' +
                '\nThe current user will be logged out and the application will quit!\n' + e.toString(),
            );
            await Config.ClearActiveCredentials();
            this.app.quit();
        }
        // const authentication = {
        //     username: 'XXXXXXXXX',
        //     accessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        //     userId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        //     currentAvatar: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        //     currentHomeWorld: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        //     videoUrlResolverExecutable: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        //     videoUrlResolverHashes: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS',
        //     blockedUsers: [],
        // }
    }

    async SendToLoginPage() {

        const availableCredentials = Config.GetAvailableCredentials();

        for (const activeCredential of availableCredentials) {
            await LoadImage(activeCredential.ImageUrl, activeCredential);
        }

        this.SendToRenderer('page-login', availableCredentials);
    }

    async GetOurUserInfo(ourUserID) {
        const ourUser = await this.GetUserById(ourUserID);
        await Config.SetActiveUserImage(ourUser?.imageUrl);
        this.SendToRenderer('active-user-load', ourUser);
    }

    async GetOurUserAvatars() {
        const ourAvatars = await CVRHttp.GetMyAvatars();
        // const ourAvatars = (await CVRHttp.GetMyAvatars()).filter(av => av.categories.includes(AvatarCategories.Mine));
        // ourAvatars = [{
        //     description: '',
        //     authorGuid: '3a1661f1-3eeb-426e-92ec-1b2f08e609b5',
        //     categories: [ 'avtrmine' ],
        //     id: 'b81d5892-5119-4f44-b473-7bf4ffda0458',
        //     name: 'Captain fas',
        //     imageUrl: 'https://files.abidata.io/user_content/avatars/3a1661f1-3eeb-426e-92ec-1b2f08e609b5.png'
        // }]
        for (const ourAvatar of ourAvatars) {
            if (ourAvatar?.imageUrl) {
                await LoadImage(ourAvatar.imageUrl, ourAvatar);
            }
        }
        this.SendToRenderer('active-user-avatars-load', ourAvatars);
    }

    async GetOurUserProps() {
        const ourProps = await CVRHttp.GetProps();
        //const ourProps = (await CVRHttp.GetProps()).filter(av => av.categories.includes(PropCategories.Mine));
        // ourProps = [{
        //     description: '',
        //     authorGuid: '4a1661f1-2eeb-426e-92ec-1b2f08e609b3',
        //     categories: [ 'propmine' ],
        //     id: 'dcd50623-9cc8-4c97-9286-25186db03dd9',
        //     name: 'Cube Seat',
        //     imageUrl: 'https://files.abidata.io/user_content/spawnables/dcd50623-9cc8-4c97-9286-25186db03dd9/dcd50623-9cc8-4c97-9286-25186db03dd9.png'
        // }]
        for (const ourProp of ourProps) {
            if (ourProp?.imageUrl) {
                await LoadImage(ourProp.imageUrl, ourProp);
            }
        }
        this.SendToRenderer('active-user-props-load', ourProps);
    }

    async GetOurUserWorlds() {
        // Load worlds from all relevant user categories (similar to how avatars and props work)
        let allWorlds = [];
        const allWorldsMap = {};

        try {

            // Get all relevant world categories (Mine + user-created categories)
            const relevantCategories = [WorldCategories.Mine];

            if (this.categories && this.categories.worlds) {
                // Add user-created world categories (those starting with 'worlds_')
                const userCategories = this.categories.worlds
                    .filter(category => category.id.startsWith('worlds_'))
                    .map(category => category.id);
                relevantCategories.push(...userCategories);
            }

            log.info(`[GetOurUserWorlds] Loading worlds from categories: ${relevantCategories.join(', ')}`);

            // Load worlds from each relevant category
            for (const categoryId of relevantCategories) {
                try {
                    const categoryWorlds = await this.UpdateWorldsByCategory(categoryId);

                    // Add worlds to the combined list, avoiding duplicates and adding category info
                    for (const world of categoryWorlds) {
                        if (!allWorldsMap[world.id]) {
                            allWorldsMap[world.id] = { ...world, categories: [] };
                        }
                        // Add this category to the world's categories array
                        if (!allWorldsMap[world.id].categories.includes(categoryId)) {
                            allWorldsMap[world.id].categories.push(categoryId);
                        }
                    }
                } catch (error) {
                    log.error(`[GetOurUserWorlds] Failed to load worlds from category ${categoryId}:`, error);
                }
            }

            // Convert to array
            allWorlds = Object.values(allWorldsMap);
            log.info(`[GetOurUserWorlds] Loaded ${allWorlds.length} total unique worlds from ${relevantCategories.length} categories`);

        } catch (error) {
            log.error('[GetOurUserWorlds] Failed to load all user worlds, falling back to Mine category only:', error);
            // Fallback to just Mine category if the above fails
            allWorlds = await this.UpdateWorldsByCategory(WorldCategories.Mine);
            // Ensure categories array exists for fallback
            allWorlds = allWorlds.map(world => ({ ...world, categories: [WorldCategories.Mine] }));
        }

        this.SendToRenderer('active-user-worlds-load', allWorlds);
    }

    async UpdateRecentActivity(updateType, updateInfo) {

        switch (updateType) {
            case ActivityUpdatesType.Friends: {

                let isInitial = false;

                // Consume the initial friends after connection, because it's sync data and not real time
                if (this.recentActivityInitialFriends) {
                    this.recentActivityInitialFriends = false;
                    this.recentActivityCache[ActivityUpdatesType.Friends] = {};
                    isInitial = true;
                }

                for (const friendUpdate of updateInfo) {

                    // If it is the initial sync, let's just update the current state but not sending as an update
                    if (isInitial) {
                        this.recentActivityCache[friendUpdate.id] = JSON.parse(JSON.stringify(this.friends[friendUpdate.id]));
                        continue;
                    }

                    const current = JSON.parse(JSON.stringify(this.friends[friendUpdate.id]));
                    const previous = this.recentActivityCache[friendUpdate.id] ?? null;

                    // Ignore updates if they are the same as the previous state
                    if (IsObjectEqualExcept(current, previous, ['imageBase64'])) continue;

                    this.recentActivity.unshift({
                        timestamp: Date.now(),
                        type: ActivityUpdatesType.Friends,
                        current: current,
                        previous: this.recentActivityCache[friendUpdate.id] ?? null,
                    });
                    this.recentActivityCache[friendUpdate.id] = current;
                }

                break;
            }
            case ActivityUpdatesType.Invites: {
                // For invites, updateInfo is the array of new invites
                for (const invite of updateInfo) {
                    // Only add invites we haven't seen before to prevent duplicates
                    if (!this.recentActivityCache[ActivityUpdatesType.Invites][invite.id]) {
                        this.recentActivity.unshift({
                            timestamp: Date.now(),
                            type: ActivityUpdatesType.Invites,
                            invite: invite,
                        });
                        this.recentActivityCache[ActivityUpdatesType.Invites][invite.id] = true;
                    }
                }
                break;
            }
            case ActivityUpdatesType.InviteRequests: {
                // For invite requests, updateInfo is the array of new invite requests
                for (const inviteRequest of updateInfo) {
                    // Only add invite requests we haven't seen before to prevent duplicates
                    if (!this.recentActivityCache[ActivityUpdatesType.InviteRequests][inviteRequest.id]) {
                        this.recentActivity.unshift({
                            timestamp: Date.now(),
                            type: ActivityUpdatesType.InviteRequests,
                            inviteRequest: inviteRequest,
                        });
                        this.recentActivityCache[ActivityUpdatesType.InviteRequests][inviteRequest.id] = true;
                    }
                }
                break;
            }
        }

        // Keep the recent activity capped at the configured max count
        const maxCount = Config.GetRecentActivityMaxCount();
        this.recentActivity = this.recentActivity.slice(0, maxCount);

        // Send recent activities update to the view
        this.SendToRenderer('recent-activity-update', this.recentActivity);
    }

    async FriendsUpdate(isRefresh, friendsInfo) {
        // [{
        // "id":"2ff016ef-1d3b-4aff-defb-c167ed99b416",
        // "isOnline":true,
        // "isConnected":true,
        // "instance": {
        //      "id":"i+51985e5559117d5f-951509-ff0a95-1a3dc443",
        //      "name":"The Purple Fox (#417388)",
        //      "privacy":1
        // }
        // }]'

        // If it's a refresh actually get the friends info
        if (isRefresh) {
            friendsInfo = await CVRHttp.GetMyFriends();
        }

        const newFriendsObject = isRefresh ? {} : this.friends;

        for (let friendInfo of friendsInfo) {
            if (!friendInfo || !friendInfo.id) continue;

            if (!isRefresh && !this.friends[friendInfo.id]) {
                // We got a friend update from someone that's not on our cache. Let's refresh the friends list!
                await this.FriendsUpdate(true);
                return;
            }

            // Grab the previous friend info we don't lose previous socket updates
            const friendInstance = this.friends[friendInfo.id] ??= {};

            // Merge the new properties we're getting from the usersOnlineChange
            Object.assign(friendInstance, friendInfo);

            // Queue the images grabbing (if available)
            await LoadUserImages(friendInstance);

            // Add the friend info to our cache
            newFriendsObject[friendInstance.id] = friendInstance;
        }

        // Overwrite our cache if it's a refresh
        if (isRefresh) this.friends = newFriendsObject;

        // Send the friend results to the main window
        this.SendToRenderer('friends-refresh', Object.values(this.friends), isRefresh);

        // Handle the activity update
        if (!isRefresh) {
            try {
                await this.UpdateRecentActivity(ActivityUpdatesType.Friends, friendsInfo);
            }
            catch (err) {
                log.error('[FriendsUpdate]', err);
            }
        }

        // Handle active instances update (to update our friend's info). So don't trigger a full refresh!
        await this.ActiveInstancesUpdate(false);
    }

    async InvitesUpdate(invites) {
        // This always send all of them!
        // Note: The invites will time out over time, and when they do, we get another full update
        for (const invite of invites) {
            if (invite?.user?.imageUrl) {
                await LoadImage(invite.user.imageUrl, invite.user);
            }
            if (invite?.world?.imageUrl) {
                await LoadImage(invite.world.imageUrl, invite.world);
            }
        }
        // invites = [{
        //     "id": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3:yghREqSG",
        //     "user": {
        //         "id": "b3005d19-e487-bafc-70ac-76d2190d5a29",
        //         "name": "NotAKid",
        //         "imageUrl": "https://files.abidata.io/user_images/b3005d19-e487-bafc-70ac-76d2190d5a29.png"
        //     },
        //     "world": {
        //         "id": "95c9f8c9-ba9b-40f5-a957-3254ce2d2e91",
        //         "name": "Sakura Hotsprings",
        //         "imageUrl": "https://files.abidata.io/user_content/worlds/95c9f8c9-ba9b-40f5-a957-3254ce2d2e91/95c9f8c9-ba9b-40f5-a957-3254ce2d2e91.png"
        //     },
        //     "instanceId": "i+a08c7c940906f17d-829305-fd561f-171faa79",
        //     "instanceName": "Sakura Hotsprings (#811786)",
        //     "receiverId": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3"
        // }]
        this.SendToRenderer('invites', invites);
        
        // Add invites to recent activity
        try {
            await this.UpdateRecentActivity(ActivityUpdatesType.Invites, invites);
        } catch (err) {
            log.error('[InvitesUpdate]', err);
        }
    }

    async RequestInvitesUpdate(requestInvites) {
        // This always send all of them!
        // Note: The requestInvites will time out over time, and when they do, we get another full update
        for (const requestInvite of requestInvites) {
            if (requestInvite?.sender?.imageUrl) {
                await LoadImage(requestInvite.sender.imageUrl, requestInvite.sender);
            }
        }
        // requestInvites = [{
        //     "id": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3:E5nx5n7N",
        //     "sender": {
        //         "id": "b3005d19-e487-bafc-70ac-76d2190d5a29",
        //         "name": "NotAKid",
        //         "imageUrl": "https://files.abidata.io/user_images/b3005d19-e487-bafc-70ac-76d2190d5a29.png"
        //     },
        //     "receiverId": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3"
        // }]
        this.SendToRenderer('invite-requests', requestInvites);
        
        // Add invite requests to recent activity
        try {
            await this.UpdateRecentActivity(ActivityUpdatesType.InviteRequests, requestInvites);
        } catch (err) {
            log.error('[RequestInvitesUpdate]', err);
        }
    }

    async UpdateMatureContentConfig() {
        this.remoteConfig = await CVRHttp.GetRemoteConfig();
        this.matureContentConfig = CVRWebsocket.MapMatureContentConfig(this.remoteConfig.matureContent);
        this.SendToRenderer('mature-content-update', EscapeHtml(this.matureContentConfig));
    }

    async UpdateMatureContentConfigWs(matureContentInfo) {
        this.matureContentConfig = matureContentInfo;
        this.SendToRenderer('mature-content-config-update', EscapeHtml(matureContentInfo));
    }

    async SetMatureContentVisibility(enabled) {
        return (await CVRHttp.SetMatureContentVisibility(enabled))?.message;
    }

    async UpdateCategories() {
        this.categories = await CVRHttp.GetCategories();
        this.SendToRenderer('categories-updated', this.categories);
    }

    async AssignCategory(type, contentGuid, categoryIds) {
        return (await CVRHttp.AssignCategory(type, contentGuid, categoryIds))?.message;
    }

    async CreateCategory(type, categoryName) {
        const response = await CVRHttp.CreateCategory(type, categoryName);
        await this.UpdateCategories();
        return response?.message;
    }

    async DeleteCategory(type, categoryId) {
        const response =  await CVRHttp.DeleteCategory(type, categoryId);
        await this.UpdateCategories();
        return response?.message;
    }

    async ReorderCategories(type, newOrderedCategoryIds){
        const response =  await CVRHttp.ReorderCategories(type, newOrderedCategoryIds);
        await this.UpdateCategories();
        return response?.message;
    }

    async GetUserById(userId) {

        const user = await CVRHttp.GetUserById(userId);
        await LoadUserImages(user);
        return user;

        // const userDetailed = {
        //     'onlineState': false,
        //     'isConnected': false,
        //     'isFriend': true,
        //     'note': '',
        //     'isBlocked': false,
        //     'instance': null,
        //     'categories': [],
        //     'rank': 'User',
        //     'featuredBadge': {
        //         'name': 'Closed Alpha Participant',
        //         'image': 'https://files.abidata.io/static_web/Badges/abi-alpha.png',
        //         'badgeLevel': 1,
        //     },
        //     'featuredGroup': {
        //         'name': 'No group featured',
        //         'image': 'https://files.abidata.io/static_web/NoHolderImage.png',
        //     },
        //     'avatar': {
        //         'id': 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        //         'name': 'Lop',
        //         'imageUrl': 'https://files.abidata.io/user_content/avatars/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png',
        //     },
        //     'id': 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        //     'name': 'uSeRnAmE',
        //     'imageUrl': 'https://files.abidata.io/user_images/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png',
        // };
    }

    async GetUserPublicContent(userId, publicContentType) {

        let entries;

        switch (publicContentType) {
            case PublicContentType.AVATARS:
                entries = await CVRHttp.GetUserPublicAvatars(userId);
                break;
            case PublicContentType.WORLDS:
                entries = await CVRHttp.GetUserPublicWorlds(userId);
                break;
            case PublicContentType.PROPS:
                entries = await CVRHttp.GetUserPublicSpawnables(userId);
                break;
        }

        for (const entry of entries) {
            if (entry?.imageUrl) {
                await LoadImage(entry.imageUrl, entry);
            }
        }

        return entries;

        // const entries = [
        //     {
        //         id: '978f6939-f914-40c2-833b-eb94e7099a97',
        //         name: "E-Bumpin'",
        //         imageUrl: 'https://files.abidata.io/user_content/spawnables/978f6939-f914-40c2-833b-eb94e7099a97/978f6939-f914-40c2-833b-eb94e7099a97.png'
        //     }
        // ];
    }

    async UpdateUserStats() {
        const userStats = await CVRHttp.GetUserStats();
        // usersOnline: { overall: 47, public: 14, notConnected: 9, other: 24 }
        this.SendToRenderer('user-stats', userStats);
    }

    async UpdateWorldsByCategory(categoryId) {

        const sort = 'Default';
        const direction = 'Ascending';

        const worldEntries = [];

        let activeWorldsTotalPages = 1;
        for (let page = 0; page < activeWorldsTotalPages; page++) {
            const reqResult = await CVRHttp.GetWorldsByCategory(categoryId, page, sort, direction);
            // Update the total pages, so we can iterate multiple times if more pages are available
            activeWorldsTotalPages = reqResult.totalPages;
            worldEntries.push(...reqResult.entries);
        }

        for (const world of worldEntries) {
            if (world?.imageUrl) {
                await LoadImage(world.imageUrl, world);
            }
        }
        this.SendToRenderer('worlds-category-requests', categoryId, worldEntries);

        return worldEntries;

        // const worlds = [
        //     {
        //         playerCount: 9,
        //         id: '406acf24-99b1-4119-8883-4fcda4250743',
        //         name: 'The Purple Fox',
        //         imageUrl: 'https://files.abidata.io/user_content/worlds/406acf24-99b1-4119-8883-4fcda4250743/406acf24-99b1-4119-8883-4fcda4250743.png',
        //     },
        // ];
    }

    async ActiveInstancesRefresh() {

        const sort = 'Default';
        const direction = 'Ascending';

        const activeWorldEntries = [];

        // Fetch active instances, (if there's multiple pages, iterate through them)
        let activeWorldsTotalPages = 1;
        for (let page = 0; page < activeWorldsTotalPages; page++) {
            const reqResult = await CVRHttp.GetWorldsByCategory(WorldCategories.ActiveInstances, page, sort, direction);
            // Update the total pages, so we can iterate multiple times if more pages are available
            activeWorldsTotalPages = reqResult.totalPages;
            activeWorldEntries.push(...reqResult.entries);
        }

        const activeInstancesDetails = {};
        for (const activeWorld of activeWorldEntries) {
            const activeWorldDetails = await CVRHttp.GetWorldById(activeWorld.id);
            for (const activeInstance of activeWorldDetails.instances) {
                try {
                    activeInstancesDetails[activeInstance.id] = await this.GetInstanceById(activeInstance.id);
                }
                catch (err) {
                    log.error(`[ActiveInstancesRefresh] Failed to fetch Instance ${activeInstance.id}`, err.toString());
                }
            }
        }
        return activeInstancesDetails;
    }

    async RefreshInstancesManual(sendMessageToFrontend) {

        // If this function is being called from the frontend, let's limit it max once a second
        const currentTime = new Date().getTime();
        if (this.nextInstancesRefreshAvailableExecuteTime > currentTime) {
            const timeUntilExecute = Math.ceil((this.nextInstancesRefreshAvailableExecuteTime - currentTime) / 1000);
            if (sendMessageToFrontend) {
                this.SendToRenderer('notification',
                    `Slow down! Instances were refreshed less than 1 minute ago. Wait ${timeUntilExecute} seconds...`,
                    ToastTypes.BAD);
            }
            return false;
        }
        this.nextInstancesRefreshAvailableExecuteTime = currentTime + (60 * 1000);

        Promise.allSettled([
            this.UpdateUserStats(),
            this.ActiveInstancesUpdate(true, true),
        ]).then().catch(e => {
            log.error('[RefreshInstancesManual] Failed API Requests...', e);
        });

        return true;
    }

    async ActiveInstancesUpdate(isRefresh) {
        try {

            // If it's a refresh actually get active instances details
            if (isRefresh) {
                this.activeInstancesDetails = await this.ActiveInstancesRefresh();
            }

            // Let's go through our friends and add any instances our friends are in, but didn't show up
            for (const friend of Object.values(this.friends)) {
                if (!friend?.instance?.id) continue;

                // If the instance doesn't exist already, lets fetch it
                if (!Object.prototype.hasOwnProperty.call(this.activeInstancesDetails, friend.instance.id)) {
                    try {
                        this.activeInstancesDetails[friend.instance.id] = await this.GetInstanceById(friend.instance.id);
                    }
                    catch (err) {
                        log.error(`[ActiveInstancesUpdate] Failed to fetch Instance ${friend.instance.id}`, err.toString());
                    }
                }
            }

            // Let's update our friends info in the members of the instances
            const instanceIdsToRemove = [];
            for (const activeInstanceDetails of Object.values(this.activeInstancesDetails)) {
                const membersToDelete = [];

                // Remove all friends from members, we're going to add them after (with extra info)
                for (const member of activeInstanceDetails.members) {
                    if (this.blockedUserIds.includes(member.id)) member.isBlocked = true;
                    if (Object.prototype.hasOwnProperty.call(this.friends, member.id)) membersToDelete.push(member);
                }
                activeInstanceDetails.members = activeInstanceDetails.members.filter(item => !membersToDelete.includes(item));

                // If a friend is in this instance, lets add them to the members! Keep the same order as this.friends
                let insertIndex = 0;
                for (const friend of Object.values(this.friends)) {
                    if (friend?.instance?.id !== activeInstanceDetails.id) continue;
                    activeInstanceDetails.members.splice(insertIndex++, 0, ({
                        ...friend,
                        isFriend: true,
                        isBlocked: this.blockedUserIds.includes(friend.id),
                    }));
                }

                // If there are no members delete the instance
                if (activeInstanceDetails.members.length === 0) {
                    instanceIdsToRemove.push(activeInstanceDetails.id);
                }
                // Otherwise let's make sure the count is accurate
                else {
                    activeInstanceDetails.currentPlayerCount = activeInstanceDetails.members.length;
                }
            }
            instanceIdsToRemove.forEach(k => delete this.activeInstancesDetails[k]);

            this.SendToRenderer('active-instances-update', Object.values(this.activeInstancesDetails));
        }
        catch (err) {
            log.error(`[ActiveInstancesUpdate] ${err.toString()}`);
        }
    }

    async GetWorldById(worldId) {

        const world = await CVRHttp.GetWorldById(worldId);
        if (world?.imageUrl) {
            await LoadImage(world.imageUrl, world);
        }
        if (world?.author?.imageUrl) {
            await LoadImage(world.author.imageUrl, world.author);
        }
        return world;

        // const world = {
        //     "instances": [
        //         {
        //             "id": "i+fd3cee3acf65c238-336300-9a9014-1aea3a14",
        //             "name": "The Purple Fox (#418632)",
        //             "playerCount": 9,
        //             "maxPlayerCount": 100,
        //             "region": "eu",
        //         },
        //     ],
        //     "description": "",
        //     "tags": [
        //         "flashingcolors",
        //         "flashinglights",
        //     ],
        //     "fileSize": 87117646,
        //     "uploadedAt": "2022-07-27T19:46:53",
        //     "updatedAt": "2023-01-25T00:57:03",
        //     "author": {
        //         "id": "6a30fba5-8195-2451-f1bc-7c530b2e99ae",
        //         "name": "LensError",
        //         "imageUrl": "https://files.abidata.io/user_images/6a30fba5-8195-2451-f1bc-7c530b2e99ae-63518c5b746af.png",
        //     },
        //     "authorWorlds": [],
        //     "categories": [],
        //     "id": "406acf24-99b1-4119-8883-4fcda4250743",
        //     "name": "The Purple Fox",
        //     "imageUrl": "https://files.abidata.io/user_content/worlds/406acf24-99b1-4119-8883-4fcda4250743/406acf24-99b1-4119-8883-4fcda4250743.png",
        // };

    }

    async GetInstanceById(instanceId) {

        const instance = await CVRHttp.GetInstanceById(instanceId);
        if (instance?.world?.imageUrl) {
            await LoadImage(instance.world.imageUrl, instance.world);
        }
        await LoadUserImages(instance?.author);
        await LoadUserImages(instance?.owner);
        for (const instanceMember of instance?.members ?? []) {
            await LoadUserImages(instanceMember);
        }
        return instance;

        // const instance = {
        //     "instanceSettingPrivacy": "Public",
        //     "privacy": "Public",
        //     "author": {
        //         "id": "6a30fba5-8195-2451-f1bc-7c530b2e99ae",
        //         "name": "LensError",
        //         "imageUrl": "https://files.abidata.io/user_images/6a30fba5-8195-2451-f1bc-7c530b2e99ae-63518c5b746af.png",
        //     },
        //     "owner": {
        //         "rank": "User",
        //         "featuredBadge": {
        //             "name": "Christmas 2022",
        //             "image": "https://files.abidata.io/static_web/Badges/abi-christmas2022.png",
        //             "badgeLevel": 24,
        //         },
        //         "featuredGroup": {
        //             "name": "No group featured",
        //             "image": "https://files.abidata.io/static_web/NoHolderImage.png",
        //         },
        //         "avatar": {
        //             "id": "c68a25d5-6c27-4d2c-8699-803f7a63cc43",
        //             "name": "Mewmo But Updated",
        //             "imageUrl": "https://files.abidata.io/user_content/avatars/c68a25d5-6c27-4d2c-8699-803f7a63cc43/c68a25d5-6c27-4d2c-8699-803f7a63cc43.png",
        //         },
        //         "id": "7452ea11-86ab-86e8-42bd-1d4d24ed7da6",
        //         "name": "Momofier",
        //         "imageUrl": "https://files.abidata.io/user_images/7452ea11-86ab-86e8-42bd-1d4d24ed7da6-61f16a339b94a.png",
        //     },
        //     "id": "i+fd3cee3acf65c238-336300-9a9014-1aea3a14",
        //     "name": "The Purple Fox (#418632)",
        //     "gameModeId": "",
        //     "gameModeName": "ABI.SocialVR",
        //     "region": "eu",
        //     "world": {
        //         "tags": [
        //             "flashingcolors",
        //             "flashinglights",
        //         ],
        //         "id": "406acf24-99b1-4119-8883-4fcda4250743",
        //         "name": "The Purple Fox",
        //         "imageUrl": "https://files.abidata.io/user_content/worlds/406acf24-99b1-4119-8883-4fcda4250743/406acf24-99b1-4119-8883-4fcda4250743.png",
        //     },
        //     "maxPlayer": 100,
        //     "currentPlayerCount": 6,
        //     "members": [
        //         {
        //             "id": "7452ea11-86ab-86e8-42bd-1d4d24ed7da6",
        //             "name": "Momofier",
        //             "imageUrl": "https://files.abidata.io/user_images/7452ea11-86ab-86e8-42bd-1d4d24ed7da6-61f16a339b94a.png",
        //         },
        //         {
        //             "id": "86ce8e72-9204-359d-1ca0-678ec6783a90",
        //             "name": "GhostRobot",
        //             "imageUrl": "https://files.abidata.io/user_images/86ce8e72-9204-359d-1ca0-678ec6783a90-63c6e5b3be27d.png",
        //         },
        //         {
        //             "id": "a4e27c5c-44ef-59e1-5509-f50abf709bdf",
        //             "name": "fireblazecar",
        //             "imageUrl": "https://files.abidata.io/user_images/a4e27c5c-44ef-59e1-5509-f50abf709bdf-63b0400925be6.png",
        //         },
        //         {
        //             "id": "ccee6b2d-975d-9052-415e-d8b2823914c6",
        //             "name": "Katsura...",
        //             "imageUrl": "https://files.abidata.io/user_images/ccee6b2d-975d-9052-415e-d8b2823914c6-63a1f5968e9a9.png",
        //         },
        //         {
        //             "id": "566fb033-d42d-2a36-4cd4-344ab9db43c7",
        //             "name": "logansanders6",
        //             "imageUrl": "https://files.abidata.io/user_images/00default.png",
        //         },
        //         {
        //             "id": "2c9a6efa-d57a-fed8-659f-24b40eee002d",
        //             "name": "stormhybrid15",
        //             "imageUrl": "https://files.abidata.io/user_images/2c9a6efa-d57a-fed8-659f-24b40eee002d-634aebc53d066.png",
        //         },
        //     ],
        // };


    }

    async Search(term) {

        // term = [{
        //     type: 'prop',
        //     id: '5cb59af7-2d39-4ad4-9650-437d38ebd09d',
        //     name: 'Staff Of Cheese 1/3 Size (Free Grip)',
        //     imageUrl: 'https://files.abidata.io/user_content/spawnables/5cb59af7-2d39-4ad4-9650-437d38ebd09d/5cb59af7-2d39-4ad4-9650-437d38ebd09d.png'
        // }];

        const searchResults = await CVRHttp.Search(term);
        for (const searchResult of searchResults) {
            if (searchResult?.imageUrl) {
                await LoadImage(searchResult.imageUrl, searchResult);
            }
        }
        return searchResults;
    }

    async RefreshFriendRequests() {
        const friendRequests = await CVRHttp.GetMyFriendRequests();
        await this.UpdateFriendRequests(friendRequests, true);
    }

    async UpdateFriendRequests(friendRequests, isHttpRequest) {

        // Clear the current friend requests, because http request are the ground truth!
        if (isHttpRequest) this.friendRequests = {};

        for (const friendRequest of friendRequests) {
            if (friendRequest?.imageUrl) {
                await LoadImage(friendRequest.imageUrl, friendRequest);
            }
            // Save/Replace the request on cache
            this.friendRequests[friendRequest.id] = friendRequest;
        }

        // friendRequests = [{
        //     "receiverId": "c4eee443-98a0-bab8-a583-f1d9fa10a7d7",
        //     "id": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3",
        //     "name": "Kafeijao",
        //     "imageUrl": "https://files.abidata.io/user_images/4a1661f1-2eeb-426e-92ec-1b2f08e609b3.png"
        // }]
        this.SendToRenderer('friend-requests', Object.values(this.friendRequests));
    }

    async GetContentShares(contentType, contentId) {

        let response;

        try {
            switch (contentType) {
                case PublicContentType.AVATARS:
                    response = await CVRHttp.GetAvatarShares(contentId);
                    break;
                case PublicContentType.PROPS:
                    response = await CVRHttp.GetPropShares(contentId);
                    break;
                default:
                    log.error(`[GetContentShares] ${contentType} content type is not supported at the moment.`);
                    return [];
            }

            // Extract the actual shares array from the response
            // API returns { value: [...] } structure
            const entries = response?.value || [];

            // Ensure entries is valid and is an array
            if (!Array.isArray(entries)) {
                log.warn(`[GetContentShares] Invalid entries response for ${contentType} ${contentId}:`, response);
                return [];
            }

            // Process images for each entry
            for (const entry of entries) {
                if (entry?.image) {
                    await LoadImage(entry.image, entry);
                }
            }

            return entries;
        } catch (error) {
            log.error(`[GetContentShares] Error fetching shares for ${contentType} ${contentId}:`, error);
            return [];
        }
    }

    async AddContentShares(contentType, contentId, userId) {
        switch (contentType) {
            case PublicContentType.AVATARS:
                return (await CVRHttp.AddAvatarShare(contentId, userId))?.message;
            case PublicContentType.PROPS:
                return (await CVRHttp.AddPropShare(contentId, userId))?.message;
            default:
                log.error(`[AddContentShares] ${contentType} content type is not supported at the moment.`);
                break;
        }
    }

    async RemoveContentShares(contentType, contentId, userId) {
        switch (contentType) {
            case PublicContentType.AVATARS:
                return (await CVRHttp.RemoveAvatarShare(contentId, userId))?.message;
            case PublicContentType.PROPS:
                return (await CVRHttp.RemovePropShare(contentId, userId))?.message;
            default:
                log.error(`[RemoveContentShares] ${contentType} content type is not supported at the moment.`);
                break;
        }
    }

    async GetRandomContent(contentType, count) {
        let entries;
        switch (contentType) {
            case PublicContentType.AVATARS:
                entries = await CVRHttp.GetRandomAvatars(count);
                break;
            case PublicContentType.WORLDS:
                entries = await CVRHttp.GetRandomWorlds(count);
                break;
            case PublicContentType.PROPS:
                entries = await CVRHttp.GetRandomProps(count);
                break;
        }
        for (const entry of entries) {
            if (entry?.image) {
                await LoadImage(entry.image, entry);
                // Normalize the image property to imageUrl for consistency with other APIs
                entry.imageUrl = entry.image;
            }
        }
        // Example:
        // [
        //     {
        //         "platforms": [
        //             "Pc_Standalone"
        //         ],
        //         "public": true,
        //         "description": "A realistic club in the middle of the ocean, have fun\nVersion: 1.0",
        //         "image": "https://files.abidata.io/user_content/worlds/f33fbbf6-5a42-4a0a-a817-e914b21fe929/f33fbbf6-5a42-4a0a-a817-e914b21fe929.png",
        //         "id": "f33fbbf6-5a42-4a0a-a817-e914b21fe929",
        //         "name": "Lost Ocean Club"
        //     }
        // ]
        return entries;
    }

    async GetAvatarById(avatarId) {
        const avatar = await CVRHttp.GetAvatarById(avatarId);
        if (avatar?.imageUrl) {
            await LoadImage(avatar.imageUrl, avatar);
        }
        // Load the creator/user images
        if (avatar?.user) {
            await LoadUserImages(avatar.user);
        }
        return avatar;
    }

    async GetPropById(propId) {
        const prop = await CVRHttp.GetPropById(propId);
        if (prop?.imageUrl) {
            await LoadImage(prop.imageUrl, prop);
        }
        // Load the creator/author images
        if (prop?.author) {
            await LoadUserImages(prop.author);
        }
        return prop;
    }

    // Advanced Avatar Settings methods
    async GetAvatarAdvancedSettings(avatarId) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const advAvatarPath = this.#GetAdvAvatarFilePath(avatarId);
            
            if (!fs.existsSync(advAvatarPath)) {
                return null; // No advanced settings file exists
            }
            
            const fileContent = await fs.promises.readFile(advAvatarPath, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            log.error(`[GetAvatarAdvancedSettings] Failed to read advanced settings for avatar ${avatarId}:`, error);
            throw error;
        }
    }

    async SaveAvatarAdvancedSettings(avatarId, settings) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const advAvatarPath = this.#GetAdvAvatarFilePath(avatarId);
            const advAvatarDir = path.dirname(advAvatarPath);
            
            // Ensure the directory exists
            await fs.promises.mkdir(advAvatarDir, { recursive: true });
            
            // Write the settings to file
            await fs.promises.writeFile(advAvatarPath, JSON.stringify(settings, null, 4), 'utf8');
            
            log.info(`[SaveAvatarAdvancedSettings] Successfully saved advanced settings for avatar ${avatarId}`);
            return { success: true };
        } catch (error) {
            log.error(`[SaveAvatarAdvancedSettings] Failed to save advanced settings for avatar ${avatarId}:`, error);
            throw error;
        }
    }

    async HasAvatarAdvancedSettings(avatarId) {
        const fs = require('fs');
        
        try {
            // First check if CVR path is configured
            const cvrPath = Config.GetCVRPath();
            if (!cvrPath) {
                return { 
                    hasSettings: false, 
                    reason: 'cvr_path_not_configured',
                    message: 'ChilloutVR path not configured'
                };
            }
            
            // Check if CVR directory exists
            const cvrDataPath = path.join(cvrPath, 'ChilloutVR_Data');
            if (!fs.existsSync(cvrDataPath)) {
                return { 
                    hasSettings: false, 
                    reason: 'cvr_directory_not_found',
                    message: 'ChilloutVR directory not found',
                    expectedPath: cvrDataPath
                };
            }
            
            // Check if AAS directory exists
            const aasDirectory = path.join(cvrDataPath, 'AvatarsAdvancedSettingsProfiles');
            if (!fs.existsSync(aasDirectory)) {
                return { 
                    hasSettings: false, 
                    reason: 'aas_directory_not_found',
                    message: 'Advanced Avatar Settings directory not found',
                    expectedPath: aasDirectory
                };
            }
            
            // Finally check if the specific avatar settings file exists
            const advAvatarPath = this.#GetAdvAvatarFilePath(avatarId);
            log.debug(`[HasAvatarAdvancedSettings] Checking for avatar ${avatarId} at path: ${advAvatarPath}`);
            
            const exists = fs.existsSync(advAvatarPath);
            log.debug(`[HasAvatarAdvancedSettings] File exists: ${exists}`);
            
            return { 
                hasSettings: exists, 
                reason: exists ? 'found' : 'file_not_found',
                message: exists ? 'Advanced settings found' : 'No advanced settings file found'
            };
        } catch (error) {
            log.error(`[HasAvatarAdvancedSettings] Failed to check advanced settings for avatar ${avatarId}:`, error);
            return { 
                hasSettings: false, 
                reason: 'error',
                message: error.message
            };
        }
    }

    #GetAdvAvatarFilePath(avatarId) {
        const path = require('path');
        
        // Get the CVR path from config - using the correct method from config.js
        const cvrPath = Config.GetCVRPath();
        log.debug(`[GetAdvAvatarFilePath] CVR path from config: ${cvrPath}`);
        
        if (!cvrPath) {
            throw new Error('ChilloutVR path not configured');
        }
        
        // Build the path to the AvatarsAdvancedSettingsProfiles directory
        const advAvatarDir = path.join(cvrPath, 'ChilloutVR_Data', 'AvatarsAdvancedSettingsProfiles');
        const advAvatarPath = path.join(advAvatarDir, `${avatarId}.advavtr`);
        
        log.debug(`[GetAdvAvatarFilePath] Constructed path: ${advAvatarPath}`);
        
        return advAvatarPath;
    }

    async GetWorldsByCategory(categoryId, page = 0, sort = 'Default', direction = 'Ascending') {
        try {
            const reqResult = await CVRHttp.GetWorldsByCategory(categoryId, page, sort, direction);
            
            // Load images for all worlds
            for (const world of reqResult.entries || []) {
                if (world?.imageUrl) {
                    await LoadImage(world.imageUrl, world);
                }
            }
            
            log.info(`[GetWorldsByCategory] Loaded ${reqResult.entries?.length || 0} worlds from category ${categoryId}, page ${page}`);
            return reqResult.entries || [];
        } catch (error) {
            log.error(`[GetWorldsByCategory] Failed to get worlds from category ${categoryId}:`, error);
            throw error;
        }
    }
}

module.exports = {
    Core,
};
