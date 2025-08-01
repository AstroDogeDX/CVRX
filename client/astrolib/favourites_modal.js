// =======
// FAVOURITES MODAL MODULE
// =======

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';
import { decodeHtmlEntities } from './details_constructor.js';

// Logging function to prevent memory leaking when bundled
let isPackaged = false;
window.API.isPackaged().then(packaged => {
    isPackaged = packaged;
});

const log = (msg) => {
    if (!isPackaged) console.log(msg);
};

// ===========
// HELPER FUNCTIONS
// ===========

// Helper function to create a checkbox element for a category
function createCategoryCheckbox(category, isChecked) {
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'favourites-category-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `category-${category.id}`;
    checkbox.value = category.id;
    checkbox.checked = isChecked;
    
    const label = document.createElement('label');
    label.htmlFor = `category-${category.id}`;
    label.textContent = decodeHtmlEntities(category.name);
    
    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);
    
    return checkboxContainer;
}

// Helper function to get entity type name
function getEntityTypeName(entityType) {
    switch (entityType) {
        case 'user': return 'User';
        case 'avatar': return 'Avatar';
        case 'prop': return 'Prop';
        case 'world': return 'World';
        default: return 'Item';
    }
}

// Helper function to get categories API function based on entity type
function getCategoriesAPIFunction(entityType) {
    switch (entityType) {
        case 'user': return window.API.setFriendCategories;
        case 'avatar': return window.API.setAvatarCategories;
        case 'prop': return window.API.setPropCategories;
        case 'world': return window.API.setWorldCategories;
        default: return null;
    }
}

// Helper function to get categories from the categories object based on entity type
function getCategoriesForEntityType(categories, entityType) {
    switch (entityType) {
        case 'user': return categories.friends || [];
        case 'avatar': return categories.avatars || [];
        case 'prop': return categories.spawnables || [];
        case 'world': return categories.worlds || [];
        default: return [];
    }
}

// ===========
// MAIN MODAL FUNCTION
// ===========

// Show the favourites modal for a specific entity
// entityType - The type of entity (user, avatar, prop, world)
// entityId - The ID of the entity
// entityName - The name of the entity for display
// currentCategories - Array of current category IDs the entity belongs to
// createElement - Helper function to create elements
// onSuccess - Optional callback to call after successful category update
export async function showFavouritesModal(entityType, entityId, entityName, currentCategories = [], createElement, onSuccess = null) {
    try {
        // Get all categories from the API
        const allCategories = await window.API.getCategories();
        const entityCategories = getCategoriesForEntityType(allCategories, entityType);
        
        // Filter out system categories that shouldn't be shown in the favourites modal
        const systemCategories = {
            'user': ['friends_online', 'friends_offline', 'Online Friends', 'Offline Friends'],
            'avatar': ['avtrpublic', 'avtrshared', 'avtrmine', 'avtr_new', 'avtr_recently'],
            'prop': ['proppublic', 'propmine', 'propshared', 'prop_new', 'prop_recently'],
            'world': ['wrldactive', 'wrldnew', 'wrldtrending', 'wrldofficial', 'wrldavatars', 'wrldpublic', 'wrldrecentlyupdated', 'wrldmine']
        };
        
        let userCategories;
        if (entityType === 'prop') {
            // For props, only show user-created categories (those starting with 'props_')
            userCategories = entityCategories.filter(category => 
                category.id.startsWith('props_')
            );
        } else {
            // For other entity types, use the existing logic
            userCategories = entityCategories.filter(category => 
                !systemCategories[entityType]?.includes(category.id) && 
                !systemCategories[entityType]?.includes(category.name)
            );
        }
        
        if (userCategories.length === 0) {
            pushToast(`No favourites categories available for ${getEntityTypeName(entityType).toLowerCase()}s. Create some categories first!`, 'info');
            return;
        }
        
        // Create modal elements
        const modalShade = document.querySelector('.prompt-layer');
        const modal = createElement('div', { className: 'prompt favourites-modal' });
        
        // Modal title
        const modalTitle = createElement('div', { 
            className: 'prompt-title', 
            textContent: `Add ${entityName} to Favourites` 
        });
        
        // Modal content
        const modalContent = createElement('div', { className: 'prompt-text' });
        
        // Instructions
        const instructions = createElement('p', {
            textContent: `Select the favourite categories you want to add this ${getEntityTypeName(entityType).toLowerCase()} to:`,
            className: 'favourites-instructions'
        });
        modalContent.appendChild(instructions);
        
        // Categories container
        const categoriesContainer = createElement('div', { className: 'favourites-categories-container' });
        
        // Create checkboxes for each category
        userCategories.forEach(category => {
            const isChecked = currentCategories.includes(category.id);
            const checkboxContainer = createCategoryCheckbox(category, isChecked);
            categoriesContainer.appendChild(checkboxContainer);
        });
        
        modalContent.appendChild(categoriesContainer);
        
        // Modal buttons
        const modalButtons = createElement('div', { className: 'prompt-buttons' });
        
        // Apply button
        const applyButton = createElement('button', {
            className: 'prompt-btn-confirm',
            textContent: 'Apply',
            onClick: async () => {
                try {
                    // Get selected categories
                    const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
                    const selectedCategories = Array.from(checkboxes)
                        .filter(checkbox => checkbox.checked)
                        .map(checkbox => checkbox.value);
                    
                    // Get the appropriate API function
                    const setCategoriesFunction = getCategoriesAPIFunction(entityType);
                    if (!setCategoriesFunction) {
                        throw new Error(`No API function available for entity type: ${entityType}`);
                    }
                    
                    // Call the API to update categories
                    await setCategoriesFunction(entityId, selectedCategories);
                    
                    // Show success message
                    if (selectedCategories.length > 0) {
                        pushToast(`Added ${entityName} to ${selectedCategories.length} favourite categor${selectedCategories.length === 1 ? 'y' : 'ies'}`, 'confirm');
                    } else {
                        pushToast(`Removed ${entityName} from all favourite categories`, 'confirm');
                    }
                    
                    // Close modal
                    modal.remove();
                    modalShade.style.display = 'none';
                    
                    // Call success callback if provided to trigger content refresh
                    if (onSuccess && typeof onSuccess === 'function') {
                        onSuccess(entityType, entityId);
                    }
                    
                } catch (error) {
                    log('Failed to update favourites:', error);
                    pushToast('Failed to update favourites', 'error');
                }
            }
        });
        
        // Cancel button
        const cancelButton = createElement('button', {
            className: 'prompt-btn-neutral',
            textContent: 'Cancel',
            onClick: () => {
                modal.remove();
                modalShade.style.display = 'none';
            }
        });
        
        modalButtons.append(applyButton, cancelButton);
        
        // Assemble modal
        modal.append(modalTitle, modalContent, modalButtons);
        modalShade.append(modal);
        modalShade.style.display = 'flex';
        
        // Apply tooltips to newly created elements
        applyTooltips();
        
    } catch (error) {
        log('Failed to show favourites modal:', error);
        pushToast('Failed to load favourites categories', 'error');
    }
} 