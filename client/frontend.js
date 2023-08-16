// =======
// MODULES
// =======

import { pushToast } from './astrolib/toasty_notifications.js';
import { applyTooltips } from './astrolib/tooltip.js';

// ===========
// GLOBAL VARS
// ===========

const DetailsType = Object.freeze({
    User: Symbol('user'),
    World: Symbol('world'),
});

const PrivacyLevel = Object.freeze({
    Public: 0,
    FriendsOfFriends: 1,
    Friends: 2,
    Group: 3,
    EveryoneCanInvite: 4,
    OwnerMustInvite: 5,
});

const GetPrivacyLevelName = (privacyLevel) => {
    switch (privacyLevel) {
        case PrivacyLevel.Public: return 'Public';
        case PrivacyLevel.FriendsOfFriends: return 'Friends of Friends';
        case PrivacyLevel.Friends: return 'Friends Only';
        case PrivacyLevel.Group: return 'Group';
        case PrivacyLevel.EveryoneCanInvite: return 'Everyone Can Invite';
        case PrivacyLevel.OwnerMustInvite: return 'Owner Must Invite';
        default: return 'Unknown';
    }
};

// const WorldCategories = Object.freeze({
//     ActiveInstances: 'wrldactive',
//     New: 'wrldnew',
//     Trending: 'wrldtrending',
//     Official: 'wrldofficial',
//     Avatar: 'wrldavatars',
//     Public: 'wrldpublic',
//     RecentlyUpdated: 'wrldrecentlyupdated',
//     Mine: 'wrldmine',
// });

const AvatarCategories = Object.freeze({
    Public: 'avtrpublic',
    Shared: 'avtrshared',
    Mine: 'avtrmine',
});

const PropCategories = Object.freeze({
    Mine: 'propmine',
    Shared: 'propshared',
});

const ActivityUpdatesType = Object.freeze({
    Friends: 'friends',
});

// Grab the isPackaged and save it
let isPackaged = false;
window.API.isPackaged().then(packaged => {
    isPackaged = packaged;
    console.log(`Logging on the renderer will be: ${packaged ? 'disabled' : 'enabled'}!`);
});

// =========
// FUNCTIONS
// =========

function log(msg) {
    if (!isPackaged) console.log(msg);
}

// Page changes via the Nav Bar
function hideAllDisplayWrappers() {
    document.querySelectorAll('.display-wrapper').forEach((e) => {
        e.style.display = 'none';
    });
}

function setPageTitle(page) {
    document.title = 'CVRX - ' + page.charAt(0).toUpperCase() + page.slice(1);
}

function setInputValueAndFocus(selector, value) {
    const inputElement = document.querySelector(selector);
    inputElement.value = value;
    inputElement.focus({ focusVisible: true });
}

function removeFilteredItemClass(selector) {
    document.querySelectorAll(selector).forEach((e) => {
        e.classList.remove('filtered-item');
    });
}

function loadAndFilterPageContent(page, elementSelector, loadFunction, filterSelector) {
    const element = document.querySelector(elementSelector);
    if (!element.hasAttribute(`loaded-${page}`)) {
        element.setAttribute(`loaded-${page}`, '');
        loadFunction();
    }
    setInputValueAndFocus(filterSelector, '');
    removeFilteredItemClass(`.${page}-wrapper--${page}-node`);
}

function swapNavPages(page) {
    hideAllDisplayWrappers();
    document.getElementById(`display-${page}`).style.display = 'grid';
    setPageTitle(page);

    switch (page) {
        case 'search':
            setInputValueAndFocus('#search-bar', '');
            break;
        case 'friends':
            setInputValueAndFocus('.friends-filter', '');
            removeFilteredItemClass('.friend-list-node');
            break;
        case 'avatars':
            loadAndFilterPageContent('avatars', '#display-avatars', window.API.refreshGetActiveUserAvatars, '#avatars-filter');
            break;
        case 'worlds':
            loadAndFilterPageContent('worlds', '#display-worlds', window.API.refreshGetActiveUserWorlds, '#worlds-filter');
            break;
        case 'props':
            loadAndFilterPageContent('props', '#display-props', window.API.refreshGetActiveUserProps, '#props-filter');
            break;
    }

    // Hide the loading screen
    document.querySelector('.cvrx-main').style.display = 'grid';
    document.querySelector('.loading-shade').style.display = 'none';
}

