// ===================
// USER CONTENT MODULE
// ===================

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';
import { createElement } from '../frontend.js';

// ===============
// FRIENDS SECTION
// ===============

// Cache for friend images to prevent losing loaded images on refresh
export const friendImageCache = {};

// Store friend categories for filtering
let friendCategories = [];

// Store friends data for category filtering
let friendsData = {};

// Dependencies that need to be injected
let currentActiveUser = null;
let ShowDetailsWrapper = null;
let DetailsType = null;

// Function to initialize dependencies
export function initializeFriendsModule(dependencies) {
    currentActiveUser = dependencies.currentActiveUser;
    ShowDetailsWrapper = dependencies.ShowDetailsWrapper;
    DetailsType = dependencies.DetailsType;
}

// Function to update current active user
export function updateCurrentActiveUser(user) {
    currentActiveUser = user;
}

// Function to create friends list category headers
export function createFriendsListCategory(title) {
    const element = document.createElement('p');
    element.classList.add('friend-sidebar-header');
    element.textContent = title;
    return element;
}

// Function to get friend status information
export function getFriendStatus(friend) {
    if (!friend?.isOnline) return { name: 'Offline', type: null };
    if (!friend.isConnected) return { name: '', type: 'Offline Instance' };
    if (!friend.instance) return { name: '', type: 'Private Instance' };
    if (friend.instance.name) return {
        name: friend.instance.name,
        type: GetPrivacyLevelName(friend.instance.privacy),
    };
    return { name: 'Unknown', type: null };
}

// Helper function for privacy level names (copied from main file)
const PrivacyLevel = Object.freeze({
    Public: 0,
    FriendsOfFriends: 1,
    Friends: 2,
    Group: 3,
    EveryoneCanInvite: 4,
    OwnerMustInvite: 5,
    GroupsPlus: 6,
});

const GetPrivacyLevelName = (privacyLevel) => {
    switch (privacyLevel) {
        case PrivacyLevel.Public: return 'Public';
        case PrivacyLevel.FriendsOfFriends: return 'Friends of Friends';
        case PrivacyLevel.Friends: return 'Friends Only';
        case PrivacyLevel.Group: return 'Group';
        case PrivacyLevel.GroupsPlus: return 'Friends of Group';
        case PrivacyLevel.EveryoneCanInvite: return 'Everyone Can Invite';
        case PrivacyLevel.OwnerMustInvite: return 'Owner Must Invite';
        default: return 'Unknown';
    }
};

// Function to load friend categories and update filter buttons
export async function loadFriendCategories() {
    try {
        const categories = await window.API.getCategories();
        if (categories && categories.friends) {
            friendCategories = categories.friends;
            updateFriendFilterButtons();
        }
    } catch (error) {
        console.error('Failed to load friend categories:', error);
        // Fallback to default buttons if categories fail to load
        friendCategories = [];
        updateFriendFilterButtons();
    }
}

// Function to update friend filter buttons based on categories
function updateFriendFilterButtons() {
    const filterControlsContainer = document.querySelector('.friends-filter-controls');
    if (!filterControlsContainer) return;

    // Clear existing buttons
    filterControlsContainer.innerHTML = '';

    // Always add "All" button
    const allButton = createElement('button', {
        className: 'filter-button active',
        innerHTML: '<span class="material-symbols-outlined">group</span>All',
        onClick: () => handleFriendFilterClick('all', allButton)
    });
    allButton.dataset.filter = 'all';
    filterControlsContainer.appendChild(allButton);

    // Add "Online" button
    const onlineButton = createElement('button', {
        className: 'filter-button',
        innerHTML: '<span class="material-symbols-outlined">circle</span>Online',
        onClick: () => handleFriendFilterClick('online', onlineButton)
    });
    onlineButton.dataset.filter = 'online';
    filterControlsContainer.appendChild(onlineButton);

    // Add category buttons from API
    friendCategories.forEach(category => {
        // Skip the default online/offline categories as we handle them differently
        if (category.id === 'frndonline' || category.id === 'frndoffline') {
            return;
        }

        const categoryButton = createElement('button', {
            className: 'filter-button',
            innerHTML: `<span class="material-symbols-outlined">label</span>${category.name}`,
            onClick: () => handleFriendFilterClick(category.id, categoryButton)
        });
        categoryButton.dataset.filter = category.id;
        filterControlsContainer.appendChild(categoryButton);
    });
}

