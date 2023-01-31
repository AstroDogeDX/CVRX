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
});
