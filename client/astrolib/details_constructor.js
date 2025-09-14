// =======
// DETAILS CONSTRUCTOR MODULE
// =======

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';
import { 
    generateAvatarDetailsLink, 
    generateUserDetailsLink,
    generateWorldDetailsLink,
    generatePropDetailsLink,
    generateInstanceDetailsLink,
    generateInstanceJoinLink,
    openDeepLink 
} from './deeplinks.js';
import { showFavouritesModal } from './favourites_modal.js';
import { refreshContentAfterFavoritesUpdate } from './user_content.js';

// Logging function to prevent memory leaking when bundled
let isPackaged = false;
window.API.isPackaged().then(packaged => {
    isPackaged = packaged;
});

const log = (msg) => {
    if (!isPackaged) console.log(msg);
};

// ===========
// CONSTANTS
// ===========

const DetailsType = Object.freeze({
    User: Symbol('user'),
    Avatar: Symbol('avatar'),
    Prop: Symbol('prop'),
    World: Symbol('world'),
    Instance: Symbol('instance'),
});

// ===========
// HELPER FUNCTIONS
// ===========

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
    if (!text) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Helper function to determine current entity type from the details window
function getCurrentEntityType(entityId) {
    // Check the details window classes to determine entity type
    const detailsWindow = document.querySelector('.details-window');
    if (!detailsWindow) return 'user'; // Default fallback
    
    // Check for entity-specific classes
    if (detailsWindow.classList.contains('avatar-details-window')) {
        return 'avatar';
    } else if (detailsWindow.classList.contains('prop-details-window')) {
        return 'prop';
    } else if (detailsWindow.classList.contains('world-details-window')) {
        return 'world';
    } else if (detailsWindow.classList.contains('instance-details-window')) {
        return 'instance';
    }
    
    return 'user'; // Default fallback
}

// Helper function to get entity-specific CSS class prefix
function getEntityClassPrefix(entityType) {
    switch (entityType) {
        case DetailsType.User: return 'user-details';
        case DetailsType.Avatar: return 'avatar-details';
        case DetailsType.Prop: return 'prop-details';
        case DetailsType.World: return 'world-details';
        case DetailsType.Instance: return 'instance-details';
        default: return 'user-details'; // Default fallback
    }
}

// Helper function to update details window classes based on entity type
function updateDetailsWindowClasses(entityType) {
    const classPrefix = getEntityClassPrefix(entityType);
    
    // Remove all existing entity-specific classes from base elements, but preserve base classes
    const baseElements = [
        { selector: '.details-window', baseClass: 'details-window' },
        { selector: '.details-header', baseClass: 'details-header' },
        { selector: '.details-content', baseClass: 'details-content' },
        { selector: '.details-tabs', baseClass: 'details-tabs' },
        { selector: '.details-tab-content', baseClass: 'details-tab-content' }
    ];
    
    // Update base elements - preserve base class, add entity-specific class
    baseElements.forEach(({ selector, baseClass }) => {
        const element = document.querySelector(selector);
        if (element) {
            // Remove all entity-specific variants of this class
            const entityPrefixes = ['user-details', 'avatar-details', 'prop-details', 'world-details', 'instance-details'];
            entityPrefixes.forEach(entityPrefix => {
                const specificClass = baseClass.replace('details', entityPrefix);
                element.classList.remove(specificClass);
            });
            
            // Ensure base class is present
            element.classList.add(baseClass);
            
            // Add the new entity-specific class as an additional modifier
            const specificClass = baseClass.replace('details', classPrefix);
            element.classList.add(specificClass);
        }
    });
    
    // Update avatar elements  
    document.querySelectorAll('[class*="details-avatar"]').forEach(avatar => {
        const entityPrefixes = ['user-details', 'avatar-details', 'prop-details', 'world-details', 'instance-details'];
        entityPrefixes.forEach(entityPrefix => {
            avatar.classList.remove(`${entityPrefix}-avatar`);
        });
        // Add base class if not present and add entity-specific class
        avatar.classList.add('details-avatar');
        avatar.classList.add(`${classPrefix}-avatar`);
    });
}

// Helper function to remove all possible button containers to prevent duplication
function removeAllButtonContainers(detailsHeader) {
    // Remove all possible button containers
    const containers = detailsHeader.querySelectorAll('[class*="button-container"]');
    containers.forEach(container => container.remove());
}

// ===========
// TAB MANAGEMENT FUNCTIONS
// ===========

// Helper function to clear all tabs and tab panes
function clearAllTabs() {
    const tabsLeft = document.querySelector('.details-tabs-left');
    const tabsRight = document.querySelector('.details-tabs-right');
    const tabContent = document.querySelector('.details-tab-content');
    
    tabsLeft.innerHTML = '';
    tabsRight.innerHTML = '';
    tabContent.innerHTML = '';
}

// Helper function to create a tab button
function createTabButton(tabId, icon, label, entityClassPrefix, isActive = false) {
    const tab = document.createElement('button');
    tab.className = `details-tab ${entityClassPrefix}-tab${isActive ? ' active' : ''}`;
    tab.innerHTML = `<span class="material-symbols-outlined">${icon}</span>${label}`;
    tab.dataset.tab = tabId;
    return tab;
}

// Helper function to create a tab pane
function createTabPane(tabId, entityClassPrefix, content = '', isActive = false) {
    const pane = document.createElement('div');
    pane.className = `details-tab-pane ${entityClassPrefix}-tab-pane${isActive ? ' active' : ''}`;
    pane.innerHTML = content;
    pane.id = `${tabId}-tab`;
    return pane;
}

// ===========
// SEGMENT CREATION FUNCTIONS
// ===========

// Create a universal segment element
function createDetailsSegment(options = {}) {
    const {
        icon,
        iconType = 'material', // 'material' or 'image'
        iconHash,
        text,
        clickable = false,
        onClick,
        tooltip
    } = options;
    
    const segment = document.createElement('div');
    segment.className = `details-segment${clickable ? ' clickable' : ''}`;
    
    // Add tooltip if provided
    if (tooltip) {
        segment.dataset.tooltip = tooltip;
    }
    
    // Add icon if provided (either material icon or image)
    if (icon || iconType === 'image') {
        if (iconType === 'image') {
            const iconImg = document.createElement('img');
            iconImg.src = 'img/ui/placeholder.png';
            iconImg.dataset.hash = iconHash || '';
            segment.appendChild(iconImg);
        } else {
            const iconElement = document.createElement('span');
            iconElement.className = 'material-symbols-outlined';
            iconElement.textContent = icon;
            segment.appendChild(iconElement);
        }
    }
    
    // Add text content
    if (text) {
        const textElement = document.createElement('span');
        textElement.innerHTML = text;
        segment.appendChild(textElement);
    }
    
    // Add click handler if needed
    if (clickable && onClick) {
        segment.addEventListener('click', onClick);
    }
    
    return segment;
}

// Create universal details header structure
function createDetailsHeaderStructure(entityInfo, entityType, entityId) {
    const detailsHeader = document.querySelector('.details-header');
    
    // Clear existing content
    detailsHeader.innerHTML = '';
    
    // Create main container
    const headerContent = document.createElement('div');
    headerContent.className = 'details-header-content';
    
    // Create main info section
    const mainInfo = document.createElement('div');
    mainInfo.className = 'details-main-info';
    
    // Create thumbnail container
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'details-thumbnail-container';
    
    // Apply current thumbnail shape from config
    window.API.getConfig().then(config => {
        if (config && config.ThumbnailShape) {
            thumbnailContainer.classList.add(`shape-${config.ThumbnailShape}`);
        } else {
            thumbnailContainer.classList.add('shape-hexagonal'); // Default fallback
        }
    }).catch(() => {
        thumbnailContainer.classList.add('shape-hexagonal'); // Default fallback on error
    });
    
    // Create thumbnail image
    const thumbnail = document.createElement('img');
    thumbnail.className = 'details-thumbnail';
    thumbnail.src = 'img/ui/placeholder.png';
    thumbnail.dataset.hash = entityInfo.imageHash || '';
    
    // Add double-click event listener to copy GUID to clipboard
    thumbnail.addEventListener('dblclick', async () => {
        try {
            await navigator.clipboard.writeText(entityId);
            pushToast(`Copied GUID to clipboard: ${entityId}`, 'confirm');
        } catch (error) {
            log('Failed to copy GUID to clipboard:');
            pushToast('Failed to copy GUID to clipboard', 'error');
        }
    });
    
    thumbnailContainer.appendChild(thumbnail);
    
    // Create entity name
    const entityName = document.createElement('h1');
    entityName.className = 'details-entity-name';
    entityName.textContent = decodeHtmlEntities(entityInfo.name) || 'Unknown';
    
    // Add thumbnail and name to main info
    mainInfo.appendChild(thumbnailContainer);
    mainInfo.appendChild(entityName);
    
    // Create segments container
    const segmentsContainer = document.createElement('div');
    segmentsContainer.className = 'details-segments-container';
    
    // Create separator between main info and segments
    const mainSeparator = document.createElement('div');
    mainSeparator.className = 'details-separator-line details-main-separator';
    
    // Add main info, separator, and segments to header content
    headerContent.appendChild(mainInfo);
    headerContent.appendChild(mainSeparator);
    headerContent.appendChild(segmentsContainer);
    
    // Add header content to details header
    detailsHeader.appendChild(headerContent);
    
    // Return references for easy access
    return {
        headerContent,
        mainInfo,
        thumbnail,
        entityName,
        segmentsContainer,
        detailsHeader
    };
}

