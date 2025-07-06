const { BrowserWindow, screen, app } = require('electron');
const path = require('path');

const log = require('./logger').GetLogger('NotificationManager');
const Config = require('./config');
const SoundManager = require('./sound-manager');

class NotificationManager {
    constructor() {
        this.activeNotifications = [];
        this.notificationQueue = [];
        this.notificationSpacing = 10;
        this.notificationWidth = 350;
        this.baseNotificationHeight = 80; // Base height for title + message
        this.animationDuration = 300;
        
        log.info('NotificationManager initialized');
    }

    /**
     * Get current config values
     * @returns {Object} Current configuration
     */
    getConfig() {
        return {
            maxActiveNotifications: Config.GetCustomNotificationMaxCount() || 5,
            defaultDisplayTimeout: Config.GetCustomNotificationTimeout() || 5000,
            enabled: Config.GetCustomNotificationsEnabled() !== false
        };
    }

    /**
     * Calculate the appropriate height for a notification based on its content
     * @param {Object} notificationData - The notification data
     * @returns {number} The calculated height in pixels
     */
    calculateNotificationHeight(notificationData) {
        let height = this.baseNotificationHeight;
        
        // Add extra height for long messages (estimate based on character count)
        if (notificationData.message && notificationData.message.length > 60) {
            const extraLines = Math.ceil((notificationData.message.length - 60) / 50);
            height += extraLines * 18; // ~18px per extra line
        }
        
        // Add height for action buttons
        if (notificationData.actions && notificationData.actions.length > 0) {
            height += 40; // Space for action buttons (padding + button height)
        }
        
        // Add height for progress bar
        if (notificationData.progress !== undefined) {
            height += 3; // Progress bar height
        }
        
        // Ensure minimum height when image/avatar is present
        if (notificationData.image || notificationData.avatar) {
            height = Math.max(height, 92); // Minimum to accommodate 40px avatar + padding
        }
        
        // Add some padding buffer to prevent clipping
        height += 8;
        
        // Ensure reasonable bounds
        height = Math.max(height, 70);  // Minimum height
        height = Math.min(height, 200); // Maximum height
        
        log.debug(`Calculated notification height: ${height}px for notification:`, notificationData.title);
        return height;
    }

    /**
     * Get the primary display and calculate positioning
     * @returns {Object} Display bounds and positioning info
     */
    getDisplayInfo() {
        try {
            const primaryDisplay = screen.getPrimaryDisplay();
            const { bounds, workArea } = primaryDisplay;
            
            // Use workArea to avoid taskbar/dock areas
            const displayInfo = {
                bounds,
                workArea,
                bottomRight: {
                    x: workArea.x + workArea.width - this.notificationWidth - this.notificationSpacing,
                    y: workArea.y + workArea.height - this.notificationSpacing
                }
            };
            
            log.debug('Display info calculated:', displayInfo);
            return displayInfo;
        } catch (error) {
            log.error('Failed to get display info:', error);
            // Fallback to reasonable defaults
            return {
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                workArea: { x: 0, y: 0, width: 1920, height: 1080 },
                bottomRight: {
                    x: 1920 - this.notificationWidth - this.notificationSpacing,
                    y: 1080 - this.notificationSpacing
                }
            };
        }
    }

    /**
     * Calculate position for a new notification
     * @param {number} index - Index in the active notifications array
     * @param {number} notificationHeight - Height of the notification being positioned
     * @returns {Object} Position coordinates
     */
    calculateNotificationPosition(index, notificationHeight) {
        const displayInfo = this.getDisplayInfo();
        
        // Calculate Y offset based on the actual heights of all notifications below this one
        let yOffset = notificationHeight; // Start with this notification's height
        
        // Add heights of all notifications that will be below this one
        for (let i = 0; i < index; i++) {
            if (this.activeNotifications[i] && !this.activeNotifications[i].window.isDestroyed()) {
                const bounds = this.activeNotifications[i].window.getBounds();
                yOffset += bounds.height + this.notificationSpacing;
            }
        }
        
        return {
            x: displayInfo.bottomRight.x,
            y: displayInfo.bottomRight.y - yOffset
        };
    }

