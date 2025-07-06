const { Notification } = require('electron');
const NotificationManager = require('./notification-manager');
const Config = require('./config');
const log = require('./logger').GetLogger('NotificationHelper');

/**
 * Unified notification helper that chooses between custom and native notifications
 */
class NotificationHelper {
    
    /**
     * Show a notification using the appropriate system
     * @param {Object} notificationOptions - Notification options
     * @returns {Promise<Object>} Result object with success status
     */
    static async showNotification(notificationOptions) {
        try {
            // Check if custom notifications are enabled and available
            const useCustom = Config.GetCustomNotificationsEnabled() !== false;
            
            if (useCustom) {
                // Try to show custom notification first
                const result = await this.showCustomNotification(notificationOptions);
                if (result.success) {
                    return result;
                }
                
                // If custom notification failed, fall back to native
                log.warn('Custom notification failed, falling back to native notification');
            }
            
            // Use native Electron notification as fallback
            return this.showNativeNotification(notificationOptions);
            
        } catch (error) {
            log.error('Failed to show notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Show a custom notification using the NotificationManager
     * @param {Object} options - Notification options
     * @returns {Promise<Object>} Result object
     */
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

    /**
     * Show a native Electron notification
     * @param {Object} options - Notification options
     * @returns {Object} Result object
     */
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

    /**
     * Convert unified options to custom notification format
     * @param {Object} options - Unified notification options
     * @returns {Object} Custom notification data
     */
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
            customData.image = options.image || options.avatar;
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

    /**
     * Convert unified options to native Electron notification format
     * @param {Object} options - Unified notification options
     * @returns {Object} Native notification options
     */
    static convertToNativeFormat(options) {
        const nativeOptions = {
            title: options.title || 'CVRX',
            body: options.body || options.message || '',
            silent: options.silent || false
        };

        // Add icon if specified
        if (options.icon && typeof options.icon === 'string') {
            nativeOptions.icon = options.icon;
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

    /**
     * Close all custom notifications
     * @returns {Promise<Object>} Result object
     */
    static async closeAllCustomNotifications() {
        try {
            NotificationManager.closeAllNotifications();
            return { success: true };
        } catch (error) {
            log.error('Failed to close all custom notifications:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get notification counts
     * @returns {Object} Notification counts
     */
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

    /**
     * Convenience methods for different notification types
     */
    
    static async showInviteNotification(inviteData) {
        const userName = inviteData.user?.name || 'Someone';
        const worldName = inviteData.world?.name || 'Unknown World';
        
        return this.showNotification({
            title: 'ChilloutVR Invite',
            message: `${userName} invited you to ${worldName}`,
            type: 'invite',
            icon: 'mail',
            image: inviteData.user?.imageUrl,
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
            type: 'info',
            icon: 'person_add',
            image: requestData.sender?.imageUrl
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
            image: friendData.imageUrl,
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
            type: 'info',
            icon: 'minimize'
        });
    }
}

module.exports = NotificationHelper; 