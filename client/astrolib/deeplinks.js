// =======
// DEEP LINKS MODULE
// =======

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

// Generate a deep link to join a ChilloutVR instance
// instanceId - The full instance ID (with or without the 'i+' prefix)
// startInVR - Whether to start in VR mode (default: false)
// Returns: The formatted deep link
function generateInstanceJoinLink(instanceId, startInVR = false) {
    if (!instanceId) {
        throw new Error('Instance ID is required');
    }
    
    log('🏗️ Generating instance join link for:', { instanceId, startInVR });
    
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
    log('🔗 Generated deep link:', { finalUrl });
    
    return finalUrl;
}

// Generate a deep link to view user details
// userId - The user ID
// Returns: The formatted deep link
function generateUserDetailsLink(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }
    
    return `${CHILLOUTVR_PROTOCOL}details/user?id=${userId}`;
}

// Generate a deep link to view avatar details
// avatarId - The avatar ID
// Returns: The formatted deep link
function generateAvatarDetailsLink(avatarId) {
    if (!avatarId) {
        throw new Error('Avatar ID is required');
    }
    
    return `${CHILLOUTVR_PROTOCOL}details/avatar?id=${avatarId}`;
}

// Generate a deep link to view world details
// worldId - The world ID
// Returns: The formatted deep link
function generateWorldDetailsLink(worldId) {
    if (!worldId) {
        throw new Error('World ID is required');
    }
    
    return `${CHILLOUTVR_PROTOCOL}details/world?id=${worldId}`;
}

// Generate a deep link to view prop details
// propId - The prop ID
// Returns: The formatted deep link
function generatePropDetailsLink(propId) {
    if (!propId) {
        throw new Error('Prop ID is required');
    }
    
    return `${CHILLOUTVR_PROTOCOL}details/prop?id=${propId}`;
}

// Generate a deep link to view instance details
// instanceId - The full instance ID (with or without the 'i+' prefix)
// Returns: The formatted deep link
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

// Open a deep link in the default system handler (ChilloutVR)
// deepLink - The deep link URL to open
// Returns: Success status
async function openDeepLink(deepLink) {
    try {
        log('🔗 Attempting to open deep link:', { deepLink });
        
        if (!deepLink || !deepLink.startsWith(CHILLOUTVR_PROTOCOL)) {
            log('❌ Invalid ChilloutVR deep link - does not start with protocol:', { protocol: CHILLOUTVR_PROTOCOL, deepLink });
            throw new Error('Invalid ChilloutVR deep link');
        }
        
        log('✅ Deep link validation passed');
        
        // Use Electron's shell.openExternal to open the deep link
        if (window.API && window.API.openExternal) {
            log('🖥️ Using Electron API to open deep link');
            await window.API.openExternal(deepLink);
            log('✅ Deep link opened successfully via Electron');
            return true;
        } else {
            log('🌐 Using fallback window.open for deep link');
            window.open(deepLink, '_blank');
            log('✅ Deep link opened successfully via window.open');
            return true;
        }
    } catch (error) {
        log('❌ Failed to open deep link:', { error: error.message, stack: error.stack });
        log('🔍 Deep link that failed:', { deepLink });
        return false;
    }
}

// Copy a deep link to the clipboard
// deepLink - The deep link URL to copy
// Returns: Success status
async function copyDeepLinkToClipboard(deepLink) {
    try {
        if (!deepLink || !deepLink.startsWith(CHILLOUTVR_PROTOCOL)) {
            throw new Error('Invalid ChilloutVR deep link');
        }
        
        await navigator.clipboard.writeText(deepLink);
        return true;
    } catch (error) {
        log('Failed to copy deep link to clipboard:', { error: error.message, stack: error.stack });
        return false;
    }
}

// ===========
// UTILITY FUNCTIONS
// ===========

// Parse a ChilloutVR deep link to extract its components
// deepLink - The deep link to parse
// Returns: Parsed deep link components
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
        log('Failed to parse deep link:', { error: error.message, stack: error.stack });
        return null;
    }
}

// Validate if a string is a valid ChilloutVR deep link
// deepLink - The string to validate
// Returns: Whether the string is a valid deep link
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

// Get the deep link type from a parsed deep link
// parsedLink - The parsed deep link object
// Returns: The deep link type or null if invalid
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

// Create a button element that opens a deep link when clicked
// deepLink - The deep link to open
// buttonText - The text to display on the button
// options - Additional options for the button
// Returns: The created button element
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

// Create a button that copies a deep link to clipboard
// deepLink - The deep link to copy
// buttonText - The text to display on the button
// options - Additional options for the button
// Returns: The created button element
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
