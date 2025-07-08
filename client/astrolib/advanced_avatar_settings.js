// =======
// ADVANCED AVATAR SETTINGS MODULE
// =======

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';

// Logging function to prevent memory leaking when bundled
let isPackaged = false;
window.API.isPackaged().then(packaged => {
    isPackaged = packaged;
});

const log = (msg) => {
    if (!isPackaged) console.log(msg);
};

// ===========
// STATE MANAGEMENT
// ===========

let currentSettings = null;
let originalSettings = null;
let hasUnsavedChanges = false;
let currentAvatarId = null;
let selectedParameters = new Set(); // Track selected parameter indices
let selectionMode = false; // Track if we're in selection mode

// ===========
// UTILITY FUNCTIONS
// ===========

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function areSettingsEqual(settings1, settings2) {
    return JSON.stringify(settings1) === JSON.stringify(settings2);
}

function markAsModified() {
    hasUnsavedChanges = true;
    updateActionButtons();
}

function updateActionButtons() {
    const saveBtn = document.querySelector('.aas-save-btn');
    const revertBtn = document.querySelector('.aas-revert-btn');
    
    if (saveBtn && revertBtn) {
        if (hasUnsavedChanges) {
            saveBtn.classList.remove('disabled');
            saveBtn.disabled = false;
            revertBtn.classList.remove('disabled');
            revertBtn.disabled = false;
        } else {
            saveBtn.classList.add('disabled');
            saveBtn.disabled = true;
            revertBtn.classList.add('disabled');
            revertBtn.disabled = true;
        }
    }
}

// ===========
// DRAG AND DROP FUNCTIONALITY
// ===========

let draggedProfile = null;
let dragCounter = 0;

function enableDragAndDrop() {
    const profilesList = document.querySelector('.aas-profiles-list');
    if (!profilesList) return;

    profilesList.addEventListener('dragstart', handleDragStart);
    profilesList.addEventListener('dragend', handleDragEnd);
    profilesList.addEventListener('dragover', handleDragOver);
    profilesList.addEventListener('drop', handleDrop);
    profilesList.addEventListener('dragenter', handleDragEnter);
    profilesList.addEventListener('dragleave', handleDragLeave);
}

function handleDragStart(e) {
    if (!e.target.closest('.aas-profile-item')) return;
    
    draggedProfile = e.target.closest('.aas-profile-item');
    draggedProfile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', draggedProfile.outerHTML);
}