    /**
     * Create a new notification window
     * @param {Object} notificationData - Notification data for height calculation
     * @param {Object} options - Notification options
     * @returns {BrowserWindow} The created notification window
     */
    createNotificationWindow(notificationData, options = {}) {
        try {
            const notificationHeight = this.calculateNotificationHeight(notificationData);
            const position = this.calculateNotificationPosition(this.activeNotifications.length, notificationHeight);
            
            const notificationWindow = new BrowserWindow({
                width: this.notificationWidth,
                height: notificationHeight,
                x: position.x,
                y: position.y,
                frame: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                resizable: false,
                movable: false,
                minimizable: false,
                maximizable: false,
                closable: true,
                focusable: false,
                show: false, // Don't show immediately, we'll animate it in
                transparent: true,
                webPreferences: {
                    preload: path.join(__dirname, 'notification-preload.js'),
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true,
                    enableRemoteModule: false
                }
            });

            // Load the notification HTML template
            notificationWindow.loadFile('client/notification/notification.html');

            // Handle window events
            notificationWindow.on('closed', () => {
                this.removeNotification(notificationWindow);
            });

            // Handle click events to potentially close notification
            notificationWindow.webContents.on('before-input-event', (event, input) => {
                if (input.type === 'mouseDown') {
                    // Optional: close on click, or handle specific click actions
                    if (options.closeOnClick !== false) {
                        this.closeNotification(notificationWindow);
                    }
                }
            });

            log.debug('Notification window created at position:', position, 'with height:', notificationHeight);
            return notificationWindow;
        } catch (error) {
            log.error('Failed to create notification window:', error);
            return null;
        }
    }

    /**
     * Show a notification with the given content
     * @param {Object} notificationData - The notification content and options
     * @returns {Promise<BrowserWindow>} The notification window
     */
    async showNotification(notificationData) {
        try {
            const config = this.getConfig();
            
            // Check if custom notifications are enabled
            if (!config.enabled) {
                log.debug('Custom notifications are disabled, skipping');
                return null;
            }

            // If we're at max capacity, queue the notification
            if (this.activeNotifications.length >= config.maxActiveNotifications) {
                log.debug('Max notifications reached, queueing notification');
                this.notificationQueue.push(notificationData);
                return null;
            }

            const notificationWindow = this.createNotificationWindow(notificationData, notificationData.options);
            if (!notificationWindow) {
                throw new Error('Failed to create notification window');
            }

            // Add to active notifications
            this.activeNotifications.push({
                window: notificationWindow,
                data: notificationData,
                createdAt: Date.now(),
                autoDismissTimer: null,
                isHovered: false,
                remainingTimeout: null
            });

            // Wait for the window to be ready, then send data and show
            notificationWindow.webContents.once('did-finish-load', () => {
                // Send notification data to the window
                notificationWindow.webContents.send('notification-data', notificationData);
                
                // Show the window with animation
                this.animateNotificationIn(notificationWindow);
                
                // Play notification sound if enabled
                this.playNotificationSound(notificationData.type);
                
                // Set auto-close timer if specified
                const timeout = notificationData.timeout || config.defaultDisplayTimeout;
                if (timeout > 0) {
                    this.startAutoDismissTimer(notificationWindow, timeout);
                }
            });

            log.info('Notification shown:', notificationData.title || 'Untitled');
            return notificationWindow;
        } catch (error) {
            log.error('Failed to show notification:', error);
            return null;
        }
    }