// Function to handle friend filter button clicks
function handleFriendFilterClick(filterType, clickedButton) {
    // Remove active class from all filter buttons
    document.querySelectorAll('.friends-filter-controls .filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    clickedButton.classList.add('active');
    
    // Apply the filter
    applyFriendFilter(filterType);
}

// Function to apply friend filtering based on selected filter
function applyFriendFilter(filterType) {
    const filterText = document.querySelector('.friends-filter').value.toLowerCase();
    const friendCards = document.querySelectorAll('.friend-list-node');
    
    friendCards.forEach(card => {
        const isOnline = card.querySelector('.status-indicator:not(.offline)');
        const friendName = card.querySelector('.friend-name').textContent.toLowerCase();
        const matchesText = filterText === '' || friendName.includes(filterText);
        
        let matchesButtonFilter = false;
        
        // Check if friend matches button filter
        if (filterType === 'all') {
            matchesButtonFilter = true;
        } else if (filterType === 'online') {
            matchesButtonFilter = isOnline;
        } else {
            // For category filters, we need to check the friend's categories
            // We need to get the friend data to check their categories
            const friendNameElement = card.querySelector('.friend-name');
            const friendName = friendNameElement.textContent;
            
            // Find the friend in our friends data by name
            const friendData = Object.values(friendsData || {}).find(friend => friend.name === friendName);
            
            if (friendData && friendData.categories && Array.isArray(friendData.categories)) {
                matchesButtonFilter = friendData.categories.includes(filterType);
                // Debug logging
                if (filterType !== 'all' && filterType !== 'online') {
                    console.log(`Friend: ${friendName}, Categories: ${JSON.stringify(friendData.categories)}, Filter: ${filterType}, Matches: ${matchesButtonFilter}`);
                }
            } else {
                // If no categories or friend not found, don't show for category filters
                matchesButtonFilter = false;
            }
        }
        
        // Show card only if it matches both text and button filters
        if (matchesText && matchesButtonFilter) {
            card.style.display = '';
            card.classList.remove('filtered-item');
        } else {
            card.style.display = 'none';
            card.classList.add('filtered-item');
        }
    });
}

// Export the filter function so it can be called from event listeners
export { applyFriendFilter };

// Function to handle friends refresh
export function handleFriendsRefresh(friends, isRefresh) {
    console.log('Friends Refresh! isRefresh: ' + isRefresh);
    console.log(friends);

    // Store friends data globally for category filtering
    friendsData = {};
    friends.forEach(friend => {
        friendsData[friend.id] = friend;
    });

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

    // Sort friends alphabetically regardless of case
    friends.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    // Array to collect all friend cards before adding to DOM
    const friendCards = [];

    for (const friend of friends) {
        const { name, type } = getFriendStatus(friend);
        const instanceTypeStr = type ? `${type}` : '';
        const onlineFriendInPrivateClass = friend.instance ? '' : 'friend-is-offline';

        // Use cached image if available, otherwise use placeholder
        if (friend.imageBase64) {
            // If we received the image with this update, cache it
            friendImageCache[friend.imageHash] = friend.imageBase64;
        }
        // Use cached image or fall back to placeholder
        const friendImgSrc = friendImageCache[friend.imageHash] || 'img/ui/placeholder.png';

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
                onClick: () => ShowDetailsWrapper(DetailsType.User, friend.id),
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

        // Status indicator
        const statusIndicator = friend.isOnline
            ? '<div class="status-indicator"><span class="material-symbols-outlined">circle</span>Online</div>'
            : '<div class="status-indicator offline"><span class="material-symbols-outlined">circle</span>Offline</div>';

        // Badge indicator (if present)
        let badgeIndicator = '';
        if (friend.featuredBadge && friend.featuredBadge.name && friend.featuredBadge.name !== 'No badge featured') {
            badgeIndicator = `<div class="badge-indicator">
                <span class="material-symbols-outlined">workspace_premium</span>
                ${friend.featuredBadge.name}
            </div>`;
        }

        // World/instance icon
        const worldIcon = friend.isOnline
            ? '<span class="material-symbols-outlined">public</span>'
            : '<span class="material-symbols-outlined">public_off</span>';

        // Create the friend card with the same structure as search results
        let friendCard = createElement('div', {
            className: 'friend-list-node',
            innerHTML: `
                ${badgeIndicator}
                <div class="thumbnail-container">
                    <img src="${friendImgSrc}" data-hash="${friend.imageHash}" class="hidden"/>
                    ${statusIndicator}
                </div>
                <div class="friend-content">
                    <p class="friend-name">${friend.name}</p>
                    <p class="${offlineFriendClass} friend-status-type">${instanceTypeStr}</p>
                    <p class="${offlineFriendClass} friend-status">${worldIcon} ${name}</p>
                </div>
            `,
            onClick: () => ShowDetailsWrapper(DetailsType.User, friend.id),
        });

        // Set placeholder background image and data-hash directly on the container
        const thumbnailContainer = friendCard.querySelector('.thumbnail-container');
        thumbnailContainer.style.backgroundImage = `url('${friendImgSrc}')`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.dataset.hash = friend.imageHash;

        friendCards.push(friendCard);
    }

    // Add all friend cards to the DOM at once
    friendsListNode.append(...friendCards);

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
}

// Function to initialize friends page when navigating to it
export function initializeFriendsPage() {
    const filterInput = document.querySelector('.friends-filter');
    filterInput.value = '';
    
    // Remove filtered class from all friends
    document.querySelectorAll('.friend-list-node').forEach((e) => {
        e.classList.remove('filtered-item');
        e.style.display = '';
    });
    
    // Load friend categories and reset filter controls
    loadFriendCategories().then(() => {
        // Reset to "All" filter after categories are loaded
        const allButton = document.querySelector('.friends-filter-controls .filter-button[data-filter="all"]');
        if (allButton) {
            handleFriendFilterClick('all', allButton);
        }
    });
    
    // Make sure all friend cards are visible
    document.querySelectorAll('.friend-list-node').forEach(card => {
        card.style.display = '';
        card.classList.remove('filtered-item');
    });
}

// Function to setup friends text filter event listener
export function setupFriendsTextFilter() {
    const friendsFilter = document.querySelector('.friends-filter');
    if (friendsFilter) {
        friendsFilter.addEventListener('input', (event) => {
            const filterText = event.target.value.toLowerCase();
            const activeButtonFilter = document.querySelector('.friends-filter-controls .filter-button.active')?.dataset.filter || 'all';
            
            // Use the applyFriendFilter function
            applyFriendFilter(activeButtonFilter);
        });
    }
}

// ================
// AVATARS SECTION
// ================

// Store avatar categories for filtering
let avatarCategories = [];

// Store avatars data for category filtering
let avatarsData = {};

// Function to load avatar categories and update filter buttons
export async function loadAvatarCategories() {
    try {
        const categories = await window.API.getCategories();
        if (categories && categories.avatars) {
            // Filter out the categories we want to ignore
            avatarCategories = categories.avatars.filter(category => 
                !['avtrpublic', 'avtr_new', 'avtr_recently'].includes(category.id)
            );
            updateAvatarFilterButtons();
        }
    } catch (error) {
        console.error('Failed to load avatar categories:', error);
        // Fallback to default buttons if categories fail to load
        avatarCategories = [];
        updateAvatarFilterButtons();
    }
}

// Function to update avatar filter buttons based on categories
function updateAvatarFilterButtons() {
    const filterControlsContainer = document.querySelector('.avatars-filter-controls');
    if (!filterControlsContainer) return;

    // Clear existing buttons
    filterControlsContainer.innerHTML = '';

    // Add "My Avatars" button (using avtrmine category)
    const myAvatarsButton = createElement('button', {
        className: 'filter-button active',
        innerHTML: '<span class="material-symbols-outlined">emoji_people</span>My Avatars',
        onClick: () => handleAvatarFilterClick('avtrmine', myAvatarsButton)
    });
    myAvatarsButton.dataset.filter = 'avtrmine';
    filterControlsContainer.appendChild(myAvatarsButton);

    // Add "Shared With Me" button (using avtrshared category)
    const sharedButton = createElement('button', {
        className: 'filter-button',
        innerHTML: '<span class="material-symbols-outlined">share</span>Shared With Me',
        onClick: () => handleAvatarFilterClick('avtrshared', sharedButton)
    });
    sharedButton.dataset.filter = 'avtrshared';
    filterControlsContainer.appendChild(sharedButton);

    // Add user-created category buttons (those starting with 'avatars_')
    avatarCategories.forEach(category => {
        // Only add user-created categories (those starting with 'avatars_')
        if (category.id.startsWith('avatars_')) {
            const categoryButton = createElement('button', {
                className: 'filter-button',
                innerHTML: `<span class="material-symbols-outlined">label</span>${category.name}`,
                onClick: () => handleAvatarFilterClick(category.id, categoryButton)
            });
            categoryButton.dataset.filter = category.id;
            filterControlsContainer.appendChild(categoryButton);
        }
    });
}

// Function to handle avatar filter button clicks
function handleAvatarFilterClick(filterType, clickedButton) {
    // Remove active class from all filter buttons
    document.querySelectorAll('.avatars-filter-controls .filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    clickedButton.classList.add('active');
    
    // Apply the filter
    applyAvatarFilter(filterType);
}

// Function to apply avatar filtering based on selected filter
function applyAvatarFilter(filterType) {
    const filterText = document.querySelector('#avatars-filter').value.toLowerCase();
    const avatarCards = document.querySelectorAll('.avatars-wrapper--avatars-node');
    
    avatarCards.forEach(card => {
        const avatarName = card.querySelector('.card-name').textContent.toLowerCase();
        const matchesText = filterText === '' || avatarName.includes(filterText);
        
        let matchesButtonFilter = false;
        
        // Find the avatar in our avatars data by name
        const avatarNameElement = card.querySelector('.card-name');
        const avatarNameText = avatarNameElement.textContent;
        
        // Find the avatar in our avatars data by name
        const avatarData = Object.values(avatarsData || {}).find(avatar => avatar.name === avatarNameText);
        
        if (avatarData && avatarData.categories && Array.isArray(avatarData.categories)) {
            matchesButtonFilter = avatarData.categories.includes(filterType);
            // Debug logging
            console.log(`Avatar: ${avatarNameText}, Categories: ${JSON.stringify(avatarData.categories)}, Filter: ${filterType}, Matches: ${matchesButtonFilter}`);
        } else {
            // If no categories or avatar not found, don't show for category filters
            matchesButtonFilter = false;
        }
        
        // Show card only if it matches both text and button filters
        if (matchesText && matchesButtonFilter) {
            card.style.display = '';
            card.classList.remove('filtered-item');
        } else {
            card.style.display = 'none';
            card.classList.add('filtered-item');
        }
    });
}

// Export the filter function so it can be called from event listeners
export { applyAvatarFilter };

// Function to handle active user avatars refresh
export function handleAvatarsRefresh(ourAvatars) {
    console.log('[On] GetActiveUserAvatars');
    console.log(ourAvatars);

    // Store avatars data globally for category filtering
    avatarsData = {};
    ourAvatars.forEach(avatar => {
        avatarsData[avatar.id] = avatar;
    });

    const avatarDisplayNode = document.querySelector('.avatars-wrapper');
    let docFragment = document.createDocumentFragment();

    for (const ourAvatar of ourAvatars) {
        // Use cached image or placeholder
        const imgSrc = friendImageCache[ourAvatar.imageHash] || 'img/ui/placeholder.png';

        // Create card similar to search and friends layout
        const avatarNode = createElement('div', {
            className: 'avatars-wrapper--avatars-node card-node',
            innerHTML: `
                <div class="thumbnail-container">
                    <img src="${imgSrc}" data-hash="${ourAvatar.imageHash}" class="hidden"/>
                </div>
                <div class="card-content">
                    <p class="card-name">${ourAvatar.name}</p>
                    <div class="card-detail">
                        <span class="material-symbols-outlined">emoji_people</span>Avatar
                    </div>
                </div>
            `,
            onClick: () => ShowDetailsWrapper(DetailsType.Avatar, ourAvatar.id),
        });

        // Set placeholder background image and data-hash directly on the container
        const thumbnailContainer = avatarNode.querySelector('.thumbnail-container');
        thumbnailContainer.style.backgroundImage = `url('${imgSrc}')`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.dataset.hash = ourAvatar.imageHash;

        docFragment.appendChild(avatarNode);
    }

    avatarDisplayNode.replaceChildren(docFragment);
}

// Function to initialize avatars page when navigating to it
export function initializeAvatarsPage() {
    const filterInput = document.querySelector('#avatars-filter');
    if (filterInput) {
        filterInput.value = '';
    }
    
    // Remove filtered class from all avatars
    document.querySelectorAll('.avatars-wrapper--avatars-node').forEach((e) => {
        e.classList.remove('filtered-item');
        e.style.display = '';
    });
    
    // Load avatar categories and reset filter controls
    loadAvatarCategories().then(() => {
        // Reset to "My Avatars" filter after categories are loaded
        const myAvatarsButton = document.querySelector('.avatars-filter-controls .filter-button[data-filter="avtrmine"]');
        if (myAvatarsButton) {
            handleAvatarFilterClick('avtrmine', myAvatarsButton);
        }
    });
    
    // Make sure all avatar cards are visible initially
    document.querySelectorAll('.avatars-wrapper--avatars-node').forEach(card => {
        card.style.display = '';
        card.classList.remove('filtered-item');
    });
}

// Function to setup avatars text filter event listener
export function setupAvatarsTextFilter() {
    const avatarsFilter = document.querySelector('#avatars-filter');
    if (avatarsFilter) {
        avatarsFilter.addEventListener('input', (event) => {
            const activeButtonFilter = document.querySelector('.avatars-filter-controls .filter-button.active')?.dataset.filter || 'avtrmine';
            
            // Use the applyAvatarFilter function
            applyAvatarFilter(activeButtonFilter);
        });
    }
}
