// =======
// DEEP LINKS USAGE EXAMPLES
// =======

import {
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
} from './deeplinks.js';

// ===========
// EXAMPLE USAGE
// ===========

// Example function to demonstrate generating deep links
function demonstrateDeepLinkGeneration() {
    console.log('=== Deep Link Generation Examples ===');
    
    // Generate instance join links
    const instanceJoinLink = generateInstanceJoinLink('12345', false);
    console.log('Instance Join (Desktop):', instanceJoinLink);
    // Output: chilloutvr://instance/join?instanceId=i%2B12345&startInVR=false
    
    const instanceJoinVRLink = generateInstanceJoinLink('12345', true);
    console.log('Instance Join (VR):', instanceJoinVRLink);
    // Output: chilloutvr://instance/join?instanceId=i%2B12345&startInVR=true
    
    // Generate details links
    const userDetailsLink = generateUserDetailsLink('usr_12345');
    console.log('User Details:', userDetailsLink);
    // Output: chilloutvr://details/user?id=usr_12345
    
    const avatarDetailsLink = generateAvatarDetailsLink('avtr_67890');
    console.log('Avatar Details:', avatarDetailsLink);
    // Output: chilloutvr://details/avatar?id=avtr_67890
    
    const worldDetailsLink = generateWorldDetailsLink('wrld_abcde');
    console.log('World Details:', worldDetailsLink);
    // Output: chilloutvr://details/world?id=wrld_abcde
    
    const propDetailsLink = generatePropDetailsLink('prop_fghij');
    console.log('Prop Details:', propDetailsLink);
    // Output: chilloutvr://details/prop?id=prop_fghij
    
    const instanceDetailsLink = generateInstanceDetailsLink('12345');
    console.log('Instance Details:', instanceDetailsLink);
    // Output: chilloutvr://details/instance?id=i+12345
}

// Example function to demonstrate parsing deep links
function demonstrateDeepLinkParsing() {
    console.log('\n=== Deep Link Parsing Examples ===');
    
    const testLinks = [
        'chilloutvr://instance/join?instanceId=i+12345&startInVR=true',
        'chilloutvr://details/user?id=usr_12345',
        'chilloutvr://details/avatar?id=avtr_67890',
        'chilloutvr://details/world?id=wrld_abcde',
        'chilloutvr://details/prop?id=prop_fghij',
        'chilloutvr://details/instance?id=i+12345'
    ];
    
    testLinks.forEach(link => {
        console.log(`\nTesting: ${link}`);
        console.log('Valid:', isValidDeepLink(link));
        
        const parsed = parseDeepLink(link);
        if (parsed) {
            console.log('Parsed:', parsed);
            console.log('Type:', getDeepLinkType(parsed));
        }
    });
}

// Example function to create interactive buttons
function createDeepLinkButtons() {
    console.log('\n=== Creating Interactive Buttons ===');
    
    // Create a button that opens an instance join link
    const instanceId = '12345';
    const joinInstanceLink = generateInstanceJoinLink(instanceId, false);
    
    const joinButton = createDeepLinkButton(
        joinInstanceLink,
        'Join Instance',
        {
            className: 'join-instance-button',
            tooltip: 'Click to join this ChilloutVR instance',
            onSuccess: () => console.log('Successfully opened ChilloutVR!'),
            onError: () => console.error('Failed to open ChilloutVR')
        }
    );
    
    // Create a button that copies a user details link
    const userId = 'usr_12345';
    const userDetailsLink = generateUserDetailsLink(userId);
    
    const copyUserLinkButton = createCopyLinkButton(
        userDetailsLink,
        'Copy User Link',
        {
            className: 'copy-user-link-button',
            tooltip: 'Copy user profile link to clipboard',
            successText: 'Copied!',
            onSuccess: () => console.log('User link copied to clipboard!'),
            onError: () => console.error('Failed to copy link')
        }
    );
    
    return { joinButton, copyUserLinkButton };
}