function handleDragEnd(e) {
    if (draggedProfile) {
        draggedProfile.classList.remove('dragging');
        draggedProfile = null;
    }
    
    // Remove all drag indicators
    document.querySelectorAll('.aas-profile-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    dragCounter = 0;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    dragCounter++;
    
    const targetProfile = e.target.closest('.aas-profile-item');
    if (targetProfile && targetProfile !== draggedProfile) {
        targetProfile.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    dragCounter--;
    
    if (dragCounter === 0) {
        const targetProfile = e.target.closest('.aas-profile-item');
        if (targetProfile) {
            targetProfile.classList.remove('drag-over');
        }
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    const targetProfile = e.target.closest('.aas-profile-item');
    if (!targetProfile || targetProfile === draggedProfile) return;
    
    const draggedIndex = parseInt(draggedProfile.dataset.profileIndex);
    const targetIndex = parseInt(targetProfile.dataset.profileIndex);
    
    // Reorder the profiles in the settings
    const draggedProfileData = currentSettings.savedSettings.splice(draggedIndex, 1)[0];
    currentSettings.savedSettings.splice(targetIndex, 0, draggedProfileData);
    
    markAsModified();
    renderProfiles();
    
    // Select the moved profile to maintain user context
    selectProfile(targetIndex);
}

// ===========
// MODAL FUNCTIONS
// ===========

function showUnsavedChangesModal(callback) {
    const promptShade = document.querySelector('.prompt-layer');
    const prompt = document.createElement('div');
    prompt.className = 'prompt';
    
    prompt.innerHTML = `
        <div class="prompt-title">Unsaved Changes</div>
        <div class="prompt-text">
            You have unsaved changes to the advanced avatar settings. 
            What would you like to do?
        </div>
        <div class="prompt-buttons">
            <button class="prompt-btn-confirm" data-action="save">Save Changes</button>
            <button class="prompt-btn-destructive" data-action="discard">Discard Changes</button>
            <button class="prompt-btn-neutral" data-action="cancel">Cancel</button>
        </div>
    `;
    
    // Add event listeners
    prompt.querySelector('[data-action="save"]').addEventListener('click', async () => {
        try {
            await saveSettings();
            prompt.remove();
            promptShade.style.display = 'none';
            if (callback) callback(true);
        } catch (error) {
            pushToast('Failed to save settings', 'error');
        }
    });
    
    prompt.querySelector('[data-action="discard"]').addEventListener('click', () => {
        revertSettings();
        prompt.remove();
        promptShade.style.display = 'none';
        if (callback) callback(true);
    });
    
    prompt.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        prompt.remove();
        promptShade.style.display = 'none';
        if (callback) callback(false);
    });
    
    promptShade.appendChild(prompt);
    promptShade.style.display = 'flex';
}

// ===========
// PROFILE MANAGEMENT
// ===========

function selectProfile(index) {
    // Clear parameter selection when switching profiles
    selectedParameters.clear();
    selectionMode = false;
    
    // Update profile selection UI
    document.querySelectorAll('.aas-profile-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    // Render parameters for the selected profile
    renderParameters(index);
}

function deleteProfile(index) {
    if (!currentSettings || !currentSettings.savedSettings[index]) return;
    
    const profile = currentSettings.savedSettings[index];
    const isDefault = profile.profileName === currentSettings.defaultProfileName;
    
    // Show confirmation dialog
    const confirmShade = document.querySelector('.prompt-layer');
    const confirmPrompt = document.createElement('div');
    confirmPrompt.className = 'prompt';
    
    confirmPrompt.innerHTML = `
        <div class="prompt-title">Delete Profile</div>
        <div class="prompt-text">
            Are you sure you want to delete the profile "${profile.profileName}"?
            ${isDefault ? '<br><br><strong>This is the default profile.</strong>' : ''}
            <br><br>This action cannot be undone.
        </div>
        <div class="prompt-buttons">
            <button class="prompt-btn-destructive" data-action="delete">Delete Profile</button>
            <button class="prompt-btn-neutral" data-action="cancel">Cancel</button>
        </div>
    `;
    
    // Add event listeners
    confirmPrompt.querySelector('[data-action="delete"]').addEventListener('click', () => {
        // Remove the profile
        currentSettings.savedSettings.splice(index, 1);
        
        // If this was the default profile, set a new default
        if (isDefault && currentSettings.savedSettings.length > 0) {
            currentSettings.defaultProfileName = currentSettings.savedSettings[0].profileName;
        } else if (currentSettings.savedSettings.length === 0) {
            currentSettings.defaultProfileName = '';
        }
        
        markAsModified();
        renderProfiles();
        
        // Select first profile if available, otherwise show empty state
        if (currentSettings.savedSettings.length > 0) {
            selectProfile(0);
        } else {
            renderParameters(-1);
        }
        
        confirmPrompt.remove();
        confirmShade.style.display = 'none';
        pushToast('Profile deleted', 'confirm');
    });
    
    confirmPrompt.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        confirmPrompt.remove();
        confirmShade.style.display = 'none';
    });
    
    confirmShade.appendChild(confirmPrompt);
    confirmShade.style.display = 'flex';
}

function addNewProfile() {
    if (!currentSettings) return;
    
    // Generate a unique profile name
    let baseName = 'New Profile';
    let profileName = baseName;
    let counter = 1;
    
    while (currentSettings.savedSettings.some(profile => profile.profileName === profileName)) {
        profileName = `${baseName} ${counter}`;
        counter++;
    }
    
    // Create new profile
    const newProfile = {
        profileName: profileName,
        values: []
    };
    
    // Add to settings
    currentSettings.savedSettings.push(newProfile);
    
    // If this is the first profile, make it default
    if (currentSettings.savedSettings.length === 1) {
        currentSettings.defaultProfileName = profileName;
    }
    
    markAsModified();
    renderProfiles();
    
    // Select the new profile
    const newIndex = currentSettings.savedSettings.length - 1;
    selectProfile(newIndex);
    
    // Start rename mode for the new profile
    setTimeout(() => {
        startRenameProfile(newIndex);
    }, 100);
    
    pushToast('New profile created', 'confirm');
}

// ===========
// PARAMETER MANAGEMENT
// ===========

function addParameter(profileIndex) {
    const profile = currentSettings.savedSettings[profileIndex];
    if (!profile) return;
    
    // Show input dialog for parameter name
    const promptShade = document.querySelector('.prompt-layer');
    const prompt = document.createElement('div');
    prompt.className = 'prompt';
    
    prompt.innerHTML = `
        <div class="prompt-title">Add Parameter</div>
        <div class="prompt-text">
            <div class="login-input-group">
                <input type="text" id="parameter-name" placeholder="Parameter name" />
            </div>
        </div>
        <div class="prompt-buttons">
            <button class="prompt-btn-confirm">Add Parameter</button>
            <button class="prompt-btn-neutral">Cancel</button>
        </div>
    `;
    
    const nameInput = prompt.querySelector('#parameter-name');
    
    prompt.querySelector('.prompt-btn-confirm').addEventListener('click', () => {
        const paramName = nameInput.value.trim();
        if (!paramName) {
            pushToast('Parameter name cannot be empty', 'error');
            return;
        }
        
        // Check if parameter already exists
        const exists = profile.values.some(param => param.name === paramName);
        if (exists) {
            pushToast('Parameter already exists', 'error');
            return;
        }
        
        // Add the parameter
        profile.values.push({
            name: paramName,
            value: 0.0
        });
        
        markAsModified();
        renderParameters(profileIndex);
        
        prompt.remove();
        promptShade.style.display = 'none';
        pushToast(`Parameter "${paramName}" added`, 'confirm');
    });
    
    prompt.querySelector('.prompt-btn-neutral').addEventListener('click', () => {
        prompt.remove();
        promptShade.style.display = 'none';
    });
    
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            prompt.querySelector('.prompt-btn-confirm').click();
        }
    });
    
    promptShade.appendChild(prompt);
    promptShade.style.display = 'flex';
    
    // Focus the input
    setTimeout(() => nameInput.focus(), 100);
}

