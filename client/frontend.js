// ===========
// GLOBAL VARS
// ===========

const DetailsType = Object.freeze({
    User: Symbol('user'),
    World: Symbol('world'),
});

let toastTimer;

const toastDown = () => {
    toastTimer = setTimeout(() => {
        document.querySelector('.toast-notification').classList.remove('toast-up');
    }, 3000);
};

// =========
// FUNCTIONS
// =========

// Page changes via the Nav Bar
function swapNavPages(page) {
    document.querySelectorAll('.display-wrapper').forEach((e) => {
        e.style.display = 'none';
        document.getElementById(`display-${page}`).style.display = 'grid';
        // Sets the window title to 'CVRX - [Page Name]'
        document.title = 'CVRX - ' + page.charAt(0).toUpperCase() + page.slice(1);
    });
    switch (page) {
        case 'search':
            document.querySelector('#search-bar').value = '';
            document.querySelector('#search-bar').focus({ focusVisible: true });
            break;
        case 'friends':
            document.querySelector('.friends-filter').value = '';
            document.querySelector('.friends-filter').focus({ focusVisible: true });
            document.querySelectorAll('.friend-list-node').forEach((e) => {
                e.classList.remove('filtered-friend');
            });
            break;
        default:
            return;
    }
}

// ===============
// EVERYTHING ELSE
// ===============

// On start up, set page to Home
swapNavPages('home');

// Navbar Control Logic
document.querySelectorAll('.navbar-button').forEach((e) => {
    let tooltip = e.querySelector('.navbar-tooltip');
    e.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
    });
    e.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
    e.addEventListener('mouseup', () => {
        swapNavPages(e.dataset.page);
    });
});

// Friends Page & Online Sidebar
// -----------------------------

// Get user detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const user = await window.API.getUserById(userId);

// Get active worlds, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const worlds = await window.API.getWorldsActive();

// Get world detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const world = await window.API.getWorldById(worldId);

// Get instance detailed info, images will be sent later via: window.API.onImageLoaded, check data.js for the structure
// const instance = await window.API.getInstanceById(instanceId);

window.API.onGetActiveUser((_event, activeUser) => {
    console.log('Active User!');
    console.log(activeUser);
    document.querySelector('.home-user--user-icon').setAttribute('data-hash', activeUser.imageHash);
    document.querySelector('.home-user--user-name').innerHTML = activeUser.name;
    document.querySelector('.user-extra--user-avatar').innerHTML =
        `<img data-hash="${activeUser.avatar.imageHash}">${activeUser.avatar.name}`;
    document.querySelector('.user-extra--user-badge').innerHTML =
        `<img data-hash="${activeUser.featuredBadge.imageHash}">${activeUser.featuredBadge.name}`;
    document.querySelector('.user-extra--user-rank').innerHTML =
        `<img src="./img/ui/rank.png">${activeUser.rank}`;
    // document.querySelector("#user-greeting").innerHTML = activeUser.name;
    // activeUser = {
    //     onlineState: false,
    //     isConnected: false,
    //     isFriend: false,
    //     isBlocked: false,
    //     instance: null, // If we're online this might have our instance info
    //     categories: [],
    //     rank: 'User',
    //     featuredBadge: {
    //         name: 'No badge featured',
    //         image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4',
    //         badgeLevel: 0
    //     },
    //     featuredGroup: {
    //         name: 'No group featured',
    //         image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     avatar: {
    //         id: '5cde1f96-d62a-4231-bf53-a32693830fc2',
    //         name: 'Demo Bot',
    //         imageUrl: 'https://files.abidata.io/user_content/avatars/5cde1f96-d62a-4231-bf53-a32693830fc2/5cde1f96-d62a-4231-bf53-a32693830fc2.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     id: 'c4eee443-98a0-bab8-a583-f1d9fa10a7d7',
    //     name: 'CVRX',
    //     imageUrl: 'https://files.abidata.io/user_images/c4eee443-98a0-bab8-a583-f1d9fa10a7d7-63cfb4a4061d4.png',
    //     imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }
});

function getFriendStatus(friend) {
    if (!friend.isOnline) return 'Offline';
    if (!friend.instance) return 'Private Instance';
    if (friend.instance.name) return friend.instance.name;
    // switch (friend.instance.privacy) {
    //     case 0: return 'Public';
    //     case 1: return 'Friends of Friends';
    //     case 2: return 'Friend';
    // }
    return 'Unknown';
}

