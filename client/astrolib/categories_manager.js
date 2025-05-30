// =======
// CATEGORIES MANAGER MODULE
// =======

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';

// ===========
// CONSTANTS
// ===========

const CategoryType = Object.freeze({
    Friends: 'friends',
    Avatars: 'avatars',
    Worlds: 'worlds',
    Props: 'spawnables'
});

// ===========
// STATE MANAGEMENT
// ===========

let currentCategoryType = CategoryType.Friends;
let categoriesData = {};
let originalCategoriesData = {};
let hasUnsavedChanges = false;

// ===========
// HELPER FUNCTIONS
// ===========

// Helper function to get user-defined categories (excluding system categories)
function getUserCategories(categoryType) {
    const categories = categoriesData[categoryType] || [];
    const systemCategories = {
        [CategoryType.Friends]: ['frndonline', 'frndoffline'],
        [CategoryType.Avatars]: ['avtrpublic', 'avtrshared', 'avtrmine', 'avtr_new', 'avtr_recently'],
        [CategoryType.Props]: ['proppublic', 'propmine', 'propshared', 'prop_new', 'prop_recently'],
        [CategoryType.Worlds]: ['wrldactive', 'wrldnew', 'wrldtrending', 'wrldofficial', 'wrldavatars', 'wrldpublic', 'wrldrecentlyupdated', 'wrldmine']
    };
    
    // Map category types to their expected prefixes for user-defined categories
    const categoryPrefixes = {
        [CategoryType.Friends]: 'friends_',
        [CategoryType.Avatars]: 'avatars_',
        [CategoryType.Worlds]: 'worlds_',
        [CategoryType.Props]: 'props_'
    };
    
    const expectedPrefix = categoryPrefixes[categoryType];
    
    const userDefinedCategories = categories.filter(category => 
        !systemCategories[categoryType].includes(category.id) &&
        category.id.startsWith(expectedPrefix)
    );
    
    console.log(`Server returned ${categoryType} categories in this order:`, userDefinedCategories.map(c => c.id));
    
    return userDefinedCategories;
}

// Helper function to create a draggable category item (simplified without rename functionality)
function createCategoryItem(category, index) {
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.draggable = true;
    categoryItem.dataset.categoryId = category.id;
    categoryItem.dataset.originalIndex = index;
    
    categoryItem.innerHTML = `
        <div class="category-drag-handle">
            <span class="material-symbols-outlined">drag_indicator</span>
        </div>
        <div class="category-content">
            <span class="category-name">${category.name}</span>
        </div>
        <div class="category-actions">
            <button class="category-delete-btn" data-tooltip="Delete Category">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `;
    
    // Add event listeners
    addCategoryItemEventListeners(categoryItem);
    
    return categoryItem;
}

// Helper function to create the "Add New Category" item
function createAddCategoryItem() {
    const addItem = document.createElement('div');
    addItem.className = 'category-item add-category-item';
    
    addItem.innerHTML = `
        <div class="add-category-content">
            <span class="material-symbols-outlined">add</span>
            <span class="add-category-text">Add New Category</span>
        </div>
    `;
    
    addItem.addEventListener('click', () => {
        showCreateCategoryDialog();
    });
    
    return addItem;
}

// Helper function to add event listeners to category items (simplified)
function addCategoryItemEventListeners(categoryItem) {
    const deleteBtn = categoryItem.querySelector('.category-delete-btn');
    
    // Handle delete button
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const categoryName = categoryItem.querySelector('.category-name').textContent;
        showDeleteCategoryDialog(categoryItem.dataset.categoryId, categoryName);
    });
    
    // Handle drag and drop
    categoryItem.addEventListener('dragstart', handleDragStart);
    categoryItem.addEventListener('dragover', handleDragOver);
    categoryItem.addEventListener('drop', handleDrop);
    categoryItem.addEventListener('dragend', handleDragEnd);
}

// ===========
// DRAG AND DROP HANDLERS
// ===========

let draggedElement = null;
let draggedIndex = null;

function handleDragStart(e) {
    draggedElement = e.target;
    draggedIndex = Array.from(draggedElement.parentNode.children).indexOf(draggedElement);
    e.dataTransfer.effectAllowed = 'move';
    draggedElement.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const item = e.target.closest('.category-item:not(.add-category-item)');
    if (item && item !== draggedElement) {
        const container = item.parentNode;
        const afterElement = getDragAfterElement(container, e.clientY);
        
        if (afterElement == null) {
            container.insertBefore(draggedElement, container.querySelector('.add-category-item'));
        } else {
            container.insertBefore(draggedElement, afterElement);
        }
    }
}

