'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('API', {

    onGetActiveUser: (callback) => ipcRenderer.on('active-user-load', callback),

    onFriendsRefresh: (callback) => ipcRenderer.on('friends-refresh', callback),

    onImageLoaded: (callback) => ipcRenderer.on('image-load', callback),

    getUserById: (userId) => ipcRenderer.invoke('get-user-by-id', userId),
    getWorldById: (worldId) => ipcRenderer.invoke('get-world-by-id', worldId),
    getInstanceById: (instanceId) => ipcRenderer.invoke('get-instance-by-id', instanceId),

    search: (term) => ipcRenderer.invoke('search', term),

    onInvites: (callback) => ipcRenderer.on('invites', callback),
    onInviteRequests: (callback) => ipcRenderer.on('invite-requests', callback),

    onFriendRequests: (callback) => ipcRenderer.on('friend-requests', callback),

    onWorldsByCategoryRefresh: (callback) => ipcRenderer.on('worlds-category-requests', callback),

    refreshUserStats: () => ipcRenderer.send('refresh-user-stats'),
    onUserStats: (callback) => ipcRenderer.on('user-stats', callback),

    refreshFriendRequests: () => ipcRenderer.send('refresh-friend-requests'),
    refreshWorldsCategory: (worldCategoryId) => ipcRenderer.send('refresh-worlds-category', worldCategoryId),

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

    // Flow Events
    onInitialLoadStart: (callback) => ipcRenderer.on('initial-load-start', callback),
    onInitialLoadFinish: (callback) => ipcRenderer.on('initial-load-finish', callback),

    // Test
    // closeTest: (closeCode, close) => ipcRenderer.send('close-socket-server', closeCode, close),
});
