// =======
// SHARES MODULE
// =======

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';

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

// Helper function to determine content type from container class
function getContentTypeFromContainer(container) {
    // Try multiple approaches to detect content type
    
    // Method 1: Check parent tab pane classes
    const tabPane = container.closest('.details-tab-pane');
    if (tabPane) {
        if (tabPane.classList.contains('avatar-details-tab-pane')) {
            return 'avatar';
        } else if (tabPane.classList.contains('prop-details-tab-pane')) {
            return 'prop';
        }
    }
    
    // Method 2: Check details window classes
    const detailsWindow = container.closest('.details-window');
    if (detailsWindow) {
        if (detailsWindow.classList.contains('avatar-details-window')) {
            return 'avatar';
        } else if (detailsWindow.classList.contains('prop-details-window')) {
            return 'prop';
        }
    }
    
    // Method 3: Check for entity-specific header classes
    const headerContent = document.querySelector('.details-header-content');
    if (headerContent) {
        // Check for button containers that indicate the type
        if (document.querySelector('.avatar-details-button-container')) {
            return 'avatar';
        } else if (document.querySelector('.prop-details-button-container')) {
            return 'prop';
        }
    }
    
    // Method 4: Check tab classes for context
    const activeTab = document.querySelector('.details-tab.active[data-tab="shares"]');
    if (activeTab) {
        if (activeTab.classList.contains('avatar-details-tab')) {
            return 'avatar';
        } else if (activeTab.classList.contains('prop-details-tab')) {
            return 'prop';
        }
    }
    
    console.error('Could not determine content type. Container:', container);
    console.error('Tab pane:', tabPane);
    console.error('Details window:', detailsWindow);
    console.error('Header content:', headerContent);
    console.error('Active tab:', activeTab);
    
    return null;
}

// Helper function to get appropriate API functions based on content type
function getSharesAPIFunctions(contentType) {
    switch (contentType) {
        case 'avatar':
            return {
                getShares: window.API.getAvatarShares,
                addShare: window.API.addAvatarShares,
                removeShare: window.API.removeAvatarShares
            };
        case 'prop':
            return {
                getShares: window.API.getPropShares,
                addShare: window.API.addPropShares,
                removeShare: window.API.removePropShares
            };
        default:
            return null;
    }
}

// ===========
// SHARE CARD CREATION
// ===========

// Create a regular share card for an existing user share
function createShareCard(user, onRemove, createElement) {
    // Handle both imageHash (processed) and image (original URL) properties
    const imageHash = user.imageHash || '';
    
    const card = createElement('div', {
        className: 'share-card card-node',
        innerHTML: `
            <div class="thumbnail-container">
                <img src="img/ui/placeholder.png" data-hash="${imageHash}" class="hidden"/>
                <div class="share-card-overlay">
                    <div class="share-remove-text">
                        <span class="material-symbols-outlined">person_remove</span>
                        Remove Share
                    </div>
                </div>
            </div>
            <div class="card-content">
                <p class="card-name">${decodeHtmlEntities(user.name || 'Unknown User')}</p>
                <div class="card-detail">
                    <span class="material-symbols-outlined">share</span>Shared
                </div>
            </div>
        `
    });

    // Set up background image
    const thumbnailContainer = card.querySelector('.thumbnail-container');
    thumbnailContainer.style.backgroundImage = 'url(\'img/ui/placeholder.png\')';
    thumbnailContainer.style.backgroundSize = 'cover';
    thumbnailContainer.dataset.hash = imageHash;

    // Add click handler for removal
    card.addEventListener('click', () => {
        showRemoveShareConfirmation(user, onRemove, createElement);
    });

    return card;
}

// Create the "Add New Share" card
function createAddShareCard(onAdd, createElement) {
    const card = createElement('div', {
        className: 'add-share-card card-node',
        innerHTML: `
            <div class="add-share-content">
                <span class="material-symbols-outlined">add</span>
                <span class="add-share-text">Add New Share</span>
            </div>
        `
    });

    // Add click handler
    card.addEventListener('click', onAdd);

    return card;
}

// ===========
// MODALS
// ===========