function handleDrop(e) {
    e.preventDefault();
    const newIndex = Array.from(draggedElement.parentNode.children).indexOf(draggedElement);
    
    if (newIndex !== draggedIndex) {
        // Mark as reordered and update button states
        markAsReordered();
        updateButtonStates();
    }
}

function handleDragEnd(e) {
    draggedElement.classList.remove('dragging');
    draggedElement = null;
    draggedIndex = null;
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.category-item:not(.dragging):not(.add-category-item)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ===========
// UI UPDATE FUNCTIONS
// ===========

function markAsReordered() {
    hasUnsavedChanges = true;
    const container = document.querySelector('.categories-list');
    container.classList.add('reordered');
}

function updateButtonStates() {
    const applyBtn = document.querySelector('.categories-apply-btn');
    const revertBtn = document.querySelector('.categories-revert-btn');
    
    const hasReorderedItems = document.querySelector('.categories-list.reordered') !== null;
    
    hasUnsavedChanges = hasReorderedItems;
    
    if (applyBtn && revertBtn) {
        applyBtn.disabled = !hasUnsavedChanges;
        revertBtn.disabled = !hasUnsavedChanges;
        
        if (hasUnsavedChanges) {
            applyBtn.classList.remove('disabled');
            revertBtn.classList.remove('disabled');
        } else {
            applyBtn.classList.add('disabled');
            revertBtn.classList.add('disabled');
        }
    }
}

// Helper function to load categories for the specified type
async function loadCategoriesForType(categoryType) {
    try {
        console.log('Loading categories for type:', categoryType);
        const allCategories = await window.API.getCategories();
        categoriesData = allCategories || {};
        originalCategoriesData = JSON.parse(JSON.stringify(categoriesData)); // Deep copy
        
        console.log('Loaded categories data:', categoriesData);
        renderCategoriesList(categoryType);
        updateButtonStates();
    } catch (error) {
        console.error('Failed to load categories:', error);
        pushToast('Failed to load categories', 'error');
    }
}

// Helper function to render the categories list
function renderCategoriesList(categoryType) {
    const container = document.querySelector('.categories-list');
    if (!container) return;
    
    container.innerHTML = '';
    container.classList.remove('reordered');
    
    const userCategories = getUserCategories(categoryType);
    console.log('User categories for', categoryType, ':', userCategories);
    
    if (userCategories.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'categories-empty-message';
        emptyMessage.innerHTML = `
            <span class="material-symbols-outlined">folder_open</span>
            <p>No custom categories yet</p>
            <small>Create your first category to organize your ${categoryType}</small>
        `;
        container.appendChild(emptyMessage);
    } else {
        userCategories.forEach((category, index) => {
            const categoryItem = createCategoryItem(category, index);
            container.appendChild(categoryItem);
        });
    }
    
    // Always add the "Add New Category" item at the end
    const addItem = createAddCategoryItem();
    container.appendChild(addItem);
    
    hasUnsavedChanges = false;
}

// ===========
// DIALOG FUNCTIONS
// ===========

function showCreateCategoryDialog() {
    const modalShade = document.querySelector('.prompt-layer');
    const modal = document.createElement('div');
    modal.className = 'prompt';
    
    const modalTitle = document.createElement('div');
    modalTitle.className = 'prompt-title';
    modalTitle.textContent = `Create New ${currentCategoryType.charAt(0).toUpperCase() + currentCategoryType.slice(1, -1)} Category`;
    
    const modalContent = document.createElement('div');
    modalContent.className = 'prompt-text';
    modalContent.innerHTML = `
        <p>Enter a name for your new category:</p>
        <input type="text" id="new-category-name" placeholder="Category name" maxlength="50" style="width: 100%; padding: 8px; margin-top: 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-background); color: var(--color-text);">
    `;
    
    const modalButtons = document.createElement('div');
    modalButtons.className = 'prompt-buttons';
    
    const createButton = document.createElement('button');
    createButton.id = 'prompt-confirm';
    createButton.textContent = 'Create';
    createButton.addEventListener('click', async () => {
        const nameInput = modal.querySelector('#new-category-name');
        const categoryName = nameInput.value.trim();
        
        if (!categoryName) {
            pushToast('Category name cannot be empty', 'error');
            return;
        }
        
        try {
            console.log('Creating category:', categoryName, 'for type:', currentCategoryType);
            
            // Call the appropriate API function based on category type
            const apiFunction = getCreateCategoryAPIFunction(currentCategoryType);
            const result = await apiFunction(categoryName);
            
            console.log('Create category result:', result);
            pushToast(`Created category "${categoryName}"`, 'confirm');
            
            // Reload categories to reflect the change
            await loadCategoriesForType(currentCategoryType);
            
            modal.remove();
            modalShade.style.display = 'none';
        } catch (error) {
            console.error('Failed to create category:', error);
            pushToast(`Failed to create category: ${error.message || error}`, 'error');
        }
    });
    
    const cancelButton = document.createElement('button');
    cancelButton.id = 'prompt-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
        modal.remove();
        modalShade.style.display = 'none';
    });
    
    modalButtons.append(createButton, cancelButton);
    modal.append(modalTitle, modalContent, modalButtons);
    modalShade.append(modal);
    modalShade.style.display = 'flex';
    
    // Focus the input
    setTimeout(() => {
        const nameInput = modal.querySelector('#new-category-name');
        nameInput.focus();
    }, 100);
}