// ===========
// TAB CONTENT MANAGEMENT
// ===========

// Helper function to update instance count for a world
function updateInstanceCount(worldId, activeInstances) {
    const instancesTab = document.querySelector(`[data-tab="instances"]`);
    if (instancesTab) {
        // Calculate the actual number of instances visible to the user
        const visibleInstanceCount = activeInstances.filter(instance => instance.world?.id === worldId).length;
        instancesTab.innerHTML = `<span class="material-symbols-outlined">public</span>Instances (${visibleInstanceCount})`;
    }
}

// Helper function to add tabs for "My Profile" view (current user viewing their own profile)
function addMyProfileTabs(entityType, entityInfo, entityId, currentActiveUser, loadTabContentCallback) {
    const classPrefix = getEntityClassPrefix(entityType);
    const tabsLeft = document.querySelector('.details-tabs-left');
    const tabsRight = document.querySelector('.details-tabs-right');
    const tabContent = document.querySelector('.details-tab-content');
    
    let tabs = [];
    let tabPanes = [];
    
    // Only Categories tab for My Profile
    const categoriesTab = createTabButton('categories', 'folder', 'Categories', classPrefix, true);
    tabs.push(categoriesTab);
    tabsLeft.append(categoriesTab);
    
    // Create corresponding tab pane
    const categoriesPane = createTabPane('categories', classPrefix, '<div class="categories-container"><div class="no-items-message">Categories management coming soon!</div></div>', true);
    tabPanes.push(categoriesPane);
    
    // Add tab pane to the content area
    tabContent.append(...tabPanes);
    
    // Set up click handler for the tab
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and panes
            document.querySelectorAll(`.${classPrefix}-tab`).forEach(t => t.classList.remove('active'));
            document.querySelectorAll(`.${classPrefix}-tab-pane`).forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding pane
            tab.classList.add('active');
            const pane = document.getElementById(`${tab.dataset.tab}-tab`);
            if (pane) {
                pane.classList.add('active');
            }
            
            // Load content for the selected tab
            loadTabContentCallback(tab.dataset.tab, entityId);
        });
    });
    
    // Load initial tab content
    loadTabContentCallback('categories', entityId);
    
    // Apply tooltips to newly created elements
    applyTooltips();
}

// Helper function to add tabs for a specific entity type
function addEntityTabs(entityType, entityInfo, entityId, currentActiveUser, loadTabContentCallback) {
    const classPrefix = getEntityClassPrefix(entityType);
    const tabsLeft = document.querySelector('.details-tabs-left');
    const tabsRight = document.querySelector('.details-tabs-right');
    const tabContent = document.querySelector('.details-tab-content');
    
    let tabs = [];
    let tabPanes = [];
    let firstTabId = null;
    
    switch (entityType) {
        case DetailsType.User:
            // Left side tabs for User Details
            const avatarsTab = createTabButton('avatars', 'emoji_people', 'Avatars', classPrefix, true);
            const propsTab = createTabButton('props', 'view_in_ar', 'Props', classPrefix);
            const worldsTab = createTabButton('worlds', 'public', 'Worlds', classPrefix);
            
            tabs.push(avatarsTab, propsTab, worldsTab);
            tabsLeft.append(avatarsTab, propsTab, worldsTab);
            
            // Right side tabs for User Details
            if (entityInfo.isFriend) {
                const notesTab = createTabButton('notes', 'note', 'Notes', classPrefix);
                tabs.push(notesTab);
                tabsRight.append(notesTab);
            }
            
            // Stats tab - disabled placeholder for future functionality
            const statsTab = createTabButton('stats', 'bar_chart', 'Stats', classPrefix);
            statsTab.classList.add('disabled');
            tabs.push(statsTab);
            tabsRight.append(statsTab);
            
            // Create corresponding tab panes
            const avatarsPane = createTabPane('avatars', classPrefix, '<div class="' + classPrefix + '-grid"></div>', true);
            const propsPane = createTabPane('props', classPrefix, '<div class="' + classPrefix + '-grid"></div>');
            const worldsPane = createTabPane('worlds', classPrefix, '<div class="' + classPrefix + '-grid"></div>');
            
            tabPanes.push(avatarsPane, propsPane, worldsPane);
            
            if (entityInfo.isFriend) {
                const notesPane = createTabPane('notes', classPrefix, '<div class="notes-container"></div>');
                tabPanes.push(notesPane);
            }
            
            // Stats tab pane
            const statsPane = createTabPane('stats', classPrefix, '<div class="' + classPrefix + '-grid"><div class="no-items-message">Stats feature coming soon!</div></div>');
            tabPanes.push(statsPane);
            
            firstTabId = 'avatars';
            break;
            
        case DetailsType.Avatar: {
            // Left side tabs for Avatar Details - Description moved to left
            const avatarDescTab = createTabButton('description', 'description', 'Description', classPrefix, true);
            tabs.push(avatarDescTab);
            tabsLeft.append(avatarDescTab);
            
            // Show Advanced Avatar Settings tab if we have access (own it, it's public, or shared with us)
            const hasAvatarAccess = (currentActiveUser && entityInfo.user?.id === currentActiveUser.id) || 
                                   entityInfo.isPublished || 
                                   entityInfo.isSharedWithMe;
            
            if (hasAvatarAccess) {
                const avatarAdvSettingsTab = createTabButton('adv-settings', 'tune', 'Adv. Avatar Settings', classPrefix);
                tabs.push(avatarAdvSettingsTab);
                tabsLeft.append(avatarAdvSettingsTab);
            }
            
            // Only show Shares tab if the current user owns this avatar
            if (currentActiveUser && entityInfo.user?.id === currentActiveUser.id) {
                const avatarSharesTab = createTabButton('shares', 'share', 'Shares', classPrefix);
                tabs.push(avatarSharesTab);
                tabsRight.append(avatarSharesTab);
            }
            
            // Create corresponding tab panes
            const avatarDescPane = createTabPane('description', classPrefix, '<div class="description-container"></div>', true);
            tabPanes.push(avatarDescPane);
            
            // Create Advanced Avatar Settings pane if we have access
            if (hasAvatarAccess) {
                const avatarAdvSettingsPane = createTabPane('adv-settings', classPrefix, '<div class="adv-settings-container"></div>');
                tabPanes.push(avatarAdvSettingsPane);
            }
            
            if (currentActiveUser && entityInfo.user?.id === currentActiveUser.id) {
                const avatarSharesPane = createTabPane('shares', classPrefix, '<div class="shares-container"></div>');
                tabPanes.push(avatarSharesPane);
            }
            
            firstTabId = 'description';
            break;
        }
        case DetailsType.Prop: {
            // Left side tabs for Prop Details - Description moved to left
            const propDescTab = createTabButton('description', 'description', 'Description', classPrefix, true);
            tabs.push(propDescTab);
            tabsLeft.append(propDescTab);
            
            // Only show Shares tab if the current user owns this prop
            if (currentActiveUser && entityInfo.author?.id === currentActiveUser.id) {
                const propSharesTab = createTabButton('shares', 'share', 'Shares', classPrefix);
                tabs.push(propSharesTab);
                tabsRight.append(propSharesTab);
            }
            
            // Create corresponding tab panes
            const propDescPane = createTabPane('description', classPrefix, '<div class="description-container"></div>', true);
            tabPanes.push(propDescPane);
            
            if (currentActiveUser && entityInfo.author?.id === currentActiveUser.id) {
                const propSharesPane = createTabPane('shares', classPrefix, '<div class="shares-container"></div>');
                tabPanes.push(propSharesPane);
            }
            
            firstTabId = 'description';
            break;
        }
        case DetailsType.Instance:
            // Only Users tab for Instance Details
            const usersTab = createTabButton('users', 'group', 'Users', classPrefix, true);
            tabs.push(usersTab);
            tabsLeft.append(usersTab);
            
            // Create corresponding tab pane
            const usersPane = createTabPane('users', classPrefix, '<div class="' + classPrefix + '-grid"></div>', true);
            tabPanes.push(usersPane);
            
            firstTabId = 'users';
            break;
            
        case DetailsType.World:
            // Left side tabs for World Details
            const worldDescTab = createTabButton('description', 'description', 'Description', classPrefix, true);
            tabs.push(worldDescTab);
            tabsLeft.append(worldDescTab);
            
            // Instances tab - we'll calculate the count dynamically
            const worldInstancesTab = createTabButton('instances', 'public', 'Instances', classPrefix);
            tabs.push(worldInstancesTab);
            tabsLeft.append(worldInstancesTab);
            
            // Create corresponding tab panes
            const worldDescPane = createTabPane('description', classPrefix, '<div class="description-container"></div>', true);
            tabPanes.push(worldDescPane);
            
            const worldInstancesPane = createTabPane('instances', classPrefix, '<div class="' + classPrefix + '-grid"></div>');
            tabPanes.push(worldInstancesPane);
            
            firstTabId = 'description';
            break;
    }
    
    // Add all tab panes to the content area
    tabContent.append(...tabPanes);
    
    // Set up click handlers for all tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and panes
            document.querySelectorAll(`.${classPrefix}-tab`).forEach(t => t.classList.remove('active'));
            document.querySelectorAll(`.${classPrefix}-tab-pane`).forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding pane
            tab.classList.add('active');
            const pane = document.getElementById(`${tab.dataset.tab}-tab`);
            if (pane) {
                pane.classList.add('active');
            }
            
            // Load content for the selected tab
            loadTabContentCallback(tab.dataset.tab, entityId);
        });
    });
    
    // Load initial tab content
    if (firstTabId) {
        loadTabContentCallback(firstTabId, entityId);
    }
    
    // Apply tooltips to newly created elements
    applyTooltips();
}

