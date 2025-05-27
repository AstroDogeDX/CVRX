// =======
// DEEP LINKS MODULE
// =======

// ===========
// CONSTANTS
// ===========

const CHILLOUTVR_PROTOCOL = 'chilloutvr://';

const DeepLinkType = Object.freeze({
    Instance: 'instance',
    UserDetails: 'user-details',
    AvatarDetails: 'avatar-details',
    WorldDetails: 'world-details',
    PropDetails: 'prop-details',
    InstanceDetails: 'instance-details'
});

// ===========
// DEEP LINK GENERATORS
// ===========

/**
 * Generate a deep link to join a ChilloutVR instance
 * @param {string} instanceId - The full instance ID (with or without the 'i+' prefix)
 * @param {boolean} startInVR - Whether to start in VR mode (default: false)
 * @returns {string} The formatted deep link
 */
function generateInstanceJoinLink(instanceId, startInVR = false) {
    if (!instanceId) {
        throw new Error('Instance ID is required');
    }
    
    console.log('🏗️ Generating instance join link for:', instanceId, 'startInVR:', startInVR);
    
    // Ensure the instance ID has the 'i+' prefix
    let formattedInstanceId = instanceId;
    if (!instanceId.startsWith('i+')) {
        formattedInstanceId = `i+${instanceId}`;
    }
    
    const baseUrl = `${CHILLOUTVR_PROTOCOL}instance/join`;
    const params = new URLSearchParams({
        instanceId: formattedInstanceId,
        startInVR: startInVR.toString()
    });
    
    const finalUrl = `${baseUrl}?${params.toString()}`;
    console.log('🔗 Generated deep link:', finalUrl);
    
    return finalUrl;
}

/**
 * Generate a deep link to view user details
 * @param {string} userId - The user ID
 * @returns {string} The formatted deep link
 */
function generateUserDetailsLink(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }
    
    return `${CHILLOUTVR_PROTOCOL}details/user?id=${userId}`;
}

/**
 * Generate a deep link to view avatar details
 * @param {string} avatarId - The avatar ID
 * @returns {string} The formatted deep link
 */
function generateAvatarDetailsLink(avatarId) {
    if (!avatarId) {
        throw new Error('Avatar ID is required');
    }
    
    return `${CHILLOUTVR_PROTOCOL}details/avatar?id=${avatarId}`;
}

/**
 * Generate a deep link to view world details
 * @param {string} worldId - The world ID
 * @returns {string} The formatted deep link
 */
function generateWorldDetailsLink(worldId) {
    if (!worldId) {
        throw new Error('World ID is required');
    }
    
    return `${CHILLOUTVR_PROTOCOL}details/world?id=${worldId}`;
}

/**
 * Generate a deep link to view prop details
 * @param {string} propId - The prop ID
 * @returns {string} The formatted deep link
 */
function generatePropDetailsLink(propId) {
    if (!propId) {
        throw new Error('Prop ID is required');
    }
    
    return `${CHILLOUTVR_PROTOCOL}details/prop?id=${propId}`;
}

/**
 * Generate a deep link to view instance details
 * @param {string} instanceId - The full instance ID (with or without the 'i+' prefix)
 * @returns {string} The formatted deep link
 */
function generateInstanceDetailsLink(instanceId) {
    if (!instanceId) {
        throw new Error('Instance ID is required');
    }
    
    // Ensure the instance ID has the 'i+' prefix
    let formattedInstanceId = instanceId;
    if (!instanceId.startsWith('i+')) {
        formattedInstanceId = `i+${instanceId}`;
    }
    
    const baseUrl = `${CHILLOUTVR_PROTOCOL}details/instance`;
    const params = new URLSearchParams({
        id: formattedInstanceId
    });
    
    return `${baseUrl}?${params.toString()}`;
}

// ===========
// DEEP LINK HANDLERS
// ===========

/**
 * Open a deep link in the default system handler (ChilloutVR)
 * @param {string} deepLink - The deep link URL to open
 * @returns {Promise<boolean>} Success status
 */
async function openDeepLink(deepLink) {
    try {
        console.log('🔗 Attempting to open deep link:', deepLink);
        
        if (!deepLink || !deepLink.startsWith(CHILLOUTVR_PROTOCOL)) {
            console.error('❌ Invalid ChilloutVR deep link - does not start with protocol:', CHILLOUTVR_PROTOCOL);
            throw new Error('Invalid ChilloutVR deep link');
        }
        
        console.log('✅ Deep link validation passed');
        
        // Use Electron's shell.openExternal to open the deep link
        if (window.API && window.API.openExternal) {
            console.log('🖥️ Using Electron API to open deep link');
            await window.API.openExternal(deepLink);
            console.log('✅ Deep link opened successfully via Electron');
            return true;
        } else {
            console.log('🌐 Using fallback window.open for deep link');
            window.open(deepLink, '_blank');
            console.log('✅ Deep link opened successfully via window.open');
            return true;
        }
    } catch (error) {
        console.error('❌ Failed to open deep link:', error);
        console.error('🔍 Deep link that failed:', deepLink);
        return false;
    }
}