function showDeleteCategoryDialog(categoryId, categoryName) {
    const modalShade = document.querySelector('.prompt-layer');
    const modal = document.createElement('div');
    modal.className = 'prompt';
    
    const modalTitle = document.createElement('div');
    modalTitle.className = 'prompt-title';
    modalTitle.textContent = 'Delete Category';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'prompt-text';
    modalContent.innerHTML = `
        <p>Are you sure you want to delete the category <strong>"${categoryName}"</strong>?</p>
        <p><small>This action cannot be undone. Items in this category will not be deleted, but they will no longer be organized in this category.</small></p>
    `;
    
    const modalButtons = document.createElement('div');
    modalButtons.className = 'prompt-buttons';
    
    const deleteButton = document.createElement('button');
    deleteButton.id = 'prompt-confirm';
    deleteButton.textContent = 'Delete';
    deleteButton.style.backgroundColor = 'var(--button-reject-color)';
    deleteButton.addEventListener('click', async () => {
        try {
            console.log('Deleting category:', categoryId, 'for type:', currentCategoryType);
            
            // Call the appropriate API function based on category type
            const apiFunction = getDeleteCategoryAPIFunction(currentCategoryType);
            const result = await apiFunction(categoryId);
            
            console.log('Delete category result:', result);
            pushToast(`Deleted category "${categoryName}"`, 'confirm');
            
            // Reload categories to reflect the change
            await loadCategoriesForType(currentCategoryType);
            
            modal.remove();
            modalShade.style.display = 'none';
        } catch (error) {
            console.error('Failed to delete category:', error);
            pushToast(`Failed to delete category: ${error.message || error}`, 'error');
        }
    });
    
    const cancelButton = document.createElement('button');
    cancelButton.id = 'prompt-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
        modal.remove();
        modalShade.style.display = 'none';
    });
    
    modalButtons.append(deleteButton, cancelButton);
    modal.append(modalTitle, modalContent, modalButtons);
    modalShade.append(modal);
    modalShade.style.display = 'flex';
}

// ===========
// API FUNCTION HELPERS (CORRECTED)
// ===========

function getCreateCategoryAPIFunction(categoryType) {
    switch (categoryType) {
        case CategoryType.Friends: return window.API.createFriendCategory;
        case CategoryType.Avatars: return window.API.createAvatarCategory;
        case CategoryType.Props: return window.API.createPropCategory;
        case CategoryType.Worlds: return window.API.createWorldCategory;
        default: throw new Error(`Unknown category type: ${categoryType}`);
    }
}

function getDeleteCategoryAPIFunction(categoryType) {
    switch (categoryType) {
        case CategoryType.Friends: return window.API.deleteFriendCategory;
        case CategoryType.Avatars: return window.API.deleteAvatarCategory;
        case CategoryType.Props: return window.API.deletePropCategory;
        case CategoryType.Worlds: return window.API.deleteWorldCategory;
        default: throw new Error(`Unknown category type: ${categoryType}`);
    }
}

