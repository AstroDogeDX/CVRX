// =======
// ADVANCED AVATAR SETTINGS MODULE
// =======

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';

// ===========
// STATE MANAGEMENT
// ===========

let currentSettings = null;
let originalSettings = null;
let hasUnsavedChanges = false;
let currentAvatarId = null;

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

function deleteParameter(profileIndex, paramIndex) {
    const profile = currentSettings.savedSettings[profileIndex];
    const paramName = profile.values[paramIndex].name;
    
    // Remove the parameter
    profile.values.splice(paramIndex, 1);
    
    markAsModified();
    renderParameters(profileIndex);
    pushToast(`Parameter "${paramName}" deleted`, 'confirm');
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
            <h4>Parameters for "${profile.profileName}"</h4>
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
    
    const parametersContainer = parametersList.querySelector('.aas-parameters-container');
    
    profile.values.forEach((param, paramIndex) => {
        const paramItem = document.createElement('div');
        paramItem.className = 'aas-parameter-item';
        
        paramItem.innerHTML = `
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
        
        deleteBtn.addEventListener('click', () => {
            deleteParameter(profileIndex, paramIndex);
        });
        
        parametersContainer.appendChild(paramItem);
    });
    
    // Apply tooltips
    applyTooltips();
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
    } catch (error) {
        console.error('Failed to save avatar advanced settings:', error);
        pushToast('Failed to save settings', 'error');
        throw error;
    }
}

function revertSettings() {
    if (!originalSettings) return;
    
    currentSettings = deepClone(originalSettings);
    hasUnsavedChanges = false;
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
        // Check if settings exist
        const hasSettings = await window.API.hasAvatarAdvancedSettings(avatarId);
        
        if (!hasSettings) {
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
        console.error('Error loading advanced avatar settings:', error);
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
} 