async function ShowDetails(entityType, entityId) {

    const detailsWindow = document.querySelector('#details-window');
    detailsWindow.replaceChildren();

    // activeUser = {
    //     onlineState: false,
    //     isConnected: false,
    //     isFriend: false,
    //     isBlocked: false,
    //     instance: null, // If we're online this might have our instance info
    //     categories: [],
    //     rank: 'User',
    //     featuredBadge: {
    //         name: 'No badge featured',
    //         image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4',
    //         badgeLevel: 0
    //     },
    //     featuredGroup: {
    //         name: 'No group featured',
    //         image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     avatar: {
    //         id: '5cde1f96-d62a-4231-bf53-a32693830fc2',
    //         name: 'Demo Bot',
    //         imageUrl: 'https://files.abidata.io/user_content/avatars/5cde1f96-d62a-4231-bf53-a32693830fc2/5cde1f96-d62a-4231-bf53-a32693830fc2.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     id: 'c4eee443-98a0-bab8-a583-f1d9fa10a7d7',
    //     name: 'CVRX',
    //     imageUrl: 'https://files.abidata.io/user_images/c4eee443-98a0-bab8-a583-f1d9fa10a7d7-63cfb4a4061d4.png',
    //     imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }

    let entityInfo;

    switch (entityType) {
        case DetailsType.User:
            entityInfo = await window.API.getUserById(entityId);
            detailsWindow.innerHTML = `
                <img  class="home-user--user-icon" src="https://placekitten.com/150/150" data-hash="${entityInfo.imageHash}"/>
                <div class="home-user--user-name">${entityInfo.name}</div>
                <div class="home-user--user-extra">
                    <div class="user-extra--user-avatar">
                    <img src="https://placekitten.com/25/25" data-hash="${entityInfo.avatar.imageHash}"/>
                    ${entityInfo.avatar.name}
                </div>
                <div class="user-extra--user-badge">
                    <img src="https://placekitten.com/25/25" data-hash="${entityInfo.featuredBadge.imageHash}"/>
                    ${entityInfo.featuredBadge.name}
                </div>
                <div class="user-extra--user-rank">
                    <img src="img/ui/rank.png"/>
                    ${entityInfo.rank}
                </div>`;
            document.body.style.backgroundColor = 'black';
            document.onclick = () => detailsWindow.replaceChildren();
            break;
    }
}

window.API.onFriendsRefresh((_event, friends, isRefresh) => {
    console.log('Friends Refresh! isRefresh: ' + isRefresh);
    console.log(friends);

    const friendsBarNode = document.querySelector('.friends-bar-container');
    const friendsListNode = document.querySelector('.friends-wrapper');

    // Clear all children (this event sends all friends, we so can empty our previous state)
    friendsBarNode.replaceChildren();
    friendsListNode.replaceChildren();

    for (const friend of friends) {

        const friendStatus = getFriendStatus(friend);
        const onlineFriendInPrivateClass = friend.instance ? '' : 'friend-is-offline';
        // Depending on whether it's a refresh or not the image might be already loaded
        const friendImgSrc = friend.imageBase64 ?? 'https://placekitten.com/50/50';

        // Setting up the HTMLElement used for the Online Friends panel.
        if (friend.isOnline) {
            let onlineFriendNode = document.createElement('div');
            onlineFriendNode.onclick = () => ShowDetails(DetailsType.User, friend.id);
            onlineFriendNode.setAttribute('class', 'online-friend-node');
            onlineFriendNode.innerHTML = `
                <img class="online-friend-image" src="${friendImgSrc}" data-hash="${friend.imageHash}"/>
                <p class="online-friend-name">${friend.name}</p>
                <p class="online-friend-world ${onlineFriendInPrivateClass}">${friendStatus}</p>`;
            friendsBarNode.appendChild(onlineFriendNode);
        }

        // Setting up the HTMLElement used for the Friends List page.
        let listFriendNode = document.createElement('div');
        const offlineFriendClass = friend.isOnline ? '' : 'friend-is-offline';
        const imgOnlineClass = friend.isOnline ? 'class="icon-is-online"' : '';
        listFriendNode.onclick = () => ShowDetails(DetailsType.User, friend.id);
        listFriendNode.setAttribute('class', 'friend-list-node');
        listFriendNode.innerHTML = `
            <img ${imgOnlineClass} src="${friendImgSrc}" data-hash="${friend.imageHash}"/>
            <p class="friend-name">${friend.name}</p>
            <p class="friend-status ${offlineFriendClass}">${friendStatus}</p>`;
        friendsListNode.appendChild(listFriendNode);
    }

    // Usually it will be an array with just those 4 elements.
    //
    // friends = [{
    //     id: 'c4eee443-98a0-bab8-a583-f1d9fa10a7d7',
    //     name: 'CVRX',
    //     imageUrl: 'https://files.abidata.io/user_images/c4eee443-98a0-bab8-a583-f1d9fa10a7d7-63cfb4a4061d4.png',
    //     imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }];

    // As we have seen these updates can have the instance to null, or have the instance with different levels
    // Of privacy:
    // 0: Public
    // 1: Friends of Friends
    // 2: Friends Only (with a friend of mine)

    // But in case the refresh is not the first one at app start, some other info might be included
    // All the possible information is:
    //
    // friends = [
    //     {
    //         onlineState: false,
    //         isConnected: false,
    //         isFriend: false,
    //         isBlocked: false,
    //         instance: null, // ORRRR
    //         //instance: { id: "i+51985e5559117d5f-951509-ff0a95-1a3dc443", "name": "The Purple Fox (#417388)", "privacy":1 }
    //         categories: [],
    //         rank: 'User',
    //         featuredBadge: {
    //             name: 'No badge featured',
    //             image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //             imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4',
    //             badgeLevel: 0
    //         },
    //         featuredGroup: {
    //             name: 'No group featured',
    //             image: 'https://files.abidata.io/static_web/NoHolderImage.png',
    //             imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //         },
    //         avatar: {
    //             id: '5cde1f96-d62a-4231-bf53-a32693830fc2',
    //             name: 'Demo Bot',
    //             imageUrl: 'https://files.abidata.io/user_content/avatars/5cde1f96-d62a-4231-bf53-a32693830fc2/5cde1f96-d62a-4231-bf53-a32693830fc2.png',
    //             imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //         },
    //         id: 'c4eee443-98a0-bab8-a583-f1d9fa10a7d7',
    //         name: 'CVRX',
    //         imageUrl: 'https://files.abidata.io/user_images/c4eee443-98a0-bab8-a583-f1d9fa10a7d7-63cfb4a4061d4.png',
    //         imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     }
    // ]
});