function toggleSelectionMode() {
    selectionMode = !selectionMode;
    selectedParameters.clear();
    
    // Find current profile index
    const selectedProfile = document.querySelector('.aas-profile-item.selected');
    if (!selectedProfile) return;
    
    const profileIndex = parseInt(selectedProfile.dataset.profileIndex);
    renderParameters(profileIndex);
}

function toggleParameterSelection(paramIndex) {
    if (selectedParameters.has(paramIndex)) {
        selectedParameters.delete(paramIndex);
    } else {
        selectedParameters.add(paramIndex);
    }
    updateBatchControls();
    updateParameterCheckboxes();
}

function selectAllParameters(profileIndex) {
    const profile = currentSettings.savedSettings[profileIndex];
    if (!profile) return;
    
    selectedParameters.clear();
    for (let i = 0; i < profile.values.length; i++) {
        selectedParameters.add(i);
    }
    updateBatchControls();
    updateParameterCheckboxes();
}

function deselectAllParameters() {
    selectedParameters.clear();
    updateBatchControls();
    updateParameterCheckboxes();
}

function updateParameterCheckboxes() {
    const checkboxes = document.querySelectorAll('.aas-parameter-checkbox');
    checkboxes.forEach((checkbox, index) => {
        checkbox.checked = selectedParameters.has(index);
    });
    
    const selectAllCheckbox = document.querySelector('.aas-select-all-checkbox');
    if (selectAllCheckbox) {
        const totalParams = checkboxes.length;
        const selectedCount = selectedParameters.size;
        selectAllCheckbox.checked = selectedCount === totalParams && totalParams > 0;
        selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalParams;
    }
}

function updateBatchControls() {
    const deleteSelectedBtn = document.querySelector('.aas-delete-selected-btn');
    const selectionCount = document.querySelector('.aas-selection-count');
    
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = selectedParameters.size === 0;
        deleteSelectedBtn.classList.toggle('disabled', selectedParameters.size === 0);
    }
    
    if (selectionCount) {
        selectionCount.textContent = `${selectedParameters.size} selected`;
    }
}

function deleteSelectedParameters(profileIndex) {
    const profile = currentSettings.savedSettings[profileIndex];
    if (!profile || selectedParameters.size === 0) return;
    
    // Convert Set to sorted array (highest index first to avoid index shifting issues)
    const indicesToDelete = Array.from(selectedParameters).sort((a, b) => b - a);
    const paramNames = indicesToDelete.map(index => profile.values[index].name);
    
    // Show confirmation dialog
    const confirmShade = document.querySelector('.prompt-layer');
    const confirmPrompt = document.createElement('div');
    confirmPrompt.className = 'prompt';
    
    const paramCountText = indicesToDelete.length === 1 ? 'parameter' : 'parameters';
    const paramListText = paramNames.length <= 3 
        ? paramNames.map(name => `"${name}"`).join(', ')
        : `${paramNames.slice(0, 3).map(name => `"${name}"`).join(', ')} and ${paramNames.length - 3} more`;
    
    confirmPrompt.innerHTML = `
        <div class="prompt-title">Delete Parameters</div>
        <div class="prompt-text">
            Are you sure you want to delete ${indicesToDelete.length} ${paramCountText}?
            <br><br><strong>Parameters to delete:</strong><br>${paramListText}
            <br><br>This action cannot be undone.
        </div>
        <div class="prompt-buttons">
            <button class="prompt-btn-destructive" data-action="delete">Delete Parameters</button>
            <button class="prompt-btn-neutral" data-action="cancel">Cancel</button>
        </div>
    `;
    
    // Add event listeners
    confirmPrompt.querySelector('[data-action="delete"]').addEventListener('click', () => {
        // Remove parameters from data (in reverse order to maintain indices)
        indicesToDelete.forEach(index => {
            profile.values.splice(index, 1);
        });
        
        // Clear selection and exit selection mode
        selectedParameters.clear();
        selectionMode = false;
        
        markAsModified();
        renderParameters(profileIndex);
        
        confirmPrompt.remove();
        confirmShade.style.display = 'none';
        
        const deletedCount = indicesToDelete.length;
        const message = deletedCount === 1 ? 'Parameter deleted' : `${deletedCount} parameters deleted`;
        pushToast(message, 'confirm');
    });
    
    confirmPrompt.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        confirmPrompt.remove();
        confirmShade.style.display = 'none';
    });
    
    confirmShade.appendChild(confirmPrompt);
    confirmShade.style.display = 'flex';
}

