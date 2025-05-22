// =======
// MODULES
// =======

import { pushToast } from './astrolib/toasty_notifications.js';
import { applyTooltips } from './astrolib/tooltip.js';

// ===========
// GLOBAL VARS
// ===========

// Cache for friend images to prevent losing loaded images on refresh
const friendImageCache = {};

const DetailsType = Object.freeze({
    User: Symbol('user'),
    Avatar: Symbol('avatar'),
    Prop: Symbol('prop'),
    World: Symbol('world'),
    Instance: Symbol('instance'),
});

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
            hideAllSearchCategories();
            document.querySelector('.search-status').classList.remove('hidden');
            document.querySelector('.search-no-results').classList.add('hidden');
            document.querySelector('.search-loading').classList.add('hidden');
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

// Simple markdown parser for changelog formatting
function parseMarkdown(text) {
    if (!text) return '';

    // Helper function to escape HTML
    const escapeHtml = (unsafe) => {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // Helper function to process inline formatting
    const processInlineFormatting = (content) => {
        // First escape any raw HTML in the content
        let processed = escapeHtml(content);

        // Then apply markdown formatting
        return processed
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            // Strikethrough
            .replace(/~~(.+?)~~/g, '<del>$1</del>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Links - we need to unescape the URL part
            .replace(/\[(.+?)\]\((.+?)\)/g, (match, text, url) => {
                const unescapedUrl = url
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#039;/g, '\'');
                return `<a href="${unescapedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            });
    };

    // Split into lines for processing
    const lines = text.split('\n');
    let output = [];
    let inCodeBlock = false;
    let inList = false;
    let listType = '';
    let listIndent = 0;
    let inBlockquote = false;
    let blockquoteContent = [];
    let lastWasHeader = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmedLine = line.trim();

        // Handle code blocks
        if (trimmedLine.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                // Get language if specified
                const language = trimmedLine.slice(3).trim();
                output.push(`<pre><code class="language-${language}">`);
            } else {
                inCodeBlock = false;
                output.push('</code></pre>');
            }
            lastWasHeader = false;
            continue;
        }

        if (inCodeBlock) {
            output.push(escapeHtml(line));
            continue;
        }

        // Handle blockquotes
        if (trimmedLine.startsWith('>')) {
            if (!inBlockquote) {
                inBlockquote = true;
                blockquoteContent = [];
            }
            blockquoteContent.push(trimmedLine.slice(1).trim());
            lastWasHeader = false;
            continue;
        } else if (inBlockquote) {
            inBlockquote = false;
            output.push(`<blockquote>${processInlineFormatting(blockquoteContent.join('\n'))}</blockquote>`);
        }

        // Handle headers
        const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const content = headerMatch[2];
            // Add margin-top only if the previous element wasn't a header
            const marginTop = lastWasHeader ? '0' : '0.75em';
            output.push(`<h${level} style="margin-top: ${marginTop}; margin-bottom: 0.15em;">${processInlineFormatting(content)}</h${level}>`);
            lastWasHeader = true;
            continue;
        }
        lastWasHeader = false;

        // Handle horizontal rules
        if (/^[-*_]{3,}$/.test(trimmedLine)) {
            output.push('<hr>');
            continue;
        }

        // Handle lists
        const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
        if (listMatch) {
            const [, indent, marker, content] = listMatch;
            const currentIndent = indent.length;
            const isOrdered = /^\d+\.$/.test(marker);

            if (!inList || currentIndent !== listIndent) {
                if (inList) {
                    output.push(`</${listType}>`);
                }
                inList = true;
                listType = isOrdered ? 'ol' : 'ul';
                listIndent = currentIndent;
                output.push(`<${listType}>`);
            }

            const processedContent = processInlineFormatting(content);
            output.push(`<li>${processedContent}</li>`);
            continue;
        } else if (inList) {
            inList = false;
            output.push(`</${listType}>`);
        }

        // Handle task lists
        if (trimmedLine.match(/^[-*+]\s+\[([ x])\]\s+(.+)$/i)) {
            const [, checked, content] = trimmedLine.match(/^[-*+]\s+\[([ x])\]\s+(.+)$/i);
            const processedContent = processInlineFormatting(content);
            output.push(`<div class="task-list-item"><input type="checkbox" ${checked === 'x' ? 'checked' : ''} disabled> ${processedContent}</div>`);
            continue;
        }

        // Handle paragraphs
        if (trimmedLine) {
            output.push(`<p style="margin: 0.25em 0;">${processInlineFormatting(trimmedLine)}</p>`);
        } else {
            output.push('<br>');
        }
    }

    // Close any open blocks
    if (inList) {
        output.push(`</${listType}>`);
    }
    if (inBlockquote) {
        output.push(`<blockquote>${processInlineFormatting(blockquoteContent.join('\n'))}</blockquote>`);
    }
    if (inCodeBlock) {
        output.push('</code></pre>');
    }

    // Clean up empty paragraphs and fix nested lists
    let result = output.join('\n')
        .replace(/<p><\/p>/g, '')
        .replace(/<\/ul>\s*<ul>/g, '')
        .replace(/<\/ol>\s*<ol>/g, '')
        .replace(/<br>\n{2,}/g, '<br>\n')
        .replace(/\n{2,}<br>/g, '\n<br>')
        .replace(/\n{3,}/g, '\n\n');

    return result;
}

// Update prompt using the new modal system
function promptUpdate(updateInfo) {
    const promptShade = document.querySelector('.prompt-layer');
    const newPrompt = createElement('div', { className: 'prompt' });
    const promptTitle = createElement('div', { className: 'prompt-title', textContent: 'Update Available' });
    const promptText = createElement('div', {
        className: 'prompt-text',
        innerHTML: `A new version (${updateInfo.tagName}) of CVRX is available!<br><br>Here are the changes:<br><br>${parseMarkdown(updateInfo.changeLogs)}`,
    });
    const promptButtons = createElement('div', { className: 'prompt-buttons' });

    const downloadButton = createElement('button', {
        id: 'prompt-confirm',
        className: 'update-primary-action',
        textContent: 'Download and Install',
        onClick: async () => {
            try {
                await window.API.updateAction('download', updateInfo);
                newPrompt.remove();
                promptShade.style.display = 'none';
            } catch (error) {
                pushToast('Failed to download update', 'error');
            }
        },
    });

    const askLaterButton = createElement('button', {
        id: 'prompt-cancel',
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
        id: 'prompt-cancel',
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
        id: 'prompt-cancel',
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

window.API.onHomePage((_event) => swapNavPages('home'));


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

    // Set profile picture for profile navbar button
    const profileButton = document.querySelector('.profile-navbar-button');
    if (profileButton) {
        profileButton.setAttribute('data-hash', activeUser.imageHash);
        profileButton.style.backgroundImage = 'url(img/ui/placeholder.png)';
        profileButton.onclick = () => ShowDetails(DetailsType.User, activeUser.id);
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
    let detailsTabs = document.querySelector('.details-tabs');
    let detailsContent = document.querySelector('.details-content');
    let detailsGroup = document.querySelector('.details-window--group');

    let entityInfo;

    // Show the details window
    const detailsShade = document.querySelector('.details-shade');
    detailsShade.style.display = 'flex';

    // Handle clicking outside to close
    detailsShade.onclick = (event) => {
        if (event.target === detailsShade) {
            detailsShade.style.display = 'none';
        }
    };

    // Hide tabs and content by default
    detailsTabs.style.display = 'none';
    detailsContent.style.display = 'none';

    switch (entityType) {
        case DetailsType.User: {
            entityInfo = await window.API.getUserById(entityId);
            detailsName.innerHTML = `${entityInfo.name}`;
            detailsImg.src = 'img/ui/placeholder.png';
            detailsImg.dataset.hash = entityInfo.imageHash;
            detailsAvatar.innerHTML = `<img data-hash="${entityInfo.avatar.imageHash}">${entityInfo.avatar.name}`;
            const userDetailsAvatar = document.querySelector('.user-details-avatar');
            userDetailsAvatar.classList.remove('hidden');
            userDetailsAvatar.onclick = () => ShowDetails(DetailsType.Avatar, entityInfo.avatar.id);
            detailsBadge.innerHTML = `<img data-hash="${entityInfo.featuredBadge.imageHash}">${entityInfo.featuredBadge.name}`;
            detailsRank.innerHTML = `<img src="img/ui/rank.png">${entityInfo.rank}`;
            detailsGroup.innerHTML = `<img data-hash="${entityInfo.featuredGroup.imageHash}">${entityInfo.featuredGroup.name}`;

            // Show tabs and content for user details
            detailsTabs.style.display = 'flex';
            detailsContent.style.display = 'block';

            // Add friend management button
            const detailsHeader = document.querySelector('.details-header');
            // Remove any existing button container
            const existingButtonContainer = detailsHeader.querySelector('.user-details-button-container');
            if (existingButtonContainer) {
                existingButtonContainer.remove();
            }

            // Create button container
            const buttonContainer = createElement('div', {
                className: 'user-details-button-container',
            });

            // Friend action button
            const friendActionButton = createElement('button', {
                className: 'user-details-action-button',
                innerHTML: `<span class="material-symbols-outlined">${entityInfo.isFriend ? 'person_remove' : 'person_add'}</span>${entityInfo.isFriend ? 'Remove Friend' : 'Send Friend Request'}`,
                tooltip: entityInfo.isFriend ? 'Remove Friend' : 'Send Friend Request',
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
                            id: 'prompt-confirm',
                            textContent: 'Remove Friend',
                            onClick: async () => {
                                try {
                                    await window.API.unfriend(entityId);
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
                            id: 'prompt-cancel',
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
                            await window.API.sendFriendRequest(entityId);
                            pushToast(`Friend request sent to ${entityInfo.name}`, 'confirm');
                            // Update button state to show request sent
                            friendActionButton.innerHTML = `<span class="material-symbols-outlined">hourglass_empty</span>Request Sent`;
                            friendActionButton.tooltip = 'Friend Request Sent';
                            friendActionButton.disabled = true;
                            friendActionButton.classList.add('disabled');
                        } catch (error) {
                            pushToast('Failed to send friend request', 'error');
                        }
                    }
                },
            });

            // Categories button
            const categoriesButton = createElement('button', {
                className: 'user-details-action-button',
                innerHTML: '<span class="material-symbols-outlined">category</span>Categories',
                tooltip: 'View User Categories',
                onClick: () => {
                    // TODO: Implement categories view
                    pushToast('Categories feature coming soon!', 'info');
                },
            });

            // Block/Unblock button
            const blockButton = createElement('button', {
                className: 'user-details-action-button',
                innerHTML: `<span class="material-symbols-outlined">${entityInfo.isBlocked ? 'block' : 'no_accounts'}</span>${entityInfo.isBlocked ? 'Unblock User' : 'Block User'}`,
                tooltip: entityInfo.isBlocked ? 'Unblock User' : 'Block User',
                onClick: async () => {
                    if (entityInfo.isBlocked) {
                        try {
                            await window.API.unblockUser(entityId);
                            pushToast(`Unblocked ${entityInfo.name}`, 'confirm');
                            blockButton.innerHTML = `<span class="material-symbols-outlined">no_accounts</span>Block User`;
                            blockButton.tooltip = 'Block User';
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
                            id: 'prompt-confirm',
                            textContent: 'Block User',
                            onClick: async () => {
                                try {
                                    await window.API.blockUser(entityId);
                                    pushToast(`Blocked ${entityInfo.name}`, 'confirm');
                                    blockButton.innerHTML = `<span class="material-symbols-outlined">block</span>Unblock User`;
                                    blockButton.tooltip = 'Unblock User';
                                    entityInfo.isBlocked = true;
                                    confirmPrompt.remove();
                                    confirmShade.style.display = 'none';
                                } catch (error) {
                                    pushToast('Failed to block user', 'error');
                                }
                            },
                        });

                        const cancelButton = createElement('button', {
                            id: 'prompt-cancel',
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
            buttonContainer.append(friendActionButton, categoriesButton, blockButton);

            // Add the button container to the header
            detailsHeader.appendChild(buttonContainer);

            // Set up tab switching
            const tabs = document.querySelectorAll('.details-tab');

            // Remove any existing click handlers
            tabs.forEach(tab => {
                const newTab = tab.cloneNode(true);
                tab.parentNode.replaceChild(newTab, tab);
            });

            // Add click handlers to new tabs
            document.querySelectorAll('.user-details-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    // Remove active class from all tabs and panes
                    document.querySelectorAll('.user-details-tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.user-details-tab-pane').forEach(p => p.classList.remove('active'));

                    // Add active class to clicked tab and corresponding pane
                    tab.classList.add('active');
                    document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');

                    // Load content for the selected tab
                    loadTabContent(tab.dataset.tab, entityId);
                });
            });

            // Reset all tabs to inactive state
            document.querySelectorAll('.user-details-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.user-details-tab-pane').forEach(p => p.classList.remove('active'));

            // Set Avatars tab as active
            const avatarsTab = document.querySelector('.user-details-tab[data-tab="avatars"]');
            const avatarsPane = document.getElementById('avatars-tab');
            if (avatarsTab && avatarsPane) {
                avatarsTab.classList.add('active');
                avatarsPane.classList.add('active');
            }

            // Load initial tab content (always Avatars)
            loadTabContent('avatars', entityId);
            break;
        }
        case DetailsType.Avatar: {
            entityInfo = await window.API.getAvatarById(entityId);
            detailsName.innerHTML = `${entityInfo.name}`;
            detailsImg.src = 'img/ui/placeholder.png';
            detailsImg.dataset.hash = entityInfo.imageHash;
            detailsAvatar.innerHTML = `<img data-hash="${entityInfo.imageHash}">Avatar`;
            document.querySelector('.user-details-avatar').classList.add('hidden');
            detailsBadge.innerHTML = '';
            detailsRank.innerHTML = '';
            detailsGroup.innerHTML = '';
            // Remove any existing button container
            const detailsHeader = document.querySelector('.details-header');
            const existingButtonContainer = detailsHeader.querySelector('.user-details-button-container');
            if (existingButtonContainer) {
                existingButtonContainer.remove();
            }
            break;
        }
        case DetailsType.Prop: {
            entityInfo = await window.API.getPropById(entityId);
            detailsName.innerHTML = `${entityInfo.name}`;
            detailsImg.src = 'img/ui/placeholder.png';
            detailsImg.dataset.hash = entityInfo.imageHash;
            detailsAvatar.innerHTML = `<img data-hash="${entityInfo.imageHash}">Prop`;
            document.querySelector('.user-details-avatar').classList.add('hidden');
            detailsBadge.innerHTML = '';
            detailsRank.innerHTML = '';
            detailsGroup.innerHTML = '';
            // Remove any existing button container
            const detailsHeader = document.querySelector('.details-header');
            const existingButtonContainer = detailsHeader.querySelector('.user-details-button-container');
            if (existingButtonContainer) {
                existingButtonContainer.remove();
            }
            break;
        }
        case DetailsType.World: {
            entityInfo = await window.API.getWorldById(entityId);
            detailsName.innerHTML = `${entityInfo.name}`;
            detailsImg.src = 'img/ui/placeholder.png';
            detailsImg.dataset.hash = entityInfo.imageHash;
            detailsAvatar.innerHTML = `<img data-hash="${entityInfo.imageHash}">World`;
            document.querySelector('.user-details-avatar').classList.add('hidden');
            detailsBadge.innerHTML = '';
            detailsRank.innerHTML = '';
            detailsGroup.innerHTML = '';
            // Remove any existing button container
            const detailsHeader = document.querySelector('.details-header');
            const existingButtonContainer = detailsHeader.querySelector('.user-details-button-container');
            if (existingButtonContainer) {
                existingButtonContainer.remove();
            }
            break;
        }
        case DetailsType.Instance: {
            entityInfo = await window.API.getInstanceById(entityId);
            detailsName.innerHTML = `${entityInfo.name}`;
            detailsImg.src = 'img/ui/placeholder.png';
            detailsImg.dataset.hash = entityInfo.imageHash;
            detailsAvatar.innerHTML = `<img data-hash="${entityInfo.imageHash}">Instance`;
            document.querySelector('.user-details-avatar').classList.add('hidden');
            detailsBadge.innerHTML = '';
            detailsRank.innerHTML = '';
            detailsGroup.innerHTML = '';
            // Remove any existing button container
            const detailsHeader = document.querySelector('.details-header');
            const existingButtonContainer = detailsHeader.querySelector('.user-details-button-container');
            if (existingButtonContainer) {
                existingButtonContainer.remove();
            }
            break;
        }
    }
}

// Function to load content for each tab
async function loadTabContent(tab, userId) {
    const grid = document.querySelector(`#${tab}-tab .user-details-grid`);
    if (!grid) return;

    grid.innerHTML = '<div class="loading-indicator">Loading...</div>';

    try {
        let items = [];
        switch (tab) {
            case 'avatars':
                items = await window.API.getUserPublicAvatars(userId);
                break;
            case 'props':
                items = await window.API.getUserPublicProps(userId);
                break;
            case 'worlds':
                items = await window.API.getUserPublicWorlds(userId);
                break;
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
            }

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
                            ShowDetails(DetailsType.Avatar, item.id);
                            break;
                        case 'props':
                            ShowDetails(DetailsType.Prop, item.id);
                            break;
                        case 'worlds':
                            ShowDetails(DetailsType.World, item.id);
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
        });
    } catch (error) {
        grid.innerHTML = `<div class="error-message">Error loading ${tab}</div>`;
        console.error(`Error loading ${tab}:`, error);
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
            onClick: () => ShowDetails(DetailsType.User, friend.id),
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
});

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
                    searchResult.onclick = () => ShowDetails(DetailsType.User, result.id);
                    userResults.push(searchResult);
                    break;
                case 'world':
                    searchResult.onclick = () => ShowDetails(DetailsType.World, result.id);
                    worldsResults.push(searchResult);
                    break;
                case 'avatar':
                    searchResult.onclick = () => ShowDetails(DetailsType.Avatar, result.id);
                    avatarResults.push(searchResult);
                    break;
                case 'prop':
                    searchResult.onclick = () => ShowDetails(DetailsType.Prop, result.id);
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

// Janky Active Instances
// -----------------------------
window.API.onActiveInstancesUpdate((_event, activeInstances) => {
    const homeActivity = document.querySelector('.home-activity--activity-wrapper');

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

// Add friends filter controls
let currentFilter = 'all';
const filterButtons = document.querySelectorAll('.filter-button');
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update active state
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update current filter
        currentFilter = button.dataset.filter;

        // Apply filter
        const friendsList = document.querySelector('.friends-wrapper');
        const friendNodes = friendsList.querySelectorAll('.friend-list-node');

        // Filter based on online status
        friendNodes.forEach(friend => {
            const isOnline = !friend.querySelector('.status-indicator').classList.contains('offline');
            switch (currentFilter) {
                case 'online':
                    friend.style.display = isOnline ? '' : 'none';
                    break;
                default:
                    friend.style.display = '';
            }
        });
    });
});

// Avatars filtering :O
addFilterListener('#avatars-filter', '.avatars-wrapper--avatars-node', '.card-name');
// Worlds filtering :)
addFilterListener('#worlds-filter', '.worlds-wrapper--worlds-node', '.card-name');
// Props filtering :P
addFilterListener('#props-filter', '.props-wrapper--props-node', '.card-name');


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
                    <p class="card-description">${ourAvatar.description || ''}</p>
                    <div class="card-detail">
                        <span class="material-symbols-outlined">emoji_people</span>Avatar
                    </div>
                </div>
            `,
            onClick: () => ShowDetails(DetailsType.Avatar, ourAvatar.id),
        });

        // Set placeholder background image and data-hash directly on the container
        const thumbnailContainer = avatarNode.querySelector('.thumbnail-container');
        thumbnailContainer.style.backgroundImage = `url('${imgSrc}')`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.dataset.hash = ourAvatar.imageHash;

        docFragment.appendChild(avatarNode);
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
    const reloadPropsButton = document.querySelector('#props-refresh');
    reloadPropsButton.addEventListener('click', () => window.API.refreshGetActiveUserProps());

    for (const ourProp of ourProps) {
        // Ignore props that are not our own
        if (!ourProp.categories.includes(PropCategories.Mine)) continue;

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
                    <p class="card-description">${ourProp.description || ''}</p>
                    <div class="card-detail">
                        <span class="material-symbols-outlined">view_in_ar</span>Prop
                    </div>
                </div>
            `,
            onClick: () => ShowDetails(DetailsType.Prop, ourProp.id),
        });

        // Set placeholder background image and data-hash directly on the container
        const thumbnailContainer = propNode.querySelector('.thumbnail-container');
        thumbnailContainer.style.backgroundImage = `url('${imgSrc}')`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.dataset.hash = ourProp.imageHash;

        docFragment.appendChild(propNode);
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
    const reloadWorldsButton = document.querySelector('#worlds-refresh');
    reloadWorldsButton.addEventListener('click', () => window.API.refreshGetActiveUserWorlds());

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
            onClick: () => ShowDetails(DetailsType.World, ourWorld.id),
        });

        // Set placeholder background image and data-hash directly on the container
        const thumbnailContainer = worldNode.querySelector('.thumbnail-container');
        thumbnailContainer.style.backgroundImage = `url('${imgSrc}')`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.dataset.hash = ourWorld.imageHash;

        docFragment.appendChild(worldNode);
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

// Load initial setting from config
window.API.getConfig().then(config => {
    if (config && config.CloseToSystemTray !== undefined) {
        closeToTrayCheckbox.checked = config.CloseToSystemTray;
    }
});

// Update config when setting is changed
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