// returns .imageBase64, .imageHash, .imageUrl
window.API.onImageLoaded((_event, image) => {
    document.querySelectorAll(`[data-hash="${image.imageHash}"]`).forEach((e) => {
        e.src = image.imageBase64;
    });
});


// Janky Search
// -----------------------------
const searchBar = document.getElementById('search-bar');
searchBar.addEventListener('keypress', async (event) => {
    const searchTerm = searchBar.value;

    // Ignore if the search term is empty, or the key pressed was not ENTER - or if the search term is <3 characters
    if (!searchTerm || searchTerm.length < 3 || event.key !== 'Enter') { return; }
    event.preventDefault();

    // Disable the search while we're fetching and populating the results
    searchBar.disabled = true;
    toastyNotification('Searching...');

    // Fetch the search results
    const results = await window.API.search(searchTerm);
    console.log('Searched!');
    console.log(results);

    // Types: avatar, prop, user, world
    //
    // results = [{
    //     type: 'prop',
    //     id: '5cb59af7-2d39-4ad4-9650-437d38ebd09d',
    //     name: 'Staff Of Cheese 1/3 Size (Free Grip)',
    //     imageUrl: 'https://files.abidata.io/user_content/spawnables/5cb59af7-2d39-4ad4-9650-437d38ebd09d/5cb59af7-2d39-4ad4-9650-437d38ebd09d.png',
    //     imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }];

    const searchOutputUsers = document.querySelector('.search-output--users');
    const searchOutputWorlds = document.querySelector('.search-output--worlds');
    const searchOutputAvatars = document.querySelector('.search-output--avatars');
    const searchOutputProps = document.querySelector('.search-output--props');

    const userResults = [];
    const worldsResults = [];
    const avatarResults = [];
    const propsResults = [];

    // Create the search result elements
    for (const result of results) {
        let searchResult = document.createElement('div');
        searchResult.setAttribute('class', 'search-output--node');
        searchResult.innerHTML = `
            <img src="https://placekitten.com/50/50" data-hash="${result.imageHash}"/>
            <p class="search-result-name">${result.name}</p>
            <p class="search-result-type">${result.type}</p>`;
        switch (result.type) {
            case 'user':
                userResults.push(searchResult);
                break;
            case 'world':
                worldsResults.push(searchResult);
                break;
            case 'avatar':
                avatarResults.push(searchResult);
                break;
            case 'prop':
                propsResults.push(searchResult);
                break;
            default:
                toastyNotification('Found a result with invalid type!', 'error');
        }
    }

    // Replace previous search results with the new ones
    searchOutputUsers.replaceChildren(...userResults);
    searchOutputWorlds.replaceChildren(...worldsResults);
    searchOutputAvatars.replaceChildren(...avatarResults);
    searchOutputProps.replaceChildren(...propsResults);

    // Re-enable the search
    searchBar.disabled = false;
    toastyNotification('Search Complete!', 'confirm');
});


