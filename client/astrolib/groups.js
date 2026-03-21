// ===============
// GROUPS MODULE
// ===============

import { pushToast } from './toasty_notifications.js';
import { applyTooltips } from './tooltip.js';
import { createElement } from '../frontend.js';
import { getCachedImage, setImageSource, friendsData } from './user_content.js';

// Import shared log function or create local one
let isPackaged = false;
window.API.isPackaged().then(packaged => {
    isPackaged = packaged;
});

const log = (msg) => {
    if (!isPackaged) console.log(msg);
};

// Store groups data
let groupsData = { owned: [], member: [] };

// Dependencies that need to be injected
let ShowDetailsWrapper = null;
let DetailsType = null;
let currentUserId = null;

// Function to initialize dependencies
export function initializeGroupsModule(dependencies) {
    ShowDetailsWrapper = dependencies.ShowDetailsWrapper;
    DetailsType = dependencies.DetailsType;
}

export function setCurrentUserId(userId) {
    currentUserId = userId;
}

// Helper: decode HTML entities from API responses
function decodeHtmlEntities(text) {
    if (!text) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Helper: get role icon name
export function getRoleIcon(role) {
    switch (role) {
        case 'Admin': return 'shield';
        case 'Moderator': return 'swords';
        case 'Member': return 'person';
        case 'Trial': return 'person_outline';
        default: return 'person';
    }
}

// Helper: format date as DD/MM/YYYY
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// Helper: find current user's role in a group by searching through all member pages
export async function findMyRole(groupId, userId) {
    if (!userId) return null;
    let page = 0;
    while (true) {
        const membersData = await window.API.getGroupMembers(groupId, page, 0, true);
        if (!membersData?.entries?.length) return null;
        const myEntry = membersData.entries.find(m => m.id === userId);
        if (myEntry?.role) return myEntry.role;
        page++;
        if (page >= (membersData.totalPages || 1)) return null;
    }
}

// Helper: check if user can manage members (Owner, Admin, or Moderator)
function canManageMembers(memberStatus) {
    return ['Owner', 'Admin', 'Moderator'].includes(memberStatus);
}

// Helper: check if user can edit group settings (Owner, Admin, or Moderator)
function canEditSettings(memberStatus) {
    return ['Owner', 'Admin', 'Moderator'].includes(memberStatus);
}

// Helper: get assignable roles based on the current user's role
function getAssignableRoles(myStatus) {
    if (myStatus === 'Owner') return ['Trial', 'Member', 'Moderator', 'Admin'];
    if (myStatus === 'Admin') return ['Trial', 'Member', 'Moderator'];
    if (myStatus === 'Moderator') return ['Trial', 'Member'];
    return [];
}

// Helper: create a member row node
function createMemberNode(member, ownerId, myStatus, groupId) {
    const memberNode = createElement('div', { className: 'group-member-node' });

    const memberImg = createElement('img', {
        className: 'group-member-image',
        src: getCachedImage(member.imageHash),
    });
    if (member.imageHash) {
        memberImg.dataset.hash = member.imageHash;
    }
    memberImg.addEventListener('click', () => {
        if (ShowDetailsWrapper && DetailsType) {
            ShowDetailsWrapper(DetailsType.User, member.id);
        }
    });
    memberImg.style.cursor = 'pointer';

    const memberInfo = createElement('div', { className: 'group-member-info' });

    const nameRow = createElement('div', { className: 'group-member-name-row' });
    const memberName = createElement('span', {
        className: 'group-member-name',
        textContent: decodeHtmlEntities(member.name),
    });
    memberName.style.cursor = 'pointer';
    memberName.addEventListener('click', () => {
        if (ShowDetailsWrapper && DetailsType) {
            ShowDetailsWrapper(DetailsType.User, member.id);
        }
    });
    const isOwner = ownerId && member.id === ownerId;

    const roleIcon = createElement('span', {
        className: 'material-symbols-outlined group-member-role-icon',
    });
    roleIcon.textContent = isOwner ? 'crown' : getRoleIcon(member.role);
    roleIcon.dataset.tooltip = isOwner ? 'Owner' : (member.role || 'Member');
    nameRow.append(memberName, roleIcon);

    const memberJoined = createElement('p', {
        className: 'group-member-joined',
        textContent: formatDate(member.joinedAt),
    });
    memberInfo.append(nameRow, memberJoined);

    memberNode.append(memberImg, memberInfo);

    // Management actions (if user has permission and this isn't themselves or the owner)
    if (canManageMembers(myStatus) && !isOwner && member.id !== ownerId) {
        const actionsRow = createElement('div', { className: 'group-member-actions' });

        // Role dropdown
        const assignableRoles = getAssignableRoles(myStatus);
        if (assignableRoles.length > 0) {
            const roleSelect = createElement('select', { className: 'group-member-role-select' });
            for (const role of assignableRoles) {
                const opt = document.createElement('option');
                opt.value = role;
                opt.textContent = role;
                if (member.role === role) opt.selected = true;
                roleSelect.appendChild(opt);
            }
            roleSelect.addEventListener('change', async () => {
                try {
                    const roleMap = { Trial: 0, Member: 1, Moderator: 2, Admin: 3 };
                    await window.API.assignGroupRoleToMember(groupId, member.id, roleMap[roleSelect.value]);
                    pushToast(`Role updated to ${roleSelect.value}`, 'success');
                } catch (_err) {
                    pushToast('Failed to update role', 'error');
                }
            });
            roleSelect.addEventListener('click', (e) => e.stopPropagation());
            actionsRow.appendChild(roleSelect);
        }

        // Kick button
        const kickBtn = createElement('button', {
            className: 'group-member-kick-btn',
        });
        kickBtn.innerHTML = '<span class="material-symbols-outlined">person_remove</span>';
        kickBtn.dataset.tooltip = 'Kick from group';
        kickBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await window.API.kickMemberFromGroup(groupId, member.id);
                pushToast(`Kicked ${decodeHtmlEntities(member.name)}`, 'success');
                memberNode.remove();
            } catch (_err) {
                pushToast('Failed to kick member', 'error');
            }
        });
        actionsRow.appendChild(kickBtn);

        memberNode.appendChild(actionsRow);
    }

    return memberNode;
}