function updateParameterValue(profileIndex, paramIndex, newValue) {
    const profile = currentSettings.savedSettings[profileIndex];
    profile.values[paramIndex].value = parseFloat(newValue);
    markAsModified();
}

function setDefaultProfile(profileName) {
    currentSettings.defaultProfileName = profileName;
    markAsModified();
    renderProfiles();
}

// ===========
// RENDERING FUNCTIONS
// ===========

function renderProfiles() {
    const profilesList = document.querySelector('.aas-profiles-list');
    if (!profilesList) return;
    
    profilesList.innerHTML = '';
    
    if (!currentSettings || !currentSettings.savedSettings || currentSettings.savedSettings.length === 0) {
        profilesList.innerHTML = '<div class="aas-no-profiles">No profiles available</div>';
        return;
    }
    
    currentSettings.savedSettings.forEach((profile, index) => {
        const isDefault = profile.profileName === currentSettings.defaultProfileName;
        
        const profileItem = document.createElement('div');
        profileItem.className = 'aas-profile-item';
        profileItem.draggable = true;
        profileItem.dataset.profileIndex = index;
        
        profileItem.innerHTML = `
            <div class="aas-profile-drag-handle">
                <span class="material-symbols-outlined">drag_indicator</span>
            </div>
            <div class="aas-profile-content">
                <div class="aas-profile-name">
                    <span class="aas-profile-name-text">${profile.profileName}</span>
                    ${isDefault ? '<span class="aas-default-indicator">DEFAULT</span>' : ''}
                </div>
                <div class="aas-profile-param-count">${profile.values.length} parameters</div>
            </div>
            <div class="aas-profile-actions">
                ${!isDefault ? `<button class="aas-set-default-btn" data-tooltip="Set as Default">
                    <span class="material-symbols-outlined">star</span>
                </button>` : ''}
                <button class="aas-rename-profile-btn" data-tooltip="Rename Profile">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="aas-delete-profile-btn" data-tooltip="Delete Profile">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;
        
        // Add event listeners
        profileItem.addEventListener('click', (e) => {
            // Don't select if clicking on action buttons
            if (e.target.closest('.aas-profile-actions')) return;
            selectProfile(index);
        });
        
        const setDefaultBtn = profileItem.querySelector('.aas-set-default-btn');
        if (setDefaultBtn) {
            setDefaultBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setDefaultProfile(profile.profileName);
            });
        }
        
        const renameBtn = profileItem.querySelector('.aas-rename-profile-btn');
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startRenameProfile(index);
        });
        
        const deleteBtn = profileItem.querySelector('.aas-delete-profile-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteProfile(index);
        });
        
        profilesList.appendChild(profileItem);
    });
    
    // Apply tooltips
    applyTooltips();
}

function startRenameProfile(profileIndex) {
    const profileItem = document.querySelector(`[data-profile-index="${profileIndex}"]`);
    const nameText = profileItem.querySelector('.aas-profile-name-text');
    const currentName = nameText.textContent;
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'aas-profile-name-input';
    input.value = currentName;
    input.dataset.originalName = currentName;
    
    // Replace text with input
    nameText.style.display = 'none';
    nameText.parentNode.insertBefore(input, nameText);
    input.focus();
    input.select();
    
    // Handle save on Enter or blur
    const saveRename = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            // Check if name already exists
            const nameExists = currentSettings.savedSettings.some((profile, index) => 
                index !== profileIndex && profile.profileName === newName
            );
            
            if (nameExists) {
                pushToast('A profile with this name already exists', 'error');
                return;
            }
            
            // Update the profile name
            currentSettings.savedSettings[profileIndex].profileName = newName;
            
            // If this was the default profile, update the default name
            if (currentSettings.defaultProfileName === currentName) {
                currentSettings.defaultProfileName = newName;
            }
            
            markAsModified();
            renderProfiles();
            renderParameters(profileIndex);
        } else {
            // Restore original text
            nameText.style.display = '';
            input.remove();
        }
    };
    
    const cancelRename = () => {
        nameText.style.display = '';
        input.remove();
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveRename();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRename();
        }
    });
    
    input.addEventListener('blur', saveRename);
}

function renderParameters(profileIndex) {
    const parametersList = document.querySelector('.aas-parameters-list');
    if (!parametersList) return;

    // --- QOL: Preserve scroll position ---
    let prevScroll = 0;
    const prevContainer = parametersList.querySelector('.aas-parameters-container');
    if (prevContainer) {
        prevScroll = prevContainer.scrollTop;
    }
    
    if (profileIndex === -1 || !currentSettings || !currentSettings.savedSettings[profileIndex]) {
        parametersList.innerHTML = `
            <div class="aas-parameters-header">
                <h4>Parameters</h4>
            </div>
            <div class="aas-parameters-container">
                <div class="aas-no-parameters">
                    <div class="aas-no-parameters-icon">
                        <span class="material-symbols-outlined">tune</span>
                    </div>
                    <p>Select a profile to view its parameters</p>
                </div>
            </div>
        `;
        return;
    }
    
    const profile = currentSettings.savedSettings[profileIndex];
    
    parametersList.innerHTML = `
        <div class="aas-parameters-header">
            <div class="aas-parameters-title">
                <h4>Parameters for "${profile.profileName}"</h4>
                ${profile.values.length > 0 ? `
                    <div class="aas-batch-controls">
                        ${selectionMode ? `
                            <div class="aas-selection-info">
                                <span class="aas-selection-count">${selectedParameters.size} selected</span>
                            </div>
                            <button class="aas-select-all-btn">
                                <input type="checkbox" class="aas-select-all-checkbox" />
                                <span>Select All</span>
                            </button>
                            <button class="aas-delete-selected-btn disabled" disabled>
                                <span class="material-symbols-outlined">delete</span>
                                Delete Selected
                            </button>
                            <button class="aas-cancel-selection-btn">
                                <span class="material-symbols-outlined">close</span>
                                Cancel
                            </button>
                        ` : `
                            <button class="aas-enter-selection-btn">
                                <span class="material-symbols-outlined">checklist</span>
                                Select Multiple
                            </button>
                        `}
                    </div>
                ` : ''}
            </div>
            <button class="aas-add-parameter-btn">
                <span class="material-symbols-outlined">add</span>
                Add Parameter
            </button>
        </div>
        <div class="aas-parameters-container">
            ${profile.values.length === 0 ? `
                <div class="aas-no-parameters">
                    <div class="aas-no-parameters-icon">
                        <span class="material-symbols-outlined">tune</span>
                    </div>
                    <p>No parameters in this profile</p>
                    <small>Click "Add Parameter" to create one</small>
                </div>
            ` : ''}
        </div>
    `;
    
    const addParameterBtn = parametersList.querySelector('.aas-add-parameter-btn');
    addParameterBtn.addEventListener('click', () => addParameter(profileIndex));
    
    // Set up batch control event listeners
    const enterSelectionBtn = parametersList.querySelector('.aas-enter-selection-btn');
    if (enterSelectionBtn) {
        enterSelectionBtn.addEventListener('click', toggleSelectionMode);
    }
    
    const cancelSelectionBtn = parametersList.querySelector('.aas-cancel-selection-btn');
    if (cancelSelectionBtn) {
        cancelSelectionBtn.addEventListener('click', toggleSelectionMode);
    }
    
    const selectAllBtn = parametersList.querySelector('.aas-select-all-btn');
    const selectAllCheckbox = parametersList.querySelector('.aas-select-all-checkbox');
    if (selectAllBtn && selectAllCheckbox) {
        selectAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (selectedParameters.size === profile.values.length) {
                deselectAllParameters();
            } else {
                selectAllParameters(profileIndex);
            }
        });
        
        selectAllCheckbox.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedParameters.size === profile.values.length) {
                deselectAllParameters();
            } else {
                selectAllParameters(profileIndex);
            }
        });
    }
    
    const deleteSelectedBtn = parametersList.querySelector('.aas-delete-selected-btn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => deleteSelectedParameters(profileIndex));
    }
    
    const parametersContainer = parametersList.querySelector('.aas-parameters-container');
    
    profile.values.forEach((param, paramIndex) => {
        const paramItem = document.createElement('div');
        paramItem.className = 'aas-parameter-item';
        if (selectionMode && selectedParameters.has(paramIndex)) {
            paramItem.classList.add('selected');
        }

        paramItem.innerHTML = `
            ${selectionMode ? `
                <div class="aas-parameter-selection">
                    <input type="checkbox" class="aas-parameter-checkbox" ${selectedParameters.has(paramIndex) ? 'checked' : ''} />
                </div>
            ` : ''}
            <div class="aas-parameter-content">
                <label class="aas-parameter-name">${param.name}</label>
                <div class="aas-parameter-controls">
                    <input type="range" 
                           class="aas-parameter-slider" 
                           min="0" 
                           max="10" 
                           step="0.1" 
                           value="${param.value}"
                           data-profile-index="${profileIndex}"
                           data-param-index="${paramIndex}" />
                    <input type="number" 
                           class="aas-parameter-value" 
                           min="0" 
                           max="10" 
                           step="0.1" 
                           value="${param.value}"
                           data-profile-index="${profileIndex}"
                           data-param-index="${paramIndex}" />
                </div>
            </div>
            <div class="aas-parameter-actions">
                <button class="aas-delete-parameter-btn" data-tooltip="Delete Parameter">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;

        // Add event listeners
        const slider = paramItem.querySelector('.aas-parameter-slider');
        const numberInput = paramItem.querySelector('.aas-parameter-value');
        const checkbox = paramItem.querySelector('.aas-parameter-checkbox');
        const deleteBtn = paramItem.querySelector('.aas-delete-parameter-btn');

        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            numberInput.value = value;
            updateParameterValue(profileIndex, paramIndex, value);
        });

        numberInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                slider.value = value;
                updateParameterValue(profileIndex, paramIndex, value);
            }
        });

        if (checkbox) {
            // Fix: Only toggle selection, don't let parent click fire
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleParameterSelection(paramIndex);
            });
        }

        // In selection mode, clicking the item toggles selection (except controls)
        if (selectionMode) {
            paramItem.addEventListener('click', (e) => {
                if (!e.target.closest('.aas-parameter-controls') && !e.target.closest('.aas-delete-parameter-btn') && !e.target.closest('.aas-parameter-checkbox')) {
                    toggleParameterSelection(paramIndex);
                }
            });
        }

        // Individual delete button (always available)
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Confirm before deleting
                const confirmShade = document.querySelector('.prompt-layer');
                const confirmPrompt = document.createElement('div');
                confirmPrompt.className = 'prompt';
                confirmPrompt.innerHTML = `
                    <div class="prompt-title">Delete Parameter</div>
                    <div class="prompt-text">
                        Are you sure you want to delete parameter "${param.name}"?<br><br>This action cannot be undone.
                    </div>
                    <div class="prompt-buttons">
                        <button class="prompt-btn-destructive" data-action="delete">Delete</button>
                        <button class="prompt-btn-neutral" data-action="cancel">Cancel</button>
                    </div>
                `;
                confirmPrompt.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    // Remove from currentSettings only
                    profile.values.splice(paramIndex, 1);
                    markAsModified();
                    renderParameters(profileIndex);
                    confirmPrompt.remove();
                    confirmShade.style.display = 'none';
                    pushToast(`Parameter "${param.name}" deleted`, 'confirm');
                });
                confirmPrompt.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                    confirmPrompt.remove();
                    confirmShade.style.display = 'none';
                });
                confirmShade.appendChild(confirmPrompt);
                confirmShade.style.display = 'flex';
            });
        }

        parametersContainer.appendChild(paramItem);
    });
    
    // Update batch controls state
    if (selectionMode) {
        updateBatchControls();
        updateParameterCheckboxes();
    }
    
    // Apply tooltips
    applyTooltips();

    // Restore scroll position
    if (parametersContainer) {
        parametersContainer.scrollTop = prevScroll;
    }
}

