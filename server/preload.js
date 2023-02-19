'use strict';

const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('API', {

    // Webframe
    getResourceUsage: () => webFrame.getResourceUsage(),
    clearCache: () => webFrame.clearCache(),

    // Pages
    onLoginPage: (callback) => ipcRenderer.on('page-login', callback),
    onLoadingPage: (callback) => ipcRenderer.on('page-loading', callback),
    onHomePage: (callback) => ipcRenderer.on('page-home', callback),

    // Account management
    authenticate: (username, credential, isAccessKey, saveCredentials) => ipcRenderer.invoke('login-authenticate', username, credential, isAccessKey, saveCredentials),
    logout: () => ipcRenderer.send('logout'),
    deleteCredentials: (username) => ipcRenderer.invoke('delete-credentials', username),
    importGameCredentials: () => ipcRenderer.invoke('import-game-credentials'),

    // Active user
    onGetActiveUser: (callback) => ipcRenderer.on('active-user-load', callback),
    refreshGetActiveUser: () => ipcRenderer.send('active-user-refresh'),

    onGetActiveUserAvatars: (callback) => ipcRenderer.on('active-user-avatars-load', callback),
    refreshGetActiveUserAvatars: () => ipcRenderer.send('active-user-avatars-refresh'),

    onGetActiveUserProps: (callback) => ipcRenderer.on('active-user-props-load', callback),
    refreshGetActiveUserProps: () => ipcRenderer.send('active-user-props-refresh'),

    onGetActiveUserWorlds: (callback) => ipcRenderer.on('active-user-worlds-load', callback),
    refreshGetActiveUserWorlds: () => ipcRenderer.send('active-user-worlds-refresh'),


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

    // Recent Activity Updates
    onRecentActivityUpdate: (callback) => ipcRenderer.on('recent-activity-update', callback),

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

    // Logging
    logDebug: (msg, optionalData) => ipcRenderer.send('log-debug', msg, optionalData),
    logInfo: (msg, optionalData) => ipcRenderer.send('log-info', msg, optionalData),
    logWarning: (msg, optionalData) => ipcRenderer.send('log-warn', msg, optionalData),
    logError: (msg, optionalData) => ipcRenderer.send('log-error', msg, optionalData),

    // Test
    // closeTest: (closeCode, close) => ipcRenderer.send('close-socket-server', closeCode, close),
});
