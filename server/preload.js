'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('API', {
    onGetActiveUser: (callback) => ipcRenderer.on('active-user-load', callback),

    onFriendsRefresh: (callback) => ipcRenderer.on('friends-refresh', callback),

    onImageLoaded: (callback) => ipcRenderer.on('image-load', callback),

    getUserById: (userId) => ipcRenderer.invoke('get-user-by-id', userId),
    getWorldsByCategory: (worldCategory) => ipcRenderer.invoke('get-worlds-by-category', worldCategory),
    getWorldById: (worldId) => ipcRenderer.invoke('get-world-by-id', worldId),
    getInstanceById: (instanceId) => ipcRenderer.invoke('get-instance-by-id', instanceId),

    search: (term) => ipcRenderer.invoke('search', term),

    OnInvites: (callback) => ipcRenderer.on('invites', callback),
    OnInviteRequests: (callback) => ipcRenderer.on('invite-requests', callback),

    OnFriendRequests: (callback) => ipcRenderer.on('friend-requests', callback),

    refreshFriendRequests: () => ipcRenderer.send('refresh-friend-requests'),

    // Friendship
    sendFriendRequest: (userId) => ipcRenderer.invoke('friend-request-send', userId),
    acceptFriendRequest: (userId) => ipcRenderer.invoke('friend-request-accept', userId),
    declineFriendRequest: (userId) => ipcRenderer.invoke('friend-request-decline', userId),
    unfriend: (userId) => ipcRenderer.invoke('unfriend', userId),

    // Moderation
    blockUser: (userId) => ipcRenderer.invoke('block-user', userId),
    unblockUser: (userId) => ipcRenderer.invoke('unblock-user', userId),

    // Notifications
    onNotification: (callback) => ipcRenderer.on('notification', callback),
});