// =========================
// GROUP DETAIL OVERLAY
// =========================

// Ensure overlay element exists in DOM
function ensureGroupOverlay() {
    let shade = document.querySelector('.group-details-shade');
    if (!shade) {
        shade = createElement('div', { className: 'group-details-shade' });
        shade.innerHTML = `
            <div class="group-details-window">
                <div class="group-details-sidebar"></div>
                <div class="group-details-content">
                    <div class="group-details-tabs"></div>
                    <div class="group-details-tab-content"></div>
                </div>
            </div>
        `;
        shade.addEventListener('click', (e) => {
            if (e.target === shade) {
                shade.style.display = 'none';
            }
        });
        document.querySelector('.overlay').appendChild(shade);
    }
    return shade;
}

function setActiveTab(tabs, index) {
    tabs.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
    tabs.querySelectorAll('.group-tab')[index]?.classList.add('active');
}

// Show group details in its own overlay
export async function showGroupDetails(groupId) {
    const shade = ensureGroupOverlay();
    const sidebar = shade.querySelector('.group-details-sidebar');
    const tabs = shade.querySelector('.group-details-tabs');
    const tabContent = shade.querySelector('.group-details-tab-content');

    sidebar.innerHTML = '';
    tabs.innerHTML = '';
    tabContent.innerHTML = '';

    // Close the other details overlay if open
    const detailsShade = document.querySelector('.details-shade');
    if (detailsShade) {
        detailsShade.style.display = 'none';
    }

    shade.style.display = 'flex';
    sidebar.innerHTML = '<div class="group-members-loading"><span class="material-symbols-outlined spinner">refresh</span></div>';

    try {
        const group = await window.API.getGroupDetail(groupId);
        if (!group) {
            pushToast('Failed to load group details', 'error');
            shade.style.display = 'none';
            return;
        }

        log('Group details:');
        log(group);

        // Determine actual role by checking members list, since relation.memberStatus is unreliable
        let myStatus = null;

        if (currentUserId) {
            if (group.owner?.id && currentUserId === group.owner.id) {
                myStatus = 'Owner';
            } else {
                try {
                    const role = await findMyRole(group.id, currentUserId);
                    if (role) {
                        myStatus = role;
                    }
                } catch (_err) {
                    log('Failed to resolve actual group role, using fallback');
                }
            }
        }

        // ---- SIDEBAR ----
        sidebar.innerHTML = '';

        // Group image (click to copy group ID)
        const groupImg = createElement('img', {
            className: 'group-sidebar-image',
            src: getCachedImage(group.imageHash),
        });
        groupImg.dataset.tooltip = 'Double-click to copy Group ID';
        groupImg.style.cursor = 'pointer';
        groupImg.addEventListener('dblclick', async () => {
            try {
                await navigator.clipboard.writeText(group.id);
                pushToast(`Copied Group ID: ${group.id}`, 'confirm');
            } catch (_err) {
                pushToast('Failed to copy Group ID', 'error');
            }
        });
        if (group.imageHash) {
            groupImg.dataset.hash = group.imageHash;
        }
        sidebar.appendChild(groupImg);

        // Group name
        const groupName = createElement('h2', {
            className: 'group-sidebar-name',
            textContent: decodeHtmlEntities(group.name),
        });
        sidebar.appendChild(groupName);

        // Info rows
        const infoRows = createElement('div', { className: 'group-sidebar-info' });

        if (group.owner) {
            const ownerRow = createElement('div', { className: 'group-sidebar-row' });
            ownerRow.dataset.tooltip = `Owner: ${decodeHtmlEntities(group.owner.name)}`;
            const ownerImg = createElement('img', {
                className: 'group-sidebar-row-image',
                src: getCachedImage(group.owner.imageHash),
            });
            if (group.owner.imageHash) {
                ownerImg.dataset.hash = group.owner.imageHash;
            }
            const ownerName = createElement('span', { textContent: decodeHtmlEntities(group.owner.name) });
            ownerRow.append(ownerImg, ownerName);
            ownerRow.style.cursor = 'pointer';
            ownerRow.addEventListener('click', () => {
                if (ShowDetailsWrapper && DetailsType) {
                    ShowDetailsWrapper(DetailsType.User, group.owner.id);
                }
            });
            infoRows.appendChild(ownerRow);
        }

        const memberRow = createElement('div', { className: 'group-sidebar-row' });
        memberRow.innerHTML = `<span class="material-symbols-outlined">group</span><span>${group.memberCount || 0} Members</span>`;
        infoRows.appendChild(memberRow);

        if (group.tag) {
            const tagRow = createElement('div', { className: 'group-sidebar-row' });
            tagRow.innerHTML = `<span class="material-symbols-outlined">sell</span><span>[${decodeHtmlEntities(group.tag)}]</span>`;
            infoRows.appendChild(tagRow);
        }

        const joinRow = createElement('div', { className: 'group-sidebar-row' });
        joinRow.innerHTML = `<span class="material-symbols-outlined">lock</span><span>Join: ${group.settingPrivacyJoin || 'Unknown'}</span>`;
        infoRows.appendChild(joinRow);

        if (myStatus) {
            const roleRow = createElement('div', { className: 'group-sidebar-row' });
            roleRow.innerHTML = `<span class="material-symbols-outlined">${getRoleIcon(myStatus)}</span><span>Your Role: ${myStatus}</span>`;
            infoRows.appendChild(roleRow);
        }

        sidebar.appendChild(infoRows);

        // ---- ACTION BUTTONS ----
        const actionsDiv = createElement('div', { className: 'group-sidebar-actions' });

        if (myStatus) {
            const featuredBtn = createElement('button', {
                className: 'group-sidebar-btn group-sidebar-btn-featured',
                innerHTML: '<span class="material-symbols-outlined">star</span> Set as Featured',
            });
            featuredBtn.addEventListener('click', async () => {
                try {
                    await window.API.setGroupFeatured(group.id);
                    pushToast('Group set as featured!', 'success');
                } catch (_err) {
                    pushToast('Failed to set group as featured', 'error');
                }
            });
            actionsDiv.appendChild(featuredBtn);

            if (myStatus !== 'Owner') {
                const leaveBtn = createElement('button', {
                    className: 'group-sidebar-btn group-sidebar-btn-danger',
                    innerHTML: '<span class="material-symbols-outlined">logout</span> Leave Group',
                });
                leaveBtn.addEventListener('click', async () => {
                    try {
                        await window.API.leaveGroup(group.id);
                        pushToast('Left group successfully', 'success');
                        await loadGroups();
                        shade.style.display = 'none';
                    } catch (_err) {
                        pushToast('Failed to leave group', 'error');
                    }
                });
                actionsDiv.appendChild(leaveBtn);
            }
        } else {
            const joinType = group.settingPrivacyJoin;
            if (joinType === 'Public') {
                const joinBtn = createElement('button', {
                    className: 'group-sidebar-btn group-sidebar-btn-primary',
                    innerHTML: '<span class="material-symbols-outlined">login</span> Join Group',
                });
                joinBtn.addEventListener('click', async () => {
                    try {
                        await window.API.joinGroup(group.id);
                        pushToast('Joined group successfully!', 'success');
                        await loadGroups();
                        await showGroupDetails(group.id);
                    } catch (_err) {
                        pushToast('Failed to join group', 'error');
                    }
                });
                actionsDiv.appendChild(joinBtn);
            } else if (joinType === 'Request') {
                const requestBtn = createElement('button', {
                    className: 'group-sidebar-btn group-sidebar-btn-primary',
                    innerHTML: '<span class="material-symbols-outlined">send</span> Request to Join',
                });
                requestBtn.addEventListener('click', async () => {
                    try {
                        await window.API.requestJoinGroup(group.id);
                        pushToast('Join request sent!', 'success');
                    } catch (_err) {
                        pushToast('Failed to send join request', 'error');
                    }
                });
                actionsDiv.appendChild(requestBtn);
            }
        }

        if (actionsDiv.children.length > 0) {
            sidebar.appendChild(actionsDiv);
        }

        // ---- TABS ----
        const descTab = createElement('button', {
            className: 'group-tab active',
            innerHTML: '<span class="material-symbols-outlined">description</span> Description',
        });
        const membersTab = createElement('button', {
            className: 'group-tab',
            innerHTML: '<span class="material-symbols-outlined">group</span> Members',
        });

        descTab.addEventListener('click', () => {
            setActiveTab(tabs, 0);
            showDescriptionTab(tabContent, group);
        });
        membersTab.addEventListener('click', () => {
            setActiveTab(tabs, 1);
            showMembersTab(tabContent, group, myStatus);
        });

        tabs.append(descTab, membersTab);

        // Settings tab (only for Owner/Admin)
        if (canEditSettings(myStatus)) {
            const settingsTab = createElement('button', {
                className: 'group-tab',
                innerHTML: '<span class="material-symbols-outlined">settings</span> Settings',
            });
            settingsTab.addEventListener('click', () => {
                setActiveTab(tabs, 2);
                showSettingsTab(tabContent, group);
            });
            tabs.appendChild(settingsTab);
        }

        showDescriptionTab(tabContent, group);
        applyTooltips();

    } catch (error) {
        log(`Failed to load group details: ${error}`);
        pushToast('Failed to load group details', 'error');
        shade.style.display = 'none';
    }
}

