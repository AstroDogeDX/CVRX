const { ipcMain } = require('electron');
const cache = require('./cache.js');
const CVRHttp = require('./api_cvr_http');
const CVRWebsocket = require('./api_cvr_ws');
const Config = require('./config');

const log = require('./logger').GetLogger('Data');
const logRenderer = require('../server/logger').GetLogger('Renderer');

let recurringIntervalId;


const ToastTypes = Object.freeze({
    GOOD: 'confirm',
    BAD: 'error',
    INFO: 'info',
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
});


function IsObjectEqualExcept(obj1, obj2, keysToIgnore) {
    return JSON.stringify(obj1, (key, value) => keysToIgnore.includes(key) ? undefined : value) ===
    JSON.stringify(obj2, (key, value) => keysToIgnore.includes(key) ? undefined : value);
}

function LoadImage(url, obj) {
    if (!url) return;
    const hashedFileName = cache.GetHash(url);
    cache.QueueFetchImage({ url: url, hash: hashedFileName, obj: obj });
    obj.imageHash = hashedFileName;
}

function LoadUserImages(userObject) {
    if (userObject?.imageUrl) {
        LoadImage(userObject.imageUrl, userObject);
    }
    if (userObject?.avatar?.imageUrl) {
        LoadImage(userObject.avatar.imageUrl, userObject.avatar);
    }
    if (userObject?.featuredBadge?.image) {
        LoadImage(userObject.featuredBadge.image, userObject.featuredBadge);
    }
    if (userObject?.featuredGroup?.image) {
        LoadImage(userObject.featuredGroup.image, userObject.featuredGroup);
    }
}


class Core {

    constructor(mainWindow) {

        this.mainWindow = mainWindow;

        this.#ResetCachingObjects();

        this.#SetupHandlers();
    }

    #ResetCachingObjects() {

        this.friends = {};
        this.categories = {};

        this.friendRequests = {};

