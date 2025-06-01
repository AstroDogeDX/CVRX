// =======
// MODULES
// =======

import { pushToast } from './astrolib/toasty_notifications.js';
import { applyTooltips } from './astrolib/tooltip.js';
import { parseMarkdown } from './astrolib/github_markdown_parser.js';
import { 
    generateInstanceJoinLink,
    openDeepLink 
} from './astrolib/deeplinks.js';
import { 
    DetailsType,
    getCurrentEntityType,
    getEntityClassPrefix,
    updateDetailsWindowClasses,
    removeAllButtonContainers,
    clearAllTabs,
    createTabButton,
    createTabPane,
    createDetailsSegment,
    createDetailsHeaderStructure,
    updateInstanceCount,
    addEntityTabs,
    createUserDetailsHeader,
    ShowDetails
} from './astrolib/details_constructor.js';
import { loadShares } from './astrolib/shares.js';
import { 
    friendImageCache,
    initializeFriendsModule,
    updateCurrentActiveUser,
    createFriendsListCategory,
    getFriendStatus,
    loadFriendCategories,
    handleFriendsRefresh,
    initializeFriendsPage,
    setupFriendsTextFilter,
    applyFriendFilter,
    loadAvatarCategories,
    handleAvatarsRefresh,
    initializeAvatarsPage,
    setupAvatarsTextFilter,
    applyAvatarFilter,
    loadWorldCategories,
    handleWorldsRefresh,
    handleWorldsByCategoryRefresh,
    initializeWorldsPage,
    setupWorldsTextFilter,
    applyWorldFilter,
    loadPropCategories,
    handlePropsRefresh,
    initializePropsPage,
    setupPropsTextFilter,
    applyPropFilter,
    refreshContentAfterFavoritesUpdate
} from './astrolib/user_content.js';
import { loadCategoriesManager } from './astrolib/categories_manager.js';

// ===========
// GLOBAL VARS
// ===========

// Store the current active user for filtering purposes
let currentActiveUser = null;

// Store active instances for filtering in world details
let activeInstances = [];
let currentWorldDetailsId = null; // Track the currently open world details

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
        e.style.display = ''; // Reset display style to make items visible again
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
            hideAllSearchCategories();
            document.querySelector('.search-status').classList.remove('hidden');
            document.querySelector('.search-no-results').classList.add('hidden');
            document.querySelector('.search-loading').classList.add('hidden');
            break;
        case 'friends':
            initializeFriendsPage();
            break;
        case 'avatars':
            loadAndFilterPageContent('avatars', '#display-avatars', window.API.refreshGetActiveUserAvatars, '#avatars-filter');
            // Initialize avatars page
            initializeAvatarsPage();
            break;
        case 'worlds':
            loadAndFilterPageContent('worlds', '#display-worlds', window.API.refreshGetActiveUserWorlds, '#worlds-filter');
            // Initialize worlds page
            initializeWorldsPage();
            break;
        case 'props':
            loadAndFilterPageContent('props', '#display-props', window.API.refreshGetActiveUserProps, '#props-filter');
            // Initialize props page
            initializePropsPage();
            break;
    }

    // Hide the loading screen
    document.querySelector('.cvrx-main').style.display = 'grid';
    document.querySelector('.loading-shade').style.display = 'none';
}