// ============================
// DESCRIPTION TAB
// ============================

function showDescriptionTab(container, group) {
    container.innerHTML = '';
    const pane = createElement('div', { className: 'group-tab-pane' });

    if (group.description) {
        const descText = createElement('p', {
            className: 'group-description-text',
            textContent: decodeHtmlEntities(group.description),
        });
        pane.appendChild(descText);
    } else {
        const emptyMsg = createElement('p', {
            className: 'group-description-empty',
            textContent: 'No description provided.',
        });
        pane.appendChild(emptyMsg);
    }

    container.appendChild(pane);
}

// ============================
// MEMBERS TAB
// ============================

async function showMembersTab(container, group, myStatus) {
    container.innerHTML = '';
    const pane = createElement('div', { className: 'group-tab-pane' });

    // Invite button at the top (if user can manage members)
    if (canManageMembers(myStatus)) {
        const inviteSection = createElement('div', { className: 'group-invite-section' });
        const inviteBtn = createElement('button', {
            className: 'group-sidebar-btn group-sidebar-btn-primary',
            innerHTML: '<span class="material-symbols-outlined">person_add</span> Invite Friend',
        });
        inviteBtn.addEventListener('click', () => {
            showInvitePicker(pane, group.id);
        });
        inviteSection.appendChild(inviteBtn);
        pane.appendChild(inviteSection);
    }

    const loadingDiv = createElement('div', {
        className: 'group-members-loading',
        innerHTML: '<span class="material-symbols-outlined spinner">refresh</span> Loading members...',
    });
    pane.appendChild(loadingDiv);
    container.appendChild(pane);

    try {
        const membersData = await window.API.getGroupMembers(group.id, 0, 0, true);
        loadingDiv.remove();

        if (!membersData?.entries?.length) {
            const emptyMsg = createElement('p', {
                className: 'group-members-empty',
                textContent: 'No members found or member list is hidden.',
            });
            pane.appendChild(emptyMsg);
            return;
        }

        const membersList = createElement('div', { className: 'group-members-list' });
        for (const member of membersData.entries) {
            membersList.appendChild(createMemberNode(member, group.owner?.id, myStatus, group.id));
        }
        pane.appendChild(membersList);

        if (membersData.totalPages > 1) {
            const pagination = createElement('div', { className: 'group-members-pagination' });
            for (let i = 0; i < membersData.totalPages; i++) {
                const pageBtn = createElement('button', {
                    className: `group-page-btn${i === 0 ? ' active' : ''}`,
                    textContent: `${i + 1}`,
                });
                pageBtn.dataset.tooltip = `Page ${i + 1}`;
                pageBtn.addEventListener('click', async () => {
                    pagination.querySelectorAll('.group-page-btn').forEach(b => b.classList.remove('active'));
                    pageBtn.classList.add('active');
                    await loadMembersPage(membersList, group.id, i, group.owner?.id, myStatus);
                });
                pagination.appendChild(pageBtn);
            }
            pane.appendChild(pagination);
        }

        applyTooltips();

    } catch (_error) {
        loadingDiv.remove();
        const errorMsg = createElement('p', {
            className: 'group-members-empty',
            textContent: 'Failed to load members. The member list may be hidden.',
        });
        pane.appendChild(errorMsg);
    }
}