// Janky Get Active Worlds
// -----------------------------
window.API.onWorldsByCategoryRefresh((_event, worldCategoryId, worldsInfo) => {

    if (worldCategoryId !== 'wrldactive') { return; }

    const homeActivity = document.querySelector('.home-activity--activity-wrapper');

    // Disable the element because we're loading stuffs (better if there is a spinner or something idk)
    homeActivity.disabled = true;

    console.log('Grabbed active worlds!');
    console.log(worldsInfo);

    // activeWorlds = [{
    //     playerCount: 1,
    //     id: 'e17e2d00-61fc-4d27-8031-4b9bdda50756',
    //     name: 'Avatarie & Glitch',
    //     imageUrl: 'https://files.abidata.io/user_content/worlds/e17e2d00-61fc-4d27-8031-4b9bdda50756/e17e2d00-61fc-4d27-8031-4b9bdda50756.png',
    //     imageHash: '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }];

    // Create the search result elements
    const elementsOfResults = [];
    for (const result of worldsInfo) {
        let activeWorldNode = document.createElement('div');
        activeWorldNode.setAttribute('class', 'home-activity--activity-node');
        activeWorldNode.innerHTML = `
            <img src="https://placekitten.com/50/50" data-hash="${result.imageHash}"/>
            <p class="search-result-name">${result.name}</p>
            <p class="search-result-player-count">${result.playerCount}</p>`;
        elementsOfResults.push(activeWorldNode);
    }

    // Replace previous search results with the new ones
    homeActivity.replaceChildren(...elementsOfResults);

    // Re-enable the element because we're loading stuffs (better if there is a spinner or something idk)
    searchBar.disabled = false;
});