// Simplify Element w/ Stuff Creation
export function createElement(type, options = {}) {
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

// Temporary reconnect prompt - will be expanded with a proper library later.
function promptReconnect() {
    const promptShade = document.querySelector('.prompt-layer');
    const newPrompt = createElement('div', { className: 'prompt' });
    const promptTitle = createElement('div', { className: 'prompt-title', textContent: 'Socket Error' });
    const promptText = createElement('div', { className: 'prompt-text', textContent: 'Socket failed to reconnect after 5 attempts. Click below to manually reconnect.' });
    const promptButtons = createElement('div', { className: 'prompt-buttons' });
    const confirmButton = createElement('button', {
        className: 'prompt-btn-confirm',
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

// Update prompt using the new modal system
function promptUpdate(updateInfo) {
    const promptShade = document.querySelector('.prompt-layer');
    const newPrompt = createElement('div', { className: 'prompt' });
    const promptTitle = createElement('div', { className: 'prompt-title', textContent: 'Update Available' });
    
    // Create main prompt text with version info
    const promptText = createElement('div', { className: 'prompt-text' });
    
    // Version announcement
    const versionAnnouncement = createElement('p', {
        innerHTML: `A new version (<strong>${updateInfo.tagName}</strong>) of CVRX is available!`
    });
    
    // Changelog header
    const changelogHeader = createElement('p', {
        innerHTML: 'Here are the changes:',
        className: 'changelog-header'
    });
    
    // Changelog content container
    const changelogContainer = createElement('div', {
        className: 'changelog-content',
        innerHTML: parseMarkdown(updateInfo.changeLogs)
    });
    
    // Append all content to prompt text
    promptText.append(versionAnnouncement, changelogHeader, changelogContainer);
    
    const promptButtons = createElement('div', { className: 'prompt-buttons' });

    const downloadButton = createElement('button', {
        className: 'prompt-btn-confirm update-primary-action',
        textContent: 'Download and Install',
        onClick: async () => {
            try {
                // Show toast notification to inform user about the download process
                pushToast('Downloading update... The app will restart automatically once installation begins.', 'info');
                await window.API.updateAction('download', updateInfo);
                newPrompt.remove();
                promptShade.style.display = 'none';
            } catch (error) {
                pushToast('Failed to download update', 'error');
            }
        },
    });

    const askLaterButton = createElement('button', {
        className: 'prompt-btn-neutral',
        textContent: 'Ask Again Later',
        onClick: async () => {
            try {
                await window.API.updateAction('askLater', updateInfo);
                newPrompt.remove();
                promptShade.style.display = 'none';
            } catch (error) {
                pushToast('Failed to set update reminder', 'error');
            }
        },
    });

    const ignoreButton = createElement('button', {
        className: 'prompt-btn-neutral',
        textContent: 'Ignore Until Restart',
        onClick: async () => {
            try {
                await window.API.updateAction('ignore', updateInfo);
                newPrompt.remove();
                promptShade.style.display = 'none';
            } catch (error) {
                pushToast('Failed to ignore update', 'error');
            }
        },
    });

    const skipButton = createElement('button', {
        className: 'prompt-btn-neutral',
        textContent: 'Skip This Version',
        onClick: async () => {
            try {
                await window.API.updateAction('skip', updateInfo);
                newPrompt.remove();
                promptShade.style.display = 'none';
            } catch (error) {
                pushToast('Failed to skip version', 'error');
            }
        },
    });

    promptButtons.append(downloadButton, askLaterButton, ignoreButton, skipButton);
    newPrompt.append(promptTitle, promptText, promptButtons);
    promptShade.append(newPrompt);
    promptShade.style.display = 'flex';
}

// ===============
// EVERYTHING ELSE
// ===============

// Loading screen functionality
const loadingScreen = {
    element: document.querySelector('.loading-shade'),
    status: document.querySelector('.loading-status'),
    progress: document.querySelector('.loading-bar'),
    show: function() {
        this.element.style.display = 'flex';
        this.updateStatus('Loading...');
    },
    hide: function() {
        this.element.style.display = 'none';
    },
    updateStatus: function(text) {
        this.status.textContent = text;
    },
    updateProgress: function(percent) {
        this.progress.style.width = `${percent}%`;
    },
};

// Update loading screen visibility
window.API.onLoadingPage((_event) => {
    loadingScreen.show();
});

// Update loading screen status during authentication
window.API.onLoginPage((_event, _availableCredentials) => {
    loadingScreen.updateStatus('Checking credentials...');
});

// Hide loading screen when main content is ready
window.API.onHomePage((_event) => {
    loadingScreen.hide();
    // Load friend categories when home page is ready
    loadFriendCategories();
    // Load avatar categories when home page is ready
    loadAvatarCategories();
    // Load prop categories when home page is ready
    loadPropCategories();
    // Load world categories when home page is ready
    loadWorldCategories();
    // Setup friends text filter
    setupFriendsTextFilter();
    // Setup avatars text filter
    setupAvatarsTextFilter();
    // Setup worlds text filter
    setupWorldsTextFilter();
    // Setup props text filter
    setupPropsTextFilter();
    
    // Apply the current online friends thumbnail shape on initial load
    window.API.getConfig().then(config => {
        const shape = config.OnlineFriendsThumbnailShape || 'rounded';
        applyOnlineFriendsThumbnailShape(shape);
    }).catch(error => {
        // Fallback to default shape if config fails
        applyOnlineFriendsThumbnailShape('rounded');
    });
});

// Handle automatic update notifications from backend
window.API.onUpdateAvailable((_event, updateInfo) => {
    log('Update available notification received from backend');
    log(updateInfo);
    promptUpdate(updateInfo);
});

// Pages handling
window.API.onLoginPage((_event, availableCredentials) => {
    log('login page!');

    const availableCredentialsNode = document.querySelector('#login-available-credentials-wrapper');
    const newNodes = [];

    for (const availableCredential of availableCredentials) {
        const credentialNode = createElement('div', {
            className: 'login-credential-node',
            innerHTML:
                `<img src="img/ui/placeholder.png" data-hash="${availableCredential.imageHash}"/>
                <span class="login-credential-node--name">${availableCredential.Username}</span>`,
            onClick: async () => {
                // Reveal the loading screen and hide the login page
                document.querySelector('.login-shade').style.display = 'none';
                document.querySelector('.loading-shade').style.display = 'flex';
                await window.API.authenticate(availableCredential.Username, availableCredential.AccessKey, true, true);
            },
        });
        const deleteCredentialButton = createElement('button', {
            className: 'login-credential-node--delete',
            innerHTML: '×',
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

window.API.onHomePage((_event) => {
    swapNavPages('home');
    // Load friend categories when home page is ready
    loadFriendCategories();
    // Load world categories when home page is ready
    loadWorldCategories();
    // Setup friends text filter
    setupFriendsTextFilter();
    // Setup avatars text filter
    setupAvatarsTextFilter();
    // Setup worlds text filter
    setupWorldsTextFilter();
    
    // Apply the current online friends thumbnail shape on initial load
    window.API.getConfig().then(config => {
        const shape = config.OnlineFriendsThumbnailShape || 'rounded';
        applyOnlineFriendsThumbnailShape(shape);
    }).catch(error => {
        // Fallback to default shape if config fails
        applyOnlineFriendsThumbnailShape('rounded');
    });
});


// Navbar Control Logic
document.querySelectorAll('.navbar-button').forEach((e) => {
    e.addEventListener('click', () => {
        // Skip the profile button since it has its own click handler
        if (e.classList.contains('profile-navbar-button')) return;
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

    // Store the current active user for filtering purposes
    currentActiveUser = activeUser;
    
    // Initialize the friends module with dependencies
    initializeFriendsModule({
        currentActiveUser,
        ShowDetailsWrapper,
        DetailsType
    });
    
    // Update the current active user in the friends module
    updateCurrentActiveUser(activeUser);

    // Set profile picture for profile navbar button
    const profileButton = document.querySelector('.profile-navbar-button');
    if (profileButton) {
        profileButton.setAttribute('data-hash', activeUser.imageHash);
        profileButton.style.backgroundImage = 'url(img/ui/placeholder.png)';
        profileButton.onclick = () => ShowDetailsWrapper(DetailsType.User, activeUser.id);
    }
});

// Add image loading handler
window.API.onImageLoaded((_event, imageData) => {
    const { imageHash, imageBase64 } = imageData;

    // Update all elements with matching data-hash
    document.querySelectorAll(`[data-hash="${imageHash}"]`).forEach(element => {
        if (element.classList.contains('profile-navbar-button')) {
            element.style.backgroundImage = `url(${imageBase64})`;
        } else if (element.tagName === 'IMG') {
            element.src = imageBase64;
        }
    });
});

// Helper function to add tabs for a specific entity type




// Create a wrapper function that provides dependencies to the ShowDetails function
function createShowDetailsWrapper() {
    return (entityType, entityId) => {
        // Track if we're opening world details
        if (entityType === DetailsType.World) {
            currentWorldDetailsId = entityId;
        } else {
            currentWorldDetailsId = null;
        }
        
        const dependencies = {
            currentActiveUser,
            activeInstances,
            loadTabContentCallback: loadTabContent,
            createElement,
            pushToast,
            window: window.API,
            onClose: () => {
                // Clear the current world details ID when the window is closed
                currentWorldDetailsId = null;
            }
        };
        return ShowDetails(entityType, entityId, dependencies);
    };
}

// Create the wrapper instance
const ShowDetailsWrapper = createShowDetailsWrapper();

// Function to load content for each tab
async function loadTabContent(tab, entityId) {
    if (tab === 'description') {
        const descriptionContainer = document.querySelector('#description-tab .description-container');
        if (!descriptionContainer) return;

        descriptionContainer.innerHTML = '<div class="loading-indicator">Loading...</div>';

        try {
            // Determine entity type and get appropriate data
            let entityInfo;
            const currentEntityType = getCurrentEntityType(entityId);
            
            if (currentEntityType === 'avatar') {
                entityInfo = await window.API.getAvatarById(entityId);
            } else if (currentEntityType === 'prop') {
                entityInfo = await window.API.getPropById(entityId);
            } else if (currentEntityType === 'world') {
                entityInfo = await window.API.getWorldById(entityId);
            }

            const description = entityInfo?.description || '';
            const tags = entityInfo?.tags || [];
            
            // Create tags HTML if tags exist
            let tagsHtml = '';
            if (tags.length > 0) {
                const tagElements = tags.map(tag => 
                    `<span class="content-tag">${tag}</span>`
                ).join('');
                tagsHtml = `
                    <div class="tags-section">
                        <h4>Tags</h4>
                        <div class="tags-container">${tagElements}</div>
                    </div>
                `;
            }
            
            // Create description content
            descriptionContainer.innerHTML = `
                <div class="description-content">
                    ${description ? 
                        `<div class="description-text">${description}</div>` :
                        `<div class="description-placeholder">No description available</div>`
                    }
                    ${tagsHtml}
                </div>
            `;
        } catch (error) {
            descriptionContainer.innerHTML = `<div class="error-message">Error loading description</div>`;
            log('Error loading description:', error);
        }
        return;
    }

    if (tab === 'shares') {
        // Load shares using the shares module
        loadShares(entityId, createElement);
        return;
    }

    if (tab === 'categories') {
        // Load categories manager for My Profile
        loadCategoriesManager();
        return;
    }

    if (tab === 'notes') {
        const notesContainer = document.querySelector('#notes-tab .notes-container');
        if (!notesContainer) return;

        notesContainer.innerHTML = '<div class="loading-indicator">Loading...</div>';

        try {
            // Get user info to access the note
            const userInfo = await window.API.getUserById(entityId);
            const noteContent = userInfo.note || '';
            
            // Create notes container
            notesContainer.innerHTML = `
                <div class="notes-content">
                    ${noteContent ? 
                        `<p class="note-text">${noteContent}</p>` :
                        `<p class="note-placeholder">No note added</p>`
                    }
                </div>
                <button class="edit-note-button">
                    <span class="material-symbols-outlined">edit</span>
                    ${noteContent ? 'Edit Note' : 'Add Note'}
                </button>
            `;

            // Add click handler for edit button
            const editButton = notesContainer.querySelector('.edit-note-button');
            editButton.onclick = () => {
                // Create edit form
                const editForm = createElement('div', {
                    className: 'note-edit-form',
                    innerHTML: `
                        <textarea class="note-textarea" placeholder="Enter your note here...">${noteContent}</textarea>
                        <div class="note-edit-buttons">
                            <button class="save-note-button">
                                <span class="material-symbols-outlined">save</span>
                                Save
                            </button>
                            <button class="cancel-note-button">
                                <span class="material-symbols-outlined">close</span>
                                Cancel
                            </button>
                        </div>
                    `
                });

                // Replace the entire notes container content with the edit form
                notesContainer.innerHTML = '';
                notesContainer.appendChild(editForm);

                // Focus the textarea
                const textarea = editForm.querySelector('.note-textarea');
                textarea.focus();

                // Add save handler
                const saveButton = editForm.querySelector('.save-note-button');
                saveButton.onclick = async () => {
                    const newNote = textarea.value.trim();
                    try {
                        await window.API.setFriendNote(entityId, newNote);
                        // Reload the tab content to show updated note
                        loadTabContent('notes', entityId);
                        pushToast('Note saved successfully', 'confirm');
                    } catch (error) {
                        pushToast('Failed to save note', 'error');
                    }
                };

                // Add cancel handler
                const cancelButton = editForm.querySelector('.cancel-note-button');
                cancelButton.onclick = () => {
                    // Reload the tab content to revert changes
                    loadTabContent('notes', entityId);
                };
            };
        } catch (error) {
            notesContainer.innerHTML = `<div class="error-message">Error loading note</div>`;
            log('Error loading note:', error);
        }
        return;
    }

    if (tab === 'adv-settings') {
        // Load Advanced Avatar Settings using the AAS module
        const { loadAdvancedAvatarSettings } = await import('./astrolib/advanced_avatar_settings.js');
        loadAdvancedAvatarSettings(entityId);
        return;
    }

    // Determine the current entity type to use the correct grid class
    const currentEntityType = getCurrentEntityType(entityId);
    let entityClassPrefix = 'user-details'; // Default fallback
    
    // Map current entity type to class prefix
    switch (currentEntityType) {
        case 'avatar':
            entityClassPrefix = 'avatar-details';
            break;
        case 'prop':
            entityClassPrefix = 'prop-details';
            break;
        case 'world':
            entityClassPrefix = 'world-details';
            break;
        case 'instance':
            entityClassPrefix = 'instance-details';
            break;
        default:
            entityClassPrefix = 'user-details';
            break;
    }

    const grid = document.querySelector(`#${tab}-tab .${entityClassPrefix}-grid`);
    if (!grid) return;

    grid.innerHTML = '<div class="loading-indicator">Loading...</div>';

    try {
        let items = [];
        switch (tab) {
            case 'avatars':
                items = await window.API.getUserPublicAvatars(entityId);
                break;
            case 'props':
                items = await window.API.getUserPublicProps(entityId);
                break;
            case 'worlds':
                items = await window.API.getUserPublicWorlds(entityId);
                break;
            case 'users':
                // Get instance info to access the members
                const instanceInfo = await window.API.getInstanceById(entityId);
                items = instanceInfo.members || [];
                break;
            case 'instances':
                // For worlds, get active instances using this world
                // Filter the global active instances by world ID
                items = activeInstances.filter(instance => instance.world?.id === entityId) || [];
                break;
            case 'stats':
                // Stats tab is disabled, but we'll keep this case for future implementation
                grid.innerHTML = '<div class="no-items-message">Stats feature coming soon!</div>';
                return;
        }

        // Clear loading indicator
        grid.innerHTML = '';

        // If no items, show message
        if (items.length === 0) {
            grid.innerHTML = `<div class="no-items-message">No ${tab} found</div>`;
            return;
        }

        // Create and append items to grid
        items.forEach(item => {
            // Add type-specific content
            let additionalInfo = '';
            let icon = '';

            switch (tab) {
                case 'avatars':
                    icon = 'emoji_people';
                    additionalInfo = `
                        <div class="card-detail">
                            <span class="material-symbols-outlined">${icon}</span>Avatar
                        </div>`;
                    break;
                case 'props':
                    icon = 'view_in_ar';
                    additionalInfo = `
                        <div class="card-detail">
                            <span class="material-symbols-outlined">${icon}</span>Prop
                        </div>`;
                    break;
                case 'worlds': {
                    icon = 'language';
                    // Add player count if available
                    const playerCount = item.playerCount ?
                        `<div class="player-count-indicator">
                            <span class="material-symbols-outlined">group</span>${item.playerCount}
                        </div>` : '';
                    additionalInfo = `
                        ${playerCount}
                        <div class="card-detail">
                            <span class="material-symbols-outlined">${icon}</span>World
                        </div>`;
                    break;
                }
                case 'instances': {
                    icon = 'public';
                    // Add privacy indicator
                    const privacyIcon = item.privacy === 'Public' ? 'public' : 'group';
                    const privacyLabel = item.privacy || 'Unknown';
                    
                    // Add player count
                    const playerCount = `<div class="player-count-indicator">
                        <span class="material-symbols-outlined">group</span>${item.currentPlayerCount || 0}/${item.maxPlayer || '?'}
                    </div>`;
                    
                    // Add region indicator
                    const regionIndicator = item.region ? 
                        `<div class="region-indicator">
                            <div class="region-${item.region}"></div>${item.region.toUpperCase()}
                        </div>` : '';
                    
                    additionalInfo = `
                        ${playerCount}
                        ${regionIndicator}
                        <div class="card-detail">
                            <span class="material-symbols-outlined">${privacyIcon}</span>${privacyLabel}
                        </div>`;
                    break;
                }
                case 'users': {
                    icon = 'person';
                    // Add friend indicator if applicable
                    const friendIndicator = item.isFriend ?
                        `<div class="friend-indicator">
                            <span class="material-symbols-outlined">group</span>Friend
                        </div>` : '';
                    // Add blocked indicator if applicable
                    const blockedIndicator = item.isBlocked ?
                        `<div class="blocked-indicator">
                            <span class="material-symbols-outlined">block</span>Blocked
                        </div>` : '';
                    additionalInfo = `
                        ${friendIndicator}
                        ${blockedIndicator}
                        <div class="card-detail">
                            <span class="material-symbols-outlined">${icon}</span>User
                        </div>`;
                    break;
                }
            }

            // Special handling for instance cards
            if (tab === 'instances') {
                // Create user icons for instance members
                let userIconsHtml = '';
                if (item.members && item.members.length > 0) {
                    const maxVisibleIcons = 24;
                    const visibleMembers = item.members.slice(0, maxVisibleIcons);
                    const remainingCount = item.members.length - maxVisibleIcons;
                    
                    userIconsHtml = `<div class="instance-card-user-icons">`;
                    visibleMembers.forEach(member => {
                        const memberImgSrc = friendImageCache[member.imageHash] || 'img/ui/placeholder.png';
                        const memberClasses = member.isFriend ? 'instance-user-icon friend' : 'instance-user-icon';
                        const blockedClass = member.isBlocked ? ' blocked' : '';
                        userIconsHtml += `<img src="${memberImgSrc}" class="${memberClasses}${blockedClass}" data-hash="${member.imageHash}" data-tooltip="${member.name}" />`;
                    });
                    
                    if (remainingCount > 0) {
                        userIconsHtml += `<div class="instance-user-icon-remainder">+${remainingCount}</div>`;
                    }
                    userIconsHtml += `</div>`;
                }

                const itemNode = createElement('div', {
                    className: 'card-node instance-card-node',
                    innerHTML: `
                        <div class="thumbnail-container instance-thumbnail">
                            <img src="img/ui/placeholder.png" data-hash="${item.world?.imageHash}" class="hidden"/>
                            <div class="instance-overlay">
                                ${userIconsHtml}
                            </div>
                        </div>
                        <div class="card-content">
                            <p class="card-name">${item.name || 'Unknown Instance'}</p>
                            <p class="card-description">${item.world?.name || ''}</p>
                            ${additionalInfo}
                        </div>
                    `,
                    onClick: () => ShowDetailsWrapper(DetailsType.Instance, item.id),
                });

                // Set blurred world background for instance cards
                const thumbnailContainer = itemNode.querySelector('.thumbnail-container');
                const worldImgSrc = friendImageCache[item.world?.imageHash] || 'img/ui/placeholder.png';
                thumbnailContainer.style.backgroundImage = `url('${worldImgSrc}')`;
                thumbnailContainer.style.backgroundSize = 'cover';
                thumbnailContainer.dataset.hash = item.world?.imageHash;

                grid.appendChild(itemNode);
            } else {
                // Regular card handling for other types
                const itemNode = createElement('div', {
                    className: 'card-node',
                    innerHTML: `
                        <div class="thumbnail-container">
                            <img src="img/ui/placeholder.png" data-hash="${item.imageHash}" class="hidden"/>
                        </div>
                        <div class="card-content">
                            <p class="card-name">${item.name}</p>
                            <p class="card-description">${item.description || ''}</p>
                            ${additionalInfo}
                        </div>
                    `,
                    onClick: () => {
                        switch (tab) {
                            case 'avatars':
                                ShowDetailsWrapper(DetailsType.Avatar, item.id);
                                break;
                            case 'props':
                                ShowDetailsWrapper(DetailsType.Prop, item.id);
                                break;
                            case 'worlds':
                                ShowDetailsWrapper(DetailsType.World, item.id);
                                break;
                            case 'users':
                                ShowDetailsWrapper(DetailsType.User, item.id);
                                break;
                        }
                    },
                });

                // Set placeholder background image
                const thumbnailContainer = itemNode.querySelector('.thumbnail-container');
                thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
                thumbnailContainer.style.backgroundSize = 'cover';
                thumbnailContainer.dataset.hash = item.imageHash;

                grid.appendChild(itemNode);
            }
        });
    } catch (error) {
        grid.innerHTML = `<div class="error-message">Error loading ${tab}</div>`;
        log(`Error loading ${tab}:`, error);
    }
}

window.API.onFriendsRefresh((_event, friends, isRefresh) => {
    handleFriendsRefresh(friends, isRefresh);
    
    // Apply the current online friends thumbnail shape after friends are refreshed
    window.API.getConfig().then(config => {
        const shape = config.OnlineFriendsThumbnailShape || 'rounded';
        applyOnlineFriendsThumbnailShape(shape);
    }).catch(error => {
        // Fallback to default shape if config fails
        applyOnlineFriendsThumbnailShape('rounded');
    });
});

// Friends text filter is now handled by setupFriendsTextFilter in user_content module

// returns .imageBase64, .imageHash, .imageUrl
window.API.onImageLoaded((_event, image) => {
    // Cache the image when it's loaded
    friendImageCache[image.imageHash] = image.imageBase64;

    document.querySelectorAll(`[data-hash="${image.imageHash}"]`).forEach((e) => {
        if (e.tagName === 'IMG') {
            // For regular image tags
            e.src = image.imageBase64;
        } else if (e.classList.contains('thumbnail-container')) {
            // For thumbnail containers using background images
            e.style.backgroundImage = `url('${image.imageBase64}')`;
            e.style.backgroundSize = 'cover';
        }
    });
});


// Janky Search
// -----------------------------
const searchBar = document.getElementById('search-bar');
searchBar.addEventListener('keypress', async (event) => {
    const searchTerm = searchBar.value;

    // Ignore if the key pressed was not ENTER
    if (event.key !== 'Enter') { return; }

    event.preventDefault();

    // Check for special GUID prefixes
    const guidPrefixes = {
        'a+': DetailsType.Avatar,
        'p+': DetailsType.Prop,
        'i+': DetailsType.Instance,
        'u+': DetailsType.User
    };

    for (const [prefix, type] of Object.entries(guidPrefixes)) {
        if (searchTerm.startsWith(prefix)) {
            const guid = searchTerm.slice(prefix.length);
            // Basic GUID format validation (8-4-4-4-12 format)
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                pushToast('Invalid GUID format', 'error');
                return;
            }

            try {
                // Show loading state
                document.querySelector('.search-status').classList.add('hidden');
                document.querySelector('.search-no-results').classList.add('hidden');
                document.querySelector('.search-loading').classList.remove('hidden');
                hideAllSearchCategories();

                // Attempt to show details for the GUID
                await ShowDetailsWrapper(type, guid);
                
                // Clear the search bar after successful search
                searchBar.value = '';
                
                // Hide loading state
                document.querySelector('.search-loading').classList.add('hidden');
                return;
            } catch (error) {
                pushToast('Failed to load details for the specified GUID', 'error');
                document.querySelector('.search-loading').classList.add('hidden');
                // Don't clear the search bar on error so user can fix their input
                return;
            }
        }
    }

    if (!searchTerm || searchTerm.length < 3) {
        document.querySelector('.search-status').classList.remove('hidden');
        document.querySelector('.search-no-results').classList.add('hidden');
        document.querySelector('.search-loading').classList.add('hidden');
        hideAllSearchCategories();
        return;
    }

    // Show loading state
    document.querySelector('.search-status').classList.add('hidden');
    document.querySelector('.search-no-results').classList.add('hidden');
    document.querySelector('.search-loading').classList.remove('hidden');
    hideAllSearchCategories();

    // Disable the search while we're fetching and populating the results
    searchBar.disabled = true;

    try {
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
            let additionalInfo = '';
            let badgeInfo = '';
            let rankInfo = '';
            let tagsList = '';
            let creatorInfo = '';

            // Add type-specific content based on available data
            switch (result.type) {
                case 'user':
                    // Check if user has a featured badge (this would be available in detailed data)
                    if (result.featuredBadge && result.featuredBadge.name && result.featuredBadge.name !== 'No badge featured') {
                        badgeInfo = `<div class="badge-indicator">
                            <span class="material-symbols-outlined">workspace_premium</span>
                            ${result.featuredBadge.name}
                        </div>`;
                    }

                    // Display rank if available
                    rankInfo = result.rank ?
                        `<p class="creator-info"><span class="material-symbols-outlined">military_tech</span>Rank: ${result.rank}</p>` : '';

                    additionalInfo = `
                        ${rankInfo}
                        <div class="search-result-detail">
                            <span class="material-symbols-outlined">account_circle</span>View Profile
                        </div>`;
                    break;

                case 'world':
                    // For worlds, we could have tags, player counts or other metadata
                    if (result.tags && result.tags.length > 0) {
                        const tagElements = result.tags.slice(0, 3).map(tag =>
                            `<span class="world-tag">${tag}</span>`,
                        ).join('');

                        tagsList = `<div class="world-tags">${tagElements}</div>`;
                    }

                    // Show creator info if available
                    creatorInfo = result.author ?
                        `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${result.author.name}</p>` : '';

                    additionalInfo = `
                        ${creatorInfo}
                        ${tagsList}
                        <div class="search-result-detail">
                            <span class="material-symbols-outlined">travel_explore</span>Explore
                        </div>`;
                    break;

                case 'avatar':
                    // Show creator info if available
                    creatorInfo = result.author ?
                        `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${result.author.name}</p>` : '';

                    additionalInfo = `
                        ${creatorInfo}
                        <div class="search-result-detail">
                            <span class="material-symbols-outlined">person_outline</span>Avatar
                        </div>`;
                    break;

                case 'prop':
                    // Show creator info if available
                    creatorInfo = result.author ?
                        `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${result.author.name}</p>` : '';

                    additionalInfo = `
                        ${creatorInfo}
                        <div class="search-result-detail">
                            <span class="material-symbols-outlined">category</span>Prop
                        </div>`;
                    break;
            }

            let searchResult = createElement('div', {
                className: 'search-output--node',
                innerHTML: `
                    ${badgeInfo}
                    <div class="thumbnail-container">
                        <img src="img/ui/placeholder.png" data-hash="${result.imageHash}" class="hidden"/>
                    </div>
                    <div class="search-result-content">
                        <p class="search-result-name">${result.name}</p>
                        <p class="search-result-type">${result.type}</p>
                        ${additionalInfo}
                    </div>
                `,
            });

            // Set placeholder background image
            const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
            thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
            thumbnailContainer.style.backgroundSize = 'cover';

            // Store the image hash for later loading
            thumbnailContainer.dataset.hash = result.imageHash;

            switch (result.type) {
                case 'user':
                    searchResult.onclick = () => ShowDetailsWrapper(DetailsType.User, result.id);
                    userResults.push(searchResult);
                    break;
                case 'world':
                    searchResult.onclick = () => ShowDetailsWrapper(DetailsType.World, result.id);
                    worldsResults.push(searchResult);
                    break;
                case 'avatar':
                    searchResult.onclick = () => ShowDetailsWrapper(DetailsType.Avatar, result.id);
                    avatarResults.push(searchResult);
                    break;
                case 'prop':
                    searchResult.onclick = () => ShowDetailsWrapper(DetailsType.Prop, result.id);
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

        // Show/hide categories based on results and uncollapse them
        toggleCategoryVisibility('.users-category', userResults.length > 0);
        toggleCategoryVisibility('.worlds-category', worldsResults.length > 0);
        toggleCategoryVisibility('.avatars-category', avatarResults.length > 0);
        toggleCategoryVisibility('.props-category', propsResults.length > 0);

        // Uncollapse all visible categories after search
        document.querySelectorAll('.search-output-category:not(.empty)').forEach(category => {
            category.classList.remove('collapsed');
        });

        // Add category counts to headers
        updateCategoryCount('.users-category', userResults.length);
        updateCategoryCount('.worlds-category', worldsResults.length);
        updateCategoryCount('.avatars-category', avatarResults.length);
        updateCategoryCount('.props-category', propsResults.length);

        // Show "no results" message if no results found
        const totalResults = userResults.length + worldsResults.length + avatarResults.length + propsResults.length;
        if (totalResults === 0) {
            document.querySelector('.search-no-results').classList.remove('hidden');
        } else {
            document.querySelector('.search-no-results').classList.add('hidden');
        }
    } catch (error) {
        pushToast('Error performing search', 'error');
    } finally {
        // Hide loading state and re-enable search regardless of success/failure
        document.querySelector('.search-loading').classList.add('hidden');
        searchBar.disabled = false;
        applyTooltips();
    }
});

// Helper function to toggle category visibility
function toggleCategoryVisibility(categorySelector, isVisible) {
    const category = document.querySelector(categorySelector);
    if (isVisible) {
        category.classList.remove('empty');
    } else {
        category.classList.add('empty');
        category.classList.remove('collapsed');
    }
}

// Function to update category headers with result counts
function updateCategoryCount(categorySelector, count) {
    if (count > 0) {
        const categoryTitle = document.querySelector(`${categorySelector} h3 .category-title`);
        const existingCount = categoryTitle.querySelector('.category-count');

        if (existingCount) {
            existingCount.textContent = `\u00A0\u00A0(${count})`;
        } else {
            const countSpan = document.createElement('span');
            countSpan.className = 'category-count';
            countSpan.textContent = `\u00A0\u00A0(${count})`;
            categoryTitle.appendChild(countSpan);
        }
    }
}

// Function to handle random content discovery
async function handleRandomDiscovery() {
    const searchBar = document.getElementById('search-bar');
    const randomButton = document.getElementById('discover-random');
    
    // Show loading state
    document.querySelector('.search-status').classList.add('hidden');
    document.querySelector('.search-no-results').classList.add('hidden');
    document.querySelector('.search-loading').classList.remove('hidden');
    hideAllSearchCategories();

    // Disable the button and search bar while fetching
    randomButton.disabled = true;
    searchBar.disabled = true;

    try {
        // Fetch random content from all types with count of 16 each
        const [randomAvatars, randomWorlds, randomProps] = await Promise.all([
            window.API.getRandomAvatars(20),
            window.API.getRandomWorlds(20),
            window.API.getRandomProps(20)
        ]);

        log('Random content fetched!');
        log({ avatars: randomAvatars, worlds: randomWorlds, props: randomProps });

        // Get search output containers
        const searchOutputUsers = document.querySelector('.search-output--users');
        const searchOutputWorlds = document.querySelector('.search-output--worlds');
        const searchOutputAvatars = document.querySelector('.search-output--avatars');
        const searchOutputProps = document.querySelector('.search-output--props');

        const userResults = []; // No random users available
        const worldsResults = [];
        const avatarResults = [];
        const propsResults = [];

        // Process random avatars (convert to search result format)
        for (const avatar of randomAvatars) {
            const creatorInfo = avatar.author ? 
                `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${avatar.author.name}</p>` : '';

            const additionalInfo = `
                ${creatorInfo}
                <div class="search-result-detail">
                    <span class="material-symbols-outlined">person_outline</span>Avatar
                </div>`;

            let searchResult = createElement('div', {
                className: 'search-output--node',
                innerHTML: `
                    <div class="thumbnail-container">
                        <img src="img/ui/placeholder.png" data-hash="${avatar.imageHash}" class="hidden"/>
                    </div>
                    <div class="search-result-content">
                        <p class="search-result-name">${avatar.name}</p>
                        <p class="search-result-type">avatar</p>
                        ${additionalInfo}
                    </div>
                `,
                onClick: () => ShowDetailsWrapper(DetailsType.Avatar, avatar.id),
            });

            // Set placeholder background image
            const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
            thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
            thumbnailContainer.style.backgroundSize = 'cover';
            thumbnailContainer.dataset.hash = avatar.imageHash;

            avatarResults.push(searchResult);
        }

        // Process random worlds (convert to search result format)
        for (const world of randomWorlds) {
            // Handle tags if available
            let tagsList = '';
            if (world.tags && world.tags.length > 0) {
                const tagElements = world.tags.slice(0, 3).map(tag =>
                    `<span class="world-tag">${tag}</span>`
                ).join('');
                tagsList = `<div class="world-tags">${tagElements}</div>`;
            }

            const creatorInfo = world.author ? 
                `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${world.author.name}</p>` : '';

            const additionalInfo = `
                ${creatorInfo}
                ${tagsList}
                <div class="search-result-detail">
                    <span class="material-symbols-outlined">travel_explore</span>Explore
                </div>`;

            let searchResult = createElement('div', {
                className: 'search-output--node',
                innerHTML: `
                    <div class="thumbnail-container">
                        <img src="img/ui/placeholder.png" data-hash="${world.imageHash}" class="hidden"/>
                    </div>
                    <div class="search-result-content">
                        <p class="search-result-name">${world.name}</p>
                        <p class="search-result-type">world</p>
                        ${additionalInfo}
                    </div>
                `,
                onClick: () => ShowDetailsWrapper(DetailsType.World, world.id),
            });

            // Set placeholder background image
            const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
            thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
            thumbnailContainer.style.backgroundSize = 'cover';
            thumbnailContainer.dataset.hash = world.imageHash;

            worldsResults.push(searchResult);
        }

        // Process random props (convert to search result format)
        for (const prop of randomProps) {
            const creatorInfo = prop.author ? 
                `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${prop.author.name}</p>` : '';

            const additionalInfo = `
                ${creatorInfo}
                <div class="search-result-detail">
                    <span class="material-symbols-outlined">category</span>Prop
                </div>`;

            let searchResult = createElement('div', {
                className: 'search-output--node',
                innerHTML: `
                    <div class="thumbnail-container">
                        <img src="img/ui/placeholder.png" data-hash="${prop.imageHash}" class="hidden"/>
                    </div>
                    <div class="search-result-content">
                        <p class="search-result-name">${prop.name}</p>
                        <p class="search-result-type">prop</p>
                        ${additionalInfo}
                    </div>
                `,
                onClick: () => ShowDetailsWrapper(DetailsType.Prop, prop.id),
            });

            // Set placeholder background image
            const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
            thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
            thumbnailContainer.style.backgroundSize = 'cover';
            thumbnailContainer.dataset.hash = prop.imageHash;

            propsResults.push(searchResult);
        }

        // Replace previous search results with the random results
        searchOutputUsers.replaceChildren(...userResults);
        searchOutputWorlds.replaceChildren(...worldsResults);
        searchOutputAvatars.replaceChildren(...avatarResults);
        searchOutputProps.replaceChildren(...propsResults);

        // Show/hide categories based on results and uncollapse them
        toggleCategoryVisibility('.users-category', userResults.length > 0);
        toggleCategoryVisibility('.worlds-category', worldsResults.length > 0);
        toggleCategoryVisibility('.avatars-category', avatarResults.length > 0);
        toggleCategoryVisibility('.props-category', propsResults.length > 0);

        // Uncollapse all visible categories after fetching random content
        document.querySelectorAll('.search-output-category:not(.empty)').forEach(category => {
            category.classList.remove('collapsed');
        });

        // Add category counts to headers
        updateCategoryCount('.users-category', userResults.length);
        updateCategoryCount('.worlds-category', worldsResults.length);
        updateCategoryCount('.avatars-category', avatarResults.length);
        updateCategoryCount('.props-category', propsResults.length);

        // Clear the search bar to indicate this is random content, not search results
        searchBar.value = '';

        // Show "no results" message if no results found (shouldn't happen for random content)
        const totalResults = userResults.length + worldsResults.length + avatarResults.length + propsResults.length;
        if (totalResults === 0) {
            document.querySelector('.search-no-results').classList.remove('hidden');
        } else {
            document.querySelector('.search-no-results').classList.add('hidden');
        }

        pushToast('Random content loaded!', 'confirm');
    } catch (error) {
        pushToast('Error fetching random content', 'error');
        log('Error fetching random content:', error);
    } finally {
        // Hide loading state and re-enable controls regardless of success/failure
        document.querySelector('.search-loading').classList.add('hidden');
        randomButton.disabled = false;
        searchBar.disabled = false;
        applyTooltips();
    }
}

// Hide all search categories
function hideAllSearchCategories() {
    document.querySelectorAll('.search-output-category').forEach(category => {
        category.classList.add('empty');
        category.classList.remove('collapsed');

        // Reset category counts
        const countSpan = category.querySelector('.category-count');
        if (countSpan) countSpan.remove();
    });
}

// Add input event to handle search status message
searchBar.addEventListener('input', () => {
    if (searchBar.value.length === 0) {
        document.querySelector('.search-status').classList.remove('hidden');
        document.querySelector('.search-no-results').classList.add('hidden');
        document.querySelector('.search-loading').classList.add('hidden');
        hideAllSearchCategories();
    }
});

// Set up category toggling
document.querySelectorAll('.search-output-category h3').forEach(header => {
    header.addEventListener('click', () => {
        const category = header.closest('.search-output-category');
        if (!category.classList.contains('empty')) {
            category.classList.toggle('collapsed');
        }
    });
});

// Set up Random discover button
document.getElementById('discover-random').addEventListener('click', handleRandomDiscovery);

// Set up New Content discover button
document.getElementById('discover-new').addEventListener('click', handleNewContentDiscovery);

// Set up Recently Updated discover button
document.getElementById('discover-updated').addEventListener('click', handleRecentlyUpdatedDiscovery);

// Janky Active Instances
// -----------------------------
window.API.onActiveInstancesUpdate((_event, activeInstancesData) => {
    // Store active instances globally for use in world details
    activeInstances = activeInstancesData;
    
    // Update instance count for any currently open world details
    if (currentWorldDetailsId) {
        updateInstanceCount(currentWorldDetailsId, activeInstances);
    }
    
    const homeActivity = document.querySelector('.home-activity--activity-wrapper');

    // Sort instances: current user first, then friends (by friend count desc), then by total player count desc
    activeInstancesData.sort((a, b) => {
        const aHasCurrentUser = currentActiveUser && a.members.some(member => member.id === currentActiveUser.id);
        const bHasCurrentUser = currentActiveUser && b.members.some(member => member.id === currentActiveUser.id);
        
        // If one has the current user and the other doesn't, prioritize the one with current user
        if (aHasCurrentUser && !bHasCurrentUser) return -1;
        if (bHasCurrentUser && !aHasCurrentUser) return 1;
        
        const aFriendCount = a.members.filter(member => member.isFriend).length;
        const bFriendCount = b.members.filter(member => member.isFriend).length;
        
        // If one has friends and the other doesn't, prioritize the one with friends
        if (aFriendCount > 0 && bFriendCount === 0) return -1;
        if (bFriendCount > 0 && aFriendCount === 0) return 1;
        
        // If both have friends, sort by friend count (descending)
        if (aFriendCount > 0 && bFriendCount > 0) {
            return bFriendCount - aFriendCount;
        }
        
        // If neither has friends, sort by total player count (descending)
        return b.currentPlayerCount - a.currentPlayerCount;
    });

    // Create the search result elements
    const elementsOfResults = [];
    for (const result of activeInstancesData) {
        const elementsOfMembers = [];
        const elementsOfBlocked = [];
        const elementsOfCurrentUser = []; // Array to hold the current user's icon

        let friendCount = 0;
        for (const member of result.members) {
            let userIconSource = member?.imageBase64 ?? 'img/ui/placeholder.png';
            let userIcon = createElement('img', {
                className: 'active-instance-node--user-icon',
                src: userIconSource,
                onClick: () => ShowDetailsWrapper(DetailsType.User, member.id),
            });
            userIcon.dataset.hash = member.imageHash;
            userIcon.dataset.tooltip = member.name;
            
            if (member.isBlocked) {
                userIcon.classList.add('active-instance-node--blocked');
                userIcon.dataset.tooltip = `<span class="tooltip-blocked">${userIcon.dataset.tooltip} <small>(Blocked)</small></span>`;
                elementsOfBlocked.push(userIcon);
                continue;
            }
            
            // Check if this member is the current logged-in user
            if (currentActiveUser && member.id === currentActiveUser.id) {
                userIcon.classList.add('icon-is-you');
                userIcon.dataset.tooltip = `${member.name} <small style="color: rgba(255,255,255,0.6); font-size: 0.85em;">(You)</small>`;
                elementsOfCurrentUser.push(userIcon);
                continue;
            }
            
            if (member.isFriend) {
                userIcon.classList.add('icon-is-online');
                friendCount++;
                elementsOfMembers.push(userIcon);
                continue;
            }
            elementsOfMembers.push(userIcon);
        }

        let instanceName = result.name.substring(0, result.name.length - 10);
        let instanceID = result.name.slice(-9);

        if (result.privacy === 'Public') {
            instanceName = `<span class="instance-privacy-type material-symbols-outlined" data-tooltip="Public Instance">public</span> ${instanceName}`;
        } else {
            instanceName = `<span class="instance-privacy-type material-symbols-outlined" data-tooltip="Friends Instance">group</span> ${instanceName}`;
        }

        // Depending on whether it's a refresh or not the image might be already loaded
        const worldImageSource = result?.world?.imageBase64 ?? 'img/ui/placeholder.png';

        // If no friends then no friend counter :'(

        let friendDisplay = friendCount ? `<span class="material-symbols-outlined">groups</span>${friendCount}` : '';

        const activeWorldUserIconWrapper = createElement('div', { className: 'active-instance-node--user-icon-wrapper' });
        activeWorldUserIconWrapper.append(...elementsOfCurrentUser, ...elementsOfMembers, ...elementsOfBlocked);

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

        // Add click handlers for instance name and thumbnail
        const instanceNameElement = activeWorldNode.querySelector('.active-instance-node--name');
        const instanceIconElement = activeWorldNode.querySelector('.active-instance-node--icon');
        
        instanceNameElement.style.cursor = 'pointer';
        instanceIconElement.style.cursor = 'pointer';
        
        instanceNameElement.onclick = () => ShowDetailsWrapper(DetailsType.Instance, result.id);
        instanceIconElement.onclick = () => ShowDetailsWrapper(DetailsType.Instance, result.id);

        elementsOfResults.push(activeWorldNode);
    }

    // Replace previous search results with the new ones
    homeActivity.replaceChildren(...elementsOfResults);
    applyTooltips();
});

// User Stats Handler for the user count display
window.API.onUserStats((_event, userStats) => {
    const userCountElement = document.querySelector('.home-activity--user-count');
    if (userCountElement && userStats) {
        // Update the text content with the total count
        userCountElement.textContent = `${userStats.usersOnline.overall} Online`;
        
        // Create detailed tooltip with breakdown
        const tooltip = `
            <div class="user-stats-tooltip">
                <div class="user-stats-total">Total Online: ${userStats.usersOnline.overall}</div>
                <div class="user-stats-breakdown">
                    <div class="user-stats-item">
                        <span class="material-symbols-outlined">public</span>
                        Public: ${userStats.usersOnline.public}
                    </div>
                    <div class="user-stats-item">
                        <span class="material-symbols-outlined">group</span>
                        Private: ${userStats.usersOnline.other}
                    </div>
                    <div class="user-stats-item">
                        <span class="material-symbols-outlined">visibility_off</span>
                        Offline Instance: ${userStats.usersOnline.notConnected}
                    </div>
                </div>
            </div>
        `;
        userCountElement.dataset.tooltip = tooltip;
        
        // Reapply tooltips to update the new tooltip
        applyTooltips();
    }
});

// Janky invite listener
window.API.onInvites((_event, invites) => {
    log('Invites Received!');
    log(invites);

    const homeRequests = document.querySelector('.home-requests-wrapper');

    // Remove previous invites
    document.querySelectorAll('.notification-invite').forEach(el => el.remove());

    // Create the invite notification elements
    for (const invite of invites) {
        const userImageNode = createElement('img', {
            className: 'notification-avatar',
            src: 'img/ui/placeholder.png',
            onClick: () => ShowDetailsWrapper(DetailsType.User, invite.user.id),
        });
        userImageNode.dataset.hash = invite.user.imageHash;

        const worldImageNode = createElement('img', {
            className: 'notification-world-thumbnail',
            src: 'img/ui/placeholder.png',
        });
        worldImageNode.dataset.hash = invite.world.imageHash;

        // Create split button for joining the instance
        const joinSplitButton = createElement('div', {
            className: 'notification-split-button',
        });

        // Join Desktop button (left side of split)
        const joinDesktopButton = createElement('button', {
            className: 'split-button-left',
            innerHTML: '<span class="material-symbols-outlined">desktop_windows</span>Desktop',
            onClick: async () => {
                try {
                    if (!invite.instanceId) {
                        pushToast('Could not get instance ID from invite', 'error');
                        return;
                    }
                    
                    const deepLink = generateInstanceJoinLink(invite.instanceId, false);
                    const success = await openDeepLink(deepLink);
                    if (success) {
                        pushToast('Joining instance in Desktop mode...', 'confirm');
                    } else {
                        pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                    }
                } catch (error) {
                    log('Failed to join instance in desktop:', error);
                    pushToast('Failed to generate join link', 'error');
                }
            },
        });

        // Join VR button (right side of split)
        const joinVRButton = createElement('button', {
            className: 'split-button-right',
            innerHTML: '<span class="material-symbols-outlined">view_in_ar</span>VR',
            onClick: async () => {
                try {
                    if (!invite.instanceId) {
                        pushToast('Could not get instance ID from invite', 'error');
                        return;
                    }
                    
                    const deepLink = generateInstanceJoinLink(invite.instanceId, true);
                    const success = await openDeepLink(deepLink);
                    if (success) {
                        pushToast('Joining instance in VR mode...', 'confirm');
                    } else {
                        pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                    }
                } catch (error) {
                    log('Failed to join instance in VR:', error);
                    pushToast('Failed to generate join link', 'error');
                }
            },
        });

        // Add both buttons to the split button container
        joinSplitButton.append(joinDesktopButton, joinVRButton);

        const inviteNode = createElement('div', {
            className: 'notification-item notification-invite',
            innerHTML: `
                <div class="notification-content">
                    <div class="notification-main">
                        <div class="notification-text">
                            <span class="notification-sender" data-user-id="${invite.user.id}">${invite.user.name}</span>
                            <span class="notification-message">invited you to join</span>
                        </div>
                        <div class="notification-target">
                            <div class="notification-world-info">
                                <span class="notification-world-name">${invite.instanceName}</span>
                            </div>
                        </div>
                    </div>
                    <div class="notification-action">
                    </div>
                </div>
            `,
        });

        // Add click handler for sender name
        const senderElement = inviteNode.querySelector('.notification-sender');
        senderElement.addEventListener('click', () => ShowDetailsWrapper(DetailsType.User, invite.user.id));

        // Add the split button to the action area
        const actionArea = inviteNode.querySelector('.notification-action');
        actionArea.appendChild(joinSplitButton);

        // Prepend the images
        const notificationContent = inviteNode.querySelector('.notification-content');
        notificationContent.insertBefore(userImageNode, notificationContent.firstChild);
        
        const worldInfo = inviteNode.querySelector('.notification-world-info');
        worldInfo.insertBefore(worldImageNode, worldInfo.firstChild);

        homeRequests.prepend(inviteNode);
    }
});

// Janky invite request listener
window.API.onInviteRequests((_event, requestInvites) => {
    log('Requests to Invite Received!');
    log(requestInvites);

    const homeRequests = document.querySelector('.home-requests-wrapper');

    // Remove previous invite requests
    document.querySelectorAll('.notification-invite-request').forEach(el => el.remove());

    // Create the invite request notification elements
    for (const requestInvite of requestInvites) {
        const userImageNode = createElement('img', {
            className: 'notification-avatar',
            src: 'img/ui/placeholder.png',
            onClick: () => ShowDetailsWrapper(DetailsType.User, requestInvite.sender.id),
        });
        userImageNode.dataset.hash = requestInvite.sender.imageHash;

        const requestInviteNode = createElement('div', {
            className: 'notification-item notification-invite-request',
            innerHTML: `
                <div class="notification-content">
                    <div class="notification-main">
                        <div class="notification-text">
                            <span class="notification-sender" data-user-id="${requestInvite.sender.id}">${requestInvite.sender.name}</span>
                            <span class="notification-message">wants to join you</span>
                        </div>
                    </div>
                    <div class="notification-action">
                        <span class="notification-action-text">
                            <span class="material-symbols-outlined">videogame_asset</span>
                            Accept In Game
                        </span>
                    </div>
                </div>
            `,
        });

        // Add click handler for sender name
        const senderElement = requestInviteNode.querySelector('.notification-sender');
        senderElement.addEventListener('click', () => ShowDetailsWrapper(DetailsType.User, requestInvite.sender.id));

        // Prepend the user image
        const notificationContent = requestInviteNode.querySelector('.notification-content');
        notificationContent.insertBefore(userImageNode, notificationContent.firstChild);

        homeRequests.prepend(requestInviteNode);
    }
});

// Janky friend request listener
window.API.onFriendRequests((_event, friendRequests) => {
    log('On Friend Requests received!');
    log(friendRequests);

    const homeRequests = document.querySelector('.home-requests-wrapper');

    // Remove previous friend requests
    document.querySelectorAll('.notification-friend-request').forEach(el => el.remove());

    // Create the friend request notification elements
    for (const friendRequest of friendRequests) {
        const userImageNode = createElement('img', {
            className: 'notification-avatar',
            src: 'img/ui/placeholder.png',
            onClick: () => ShowDetailsWrapper(DetailsType.User, friendRequest.id),
        });
        userImageNode.dataset.hash = friendRequest.imageHash;

        // Create buttons
        const acceptButton = createElement('button', {
            className: 'notification-action-button notification-accept',
            innerHTML: '<span class="material-symbols-outlined">check</span>',
            tooltip: 'Accept Friend Request',
            onClick: async () => {
                try {
                    await window.API.acceptFriendRequest(friendRequest.id);
                    window.API.refreshFriendRequests();
                } catch (error) {
                    pushToast('Failed to accept friend request', 'error');
                }
            },
        });

        const declineButton = createElement('button', {
            className: 'notification-action-button notification-decline',
            innerHTML: '<span class="material-symbols-outlined">close</span>',
            tooltip: 'Decline Friend Request',
            onClick: async () => {
                try {
                    await window.API.declineFriendRequest(friendRequest.id);
                    window.API.refreshFriendRequests();
                } catch (error) {
                    pushToast('Failed to decline friend request', 'error');
                }
            },
        });

        const friendRequestNode = createElement('div', {
            className: 'notification-item notification-friend-request',
            innerHTML: `
                <div class="notification-content">
                    <div class="notification-main">
                        <div class="notification-text">
                            <span class="notification-sender" data-user-id="${friendRequest.id}">${friendRequest.name}</span>
                            <span class="notification-message">sent you a friend request</span>
                        </div>
                    </div>
                    <div class="notification-action">
                        <div class="notification-action-buttons">
                        </div>
                    </div>
                </div>
            `,
        });

        // Add click handler for sender name
        const senderElement = friendRequestNode.querySelector('.notification-sender');
        senderElement.addEventListener('click', () => ShowDetailsWrapper(DetailsType.User, friendRequest.id));

        // Add the buttons to the action area
        const actionButtons = friendRequestNode.querySelector('.notification-action-buttons');
        actionButtons.append(acceptButton, declineButton);

        // Prepend the user image
        const notificationContent = friendRequestNode.querySelector('.notification-content');
        notificationContent.insertBefore(userImageNode, notificationContent.firstChild);

        // Append friend request node at the beginning
        homeRequests.prepend(friendRequestNode);
        applyTooltips();
    }
});

// Janky active user worlds
window.API.onGetActiveUserWorlds((_event, ourWorlds) => {
    handleWorldsRefresh(ourWorlds);
});

// Add event listener for worlds category refresh
window.API.onWorldsByCategoryRefresh((_event, categoryId, worlds) => {
    handleWorldsByCategoryRefresh(categoryId, worlds);
});

// Janky active user avatars
window.API.onGetActiveUserAvatars((_event, ourAvatars) => {
    handleAvatarsRefresh(ourAvatars);
});

// Janky active user props
window.API.onGetActiveUserProps((_event, ourProps) => {
    handlePropsRefresh(ourProps);
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
                    onClick: () => ShowDetailsWrapper(DetailsType.User, recentActivity.current.id),
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
    try {
        const { hasUpdates, msg, updateInfo } = await window.API.checkForUpdates();
        if (hasUpdates && updateInfo) {
            promptUpdate(updateInfo);
        } else {
            pushToast(msg, 'confirm');
        }
    } catch (error) {
        pushToast(error.message || 'Failed to check for updates', 'error');
    }
    _event.target.disabled = false;
});

document.querySelector('#clear-cached-images-button').addEventListener('click', async _event => {
    const button = _event.target;
    button.disabled = true;
    
    try {
        const result = await window.API.clearCachedImages();
        if (result.success) {
            pushToast(result.message, 'confirm');
            // Clear the in-memory cache as well
            Object.keys(friendImageCache).forEach(key => delete friendImageCache[key]);
        } else {
            pushToast(result.message, 'error');
        }
    } catch (error) {
        pushToast('Failed to clear cached images', 'error');
        log('Error clearing cached images:', error);
    }
    
    button.disabled = false;
});

document.querySelector('#open-logs-folder-button').addEventListener('click', async _event => {
    const button = _event.target;
    button.disabled = true;
    
    try {
        await window.API.openLogsFolder();
        pushToast('Logs folder opened', 'confirm');
    } catch (error) {
        pushToast('Failed to open logs folder', 'error');
        log('Error opening logs folder:', error);
    }
    
    button.disabled = false;
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
    const refreshButton = _event.target;
    if (refreshButton.classList.contains('refreshing')) {
        // The backend notification will handle showing the cooldown message
        return;
    }
    
    refreshButton.classList.add('refreshing');
    refreshButton.classList.remove('refresh-complete');
    
    try {
        const requestInitialized = await window.API.refreshInstances(true);
        if (requestInitialized) {
            // Show refreshing toast notification
            pushToast('Refreshing...', 'info');
            
            // Show completion state briefly
            refreshButton.classList.remove('refreshing');
            refreshButton.classList.add('refresh-complete');
            
            // Remove completion state after a short delay
            setTimeout(() => {
                refreshButton.classList.remove('refresh-complete');
            }, 1500);
        } else {
            // If request wasn't initialized (due to cooldown), the backend notification will show the message
            refreshButton.classList.remove('refreshing');
        }
    } catch (error) {
        refreshButton.classList.remove('refreshing');
        log('Refresh failed:', error);
    }
});

window.addEventListener('focus', async () => {
    const refreshButton = document.querySelector('#instances-refresh');
    if (refreshButton.classList.contains('refreshing')) return; // Prevent multiple refreshes
    
    refreshButton.classList.add('refreshing');
    refreshButton.classList.remove('refresh-complete');
    
    try {
        const requestInitialized = await window.API.refreshInstances(false);
        if (requestInitialized) {
            // Show completion state briefly for auto-refresh
            refreshButton.classList.remove('refreshing');
            refreshButton.classList.add('refresh-complete');
            
            // Remove completion state after a short delay
            setTimeout(() => {
                refreshButton.classList.remove('refresh-complete');
            }, 1000);
        } else {
            refreshButton.classList.remove('refreshing');
        }
    } catch (error) {
        refreshButton.classList.remove('refreshing');
        log('Auto-refresh failed:', error);
    }
});

window.API.getVersion();

window.API.receiveVersion((appVersion) => {
    document.querySelector('.navbar-version').innerHTML = `v${appVersion}`;
});

window.API.onSocketDied((_event) => promptReconnect());

// Handle backend notifications (including cooldown messages)
window.API.onNotification((_event, message, type) => {
    // Map backend ToastTypes to frontend toast types
    let toastType = 'info'; // default
    switch (type) {
        case 'confirm':
            toastType = 'confirm';
            break;
        case 'error':
            toastType = 'error';
            break;
        case 'info':
        default:
            toastType = 'info';
            break;
    }
    pushToast(message, toastType);
});

applyTooltips();

// Settings page tab switching
document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and pages
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-page').forEach(p => p.classList.remove('active'));

        // Add active class to clicked tab and corresponding page
        tab.classList.add('active');
        document.getElementById(`settings-${tab.dataset.tab}`).classList.add('active');
    });
});

// Handle "Close to System Tray" setting
const closeToTrayCheckbox = document.getElementById('setting-close-to-tray');

// Handle "Thumbnail Shape" setting
const thumbnailShapeDropdown = document.getElementById('setting-thumbnail-shape');

// Handle "Online Friends Thumbnail Shape" setting
const onlineFriendsThumbnailShapeDropdown = document.getElementById('setting-online-friends-thumbnail-shape');

// Function to apply thumbnail shape to all existing thumbnail containers
function applyThumbnailShape(shape) {
    const thumbnailContainers = document.querySelectorAll('.details-thumbnail-container');
    thumbnailContainers.forEach(container => {
        // Remove all shape classes
        container.classList.remove('shape-hexagonal', 'shape-square', 'shape-rounded', 'shape-circle');
        // Add the new shape class
        container.classList.add(`shape-${shape}`);
    });
}

// Function to apply thumbnail shape to all existing online friend images
function applyOnlineFriendsThumbnailShape(shape) {
    const onlineFriendImages = document.querySelectorAll('.online-friend-node--image');
    onlineFriendImages.forEach(image => {
        // Remove all shape classes
        image.classList.remove('shape-hexagonal', 'shape-square', 'shape-rounded', 'shape-circle');
        // Add the new shape class
        image.classList.add(`shape-${shape}`);
    });
}

// Load initial settings from config
window.API.getConfig().then(config => {
    if (config && config.CloseToSystemTray !== undefined) {
        closeToTrayCheckbox.checked = config.CloseToSystemTray;
    }
    if (config && config.ThumbnailShape !== undefined) {
        thumbnailShapeDropdown.value = config.ThumbnailShape;
        applyThumbnailShape(config.ThumbnailShape);
    }
    if (config && config.OnlineFriendsThumbnailShape !== undefined) {
        onlineFriendsThumbnailShapeDropdown.value = config.OnlineFriendsThumbnailShape;
        applyOnlineFriendsThumbnailShape(config.OnlineFriendsThumbnailShape);
    } else {
        // Default to 'rounded' if not set
        onlineFriendsThumbnailShapeDropdown.value = 'rounded';
        applyOnlineFriendsThumbnailShape('rounded');
    }
});

// Update config when "Close to System Tray" setting is changed
closeToTrayCheckbox.addEventListener('change', () => {
    window.API.updateConfig({ CloseToSystemTray: closeToTrayCheckbox.checked })
        .then(() => {
            pushToast('Setting saved', 'confirm');
        })
        .catch(err => {
            pushToast(`Error saving setting: ${err}`, 'error');
            // Revert checkbox state if save failed
            window.API.getConfig().then(config => {
                closeToTrayCheckbox.checked = config.CloseToSystemTray;
            });
        });
});

// Update config when "Thumbnail Shape" setting is changed
thumbnailShapeDropdown.addEventListener('change', () => {
    const selectedShape = thumbnailShapeDropdown.value;
    window.API.updateConfig({ ThumbnailShape: selectedShape })
        .then(() => {
            applyThumbnailShape(selectedShape);
            pushToast('Details view thumbnail shape updated', 'confirm');
        })
        .catch(err => {
            pushToast(`Error saving setting: ${err}`, 'error');
            // Revert dropdown state if save failed
            window.API.getConfig().then(config => {
                thumbnailShapeDropdown.value = config.ThumbnailShape;
            });
        });
});

// Update config when "Online Friends Thumbnail Shape" setting is changed
onlineFriendsThumbnailShapeDropdown.addEventListener('change', () => {
    const selectedShape = onlineFriendsThumbnailShapeDropdown.value;
    window.API.updateConfig({ OnlineFriendsThumbnailShape: selectedShape })
        .then(() => {
            applyOnlineFriendsThumbnailShape(selectedShape);
            pushToast('Online friends thumbnail shape updated', 'confirm');
        })
        .catch(err => {
            pushToast(`Error saving setting: ${err}`, 'error');
            // Revert dropdown state if save failed
            window.API.getConfig().then(config => {
                onlineFriendsThumbnailShapeDropdown.value = config.OnlineFriendsThumbnailShape || 'rounded';
            });
        });
});

// Set up refresh button event listeners (only once to prevent stacking)
document.querySelector('#worlds-refresh')?.addEventListener('click', () => window.API.refreshGetActiveUserWorlds());
document.querySelector('#avatars-refresh')?.addEventListener('click', () => window.API.refreshGetActiveUserAvatars());
document.querySelector('#props-refresh')?.addEventListener('click', () => window.API.refreshGetActiveUserProps());

// Props and World functions moved to user_content.js module

// Function to handle new content discovery
async function handleNewContentDiscovery() {
    const searchBar = document.getElementById('search-bar');
    const newButton = document.getElementById('discover-new');
    
    // Show loading state
    document.querySelector('.search-status').classList.add('hidden');
    document.querySelector('.search-no-results').classList.add('hidden');
    document.querySelector('.search-loading').classList.remove('hidden');
    hideAllSearchCategories();

    // Disable the button and search bar while fetching
    newButton.disabled = true;
    searchBar.disabled = true;

    try {
        // Import the data objects from user_content module
        const userContentModule = await import('./astrolib/user_content.js');
        
        // Get search output containers
        const searchOutputUsers = document.querySelector('.search-output--users');
        const searchOutputWorlds = document.querySelector('.search-output--worlds');
        const searchOutputAvatars = document.querySelector('.search-output--avatars');
        const searchOutputProps = document.querySelector('.search-output--props');

        const userResults = []; // No new users available
        const worldsResults = [];
        const avatarResults = [];
        const propsResults = [];

        // Check if we have any data, if not, try to refresh content first
        if (Object.keys(userContentModule.avatarsData).length === 0 && 
            Object.keys(userContentModule.worldsData).length === 0 && 
            Object.keys(userContentModule.propsData).length === 0) {
            
            log('No data found, refreshing content first...');
            // Trigger refresh and wait for events to populate data
            await Promise.all([
                window.API.refreshGetActiveUserAvatars(),
                window.API.refreshGetActiveUserWorlds(), 
                window.API.refreshGetActiveUserProps()
            ]);
            
            // Wait longer for the backend events to process and populate the data
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Filter avatars for 'avtr_new' category
        Object.values(userContentModule.avatarsData || {}).forEach(avatar => {
            if (avatar.categories && avatar.categories.includes('avtr_new')) {
                log(`Found new avatar: ${avatar.name} with categories: ${JSON.stringify(avatar.categories)}`);
                
                const creatorInfo = avatar.author ? 
                    `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${avatar.author.name}</p>` : '';

                const additionalInfo = `
                    ${creatorInfo}
                    <div class="search-result-detail">
                        <span class="material-symbols-outlined">person_outline</span>Avatar
                    </div>`;

                let searchResult = createElement('div', {
                    className: 'search-output--node',
                    innerHTML: `
                        <div class="thumbnail-container">
                            <img src="img/ui/placeholder.png" data-hash="${avatar.imageHash}" class="hidden"/>
                        </div>
                        <div class="search-result-content">
                            <p class="search-result-name">${avatar.name}</p>
                            <p class="search-result-type">avatar</p>
                            ${additionalInfo}
                        </div>
                    `,
                    onClick: () => ShowDetailsWrapper(DetailsType.Avatar, avatar.id),
                });

                // Set placeholder background image
                const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
                thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
                thumbnailContainer.style.backgroundSize = 'cover';
                thumbnailContainer.dataset.hash = avatar.imageHash;

                avatarResults.push(searchResult);
            }
        });

        // Filter worlds for 'wrldnew' category
        Object.values(userContentModule.worldsData || {}).forEach(world => {
            if (world.categories && world.categories.includes('wrldnew')) {
                log(`Found new world: ${world.name} with categories: ${JSON.stringify(world.categories)}`);
                
                // Handle tags if available
                let tagsList = '';
                if (world.tags && world.tags.length > 0) {
                    const tagElements = world.tags.slice(0, 3).map(tag =>
                        `<span class="world-tag">${tag}</span>`
                    ).join('');
                    tagsList = `<div class="world-tags">${tagElements}</div>`;
                }

                const creatorInfo = world.author ? 
                    `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${world.author.name}</p>` : '';

                const additionalInfo = `
                    ${creatorInfo}
                    ${tagsList}
                    <div class="search-result-detail">
                        <span class="material-symbols-outlined">travel_explore</span>Explore
                    </div>`;

                let searchResult = createElement('div', {
                    className: 'search-output--node',
                    innerHTML: `
                        <div class="thumbnail-container">
                            <img src="img/ui/placeholder.png" data-hash="${world.imageHash}" class="hidden"/>
                        </div>
                        <div class="search-result-content">
                            <p class="search-result-name">${world.name}</p>
                            <p class="search-result-type">world</p>
                            ${additionalInfo}
                        </div>
                    `,
                    onClick: () => ShowDetailsWrapper(DetailsType.World, world.id),
                });

                // Set placeholder background image
                const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
                thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
                thumbnailContainer.style.backgroundSize = 'cover';
                thumbnailContainer.dataset.hash = world.imageHash;

                worldsResults.push(searchResult);
            }
        });

        // Filter props for 'prop_new' category
        Object.values(userContentModule.propsData || {}).forEach(prop => {
            if (prop.categories && prop.categories.includes('prop_new')) {
                log(`Found new prop: ${prop.name} with categories: ${JSON.stringify(prop.categories)}`);
                
                const creatorInfo = prop.author ? 
                    `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${prop.author.name}</p>` : '';

                const additionalInfo = `
                    ${creatorInfo}
                    <div class="search-result-detail">
                        <span class="material-symbols-outlined">category</span>Prop
                    </div>`;

                let searchResult = createElement('div', {
                    className: 'search-output--node',
                    innerHTML: `
                        <div class="thumbnail-container">
                            <img src="img/ui/placeholder.png" data-hash="${prop.imageHash}" class="hidden"/>
                        </div>
                        <div class="search-result-content">
                            <p class="search-result-name">${prop.name}</p>
                            <p class="search-result-type">prop</p>
                            ${additionalInfo}
                        </div>
                    `,
                    onClick: () => ShowDetailsWrapper(DetailsType.Prop, prop.id),
                });

                // Set placeholder background image
                const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
                thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
                thumbnailContainer.style.backgroundSize = 'cover';
                thumbnailContainer.dataset.hash = prop.imageHash;

                propsResults.push(searchResult);
            }
        });

        log(`New content discovery results: Avatars: ${avatarResults.length}, Worlds: ${worldsResults.length}, Props: ${propsResults.length}`);

        // Replace previous search results with the new content results
        searchOutputUsers.replaceChildren(...userResults);
        searchOutputWorlds.replaceChildren(...worldsResults);
        searchOutputAvatars.replaceChildren(...avatarResults);
        searchOutputProps.replaceChildren(...propsResults);

        // Show/hide categories based on results and uncollapse them
        toggleCategoryVisibility('.users-category', userResults.length > 0);
        toggleCategoryVisibility('.worlds-category', worldsResults.length > 0);
        toggleCategoryVisibility('.avatars-category', avatarResults.length > 0);
        toggleCategoryVisibility('.props-category', propsResults.length > 0);

        // Uncollapse all visible categories after fetching new content
        document.querySelectorAll('.search-output-category:not(.empty)').forEach(category => {
            category.classList.remove('collapsed');
        });

        // Add category counts to headers
        updateCategoryCount('.users-category', userResults.length);
        updateCategoryCount('.worlds-category', worldsResults.length);
        updateCategoryCount('.avatars-category', avatarResults.length);
        updateCategoryCount('.props-category', propsResults.length);

        // Clear the search bar to indicate this is discover content, not search results
        searchBar.value = '';

        // Show "no results" message if no results found
        const totalResults = userResults.length + worldsResults.length + avatarResults.length + propsResults.length;
        if (totalResults === 0) {
            document.querySelector('.search-no-results').classList.remove('hidden');
        } else {
            document.querySelector('.search-no-results').classList.add('hidden');
        }

        pushToast(`New content loaded! Found ${totalResults} items.`, 'confirm');
    } catch (error) {
        pushToast('Error fetching new content', 'error');
        log('Error fetching new content:', error);
    } finally {
        // Hide loading state and re-enable controls regardless of success/failure
        document.querySelector('.search-loading').classList.add('hidden');
        newButton.disabled = false;
        searchBar.disabled = false;
        applyTooltips();
    }
}

// Function to handle recently updated content discovery
async function handleRecentlyUpdatedDiscovery() {
    const searchBar = document.getElementById('search-bar');
    const updatedButton = document.getElementById('discover-updated');
    
    // Show loading state
    document.querySelector('.search-status').classList.add('hidden');
    document.querySelector('.search-no-results').classList.add('hidden');
    document.querySelector('.search-loading').classList.remove('hidden');
    hideAllSearchCategories();

    // Disable the button and search bar while fetching
    updatedButton.disabled = true;
    searchBar.disabled = true;

    try {
        // Import the data objects from user_content module
        const userContentModule = await import('./astrolib/user_content.js');
        
        // Get search output containers
        const searchOutputUsers = document.querySelector('.search-output--users');
        const searchOutputWorlds = document.querySelector('.search-output--worlds');
        const searchOutputAvatars = document.querySelector('.search-output--avatars');
        const searchOutputProps = document.querySelector('.search-output--props');

        const userResults = []; // No recently updated users available
        const worldsResults = [];
        const avatarResults = [];
        const propsResults = [];

        // Check if we have any data, if not, try to refresh content first
        if (Object.keys(userContentModule.avatarsData).length === 0 && 
            Object.keys(userContentModule.worldsData).length === 0 && 
            Object.keys(userContentModule.propsData).length === 0) {
            
            log('No data found, refreshing content first...');
            // Trigger refresh and wait for events to populate data
            await Promise.all([
                window.API.refreshGetActiveUserAvatars(),
                window.API.refreshGetActiveUserWorlds(), 
                window.API.refreshGetActiveUserProps()
            ]);
            
            // Wait longer for the backend events to process and populate the data
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Filter avatars for 'avtr_recently' category
        Object.values(userContentModule.avatarsData || {}).forEach(avatar => {
            if (avatar.categories && avatar.categories.includes('avtr_recently')) {
                log(`Found recently updated avatar: ${avatar.name} with categories: ${JSON.stringify(avatar.categories)}`);
                
                const creatorInfo = avatar.author ? 
                    `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${avatar.author.name}</p>` : '';

                const additionalInfo = `
                    ${creatorInfo}
                    <div class="search-result-detail">
                        <span class="material-symbols-outlined">person_outline</span>Avatar
                    </div>`;

                let searchResult = createElement('div', {
                    className: 'search-output--node',
                    innerHTML: `
                        <div class="thumbnail-container">
                            <img src="img/ui/placeholder.png" data-hash="${avatar.imageHash}" class="hidden"/>
                        </div>
                        <div class="search-result-content">
                            <p class="search-result-name">${avatar.name}</p>
                            <p class="search-result-type">avatar</p>
                            ${additionalInfo}
                        </div>
                    `,
                    onClick: () => ShowDetailsWrapper(DetailsType.Avatar, avatar.id),
                });

                // Set placeholder background image
                const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
                thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
                thumbnailContainer.style.backgroundSize = 'cover';
                thumbnailContainer.dataset.hash = avatar.imageHash;

                avatarResults.push(searchResult);
            }
        });

        // Filter worlds for 'wrldrecentlyupdated' category
        Object.values(userContentModule.worldsData || {}).forEach(world => {
            if (world.categories && world.categories.includes('wrldrecentlyupdated')) {
                log(`Found recently updated world: ${world.name} with categories: ${JSON.stringify(world.categories)}`);
                
                // Handle tags if available
                let tagsList = '';
                if (world.tags && world.tags.length > 0) {
                    const tagElements = world.tags.slice(0, 3).map(tag =>
                        `<span class="world-tag">${tag}</span>`
                    ).join('');
                    tagsList = `<div class="world-tags">${tagElements}</div>`;
                }

                const creatorInfo = world.author ? 
                    `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${world.author.name}</p>` : '';

                const additionalInfo = `
                    ${creatorInfo}
                    ${tagsList}
                    <div class="search-result-detail">
                        <span class="material-symbols-outlined">travel_explore</span>Explore
                    </div>`;

                let searchResult = createElement('div', {
                    className: 'search-output--node',
                    innerHTML: `
                        <div class="thumbnail-container">
                            <img src="img/ui/placeholder.png" data-hash="${world.imageHash}" class="hidden"/>
                        </div>
                        <div class="search-result-content">
                            <p class="search-result-name">${world.name}</p>
                            <p class="search-result-type">world</p>
                            ${additionalInfo}
                        </div>
                    `,
                    onClick: () => ShowDetailsWrapper(DetailsType.World, world.id),
                });

                // Set placeholder background image
                const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
                thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
                thumbnailContainer.style.backgroundSize = 'cover';
                thumbnailContainer.dataset.hash = world.imageHash;

                worldsResults.push(searchResult);
            }
        });

        // Filter props for 'prop_recently' category
        Object.values(userContentModule.propsData || {}).forEach(prop => {
            if (prop.categories && prop.categories.includes('prop_recently')) {
                log(`Found recently updated prop: ${prop.name} with categories: ${JSON.stringify(prop.categories)}`);
                
                const creatorInfo = prop.author ? 
                    `<p class="creator-info"><span class="material-symbols-outlined">person</span>By: ${prop.author.name}</p>` : '';

                const additionalInfo = `
                    ${creatorInfo}
                    <div class="search-result-detail">
                        <span class="material-symbols-outlined">category</span>Prop
                    </div>`;

                let searchResult = createElement('div', {
                    className: 'search-output--node',
                    innerHTML: `
                        <div class="thumbnail-container">
                            <img src="img/ui/placeholder.png" data-hash="${prop.imageHash}" class="hidden"/>
                        </div>
                        <div class="search-result-content">
                            <p class="search-result-name">${prop.name}</p>
                            <p class="search-result-type">prop</p>
                            ${additionalInfo}
                        </div>
                    `,
                    onClick: () => ShowDetailsWrapper(DetailsType.Prop, prop.id),
                });

                // Set placeholder background image
                const thumbnailContainer = searchResult.querySelector('.thumbnail-container');
                thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
                thumbnailContainer.style.backgroundSize = 'cover';
                thumbnailContainer.dataset.hash = prop.imageHash;

                propsResults.push(searchResult);
            }
        });

        log(`Recently updated discovery results: Avatars: ${avatarResults.length}, Worlds: ${worldsResults.length}, Props: ${propsResults.length}`);

        // Replace previous search results with the recently updated content results
        searchOutputUsers.replaceChildren(...userResults);
        searchOutputWorlds.replaceChildren(...worldsResults);
        searchOutputAvatars.replaceChildren(...avatarResults);
        searchOutputProps.replaceChildren(...propsResults);

        // Show/hide categories based on results and uncollapse them
        toggleCategoryVisibility('.users-category', userResults.length > 0);
        toggleCategoryVisibility('.worlds-category', worldsResults.length > 0);
        toggleCategoryVisibility('.avatars-category', avatarResults.length > 0);
        toggleCategoryVisibility('.props-category', propsResults.length > 0);

        // Uncollapse all visible categories after fetching recently updated content
        document.querySelectorAll('.search-output-category:not(.empty)').forEach(category => {
            category.classList.remove('collapsed');
        });

        // Add category counts to headers
        updateCategoryCount('.users-category', userResults.length);
        updateCategoryCount('.worlds-category', worldsResults.length);
        updateCategoryCount('.avatars-category', avatarResults.length);
        updateCategoryCount('.props-category', propsResults.length);

        // Clear the search bar to indicate this is discover content, not search results
        searchBar.value = '';

        // Show "no results" message if no results found
        const totalResults = userResults.length + worldsResults.length + avatarResults.length + propsResults.length;
        if (totalResults === 0) {
            document.querySelector('.search-no-results').classList.remove('hidden');
        } else {
            document.querySelector('.search-no-results').classList.add('hidden');
        }

        pushToast(`Recently updated content loaded! Found ${totalResults} items.`, 'confirm');
    } catch (error) {
        pushToast('Error fetching recently updated content', 'error');
        log('Error fetching recently updated content:', error);
    } finally {
        // Hide loading state and re-enable controls regardless of success/failure
        document.querySelector('.search-loading').classList.add('hidden');
        updatedButton.disabled = false;
        searchBar.disabled = false;
        applyTooltips();
    }
}

// Hide all search categories




