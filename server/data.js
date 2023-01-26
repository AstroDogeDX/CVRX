const cache = require('./cache.js');

class Core {

    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.friends = {};
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
            if ('imageUrl' in updatedFriend) {
                const imgUrl = updatedFriend.imageUrl;
                try {
                    const nativeImg = await cache.FetchImage(imgUrl);
                    // Send the loaded image to the main window
                    this.mainWindow.webContents.send('friends-image-load', {
                        url: imgUrl,
                        imgBase64: nativeImg.toDataURL(),
                    });
                }
                catch (e) {
                    console.error(e);
                }
            }
        }
    }
}

module.exports = {
    Core,
};