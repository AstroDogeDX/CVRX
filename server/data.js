const { ipcMain } = require('electron')
const cache = require('./cache.js');
const CVRHttp = require('./api_cvr_http');
const CVRWebsocket = require('./api_cvr_ws');


function LoadUserImages(userObject) {
    cache.QueueFetchImage(userObject?.imageUrl);
    cache.QueueFetchImage(userObject?.avatar?.imageUrl);
    cache.QueueFetchImage(userObject?.featuredBadge?.image);
    cache.QueueFetchImage(userObject?.featuredGroup?.image);
}


class Core {

    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.friends = {};
        this.categories = {};
    }

    async initialize() {

        ipcMain.handle('get-user-by-id', this.GetUserById.bind(this));
        ipcMain.handle('get-worlds-active', this.GetWorldsActive.bind(this));
        ipcMain.handle('get-world-by-id', this.GetWorldById.bind(this));
        ipcMain.handle('get-instance-by-id', this.GetInstanceById.bind(this));

        // Fetch and update the friends and categories
        if (process.env.HTTP_REQUESTS === 'true') {
            await this.updateFriendsInfo(await CVRHttp.GetMyFriends());
            await this.updateCategories(CVRHttp.GetCategories());
        }

        // Add listener for friends state updates
        CVRWebsocket.EventEmitter.on(CVRWebsocket.ResponseType.ONLINE_FRIENDS, this.updateFriendsInfo.bind(this));

        // Initialize the websocket
        if (process.env.CONNECT_TO_SOCKET === 'true') await CVRWebsocket.ConnectWebsocket();
    }

    async updateFriendsInfo(friendsInfo) {
        let updatedFriends = [];
        for (let friendInfo of friendsInfo) {
            // Create the friend instance if it doesn't exist
            const friendInstance = this.friends[friendInfo.id] ??= {};
            // Merge the new properties we're getting from the usersOnlineChange
            Object.assign(friendInstance, friendInfo);
            // Add friend to the list that will be sent to the frontend for updates
            updatedFriends.push(friendInstance);
        }

        // Send the friend results to the main window
        this.mainWindow.webContents.send('friends-update', friendsInfo);

        // If there are image urls, fetch them (1 by 1)
        for (const updatedFriend of updatedFriends) {
            cache.QueueFetchImage(updatedFriend?.imageUrl);
        }
    }

    async updateCategories(categories) {
        this.categories = categories;
    }

    async GetUserById(_event, userId) {

        if (process.env.HTTP_REQUESTS === 'true') {
            const user = await CVRHttp.GetUserById(userId);
            LoadUserImages(user);
            return user;
        }

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

    async GetWorldsActive(_event) {

        if (process.env.HTTP_REQUESTS === 'true') {
            const worlds = await CVRHttp.GetWorldsActive();
            for (const world of worlds) {
                cache.QueueFetchImage(world?.imageUrl);
            }
            return worlds;
        }

        // const worlds = [
        //     {
        //         playerCount: 9,
        //         id: '406acf24-99b1-4119-8883-4fcda4250743',
        //         name: 'The Purple Fox',
        //         imageUrl: 'https://files.abidata.io/user_content/worlds/406acf24-99b1-4119-8883-4fcda4250743/406acf24-99b1-4119-8883-4fcda4250743.png',
        //     },
        // ];
    }

    async GetWorldById(_event, worldId) {

        if (process.env.HTTP_REQUESTS === 'true') {
            const world = await CVRHttp.GetWorldById(worldId);
            cache.QueueFetchImage(world?.imageUrl);
            cache.QueueFetchImage(world?.author?.imageUrl);
            return world;
        }

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

    async GetInstanceById(_event, instanceId) {

        if (process.env.HTTP_REQUESTS === 'true') {
            const instance = await CVRHttp.GetInstanceById(instanceId);
            cache.QueueFetchImage(instance?.world?.imageUrl);
            LoadUserImages(instance?.author);
            LoadUserImages(instance?.owner);
            for (const instanceMember of instance?.members ?? []) {
                LoadUserImages(instanceMember);
            }
            return instance;
        }

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
}

module.exports = {
    Core,
};