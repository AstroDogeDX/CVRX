const { Notification } = require('electron');
const NotificationManager = require('./notification-manager');
const Config = require('./config');
const { getXSOverlayClient } = require('./xsoverlay-client');
const log = require('./logger').GetLogger('NotificationHelper');

// Unified notification helper that chooses between custom and native notifications
class NotificationHelper {
    
    // Show a notification using the appropriate system
    // notificationOptions - Notification options
    // Returns: Result object with success status
    static async showNotification(notificationOptions) {
        try {
            let primaryResult = null;
            
            // Check if custom notifications are enabled and available
            const useCustom = Config.GetCustomNotificationsEnabled() !== false;
            
            if (useCustom) {
                // Try to show custom notification first
                primaryResult = await this.showCustomNotification(notificationOptions);
                if (!primaryResult.success) {
                    // If custom notification failed, fall back to native
                    log.warn('Custom notification failed, falling back to native notification');
                    primaryResult = this.showNativeNotification(notificationOptions);
                }
            } else {
                // Use native Electron notification
                primaryResult = this.showNativeNotification(notificationOptions);
            }
            
            // Send to XSOverlay if enabled (in parallel, don't block main notification)
            this.sendToXSOverlay(notificationOptions).catch(error => {
                log.debug('XSOverlay notification failed (this is normal if XSOverlay is not running):', error.message);
            });
            
            return primaryResult;
            
        } catch (error) {
            log.error('Failed to show notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Show a custom notification using the NotificationManager
    // options - Notification options
    // Returns: Result object
    static async showCustomNotification(options) {
        try {
            // Convert options to custom notification format
            const customNotificationData = this.convertToCustomFormat(options);
            
            const window = await NotificationManager.showNotification(customNotificationData);
            
            return {
                success: true,
                type: 'custom',
                windowId: window ? window.id : null
            };
        } catch (error) {
            log.error('Failed to show custom notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Show a native Electron notification
    // options - Notification options
    // Returns: Result object
    static showNativeNotification(options) {
        try {
            // Convert to native notification format
            const nativeOptions = this.convertToNativeFormat(options);
            
            const notification = new Notification(nativeOptions);
            
            // Set up event handlers if provided
            if (options.onClick) {
                notification.on('click', options.onClick);
            }
            
            notification.show();
            
            return {
                success: true,
                type: 'native',
                notification: notification
            };
        } catch (error) {
            log.error('Failed to show native notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Convert unified options to custom notification format
    // options - Unified notification options
    // Returns: Custom notification data
    static convertToCustomFormat(options) {
        const customData = {
            title: options.title || 'Notification',
            message: options.body || options.message || '',
            type: options.type || 'info',
            icon: options.icon,
            timeout: options.timeout,
            options: {
                closeOnClick: options.closeOnClick !== false
            }
        };

        // Handle image/avatar
        if (options.image || options.avatar) {
            const imageSource = options.image || options.avatar;
            // If it's an object with imageUrl, use that for the custom notification
            // If it's a string URL, use it directly
            customData.image = (typeof imageSource === 'object' && imageSource.imageUrl) 
                ? imageSource.imageUrl 
                : imageSource;
            customData.imageAlt = options.imageAlt || options.title || '';
        }

        // Handle action buttons
        if (options.actions && Array.isArray(options.actions)) {
            customData.actions = options.actions.map(action => ({
                text: action.text || action.title,
                type: action.type || 'action',
                data: action.data || {},
                icon: action.icon,
                primary: action.primary || false,
                closeOnClick: action.closeOnClick !== false
            }));
        }

        // Handle progress
        if (options.progress !== undefined) {
            customData.progress = Math.max(0, Math.min(100, options.progress));
        }

        return customData;
    }

    // Convert unified options to native Electron notification format
    // options - Unified notification options
    // Returns: Native notification options
    static convertToNativeFormat(options) {
        const path = require('path');
        const { app } = require('electron');
        
        const nativeOptions = {
            title: options.title || 'CVRX',
            body: options.body || options.message || '',
            silent: options.silent || false
        };

        // Add icon - use app icon as fallback
        let iconPath = options.icon;
        
        // Handle image object with imageUrl property
        if (options.image && typeof options.image === 'object' && options.image.imageUrl) {
            // For native notifications, we can't use URLs directly, so fall back to app icon
            iconPath = null;
        } else if (options.image && typeof options.image === 'string') {
            iconPath = options.image;
        }
        
        if (iconPath && typeof iconPath === 'string') {
            // If it's a file path, use it directly
            if (iconPath.includes('.') || iconPath.includes('/') || iconPath.includes('\\')) {
                nativeOptions.icon = iconPath;
            } else {
                // Otherwise, use the app's icon as fallback
                nativeOptions.icon = path.resolve(app.getAppPath(), "client", "img", "cvrx-ico-256.ico");
            }
        } else {
            // Use app icon as default
            nativeOptions.icon = path.resolve(app.getAppPath(), "client", "img", "cvrx-ico-256.ico");
        }

        // Add action buttons for supported platforms
        if (options.actions && Array.isArray(options.actions) && process.platform === 'win32') {
            nativeOptions.actions = options.actions.map(action => ({
                type: 'button',
                text: action.text || action.title || 'Action'
            }));
        }

        return nativeOptions;
    }

    // Send notification to XSOverlay if enabled
    // options - Unified notification options
    // Returns: Promise
    static async sendToXSOverlay(options) {
        // Check if XSOverlay notifications are enabled
        if (!Config.GetXSOverlayNotificationsEnabled()) {
            log.debug('XSOverlay notifications disabled, skipping');
            return Promise.resolve();
        }

        try {
            log.info('[XSOverlay] Attempting to send notification:', {
                title: options.title,
                hasImage: !!(options.image || options.avatar),
                imageType: typeof (options.image || options.avatar)
            });
            
            const xsClient = getXSOverlayClient();
            
            // Ensure client is connected
            if (!xsClient.isReady()) {
                log.info('[XSOverlay] Client not ready, connecting...');
                await xsClient.connect();
            }

            // Convert to XSOverlay format
            const xsNotification = await this.convertToXSOverlayFormat(options);
            log.debug('[XSOverlay] Converted notification:', xsNotification);
            
            // Send the notification
            const result = await xsClient.sendNotification(xsNotification);
            log.info('[XSOverlay] Notification processing completed');
            return result;
            
        } catch (error) {
            log.warn('Failed to send XSOverlay notification:', error.message);
            throw error;
        }
    }

    // Convert unified options to XSOverlay notification format
    // options - Unified notification options
    // Returns: XSOverlay notification object
    static async convertToXSOverlayFormat(options) {
        const xsNotification = {
            title: options.title || 'CVRX',
            content: options.body || options.message || '',
            timeout: 5.0, // Longer timeout for visibility
            height: 175,  // Default height
            opacity: 1.0, // Full opacity
            icon: ''      // Will be set below
        };

        // Handle cached image file path for XSOverlay
        if (options.image || options.avatar) {
            try {
                const cachedImagePath = await this.getCachedImagePath(options.image || options.avatar);
                if (cachedImagePath) {
                    xsNotification.icon = cachedImagePath;
                    log.debug('[XSOverlay] Using cached image file:', cachedImagePath);
                } else {
                    log.debug('[XSOverlay] No cached image available, using default icon');
                    xsNotification.icon = 'default';
                }
            } catch (error) {
                log.debug('Failed to get cached image path for XSOverlay:', error.message);
                xsNotification.icon = 'default';
            }
        } else {
            // Use default icon if no image provided
            xsNotification.icon = 'default';
            log.debug('[XSOverlay] No image provided, using default icon');
        }

        return xsNotification;
    }

    // Get cached image file path for XSOverlay
    // imageSource - Image URL, path, or object with imageUrl property
    // Returns: File path string or null
    static async getCachedImagePath(imageSource) {
        if (!imageSource) return null;
        
        try {
            let imageUrl = null;
            
            // If it's an object with imageUrl property (from CVRX cache system)
            if (typeof imageSource === 'object' && imageSource.imageUrl) {
                imageUrl = imageSource.imageUrl;
            }
            // If it's a string URL
            else if (typeof imageSource === 'string' && !imageSource.startsWith('data:image')) {
                imageUrl = imageSource;
            }

            if (imageUrl) {
                const cache = require('./cache');
                const cachedPath = await cache.GetCachedImagePath(imageUrl);
                if (cachedPath) {
                    log.debug('[XSOverlay] Found cached image file:', cachedPath);
                    return cachedPath;
                }
                log.debug('[XSOverlay] Image not found in cache:', imageUrl);
            }
            
            return null;
            
        } catch (error) {
            log.debug('Error getting cached image path:', error.message);
            return null;
        }
    }

    // Close all custom notifications
    // Returns: Result object
    static async closeAllCustomNotifications() {
        try {
            NotificationManager.closeAllNotifications();
            return { success: true };
        } catch (error) {
            log.error('Failed to close all custom notifications:', error);
            return { success: false, error: error.message };
        }
    }

    // Get notification counts
    // Returns: Notification counts
    static getNotificationCounts() {
        try {
            return {
                active: NotificationManager.getActiveNotificationCount(),
                queued: NotificationManager.getQueuedNotificationCount()
            };
        } catch (error) {
            log.error('Failed to get notification counts:', error);
            return { active: 0, queued: 0 };
        }
    }

    // Convenience methods for different notification types
    
    static async showInviteNotification(inviteData) {
        const userName = inviteData.user?.name || 'Someone';
        const worldName = inviteData.world?.name || 'Unknown World';
        
        return this.showNotification({
            title: 'ChilloutVR Invite',
            message: `${userName} invited you to ${worldName}`,
            type: 'invite',
            icon: 'mail',
            image: inviteData.user, // Pass the whole user object for base64 access
            actions: [
                {
                    text: 'Join Desktop',
                    type: 'join-desktop',
                    data: { instanceId: inviteData.instanceId },
                    icon: 'desktop_windows',
                    primary: true
                },
                {
                    text: 'Join VR',
                    type: 'join-vr', 
                    data: { instanceId: inviteData.instanceId },
                    icon: 'view_in_ar'
                }
            ]
        });
    }

    static async showInviteRequestNotification(requestData) {
        const senderName = requestData.sender?.name || 'Someone';
        
        return this.showNotification({
            title: 'ChilloutVR Invite Request',
            message: `${senderName} requested an invite from you`,
            type: 'invite',
            icon: 'person_add',
            image: requestData.sender // Pass the whole sender object for base64 access
        });
    }

    static async showFriendOnlineNotification(friendData) {
        const friendName = friendData.name || 'Friend';
        
        // Determine friend's current state and instance information
        let notificationMessage = `${friendName} is now online`;
        let notificationActions = [];
        
        // Check if friend is in an accessible instance (not Offline Instance or Private Instance)
        if (friendData.isOnline && friendData.isConnected && friendData.instance) {
            // Friend is in an accessible instance
            const instanceName = friendData.instance.name || 'Unknown Instance';
            notificationMessage = `${friendName} is now online in ${instanceName}`;
            
            // Add deeplink buttons to join them
            notificationActions = [
                {
                    text: 'Join Desktop',
                    type: 'join-desktop',
                    data: { instanceId: friendData.instance.id },
                    icon: 'desktop_windows',
                    primary: true
                },
                {
                    text: 'Join VR',
                    type: 'join-vr',
                    data: { instanceId: friendData.instance.id },
                    icon: 'view_in_ar'
                }
            ];
        } else if (friendData.isOnline && !friendData.isConnected) {
            // Friend is in an Offline Instance
            notificationMessage = `${friendName} is now online in an Offline Instance`;
        } else if (friendData.isOnline && friendData.isConnected && !friendData.instance) {
            // Friend is in a Private Instance
            notificationMessage = `${friendName} is now online in a Private Instance`;
        }
        
        return this.showNotification({
            title: 'Friend Online',
            message: notificationMessage,
            type: 'friend',
            icon: 'person',
            image: friendData, // Pass the whole friend object for base64 access
            actions: notificationActions
        });
    }

    static async showUpdateNotification(updateData) {
        return this.showNotification({
            title: 'CVRX Update Available',
            message: `Version ${updateData.version} is available for download`,
            type: 'info',
            icon: 'system_update',
            actions: [
                {
                    text: 'Download',
                    type: 'download-update',
                    data: {
                        version: updateData.version,
                        tagName: updateData.version,
                        downloadUrl: updateData.downloadUrl,
                        fileName: updateData.fileName,
                        changeLogs: updateData.changeLogs
                    },
                    primary: true
                },
                {
                    text: 'Later',
                    type: 'later',
                    data: {
                        tagName: updateData.version,
                        version: updateData.version,
                        downloadUrl: updateData.downloadUrl,
                        fileName: updateData.fileName,
                        changeLogs: updateData.changeLogs
                    }
                }
            ]
        });
    }

    static async showMinimizeNotification() {
        return this.showNotification({
            title: 'CVRX',
            message: 'CVRX is still running in the System Tray',
            type: 'mute',
            icon: 'minimize'
        });
    }

    // Test method for XSOverlay - can be called from main process for testing
    static async testXSOverlayNotification() {
        log.info('[XSOverlay] Sending test notification...');
        return this.showNotification({
            title: 'XSOverlay Test',
            message: 'This is a test notification from CVRX',
            type: 'info'
        });
    }
}

module.exports = NotificationHelper; 