async function loadMembersPage(membersList, groupId, page, ownerId, myStatus) {
    membersList.innerHTML = '<div class="group-members-loading"><span class="material-symbols-outlined spinner">refresh</span> Loading...</div>';

    try {
        const membersData = await window.API.getGroupMembers(groupId, page, 0, true);
        membersList.innerHTML = '';
        for (const member of membersData.entries) {
            membersList.appendChild(createMemberNode(member, ownerId, myStatus, groupId));
        }
        applyTooltips();
    } catch (_error) {
        membersList.innerHTML = '<p class="group-members-empty">Failed to load members.</p>';
    }
}

// ============================
// INVITE FRIEND PICKER
// ============================

function showInvitePicker(parentPane, groupId) {
    // Remove existing picker if open
    const existing = parentPane.querySelector('.group-invite-picker');
    if (existing) {
        existing.remove();
        return;
    }

    const picker = createElement('div', { className: 'group-invite-picker' });

    const searchInput = createElement('input', { className: 'group-invite-search' });
    searchInput.type = 'text';
    searchInput.placeholder = 'Search friends...';
    picker.appendChild(searchInput);

    const friendsList = createElement('div', { className: 'group-invite-friends-list' });

    function renderFriends(filter) {
        friendsList.innerHTML = '';
        const friends = Object.values(friendsData);
        const filtered = filter
            ? friends.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()))
            : friends;

        if (filtered.length === 0) {
            friendsList.innerHTML = '<p class="group-members-empty">No friends found.</p>';
            return;
        }

        for (const friend of filtered) {
            const row = createElement('div', { className: 'group-invite-friend-row' });
            const img = createElement('img', {
                className: 'group-member-image',
                src: getCachedImage(friend.imageHash),
            });
            if (friend.imageHash) img.dataset.hash = friend.imageHash;

            const name = createElement('span', {
                className: 'group-member-name',
                textContent: decodeHtmlEntities(friend.name),
            });

            const invBtn = createElement('button', {
                className: 'group-invite-send-btn',
                innerHTML: '<span class="material-symbols-outlined">send</span>',
            });
            invBtn.dataset.tooltip = `Invite ${decodeHtmlEntities(friend.name)}`;
            invBtn.addEventListener('click', async () => {
                try {
                    await window.API.inviteUserToGroup(groupId, friend.id);
                    pushToast(`Invited ${decodeHtmlEntities(friend.name)}`, 'success');
                    invBtn.disabled = true;
                    invBtn.innerHTML = '<span class="material-symbols-outlined">check</span>';
                } catch (_err) {
                    pushToast('Failed to send invite', 'error');
                }
            });

            row.append(img, name, invBtn);
            friendsList.appendChild(row);
        }
        applyTooltips();
    }

    searchInput.addEventListener('input', () => renderFriends(searchInput.value));
    renderFriends('');

    picker.appendChild(friendsList);

    // Insert picker after the invite section
    const inviteSection = parentPane.querySelector('.group-invite-section');
    if (inviteSection) {
        inviteSection.after(picker);
    } else {
        parentPane.prepend(picker);
    }

    searchInput.focus();
}