        this.recentActivity = [];
        this.recentActivityCache = {
            [ActivityUpdatesType.Friends]: {},
        };
        this.recentActivityInitialFriends = false;
    }

    #SetupHandlers() {

        // Setup on events for IPC
        ipcMain.on('refresh-user-stats', (_event) => this.RefreshFriendRequests());
        ipcMain.on('refresh-friend-requests', (_event) => this.RefreshFriendRequests());
        ipcMain.on('refresh-worlds-category', (_event, worldCategoryId) => this.UpdateWorldsByCategory(worldCategoryId));

        // Active user
        ipcMain.on('active-user-refresh', (_event) => this.GetOurUserInfo());
        ipcMain.on('active-user-avatars-refresh', (_event) => this.GetOurUserAvatars());
        ipcMain.on('active-user-props-refresh', (_event) => this.GetOurUserProps());
        ipcMain.on('active-user-worlds-refresh', (_event) => this.GetOurUserWorlds());

        // Logging
        ipcMain.on('log-debug', (_event, msg, data) => logRenderer.debug(msg, data));
        ipcMain.on('log-info', (_event, msg, data) => logRenderer.info(msg, data));
        ipcMain.on('log-warn', (_event, msg, data) => logRenderer.warn(msg, data));
        ipcMain.on('log-error', (_event, msg, data) => logRenderer.error(msg, data));

        // Setup handlers for IPC
        ipcMain.handle('get-user-by-id', (_event, userId) => this.GetUserById(userId));
        ipcMain.handle('get-world-by-id', (_event, worldId) => this.GetWorldById(worldId));
        ipcMain.handle('get-instance-by-id', (_event, instanceId) => this.GetInstanceById(instanceId));
        ipcMain.handle('search', (_event, term) => this.Search(term));

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
        ipcMain.on('logout', async (_event) => await this.Disconnect());
        ipcMain.handle('delete-credentials', async (_event, username) => Config.ClearCredentials(username));
        ipcMain.handle('import-game-credentials', async (_event) => {
            await Config.ImportCVRCredentials();
            await this.SendToLoginPage();
        });

        // Moderation
        ipcMain.handle('block-user', (_event, userId) => CVRWebsocket.BlockUser(userId));
        ipcMain.handle('unblock-user', (_event, userId) => CVRWebsocket.UnblockUser(userId));

        // Socket Events
        CVRWebsocket.EventEmitter.on(CVRWebsocket.SocketEvents.CONNECTED, () => {
            this.recentActivityInitialFriends = true;
        });

        // Setup Handlers for the websocket
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.ONLINE_FRIENDS, (friendsInfo) => this.FriendsUpdate(false, friendsInfo));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.INVITES, (invites) => this.InvitesUpdate(invites));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.REQUEST_INVITES, (requestInvites) => this.RequestInvitesUpdate(requestInvites));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.FRIEND_REQUESTS, (friendRequests) => this.UpdateFriendRequests(friendRequests, false));

        // Notifications
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.MENU_POPUP, (_data, msg) => this.mainWindow.webContents.send('notification', msg, ToastTypes.INFO));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.HUD_MESSAGE, (_data, msg) => this.mainWindow.webContents.send('notification', msg, ToastTypes.INFO));
    }

    async Disconnect() {

        // Disable the websocket reconnection
        if (recurringIntervalId) clearInterval(recurringIntervalId);
        await CVRWebsocket.DisconnectWebsocket();
        await Config.ClearActiveCredentials();
        cache.Initialize(this.mainWindow);

        // Reset cached stuff
        this.#ResetCachingObjects();

        await this.SendToLoginPage();
    }

    async Authenticate(credentialUser, credentialSecret, isAccessKey, saveCredentials) {

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

        // Call more events to update the initial state
        await Promise.allSettled([
            this.GetOurUserInfo(authentication.userId),
            // this.GetOurUserAvatars(),
            // this.GetOurUserProps(),
            // this.GetOurUserWorlds(),
            this.FriendsUpdate(true),
            this.UpdateUserStats(),
            this.RefreshFriendRequests(),
            this.UpdateWorldsByCategory(WorldCategories.ActiveInstances),
            //this.UpdateCategories(),
        ]);

        // Initialize the websocket
        await CVRWebsocket.ConnectWithCredentials(authentication.username, authentication.accessKey);

        // Tell cache we're initialized to start loading images...
        cache.StartProcessQueue();

        // Tell the renderer to go to the home page
        this.mainWindow.webContents.send('page-home');

        // Schedule recurring API Requests every 5 minutes
        if (recurringIntervalId) clearInterval(recurringIntervalId);
        let failedTimes = 0;
        recurringIntervalId = setInterval(async () => {
            try {
                await Promise.allSettled([
                    this.UpdateUserStats(),
                    this.UpdateWorldsByCategory(WorldCategories.ActiveInstances),
                ]);
                failedTimes = 0;
            }
            catch (e) {
                if (failedTimes > 3) {
                    log.error('[Initialize] We failed to update active worlds 3 times, stopping...', e);
                    if (recurringIntervalId) clearInterval(recurringIntervalId);
                    return;
                }
                log.error('[Initialize] Updating the currently active worlds (recurring every 5 mins)...', e);
                failedTimes++;
            }
        }, 5 * 60 * 1000);

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
            LoadImage(activeCredential.ImageUrl, activeCredential);
        }

        this.mainWindow.webContents.send('page-login', availableCredentials);
    }

    async GetOurUserInfo(ourUserID) {
        const ourUser = await this.GetUserById(ourUserID);
        await Config.SetActiveUserImage(ourUser?.imageUrl);
        this.mainWindow.webContents.send('active-user-load', ourUser);
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
                LoadImage(ourAvatar.imageUrl, ourAvatar);
            }
        }
        this.mainWindow.webContents.send('active-user-avatars-load', ourAvatars);
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
                LoadImage(ourProp.imageUrl, ourProp);
            }
        }
        this.mainWindow.webContents.send('active-user-props-load', ourProps);
    }

    async GetOurUserWorlds() {
        const ourWorlds = await this.UpdateWorldsByCategory(WorldCategories.Mine);
        // const ourWorlds = [{
        //     playerCount: 9,
        //     id: '406acf24-99b1-4119-8883-4fcda4250743',
        //     name: 'The Purple Fox',
        //     imageUrl: 'https://files.abidata.io/user_content/worlds/406acf24-99b1-4119-8883-4fcda4250743/406acf24-99b1-4119-8883-4fcda4250743.png',
        // }];
        this.mainWindow.webContents.send('active-user-worlds-load', ourWorlds);
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
        }

        // Keep the recent activity capped at 25 elements
        this.recentActivity = this.recentActivity.slice(0,25);

        // Send recent activities update to the view
        this.mainWindow.webContents.send('recent-activity-update', this.recentActivity);
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
            LoadUserImages(friendInstance);

            // Add the friend info to our cache
            newFriendsObject[friendInstance.id] = friendInstance;
        }

        // Overwrite our cache if it's a refresh
        if (isRefresh) this.friends = newFriendsObject;

        // Send the friend results to the main window
        this.mainWindow.webContents.send('friends-refresh', Object.values(this.friends), isRefresh);

        // Handle the activity update asynchronously
        if (!isRefresh) {
            this.UpdateRecentActivity(ActivityUpdatesType.Friends, friendsInfo).then().catch(err => log.error('[FriendsUpdate]', err));
        }
    }

    InvitesUpdate(invites) {
        // This always send all of them!
        // Note: The invites will time out over time, and when they do, we get another full update
        for (const invite of invites) {
            if (invite?.user?.imageUrl) {
                LoadImage(invite.user.imageUrl, invite.user);
            }
            if (invite?.world?.imageUrl) {
                LoadImage(invite.world.imageUrl, invite.world);
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
        this.mainWindow.webContents.send('invites', invites);
    }

    RequestInvitesUpdate(requestInvites) {
        // This always send all of them!
        // Note: The requestInvites will time out over time, and when they do, we get another full update
        for (const requestInvite of requestInvites) {
            if (requestInvite?.sender?.imageUrl) {
                LoadImage(requestInvite.sender.imageUrl, requestInvite.sender);
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
        this.mainWindow.webContents.send('invite-requests', requestInvites);
    }

    async UpdateCategories() {
        this.categories = await CVRHttp.GetCategories();
    }

    async GetUserById(userId) {

        const user = await CVRHttp.GetUserById(userId);
        LoadUserImages(user);
        return user;

        // const userDetailed = {
        //     "onlineState": false,
        //     "isConnected": false,
        //     "isFriend": true,
        //     "isBlocked": false,
        //     "instance": null,
        //     "categories": [],
        //     "rank": "User",
        //     "featuredBadge": {
        //         "name": "Closed Alpha Participant",
        //         "image": "https://files.abidata.io/static_web/Badges/abi-alpha.png",
        //         "badgeLevel": 1,
        //     },
        //     "featuredGroup": {
        //         "name": "No group featured",
        //         "image": "https://files.abidata.io/static_web/NoHolderImage.png",
        //     },
        //     "avatar": {
        //         "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        //         "name": "Lop",
        //         "imageUrl": "https://files.abidata.io/user_content/avatars/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png",
        //     },
        //     "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        //     "name": "uSeRnAmE",
        //     "imageUrl": "https://files.abidata.io/user_images/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png",
        // };

    }

    async UpdateUserStats() {
        const userStats = await CVRHttp.GetUserStats();
        // usersOnline: { overall: 47, public: 14, notConnected: 9, other: 24 }
        this.mainWindow.webContents.send('user-stats', userStats);
    }

    async UpdateWorldsByCategory(categoryId) {

        const worlds = await CVRHttp.GetWorldsByCategory(categoryId);
        for (const world of worlds) {
            if (world?.imageUrl) {
                LoadImage(world.imageUrl, world);
            }
        }
        this.mainWindow.webContents.send('worlds-category-requests', categoryId, worlds);

        return worlds;

        // const worlds = [
        //     {
        //         playerCount: 9,
        //         id: '406acf24-99b1-4119-8883-4fcda4250743',
        //         name: 'The Purple Fox',
        //         imageUrl: 'https://files.abidata.io/user_content/worlds/406acf24-99b1-4119-8883-4fcda4250743/406acf24-99b1-4119-8883-4fcda4250743.png',
        //     },
        // ];
    }

    async GetWorldById(worldId) {

        const world = await CVRHttp.GetWorldById(worldId);
        if (world?.imageUrl) {
            LoadImage(world.imageUrl, world);
        }
        if (world?.author?.imageUrl) {
            LoadImage(world.author.imageUrl, world.author);
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
            LoadImage(instance.world.imageUrl, instance.world);
        }
        LoadUserImages(instance?.author);
        LoadUserImages(instance?.owner);
        for (const instanceMember of instance?.members ?? []) {
            LoadUserImages(instanceMember);
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
                LoadImage(searchResult.imageUrl, searchResult);
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
                LoadImage(friendRequest.imageUrl, friendRequest);
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
        this.mainWindow.webContents.send('friend-requests', Object.values(this.friendRequests));
    }

}

module.exports = {
    Core,
};