// Example function to handle deep links from user input
async function handleUserDeepLink(userInput) {
    console.log('\n=== Handling User Deep Link ===');
    
    if (!isValidDeepLink(userInput)) {
        console.error('Invalid ChilloutVR deep link provided');
        return false;
    }
    
    const parsed = parseDeepLink(userInput);
    const linkType = getDeepLinkType(parsed);
    
    console.log(`Processing ${linkType} deep link...`);
    
    switch (linkType) {
        case DeepLinkType.Instance:
            console.log(`Joining instance: ${parsed.params.instanceId}`);
            console.log(`VR Mode: ${parsed.params.startInVR}`);
            break;
            
        case DeepLinkType.UserDetails:
            console.log(`Viewing user: ${parsed.params.id}`);
            break;
            
        case DeepLinkType.AvatarDetails:
            console.log(`Viewing avatar: ${parsed.params.id}`);
            break;
            
        case DeepLinkType.WorldDetails:
            console.log(`Viewing world: ${parsed.params.id}`);
            break;
            
        case DeepLinkType.PropDetails:
            console.log(`Viewing prop: ${parsed.params.id}`);
            break;
            
        case DeepLinkType.InstanceDetails:
            console.log(`Viewing instance details: ${parsed.params.id}`);
            break;
            
        default:
            console.error('Unknown deep link type');
            return false;
    }
    
    // Open the deep link
    const success = await openDeepLink(userInput);
    if (success) {
        console.log('Deep link opened successfully!');
    } else {
        console.error('Failed to open deep link');
    }
    
    return success;
}

// Example integration with CVRX details system
function integrateWithCVRXDetails() {
    console.log('\n=== CVRX Integration Examples ===');
    
    // Example: Add deep link buttons to entity details
    function addDeepLinkButtonsToEntityDetails(entityType, entityId) {
        let deepLink;
        let buttonText;
        
        switch (entityType) {
            case 'user':
                deepLink = generateUserDetailsLink(entityId);
                buttonText = 'Open in ChilloutVR';
                break;
                
            case 'avatar':
                deepLink = generateAvatarDetailsLink(entityId);
                buttonText = 'View Avatar in CVR';
                break;
                
            case 'world':
                deepLink = generateWorldDetailsLink(entityId);
                buttonText = 'View World in CVR';
                break;
                
            case 'prop':
                deepLink = generatePropDetailsLink(entityId);
                buttonText = 'View Prop in CVR';
                break;
                
            case 'instance':
                // For instances, we might want both join and details buttons
                const joinLink = generateInstanceJoinLink(entityId.replace('i+', ''), false);
                const detailsLink = generateInstanceDetailsLink(entityId.replace('i+', ''));
                
                const joinButton = createDeepLinkButton(joinLink, 'Join Instance', {
                    className: 'instance-join-button'
                });
                
                const detailsButton = createDeepLinkButton(detailsLink, 'Instance Details', {
                    className: 'instance-details-button'
                });
                
                return { joinButton, detailsButton };
                
            default:
                console.error('Unknown entity type:', entityType);
                return null;
        }
        
        if (deepLink) {
            const openButton = createDeepLinkButton(deepLink, buttonText, {
                className: `${entityType}-deeplink-button`
            });
            
            const copyButton = createCopyLinkButton(deepLink, 'Copy Link', {
                className: `${entityType}-copy-button`
            });
            
            return { openButton, copyButton };
        }
        
        return null;
    }
    
    // Example usage
    const userButtons = addDeepLinkButtonsToEntityDetails('user', 'usr_12345');
    const worldButtons = addDeepLinkButtonsToEntityDetails('world', 'wrld_abcde');
    const instanceButtons = addDeepLinkButtonsToEntityDetails('instance', 'i+12345');
    
    console.log('Created buttons for user, world, and instance entities');
    
    return { userButtons, worldButtons, instanceButtons };
}

// ===========
// EXPORTS FOR TESTING
// ===========

export {
    demonstrateDeepLinkGeneration,
    demonstrateDeepLinkParsing,
    createDeepLinkButtons,
    handleUserDeepLink,
    integrateWithCVRXDetails
}; 