// ============================
// SETTINGS TAB
// ============================

function showSettingsTab(container, group) {
    container.innerHTML = '';
    const pane = createElement('div', { className: 'group-tab-pane group-settings-pane' });

    // Name
    const nameField = createSettingField('Group Name', 'text', decodeHtmlEntities(group.name), {
        maxLength: 32,
        minLength: 3,
    });
    pane.appendChild(nameField.wrapper);

    // Description
    const descField = createSettingTextarea('Description', decodeHtmlEntities(group.description) || '', {
        maxLength: 1000,
    });
    pane.appendChild(descField.wrapper);

    // Image
    const imageField = createSettingImagePicker('Group Image');
    pane.appendChild(imageField.wrapper);

    // Listed
    const listedField = createSettingCheckbox('Listed in Search', group.settingListed);
    pane.appendChild(listedField.wrapper);

    // Join Privacy
    const joinOptions = [
        { value: 0, label: 'Public' },
        { value: 1, label: 'Request' },
        { value: 2, label: 'Invite' },
        { value: 3, label: 'Locked' },
    ];
    const joinField = createSettingSelect('Join Privacy', joinOptions, group.settingPrivacyJoin);
    pane.appendChild(joinField.wrapper);

    // Member Publicity
    const memberPubOptions = [
        { value: 0, label: 'Public' },
        { value: 1, label: 'Members' },
        { value: 2, label: 'Hidden' },
    ];
    const memberPubField = createSettingSelect('Member Publicity', memberPubOptions, group.settingMemberPublicity);
    pane.appendChild(memberPubField.wrapper);

    // Event Publicity
    const eventPubOptions = [
        { value: 0, label: 'Public' },
        { value: 1, label: 'Members' },
    ];
    const eventPubField = createSettingSelect('Event Publicity', eventPubOptions, group.settingEventPublicity);
    pane.appendChild(eventPubField.wrapper);

    // Single save button
    const buttonsRow = createElement('div', { className: 'group-settings-buttons' });

    const saveBtn = createElement('button', {
        className: 'group-sidebar-btn group-sidebar-btn-primary',
        innerHTML: '<span class="material-symbols-outlined">save</span> Save Settings',
    });
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        let errors = 0;

        // Name
        const nameVal = nameField.input.value.trim();
        if (nameVal.length < 3 || nameVal.length > 32) {
            pushToast('Name must be 3-32 characters', 'error');
            saveBtn.disabled = false;
            return;
        }
        if (nameVal !== decodeHtmlEntities(group.name)) {
            try {
                await window.API.updateGroupName(group.id, nameVal);
                group.name = nameVal;
            } catch (_err) {
                pushToast('Failed to update name', 'error');
                errors++;
            }
        }

        // Description
        const descVal = descField.textarea.value;
        if (descVal.length > 1000) {
            pushToast('Description must be under 1000 characters', 'error');
            saveBtn.disabled = false;
            return;
        }
        if (descVal !== (decodeHtmlEntities(group.description) || '')) {
            try {
                await window.API.updateGroupDescription(group.id, descVal);
                group.description = descVal;
            } catch (_err) {
                pushToast('Failed to update description', 'error');
                errors++;
            }
        }

        // Image
        const imagePath = imageField.getFilePath();
        if (imagePath) {
            try {
                await window.API.updateGroupImage(group.id, imagePath);
            } catch (_err) {
                pushToast('Failed to update image', 'error');
                errors++;
            }
        }

        // Settings (listed, join, member pub, event pub)
        try {
            await window.API.updateGroupSettings(
                group.id,
                listedField.checkbox.checked,
                parseInt(memberPubField.select.value),
                parseInt(eventPubField.select.value),
                parseInt(joinField.select.value),
            );
        } catch (_err) {
            pushToast('Failed to update settings', 'error');
            errors++;
        }

        saveBtn.disabled = false;

        if (errors === 0) {
            pushToast('Settings saved!', 'success');
        }
    });
    buttonsRow.appendChild(saveBtn);

    pane.appendChild(buttonsRow);
    container.appendChild(pane);
}