// Create user-specific header structure using universal details-segment system
function createUserDetailsHeader(entityInfo, ShowDetailsCallback, entityId) {
    const detailsHeader = document.querySelector('.details-header');
    
    // Clear existing content
    detailsHeader.innerHTML = '';
    
    // Create main container
    const headerContent = document.createElement('div');
    headerContent.className = 'details-header-content user-details-header-layout';
    
    // Create main info section with user image and name
    const mainInfo = document.createElement('div');
    mainInfo.className = 'details-main-info';
    
    // Create thumbnail container using existing clip-path class
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'details-thumbnail-container';
    
    // Apply current thumbnail shape from config
    window.API.getConfig().then(config => {
        if (config && config.ThumbnailShape) {
            thumbnailContainer.classList.add(`shape-${config.ThumbnailShape}`);
        } else {
            thumbnailContainer.classList.add('shape-hexagonal'); // Default fallback
        }
    }).catch(() => {
        thumbnailContainer.classList.add('shape-hexagonal'); // Default fallback on error
    });
    
    // Create thumbnail image using existing details-thumbnail class
    const thumbnail = document.createElement('img');
    thumbnail.className = 'details-thumbnail';
    thumbnail.src = 'img/ui/placeholder.png';
    thumbnail.dataset.hash = entityInfo.imageHash;
    
    // Add double-click event listener to copy GUID to clipboard
    thumbnail.addEventListener('dblclick', async () => {
        try {
            await navigator.clipboard.writeText(entityId);
            pushToast(`Copied GUID to clipboard: ${entityId}`, 'confirm');
        } catch (error) {
            log('Failed to copy GUID to clipboard:');
            pushToast('Failed to copy GUID to clipboard', 'error');
        }
    });
    
    thumbnailContainer.appendChild(thumbnail);
    
    // Create entity name
    const entityName = document.createElement('h1');
    entityName.className = 'details-entity-name';
    entityName.textContent = decodeHtmlEntities(entityInfo.name) || 'Unknown User';
    
    // Add thumbnail and name to main info
    mainInfo.appendChild(thumbnailContainer);
    mainInfo.appendChild(entityName);
    
    // Create segments container
    const segmentsContainer = document.createElement('div');
    segmentsContainer.className = 'details-segments-container user-details-segments';
    
    // Create separator between main info and segments
    const mainSeparator = document.createElement('div');
    mainSeparator.className = 'details-separator-line details-main-separator';
    
    // Create rank segment using universal details-segment (only if rank is not 'User')
    let rankSegment = null;
    if (entityInfo.rank && entityInfo.rank !== 'User') {
        rankSegment = createDetailsSegment({
            icon: 'military_tech',
            text: entityInfo.rank
        });
        rankSegment.classList.add('user-details-rank-segment');
    }
    
    // Create badge segment (only if user has a featured badge and it's not the default)
    let badgeSegment = null;
    if (entityInfo.featuredBadge && entityInfo.featuredBadge.name && entityInfo.featuredBadge.name !== 'No badge featured') {
        badgeSegment = createDetailsSegment({
            iconType: 'image',
            iconHash: entityInfo.featuredBadge.imageHash,
            text: entityInfo.featuredBadge.name
        });
        badgeSegment.classList.add('user-details-badge-segment');
    }
    
    // Create group segment (only if user has a featured group and it's not the default)
    let groupSegment = null;
    if (entityInfo.featuredGroup && entityInfo.featuredGroup.name && entityInfo.featuredGroup.name !== 'No group featured') {
        groupSegment = createDetailsSegment({
            iconType: 'image',
            iconHash: entityInfo.featuredGroup.imageHash,
            text: entityInfo.featuredGroup.name
        });
        groupSegment.classList.add('user-details-group-segment');
    }
    
    // Create separator div (only if we have at least one segment to separate)
    let separator = null;
    if (rankSegment || badgeSegment || groupSegment) {
        separator = document.createElement('div');
        separator.className = 'details-separator-line';
    }
    
    // Create avatar segment using universal details-segment (only if avatar name exists and is not 'No Avatar')
    let avatarSegment = null;
    if (entityInfo.avatar?.name && entityInfo.avatar.name !== 'No Avatar') {
        avatarSegment = createDetailsSegment({
            iconType: 'image',
            iconHash: entityInfo.avatar.imageHash,
            text: entityInfo.avatar.name,
            clickable: entityInfo.avatar?.id ? true : false,
            onClick: entityInfo.avatar?.id ? () => ShowDetailsCallback(DetailsType.Avatar, entityInfo.avatar.id) : null,
            tooltip: entityInfo.avatar?.id ? 'Current Avatar' : null
        });
        avatarSegment.classList.add('user-details-avatar-segment');
    }
    
    // Create instance segment (only if user is online and connected)
    let instanceSegment = null;
    if (entityInfo.onlineState && entityInfo.isConnected && entityInfo.instance) {
        // Extract instance ID from instance name (format: "World Name (#123456)")
        let worldName = entityInfo.instance.world?.name || 'Unknown World';
        let instanceId = '';
        
        if (entityInfo.instance.name) {
            const match = entityInfo.instance.name.match(/\(#(\d+)\)$/);
            if (match) {
                instanceId = `#${match[1]}`;
            }
        }
        
        // Construct the text with instance ID in smaller, darker font
        const instanceText = instanceId ? 
            `${worldName} <span class="instance-id">${instanceId}</span>` : 
            worldName;
        
        instanceSegment = createDetailsSegment({
            iconType: 'image',
            iconHash: entityInfo.instance.world?.imageHash,
            text: instanceText,
            clickable: entityInfo.instance.id ? true : false,
            onClick: entityInfo.instance.id ? () => ShowDetailsCallback(DetailsType.Instance, entityInfo.instance.id) : null,
            tooltip: entityInfo.instance.id ? 'Current Instance' : null
        });
        instanceSegment.classList.add('user-details-instance-segment');
    }
    
    // Add all segments to container in the requested order
    if (rankSegment) {
        segmentsContainer.appendChild(rankSegment);
    }
    if (badgeSegment) {
        segmentsContainer.appendChild(badgeSegment);
    }
    if (groupSegment) {
        segmentsContainer.appendChild(groupSegment);
    }
    if (separator) {
        segmentsContainer.appendChild(separator);
    }
    if (avatarSegment) {
        segmentsContainer.appendChild(avatarSegment);
    }
    if (instanceSegment) {
        segmentsContainer.appendChild(instanceSegment);
    }
    
    // Add main info, separator, and segments to header content
    headerContent.appendChild(mainInfo);
    headerContent.appendChild(mainSeparator);
    headerContent.appendChild(segmentsContainer);
    
    // Add header content to details header
    detailsHeader.appendChild(headerContent);
    
    return {
        detailsHeader,
        headerContent,
        thumbnail,
        entityName
    };
}

// ===========
// MAIN DETAILS DISPLAY FUNCTION
// ===========

async function ShowDetails(entityType, entityId, dependencies) {
    const { 
        currentActiveUser, 
        activeInstances, 
        loadTabContentCallback,
        createElement,
        pushToast,
        window: windowAPI
    } = dependencies;

    // Create a local callback function that captures dependencies
    const showDetailsWithDependencies = (type, id) => ShowDetails(type, id, dependencies);

    // Get container elements (we'll create the header content dynamically)
    let detailsTabs = document.querySelector('.details-tabs');
    let detailsContent = document.querySelector('.details-content');
    let detailsHeader = document.querySelector('.details-header');
    
    // Get loading and shade elements
    const detailsShade = document.querySelector('.details-shade');
    const detailsLoading = document.querySelector('.details-loading');

    // Show the details shade immediately with loading spinner
    detailsShade.style.display = 'flex';
    detailsLoading.classList.remove('hidden');

    // Handle clicking outside to close
    detailsShade.onclick = (event) => {
        if (event.target === detailsShade) {
            detailsShade.style.display = 'none';
            detailsLoading.classList.add('hidden');
            // Call onClose callback if provided
            if (dependencies.onClose) {
                dependencies.onClose();
            }
        }
    };

    let entityInfo;
    
    // Check if ChilloutVR is running to determine if we should show "View Details In-Game" buttons
    let isChilloutVRRunning = false;
    try {
        isChilloutVRRunning = await windowAPI.isChilloutVRRunning();
    } catch (error) {
        log('Failed to check if ChilloutVR is running:');
        // Default to false if we can't determine the status
        isChilloutVRRunning = false;
    }

    // First, try to fetch the entity data before showing any UI
    switch (entityType) {
        case DetailsType.User: {
            try {
                entityInfo = await windowAPI.getUserById(entityId);
            } catch (error) {
                log('Failed to get user by ID:', error);
                // Hide loading spinner and modal on error
                detailsLoading.classList.add('hidden');
                detailsShade.style.display = 'none';
                // Extract the meaningful part of the error message
                const errorText = error.message.includes('Error: ') ? 
                    error.message.substring(error.message.lastIndexOf('Error: ')) : 
                    `Error: ${error.message}`;
                // Show error toast
                pushToast(`Failed to view content. ${errorText}`, 'error');
                return;
            }
            
            // Check if this is the current user viewing their own profile
            const isMyProfile = currentActiveUser && entityId === currentActiveUser.id;
            
            // Data fetching successful, now set up the UI
            // Hide loading spinner since we have the data
            detailsLoading.classList.add('hidden');
            
            // Update the window classes based on entity type
            updateDetailsWindowClasses(entityType);

            // Clear all existing tabs
            clearAllTabs();

            // Hide tabs and content by default
            detailsTabs.style.display = 'none';
            detailsContent.style.display = 'none';
            
            // Create the custom user header structure
            const headerElements = createUserDetailsHeader(entityInfo, showDetailsWithDependencies, entityId);

            // Show tabs and content for user details
            detailsTabs.style.display = 'flex';
            detailsContent.style.display = 'block';

            // Remove any existing button container (check all possible entity types)
            removeAllButtonContainers(detailsHeader);

            if (!isMyProfile) {
                // Create button container for other users
                const buttonContainer = createElement('div', {
                    className: 'user-details-button-container',
                });

                // View Details In-Game button (only show if ChilloutVR is running)
                let viewInGameButton = null;
                if (isChilloutVRRunning) {
                    viewInGameButton = createElement('button', {
                        className: 'user-details-action-button',
                        innerHTML: '<span class="material-symbols-outlined">sports_esports</span>View Details In-Game',
                        onClick: async () => {
                            try {
                                const deepLink = generateUserDetailsLink(entityId);
                                const success = await openDeepLink(deepLink);
                                if (success) {
                                    pushToast('Opening user details in ChilloutVR...', 'confirm');
                                } else {
                                    pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                                }
                            } catch (error) {
                                log('Failed to open user deep link:');
                                pushToast('Failed to generate user link', 'error');
                            }
                        },
                    });
                }

                // Friend action button
                const friendActionButton = createElement('button', {
                    className: 'user-details-action-button',
                    innerHTML: `<span class="material-symbols-outlined">${entityInfo.isFriend ? 'person_remove' : 'person_add'}</span>${entityInfo.isFriend ? 'Remove Friend' : 'Send Friend Request'}`,
                    onClick: async () => {
                        if (entityInfo.isFriend) {
                            // Show confirmation dialog
                            const confirmShade = document.querySelector('.prompt-layer');
                            const confirmPrompt = createElement('div', { className: 'prompt' });
                            const confirmTitle = createElement('div', { className: 'prompt-title', textContent: 'Remove Friend' });
                            const confirmText = createElement('div', {
                                className: 'prompt-text',
                                textContent: `Are you sure you want to remove ${entityInfo.name} from your friends list?`,
                            });
                            const confirmButtons = createElement('div', { className: 'prompt-buttons' });

                            const confirmButton = createElement('button', {
                                className: 'prompt-btn-destructive',
                                textContent: 'Remove Friend',
                                onClick: async () => {
                                    try {
                                        await windowAPI.unfriend(entityId);
                                        pushToast(`Removed ${entityInfo.name} from friends`, 'confirm');
                                        confirmPrompt.remove();
                                        confirmShade.style.display = 'none';
                                        // Remove the button since they are no longer friends
                                        friendActionButton.remove();
                                    } catch (error) {
                                        pushToast('Failed to remove friend', 'error');
                                    }
                                },
                            });

                            const cancelButton = createElement('button', {
                                className: 'prompt-btn-neutral',
                                textContent: 'Cancel',
                                onClick: () => {
                                    confirmPrompt.remove();
                                    confirmShade.style.display = 'none';
                                },
                            });

                            confirmButtons.append(confirmButton, cancelButton);
                            confirmPrompt.append(confirmTitle, confirmText, confirmButtons);
                            confirmShade.append(confirmPrompt);
                            confirmShade.style.display = 'flex';
                        } else {
                            try {
                                await windowAPI.sendFriendRequest(entityId);
                                pushToast(`Friend request sent to ${entityInfo.name}`, 'confirm');
                                // Update button state to show request sent
                                friendActionButton.innerHTML = `<span class="material-symbols-outlined">hourglass_empty</span>Request Sent`;

                                friendActionButton.disabled = true;
                                friendActionButton.classList.add('disabled');
                            } catch (error) {
                                pushToast('Failed to send friend request', 'error');
                            }
                        }
                    },
                });

                // Add to Favourites button (only show for friends)
                let categoriesButton = null;
                if (entityInfo.isFriend) {
                    categoriesButton = createElement('button', {
                        className: 'user-details-action-button',
                        innerHTML: '<span class="material-symbols-outlined">favorite</span>Add to Favourites',
                        onClick: () => {
                            showFavouritesModal('user', entityId, entityInfo.name, entityInfo.categories || [], createElement, refreshContentAfterFavoritesUpdate);
                        },
                    });
                }

                // Join Instance buttons (only show if user is in a joinable instance)
                let joinSplitButton = null;
                if (entityInfo.onlineState && entityInfo.isConnected && entityInfo.instance && entityInfo.instance.id) {
                    // Create split button container for Join Instance
                    joinSplitButton = createElement('div', {
                        className: 'user-details-split-button',
                    });

                    // Check if ChilloutVR is running to determine button text
                    // Default to false (show split buttons) if detection fails
                    let isChilloutVRRunning = false;
                    try {
                        isChilloutVRRunning = await windowAPI.isChilloutVRRunning();
                        log('ChilloutVR running status for user details:', isChilloutVRRunning);
                    } catch (error) {
                        log('Failed to check ChilloutVR status for user details:', error);
                        // Explicitly set to false to ensure split buttons show
                        isChilloutVRRunning = false;
                    }

                    if (isChilloutVRRunning) {
                        // Show single "Join In-Game" button when CVR is running
                        const joinInGameButton = createElement('button', {
                            className: 'user-details-action-button',
                            innerHTML: '<span class="material-symbols-outlined">sports_esports</span>Join In-Game',
                            onClick: async () => {
                                try {
                                    const instanceIdForJoin = entityInfo.instance.id;
                                    
                                    if (!instanceIdForJoin) {
                                        pushToast('Could not get instance ID', 'error');
                                        return;
                                    }
                                    
                                    // When game is running, VR flag is ignored, so use false
                                    const deepLink = generateInstanceJoinLink(instanceIdForJoin, false);
                                    const success = await openDeepLink(deepLink);
                                    if (success) {
                                        pushToast(`Joining ${entityInfo.name}'s instance...`, 'confirm');
                                    } else {
                                        pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                                    }
                                } catch (error) {
                                    log('Failed to join instance:', error);
                                    pushToast('Failed to generate join link', 'error');
                                }
                            },
                        });
                        joinSplitButton.appendChild(joinInGameButton);
                    } else {
                        // Show split buttons when CVR is not running
                        // Join Instance Desktop button (left side of split)
                        const joinDesktopButton = createElement('button', {
                            className: 'user-details-action-button split-button-left',
                            innerHTML: '<span class="material-symbols-outlined">desktop_windows</span>Join in Desktop',
                            onClick: async () => {
                                try {
                                    const instanceIdForJoin = entityInfo.instance.id;
                                    
                                    if (!instanceIdForJoin) {
                                        pushToast('Could not get instance ID', 'error');
                                        return;
                                    }
                                    
                                    const deepLink = generateInstanceJoinLink(instanceIdForJoin, false);
                                    const success = await openDeepLink(deepLink);
                                    if (success) {
                                        pushToast(`Joining ${entityInfo.name}'s instance in Desktop mode...`, 'confirm');
                                    } else {
                                        pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                                    }
                                } catch (error) {
                                    log('Failed to join instance in desktop:', error);
                                    pushToast('Failed to generate join link', 'error');
                                }
                            },
                        });

                        // Join Instance VR button (right side of split)
                        const joinVRButton = createElement('button', {
                            className: 'user-details-action-button split-button-right',
                            innerHTML: '<span class="material-symbols-outlined">view_in_ar</span>Join in VR',
                            onClick: async () => {
                                try {
                                    const instanceIdForJoin = entityInfo.instance.id;
                                    
                                    if (!instanceIdForJoin) {
                                        pushToast('Could not get instance ID', 'error');
                                        return;
                                    }
                                    
                                    const deepLink = generateInstanceJoinLink(instanceIdForJoin, true);
                                    const success = await openDeepLink(deepLink);
                                    if (success) {
                                        pushToast(`Joining ${entityInfo.name}'s instance in VR mode...`, 'confirm');
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
                    }
                }

                // Friend Notification Toggle button (only show for friends)
                let notificationButton = null;
                if (entityInfo.isFriend) {
                    // Check current notification status
                    let isNotificationEnabled = false;
                    windowAPI.isFriendNotificationEnabled(entityId).then(enabled => {
                        isNotificationEnabled = enabled;
                        updateNotificationButtonState();
                    }).catch(error => {
                        log('Failed to check friend notification status:', error);
                    });

                    const updateNotificationButtonState = () => {
                        const icon = isNotificationEnabled ? 'notifications' : 'notifications_off';
                        const text = isNotificationEnabled ? 'Notifications On' : 'Notifications Off';
                        notificationButton.innerHTML = `<span class="material-symbols-outlined">${icon}</span>${text}`;
                        notificationButton.classList.toggle('notification-enabled', isNotificationEnabled);
                    };

                    notificationButton = createElement('button', {
                        className: 'user-details-action-button friend-notification-button',
                        innerHTML: '<span class="material-symbols-outlined">notifications_off</span>Notifications Off',
                        onClick: async () => {
                            try {
                                const newState = !isNotificationEnabled;
                                await windowAPI.setFriendNotification(entityId, newState);
                                isNotificationEnabled = newState;
                                updateNotificationButtonState();
                                const statusText = newState ? 'enabled' : 'disabled';
                                pushToast(`Friend notifications ${statusText} for ${entityInfo.name}`, 'confirm');
                            } catch (error) {
                                log('Failed to toggle friend notification:', error);
                                pushToast('Failed to update notification settings', 'error');
                            }
                        },
                    });
                }

                // Block/Unblock button
                const blockButton = createElement('button', {
                    className: 'user-details-action-button',
                    innerHTML: `<span class="material-symbols-outlined">${entityInfo.isBlocked ? 'block' : 'no_accounts'}</span>${entityInfo.isBlocked ? 'Unblock User' : 'Block User'}`,
                    onClick: async () => {
                        if (entityInfo.isBlocked) {
                            try {
                                await windowAPI.unblockUser(entityId);
                                pushToast(`Unblocked ${entityInfo.name}`, 'confirm');
                                blockButton.innerHTML = `<span class="material-symbols-outlined">no_accounts</span>Block User`;

                                entityInfo.isBlocked = false;
                            } catch (error) {
                                pushToast('Failed to unblock user', 'error');
                            }
                        } else {
                            // Show confirmation dialog
                            const confirmShade = document.querySelector('.prompt-layer');
                            const confirmPrompt = createElement('div', { className: 'prompt' });
                            const confirmTitle = createElement('div', { className: 'prompt-title', textContent: 'Block User' });
                            const confirmText = createElement('div', {
                                className: 'prompt-text',
                                textContent: `Are you sure you want to block ${entityInfo.name}?`,
                            });
                            const confirmButtons = createElement('div', { className: 'prompt-buttons' });

                            const confirmButton = createElement('button', {
                                className: 'prompt-btn-destructive',
                                textContent: 'Block User',
                                onClick: async () => {
                                    try {
                                        await windowAPI.blockUser(entityId);
                                        pushToast(`Blocked ${entityInfo.name}`, 'confirm');
                                        blockButton.innerHTML = `<span class="material-symbols-outlined">block</span>Unblock User`;

                                        entityInfo.isBlocked = true;
                                        confirmPrompt.remove();
                                        confirmShade.style.display = 'none';
                                    } catch (error) {
                                        pushToast('Failed to block user', 'error');
                                    }
                                },
                            });

                            const cancelButton = createElement('button', {
                                className: 'prompt-btn-neutral',
                                textContent: 'Cancel',
                                onClick: () => {
                                    confirmPrompt.remove();
                                    confirmShade.style.display = 'none';
                                },
                            });

                            confirmButtons.append(confirmButton, cancelButton);
                            confirmPrompt.append(confirmTitle, confirmText, confirmButtons);
                            confirmShade.append(confirmPrompt);
                            confirmShade.style.display = 'flex';
                        }
                    },
                });

                // Set initial button state
                if (entityInfo.isFriend) {
                    friendActionButton.classList.add('is-friend');
                }

                // Add buttons to container
                const buttonsToAdd = [friendActionButton, blockButton];
                if (categoriesButton) {
                    buttonsToAdd.splice(1, 0, categoriesButton); // Insert after friendActionButton
                }
                if (notificationButton) {
                    const insertIndex = categoriesButton ? 2 : 1; // Insert after categoriesButton if it exists, otherwise after friendActionButton
                    buttonsToAdd.splice(insertIndex, 0, notificationButton);
                }
                if (joinSplitButton) {
                    buttonsToAdd.unshift(joinSplitButton); // Add join buttons at the beginning
                }
                if (viewInGameButton) {
                    buttonsToAdd.unshift(viewInGameButton); // Add at the very beginning
                }
                buttonContainer.append(...buttonsToAdd);

                // Add the button container to the header
                headerElements.detailsHeader.appendChild(buttonContainer);

                // Add tabs dynamically for other users
                addEntityTabs(entityType, entityInfo, entityId, currentActiveUser, loadTabContentCallback);
            } else {
                // For "My Profile" view - no action buttons, only Categories tab
                addMyProfileTabs(entityType, entityInfo, entityId, currentActiveUser, loadTabContentCallback);
            }
            break;
        }
        case DetailsType.Avatar: {
            try {
                entityInfo = await windowAPI.getAvatarById(entityId);
            } catch (error) {
                log('Failed to get avatar by ID:', error);
                // Hide loading spinner and modal on error
                detailsLoading.classList.add('hidden');
                detailsShade.style.display = 'none';
                // Extract the meaningful part of the error message
                const errorText = error.message.includes('Error: ') ? 
                    error.message.substring(error.message.lastIndexOf('Error: ')) : 
                    `Error: ${error.message}`;
                // Show error toast
                pushToast(`Failed to view content. ${errorText}`, 'error');
                return;
            }
            
            // Data fetching successful, now set up the UI
            // Hide loading spinner since we have the data
            detailsLoading.classList.add('hidden');
            
            // Update the window classes based on entity type
            updateDetailsWindowClasses(entityType);

            // Show the details window
            const detailsShade = document.querySelector('.details-shade');
            detailsShade.style.display = 'flex';

            // Handle clicking outside to close
            detailsShade.onclick = (event) => {
                if (event.target === detailsShade) {
                    detailsShade.style.display = 'none';
                    // Call onClose callback if provided
                    if (dependencies.onClose) {
                        dependencies.onClose();
                    }
                }
            };

            // Clear all existing tabs
            clearAllTabs();

            // Hide tabs and content by default
            detailsTabs.style.display = 'none';
            detailsContent.style.display = 'none';
            
            // Create the universal header structure
            const headerElements = createDetailsHeaderStructure(entityInfo, entityType, entityId);
            
            // Update the thumbnail for the avatar image
            headerElements.thumbnail.dataset.hash = entityInfo.imageHash;
            
            // Create avatar-specific segments using universal details-segment system
            const creatorSegment = createDetailsSegment({
                iconType: 'image',
                iconHash: entityInfo.user?.imageHash,
                text: `${entityInfo.user?.name || 'Unknown'}`,
                clickable: entityInfo.user?.id ? true : false,
                onClick: entityInfo.user?.id ? () => showDetailsWithDependencies(DetailsType.User, entityInfo.user.id) : null,
                tooltip: entityInfo.user?.id ? 'Creator' : null
            });
            creatorSegment.classList.add('avatar-details-creator-segment');
            
            // Create separator div
            const separator = document.createElement('div');
            separator.className = 'details-separator-line';
            
            // Upload date segment
            const uploadDate = entityInfo.uploadedAt ? new Date(entityInfo.uploadedAt).toLocaleDateString() : 'Unknown';
            const uploadDateSegment = createDetailsSegment({
                icon: 'upload',
                text: `Upload Date: ${uploadDate}`
            });
            uploadDateSegment.classList.add('avatar-details-upload-segment');
            
            // Update date segment
            const updateDate = entityInfo.updatedAt ? new Date(entityInfo.updatedAt).toLocaleDateString() : 'Unknown';
            const updateDateSegment = createDetailsSegment({
                icon: 'update',
                text: `Updated: ${updateDate}`
            });
            updateDateSegment.classList.add('avatar-details-update-segment');
            
            // Create second separator div
            const separator2 = document.createElement('div');
            separator2.className = 'details-separator-line';
            
            // Public status segment
            const publicationStatus = entityInfo.isPublished ? 'Public' : 'Private';
            const publicStatusSegment = createDetailsSegment({
                icon: entityInfo.isPublished ? 'public' : 'lock',
                text: publicationStatus
            });
            publicStatusSegment.classList.add('avatar-details-public-segment');
            
            // Add segments to container in the requested order
            headerElements.segmentsContainer.appendChild(creatorSegment);
            headerElements.segmentsContainer.appendChild(separator);
            headerElements.segmentsContainer.appendChild(uploadDateSegment);
            headerElements.segmentsContainer.appendChild(updateDateSegment);
            headerElements.segmentsContainer.appendChild(separator2);
            headerElements.segmentsContainer.appendChild(publicStatusSegment);
            
            // Only show "Shared With Me" status if it's true
            if (entityInfo.isSharedWithMe) {
                const sharedSegment = createDetailsSegment({
                    icon: 'share',
                    text: 'Shared with me'
                });
                sharedSegment.classList.add('avatar-details-shared-segment');
                headerElements.segmentsContainer.appendChild(sharedSegment);
            }
            
            // Add divider before file size (always show divider if we have shared segment, or if we don't have shared segment but still want to separate from public status)
            const separator3 = document.createElement('div');
            separator3.className = 'details-separator-line';
            headerElements.segmentsContainer.appendChild(separator3);
            
            // File size segment (always show)
            const fileSize = entityInfo.fileSize ? `${(entityInfo.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'Unknown';
            const fileSizeSegment = createDetailsSegment({
                icon: 'storage',
                text: `File Size: ${fileSize}`
            });
            fileSizeSegment.classList.add('avatar-details-filesize-segment');
            headerElements.segmentsContainer.appendChild(fileSizeSegment);

            // Remove any existing button container
            removeAllButtonContainers(detailsHeader);

            // Create button container
            const buttonContainer = createElement('div', {
                className: 'avatar-details-button-container',
            });

            // View Details In-Game button (only show if ChilloutVR is running)
            let viewInGameButton = null;
            if (isChilloutVRRunning) {
                viewInGameButton = createElement('button', {
                    className: 'avatar-details-action-button',
                    innerHTML: '<span class="material-symbols-outlined">sports_esports</span>View Details In-Game',
                    onClick: async () => {
                        try {
                            const deepLink = generateAvatarDetailsLink(entityId);
                            const success = await openDeepLink(deepLink);
                            if (success) {
                                pushToast('Opening avatar details in ChilloutVR...', 'confirm');
                            } else {
                                pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                            }
                        } catch (error) {
                            log('Failed to open avatar deep link:');
                            pushToast('Failed to generate avatar link', 'error');
                        }
                    },
                });
            }

            // Add to Favourites button (only show if we have access to the avatar)
            let categoriesButton = null;
            const hasAvatarAccess = (currentActiveUser && entityInfo.user?.id === currentActiveUser.id) || 
                                   entityInfo.isPublished || 
                                   entityInfo.isSharedWithMe;
            
            if (hasAvatarAccess) {
                categoriesButton = createElement('button', {
                    className: 'avatar-details-action-button',
                    innerHTML: '<span class="material-symbols-outlined">favorite</span>Add to Favourites',
                    onClick: () => {
                        showFavouritesModal('avatar', entityId, entityInfo.name, entityInfo.categories || [], createElement, refreshContentAfterFavoritesUpdate);
                    },
                });
            }

            // Switch to Avatar button (only show if we have access to the avatar)
            let switchAvatarButton = null;
            if (hasAvatarAccess) {
                switchAvatarButton = createElement('button', {
                    className: 'avatar-details-action-button',
                    innerHTML: '<span class="material-symbols-outlined">swap_horiz</span>Switch to Avatar',
                    onClick: async () => {
                        // Check if ChilloutVR is running and show warning modal if it is
                        if (isChilloutVRRunning) {
                            // Show warning modal
                            const confirmShade = document.querySelector('.prompt-layer');
                            const confirmPrompt = createElement('div', { className: 'prompt' });
                            const confirmTitle = createElement('div', { className: 'prompt-title', textContent: 'Switch Avatar While Game Running' });
                            const confirmText = createElement('div', {
                                className: 'prompt-text',
                                innerHTML: `Avatar switching while ChilloutVR is running can be inconsistent.<br><br>You may need to rejoin your current instance to see the changes in-game.<br><br>Do you want to continue?`,
                            });
                            const confirmButtons = createElement('div', { className: 'prompt-buttons' });

                            const switchButton = createElement('button', {
                                className: 'prompt-btn-confirm',
                                textContent: 'Switch Avatar',
                                onClick: async () => {
                                    try {
                                        await windowAPI.setCurrentAvatar(entityId);
                                        pushToast(`Switched to "${entityInfo.name}"`, 'confirm');
                                        confirmPrompt.remove();
                                        confirmShade.style.display = 'none';
                                    } catch (error) {
                                        log('Failed to switch avatar:');
                                        pushToast('Failed to switch avatar', 'error');
                                    }
                                },
                            });

                            const cancelButton = createElement('button', {
                                className: 'prompt-btn-neutral',
                                textContent: 'Cancel',
                                onClick: () => {
                                    confirmPrompt.remove();
                                    confirmShade.style.display = 'none';
                                },
                            });

                            confirmButtons.append(switchButton, cancelButton);
                            confirmPrompt.append(confirmTitle, confirmText, confirmButtons);
                            confirmShade.append(confirmPrompt);
                            confirmShade.style.display = 'flex';
                        } else {
                            // Switch avatar directly if game is not running
                            try {
                                await windowAPI.setCurrentAvatar(entityId);
                                pushToast(`Switched to "${entityInfo.name}"`, 'confirm');
                            } catch (error) {
                                log('Failed to switch avatar:');
                                pushToast('Failed to switch avatar', 'error');
                            }
                        }
                    },
                });
            }

            // Add buttons to container
            const buttonsToAdd = [];
            if (categoriesButton) {
                buttonsToAdd.push(categoriesButton);
            }
            if (switchAvatarButton) {
                buttonsToAdd.push(switchAvatarButton);
            }
            if (viewInGameButton) {
                buttonsToAdd.unshift(viewInGameButton); // Add at the beginning
            }
            buttonContainer.append(...buttonsToAdd);

            // Add the button container to the header
            headerElements.detailsHeader.appendChild(buttonContainer);

            // Show tabs and content for avatar details
            detailsTabs.style.display = 'flex';
            detailsContent.style.display = 'block';

            // Add tabs dynamically
            addEntityTabs(entityType, entityInfo, entityId, currentActiveUser, loadTabContentCallback);
            break;
        }
        case DetailsType.Prop: {
            try {
                entityInfo = await windowAPI.getPropById(entityId);
            } catch (error) {
                log('Failed to get prop by ID:', error);
                // Hide loading spinner and modal on error
                detailsLoading.classList.add('hidden');
                detailsShade.style.display = 'none';
                // Extract the meaningful part of the error message
                const errorText = error.message.includes('Error: ') ? 
                    error.message.substring(error.message.lastIndexOf('Error: ')) : 
                    `Error: ${error.message}`;
                // Show error toast
                pushToast(`Failed to view content. ${errorText}`, 'error');
                return;
            }
            
            // Data fetching successful, now set up the UI
            // Hide loading spinner since we have the data
            detailsLoading.classList.add('hidden');
            
            // Update the window classes based on entity type
            updateDetailsWindowClasses(entityType);

            // Show the details window
            const detailsShade = document.querySelector('.details-shade');
            detailsShade.style.display = 'flex';

            // Handle clicking outside to close
            detailsShade.onclick = (event) => {
                if (event.target === detailsShade) {
                    detailsShade.style.display = 'none';
                    // Call onClose callback if provided
                    if (dependencies.onClose) {
                        dependencies.onClose();
                    }
                }
            };

            // Clear all existing tabs
            clearAllTabs();

            // Hide tabs and content by default
            detailsTabs.style.display = 'none';
            detailsContent.style.display = 'none';
            
            // Create the universal header structure
            const headerElements = createDetailsHeaderStructure(entityInfo, entityType, entityId);
            
            // Update the thumbnail for the prop image
            headerElements.thumbnail.dataset.hash = entityInfo.imageHash;
            
            // Create prop-specific segments using universal details-segment system
            const creatorSegment = createDetailsSegment({
                iconType: 'image',
                iconHash: entityInfo.author?.imageHash,
                text: `${entityInfo.author?.name || 'Unknown'}`,
                clickable: entityInfo.author?.id ? true : false,
                onClick: entityInfo.author?.id ? () => showDetailsWithDependencies(DetailsType.User, entityInfo.author.id) : null,
                tooltip: entityInfo.author?.id ? 'Creator' : null
            });
            creatorSegment.classList.add('prop-details-creator-segment');
            
            // Create separator div
            const separator = document.createElement('div');
            separator.className = 'details-separator-line';
            
            // Upload date segment
            const uploadDate = entityInfo.uploadedAt ? new Date(entityInfo.uploadedAt).toLocaleDateString() : 'Unknown';
            const uploadDateSegment = createDetailsSegment({
                icon: 'upload',
                text: `Upload Date: ${uploadDate}`
            });
            uploadDateSegment.classList.add('prop-details-upload-segment');
            
            // Update date segment
            const updateDate = entityInfo.updatedAt ? new Date(entityInfo.updatedAt).toLocaleDateString() : 'Unknown';
            const updateDateSegment = createDetailsSegment({
                icon: 'update',
                text: `Updated: ${updateDate}`
            });
            updateDateSegment.classList.add('prop-details-update-segment');
            
            // Create second separator div
            const separator2 = document.createElement('div');
            separator2.className = 'details-separator-line';
            
            // Public status segment
            const publicationStatus = entityInfo.isPublished ? 'Public' : 'Private';
            const publicStatusSegment = createDetailsSegment({
                icon: entityInfo.isPublished ? 'public' : 'lock',
                text: publicationStatus
            });
            publicStatusSegment.classList.add('prop-details-public-segment');
            
            // Add segments to container in the requested order
            headerElements.segmentsContainer.appendChild(creatorSegment);
            headerElements.segmentsContainer.appendChild(separator);
            headerElements.segmentsContainer.appendChild(uploadDateSegment);
            headerElements.segmentsContainer.appendChild(updateDateSegment);
            headerElements.segmentsContainer.appendChild(separator2);
            headerElements.segmentsContainer.appendChild(publicStatusSegment);
            
            // Only show "Shared With Me" status if it's true
            if (entityInfo.isSharedWithMe) {
                const sharedSegment = createDetailsSegment({
                    icon: 'share',
                    text: 'Shared with me'
                });
                sharedSegment.classList.add('prop-details-shared-segment');
                headerElements.segmentsContainer.appendChild(sharedSegment);
            }
            
            // Add divider before file size
            const separator3 = document.createElement('div');
            separator3.className = 'details-separator-line';
            headerElements.segmentsContainer.appendChild(separator3);
            
            // File size segment (always show)
            const fileSize = entityInfo.fileSize ? `${(entityInfo.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'Unknown';
            const fileSizeSegment = createDetailsSegment({
                icon: 'storage',
                text: `File Size: ${fileSize}`
            });
            fileSizeSegment.classList.add('prop-details-filesize-segment');
            headerElements.segmentsContainer.appendChild(fileSizeSegment);

            // Remove any existing button container
            removeAllButtonContainers(detailsHeader);

            // Create button container
            const buttonContainer = createElement('div', {
                className: 'prop-details-button-container',
            });

            // View Details In-Game button (only show if ChilloutVR is running)
            let viewInGameButton = null;
            if (isChilloutVRRunning) {
                viewInGameButton = createElement('button', {
                    className: 'prop-details-action-button',
                    innerHTML: '<span class="material-symbols-outlined">sports_esports</span>View Details In-Game',
                    onClick: async () => {
                        try {
                            const deepLink = generatePropDetailsLink(entityId);
                            const success = await openDeepLink(deepLink);
                            if (success) {
                                pushToast('Opening prop details in ChilloutVR...', 'confirm');
                            } else {
                                pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                            }
                        } catch (error) {
                            log('Failed to open prop deep link:');
                            pushToast('Failed to generate prop link', 'error');
                        }
                    },
                });
            }

            // Add to Favourites button (only show if we have access to the prop)
            let categoriesButton = null;
            const hasPropAccess = (currentActiveUser && entityInfo.author?.id === currentActiveUser.id) || 
                                 entityInfo.isPublished || 
                                 entityInfo.isSharedWithMe;
            
            if (hasPropAccess) {
                categoriesButton = createElement('button', {
                    className: 'prop-details-action-button',
                    innerHTML: '<span class="material-symbols-outlined">favorite</span>Add to Favourites',
                    onClick: () => {
                        showFavouritesModal('prop', entityId, entityInfo.name, entityInfo.categories || [], createElement, refreshContentAfterFavoritesUpdate);
                    },
                });
            }

            // Add buttons to container
            const buttonsToAdd = [];
            if (categoriesButton) {
                buttonsToAdd.push(categoriesButton);
            }
            if (viewInGameButton) {
                buttonsToAdd.unshift(viewInGameButton); // Add at the beginning
            }
            buttonContainer.append(...buttonsToAdd);

            // Add the button container to the header
            headerElements.detailsHeader.appendChild(buttonContainer);

            // Show tabs and content for prop details
            detailsTabs.style.display = 'flex';
            detailsContent.style.display = 'block';

            // Add tabs dynamically
            addEntityTabs(entityType, entityInfo, entityId, currentActiveUser, loadTabContentCallback);
            break;
        }
        case DetailsType.World: {
            try {
                entityInfo = await windowAPI.getWorldById(entityId);
            } catch (error) {
                log('Failed to get world by ID:', error);
                // Hide loading spinner and modal on error
                detailsLoading.classList.add('hidden');
                detailsShade.style.display = 'none';
                // Extract the meaningful part of the error message
                const errorText = error.message.includes('Error: ') ? 
                    error.message.substring(error.message.lastIndexOf('Error: ')) : 
                    `Error: ${error.message}`;
                // Show error toast
                pushToast(`Failed to view content. ${errorText}`, 'error');
                return;
            }
            
            // Data fetching successful, now set up the UI
            // Hide loading spinner since we have the data
            detailsLoading.classList.add('hidden');
            
            // Update the window classes based on entity type
            updateDetailsWindowClasses(entityType);

            // Show the details window
            const detailsShade = document.querySelector('.details-shade');
            detailsShade.style.display = 'flex';

            // Handle clicking outside to close
            detailsShade.onclick = (event) => {
                if (event.target === detailsShade) {
                    detailsShade.style.display = 'none';
                    // Call onClose callback if provided
                    if (dependencies.onClose) {
                        dependencies.onClose();
                    }
                }
            };

            // Clear all existing tabs
            clearAllTabs();

            // Hide tabs and content by default
            detailsTabs.style.display = 'none';
            detailsContent.style.display = 'none';
            
            // Create the universal header structure
            const headerElements = createDetailsHeaderStructure(entityInfo, entityType, entityId);
            
            // Update the thumbnail for the world image
            headerElements.thumbnail.dataset.hash = entityInfo.imageHash;
            
            // Create world-specific segments using universal details-segment system
            const creatorSegment = createDetailsSegment({
                iconType: 'image',
                iconHash: entityInfo.author?.imageHash,
                text: `${entityInfo.author?.name || 'Unknown'}`,
                clickable: entityInfo.author?.id ? true : false,
                onClick: entityInfo.author?.id ? () => showDetailsWithDependencies(DetailsType.User, entityInfo.author.id) : null,
                tooltip: entityInfo.author?.id ? 'Creator' : null
            });
            creatorSegment.classList.add('world-details-creator-segment');
            
            // Create separator div
            const separator = document.createElement('div');
            separator.className = 'details-separator-line';
            
            // Upload date segment
            const uploadDate = entityInfo.uploadedAt ? new Date(entityInfo.uploadedAt).toLocaleDateString() : 'Unknown';
            const uploadDateSegment = createDetailsSegment({
                icon: 'upload',
                text: `Date Uploaded: ${uploadDate}`
            });
            uploadDateSegment.classList.add('world-details-upload-segment');
            
            // Update date segment
            const updateDate = entityInfo.updatedAt ? new Date(entityInfo.updatedAt).toLocaleDateString() : 'Unknown';
            const updateDateSegment = createDetailsSegment({
                icon: 'update',
                text: `Date Updated: ${updateDate}`
            });
            updateDateSegment.classList.add('world-details-update-segment');
            
            // Create second separator div
            const separator2 = document.createElement('div');
            separator2.className = 'details-separator-line';
            
            // File size segment
            const fileSize = entityInfo.fileSize ? `${(entityInfo.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'Unknown';
            const fileSizeSegment = createDetailsSegment({
                icon: 'storage',
                text: `File Size: ${fileSize}`
            });
            fileSizeSegment.classList.add('world-details-filesize-segment');
            
            // Add segments to container in the requested order
            headerElements.segmentsContainer.appendChild(creatorSegment);
            headerElements.segmentsContainer.appendChild(separator);
            headerElements.segmentsContainer.appendChild(uploadDateSegment);
            headerElements.segmentsContainer.appendChild(updateDateSegment);
            headerElements.segmentsContainer.appendChild(separator2);
            headerElements.segmentsContainer.appendChild(fileSizeSegment);

            // Remove any existing button container
            removeAllButtonContainers(detailsHeader);

            // Create button container
            const buttonContainer = createElement('div', {
                className: 'world-details-button-container',
            });

            // View Details In-Game button (only show if ChilloutVR is running)
            let viewInGameButton = null;
            if (isChilloutVRRunning) {
                viewInGameButton = createElement('button', {
                    className: 'world-details-action-button',
                    innerHTML: '<span class="material-symbols-outlined">sports_esports</span>View Details In-Game',
                    onClick: async () => {
                        try {
                            const deepLink = generateWorldDetailsLink(entityId);
                            const success = await openDeepLink(deepLink);
                            if (success) {
                                pushToast('Opening world details in ChilloutVR...', 'confirm');
                            } else {
                                pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                            }
                        } catch (error) {
                            log('Failed to open world deep link:');
                            pushToast('Failed to generate world link', 'error');
                        }
                    },
                });
            }

            // Set World as Home button
            const setHomeButton = createElement('button', {
                className: 'world-details-action-button',
                innerHTML: '<span class="material-symbols-outlined">home</span>Set World as Home',
                onClick: async () => {
                    try {
                        await windowAPI.setWorldAsHome(entityId);
                        pushToast(`Set "${entityInfo.name}" as your home world`, 'confirm');
                    } catch (error) {
                        log('Failed to set world as home:');
                        pushToast('Failed to set world as home', 'error');
                    }
                },
            });

            // Add to Favourites button
            const favouritesButton = createElement('button', {
                className: 'world-details-action-button',
                innerHTML: '<span class="material-symbols-outlined">favorite</span>Add to Favourites',
                onClick: () => {
                    showFavouritesModal('world', entityId, entityInfo.name, entityInfo.categories || [], createElement, refreshContentAfterFavoritesUpdate);
                },
            });

            // Add buttons to container
            const buttonsToAdd = [setHomeButton, favouritesButton];
            if (viewInGameButton) {
                buttonsToAdd.unshift(viewInGameButton); // Add at the beginning
            }
            buttonContainer.append(...buttonsToAdd);

            // Add the button container to the header
            headerElements.detailsHeader.appendChild(buttonContainer);

            // Show tabs and content for world details
            detailsTabs.style.display = 'flex';
            detailsContent.style.display = 'block';

            // Add tabs dynamically
            addEntityTabs(entityType, entityInfo, entityId, currentActiveUser, loadTabContentCallback);
            
            // Update the instances tab text with actual count from activeInstances
            updateInstanceCount(entityId, activeInstances);
            break;
        }
        case DetailsType.Instance: {
            try {
                entityInfo = await windowAPI.getInstanceById(entityId);
            } catch (error) {
                log('Failed to get instance by ID:', error);
                // Hide loading spinner and modal on error
                detailsLoading.classList.add('hidden');
                detailsShade.style.display = 'none';
                // Extract the meaningful part of the error message
                const errorText = error.message.includes('Error: ') ? 
                    error.message.substring(error.message.lastIndexOf('Error: ')) : 
                    `Error: ${error.message}`;
                // Show error toast
                pushToast(`Failed to view content. ${errorText}`, 'error');
                return;
            }
            
            // Data fetching successful, now set up the UI
            // Hide loading spinner since we have the data
            detailsLoading.classList.add('hidden');
            
            // Update the window classes based on entity type
            updateDetailsWindowClasses(entityType);

            // Show the details window
            const detailsShade = document.querySelector('.details-shade');
            detailsShade.style.display = 'flex';

            // Handle clicking outside to close
            detailsShade.onclick = (event) => {
                if (event.target === detailsShade) {
                    detailsShade.style.display = 'none';
                    // Call onClose callback if provided
                    if (dependencies.onClose) {
                        dependencies.onClose();
                    }
                }
            };

            // Clear all existing tabs
            clearAllTabs();

            // Hide tabs and content by default
            detailsTabs.style.display = 'none';
            detailsContent.style.display = 'none';
            
            // Create the universal header structure
            const headerElements = createDetailsHeaderStructure(entityInfo, entityType, entityId);
            
            // Clean the entity name by removing the instance ID portion
            let cleanName = entityInfo.name || 'Unknown Instance';
            if (entityInfo.name) {
                // Remove the (#12345) part from the name
                cleanName = entityInfo.name.replace(/\s*\(#\d+\)$/, '');
            }
            headerElements.entityName.textContent = decodeHtmlEntities(cleanName);
            
            // Update the thumbnail for the world image
            headerElements.thumbnail.dataset.hash = entityInfo.world?.imageHash;
            
            // Create instance-specific segments using universal details-segment system
            
            // Instance Owner segment (clickable, using creator-segment styling)
            const ownerSegment = createDetailsSegment({
                iconType: 'image',
                iconHash: entityInfo.owner?.imageHash,
                text: `${entityInfo.owner?.name || 'Unknown'}`,
                clickable: entityInfo.owner?.id ? true : false,
                onClick: entityInfo.owner?.id ? () => showDetailsWithDependencies(DetailsType.User, entityInfo.owner.id) : null,
                tooltip: entityInfo.owner?.id ? 'Instance Owner' : null
            });
            ownerSegment.classList.add('instance-details-creator-segment');
            
            // Instance World segment (clickable, using creator-segment styling)
            const worldSegment = createDetailsSegment({
                iconType: 'image',
                iconHash: entityInfo.world?.imageHash,
                text: `${entityInfo.world?.name || 'Unknown World'}`,
                clickable: entityInfo.world?.id ? true : false,
                onClick: entityInfo.world?.id ? () => showDetailsWithDependencies(DetailsType.World, entityInfo.world.id) : null,
                tooltip: entityInfo.world?.id ? 'World Details' : null
            });
            worldSegment.classList.add('instance-details-creator-segment');
            
            // Create separator div
            const separator = document.createElement('div');
            separator.className = 'details-separator-line';
            
            // Player Count segment
            const playerCountSegment = createDetailsSegment({
                icon: 'group',
                text: `${entityInfo.currentPlayerCount || 0}/${entityInfo.maxPlayer || '?'} Players`
            });
            playerCountSegment.classList.add('instance-details-player-count-segment');
            
            // Privacy segment
            const privacySegment = createDetailsSegment({
                icon: entityInfo.instanceSettingPrivacy === 'Public' ? 'public' : 'group',
                text: entityInfo.instanceSettingPrivacy || 'Unknown'
            });
            privacySegment.classList.add('instance-details-privacy-segment');
            
            // Region segment
            const regionSegment = createDetailsSegment({
                icon: 'location_on',
                text: (entityInfo.region || 'unknown').toUpperCase()
            });
            regionSegment.classList.add('instance-details-region-segment');
            
            // Extract instance ID from the name (format: "World Name (#12345)")
            let instanceId = null;
            if (entityInfo.name) {
                const match = entityInfo.name.match(/\(#(\d+)\)$/);
                if (match) {
                    instanceId = `#${match[1]}`;
                }
            }
            
            // Add segments to container in the requested order
            headerElements.segmentsContainer.appendChild(ownerSegment);
            headerElements.segmentsContainer.appendChild(worldSegment);
            headerElements.segmentsContainer.appendChild(separator);
            headerElements.segmentsContainer.appendChild(playerCountSegment);
            headerElements.segmentsContainer.appendChild(privacySegment);
            headerElements.segmentsContainer.appendChild(regionSegment);
            
            // Add instance ID segment if we have one
            if (instanceId) {
                // Create second separator div
                const separator2 = document.createElement('div');
                separator2.className = 'details-separator-line';
                headerElements.segmentsContainer.appendChild(separator2);
                
                // Instance ID segment
                const instanceIdSegment = createDetailsSegment({
                    icon: 'tag',
                    text: `Instance ID: ${instanceId}`
                });
                instanceIdSegment.classList.add('instance-details-id-segment');
                headerElements.segmentsContainer.appendChild(instanceIdSegment);
            }

            // Check if ChilloutVR is running (needed for both viewInGameButton and join buttons)
            // Default to false (show split buttons) if detection fails
            let isChilloutVRRunning = false;
            try {
                isChilloutVRRunning = await windowAPI.isChilloutVRRunning();
                log('ChilloutVR running status for instance details:', isChilloutVRRunning);
            } catch (error) {
                log('Failed to check ChilloutVR status for instance details:', error);
                // Explicitly set to false to ensure split buttons show
                isChilloutVRRunning = false;
            }

            // Add instance action buttons
            // Remove any existing button container
            removeAllButtonContainers(detailsHeader);

            // Create button container
            const buttonContainer = createElement('div', {
                className: 'instance-details-button-container',
            });

            // View Details In-Game button (only show if ChilloutVR is running)
            let viewInGameButton = null;
            if (isChilloutVRRunning) {
                viewInGameButton = createElement('button', {
                    className: 'instance-details-action-button',
                    innerHTML: '<span class="material-symbols-outlined">sports_esports</span>View Details In-Game',
                    onClick: async () => {
                        try {
                            const deepLink = generateInstanceDetailsLink(entityId);
                            const success = await openDeepLink(deepLink);
                            if (success) {
                                pushToast('Opening instance details in ChilloutVR...', 'confirm');
                            } else {
                                pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                            }
                        } catch (error) {
                            log('Failed to open instance deep link:');
                            pushToast('Failed to generate instance link', 'error');
                        }
                    },
                });
            }

            // Create dynamic join button(s) based on ChilloutVR running status
            const joinSplitButton = createElement('div', {
                className: 'instance-details-split-button',
            });

            if (isChilloutVRRunning) {
                // Show single "Join In-Game" button when CVR is running
                const joinInGameButton = createElement('button', {
                    className: 'instance-details-action-button',
                    innerHTML: '<span class="material-symbols-outlined">sports_esports</span>Join In-Game',
                    onClick: async () => {
                        try {
                            // Use the full instance ID from entityInfo.id
                            const instanceIdForJoin = entityInfo.id;
                            
                            if (!instanceIdForJoin) {
                                pushToast('Could not get instance ID', 'error');
                                return;
                            }
                            
                            // When game is running, VR flag is ignored, so use false
                            const deepLink = generateInstanceJoinLink(instanceIdForJoin, false);
                            const success = await openDeepLink(deepLink);
                            if (success) {
                                pushToast('Joining instance...', 'confirm');
                            } else {
                                pushToast('Failed to open ChilloutVR. Make sure it\'s installed.', 'error');
                            }
                        } catch (error) {
                            log('Failed to join instance:', error);
                            pushToast('Failed to generate join link', 'error');
                        }
                    },
                });
                joinSplitButton.appendChild(joinInGameButton);
            } else {
                // Show split buttons when CVR is not running
                // Join Instance Desktop button (left side of split)
                const joinDesktopButton = createElement('button', {
                    className: 'instance-details-action-button split-button-left',
                    innerHTML: '<span class="material-symbols-outlined">desktop_windows</span>Join in Desktop',
                    onClick: async () => {
                        try {
                            // Use the full instance ID from entityInfo.id
                            const instanceIdForJoin = entityInfo.id;
                            
                            if (!instanceIdForJoin) {
                                pushToast('Could not get instance ID', 'error');
                                return;
                            }
                            
                            const deepLink = generateInstanceJoinLink(instanceIdForJoin, false);
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

                // Join Instance VR button (right side of split)
                const joinVRButton = createElement('button', {
                    className: 'instance-details-action-button split-button-right',
                    innerHTML: '<span class="material-symbols-outlined">view_in_ar</span>Join in VR',
                    onClick: async () => {
                        try {
                            // Use the full instance ID from entityInfo.id
                            const instanceIdForJoin = entityInfo.id;
                            
                            if (!instanceIdForJoin) {
                                pushToast('Could not get instance ID', 'error');
                                return;
                            }
                            
                            const deepLink = generateInstanceJoinLink(instanceIdForJoin, true);
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
            }

            // Add buttons to container
            const buttonsToAdd = [joinSplitButton];
            if (viewInGameButton) {
                buttonsToAdd.unshift(viewInGameButton); // Add at the beginning
            }
            buttonContainer.append(...buttonsToAdd);

            // Add the button container to the header
            headerElements.detailsHeader.appendChild(buttonContainer);

            // Show tabs and content for instance details
            detailsTabs.style.display = 'flex';
            detailsContent.style.display = 'block';

            // Add tabs dynamically
            addEntityTabs(entityType, entityInfo, entityId, currentActiveUser, loadTabContentCallback);
            
            // Update the instances tab text with count
            const instancesTab = document.querySelector(`[data-tab="instances"]`);
            if (instancesTab) {
                const instanceCount = activeInstances.filter(instance => instance.world?.id === entityId).length;
                instancesTab.innerHTML = `<span class="material-symbols-outlined">public</span>Instances (${instanceCount})`;
            }
            break;
        }
    }
}

// ===========
// EXPORTS
// ===========

export {
    DetailsType,
    decodeHtmlEntities,
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
    addMyProfileTabs,
    createUserDetailsHeader,
    ShowDetails
}; 