// Simplify Element w/ Stuff Creation
function createElement(type, options = {}) {
    const element = document.createElement(type);
    if (options.id) element.id = options.id;
    if (options.className) element.className = options.className;
    if (options.src) element.src = options.src;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.textContent) element.textContent = options.textContent;
    if (options.onClick) element.addEventListener('click', options.onClick);
    if (options.tooltip) element.dataset.tooltip = options.tooltip;
    return element;
}

function createFriendsListCategory(title) {
    const element = document.createElement('p');
    element.classList.add('friend-sidebar-header');
    element.textContent = title;
    return element;
}

// Temporary reconnect prompt - will be expanded with a proper library later.
function promptReconnect() {
    const promptShade = document.querySelector('.prompt-layer');
    const newPrompt = createElement('div', { className: 'prompt' });
    const promptTitle = createElement('div', { className: 'prompt-title', textContent: 'Socket Error' });
    const promptText = createElement('div', { className: 'prompt-text', textContent: 'Socket failed to reconnect after 5 attempts. Click below to manually reconnect.' });
    const promptButtons = createElement('div', { className: 'prompt-buttons' });
    const confirmButton = createElement('button', {
        id: 'prompt-confirm',
        textContent: 'Reconnect Socket',
        onClick: async () => {
            // Do your reconnect magic here.
            await window.API.reconnectWebSocket();
            newPrompt.remove();
            promptShade.style.display = 'none';
        },
    });

    promptButtons.append(confirmButton);
    newPrompt.append(promptTitle, promptText, promptButtons);
    promptShade.append(newPrompt);
    promptShade.style.display = 'flex';
}


// ===============
// EVERYTHING ELSE
// ===============

// Pages handling
window.API.onLoadingPage((_event) => {
    // Reveal the loading screen
    document.querySelector('.loading-shade').style.display = 'flex';
});
window.API.onLoginPage((_event, availableCredentials) => {
    log('login page!');

    const availableCredentialsNode = document.querySelector('#login-available-credentials-wrapper');
    const newNodes = [];

    for (const availableCredential of availableCredentials) {
        const credentialNode = createElement('div', {
            className: 'login-credential-node',
            innerHTML:
                `<img src="img/ui/placeholder.png" data-hash="${availableCredential.imageHash}"/>
                <p class="login-credential-node--name">${availableCredential.Username}</p>`,
            onClick: async () => {
                // Reveal the loading screen and hide the login page
                document.querySelector('.login-shade').style.display = 'none';
                document.querySelector('.loading-shade').style.display = 'flex';
                await window.API.authenticate(availableCredential.Username, availableCredential.AccessKey, true, true);
            },
        });
        const deleteCredentialButton = createElement('button', {
            className: 'login-credential-node--delete',
            innerHTML: '✖',
            onClick: (event) => {
                event.stopPropagation();
                deleteCredentialButton.disabled = true;
                window.API.deleteCredentials(availableCredential.Username).then();
                credentialNode.remove();
            },
        });
        credentialNode.append(deleteCredentialButton);
        newNodes.push(credentialNode);
    }
    availableCredentialsNode.replaceChildren(...newNodes);

    document.querySelector('.login-shade').style.display = 'flex';
});

window.API.onHomePage((_event) => swapNavPages('home'));