// Setting field helpers

function createSettingField(label, type, value, opts = {}) {
    const wrapper = createElement('div', { className: 'group-setting-field' });
    const lbl = createElement('label', { className: 'group-setting-label', textContent: label });
    const input = createElement('input', { className: 'group-setting-input' });
    input.type = type;
    input.value = value || '';
    if (opts.maxLength) input.maxLength = opts.maxLength;
    if (opts.minLength) input.minLength = opts.minLength;
    wrapper.append(lbl, input);
    return { wrapper, input };
}

function createSettingTextarea(label, value, opts = {}) {
    const wrapper = createElement('div', { className: 'group-setting-field' });
    const lbl = createElement('label', { className: 'group-setting-label', textContent: label });
    const textarea = document.createElement('textarea');
    textarea.className = 'group-setting-textarea';
    textarea.value = value || '';
    textarea.rows = 4;
    if (opts.maxLength) textarea.maxLength = opts.maxLength;
    wrapper.append(lbl, textarea);
    return { wrapper, textarea };
}

function createSettingCheckbox(label, checked) {
    const wrapper = createElement('div', { className: 'group-setting-field group-setting-checkbox-field' });
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'group-setting-checkbox';
    checkbox.checked = !!checked;
    const lbl = createElement('label', { className: 'group-setting-label', textContent: label });
    wrapper.append(checkbox, lbl);
    return { wrapper, checkbox };
}