function getReorderCategoryAPIFunction(categoryType) {
    switch (categoryType) {
        case CategoryType.Friends: return window.API.reorderFriendCategories;
        case CategoryType.Avatars: return window.API.reorderAvatarCategories;
        case CategoryType.Props: return window.API.reorderPropCategories;
        case CategoryType.Worlds: return window.API.reorderWorldCategories;
        default: throw new Error(`Unknown category type: ${categoryType}`);
    }
}

// ===========
// APPLY/REVERT FUNCTIONS (SIMPLIFIED)
// ===========

async function applyChanges() {
    try {
        console.log('Applying category order changes for type:', currentCategoryType);
        
        const categoryItems = document.querySelectorAll('.category-item:not(.add-category-item)');
        const newOrderedCategoryIds = [];
        
        categoryItems.forEach(item => {
            const categoryId = item.dataset.categoryId;
            newOrderedCategoryIds.push(categoryId);
        });
        
        console.log('New category order being sent to API:', newOrderedCategoryIds);
        
        // Call the reorder API function with just the array of IDs
        const apiFunction = getReorderCategoryAPIFunction(currentCategoryType);
        const result = await apiFunction(newOrderedCategoryIds);
        
        console.log('Reorder categories API result:', result);
        pushToast('Categories reordered successfully', 'confirm');
        
        // Add a small delay to allow server-side processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reload to reflect changes
        console.log('Reloading categories from server...');
        await loadCategoriesForType(currentCategoryType);
        
    } catch (error) {
        console.error('Failed to apply changes:', error);
        pushToast(`Failed to apply changes: ${error.message || error}`, 'error');
    }
}

function revertChanges() {
    // Reload from original data
    categoriesData = JSON.parse(JSON.stringify(originalCategoriesData));
    renderCategoriesList(currentCategoryType);
    updateButtonStates();
    pushToast('Changes reverted', 'info');
}

// ===========
// MAIN CATEGORIES MANAGER FUNCTION
// ===========

export async function loadCategoriesManager() {
    const categoriesContainer = document.querySelector('#categories-tab .categories-container');
    if (!categoriesContainer) return;
    
    // Reset to Friends when loading the categories manager
    currentCategoryType = CategoryType.Friends;
    
    // Create the categories management interface (updated description)
    categoriesContainer.innerHTML = `
        <div class="categories-manager">
            <div class="categories-header">
                <h3>Manage Your Categories</h3>
                <p>Organize your favorites with custom categories. You can create, reorder, and delete categories.</p>
            </div>
            
            <div class="categories-subtabs">
                <button class="categories-subtab active" data-type="${CategoryType.Friends}">
                    <span class="material-symbols-outlined">group</span>
                    Friends
                </button>
                <button class="categories-subtab" data-type="${CategoryType.Avatars}">
                    <span class="material-symbols-outlined">emoji_people</span>
                    Avatars
                </button>
                <button class="categories-subtab" data-type="${CategoryType.Worlds}">
                    <span class="material-symbols-outlined">public</span>
                    Worlds
                </button>
                <button class="categories-subtab" data-type="${CategoryType.Props}">
                    <span class="material-symbols-outlined">view_in_ar</span>
                    Props
                </button>
            </div>
            
            <div class="categories-content">
                <div class="categories-list">
                    <!-- Categories will be loaded here -->
                </div>
                
                <div class="categories-actions">
                    <button class="categories-apply-btn disabled" disabled>
                        <span class="material-symbols-outlined">check</span>
                        Apply Changes
                    </button>
                    <button class="categories-revert-btn disabled" disabled>
                        <span class="material-symbols-outlined">undo</span>
                        Revert Changes
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add event listeners to subtabs
    const subtabs = categoriesContainer.querySelectorAll('.categories-subtab');
    subtabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            // Update active tab
            subtabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update current category type
            currentCategoryType = tab.dataset.type;
            
            // Load categories for the selected type
            await loadCategoriesForType(currentCategoryType);
        });
    });
    
    // Add event listeners to action buttons
    const applyBtn = categoriesContainer.querySelector('.categories-apply-btn');
    const revertBtn = categoriesContainer.querySelector('.categories-revert-btn');
    
    applyBtn.addEventListener('click', applyChanges);
    revertBtn.addEventListener('click', revertChanges);
    
    // Load initial categories (Friends by default)
    await loadCategoriesForType(currentCategoryType);
    
    // Apply tooltips to newly created elements
    applyTooltips();
} 