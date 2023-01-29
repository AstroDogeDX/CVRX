'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('API', {
    onSelfLoad: (callback) => ipcRenderer.on('self-load', callback),
    onFriendsUpdates: (callback) => ipcRenderer.on('friends-update', callback),
    onImageLoaded: (callback) => ipcRenderer.on('image-load', callback),
    getUserById: (userId) => ipcRenderer.invoke('get-user-by-id', userId),
    getWorldsActive: () => ipcRenderer.invoke('get-worlds-active'),
    getWorldById: (worldId) => ipcRenderer.invoke('get-world-by-id', worldId),
    getInstanceById: (instanceId) => ipcRenderer.invoke('get-instance-by-id', instanceId),
});