// ===========
// SAVE/REVERT FUNCTIONS
// ===========

async function saveSettings() {
    if (!currentSettings || !currentAvatarId) {
        pushToast('No settings to save', 'error');
        return;
    }
    
    try {
        await window.API.saveAvatarAdvancedSettings(currentAvatarId, currentSettings);
        
        // Update original settings to reflect saved state
        originalSettings = deepClone(currentSettings);
        hasUnsavedChanges = false;
        updateActionButtons();
        pushToast('Advanced avatar settings saved successfully', 'confirm');

        // QOL: Refresh profile and parameter lists, keep current selection
        const selectedProfile = document.querySelector('.aas-profile-item.selected');
        let selectedIndex = 0;
        if (selectedProfile) {
            selectedIndex = parseInt(selectedProfile.dataset.profileIndex);
        }
        renderProfiles();
        if (currentSettings.savedSettings && currentSettings.savedSettings.length > 0) {
            selectProfile(Math.min(selectedIndex, currentSettings.savedSettings.length - 1));
        } else {
            renderParameters(-1);
        }
    } catch (error) {
        log('Failed to save avatar advanced settings:', error);
        pushToast('Failed to save settings', 'error');
        throw error;
    }
}

function revertSettings() {
    if (!originalSettings) return;
    
    currentSettings = deepClone(originalSettings);
    hasUnsavedChanges = false;
    selectedParameters.clear();
    selectionMode = false;
    updateActionButtons();
    
    renderProfiles();
    
    // Select first profile if available
    if (currentSettings.savedSettings && currentSettings.savedSettings.length > 0) {
        selectProfile(0);
    } else {
        renderParameters(-1);
    }
    
    pushToast('Settings reverted', 'info');
}

