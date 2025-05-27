'use strict';

const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('API', {

    // Webframe
    getResourceUsage: () => webFrame.getResourceUsage(),
    clearCache: () => webFrame.clearCache(),
    isPackaged: () => ipcRenderer.invoke('is-packaged'),
    isDevToolsOpened: () => ipcRenderer.invoke('is-dev-tools-opened'),
    getLocale: () => ipcRenderer.invoke('get-locale'),

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

    // Users
    getUserById: (userId) => ipcRenderer.invoke('get-user-by-id', userId),
    getUserPublicAvatars: (userId) => ipcRenderer.invoke('get-user-public-avatars', userId),
    getUserPublicProps: (userId) => ipcRenderer.invoke('get-user-public-props', userId),
    getUserPublicWorlds: (userId) => ipcRenderer.invoke('get-user-public-worlds', userId),
    setFriendNote: (userId, note) => ipcRenderer.invoke('set-friend-note', userId, note),

    getWorldById: (worldId) => ipcRenderer.invoke('get-world-by-id', worldId),
    getWorldMetaById: (worldId) => ipcRenderer.invoke('get-world-meta-by-id', worldId),
    getWorldPortalById: (worldId) => ipcRenderer.invoke('get-world-portal-by-id', worldId),
    setWorldAsHome: (worldId) => ipcRenderer.invoke('set-world-as-home', worldId),
    getInstanceById: (instanceId) => ipcRenderer.invoke('get-instance-by-id', instanceId),
    getInstancePortalById: (instanceId) => ipcRenderer.invoke('get-instance-portal-by-id', instanceId),
    joinInstance: (instanceId) => ipcRenderer.invoke('join-instance', instanceId),
    getAvatarById: (avatarId) => ipcRenderer.invoke('get-avatar-by-id', avatarId),
    getPropById: (propId) => ipcRenderer.invoke('get-prop-by-id', propId),
    getProps: () => ipcRenderer.invoke('get-props'),

    search: (term) => ipcRenderer.invoke('search', term),


    // Get Random Content
    getRandomAvatars: (count) => ipcRenderer.invoke('get-random-avatars', count),
    getRandomWorlds: (count) => ipcRenderer.invoke('get-random-worlds', count),
    getRandomProps: (count) => ipcRenderer.invoke('get-random-props', count),


    // Content Shares (Get)
    getAvatarShares: (avatarId) => ipcRenderer.invoke('get-avatar-shares', avatarId),
    getPropShares: (propId) => ipcRenderer.invoke('get-prop-shares', propId),
    // Content Shares (Add)
    addAvatarShares: (avatarId, userId) => ipcRenderer.invoke('add-avatar-share', avatarId, userId),
    addPropShares: (propId, userId) => ipcRenderer.invoke('add-prop-share', propId, userId),
    // Content Shares (Remove)
    removeAvatarShares: (avatarId, userId) => ipcRenderer.invoke('remove-avatar-share', avatarId, userId),
    removePropShares: (propId, userId) => ipcRenderer.invoke('remove-prop-share', propId, userId),


    onInvites: (callback) => ipcRenderer.on('invites', callback),
    onInviteRequests: (callback) => ipcRenderer.on('invite-requests', callback),

    onFriendRequests: (callback) => ipcRenderer.on('friend-requests', callback),

    onWorldsByCategoryRefresh: (callback) => ipcRenderer.on('worlds-category-requests', callback),

    refreshUserStats: () => ipcRenderer.send('refresh-user-stats'),
    refreshInstances: (fromButton) => ipcRenderer.invoke('refresh-instances', fromButton),
    onUserStats: (callback) => ipcRenderer.on('user-stats', callback),

    refreshFriendRequests: () => ipcRenderer.send('refresh-friend-requests'),
    refreshWorldsCategory: (worldCategoryId) => ipcRenderer.send('refresh-worlds-category', worldCategoryId),

    // Recent Activity Updates
    onRecentActivityUpdate: (callback) => ipcRenderer.on('recent-activity-update', callback),

    // Active instances
    onActiveInstancesUpdate: (callback) => ipcRenderer.on('active-instances-update', callback),

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

    // Updater
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    updateAction: (action, updateInfo) => ipcRenderer.invoke('update-action', action, updateInfo),

    // Websocket
    reconnectWebSocket: () => ipcRenderer.send('reconnect-web-socket'),
    onSocketDied: (callback) => ipcRenderer.on('socket-died', callback),

    // App Version
    getVersion: () => ipcRenderer.send('get-app-version'),
    receiveVersion: (callback) => ipcRenderer.on('app-version', (event, arg) => callback(arg)),

    // Config
    getConfig: () => ipcRenderer.invoke('config-get'),
    updateConfig: (newConfigSettings) => ipcRenderer.invoke('config-update', newConfigSettings),

    // Cache
    clearCachedImages: () => ipcRenderer.invoke('clear-cached-images'),

    // External Links
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Test
    // closeTest: (closeCode, close) => ipcRenderer.send('close-socket-server', closeCode, close),
});