// Janky invite listener
window.API.onInvites((_event, invites) => {
    console.log('Invites Received!');
    console.log(invites);
    // invites = [{
    //     "id": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3:yghREqSG",
    //     "user": {
    //         "id": "b3005d19-e487-bafc-70ac-76d2190d5a29",
    //         "name": "NotAKid",
    //         "imageUrl": "https://files.abidata.io/user_images/b3005d19-e487-bafc-70ac-76d2190d5a29.png",
    //         "imageHash": '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     "world": {
    //         "id": "95c9f8c9-ba9b-40f5-a957-3254ce2d2e91",
    //         "name": "Sakura Hotsprings",
    //         "imageUrl": "https://files.abidata.io/user_content/worlds/95c9f8c9-ba9b-40f5-a957-3254ce2d2e91/95c9f8c9-ba9b-40f5-a957-3254ce2d2e91.png",
    //         "imageHash": '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     "instanceId": "i+a08c7c940906f17d-829305-fd561f-171faa79",
    //     "instanceName": "Sakura Hotsprings (#811786)",
    //     "receiverId": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3"
    // }]

    const homeRequests = document.querySelector('.home-requests');

    // Remove previous invites
    document.querySelectorAll('.home-requests--invite').forEach(el => el.remove());

    // Create the search result elements
    for (const invite of invites) {
        let inviteNode = document.createElement('div');
        inviteNode.setAttribute('class', 'home-requests--invite');
        inviteNode.innerHTML = `
        <img class="home-requests--invite--user-img" src="https://placekitten.com/50/50" data-hash="${invite.user.imageHash}"/>
        <img class="home-requests--invite--world-img" src="https://placekitten.com/50/50" data-hash="${invite.world.imageHash}"/>
        <p class="home-requests--invite--user-name">${invite.user.name}</p>
        <p class="home-requests--invite--instance-name">${invite.instanceName}</p>`;
        homeRequests.prepend(inviteNode);
    }
});
// Janky invite request listener
window.API.onInviteRequests((_event, requestInvites) => {
    console.log('Requests to Invite Received!');
    console.log(requestInvites);

    // requestInvites = [{
    //     "id": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3:E5nx5n7N",
    //     "sender": {
    //         "id": "b3005d19-e487-bafc-70ac-76d2190d5a29",
    //         "name": "NotAKid",
    //         "imageUrl": "https://files.abidata.io/user_images/b3005d19-e487-bafc-70ac-76d2190d5a29.png",
    //         "imageHash": '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    //     },
    //     "receiverId": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3"
    // }]

    const homeRequests = document.querySelector('.home-requests');

    // Remove previous invites
    document.querySelectorAll('.home-requests--invite-request').forEach(el => el.remove());

    // Create the search result elements
    for (const requestInvite of requestInvites) {
        let requestInviteNode = document.createElement('div');
        requestInviteNode.setAttribute('class', 'home-requests--invite-request');
        requestInviteNode.innerHTML = `
        <img class="home-requests--invite-request--world-img" src="https://placekitten.com/50/50" data-hash="${requestInvite.sender.imageHash}"/>
        <p class="home-requests--invite-request--user-name">${requestInvite.sender.name}</p>`;
        homeRequests.prepend(requestInviteNode);
    }
});
// Janky friend request listener
window.API.onFriendRequests((_event, friendRequests) => {
    console.log('On Friend Requests received!');
    console.log(friendRequests);

    // friendRequests = [{
    //     "receiverId": "c4eee443-98a0-bab8-a583-f1d9fa10a7d7",
    //     "id": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3",
    //     "name": "Kafeijao",
    //     "imageUrl": "https://files.abidata.io/user_images/4a1661f1-2eeb-426e-92ec-1b2f08e609b3.png",
    //     "imageHash": '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }]

    const homeRequests = document.querySelector('.home-requests');

    // Remove previous invites
    document.querySelectorAll('.home-requests--friend-request').forEach(el => el.remove());

    // Create the search result elements
    for (const friendRequest of friendRequests) {

        // Create friendRequest Node element
        let friendRequestNode = document.createElement('div');
        friendRequestNode.setAttribute('class', 'home-requests--friend-request');
        friendRequestNode.innerHTML = `
        <img class="home-requests--friend-request--world-img" src="https://placekitten.com/50/50" data-hash="${friendRequest.imageHash}"/>
        <p class="home-requests--friend-request--user-name">${friendRequest.name}</p>`;

        // Create buttons (can't do it with template strings because won't let me inline the function call)
        const acceptButton = document.createElement('button');
        acceptButton.append('Accept');
        acceptButton.setAttribute('class', 'home-requests--friend-request--accept');
        acceptButton.addEventListener('click', () => window.API.acceptFriendRequest(friendRequest.id));
        const declineButton = document.createElement('button');
        declineButton.append('Decline');
        declineButton.setAttribute('class', 'home-requests--friend-request--decline');
        declineButton.addEventListener('click', () => window.API.declineFriendRequest(friendRequest.id));
        friendRequestNode.append(acceptButton, declineButton);

        // Append friendRequest Node element at the beginning
        homeRequests.prepend(friendRequestNode);
    }
});

// Janky Toast Messages (sometimes the serve sends messages, for example when declining a friend req (the popup msg))
window.API.onNotification((_event, msg, type) => {
    console.log('Notification!!!');
    console.log(msg);
    toastyNotification(msg, type);
});

document.querySelectorAll('.toast-test').forEach((e) => {
    e.addEventListener('mousedown', () => {
        let text = document.querySelector('#toast-text').value;
        let type = e.dataset.type;
        toastyNotification(text, type);
    });
});

// Friends filtering :D

document.querySelector('.friends-filter').addEventListener('keyup', () => {
    const filterQuery = document.querySelector('.friends-filter').value.toLowerCase();
    document.querySelectorAll('.friend-list-node').forEach((e) => {
        const matched = e.querySelector('.friend-name').textContent.toLowerCase().includes(filterQuery);
        e.classList.toggle('filtered-friend', !matched);
    });
});

function toastyNotification(message, type) {
    const toast = document.querySelector('.toast-notification');
    clearTimeout(toastTimer);
    switch (type) {
        case 'confirm':
            toast.setAttribute('class', 'toast-notification toast-confirm');
            break;
        case 'error':
            toast.setAttribute('class', 'toast-notification toast-error');
            break;
        default:
            toast.setAttribute('class', 'toast-notification toast-info');
    }
    toast.innerHTML = message;
    toast.classList.add('toast-up');
    toastDown();
}

window.API.onInitialLoadFinish((_event) => {
    console.log('Initial Load finished!!!');
    document.querySelector('.loading-shade').remove();
});


window.API.onUserStats((_event, userStats) => {
    const userCountNode = document.querySelector('.home-activity--user-count');
    // usersOnline: { overall: 47, public: 14, notConnected: 9, other: 24 }
    const usersOnline = userStats.usersOnline;
    userCountNode.textContent = `Public: ${usersOnline.public} | Private: ${usersOnline.other} | Offline Instance: ${usersOnline.notConnected}`;
});