/**
 * Copy a deep link to the clipboard
 * @param {string} deepLink - The deep link URL to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyDeepLinkToClipboard(deepLink) {
    try {
        if (!deepLink || !deepLink.startsWith(CHILLOUTVR_PROTOCOL)) {
            throw new Error('Invalid ChilloutVR deep link');
        }
        
        await navigator.clipboard.writeText(deepLink);
        return true;
    } catch (error) {
        console.error('Failed to copy deep link to clipboard:', error);
        return false;
    }
}

// ===========
// UTILITY FUNCTIONS
// ===========

/**
 * Parse a ChilloutVR deep link to extract its components
 * @param {string} deepLink - The deep link to parse
 * @returns {object} Parsed deep link components
 */
function parseDeepLink(deepLink) {
    try {
        if (!deepLink || !deepLink.startsWith(CHILLOUTVR_PROTOCOL)) {
            throw new Error('Invalid ChilloutVR deep link');
        }
        
        const url = new URL(deepLink);
        const pathParts = url.pathname.split('/').filter(part => part);
        
        if (pathParts.length < 2) {
            throw new Error('Invalid deep link format');
        }
        
        const action = pathParts[0]; // 'instance' or 'details'
        const type = pathParts[1]; // 'join', 'user', 'avatar', etc.
        
        const result = {
            action,
            type,
            params: {}
        };
        
        // Parse URL parameters
        url.searchParams.forEach((value, key) => {
            result.params[key] = value;
        });
        
        return result;
    } catch (error) {
        console.error('Failed to parse deep link:', error);
        return null;
    }
}

/**
 * Validate if a string is a valid ChilloutVR deep link
 * @param {string} deepLink - The string to validate
 * @returns {boolean} Whether the string is a valid deep link
 */
function isValidDeepLink(deepLink) {
    if (!deepLink || typeof deepLink !== 'string') {
        return false;
    }
    
    if (!deepLink.startsWith(CHILLOUTVR_PROTOCOL)) {
        return false;
    }
    
    const parsed = parseDeepLink(deepLink);
    return parsed !== null;
}

/**
 * Get the deep link type from a parsed deep link
 * @param {object} parsedLink - The parsed deep link object
 * @returns {string|null} The deep link type or null if invalid
 */
function getDeepLinkType(parsedLink) {
    if (!parsedLink || !parsedLink.action || !parsedLink.type) {
        return null;
    }
    
    if (parsedLink.action === 'instance' && parsedLink.type === 'join') {
        return DeepLinkType.Instance;
    }
    
    if (parsedLink.action === 'details') {
        switch (parsedLink.type) {
            case 'user':
                return DeepLinkType.UserDetails;
            case 'avatar':
                return DeepLinkType.AvatarDetails;
            case 'world':
                return DeepLinkType.WorldDetails;
            case 'prop':
                return DeepLinkType.PropDetails;
            case 'instance':
                return DeepLinkType.InstanceDetails;
            default:
                return null;
        }
    }
    
    return null;
}

// ===========
// CONVENIENCE FUNCTIONS
// ===========

/**
 * Create a button element that opens a deep link when clicked
 * @param {string} deepLink - The deep link to open
 * @param {string} buttonText - The text to display on the button
 * @param {object} options - Additional options for the button
 * @returns {HTMLButtonElement} The created button element
 */
function createDeepLinkButton(deepLink, buttonText, options = {}) {
    const button = document.createElement('button');
    button.textContent = buttonText;
    button.className = options.className || 'deeplink-button';
    
    if (options.tooltip) {
        button.dataset.tooltip = options.tooltip;
    }
    
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        const success = await openDeepLink(deepLink);
        
        if (options.onSuccess && success) {
            options.onSuccess();
        } else if (options.onError && !success) {
            options.onError();
        }
    });
    
    return button;
}

/**
 * Create a button that copies a deep link to clipboard
 * @param {string} deepLink - The deep link to copy
 * @param {string} buttonText - The text to display on the button
 * @param {object} options - Additional options for the button
 * @returns {HTMLButtonElement} The created button element
 */
function createCopyLinkButton(deepLink, buttonText, options = {}) {
    const button = document.createElement('button');
    button.textContent = buttonText;
    button.className = options.className || 'copy-link-button';
    
    if (options.tooltip) {
        button.dataset.tooltip = options.tooltip;
    }
    
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        const success = await copyDeepLinkToClipboard(deepLink);
        
        if (success) {
            // Temporarily change button text to show success
            const originalText = button.textContent;
            button.textContent = options.successText || 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
            
            if (options.onSuccess) {
                options.onSuccess();
            }
        } else if (options.onError) {
            options.onError();
        }
    });
    
    return button;
}

// ===========
// EXPORTS
// ===========

export {
    DeepLinkType,
    generateInstanceJoinLink,
    generateUserDetailsLink,
    generateAvatarDetailsLink,
    generateWorldDetailsLink,
    generatePropDetailsLink,
    generateInstanceDetailsLink,
    openDeepLink,
    copyDeepLinkToClipboard,
    parseDeepLink,
    isValidDeepLink,
    getDeepLinkType,
    createDeepLinkButton,
    createCopyLinkButton
};
