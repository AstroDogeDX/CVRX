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
        this.topPadding = 10; // Adequate padding to ensure notifications don't touch the workspace edge
        this.notificationWidth = 350;
        this.notificationHeight = 120; // Fixed height for all notifications
        this.animationDuration = 300;
        this.isPostLogin = false; // Track if app is in post-login phase
        this.postLoginSuppressionTimer = null; // Timer to mark post-login suppression as complete
        
        // Mark post-login suppression as complete after a reasonable delay (5 seconds)
        this.postLoginSuppressionTimer = setTimeout(() => {
            this.markPostLoginSuppressionComplete();
        }, 5000);
        
        log.info('NotificationManager initialized - post-login phase active');
    }

    // Get current config values
    // Returns: Current configuration object
    getConfig() {
        return {
            maxActiveNotifications: Config.GetCustomNotificationMaxCount() || 5,
            defaultDisplayTimeout: Config.GetCustomNotificationTimeout() || 5000,
            enabled: Config.GetCustomNotificationsEnabled() !== false,
            corner: Config.GetCustomNotificationCorner() || 'bottom-right',
            suppressPostLoginNotifications: Config.GetSuppressPostLoginNotifications() !== false
        };
    }

    // Mark post-login suppression as complete - allows notifications to be shown normally
    markPostLoginSuppressionComplete() {
        if (this.isPostLogin) {
            this.isPostLogin = false;
            log.info('Post-login notification suppression completed - notifications enabled');
            if (this.postLoginSuppressionTimer) {
                clearTimeout(this.postLoginSuppressionTimer);
                this.postLoginSuppressionTimer = null;
            }
        }
    }

    // Start post-login suppression (call after login)
    startPostLoginSuppression() {
        this.isPostLogin = true;
        if (this.postLoginSuppressionTimer) {
            clearTimeout(this.postLoginSuppressionTimer);
        }
        // Default suppression period: 5 seconds
        this.postLoginSuppressionTimer = setTimeout(() => {
            this.markPostLoginSuppressionComplete();
        }, 5000);
        log.info('Post-login notification suppression started');
    }

    // Check if we should suppress notifications due to post-login phase
    // Returns: true if notifications should be suppressed
    shouldSuppressPostLoginNotifications() {
        const config = this.getConfig();
        return this.isPostLogin && config.suppressPostLoginNotifications;
    }

    // Get the consistent height for all notifications
    // Returns: The fixed height in pixels
    getNotificationHeight() {
        return this.notificationHeight;
    }

    // Get the primary display and calculate positioning
    // Returns: Display bounds and positioning info
    getDisplayInfo() {
        try {
            const primaryDisplay = screen.getPrimaryDisplay();
            const { bounds, workArea } = primaryDisplay;
            
            // Use workArea to avoid taskbar/dock areas
            const displayInfo = {
                bounds,
                workArea,
                corners: {
                    'top-left': {
                        x: workArea.x + this.notificationSpacing,
                        y: workArea.y + this.notificationSpacing
                    },
                    'top-right': {
                        x: workArea.x + workArea.width - this.notificationWidth - this.notificationSpacing,
                        y: workArea.y + this.notificationSpacing
                    },
                    'bottom-left': {
                        x: workArea.x + this.notificationSpacing,
                        y: workArea.y + workArea.height - this.notificationSpacing
                    },
                    'bottom-right': {
                        x: workArea.x + workArea.width - this.notificationWidth - this.notificationSpacing,
                        y: workArea.y + workArea.height - this.notificationSpacing
                    }
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
                corners: {
                    'top-left': { x: 10, y: this.topPadding },
                    'top-right': { x: 1920 - this.notificationWidth - 10, y: this.topPadding },
                    'bottom-left': { x: 10, y: 1080 - 10 },
                    'bottom-right': { x: 1920 - this.notificationWidth - 10, y: 1080 - 10 }
                }
            };
        }
    }

    // Calculate position for a new notification with simplified logic using fixed height
    // index - Index in the active notifications array
    // Returns: Position coordinates
    calculateNotificationPosition(index) {
        try {
            const displayInfo = this.getDisplayInfo();
            const config = this.getConfig();
            const corner = config.corner || 'bottom-right';
            const cornerPos = displayInfo.corners[corner];
            
            if (!cornerPos || !Number.isFinite(cornerPos.x) || !Number.isFinite(cornerPos.y)) {
                log.error('Invalid corner position:', cornerPos);
                // Fallback to bottom-right corner
                const fallbackPos = displayInfo.corners['bottom-right'] || { x: 100, y: 100 };
                return { x: fallbackPos.x, y: fallbackPos.y };
            }
            
            // Calculate offset using consistent notification height - much simpler now!
            const offset = index * (this.notificationHeight + this.notificationSpacing);
            
            let x = cornerPos.x;
            let y = cornerPos.y;
            
            // Adjust position based on corner and stacking direction
            if (corner.startsWith('top-')) {
                // Top corners: stack downward
                y += offset;
            } else {
                // Bottom corners: stack upward
                y -= (this.notificationHeight + offset);
            }
            
            // Final validation of calculated position
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                log.error('Invalid position calculated:', { x, y });
                // Return safe fallback position
                return { x: 100, y: 100 };
            }
            
            return { x, y };
        } catch (error) {
            log.error('Error calculating notification position:', error);
            // Return safe fallback position
            return { x: 100, y: 100 };
        }
    }

    // Create a new notification window with consistent sizing
    // notificationData - Notification data 
    // options - Notification options
    // index - The position index for this notification
    // Returns: The created notification window
    createNotificationWindow(notificationData, options = {}, index = null) {
        try {
            const notificationIndex = index !== null ? index : this.activeNotifications.length;
            const position = this.calculateNotificationPosition(notificationIndex);
            
            const notificationWindow = new BrowserWindow({
                width: this.notificationWidth,
                height: this.notificationHeight,
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

            log.debug('Notification window created at position:', position, 'with fixed height:', this.notificationHeight);
            return notificationWindow;
        } catch (error) {
            log.error('Failed to create notification window:', error);
            return null;
        }
    }

    // Show a notification with the given content
    // notificationData - The notification content and options
    // Returns: The notification window
    async showNotification(notificationData) {
        try {
            const config = this.getConfig();
            
            // Check if custom notifications are enabled
            if (!config.enabled) {
                log.debug('Custom notifications are disabled, skipping');
                return null;
            }

            // Check if we should suppress notifications during post-login
            if (this.shouldSuppressPostLoginNotifications()) {
                log.debug('Suppressing notification during post-login:', notificationData.title || 'Untitled');
                return null;
            }

            // If we're at max capacity, queue the notification
            if (this.activeNotifications.length >= config.maxActiveNotifications) {
                log.debug('Max notifications reached, queueing notification');
                this.notificationQueue.push(notificationData);
                return null;
            }

            // Reserve the position first to prevent race conditions
            const notificationIndex = this.activeNotifications.length;
            
            // Create notification entry placeholder  
            const notificationEntry = {
                window: null, // Will be set after window creation
                data: notificationData,
                createdAt: Date.now(),
                autoDismissTimer: null,
                isHovered: false,
                remainingTimeout: null
            };
            
            // Add to active notifications before window creation to reserve position
            this.activeNotifications.push(notificationEntry);

            const notificationWindow = this.createNotificationWindow(notificationData, notificationData.options, notificationIndex);
            if (!notificationWindow) {
                // Remove the placeholder entry if window creation failed
                this.activeNotifications.pop();
                throw new Error('Failed to create notification window');
            }

            // Update the entry with the actual window
            notificationEntry.window = notificationWindow;

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

    // Animate notification window appearing (slide in from edge)
    // notificationWindow - The notification window to animate
    animateNotificationIn(notificationWindow) {
        try {
            if (!notificationWindow || notificationWindow.isDestroyed()) return;

            const config = this.getConfig();
            const corner = config.corner;
            
            // Safely get position and bounds with validation
            let finalPosition, windowHeight;
            try {
                finalPosition = {
                    x: notificationWindow.getPosition()[0],
                    y: notificationWindow.getPosition()[1]
                };
                windowHeight = this.notificationHeight; // Use consistent height
                
                // Validate position values
                if (!Number.isFinite(finalPosition.x) || !Number.isFinite(finalPosition.y) || !Number.isFinite(windowHeight)) {
                    throw new Error('Invalid position or window dimensions');
                }
            } catch (error) {
                log.error('Failed to get window position/bounds for animation:', error);
                // Fallback: just show the window
                if (!notificationWindow.isDestroyed()) {
                    notificationWindow.show();
                }
                return;
            }
            
            let startY = finalPosition.y;
            
            // Set initial off-screen position based on corner
            if (corner.startsWith('top-')) {
                // Top corners: start above the screen
                startY = finalPosition.y - windowHeight - 20;
            } else {
                // Bottom corners: start below the screen
                startY = finalPosition.y + windowHeight + 20;
            }
            
            // Safely set initial position
            try {
                notificationWindow.setPosition(finalPosition.x, startY);
                notificationWindow.show();
            } catch (error) {
                log.error('Failed to set initial animation position:', error);
                if (!notificationWindow.isDestroyed()) {
                    notificationWindow.show();
                }
                return;
            }

            // Animate to final position
            const startTime = Date.now();
            
            const animate = () => {
                try {
                    // Double-check window state before each frame
                    if (!notificationWindow || notificationWindow.isDestroyed()) return;
                    
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / this.animationDuration, 1);
                    
                    // Easing function for smooth animation (ease out)
                    const easeOut = 1 - Math.pow(1 - progress, 3);
                    const currentY = startY + (finalPosition.y - startY) * easeOut;
                    
                    // Validate calculated position
                    if (!Number.isFinite(currentY)) {
                        log.error('Invalid Y position calculated during animation:', currentY);
                        return;
                    }
                    
                    // Safely set position
                    notificationWindow.setPosition(finalPosition.x, Math.round(currentY));
                    
                    if (progress < 1) {
                        setImmediate(animate);
                    }
                } catch (error) {
                    log.error('Error during notification animation frame:', error);
                    // Stop animation on error to prevent ghost windows
                }
            };
            
            animate();
        } catch (error) {
            log.error('Failed to animate notification in:', error);
            // Fallback: just show the window
            try {
                if (!notificationWindow.isDestroyed()) {
                    notificationWindow.show();
                }
            } catch (fallbackError) {
                log.error('Failed to show notification window as fallback:', fallbackError);
            }
        }
    }

    // Animate notification window disappearing (slide out to edge)
    // notificationWindow - The notification window to animate
    // callback - Called when animation completes
    animateNotificationOut(notificationWindow, callback) {
        try {
            if (!notificationWindow || notificationWindow.isDestroyed()) {
                if (callback) callback();
                return;
            }

            const config = this.getConfig();
            const corner = config.corner;
            const displayInfo = this.getDisplayInfo();
            
            // Safely get position and bounds with validation
            let startPosition, windowHeight;
            try {
                startPosition = {
                    x: notificationWindow.getPosition()[0],
                    y: notificationWindow.getPosition()[1]
                };
                windowHeight = this.notificationHeight; // Use consistent height
                
                // Validate position and dimension values
                if (!Number.isFinite(startPosition.x) || !Number.isFinite(startPosition.y) || !Number.isFinite(windowHeight)) {
                    throw new Error('Invalid position or window dimensions');
                }
            } catch (error) {
                log.error('Failed to get window position/bounds for exit animation:', error);
                // Fallback: just close the window
                try {
                    if (!notificationWindow.isDestroyed()) {
                        notificationWindow.close();
                    }
                } catch (closeError) {
                    log.error('Failed to close notification window:', closeError);
                }
                if (callback) callback();
                return;
            }
            
            // Calculate end position based on corner
            let endY;
            if (corner.startsWith('top-')) {
                // Top corners: slide up and out of view
                endY = displayInfo.workArea.y - windowHeight - 20;
            } else {
                // Bottom corners: slide down and out of view
                endY = displayInfo.workArea.y + displayInfo.workArea.height + 20;
            }
            
            // Validate end position
            if (!Number.isFinite(endY)) {
                log.error('Invalid end position calculated for exit animation:', endY);
                try {
                    if (!notificationWindow.isDestroyed()) {
                        notificationWindow.close();
                    }
                } catch (closeError) {
                    log.error('Failed to close notification window:', closeError);
                }
                if (callback) callback();
                return;
            }
            
            const startTime = Date.now();
            
            const animate = () => {
                try {
                    // Double-check window state before each frame
                    if (!notificationWindow || notificationWindow.isDestroyed()) {
                        if (callback) callback();
                        return;
                    }
                    
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / this.animationDuration, 1);
                    
                    // Easing function for smooth animation (ease in)
                    const easeIn = Math.pow(progress, 3);
                    const currentY = startPosition.y + (endY - startPosition.y) * easeIn;
                    
                    // Validate calculated position
                    if (!Number.isFinite(currentY)) {
                        log.error('Invalid Y position calculated during exit animation:', currentY);
                        try {
                            if (!notificationWindow.isDestroyed()) {
                                notificationWindow.close();
                            }
                        } catch (closeError) {
                            log.error('Failed to close notification window:', closeError);
                        }
                        if (callback) callback();
                        return;
                    }
                    
                    // Safely set position
                    notificationWindow.setPosition(startPosition.x, Math.round(currentY));
                    
                    if (progress < 1) {
                        setImmediate(animate);
                    } else {
                        try {
                            notificationWindow.close();
                        } catch (closeError) {
                            log.error('Failed to close notification window at animation end:', closeError);
                        }
                        if (callback) callback();
                    }
                } catch (error) {
                    log.error('Error during notification exit animation frame:', error);
                    // Stop animation and close window on error
                    try {
                        if (!notificationWindow.isDestroyed()) {
                            notificationWindow.close();
                        }
                    } catch (closeError) {
                        log.error('Failed to close notification window after animation error:', closeError);
                    }
                    if (callback) callback();
                }
            };
            
            animate();
        } catch (error) {
            log.error('Failed to animate notification out:', error);
            // Fallback: just close the window
            try {
                if (!notificationWindow.isDestroyed()) {
                    notificationWindow.close();
                }
            } catch (closeError) {
                log.error('Failed to close notification window as fallback:', closeError);
            }
            if (callback) callback();
        }
    }

    // Close a specific notification
    // notificationWindow - The notification window to close
    closeNotification(notificationWindow) {
        if (!notificationWindow || notificationWindow.isDestroyed()) return;

        // Clear auto-dismiss timer before closing
        this.clearAutoDismissTimer(notificationWindow);

        this.animateNotificationOut(notificationWindow, () => {
            this.repositionNotifications();
            this.processQueue();
        });
    }

    // Remove a notification from the active list
    // notificationWindow - The notification window to remove
    removeNotification(notificationWindow) {
        try {
            const index = this.activeNotifications.findIndex(
                notification => notification.window === notificationWindow
            );
            
            if (index !== -1) {
                const notification = this.activeNotifications[index];
                
                // Clean up the auto-dismiss timer
                try {
                    if (notification.autoDismissTimer) {
                        clearTimeout(notification.autoDismissTimer);
                        notification.autoDismissTimer = null;
                    }
                } catch (timerError) {
                    log.error('Error clearing auto-dismiss timer:', timerError);
                }
                
                this.activeNotifications.splice(index, 1);
                log.debug('Notification removed from active list');
                
                // Safely reposition and process queue
                try {
                    this.repositionNotifications();
                } catch (repositionError) {
                    log.error('Error repositioning notifications after removal:', repositionError);
                }
                
                try {
                    this.processQueue();
                } catch (queueError) {
                    log.error('Error processing notification queue:', queueError);
                }
            }
        } catch (error) {
            log.error('Error removing notification:', error);
            // Emergency cleanup: remove any destroyed windows from the active list
            this.activeNotifications = this.activeNotifications.filter(
                notification => {
                    try {
                        return notification.window && !notification.window.isDestroyed();
                    } catch (checkError) {
                        return false; // Remove any notifications we can't check
                    }
                }
            );
        }
    }

    // Reposition all active notifications to fill gaps - simplified with consistent height
    repositionNotifications() {
        // Only reposition if we have notifications and gaps need to be filled
        if (this.activeNotifications.length === 0) return;
        
        this.activeNotifications.forEach((notification, index) => {
            try {
                // Skip notifications without windows (during creation) or destroyed windows
                if (!notification.window || notification.window.isDestroyed()) return;
                
                const newPosition = this.calculateNotificationPosition(index);
                const currentPosition = notification.window.getPosition();
                
                // Only reposition if the position actually needs to change (avoid unnecessary moves)
                if (Math.abs(currentPosition[0] - newPosition.x) > 5 || 
                    Math.abs(currentPosition[1] - newPosition.y) > 5) {
                    
                    // Validate position values
                    if (!Number.isFinite(newPosition.x) || !Number.isFinite(newPosition.y)) {
                        log.error('Invalid position calculated for repositioning:', newPosition);
                        return;
                    }
                    
                    notification.window.setPosition(newPosition.x, newPosition.y);
                }
            } catch (error) {
                log.error('Error repositioning notification:', error);
                // If we can't reposition, the notification might be in a bad state
                // Remove it from active notifications to prevent further issues
                try {
                    if (!notification.window.isDestroyed()) {
                        notification.window.close();
                    }
                } catch (closeError) {
                    log.error('Failed to close problematic notification during repositioning:', closeError);
                }
            }
        });
        
        // Clean up any notifications that might have been closed due to errors
        this.activeNotifications = this.activeNotifications.filter(
            notification => !notification.window.isDestroyed()
        );
    }

    // Process the notification queue
    processQueue() {
        const config = this.getConfig();
        if (this.notificationQueue.length > 0 && 
            this.activeNotifications.length < config.maxActiveNotifications) {
            const nextNotification = this.notificationQueue.shift();
            this.showNotification(nextNotification);
        }
    }

    // Close all active notifications
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

    // Get the count of active notifications
    // Returns: Number of active notifications
    getActiveNotificationCount() {
        return this.activeNotifications.length;
    }

    // Get the count of queued notifications
    // Returns: Number of queued notifications
    getQueuedNotificationCount() {
        return this.notificationQueue.length;
    }

    // Play a notification sound based on the notification type
    // notificationType - The type of notification
    async playNotificationSound(notificationType) {
        try {
            if (notificationType) {
                await SoundManager.playNotificationSound(notificationType);
            }
        } catch (error) {
            log.error('Error playing notification sound:', error);
        }
    }

    // Start the auto-dismiss timer for a notification
    // notificationWindow - The notification window
    // timeout - Timeout in milliseconds
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

    // Pause the auto-dismiss timer for a notification
    // notificationWindow - The notification window
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

    // Resume the auto-dismiss timer for a notification
    // notificationWindow - The notification window
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

    // Handle mouse enter event for a notification
    // notificationWindow - The notification window
    handleMouseEnter(notificationWindow) {
        const notification = this.activeNotifications.find(n => n.window === notificationWindow);
        if (!notification) return;

        notification.isHovered = true;
        this.pauseAutoDismissTimer(notificationWindow);
        log.debug('Mouse entered notification - auto-dismiss paused');
    }

    // Handle mouse leave event for a notification
    // notificationWindow - The notification window
    handleMouseLeave(notificationWindow) {
        const notification = this.activeNotifications.find(n => n.window === notificationWindow);
        if (!notification) return;

        notification.isHovered = false;
        this.resumeAutoDismissTimer(notificationWindow);
        log.debug('Mouse left notification - auto-dismiss resumed');
    }

    // Clear auto-dismiss timer for a notification
    // notificationWindow - The notification window
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

    // Cleanup method for app shutdown
    cleanup() {
        // Clear post-login suppression timer if still active
        if (this.postLoginSuppressionTimer) {
            clearTimeout(this.postLoginSuppressionTimer);
            this.postLoginSuppressionTimer = null;
        }
        
        // Close all notifications
        this.closeAllNotifications();
        
        log.info('NotificationManager cleanup completed');
    }
}

// Create singleton instance
const notificationManager = new NotificationManager();

module.exports = notificationManager; 