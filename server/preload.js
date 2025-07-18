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
    getWorldsByCategory: (categoryId, page, sort, direction) => ipcRenderer.invoke('get-worlds-by-category', categoryId, page, sort, direction),
    setWorldAsHome: (worldId) => ipcRenderer.invoke('set-world-as-home', worldId),
    getInstanceById: (instanceId) => ipcRenderer.invoke('get-instance-by-id', instanceId),
    getInstancePortalById: (instanceId) => ipcRenderer.invoke('get-instance-portal-by-id', instanceId),
    joinInstance: (instanceId) => ipcRenderer.invoke('join-instance', instanceId),
    getAvatarById: (avatarId) => ipcRenderer.invoke('get-avatar-by-id', avatarId),
    getPropById: (propId) => ipcRenderer.invoke('get-prop-by-id', propId),
    getProps: () => ipcRenderer.invoke('get-props'),

    // Avatar
    setCurrentAvatar: (avatarId) => ipcRenderer.invoke('set-current-avatar', avatarId),

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

    // Dismissed Invites Tracking
    markInviteDismissed: (inviteId) => ipcRenderer.invoke('mark-invite-dismissed', inviteId),
    markInviteRequestDismissed: (inviteRequestId) => ipcRenderer.invoke('mark-invite-request-dismissed', inviteRequestId),
    isInviteDismissed: (inviteId) => ipcRenderer.invoke('is-invite-dismissed', inviteId),
    isInviteRequestDismissed: (inviteRequestId) => ipcRenderer.invoke('is-invite-request-dismissed', inviteRequestId),

    onFriendRequests: (callback) => ipcRenderer.on('friend-requests', callback),

    onWorldsByCategoryRefresh: (callback) => ipcRenderer.on('worlds-category-requests', callback),

    refreshUserStats: () => ipcRenderer.send('refresh-user-stats'),
    refreshInstances: (fromButton) => ipcRenderer.invoke('refresh-instances', fromButton),
    onUserStats: (callback) => ipcRenderer.on('user-stats', callback),

    refreshFriendRequests: () => ipcRenderer.send('refresh-friend-requests'),
    // refreshWorldsCategory: (worldCategoryId) => ipcRenderer.send('refresh-worlds-category', worldCategoryId),

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

    // Mature content update
    // Gets the current cached state for the mature content (this will always be up to date)
    getMatureContentConfig: () => ipcRenderer.invoke('get-mature-content-config'),
    // Sets the visibility for the mature content (requires mature content to be enabled to work)
    setMatureContentVisibility: (enabled) => ipcRenderer.invoke('set-mature-content-visibility', enabled),
    // Listener that will trigger when the mature content visibility state changes (and triggered 1 time after authentication)
    onMatureContentConfigUpdate: (callback) => ipcRenderer.on('mature-content-config-update', callback),

    // Logging
    logDebug: (msg, optionalData) => ipcRenderer.send('log-debug', msg, optionalData),
    logInfo: (msg, optionalData) => ipcRenderer.send('log-info', msg, optionalData),
    logWarning: (msg, optionalData) => ipcRenderer.send('log-warn', msg, optionalData),
    logError: (msg, optionalData) => ipcRenderer.send('log-error', msg, optionalData),

    // Updater
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    updateAction: (action, updateInfo) => ipcRenderer.invoke('update-action', action, updateInfo),

    // Download progress events
    onUpdateDownloadStarted: (callback) => ipcRenderer.on('update-download-started', callback),
    onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', callback),
    onUpdateDownloadComplete: (callback) => ipcRenderer.on('update-download-complete', callback),
    onDismissUpdatePrompt: (callback) => ipcRenderer.on('dismiss-update-prompt', callback),

    // Websocket
    reconnectWebSocket: () => ipcRenderer.send('reconnect-web-socket'),
    onSocketDied: (callback) => ipcRenderer.on('socket-died', callback),

    // Friend Notifications
    setFriendNotification: (userId, enabled) => ipcRenderer.invoke('set-friend-notification', userId, enabled),
    isFriendNotificationEnabled: (userId) => ipcRenderer.invoke('is-friend-notification-enabled', userId),
    getFriendsWithNotifications: () => ipcRenderer.invoke('get-friends-with-notifications'),

    // System info

    // App Version
    getVersion: () => ipcRenderer.send('get-app-version'),
    receiveVersion: (callback) => ipcRenderer.on('app-version', (event, arg) => callback(arg)),

    // Config
    getConfig: () => ipcRenderer.invoke('config-get'),
    updateConfig: (newConfigSettings) => ipcRenderer.invoke('config-update', newConfigSettings),

    // CVR Executable Selection
    selectCVRExecutable: () => ipcRenderer.invoke('select-cvr-executable'),

    // Categories
    // Returns the last retrieved categories (this does not do an API request)
    getCategories: () => ipcRenderer.invoke('get-categories'),
    // Fetches current categories, and will trigger an update on update-categories
    // Only useful if the categories changed outside CVRX, and we want to fetch the current categories
    updateCategories: () => ipcRenderer.send('update-categories'),
    // Will trigger when we fetch the current categories
    // Will happen when: updateCategories, createCategoryX, deleteCategoryX, reorderCategoriesX
    onCategoriesUpdated: (callback) => ipcRenderer.on('categories-updated', callback),
    // Categories - Assign
    setFriendCategories: (userId, categoryIds) => ipcRenderer.invoke('assign-categories-friend', userId, categoryIds),
    setAvatarCategories: (avatarId, categoryIds) => ipcRenderer.invoke('assign-categories-avatar', avatarId, categoryIds),
    setPropCategories: (propId, categoryIds) => ipcRenderer.invoke('assign-categories-prop', propId, categoryIds),
    setWorldCategories: (worldId, categoryIds) => ipcRenderer.invoke('assign-categories-world', worldId, categoryIds),
    // Categories - Create
    createFriendCategory: (categoryName) => ipcRenderer.invoke('create-category-friend', categoryName),
    createAvatarCategory: (categoryName) => ipcRenderer.invoke('create-category-avatar', categoryName),
    createPropCategory: (categoryName) => ipcRenderer.invoke('create-category-prop', categoryName),
    createWorldCategory: (categoryName) => ipcRenderer.invoke('create-category-world', categoryName),
    // Categories - Delete
    deleteFriendCategory: (categoryId) => ipcRenderer.invoke('delete-category-friend', categoryId),
    deleteAvatarCategory: (categoryId) => ipcRenderer.invoke('delete-category-avatar', categoryId),
    deletePropCategory: (categoryId) => ipcRenderer.invoke('delete-category-prop', categoryId),
    deleteWorldCategory: (categoryId) => ipcRenderer.invoke('delete-category-world', categoryId),
    // Categories - Reorder Categories (only needs the ids for the custom user categories to be sent)
    reorderFriendCategories: (newOrderedCategoryIds) => ipcRenderer.invoke('reorder-categories-friend', newOrderedCategoryIds),
    reorderAvatarCategories: (newOrderedCategoryIds) => ipcRenderer.invoke('reorder-categories-avatar', newOrderedCategoryIds),
    reorderPropCategories: (newOrderedCategoryIds) => ipcRenderer.invoke('reorder-categories-prop', newOrderedCategoryIds),
    reorderWorldCategories: (newOrderedCategoryIds) => ipcRenderer.invoke('reorder-categories-world', newOrderedCategoryIds),


    // Cache
    clearCachedImages: () => ipcRenderer.invoke('clear-cached-images'),

    // External Links
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    openLogsFolder: () => ipcRenderer.send('open-logs-folder'),

    // Process Detection
    isChilloutVRRunning: () => ipcRenderer.invoke('is-chilloutvr-running'),

    // Advanced Avatar Settings
    hasAvatarAdvancedSettings: (avatarId) => ipcRenderer.invoke('has-avatar-advanced-settings', avatarId),
    getAvatarAdvancedSettings: (avatarId) => ipcRenderer.invoke('get-avatar-advanced-settings', avatarId),
    saveAvatarAdvancedSettings: (avatarId, settings) => ipcRenderer.invoke('save-avatar-advanced-settings', avatarId, settings),

    // Custom Notification System
    showCustomNotification: (notificationData) => ipcRenderer.invoke('custom-notification-show', notificationData),
    closeAllCustomNotifications: () => ipcRenderer.invoke('custom-notification-close-all'),
    getCustomNotificationCount: () => ipcRenderer.invoke('custom-notification-get-count'),
    forceNotificationStartupComplete: () => ipcRenderer.invoke('custom-notification-force-startup-complete'),

    // Test
    // closeTest: (closeCode, close) => ipcRenderer.send('close-socket-server', closeCode, close),
});
