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
    
    // Scroll to top of friends page
    const friendsWrapper = document.querySelector('.friends-wrapper');
    if (friendsWrapper) {
        friendsWrapper.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    
    // Apply the filter to existing data
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
        
        if (avatarData) {
            console.log(`Avatar: ${avatarNameText}, Categories: ${JSON.stringify(avatarData.categories)}, Filter: ${filterType}`);
            
            if (avatarData.categories && Array.isArray(avatarData.categories)) {
                matchesButtonFilter = avatarData.categories.includes(filterType);
            } else {
                // If no categories array exists, show for 'avtrmine' filter (assume it's user's avatar)
                matchesButtonFilter = filterType === 'avtrmine';
                console.log(`Avatar ${avatarNameText} has no categories, treating as ${filterType === 'avtrmine' ? 'owned' : 'not owned'}`);
            }
        } else {
            // If avatar not found in data, show for 'avtrmine' filter as fallback
            matchesButtonFilter = filterType === 'avtrmine';
            console.log(`Avatar ${avatarNameText} not found in avatarsData, treating as ${filterType === 'avtrmine' ? 'owned' : 'not owned'}`);
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

    console.log(`Loaded ${ourAvatars.length} avatars into avatarsData:`, avatarsData);

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
    
    console.log(`Created ${ourAvatars.length} avatar cards in DOM`);
    
    // Apply the current active filter after loading avatars, but only if filter buttons exist
    const activeFilterButton = document.querySelector('.avatars-filter-controls .filter-button.active');
    if (activeFilterButton) {
        const activeFilter = activeFilterButton.dataset.filter;
        console.log(`Applying active filter: ${activeFilter}`);
        applyAvatarFilter(activeFilter);
    } else {
        console.log('No active filter button found, showing all avatars');
        // If no filter buttons exist yet, show all avatars
        document.querySelectorAll('.avatars-wrapper--avatars-node').forEach(card => {
            card.style.display = '';
            card.classList.remove('filtered-item');
        });
    }
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
    
    // Scroll to top of avatars page
    const avatarsWrapper = document.querySelector('.avatars-wrapper');
    if (avatarsWrapper) {
        avatarsWrapper.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

// ==============
// WORLDS SECTION
// ==============

// Store world categories for filtering
let worldCategories = [];

// Store worlds data for category filtering
let worldsData = {};

// Function to load world categories and update filter buttons
export async function loadWorldCategories() {
    try {
        const categories = await window.API.getCategories();
        console.log('Raw categories from API:', categories);
        
        if (categories && categories.worlds) {
            console.log('World categories before filtering:', categories.worlds);
            
            // Filter out the categories we want to ignore
            worldCategories = categories.worlds.filter(category => 
                !['wrldactive', 'wrldnew', 'wrldtrending', 'wrldavatars', 'wrldpublic', 'wrldrecentlyupdated'].includes(category.id)
            );
            
            console.log('World categories after filtering:', worldCategories);
            updateWorldFilterButtons();
        } else {
            console.log('No world categories found in API response');
            worldCategories = [];
            updateWorldFilterButtons();
        }
    } catch (error) {
        console.error('Failed to load world categories:', error);
        // Fallback to default buttons if categories fail to load
        worldCategories = [];
        updateWorldFilterButtons();
    }
}

// Function to update world filter buttons based on categories
function updateWorldFilterButtons() {
    const filterControlsContainer = document.querySelector('.worlds-filter-controls');
    if (!filterControlsContainer) {
        console.log('No worlds filter controls container found');
        return;
    }

    console.log('Updating world filter buttons...');

    // Clear existing buttons
    filterControlsContainer.innerHTML = '';

    // Add "My Worlds" button (using wrldmine category)
    const myWorldsButton = createElement('button', {
        className: 'filter-button active',
        innerHTML: '<span class="material-symbols-outlined">language</span>My Worlds',
        onClick: () => handleWorldFilterClick('wrldmine', myWorldsButton)
    });
    myWorldsButton.dataset.filter = 'wrldmine';
    filterControlsContainer.appendChild(myWorldsButton);
    console.log('Added "My Worlds" button');

    // Add user-created category buttons (those starting with 'worlds_')
    let userCategoryCount = 0;
    worldCategories.forEach(category => {
        // Only add user-created categories (those starting with 'worlds_')
        if (category.id.startsWith('worlds_')) {
            const categoryButton = createElement('button', {
                className: 'filter-button',
                innerHTML: `<span class="material-symbols-outlined">label</span>${category.name}`,
                onClick: () => handleWorldFilterClick(category.id, categoryButton)
            });
            categoryButton.dataset.filter = category.id;
            filterControlsContainer.appendChild(categoryButton);
            userCategoryCount++;
            console.log(`Added user category button: ${category.name} (${category.id})`);
        }
    });
    
    console.log(`Total buttons created: 1 default + ${userCategoryCount} user categories`);
}

// Function to handle world filter button clicks
function handleWorldFilterClick(filterType, clickedButton) {
    // Remove active class from all filter buttons
    document.querySelectorAll('.worlds-filter-controls .filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    clickedButton.classList.add('active');
    
    console.log(`World filter clicked: ${filterType}`);
    
    // Apply the filter to existing data (like avatars and props)
    applyWorldFilter(filterType);
}

// Function to apply world filtering based on selected filter
function applyWorldFilter(filterType) {
    const filterText = document.querySelector('#worlds-filter').value.toLowerCase();
    const worldCards = document.querySelectorAll('.worlds-wrapper--worlds-node');
    
    worldCards.forEach(card => {
        const worldName = card.querySelector('.card-name').textContent.toLowerCase();
        const matchesText = filterText === '' || worldName.includes(filterText);
        
        let matchesButtonFilter = false;
        
        // Find the world in our worlds data by name
        const worldNameElement = card.querySelector('.card-name');
        const worldNameText = worldNameElement.textContent;
        
        // Find the world in our worlds data by name
        const worldData = Object.values(worldsData || {}).find(world => world.name === worldNameText);
        
        if (worldData && worldData.categories && Array.isArray(worldData.categories)) {
            matchesButtonFilter = worldData.categories.includes(filterType);
            console.log(`World: ${worldNameText}, Categories: ${JSON.stringify(worldData.categories)}, Filter: ${filterType}, Matches: ${matchesButtonFilter}`);
        } else {
            // If no categories found, only show for fallback cases where we know the world should match
            // For "wrldmine" filter, we shouldn't show worlds without proper category data
            // For custom categories, we also shouldn't show worlds without categories
            matchesButtonFilter = false;
            console.log(`World ${worldNameText} has no categories or not found in worldsData, hiding for filter: ${filterType}`);
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
export { applyWorldFilter };

// Function to handle active user worlds refresh
export function handleWorldsRefresh(ourWorlds) {
    console.log('[On] GetActiveUserWorlds');
    console.log(ourWorlds);

    // Store worlds data globally for category filtering
    worldsData = {};
    ourWorlds.forEach(world => {
        worldsData[world.id] = world;
    });

    console.log(`Loaded ${ourWorlds.length} worlds into worldsData:`, worldsData);

    const worldDisplayNode = document.querySelector('.worlds-wrapper');
    let docFragment = document.createDocumentFragment();

    for (const ourWorld of ourWorlds) {
        // Use cached image or placeholder
        const imgSrc = friendImageCache[ourWorld.imageHash] || 'img/ui/placeholder.png';

        // Player count indicator for worlds
        const playerCount = ourWorld.playerCount?
            `<div class="player-count-indicator">
                <span class="material-symbols-outlined">group</span>${ourWorld.playerCount}
            </div>` : '';

        // Create card similar to search and friends layout
        const worldNode = createElement('div', {
            className: 'worlds-wrapper--worlds-node card-node',
            innerHTML: `
                ${playerCount}
                <div class="thumbnail-container">
                    <img src="${imgSrc}" data-hash="${ourWorld.imageHash}" class="hidden"/>
                </div>
                <div class="card-content">
                    <p class="card-name">${ourWorld.name}</p>
                    <div class="card-detail">
                        <span class="material-symbols-outlined">language</span>World
                    </div>
                </div>
            `,
            onClick: () => ShowDetailsWrapper(DetailsType.World, ourWorld.id),
        });

        // Set placeholder background image and data-hash directly on the container
        const thumbnailContainer = worldNode.querySelector('.thumbnail-container');
        thumbnailContainer.style.backgroundImage = `url('${imgSrc}')`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.dataset.hash = ourWorld.imageHash;

        docFragment.appendChild(worldNode);
    }

    worldDisplayNode.replaceChildren(docFragment);
    
    console.log(`Created ${docFragment.children.length} world cards in DOM`);
    
    // Apply the current active filter after loading worlds, but only if filter buttons exist
    const activeFilterButton = document.querySelector('.worlds-filter-controls .filter-button.active');
    if (activeFilterButton) {
        const activeFilter = activeFilterButton.dataset.filter;
        console.log(`Applying active filter: ${activeFilter}`);
        applyWorldFilter(activeFilter);
    } else {
        console.log('No active filter button found, showing all worlds');
        // If no filter buttons exist yet, show all worlds
        document.querySelectorAll('.worlds-wrapper--worlds-node').forEach(card => {
            card.style.display = '';
            card.classList.remove('filtered-item');
        });
    }
}

// Function to handle worlds by category refresh
// NOTE: This is primarily for manual category refreshes now, since main loading uses handleWorldsRefresh
export function handleWorldsByCategoryRefresh(categoryId, worlds) {
    console.log(`[On] Worlds Category Refresh for ${categoryId} (manual refresh)`);
    console.log(worlds);

    // Store worlds data globally for category filtering
    worlds.forEach(world => {
        worldsData[world.id] = world;
    });

    console.log(`Loaded ${worlds.length} worlds for category ${categoryId} into worldsData`);

    const worldDisplayNode = document.querySelector('.worlds-wrapper');
    let docFragment = document.createDocumentFragment();

    for (const world of worlds) {
        // Use cached image or placeholder
        const imgSrc = friendImageCache[world.imageHash] || 'img/ui/placeholder.png';

        // Player count indicator for worlds
        const playerCount = world.playerCount?
            `<div class="player-count-indicator">
                <span class="material-symbols-outlined">group</span>${world.playerCount}
            </div>` : '';

        // Create card similar to search and friends layout
        const worldNode = createElement('div', {
            className: 'worlds-wrapper--worlds-node card-node',
            innerHTML: `
                ${playerCount}
                <div class="thumbnail-container">
                    <img src="${imgSrc}" data-hash="${world.imageHash}" class="hidden"/>
                </div>
                <div class="card-content">
                    <p class="card-name">${world.name}</p>
                    <div class="card-detail">
                        <span class="material-symbols-outlined">language</span>World
                    </div>
                </div>
            `,
            onClick: () => ShowDetailsWrapper(DetailsType.World, world.id),
        });

        // Set placeholder background image and data-hash directly on the container
        const thumbnailContainer = worldNode.querySelector('.thumbnail-container');
        thumbnailContainer.style.backgroundImage = `url('${imgSrc}')`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.dataset.hash = world.imageHash;

        docFragment.appendChild(worldNode);
    }

    worldDisplayNode.replaceChildren(docFragment);
    
    console.log(`Created ${worlds.length} world cards for category ${categoryId}`);
    
    // Apply text filter if there's any text in the filter input
    const filterText = document.querySelector('#worlds-filter').value.toLowerCase();
    if (filterText) {
        console.log(`Applying text filter "${filterText}" to ${worlds.length} worlds`);
        document.querySelectorAll('.worlds-wrapper--worlds-node').forEach(card => {
            const worldName = card.querySelector('.card-name').textContent.toLowerCase();
            if (worldName.includes(filterText)) {
                card.style.display = '';
                card.classList.remove('filtered-item');
            } else {
                card.style.display = 'none';
                card.classList.add('filtered-item');
            }
        });
    } else {
        // Show all worlds if no text filter
        document.querySelectorAll('.worlds-wrapper--worlds-node').forEach(card => {
            card.style.display = '';
            card.classList.remove('filtered-item');
        });
    }
}

// Function to initialize worlds page when navigating to it
export function initializeWorldsPage() {
    const filterInput = document.querySelector('#worlds-filter');
    if (filterInput) {
        filterInput.value = '';
    }
    
    // Remove filtered class from all worlds like avatars and props
    document.querySelectorAll('.worlds-wrapper--worlds-node').forEach((e) => {
        e.classList.remove('filtered-item');
        e.style.display = '';
    });
    
    // Load world categories and reset filter controls
    loadWorldCategories().then(() => {
        // Reset to "My Worlds" filter after categories are loaded (like avatars and props)
        const myWorldsButton = document.querySelector('.worlds-filter-controls .filter-button[data-filter="wrldmine"]');
        if (myWorldsButton) {
            handleWorldFilterClick('wrldmine', myWorldsButton);
        }
    });
    
    // Make sure all world cards are visible initially (like avatars and props)
    document.querySelectorAll('.worlds-wrapper--worlds-node').forEach(card => {
        card.style.display = '';
        card.classList.remove('filtered-item');
    });
    
    // Scroll to top of worlds page
    const worldsWrapper = document.querySelector('.worlds-wrapper');
    if (worldsWrapper) {
        worldsWrapper.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Function to setup worlds text filter event listener
export function setupWorldsTextFilter() {
    const worldsFilter = document.querySelector('#worlds-filter');
    if (worldsFilter) {
        worldsFilter.addEventListener('input', (event) => {
            const activeButtonFilter = document.querySelector('.worlds-filter-controls .filter-button.active')?.dataset.filter || 'wrldmine';
            
            // Use the applyWorldFilter function like avatars and props
            applyWorldFilter(activeButtonFilter);
        });
    }
}

// =============
// PROPS SECTION
// =============

// Store prop categories for filtering
let propCategories = [];

// Store props data for category filtering
let propsData = {};

// Function to load prop categories and update filter buttons
export async function loadPropCategories() {
    try {
        const categories = await window.API.getCategories();
        if (categories && categories.spawnables) {
            // Filter out the categories we want to ignore
            propCategories = categories.spawnables.filter(category => 
                !['proppublic', 'prop_new', 'prop_recently'].includes(category.id)
            );
            updatePropFilterButtons();
        }
    } catch (error) {
        console.error('Failed to load prop categories:', error);
        // Fallback to default buttons if categories fail to load
        propCategories = [];
        updatePropFilterButtons();
    }
}

// Function to update prop filter buttons based on categories
function updatePropFilterButtons() {
    const filterControlsContainer = document.querySelector('.props-filter-controls');
    if (!filterControlsContainer) return;

    // Clear existing buttons
    filterControlsContainer.innerHTML = '';

    // Add "My Props" button (using propmine category)
    const myPropsButton = createElement('button', {
        className: 'filter-button active',
        innerHTML: '<span class="material-symbols-outlined">view_in_ar</span>My Props',
        onClick: () => handlePropFilterClick('propmine', myPropsButton)
    });
    myPropsButton.dataset.filter = 'propmine';
    filterControlsContainer.appendChild(myPropsButton);

    // Add "Shared With Me" button (using propshared category)
    const sharedButton = createElement('button', {
        className: 'filter-button',
        innerHTML: '<span class="material-symbols-outlined">share</span>Shared With Me',
        onClick: () => handlePropFilterClick('propshared', sharedButton)
    });
    sharedButton.dataset.filter = 'propshared';
    filterControlsContainer.appendChild(sharedButton);

    // Add user-created category buttons (those starting with 'props_')
    propCategories.forEach(category => {
        // Only add user-created categories (those starting with 'props_')
        if (category.id.startsWith('props_')) {
            const categoryButton = createElement('button', {
                className: 'filter-button',
                innerHTML: `<span class="material-symbols-outlined">label</span>${category.name}`,
                onClick: () => handlePropFilterClick(category.id, categoryButton)
            });
            categoryButton.dataset.filter = category.id;
            filterControlsContainer.appendChild(categoryButton);
        }
    });
}

// Function to handle prop filter button clicks
function handlePropFilterClick(filterType, clickedButton) {
    // Remove active class from all filter buttons
    document.querySelectorAll('.props-filter-controls .filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    clickedButton.classList.add('active');
    
    // Apply the filter
    applyPropFilter(filterType);
}

// Function to apply prop filtering based on selected filter
function applyPropFilter(filterType) {
    const filterText = document.querySelector('#props-filter').value.toLowerCase();
    const propCards = document.querySelectorAll('.props-wrapper--props-node');
    
    propCards.forEach(card => {
        const propName = card.querySelector('.card-name').textContent.toLowerCase();
        const matchesText = filterText === '' || propName.includes(filterText);
        
        let matchesButtonFilter = false;
        
        // Find the prop in our props data by name
        const propNameElement = card.querySelector('.card-name');
        const propNameText = propNameElement.textContent;
        
        // Find the prop in our props data by name
        const propData = Object.values(propsData || {}).find(prop => prop.name === propNameText);
        
        if (propData && propData.categories && Array.isArray(propData.categories)) {
            matchesButtonFilter = propData.categories.includes(filterType);
            // Debug logging
            console.log(`Prop: ${propNameText}, Categories: ${JSON.stringify(propData.categories)}, Filter: ${filterType}, Matches: ${matchesButtonFilter}`);
        } else {
            // If no categories found, only show for fallback cases where we know the prop should match
            // For "propmine" filter, we shouldn't show props without proper category data
            // For "propshared" and custom categories, we also shouldn't show props without categories
            matchesButtonFilter = false;
            console.log(`Prop ${propNameText} has no categories or not found in propsData, hiding for filter: ${filterType}`);
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
export { applyPropFilter };

// Function to handle active user props refresh
export function handlePropsRefresh(ourProps) {
    console.log('[On] GetActiveUserProps');
    console.log(ourProps);

    // Store props data globally for category filtering
    propsData = {};
    ourProps.forEach(prop => {
        propsData[prop.id] = prop;
    });

    const propDisplayNode = document.querySelector('.props-wrapper');
    let docFragment = document.createDocumentFragment();

    for (const ourProp of ourProps) {
        // Use cached image or placeholder
        const imgSrc = friendImageCache[ourProp.imageHash] || 'img/ui/placeholder.png';

        // Create card similar to search and friends layout
        const propNode = createElement('div', {
            className: 'props-wrapper--props-node card-node',
            innerHTML: `
                <div class="thumbnail-container">
                    <img src="${imgSrc}" data-hash="${ourProp.imageHash}" class="hidden"/>
                </div>
                <div class="card-content">
                    <p class="card-name">${ourProp.name}</p>
                    <div class="card-detail">
                        <span class="material-symbols-outlined">view_in_ar</span>Prop
                    </div>
                </div>
            `,
            onClick: () => ShowDetailsWrapper(DetailsType.Prop, ourProp.id),
        });

        // Set placeholder background image and data-hash directly on the container
        const thumbnailContainer = propNode.querySelector('.thumbnail-container');
        thumbnailContainer.style.backgroundImage = `url('${imgSrc}')`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.dataset.hash = ourProp.imageHash;

        docFragment.appendChild(propNode);
    }

    propDisplayNode.replaceChildren(docFragment);
    
    // Apply the current active filter after loading props
    const activeFilterButton = document.querySelector('.props-filter-controls .filter-button.active');
    if (activeFilterButton) {
        const activeFilter = activeFilterButton.dataset.filter;
        applyPropFilter(activeFilter);
    }
}

// Function to initialize props page when navigating to it
export function initializePropsPage() {
    const filterInput = document.querySelector('#props-filter');
    if (filterInput) {
        filterInput.value = '';
    }
    
    // Remove filtered class from all props
    document.querySelectorAll('.props-wrapper--props-node').forEach((e) => {
        e.classList.remove('filtered-item');
        e.style.display = '';
    });
    
    // Load prop categories and reset filter controls
    loadPropCategories().then(() => {
        // Reset to "My Props" filter after categories are loaded
        const myPropsButton = document.querySelector('.props-filter-controls .filter-button[data-filter="propmine"]');
        if (myPropsButton) {
            handlePropFilterClick('propmine', myPropsButton);
        }
    });
    
    // Make sure all prop cards are visible initially
    document.querySelectorAll('.props-wrapper--props-node').forEach(card => {
        card.style.display = '';
        card.classList.remove('filtered-item');
    });
    
    // Scroll to top of props page
    const propsWrapper = document.querySelector('.props-wrapper');
    if (propsWrapper) {
        propsWrapper.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Function to setup props text filter event listener
export function setupPropsTextFilter() {
    const propsFilter = document.querySelector('#props-filter');
    if (propsFilter) {
        propsFilter.addEventListener('input', (event) => {
            const activeButtonFilter = document.querySelector('.props-filter-controls .filter-button.active')?.dataset.filter || 'propmine';
            
            // Use the applyPropFilter function
            applyPropFilter(activeButtonFilter);
        });
    }
}

// ===========
// REFRESH UTILITY FOR FAVORITES
// ===========

/**
 * Trigger content refresh after favorites are updated
 * @param {string} entityType - The type of entity (user, avatar, prop, world)
 * @param {string} entityId - The ID of the entity (not used currently, but may be useful for future)
 */
export function refreshContentAfterFavoritesUpdate(entityType, entityId) {
    console.log(`Triggering content refresh for ${entityType} after favorites update`);
    
    switch (entityType) {
        case 'avatar':
            // Trigger avatar refresh
            window.API.refreshGetActiveUserAvatars();
            break;
        case 'prop':
            // Trigger props refresh
            window.API.refreshGetActiveUserProps();
            break;
        case 'world':
            // Trigger worlds refresh
            window.API.refreshGetActiveUserWorlds();
            break;
        case 'user':
            // For friends, we would refresh friends, but friends categories 
            // are usually handled differently and don't need immediate refresh
            // as they're more about organization than filtering
            console.log('Friend categories updated - no automatic refresh needed');
            break;
        default:
            console.warn(`Unknown entity type for refresh: ${entityType}`);
    }
}