// Navbar Control Logic
document.querySelectorAll('.navbar-button').forEach((e) => {
    e.addEventListener('click', () => {
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
    log('Active User!');
    log(activeUser);
    const userIcon = document.querySelector('.home-user--user-icon');
    userIcon.setAttribute('data-hash', activeUser.imageHash);
    userIcon.onclick = () => ShowDetails(DetailsType.User, activeUser.id);
    const userName = document.querySelector('.home-user--user-name');
    userName.innerHTML = activeUser.name;
    userName.onclick = () => ShowDetails(DetailsType.User, activeUser.id);
    document.querySelector('.user-extra--user-avatar').innerHTML =
        `<img data-hash="${activeUser.avatar.imageHash}">${activeUser.avatar.name}`;
    document.querySelector('.user-extra--user-badge').innerHTML =
        `<img data-hash="${activeUser.featuredBadge.imageHash}">${activeUser.featuredBadge.name}`;
    document.querySelector('.user-extra--user-rank').innerHTML =
        `<img src="img/ui/rank.png">${activeUser.rank}`;
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
    if (!friend?.isOnline) return { name: 'Offline', type: null };
    if (!friend.isConnected) return { name: '', type: 'Offline Instance' };
    if (!friend.instance) return { name: '', type: 'Private Instance' };
    if (friend.instance.name) return {
        name: friend.instance.name,
        type: GetPrivacyLevelName(friend.instance.privacy),
    };
    return { name: 'Unknown', type: null };
}

async function ShowDetails(entityType, entityId) {

    let detailsName = document.querySelector('.details-window--name');
    let detailsImg = document.querySelector('.details-window--img');
    let detailsAvatar = document.querySelector('.details-window--avatar');
    let detailsBadge = document.querySelector('.details-window--badge');
    let detailsRank = document.querySelector('.details-window--rank');

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
            detailsName.innerHTML = `${entityInfo.name}`;
            detailsImg.src = 'img/ui/placeholder.png';
            detailsImg.dataset.hash = entityInfo.imageHash;
            detailsAvatar.innerHTML = `<img data-hash="${entityInfo.avatar.imageHash}">${entityInfo.avatar.name}`;
            detailsBadge.innerHTML = `<img data-hash="${entityInfo.featuredBadge.imageHash}">${entityInfo.featuredBadge.name}`;
            detailsRank.innerHTML = `<img src="img/ui/rank.png">${entityInfo.rank}`;
            document.querySelector('.details-shade').style.display = 'flex';
            document.querySelector('.details-shade').onclick = () => document.querySelector('.details-shade').style.display = 'none';
            break;
    }
}

window.API.onFriendsRefresh((_event, friends, isRefresh) => {
    log('Friends Refresh! isRefresh: ' + isRefresh);
    log(friends);

    const friendsBarNode = document.querySelector('.friends-sidebar-container');
    const friendsListNode = document.querySelector('.friends-wrapper');

    let totalFriends = 0;

    // Friends Sidebar Categories
    const categories = {
        public: null,
        friendsOfFriends: null,
        friendsOnly: null,
        anyoneCanInvite: null,
        ownerOnlyInvite: null,
        privateInstance: null,
        offlineInstance: null,
    };

    // Prep by assigning nodes to the categories
    for (const key in categories) {
        categories[key] = createElement('div', { className: 'friend-sidebar-category-group' });
    }

    // Instance type to category map
    const instanceTypeToCategoryKey = {
        'Public': 'public',
        'Friends of Friends': 'friendsOfFriends',
        'Friends Only': 'friendsOnly',
        'Everyone Can Invite': 'anyoneCanInvite',
        'Owner Must Invite': 'ownerOnlyInvite',
        'Private Instance': 'privateInstance',
        'Offline Instance': 'offlineInstance',
    };

    // Clear all children (this event sends all friends, we so can empty our previous state)
    friendsBarNode.replaceChildren();
    friendsListNode.replaceChildren();

    for (const friend of friends) {

        const { name, type } = getFriendStatus(friend);
        const instanceTypeStr = type ? `${type}` : '';
        const onlineFriendInPrivateClass = friend.instance ? '' : 'friend-is-offline';
        // Depending on whether it's a refresh or not the image might be already loaded
        const friendImgSrc = friend.imageBase64 ?? 'img/ui/placeholder.png';

        // Setting up the HTMLElement used for the Online Friends panel.
        if (friend.isOnline) {
            totalFriends = totalFriends + 1;
            let onlineFriendNode = createElement('div', {
                className: 'friends-sidebar--online-friend-node',
                innerHTML:
                    `<img class="online-friend-node--image" src="${friendImgSrc}" data-hash="${friend.imageHash}"/>
                    <p class="online-friend-node--name">${friend.name}</p>
                    <p class="online-friend-node--status ${onlineFriendInPrivateClass}">${instanceTypeStr}</p>
                    <p class="online-friend-node--world" data-tooltip="${name}">${name}</p>`,
                onClick: () => ShowDetails(DetailsType.User, friend.id),
            });

            // Get category from map
            const categoryKey = instanceTypeToCategoryKey[instanceTypeStr];

            // Populate category with friend
            if (categoryKey) {
                const category = categories[categoryKey];

                // If the category is empty, start by giving it its title
                if (!category.children.length) {
                    category.appendChild(createFriendsListCategory(instanceTypeStr));
                }
                category.appendChild(onlineFriendNode);
            } else {
                friendsBarNode.appendChild(onlineFriendNode);
            }
        }

        // Setting up the HTMLElement used for the Friends List page.
        const offlineFriendClass = friend.isOnline ? '' : 'friend-is-offline';
        const imgOnlineClass = friend.isOnline ? 'class="icon-is-online"' : '';
        let listFriendNode = createElement('div', {
            className: 'friend-list-node',
            innerHTML:
                `<img ${imgOnlineClass} src="${friendImgSrc}" data-hash="${friend.imageHash}"/>
                <p class="friend-name">${friend.name}</p>
                <p class="${offlineFriendClass} friend-status-type">${instanceTypeStr}</p>
                <p class="${offlineFriendClass} friend-status">${name}</p>`,
            onClick: () => ShowDetails(DetailsType.User, friend.id),
        });
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

    // After getting all friends statuses, populate the Friends Sidebar in order of Categories
    for (const key in categories) {
        const category = categories[key];
        if (category.children.length) {
            let categoryName = category.querySelector('p').textContent;
            category.querySelector('p').textContent = `${categoryName} - ${category.children.length - 1}`;
            friendsBarNode.appendChild(category);
        }
    }

    // Update the Total Friend Counter :)
    document.querySelector('#friend-count').textContent = totalFriends;
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
    pushToast('Searching...');

    // Fetch the search results
    const results = await window.API.search(searchTerm);
    log('Searched!');
    log(results);

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
        let searchResult = createElement('div', {
            className: 'search-output--node',
            innerHTML:
                `<img src="img/ui/placeholder.png" data-hash="${result.imageHash}"/>
                <p class="search-result-name">${result.name}</p>
                <p class="search-result-type">${result.type}</p>`,
        });
        switch (result.type) {
            case 'user':
                searchResult.onclick = () => ShowDetails(DetailsType.User, result.id);
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
                pushToast('Found a result with invalid type!', 'error');
        }
    }

    // Replace previous search results with the new ones
    searchOutputUsers.replaceChildren(...userResults);
    searchOutputWorlds.replaceChildren(...worldsResults);
    searchOutputAvatars.replaceChildren(...avatarResults);
    searchOutputProps.replaceChildren(...propsResults);

    // Re-enable the search
    searchBar.disabled = false;
    pushToast('Search Complete!', 'confirm');
});


// Janky Active Instances
// -----------------------------
window.API.onActiveInstancesUpdate((_event, activeInstances) => {

    const homeActivity = document.querySelector('.home-activity--activity-wrapper');

    log('Active instances updated!');
    log(activeInstances);

    // Disable spinner
    document.querySelector('#instances-refresh').classList.toggle('spinner', false);

    // const activeInstances = [{
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
    //             "name": "FriendlyFriend",
    //             "imageUrl": "https://files.abidata.io/user_images/7452ea11-86ab-86e8-42bd-1d4d24ed7da6-61f16a339b94a.png",
    //             "isFriend": true, // This property will only exist for friends
    //             // ALSO!!!!: friends will have every other info that is present in the usual friends entity
    //             "isBlocked": true, // This property will only exist for blocked people
    //         },
    //         {
    //             "id": "86ce8e72-9204-359d-1ca0-678ec6783a90",
    //             "name": "GhostRobot",
    //             "imageUrl": "https://files.abidata.io/user_images/86ce8e72-9204-359d-1ca0-678ec6783a90-63c6e5b3be27d.png",
    //         },
    //     ],
    // }];

    activeInstances.sort((a, b) => {
        // Count the number of members in each instance who have isFriend=true
        const aFriendCount = a.members.filter(member => member.isFriend).length;
        const bFriendCount = b.members.filter(member => member.isFriend).length;

        // Sort by friend count first
        if (bFriendCount - aFriendCount !== 0) {
            return bFriendCount - aFriendCount;
        }

        // If friend count is the same, sort by currentPlayerCount
        return b.currentPlayerCount - a.currentPlayerCount;
    });

    // Create the search result elements
    const elementsOfResults = [];
    for (const result of activeInstances) {

        const elementsOfMembers = [];
        const elementsOfBlocked = [];

        let friendCount = 0;
        for (const member of result.members) {
            let userIconSource = member?.imageBase64 ?? 'img/ui/placeholder.png';
            let userIcon = createElement('img', {
                className: 'active-instance-node--user-icon',
                src: userIconSource,
                onClick: () => ShowDetails(DetailsType.User, member.id),
            });
            userIcon.dataset.hash = member.imageHash;
            userIcon.dataset.tooltip = member.name;
            if (member.isBlocked) {
                userIcon.classList.add('active-instance-node--blocked');
                userIcon.dataset.tooltip = `<span class="tooltip-blocked">${userIcon.dataset.tooltip} <small>(Blocked)</small></span>`;
                elementsOfBlocked.push(userIcon);
                continue;
            }
            if (member.isFriend) {
                userIcon.classList.add('icon-is-online');
                friendCount++;
                elementsOfMembers.push(userIcon);
                continue;
            }
            if (member.name === document.querySelector('.home-user--user-name').textContent) {
                userIcon.classList.add('icon-is-you');
                userIcon.dataset.tooltip = `<span>${userIcon.dataset.tooltip} <small>(You)</small></span>`;
                elementsOfMembers.unshift(userIcon);
                continue;
            }
            elementsOfMembers.push(userIcon);
        }

        let instanceName = result.name.substring(0, result.name.length - 10);
        let instanceID = result.name.slice(-9);

        if (result.privacy === 'Public') {
            instanceName = `<span class="instance-privacy-type material-symbols-outlined" data-tooltip="Public Instance">Public</span> ${instanceName}`;
        } else {
            instanceName = `<span class="instance-privacy-type material-symbols-outlined" data-tooltip="Friends Instance">Group</span> ${instanceName}`;
        }

        // Depending on whether it's a refresh or not the image might be already loaded
        const worldImageSource = result?.world?.imageBase64 ?? 'img/ui/placeholder.png';

        // If no friends then no friend counter :'(

        let friendDisplay = friendCount ? `<span class="material-symbols-outlined">groups</span>${friendCount}` : '';

        const activeWorldUserIconWrapper = createElement('div', { className: 'active-instance-node--user-icon-wrapper' });
        activeWorldUserIconWrapper.append(...elementsOfMembers, ...elementsOfBlocked);

        let activeWorldNode = createElement('div', {
            className: 'active-instance-node',
            innerHTML:
                `<img class="active-instance-node--icon" src="${worldImageSource}" data-hash="${result.world.imageHash}"/>
                <p class="active-instance-node--name">${instanceName}</p>
                <div class="active-instance-node--id"><div class="region-${result.region}"></div>${instanceID}</div>
                <p class="active-instance-node--users" data-tooltip="Users In Instance"><span class="material-symbols-outlined">person</span>${result.currentPlayerCount}</p>
                <p class="active-instance-node--friends" data-tooltip="Friends In Instance">${friendDisplay}</p>`,
        });
        activeWorldNode.append(activeWorldUserIconWrapper);

        /* friendCount ? elementsOfResults.unshift(activeWorldNode) : elementsOfResults.push(activeWorldNode); */
        elementsOfResults.push(activeWorldNode);
    }

    // Replace previous search results with the new ones
    homeActivity.replaceChildren(...elementsOfResults);
    applyTooltips();
});

// Janky invite listener
window.API.onInvites((_event, invites) => {
    log('Invites Received!');
    log(invites);
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
    document.querySelectorAll('.home-requests--invite-node').forEach(el => el.remove());

    // Create the search result elements
    for (const invite of invites) {

        const userImageNode = createElement('img', {
            className: 'home-requests--invite--user-img',
            src: 'img/ui/placeholder.png',
            onClick: () => ShowDetails(DetailsType.User, invite.user.id),
        });
        userImageNode.dataset.hash = invite.user.imageHash;

        const userNameNode = createElement('p', {
            className: 'home-requests--invite--user-name',
            innerHTML: `<strong>${invite.user.name}</strong>`,
            onClick: () => ShowDetails(DetailsType.User, invite.user.id),
        });

        const inviteNode = createElement('div', {
            className: 'home-requests--invite-node',
            innerHTML:
                `<small>has invited you to...</p></small>
                <img class="home-requests--invite--world-img" src="img/ui/placeholder.png" data-hash="${invite.world.imageHash}"/>
                <p class="home-requests--invite--instance-name"><strong>${invite.instanceName}</strong></p>
                <p class="home-requests--invite--label"><small class="friend-is-offline">Accept In Game</small></p>`,
        });
        inviteNode.prepend(userImageNode, userNameNode);
        homeRequests.prepend(inviteNode);
    }
});
// Janky invite request listener
window.API.onInviteRequests((_event, requestInvites) => {
    log('Requests to Invite Received!');
    log(requestInvites);

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
    document.querySelectorAll('.home-requests--invite-request-node').forEach(el => el.remove());

    // Create the search result elements
    for (const requestInvite of requestInvites) {

        const userImageNode = createElement('img', {
            className: 'home-requests--invite-request--user-img',
            src: 'img/ui/placeholder.png',
            onClick: () => ShowDetails(DetailsType.User, requestInvite.sender.id),
        });
        userImageNode.dataset.hash = requestInvite.sender.imageHash;

        let requestInviteNode = createElement('div', {
            className: 'home-requests--invite-request-node',
            innerHTML:
                `<p class="home-requests--invite-request--user-name"><strong>${requestInvite.sender.name}</strong><small>wants to join you.</small></p>
                <p class="home-requests--invite-request--label"><small class="friend-is-offline">Accept In Game</small></p>`,
        });
        requestInviteNode.prepend(userImageNode);
        homeRequests.prepend(requestInviteNode);
    }
});
// Janky friend request listener
window.API.onFriendRequests((_event, friendRequests) => {
    log('On Friend Requests received!');
    log(friendRequests);

    // friendRequests = [{
    //     "receiverId": "c4eee443-98a0-bab8-a583-f1d9fa10a7d7",
    //     "id": "4a1661f1-2eeb-426e-92ec-1b2f08e609b3",
    //     "name": "Kafeijao",
    //     "imageUrl": "https://files.abidata.io/user_images/4a1661f1-2eeb-426e-92ec-1b2f08e609b3.png",
    //     "imageHash": '0ad531a3b6934292ecb5da1762b3f54ce09cc1b4'
    // }]

    const homeRequests = document.querySelector('.home-requests');

    // Remove previous invites
    document.querySelectorAll('.home-requests--friend-request-node').forEach(el => el.remove());

    // Create the search result elements
    for (const friendRequest of friendRequests) {

        // Create friendRequest Node element
        let friendRequestNode = createElement('div', { className: 'home-requests--friend-request-node' });

        const userImageNode = createElement('img', {
            className: 'home-requests--friend-request--user-img',
            src: 'img/ui/placeholder.png',
            onClick: () => ShowDetails(DetailsType.User, friendRequest.id),
        });
        userImageNode.dataset.hash = friendRequest.imageHash;

        const userNameNode = createElement('p', {
            className: 'home-requests--friend-request--user-name',
            textContent: friendRequest.name,
            onClick: () => ShowDetails(DetailsType.User, friendRequest.id),
        });

        const friendRequestTypeNode = createElement('p', {
            className: 'home-requests--friend-request--request-type',
            textContent: 'Friend Request',
        });

        // Create buttons (can't do it with template strings because won't let me inline the function call)
        const acceptButton = createElement('button', {
            className: 'request-node--button-accept',
            textContent: '✔',
            tooltip: 'Accept Friend Request',
            onClick: () => window.API.acceptFriendRequest(friendRequest.id),
        });

        const declineButton = createElement('button', {
            className: 'request-node--button-reject',
            textContent: '✖',
            tooltip: 'Reject Friend Request',
            onClick: () => window.API.declineFriendRequest(friendRequest.id),
        });

        const buttonWrapper = createElement('div', { className: 'request-node--button-wrapper' });
        buttonWrapper.append(acceptButton, declineButton);

        friendRequestNode.append(userImageNode, userNameNode, friendRequestTypeNode, buttonWrapper);

        // Append friendRequest Node element at the beginning
        homeRequests.prepend(friendRequestNode);
        applyTooltips();
    }
});

// Janky Toast Messages (sometimes the serve sends messages, for example when declining a friend req (the popup msg))
window.API.onNotification((_event, msg, type) => {
    log('Notification!!!');
    log(msg);
    pushToast(msg, type);
});

// Cleaner Search Box Filtering!
function addFilterListener(inputSelector, itemSelector, itemNameSelector) {
    document.querySelector(inputSelector).addEventListener('keyup', () => {
        const filterQuery = document.querySelector(inputSelector).value.toLowerCase();
        document.querySelectorAll(itemSelector).forEach((e) => {
            const matched = e.querySelector(itemNameSelector).textContent.toLowerCase().includes(filterQuery);
            e.classList.toggle('filtered-item', !matched);
        });
    });
}

// Friends filtering :D
addFilterListener('.friends-filter', '.friend-list-node', '.friend-name');
// Avatars filtering :O
addFilterListener('#avatars-filter', '.avatars-wrapper--avatars-node', '.avatars-node--name');
// Worlds filtering :)
addFilterListener('#worlds-filter', '.worlds-wrapper--worlds-node', '.worlds-node--name');
// Props filtering :P
addFilterListener('#props-filter', '.props-wrapper--props-node', '.props-node--name');


window.API.onUserStats((_event, userStats) => {
    const userCountNode = document.querySelector('.home-activity--user-count');
    // usersOnline: { overall: 47, public: 14, notConnected: 9, other: 24 }
    const usersOnline = userStats.usersOnline;
    userCountNode.textContent = `Online Users: ${usersOnline.overall}`;
    userCountNode.addEventListener('mouseenter', () => {
        userCountNode.textContent = `Public: ${usersOnline.public} | Private: ${usersOnline.other} | Offline Instance: ${usersOnline.notConnected}`;
    });
    userCountNode.addEventListener('mouseleave', () => {
        userCountNode.textContent = `Online Users: ${usersOnline.overall}`;
    });
});

// Janky active user avatars
window.API.onGetActiveUserAvatars((_event, ourAvatars) => {
    log('[On] GetActiveUserAvatars');
    log(ourAvatars);

    const avatarDisplayNode = document.querySelector('.avatars-wrapper');
    let docFragment = document.createDocumentFragment();

    // Create reload our avatars button
    const reloadAvatarsButton = document.querySelector('#avatars-refresh');
    reloadAvatarsButton.addEventListener('click', () => window.API.refreshGetActiveUserAvatars());

    for (const ourAvatar of ourAvatars) {
        // Ignore avatars that are not our own
        if (!ourAvatar.categories.includes(AvatarCategories.Mine)) continue;

        const ourAvatarNode = createElement('div', {
            className: 'avatars-wrapper--avatars-node',
            innerHTML:
                `<img src="img/ui/placeholder.png" data-hash="${ourAvatar.imageHash}"/>
                <p class="avatars-node--name">${ourAvatar.name}</p>
                <p class="avatars-node--description">${ourAvatar.description}</p>`,
        });
        docFragment.appendChild(ourAvatarNode);
    }

    avatarDisplayNode.replaceChildren(docFragment);
});

// Janky active user props
window.API.onGetActiveUserProps((_event, ourProps) => {
    log('[On] GetActiveUserProps');
    log(ourProps);

    const propDisplayNode = document.querySelector('.props-wrapper');
    let docFragment = document.createDocumentFragment();

    // Create reload our props button
    const reloadAvatarsButton = document.querySelector('#props-refresh');
    reloadAvatarsButton.addEventListener('click', () => window.API.refreshGetActiveUserAvatars());

    for (const ourProp of ourProps) {
        // Ignore avatars that are not our own
        if (!ourProp.categories.includes(PropCategories.Mine)) continue;

        const ourPropNode = createElement('div', {
            className: 'props-wrapper--props-node',
            innerHTML:
                `<img src="img/ui/placeholder.png" data-hash="${ourProp.imageHash}"/>
                <p class="props-node--name">${ourProp.name}</p>
                <p class="props-node--description">${ourProp.description}</p>`,
        });
        docFragment.appendChild(ourPropNode);
    }

    propDisplayNode.replaceChildren(docFragment);
});

// Janky active user worlds
window.API.onGetActiveUserWorlds((_event, ourWorlds) => {
    log('[On] GetActiveUserWorlds');
    log(ourWorlds);

    const worldDisplayNode = document.querySelector('.worlds-wrapper');
    let docFragment = document.createDocumentFragment();

    // Create reload our worlds button
    const reloadAvatarsButton = document.querySelector('#worlds-refresh');
    reloadAvatarsButton.addEventListener('click', () => window.API.refreshGetActiveUserAvatars());

    for (const ourWorld of ourWorlds) {
        const ourWorldNode = createElement('div', {
            className: 'worlds-wrapper--worlds-node',
            innerHTML:
                `<img src="img/ui/placeholder.png" data-hash="${ourWorld.imageHash}"/>
                <p class="worlds-node--name">${ourWorld.name}</p>
                <p class="worlds-node--player-count">${ourWorld.playerCount}</p>`,
        });
        docFragment.appendChild(ourWorldNode);
    }

    worldDisplayNode.replaceChildren(docFragment);
});

// Janky recent activity
window.API.onRecentActivityUpdate((_event, recentActivities) => {
    log('[On] Recent Activity Update');
    log(recentActivities);

    const historyWrapperNode = document.querySelector('.home-history--history-wrapper');
    const newNodes = [];

    for (const recentActivity of recentActivities) {
        // recentActivity = {
        //     timestamp: Date.now(),
        //     type: ActivityUpdatesType.Friends,
        //     current: newEntity,
        //     previous: oldEntity ?? null,
        // };

        const dateStr = new Date(recentActivity.timestamp).toLocaleTimeString();

        switch (recentActivity.type) {

            case ActivityUpdatesType.Friends: {

                // Get instance info from old and new
                let { name, type } = getFriendStatus(recentActivity.previous);
                const previousInstanceInfo = `${name}${type ? ` <span class="history-type-prev">${type}</span>` : ''}`;
                ({ name, type } = getFriendStatus(recentActivity.current));
                const currentInstanceInfo = `${name}${type ? ` <span class="history-type">${type}</span>` : ''}`;

                // Depending on whether it's a refresh or not the image might be already loaded
                const friendImgSrc = recentActivity.current.imageBase64 ?? 'img/ui/placeholder.png';

                const imgOnlineClass = recentActivity.current.isOnline ? 'class="icon-is-online"' : '';

                let activityUpdateNode = createElement('div', {
                    className: 'friend-history-node',
                    innerHTML:
                        `<img ${imgOnlineClass} src="${friendImgSrc}" data-hash="${recentActivity.current.imageHash}"/>
                        <p class="friend-name-history">${recentActivity.current.name} <small>(${dateStr})</small></p>
                        <p class="friend-status-history"><span class="old-history">${previousInstanceInfo}</span> ➡ ${currentInstanceInfo}</p>`,
                    onClick: () => ShowDetails(DetailsType.User, recentActivity.current.id),
                });

                newNodes.push(activityUpdateNode);
                break;
            }
        }
    }

    historyWrapperNode.replaceChildren(...newNodes);
});

// function getMemory() {
//     function toMb(bytes) {
//         return (bytes / (1000.0 * 1000)).toFixed(2);
//     }
//     const resourcesUsage = window.API.getResourceUsage();
//     for (const resourceValues of Object.values(resourcesUsage)) {
//         resourceValues.size = `${toMb(resourceValues.size)} MB`;
//         resourceValues.liveSize = `${toMb(resourceValues.liveSize)} MB`;
//     }
//     log(resourcesUsage);
//     return(resourcesUsage);
// }

document.querySelector('#login-use-access-key').addEventListener('click', _event => {
    const isAccessKey = document.querySelector('#login-use-access-key').checked;
    document.querySelector('#login-username').placeholder = isAccessKey ? 'CVR Username' : 'CVR Email';
    document.querySelector('#login-password').placeholder = isAccessKey ? 'CVR Access Key' : 'CVR Password';
});

document.querySelector('#login-username').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.querySelector('#login-password').focus({ focusVisible: true });
    }
});

