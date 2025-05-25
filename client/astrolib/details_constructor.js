// =======
// DETAILS CONSTRUCTOR MODULE
// =======

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';

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
        onClick
    } = options;
    
    const segment = document.createElement('div');
    segment.className = `details-segment${clickable ? ' clickable' : ''}`;
    
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
function createDetailsHeaderStructure(entityInfo, entityType) {
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
    
    // Create thumbnail image
    const thumbnail = document.createElement('img');
    thumbnail.className = 'details-thumbnail';
    thumbnail.src = 'img/ui/placeholder.png';
    thumbnail.dataset.hash = entityInfo.imageHash || '';
    
    thumbnailContainer.appendChild(thumbnail);
    
    // Create entity name
    const entityName = document.createElement('h1');
    entityName.className = 'details-entity-name';
    entityName.textContent = entityInfo.name || 'Unknown';
    
    // Add thumbnail and name to main info
    mainInfo.appendChild(thumbnailContainer);
    mainInfo.appendChild(entityName);
    
    // Create segments container
    const segmentsContainer = document.createElement('div');
    segmentsContainer.className = 'details-segments-container';
    
    // Add main info and segments to header content
    headerContent.appendChild(mainInfo);
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
            
        case DetailsType.Avatar:
            // Left side tabs for Avatar Details - Description moved to left
            const avatarDescTab = createTabButton('description', 'description', 'Description', classPrefix, true);
            tabs.push(avatarDescTab);
            tabsLeft.append(avatarDescTab);
            
            // Only show Shares tab if the current user owns this avatar
            if (currentActiveUser && entityInfo.user?.id === currentActiveUser.id) {
                const avatarSharesTab = createTabButton('shares', 'share', 'Shares', classPrefix);
                tabs.push(avatarSharesTab);
                tabsRight.append(avatarSharesTab);
            }
            
            // Create corresponding tab panes
            const avatarDescPane = createTabPane('description', classPrefix, '<div class="description-container"></div>', true);
            tabPanes.push(avatarDescPane);
            
            if (currentActiveUser && entityInfo.user?.id === currentActiveUser.id) {
                const avatarSharesPane = createTabPane('shares', classPrefix, '<div class="shares-container"></div>');
                tabPanes.push(avatarSharesPane);
            }
            
            firstTabId = 'description';
            break;
            
        case DetailsType.Prop:
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
function createUserDetailsHeader(entityInfo, ShowDetailsCallback) {
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
    
    // Create thumbnail image using existing details-thumbnail class
    const thumbnail = document.createElement('img');
    thumbnail.className = 'details-thumbnail';
    thumbnail.src = 'img/ui/placeholder.png';
    thumbnail.dataset.hash = entityInfo.imageHash;
    thumbnailContainer.appendChild(thumbnail);
    
    // Create entity name
    const entityName = document.createElement('h1');
    entityName.className = 'details-entity-name';
    entityName.textContent = entityInfo.name || 'Unknown User';
    
    // Add thumbnail and name to main info
    mainInfo.appendChild(thumbnailContainer);
    mainInfo.appendChild(entityName);
    
    // Create segments container
    const segmentsContainer = document.createElement('div');
    segmentsContainer.className = 'details-segments-container user-details-segments';
    
    // Create rank segment using universal details-segment
    const rankSegment = createDetailsSegment({
        icon: 'military_tech',
        text: entityInfo.rank || 'Unknown Rank'
    });
    rankSegment.classList.add('user-details-rank-segment');
    
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
    
    // Create separator div
    const separator = document.createElement('div');
    separator.className = 'user-details-separator-line';
    
    // Create avatar segment using universal details-segment
    const avatarSegment = createDetailsSegment({
        iconType: 'image',
        iconHash: entityInfo.avatar?.imageHash,
        text: entityInfo.avatar?.name || 'No Avatar',
        clickable: entityInfo.avatar?.id ? true : false,
        onClick: entityInfo.avatar?.id ? () => ShowDetailsCallback(DetailsType.Avatar, entityInfo.avatar.id) : null
    });
    avatarSegment.classList.add('user-details-avatar-segment');
    
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
            onClick: entityInfo.instance.id ? () => ShowDetailsCallback(DetailsType.Instance, entityInfo.instance.id) : null
        });
        instanceSegment.classList.add('user-details-instance-segment');
    }
    
    // Add all segments to container in the requested order
    segmentsContainer.appendChild(rankSegment);
    if (badgeSegment) {
        segmentsContainer.appendChild(badgeSegment);
    }
    if (groupSegment) {
        segmentsContainer.appendChild(groupSegment);
    }
    segmentsContainer.appendChild(separator);
    segmentsContainer.appendChild(avatarSegment);
    if (instanceSegment) {
        segmentsContainer.appendChild(instanceSegment);
    }
    
    // Add main info and segments to header content
    headerContent.appendChild(mainInfo);
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
// EXPORTS
// ===========

export {
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
    addEntityTabs,
    createUserDetailsHeader
}; 