// Show confirmation modal for removing a share
function showRemoveShareConfirmation(user, onConfirm, createElement) {
    const confirmShade = document.querySelector('.prompt-layer');
    const confirmPrompt = createElement('div', { className: 'prompt' });
    const confirmTitle = createElement('div', { className: 'prompt-title', textContent: 'Remove Share' });
    const confirmText = createElement('div', {
        className: 'prompt-text',
        textContent: `Are you sure you want to remove the share with ${user.name}? They will no longer have access to this content.`,
    });
    const confirmButtons = createElement('div', { className: 'prompt-buttons' });

    const confirmButton = createElement('button', {
        id: 'prompt-confirm',
        textContent: 'Remove Share',
        onClick: async () => {
            try {
                await onConfirm(user.id);
                confirmPrompt.remove();
                confirmShade.style.display = 'none';
            } catch (error) {
                console.error('Failed to remove share:', error);
                pushToast('Failed to remove share', 'error');
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

// Show modal for adding a new share with user search
function showAddShareModal(onAdd, createElement) {
    const modalShade = document.querySelector('.prompt-layer');
    const modal = createElement('div', { className: 'prompt shares-modal' });
    
    // Modal title
    const modalTitle = createElement('div', { 
        className: 'prompt-title', 
        textContent: 'Add New Share' 
    });
    
    // Modal content
    const modalContent = createElement('div', { className: 'prompt-text' });
    
    // Instructions
    const instructions = createElement('p', {
        textContent: 'Search for a user to share this content with:',
        className: 'shares-instructions'
    });
    modalContent.appendChild(instructions);
    
    // Search input
    const searchContainer = createElement('div', { className: 'shares-search-container' });
    const searchInput = createElement('input', {
        type: 'text',
        placeholder: 'Type username to search...',
        className: 'shares-search-input'
    });
    searchContainer.appendChild(searchInput);
    modalContent.appendChild(searchContainer);
    
    // Search results container
    const resultsContainer = createElement('div', { className: 'shares-search-results' });
    const resultsStatus = createElement('div', { 
        className: 'shares-search-status',
        textContent: 'Enter at least 3 characters to search for users'
    });
    resultsContainer.appendChild(resultsStatus);
    modalContent.appendChild(resultsContainer);
    
    // Modal buttons
    const modalButtons = createElement('div', { className: 'prompt-buttons' });
    
    const cancelButton = createElement('button', {
        id: 'prompt-cancel',
        textContent: 'Cancel',
        onClick: () => {
            modal.remove();
            modalShade.style.display = 'none';
        },
    });
    
    modalButtons.appendChild(cancelButton);
    modal.append(modalTitle, modalContent, modalButtons);
    modalShade.append(modal);
    modalShade.style.display = 'flex';
    
    // Set up search functionality
    setupShareSearch(searchInput, resultsContainer, resultsStatus, onAdd, modal, modalShade, createElement);
    
    // Focus the search input
    setTimeout(() => searchInput.focus(), 100);
}

// Set up search functionality for the add share modal
function setupShareSearch(searchInput, resultsContainer, resultsStatus, onAdd, modal, modalShade, createElement) {
    let searchTimeout;
    let isSearching = false;
    
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.trim();
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Clear results if search term is too short
        if (searchTerm.length < 3) {
            resultsStatus.textContent = 'Enter at least 3 characters to search for users';
            resultsStatus.style.display = 'block';
            clearSearchResults(resultsContainer, resultsStatus);
            return;
        }
        
        // Show searching status
        resultsStatus.textContent = 'Searching...';
        resultsStatus.style.display = 'block';
        clearSearchResults(resultsContainer, resultsStatus);
        isSearching = true;
        
        // Debounce search
        searchTimeout = setTimeout(async () => {
            try {
                const searchResults = await window.API.search(searchTerm);
                
                // Filter to only include users
                const userResults = searchResults.filter(result => result.type === 'user');
                
                if (!isSearching) return; // Search was cancelled
                
                // Clear status message
                resultsStatus.style.display = 'none';
                
                // Display results
                displaySearchResults(userResults, resultsContainer, resultsStatus, onAdd, modal, modalShade, createElement);
                
            } catch (error) {
                console.error('Search failed:', error);
                resultsStatus.textContent = 'Search failed. Please try again.';
                resultsStatus.style.display = 'block';
                clearSearchResults(resultsContainer, resultsStatus);
            } finally {
                isSearching = false;
            }
        }, 300);
    });
    
    // Handle Enter key for faster searching
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            // Clear timeout and search immediately
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            const searchTerm = searchInput.value.trim();
            if (searchTerm.length >= 3) {
                searchInput.dispatchEvent(new Event('input'));
            }
        }
    });
}

