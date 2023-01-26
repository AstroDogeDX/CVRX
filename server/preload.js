'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('API', {
    onFriendsUpdates: (callback) => ipcRenderer.on('friends-update', callback),
    onFriendsImageLoaded: (callback) => ipcRenderer.on('friends-image-load', callback),
});