document.querySelector('#login-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.querySelector('#login-authenticate').click();
    }
});

document.querySelector('#login-import-game-credentials').addEventListener('click', async _event => {
    try {
        await window.API.importGameCredentials();
        pushToast('Credential import successful!', 'confirm');
    }
    catch (e) {
        pushToast(e.message, 'error');
    }
});

document.querySelector('#login-authenticate').addEventListener('click', async _event => {
    if (document.querySelector('#login-username').value === '' || document.querySelector('#login-password').value === '') {
        pushToast('Missing credential information!', 'error');
        return;
    }
    const isAccessKey = document.querySelector('#login-use-access-key').checked;
    const saveCredentials = document.querySelector('#login-save-credentials').checked;
    const username = document.querySelector('#login-username').value;
    const credential = document.querySelector('#login-password').value;
    document.querySelector('.login-shade').style.display = 'none';
    document.querySelector('.loading-shade').style.display = 'flex';
    try {
        await window.API.authenticate(username, credential, isAccessKey, saveCredentials);
        pushToast(`Authenticated with the user ${username}`, 'confirm');
    }
    catch (e) {
        pushToast(e.message, 'error');
    }
    document.querySelector('.loading-shade').style.display = 'none';
});

document.querySelector('#logout-button').addEventListener('click', async _event => {
    document.querySelector('#login-username').value = '';
    document.querySelector('#login-password').value = '';
    window.API.logout();
});