function createSettingSelect(label, options, currentValue) {
    const wrapper = createElement('div', { className: 'group-setting-field' });
    const lbl = createElement('label', { className: 'group-setting-label', textContent: label });
    const select = document.createElement('select');
    select.className = 'group-setting-select';
    for (const opt of options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.label === currentValue) option.selected = true;
        select.appendChild(option);
    }
    wrapper.append(lbl, select);
    return { wrapper, select };
}

function createSettingImagePicker(label) {
    const wrapper = createElement('div', { className: 'group-setting-field' });
    const lbl = createElement('label', { className: 'group-setting-label', textContent: label });

    const row = createElement('div', { className: 'group-setting-image-row' });
    const pathDisplay = createElement('span', {
        className: 'group-setting-image-path',
        textContent: 'No image selected',
    });

    let selectedPath = null;

    const browseBtn = createElement('button', {
        className: 'group-sidebar-btn',
        innerHTML: '<span class="material-symbols-outlined">folder_open</span> Browse',
    });
    browseBtn.addEventListener('click', async () => {
        const filePath = await window.API.selectImageFile();
        if (filePath) {
            selectedPath = filePath;
            // Show just the filename
            const fileName = filePath.split(/[\\/]/).pop();
            pathDisplay.textContent = fileName;
        }
    });

    row.append(pathDisplay, browseBtn);
    wrapper.append(lbl, row);
    return {
        wrapper,
        getFilePath: () => selectedPath,
    };
}

// =========================
// GROUPS LIST PAGE
// =========================

export async function handleGroupsRefresh(groups) {
    log('[On] GetMyGroups');
    log(groups);

    groupsData = groups || { owned: [], member: [] };

    const groupsWrapper = document.querySelector('.groups-wrapper');
    const docFragment = document.createDocumentFragment();

    const allGroups = [
        ...(groupsData.owned || []).map(g => ({ ...g, _ownership: 'owned' })),
        ...(groupsData.member || []).map(g => ({ ...g, _ownership: 'joined' })),
    ];

    const roleUpdateQueue = [];

    for (const group of allGroups) {
        const imgSrc = getCachedImage(group.imageHash);

        const groupNode = createElement('div', {
            className: 'groups-wrapper--groups-node card-node',
            innerHTML: `
                <div class="thumbnail-container">
                    <img src="${imgSrc}" data-hash="${group.imageHash}" class="hidden"/>
                </div>
                <div class="card-content">
                    <p class="card-name">${decodeHtmlEntities(group.name)}</p>
                    <div class="card-detail">
                        <span class="material-symbols-outlined">group</span>${group.memberCount || 0} members
                    </div>
                    <div class="card-detail card-role-detail">
                        <span class="material-symbols-outlined">${group._ownership === 'owned' ? 'shield' : 'login'}</span>${group._ownership === 'owned' ? 'Owner' : 'Joined'}
                    </div>
                </div>
            `,
            onClick: () => showGroupDetails(group.id),
        });

        groupNode.dataset.ownership = group._ownership;

        const thumbnailContainer = groupNode.querySelector('.thumbnail-container');
        setImageSource(thumbnailContainer, group.imageHash, true);

        // Queue joined groups to resolve actual role
        if (group._ownership === 'joined' && currentUserId) {
            roleUpdateQueue.push({ groupId: group.id, node: groupNode });
        }

        docFragment.appendChild(groupNode);
    }

    groupsWrapper.replaceChildren(docFragment);

    // Resolve actual roles for joined groups in the background
    for (const { groupId, node } of roleUpdateQueue) {
        try {
            const role = await findMyRole(groupId, currentUserId);
            if (role) {
                const roleDetail = node.querySelector('.card-role-detail');
                if (roleDetail) {
                    roleDetail.innerHTML = `<span class="material-symbols-outlined">${getRoleIcon(role)}</span>${role}`;
                }
            }
        } catch (_err) {
            log(`Failed to resolve role for group ${groupId}`);
        }
    }

    log(`Created ${allGroups.length} group cards in DOM`);

    const loadingElement = document.querySelector('.groups-loading');
    const wrapperElement = document.querySelector('.groups-wrapper');
    if (loadingElement) loadingElement.classList.add('hidden');
    if (wrapperElement) wrapperElement.style.display = '';

    const displayElement = document.querySelector('#display-groups');
    if (displayElement) {
        displayElement.setAttribute('loaded-groups', '');
        displayElement.removeAttribute('loading-groups');
    }

    const activeFilterButton = document.querySelector('.groups-filter-controls .filter-button.active');
    if (activeFilterButton) {
        applyGroupFilter(activeFilterButton.dataset.filter);
    }

    applyTooltips();
}