    /**
     * Animate notification window appearing (slide up from bottom)
     * @param {BrowserWindow} notificationWindow 
     */
    animateNotificationIn(notificationWindow) {
        try {
            if (!notificationWindow || notificationWindow.isDestroyed()) return;

            // Start off-screen at the bottom
            const finalPosition = {
                x: notificationWindow.getPosition()[0],
                y: notificationWindow.getPosition()[1]
            };
            
            const windowHeight = notificationWindow.getBounds().height;
            notificationWindow.setPosition(finalPosition.x, finalPosition.y + windowHeight + 20);
            notificationWindow.show();

            // Animate to final position (slide up)
            const startTime = Date.now();
            const startY = notificationWindow.getPosition()[1];
            
            const animate = () => {
                if (notificationWindow.isDestroyed()) return;
                
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / this.animationDuration, 1);
                
                // Easing function for smooth animation (ease out)
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const currentY = startY + (finalPosition.y - startY) * easeOut;
                
                notificationWindow.setPosition(finalPosition.x, Math.round(currentY));
                
                if (progress < 1) {
                    setImmediate(animate);
                }
            };
            
            animate();
        } catch (error) {
            log.error('Failed to animate notification in:', error);
            // Fallback: just show the window
            if (!notificationWindow.isDestroyed()) {
                notificationWindow.show();
            }
        }
    }

    /**
     * Animate notification window disappearing (slide down and out)
     * @param {BrowserWindow} notificationWindow 
     * @param {Function} callback - Called when animation completes
     */
    animateNotificationOut(notificationWindow, callback) {
        try {
            if (!notificationWindow || notificationWindow.isDestroyed()) {
                if (callback) callback();
                return;
            }

            const startPosition = {
                x: notificationWindow.getPosition()[0],
                y: notificationWindow.getPosition()[1]
            };
            
            // Calculate end position (slide down and out of view)
            const displayInfo = this.getDisplayInfo();
            const endY = displayInfo.workArea.y + displayInfo.workArea.height + 20;
            const startTime = Date.now();
            
            const animate = () => {
                if (notificationWindow.isDestroyed()) {
                    if (callback) callback();
                    return;
                }
                
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / this.animationDuration, 1);
                
                // Easing function for smooth animation (ease in, sliding down)
                const easeIn = Math.pow(progress, 3);
                const currentY = startPosition.y + (endY - startPosition.y) * easeIn;
                
                notificationWindow.setPosition(startPosition.x, Math.round(currentY));
                
                if (progress < 1) {
                    setImmediate(animate);
                } else {
                    notificationWindow.close();
                    if (callback) callback();
                }
            };
            
            animate();
        } catch (error) {
            log.error('Failed to animate notification out:', error);
            // Fallback: just close the window
            if (!notificationWindow.isDestroyed()) {
                notificationWindow.close();
            }
            if (callback) callback();
        }
    }

    /**
     * Close a specific notification
     * @param {BrowserWindow} notificationWindow 
     */
    closeNotification(notificationWindow) {
        if (!notificationWindow || notificationWindow.isDestroyed()) return;

        // Clear auto-dismiss timer before closing
        this.clearAutoDismissTimer(notificationWindow);

        this.animateNotificationOut(notificationWindow, () => {
            this.repositionNotifications();
            this.processQueue();
        });
    }

    /**
     * Remove a notification from the active list
     * @param {BrowserWindow} notificationWindow 
     */
    removeNotification(notificationWindow) {
        const index = this.activeNotifications.findIndex(
            notification => notification.window === notificationWindow
        );
        
        if (index !== -1) {
            const notification = this.activeNotifications[index];
            
            // Clean up the auto-dismiss timer
            if (notification.autoDismissTimer) {
                clearTimeout(notification.autoDismissTimer);
            }
            
            this.activeNotifications.splice(index, 1);
            log.debug('Notification removed from active list');
            this.repositionNotifications();
            this.processQueue();
        }
    }

    /**
     * Reposition all active notifications to fill gaps
     */
    repositionNotifications() {
        this.activeNotifications.forEach((notification, index) => {
            if (!notification.window.isDestroyed()) {
                const windowHeight = notification.window.getBounds().height;
                const newPosition = this.calculateNotificationPosition(index, windowHeight);
                notification.window.setPosition(newPosition.x, newPosition.y);
            }
        });
    }

    /**
     * Process the notification queue
     */
    processQueue() {
        const config = this.getConfig();
        if (this.notificationQueue.length > 0 && 
            this.activeNotifications.length < config.maxActiveNotifications) {
            const nextNotification = this.notificationQueue.shift();
            this.showNotification(nextNotification);
        }
    }

    /**
     * Close all active notifications
     */
    closeAllNotifications() {
        log.info('Closing all notifications');
        const windows = [...this.activeNotifications.map(n => n.window)];
        windows.forEach(window => {
            if (!window.isDestroyed()) {
                window.close();
            }
        });
        this.activeNotifications = [];
        this.notificationQueue = [];
    }

    /**
     * Get the count of active notifications
     * @returns {number}
     */
    getActiveNotificationCount() {
        return this.activeNotifications.length;
    }

    /**
     * Get the count of queued notifications
     * @returns {number}
     */
    getQueuedNotificationCount() {
        return this.notificationQueue.length;
    }

    /**
     * Play a notification sound based on the notification type
     * @param {string} notificationType - The type of notification
     */
    async playNotificationSound(notificationType) {
        try {
            if (notificationType) {
                await SoundManager.playNotificationSound(notificationType);
            }
        } catch (error) {
            log.error('Error playing notification sound:', error);
        }
    }

    /**
     * Start the auto-dismiss timer for a notification
     * @param {BrowserWindow} notificationWindow - The notification window
     * @param {number} timeout - Timeout in milliseconds
     */
    startAutoDismissTimer(notificationWindow, timeout) {
        const notification = this.activeNotifications.find(n => n.window === notificationWindow);
        if (!notification) return;

        // Clear any existing timer
        if (notification.autoDismissTimer) {
            clearTimeout(notification.autoDismissTimer);
        }

        // Store the timeout duration and start time
        notification.remainingTimeout = timeout;
        notification.timeoutStarted = Date.now();

        // Start the timer
        notification.autoDismissTimer = setTimeout(() => {
            this.closeNotification(notificationWindow);
        }, timeout);

        log.debug(`Auto-dismiss timer started for notification: ${timeout}ms`);
    }

    /**
     * Pause the auto-dismiss timer for a notification
     * @param {BrowserWindow} notificationWindow - The notification window
     */
    pauseAutoDismissTimer(notificationWindow) {
        const notification = this.activeNotifications.find(n => n.window === notificationWindow);
        if (!notification || !notification.autoDismissTimer) return;

        // Calculate remaining time
        const elapsed = Date.now() - notification.timeoutStarted;
        notification.remainingTimeout = Math.max(0, notification.remainingTimeout - elapsed);

        // Clear the current timer
        clearTimeout(notification.autoDismissTimer);
        notification.autoDismissTimer = null;

        log.debug(`Auto-dismiss timer paused. Remaining: ${notification.remainingTimeout}ms`);
    }

    /**
     * Resume the auto-dismiss timer for a notification
     * @param {BrowserWindow} notificationWindow - The notification window
     */
    resumeAutoDismissTimer(notificationWindow) {
        const notification = this.activeNotifications.find(n => n.window === notificationWindow);
        if (!notification || notification.autoDismissTimer || !notification.remainingTimeout) return;

        // Only resume if there's still time remaining
        if (notification.remainingTimeout > 0) {
            notification.timeoutStarted = Date.now();
            notification.autoDismissTimer = setTimeout(() => {
                this.closeNotification(notificationWindow);
            }, notification.remainingTimeout);

            log.debug(`Auto-dismiss timer resumed. Remaining: ${notification.remainingTimeout}ms`);
        }
    }

    /**
     * Handle mouse enter event for a notification
     * @param {BrowserWindow} notificationWindow - The notification window
     */
    handleMouseEnter(notificationWindow) {
        const notification = this.activeNotifications.find(n => n.window === notificationWindow);
        if (!notification) return;

        notification.isHovered = true;
        this.pauseAutoDismissTimer(notificationWindow);
        log.debug('Mouse entered notification - auto-dismiss paused');
    }

    /**
     * Handle mouse leave event for a notification
     * @param {BrowserWindow} notificationWindow - The notification window
     */
    handleMouseLeave(notificationWindow) {
        const notification = this.activeNotifications.find(n => n.window === notificationWindow);
        if (!notification) return;

        notification.isHovered = false;
        this.resumeAutoDismissTimer(notificationWindow);
        log.debug('Mouse left notification - auto-dismiss resumed');
    }

    /**
     * Clear auto-dismiss timer for a notification
     * @param {BrowserWindow} notificationWindow - The notification window
     */
    clearAutoDismissTimer(notificationWindow) {
        const notification = this.activeNotifications.find(n => n.window === notificationWindow);
        if (!notification) return;

        if (notification.autoDismissTimer) {
            clearTimeout(notification.autoDismissTimer);
            notification.autoDismissTimer = null;
        }
        notification.remainingTimeout = null;
        log.debug('Auto-dismiss timer cleared');
    }
}

// Create singleton instance
const notificationManager = new NotificationManager();

module.exports = notificationManager; 