document.querySelector('#check-updates-button').addEventListener('click', async _event => {
    _event.target.disabled = true;
    const { hasUpdates, msg } = await window.API.checkForUpdates();
    pushToast(msg, hasUpdates ? '' : 'confirm');
    _event.target.disabled = false;
});

// Since it's a single page application, lets clear the cache occasionally.
setInterval(() => {
    window.API.clearCache();
    window.API.isDevToolsOpened().then(isOpened => {
        if (!isOpened) console.clear();
    });
}, 30 * 60 * 1000);

// Refresh active instances
document.querySelector('#instances-refresh').addEventListener('click', async _event => {
    _event.target.classList.toggle('spinner', true);
    const requestInitialized = await window.API.refreshInstances(true);
    if (!requestInitialized) _event.target.classList.toggle('spinner', false);
});

window.addEventListener('focus', async () => {
    const refreshButton = document.querySelector('#instances-refresh');
    refreshButton.classList.toggle('spinner', true);
    const requestInitialized = await window.API.refreshInstances(false);
    if (!requestInitialized) refreshButton.classList.toggle('spinner', false);
});

window.API.getVersion();

window.API.receiveVersion((appVersion) => {
  document.querySelector('.navbar-version').innerHTML = `v${appVersion}`;
});

window.API.onSocketDied((_event) => promptReconnect());

applyTooltips();