export async function loadGroups() {
    const loadingElement = document.querySelector('.groups-loading');
    const wrapperElement = document.querySelector('.groups-wrapper');

    if (loadingElement) loadingElement.classList.remove('hidden');
    if (wrapperElement) wrapperElement.style.display = 'none';

    try {
        const groups = await window.API.getMyGroups();
        handleGroupsRefresh(groups);
    } catch (error) {
        log(`Failed to load groups: ${error}`);
        pushToast('Failed to load groups', 'error');
        if (loadingElement) loadingElement.classList.add('hidden');
        if (wrapperElement) wrapperElement.style.display = '';
    }
}

export function applyGroupFilter(filterType) {
    const filterText = document.querySelector('#groups-filter').value.toLowerCase();
    const groupCards = document.querySelectorAll('.groups-wrapper--groups-node');

    groupCards.forEach(card => {
        const groupName = card.querySelector('.card-name').textContent.toLowerCase();
        const matchesText = filterText === '' || groupName.includes(filterText);
        const ownership = card.dataset.ownership;

        let matchesButtonFilter = filterType === 'all' ||
            (filterType === 'owned' && ownership === 'owned') ||
            (filterType === 'joined' && ownership === 'joined');

        if (matchesText && matchesButtonFilter) {
            card.style.display = '';
            card.classList.remove('filtered-item');
        } else {
            card.style.display = 'none';
            card.classList.add('filtered-item');
        }
    });
}

function handleGroupFilterClick(filterType, clickedButton) {
    document.querySelectorAll('.groups-filter-controls .filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    clickedButton.classList.add('active');
    applyGroupFilter(filterType);
}

export function initializeGroupsPage() {
    const filterInput = document.querySelector('#groups-filter');
    if (filterInput) filterInput.value = '';

    document.querySelectorAll('.groups-wrapper--groups-node').forEach((e) => {
        e.classList.remove('filtered-item');
        e.style.display = '';
    });

    const displayElement = document.querySelector('#display-groups');
    if (displayElement && displayElement.hasAttribute('loaded-groups') && !displayElement.hasAttribute('loading-groups')) {
        const loadingElement = document.querySelector('.groups-loading');
        const wrapperElement = document.querySelector('.groups-wrapper');
        if (loadingElement) loadingElement.classList.add('hidden');
        if (wrapperElement && wrapperElement.children.length > 0) wrapperElement.style.display = '';
    }

    const allButton = document.querySelector('.groups-filter-controls .filter-button[data-filter="all"]');
    if (allButton) handleGroupFilterClick('all', allButton);

    const groupsWrapper = document.querySelector('.groups-wrapper');
    if (groupsWrapper) groupsWrapper.scrollTo({ top: 0, behavior: 'smooth' });
}

export function setupGroupsTextFilter() {
    const groupsFilter = document.querySelector('#groups-filter');
    if (groupsFilter) {
        groupsFilter.addEventListener('input', () => {
            const activeButtonFilter = document.querySelector('.groups-filter-controls .filter-button.active')?.dataset.filter || 'all';
            applyGroupFilter(activeButtonFilter);
        });
    }
}

export function setupGroupsFilterButtons() {
    const filterButtons = document.querySelectorAll('.groups-filter-controls .filter-button');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            handleGroupFilterClick(button.dataset.filter, button);
        });
    });
}

export function setupGroupsRefreshButton() {
    const refreshButton = document.querySelector('#groups-refresh');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            const displayElement = document.querySelector('#display-groups');
            if (displayElement) displayElement.removeAttribute('loaded-groups');
            await loadGroups();
        });
    }
}
