'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API for notification windows
contextBridge.exposeInMainWorld('NotificationAPI', {
    // Receive notification data from main process
    onNotificationData: (callback) => ipcRenderer.on('notification-data', callback),
    
    // Send actions back to main process
    closeNotification: () => ipcRenderer.send('notification-close'),
    clickNotification: (actionData) => ipcRenderer.send('notification-click', actionData),
    
    // Handle notification actions (buttons, etc.)
    performAction: (actionType, actionData) => ipcRenderer.send('notification-action', actionType, actionData),
    
    // Handle mouse events
    notifyMouseEnter: () => ipcRenderer.send('notification-mouse-enter'),
    notifyMouseLeave: () => ipcRenderer.send('notification-mouse-leave'),
    
    // Logging for notifications (using the same logging system as main app)
    logDebug: (msg, optionalData) => ipcRenderer.send('notification-log-debug', msg, optionalData),
    logInfo: (msg, optionalData) => ipcRenderer.send('notification-log-info', msg, optionalData),
    logWarning: (msg, optionalData) => ipcRenderer.send('notification-log-warn', msg, optionalData),
    logError: (msg, optionalData) => ipcRenderer.send('notification-log-error', msg, optionalData),
}); 