// ===========
// NAVIGATION HANDLER
// ===========

function setupNavigationWarning() {
    // Store reference to the original shade click handler
    const detailsShade = document.querySelector('.details-shade');
    const originalClickHandler = detailsShade.onclick;
    
    // Override the shade click handler
    detailsShade.onclick = (event) => {
        if (event.target === detailsShade) {
            if (hasUnsavedChanges) {
                showUnsavedChangesModal((shouldProceed) => {
                    if (shouldProceed && originalClickHandler) {
                        originalClickHandler(event);
                    }
                });
            } else if (originalClickHandler) {
                originalClickHandler(event);
            }
        }
    };
    
    // Store original handler for cleanup
    window.aasOriginalShadeHandler = originalClickHandler;
}

function cleanupNavigationWarning() {
    const detailsShade = document.querySelector('.details-shade');
    if (detailsShade && window.aasOriginalShadeHandler) {
        detailsShade.onclick = window.aasOriginalShadeHandler;
        delete window.aasOriginalShadeHandler;
    }
}

// ===========
// MAIN LOAD FUNCTION
// ===========

export async function loadAdvancedAvatarSettings(avatarId) {
    currentAvatarId = avatarId;
    hasUnsavedChanges = false;
    
    const aasContainer = document.querySelector('#adv-settings-tab .adv-settings-container');
    if (!aasContainer) return;
    
    // Show loading state
    aasContainer.innerHTML = '<div class="loading-indicator">Loading advanced avatar settings...</div>';
    
    try {
        // Check if settings exist (now returns detailed information)
        const settingsCheck = await window.API.hasAvatarAdvancedSettings(avatarId);
        
        if (!settingsCheck.hasSettings) {
            // Handle different reasons for not having settings
            switch (settingsCheck.reason) {
                case 'cvr_path_not_configured':
                case 'cvr_directory_not_found':
                    aasContainer.innerHTML = `
                        <div class="aas-no-settings">
                            <div class="aas-no-settings-icon">
                                <span class="material-symbols-outlined">folder_off</span>
                            </div>
                            <h3>ChilloutVR Installation Not Found</h3>
                            <p>Your ChilloutVR installation directory needs to be configured to use advanced avatar settings.</p>
                            <small>Expected directory: <code>..\\ChilloutVR\\ChilloutVR.exe</code></small>
                            <div class="aas-setup-actions">
                                <button class="aas-setup-cvr-btn">
                                    <span class="material-symbols-outlined">folder_open</span>
                                    Configure ChilloutVR Path
                                </button>
                                <p class="aas-setup-note">You can also configure this in<br /><span class="aas-settings-link">Settings → Advanced → ChilloutVR Path</span></p>
                            </div>
                        </div>
                    `;
                    
                    // Add click handler for the setup button
                    const setupBtn = aasContainer.querySelector('.aas-setup-cvr-btn');
                    setupBtn.addEventListener('click', async () => {
                        try {
                            setupBtn.disabled = true;
                            setupBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span>Selecting...';
                            
                            const selectedPath = await window.API.selectCVRExecutable();
                            
                            // Show success message and reload
                            pushToast('ChilloutVR path configured successfully! Reloading...', 'confirm');
                            
                            // Reload the advanced avatar settings
                            setTimeout(() => {
                                loadAdvancedAvatarSettings(avatarId);
                            }, 1000);
                            
                        } catch (error) {
                            setupBtn.disabled = false;
                            setupBtn.innerHTML = '<span class="material-symbols-outlined">folder_open</span>Configure ChilloutVR Path';
                            
                            if (error.message !== 'User canceled CVR executable selection') {
                                pushToast(`Error configuring CVR path: ${error.message}`, 'error');
                            }
                        }
                    });
                    
                    // Add click handler for settings link
                    const settingsLink = aasContainer.querySelector('.aas-settings-link');
                    settingsLink.addEventListener('click', () => {
                        // Close the details window and navigate to settings
                        const detailsShade = document.querySelector('.details-shade');
                        if (detailsShade) {
                            detailsShade.style.display = 'none';
                        }
                        
                        // Switch to settings (assuming it's a navbar page)
                        const settingsButton = document.querySelector('.navbar-button[data-page="settings"]');
                        if (settingsButton) {
                            settingsButton.click();
                            
                            // After navigating to settings, switch to the Advanced tab
                            setTimeout(() => {
                                // Remove active class from all settings tabs and pages
                                document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                                document.querySelectorAll('.settings-page').forEach(p => p.classList.remove('active'));
                                
                                // Activate the Advanced tab and page
                                const advancedTab = document.querySelector('.settings-tab[data-tab="advanced"]');
                                const advancedPage = document.getElementById('settings-advanced');
                                
                                if (advancedTab && advancedPage) {
                                    advancedTab.classList.add('active');
                                    advancedPage.classList.add('active');
                                }
                            }, 100); // Small delay to ensure settings page has loaded
                        }
                        
                        pushToast('Please configure your ChilloutVR executable path in Settings', 'info');
                    });
                    
                    return;
                    
                case 'aas_directory_not_found':
                    aasContainer.innerHTML = `
                        <div class="aas-no-settings">
                            <div class="aas-no-settings-icon">
                                <span class="material-symbols-outlined">folder_off</span>
                            </div>
                            <h3>Advanced Avatar Settings Directory Not Found</h3>
                            <p>The Advanced Avatar Settings directory was not found in your ChilloutVR installation.</p>
                            <small>Expected directory: <code>..\ChilloutVR\ChilloutVR.exe</code></small>
                            <div class="aas-setup-info">
                                <p><strong>This directory is created automatically when you:</strong></p>
                                <ul>
                                    <li>Launch ChilloutVR at least once</li>
                                    <li>Customize avatar parameters in-game</li>
                                </ul>
                                <p>Try launching ChilloutVR and customizing an avatar's parameters, then reload this page.</p>
                            </div>
                        </div>
                    `;
                    return;
                    
                case 'file_not_found':
                default:
                    aasContainer.innerHTML = `
                        <div class="aas-no-settings">
                            <div class="aas-no-settings-icon">
                                <span class="material-symbols-outlined">tune</span>
                            </div>
                            <h3>No Advanced Avatar Settings Found</h3>
                            <p>This avatar doesn't have any advanced settings (.advavtr file) in your ChilloutVR installation.</p>
                            <small>Advanced avatar settings are created when you customize avatar parameters in-game.</small>
                        </div>
                    `;
                    return;
            }
        }
        
        // Load the settings
        const settings = await window.API.getAvatarAdvancedSettings(avatarId);
        
        if (!settings) {
            aasContainer.innerHTML = `
                <div class="aas-no-settings">
                    <div class="aas-no-settings-icon">
                        <span class="material-symbols-outlined">error</span>
                    </div>
                    <h3>Failed to Load Settings</h3>
                    <p>Could not read the advanced avatar settings file.</p>
                </div>
            `;
            return;
        }
        
        // Store settings
        originalSettings = deepClone(settings);
        currentSettings = deepClone(settings);
        
        // Create the UI
        aasContainer.innerHTML = `
            <div class="aas-manager">
                <div class="aas-header">
                    <h3>Advanced Avatar Settings</h3>
                    <p>Manage your avatar's parameter profiles and values</p>
                </div>
                
                <div class="aas-content">
                    <div class="aas-profiles-section">
                        <div class="aas-section-header">
                            <h4>Profiles</h4>
                            <small>Drag to reorder • Default profile is loaded first</small>
                        </div>
                        <div class="aas-profiles-list">
                            <!-- Profiles will be rendered here -->
                        </div>
                        <div class="aas-add-profile-section">
                            <button class="aas-add-profile-btn">
                                <span class="material-symbols-outlined">add</span>
                                Add New Profile
                            </button>
                        </div>
                    </div>
                    
                    <div class="aas-parameters-section">
                        <div class="aas-parameters-list">
                            <!-- Parameters will be rendered here -->
                        </div>
                    </div>
                </div>
                
                <div class="aas-actions">
                    <button class="aas-save-btn disabled" disabled>
                        <span class="material-symbols-outlined">save</span>
                        Save Changes
                    </button>
                    <button class="aas-revert-btn disabled" disabled>
                        <span class="material-symbols-outlined">undo</span>
                        Revert Changes
                    </button>
                </div>
            </div>
        `;
        
        // Set up event listeners
        const saveBtn = aasContainer.querySelector('.aas-save-btn');
        const revertBtn = aasContainer.querySelector('.aas-revert-btn');
        const addProfileBtn = aasContainer.querySelector('.aas-add-profile-btn');
        
        saveBtn.addEventListener('click', saveSettings);
        revertBtn.addEventListener('click', revertSettings);
        addProfileBtn.addEventListener('click', addNewProfile);
        
        // Enable drag and drop
        enableDragAndDrop();
        
        // Setup navigation warning
        setupNavigationWarning();
        
        // Render initial content
        renderProfiles();
        
        // Select first profile if available
        if (currentSettings.savedSettings && currentSettings.savedSettings.length > 0) {
            selectProfile(0);
        } else {
            renderParameters(-1);
        }
        
    } catch (error) {
        log('Error loading advanced avatar settings:', error);
        aasContainer.innerHTML = `
            <div class="aas-error">
                <div class="aas-error-icon">
                    <span class="material-symbols-outlined">error</span>
                </div>
                <h3>Error Loading Settings</h3>
                <p>Failed to load advanced avatar settings: ${error.message}</p>
            </div>
        `;
    }
}

// ===========
// CLEANUP FUNCTION
// ===========

export function cleanupAdvancedAvatarSettings() {
    cleanupNavigationWarning();
    currentSettings = null;
    originalSettings = null;
    hasUnsavedChanges = false;
    currentAvatarId = null;
    selectedParameters.clear();
    selectionMode = false;
} 