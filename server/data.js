const { ipcMain } = require('electron');
const cache = require('./cache.js');
const CVRHttp = require('./api_cvr_http');
const CVRWebsocket = require('./api_cvr_ws');


const ToastTypes = Object.freeze({
    GOOD: 'confirm',
    BAD: 'error',
    INFO: 'info',
});


function LoadImage(url) {
    const hashedFileName = cache.GetHash(url);
    cache.QueueFetchImage({ url: url, hash: hashedFileName });
    return hashedFileName;
}

function LoadUserImages(userObject) {
    if (userObject?.imageUrl) {
        userObject.imageHash = LoadImage(userObject.imageUrl);
    }
    if (userObject?.avatar?.imageUrl) {
        userObject.avatar.imageHash = LoadImage(userObject.avatar.imageUrl);
    }
    if (userObject?.featuredBadge?.image) {
        userObject.featuredBadge.imageHash = LoadImage(userObject.featuredBadge.image);
    }
    if (userObject?.featuredGroup?.image) {
        userObject.featuredGroup.imageHash = LoadImage(userObject.featuredGroup.image);
    }
}


class Core {

    constructor(mainWindow) {

        this.mainWindow = mainWindow;

        this.mainWindow.webContents.send('initial-load-start');

        this.userId = '';
        this.friends = {};
        this.categories = {};

        this.friendRequests = {};

        this.#SetupHandlers();
    }

    #SetupHandlers() {

        // Setup on events for IPC
        ipcMain.on('refresh-user-stats', (_event) => this.RefreshFriendRequests());
        ipcMain.on('refresh-friend-requests', (_event) => this.RefreshFriendRequests());
        ipcMain.on('refresh-worlds-category', (_event, worldCategoryId) => this.UpdateWorldsByCategory(worldCategoryId));

        // Setup handlers for IPC
        ipcMain.handle('get-user-by-id', (_event, userId) => this.GetUserById(userId));
        ipcMain.handle('get-world-by-id', (_event, worldId) => this.GetWorldById(worldId));
        ipcMain.handle('get-instance-by-id', (_event, instanceId) => this.GetInstanceById(instanceId));
        ipcMain.handle('search', (_event, term) => this.Search(term));

        // Friendship
        ipcMain.handle('friend-request-send', (_event, userId) => CVRWebsocket.SendFriendRequest(userId));
        ipcMain.handle('friend-request-accept', async (_event, userId) => {
            await CVRWebsocket.AcceptFriendRequest(userId);
            this.RefreshFriendRequests().then().catch(console.error);
            this.FriendsUpdate(await CVRHttp.GetMyFriends(), true).then().catch(console.error);
        });
        ipcMain.handle('friend-request-decline', async (_event, userId) => {
            await CVRWebsocket.DeclineFriendRequest(userId);
            await this.RefreshFriendRequests();
        });
        ipcMain.handle('unfriend', async (_event, userId) => {
            await CVRWebsocket.Unfriend(userId);
            this.FriendsUpdate(await CVRHttp.GetMyFriends(), true).then().catch(console.error);
        });

        // Moderation
        ipcMain.handle('block-user', (_event, userId) => CVRWebsocket.BlockUser(userId));
        ipcMain.handle('unblock-user', (_event, userId) => CVRWebsocket.UnblockUser(userId));

        // Setup Handlers for the websocket
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.ONLINE_FRIENDS, (friendsInfo) => this.FriendsUpdate(friendsInfo, false));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.INVITES, (invites) => {
            // This always send all of them!
            // Note: The invites will time out over time, and when they do, we get another full update
            for (const invite of invites) {
                if (invite?.user?.imageUrl) {
                    invite.user.imageHash = LoadImage(invite.user.imageUrl);
                }
                if (invite?.world?.imageUrl) {
                    invite.world.imageHash = LoadImage(invite.world.imageUrl);
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
        });
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.REQUEST_INVITES, (requestInvites) => {
            // This always send all of them!
            // Note: The requestInvites will time out over time, and when they do, we get another full update
            for (const requestInvite of requestInvites) {
                if (requestInvite?.sender?.imageUrl) {
                    requestInvite.sender.imageHash = LoadImage(requestInvite.sender.imageUrl);
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
        });
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.FRIEND_REQUESTS, (friendRequests) => this.UpdateFriendRequests(friendRequests, false));

        // Notifications
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.MENU_POPUP, (_data, msg) => this.mainWindow.webContents.send('notification', msg, ToastTypes.INFO));
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.HUD_MESSAGE, (_data, msg) => this.mainWindow.webContents.send('notification', msg, ToastTypes.INFO));
    }

    async Initialize(username, accessKey) {

        // Get the user id
        await this.Authenticate(username, accessKey);
        // Get our own user details
        const ourUser = await this.GetUserById(this.userId);
        // Send our user to the frontend
        this.mainWindow.webContents.send('active-user-load', ourUser);
        // Load our friends list
        await this.FriendsUpdate(await CVRHttp.GetMyFriends(), true);
        // Load the categories
        // await this.updateCategories(CVRHttp.GetCategories());


        // Initialize the websocket
        await CVRWebsocket.ConnectWithCredentials(username, accessKey);

        // Call more events to update the initial state
        await Promise.allSettled([
            this.UpdateUserStats(),
            this.RefreshFriendRequests(),
            this.UpdateWorldsByCategory('wrldactive'),
        ]);

        this.mainWindow.webContents.send('initial-load-finish');
    }

    async Authenticate(username, accessKey) {
        const authentication = await CVRHttp.AuthenticateViaAccessKey(username, accessKey);
        this.userId = authentication.userId;

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

    async FriendsUpdate(friendsInfo, isRefresh) {

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

        const updatedFriends = [];
        const newFriendsObject = isRefresh ? {} : this.friends;

        for (let friendInfo of friendsInfo) {
            if (!friendInfo || !friendInfo.id) continue;

            if (!isRefresh && !this.friends[friendInfo.id]) {
                // We got a friend update from someone that's not on our cache. Let's refresh the friends list!
                await this.FriendsUpdate(await CVRHttp.GetMyFriends(), true);
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

            // Add friend to the list that will be sent to the frontend for updates
            updatedFriends.push(friendInstance);
        }

        // Overwrite our cache if it's a refresh
        if (isRefresh) this.friends = newFriendsObject;

        // Send the friend results to the main window
        this.mainWindow.webContents.send('friends-refresh', updatedFriends, isRefresh);
    }

    async UpdateCategories(categories) {
        this.categories = categories;
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
                world.imageHash = LoadImage(world.imageUrl);
            }
        }
        this.mainWindow.webContents.send('worlds-category-requests', categoryId, worlds);

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
            world.imageHash = LoadImage(world.imageUrl);
        }
        if (world?.author?.imageUrl) {
            world.author.imageHash = LoadImage(world.author.imageUrl);
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
            instance.world.imageHash = LoadImage(instance.world.imageUrl);
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
                searchResult.imageHash = LoadImage(searchResult.imageUrl);
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
                friendRequest.imageHash = LoadImage(friendRequest.imageUrl);
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