// Display search results in the modal
function displaySearchResults(userResults, resultsContainer, resultsStatus, onAdd, modal, modalShade, createElement) {
    // Clear existing results (except status)
    clearSearchResults(resultsContainer, resultsStatus);
    
    if (userResults.length === 0) {
        resultsStatus.textContent = 'No users found';
        resultsStatus.style.display = 'block';
        return;
    }
    
    // Create results grid
    const resultsGrid = createElement('div', { className: 'shares-search-results-grid' });
    
    userResults.forEach(user => {
        const userCard = createElement('div', {
            className: 'shares-search-result-card',
            innerHTML: `
                <div class="thumbnail-container">
                    <img src="img/ui/placeholder.png" data-hash="${user.imageHash || ''}" />
                </div>
                <div class="card-content">
                    <p class="card-name">${decodeHtmlEntities(user.name)}</p>
                    <div class="card-detail">
                        <span class="material-symbols-outlined">person_add</span>Add Share
                    </div>
                </div>
            `
        });
        
        // Set up the image hash for loading
        const img = userCard.querySelector('.thumbnail-container img');
        img.dataset.hash = user.imageHash || '';
        
        // Add click handler
        userCard.addEventListener('click', async () => {
            try {
                await onAdd(user.id, user.name);
                modal.remove();
                modalShade.style.display = 'none';
            } catch (error) {
                console.error('Failed to add share:', error);
                // Error handling is done in the onAdd callback
            }
        });
        
        resultsGrid.appendChild(userCard);
    });
    
    resultsContainer.appendChild(resultsGrid);
    
    // Apply tooltips to new elements
    applyTooltips();
}

// Clear search results
function clearSearchResults(resultsContainer, resultsStatus) {
    const children = Array.from(resultsContainer.children);
    children.forEach(child => {
        if (child !== resultsStatus) {
            child.remove();
        }
    });
}

// ===========
// MAIN SHARES FUNCTIONALITY
// ===========

// Load and display shares for a specific content item
export async function loadShares(contentId, createElement) {
    const sharesContainer = document.querySelector('#shares-tab .shares-container');
    if (!sharesContainer) return;
    
    // Determine content type from the DOM context
    const contentType = getContentTypeFromContainer(sharesContainer);
    if (!contentType) {
        console.error('Could not determine content type for shares');
        sharesContainer.innerHTML = '<div class="error-message">Error: Could not determine content type</div>';
        return;
    }
    
    // Get appropriate API functions
    const apiFunctions = getSharesAPIFunctions(contentType);
    if (!apiFunctions) {
        console.error('No API functions available for content type:', contentType);
        sharesContainer.innerHTML = '<div class="error-message">Error: API functions not available</div>';
        return;
    }
    
    // Show loading state
    sharesContainer.innerHTML = '<div class="loading-indicator">Loading shares...</div>';
    
    try {
        // Fetch shares from API
        console.log('Loading shares for contentId:', contentId, 'contentType:', contentType);
        const sharesResponse = await apiFunctions.getShares(contentId);
        console.log('Shares API response:', sharesResponse);
        
        // The backend now returns the shares array directly
        const shares = sharesResponse || [];
        console.log('Processed shares:', shares);
        
        // Ensure shares is an array
        const sharesArray = Array.isArray(shares) ? shares : [];
        console.log('Final shares array:', sharesArray);
        
        // Clear container
        sharesContainer.innerHTML = '';
        
        // Create shares grid
        const sharesGrid = createElement('div', { className: 'shares-grid' });
        
        // Add "Add New Share" card first
        const addShareCard = createAddShareCard(() => {
            showAddShareModal(async (userId, userName) => {
                try {
                    // Attempt to add the share
                    const result = await apiFunctions.addShare(contentId, userId);
                    
                    // Check if there's an error message in the response
                    if (result && result.message && result.message.trim() !== '') {
                        pushToast(result.message, 'error');
                        throw new Error(result.message);
                    }
                    
                    // Success - show toast and reload shares
                    pushToast(`Successfully shared with ${userName}`, 'confirm');
                    loadShares(contentId, createElement);
                } catch (error) {
                    console.error('Failed to add share:', error);
                    // Only show generic error if we haven't already shown a specific error message
                    if (!error.message || error.message.includes('Failed to')) {
                        pushToast('Failed to add share', 'error');
                    }
                    throw error; // Re-throw to be handled by the modal
                }
            }, createElement);
        }, createElement);
        
        sharesGrid.appendChild(addShareCard);
        
        // Add existing share cards
        sharesArray.forEach(share => {
            console.log('Creating share card for:', share);
            const shareCard = createShareCard(share, async (userId) => {
                try {
                    await apiFunctions.removeShare(contentId, userId);
                    pushToast(`Share removed successfully`, 'confirm');
                    loadShares(contentId, createElement);
                } catch (error) {
                    console.error('Failed to remove share:', error);
                    pushToast('Failed to remove share', 'error');
                    throw error;
                }
            }, createElement);
            
            sharesGrid.appendChild(shareCard);
        });
        
        sharesContainer.appendChild(sharesGrid);
        
        // Apply tooltips to new elements
        applyTooltips();
        
    } catch (error) {
        console.error('Error loading shares:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            contentId,
            contentType
        });
        sharesContainer.innerHTML = '<div class="error-message">Error loading shares</div>';
    }
}

// ===========
// EXPORTS
// ===========

export {
    getContentTypeFromContainer,
    getSharesAPIFunctions,
    createShareCard,
    createAddShareCard,
    showRemoveShareConfirmation,
    showAddShareModal
}; 