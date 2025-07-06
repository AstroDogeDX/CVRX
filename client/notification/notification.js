// Notification window JavaScript

// Safe logging function that respects the user's preference for built-in logging
function log(message, data = null) {
    if (window.NotificationAPI) {
        window.NotificationAPI.logInfo(`[NotificationWindow] ${message}`, data);
    } else {
        console.log(`[NotificationWindow] ${message}`, data);
    }
}

function logError(message, error = null) {
    if (window.NotificationAPI) {
        window.NotificationAPI.logError(`[NotificationWindow] ${message}`, error);
    } else {
        console.error(`[NotificationWindow] ${message}`, error);
    }
}

// DOM elements
const elements = {
    container: null,
    content: null,
    iconSymbol: null,
    title: null,
    message: null,
    closeBtn: null,
    actions: null,
    image: null,
    img: null,
    progress: null,
    progressBar: null
};

// Initialize DOM references
function initializeElements() {
    elements.container = document.querySelector('.notification-container');
    elements.content = document.querySelector('.notification-content');
    elements.iconSymbol = document.getElementById('notification-icon-symbol');
    elements.title = document.getElementById('notification-title');
    elements.message = document.getElementById('notification-message');
    elements.closeBtn = document.getElementById('notification-close-btn');
    elements.actions = document.getElementById('notification-actions');
    elements.image = document.getElementById('notification-image');
    elements.img = document.getElementById('notification-img');
    elements.progress = document.getElementById('notification-progress');
    elements.progressBar = document.getElementById('notification-progress-bar');
}

// Safe HTML entity decoder
function decodeHtmlEntities(text) {
    if (!text) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Safe HTML content setter
function setTextContent(element, content) {
    if (element && content !== undefined && content !== null) {
        element.textContent = decodeHtmlEntities(content);
    }
}

// Render notification content
function renderNotification(notificationData) {
    try {
        log('Rendering notification', notificationData);

        // Set title and message
        setTextContent(elements.title, notificationData.title || 'Notification');
        setTextContent(elements.message, notificationData.message || '');

        // Set notification type and icon
        const type = notificationData.type || 'info';
        elements.content.className = `notification-content ${type}`;
        
        // Set icon based on type
        const iconMap = {
            'success': 'check_circle',
            'error': 'error',
            'warning': 'warning',
            'info': 'info',
            'invite': 'mail',
            'friend': 'person',
            'update': 'system_update'
        };
        
        const iconName = notificationData.icon || iconMap[type] || 'info';
        elements.iconSymbol.textContent = iconName;

        // Handle image/avatar
        if (notificationData.image) {
            elements.img.src = notificationData.image;
            elements.img.alt = notificationData.imageAlt || '';
            elements.image.style.display = 'block';
            // Add class to adjust layout when avatar is present
            document.querySelector('.notification-main').classList.add('has-avatar');
        } else {
            elements.image.style.display = 'none';
            // Remove class when no avatar
            document.querySelector('.notification-main').classList.remove('has-avatar');
        }

        // Handle action buttons
        renderActions(notificationData.actions);

        // Handle progress bar
        if (notificationData.progress !== undefined) {
            elements.progress.style.display = 'block';
            updateProgress(notificationData.progress);
        } else {
            elements.progress.style.display = 'none';
        }

        // Add fade-in animation
        elements.content.classList.add('fade-in');

        log('Notification rendered successfully');
    } catch (error) {
        logError('Failed to render notification', error);
    }
}

// Render action buttons
function renderActions(actions) {
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
        elements.actions.style.display = 'none';
        return;
    }

    // Clear existing actions
    elements.actions.innerHTML = '';
    elements.actions.style.display = 'flex';

    actions.forEach((action, index) => {
        const button = document.createElement('button');
        button.className = `notification-action-btn ${action.primary ? 'primary' : ''}`;
        
        // Add icon if specified
        if (action.icon) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-symbols-outlined';
            iconSpan.textContent = action.icon;
            button.appendChild(iconSpan);
        }

        // Add button text
        const textSpan = document.createElement('span');
        textSpan.textContent = action.text || `Action ${index + 1}`;
        button.appendChild(textSpan);

        // Add click handler
        button.addEventListener('click', () => {
            handleActionClick(action);
        });

        elements.actions.appendChild(button);
    });
}

// Handle action button clicks
function handleActionClick(action) {
    try {
        log('Action clicked', action);
        
        if (window.NotificationAPI) {
            window.NotificationAPI.performAction(action.type || 'action', action.data || {});
        }

        // Close notification if specified
        if (action.closeOnClick !== false) {
            closeNotification();
        }
    } catch (error) {
        logError('Failed to handle action click', error);
    }
}

// Update progress bar
function updateProgress(percentage) {
    if (elements.progressBar && percentage !== undefined) {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        elements.progressBar.style.width = `${clampedPercentage}%`;
    }
}

// Close notification with animation
function closeNotification() {
    try {
        log('Closing notification');
        
        elements.content.classList.add('fade-out');
        
        setTimeout(() => {
            if (window.NotificationAPI) {
                window.NotificationAPI.closeNotification();
            }
        }, 300); // Match CSS animation duration
    } catch (error) {
        logError('Failed to close notification', error);
        
        // Fallback: try to close immediately
        if (window.NotificationAPI) {
            window.NotificationAPI.closeNotification();
        }
    }
}

// Handle notification click (outside of action buttons)
function handleNotificationClick(event) {
    // Don't handle clicks on action buttons or close button
    if (event.target.closest('.notification-actions') || 
        event.target.closest('.notification-close')) {
        return;
    }

    try {
        log('Notification clicked');
        
        if (window.NotificationAPI) {
            window.NotificationAPI.clickNotification({
                timestamp: Date.now()
            });
        }
    } catch (error) {
        logError('Failed to handle notification click', error);
    }
}

// Set up mouse event listeners for hover behavior
function setupMouseEventListeners() {
    try {
        // Add mouse enter/leave listeners to the notification container
        const notificationContainer = document.querySelector('.notification-container');
        if (notificationContainer && window.NotificationAPI) {
            
            notificationContainer.addEventListener('mouseenter', () => {
                log('Mouse entered notification');
                window.NotificationAPI.notifyMouseEnter();
            });

            notificationContainer.addEventListener('mouseleave', () => {
                log('Mouse left notification');
                window.NotificationAPI.notifyMouseLeave();
            });

            log('Mouse event listeners set up successfully');
        }
    } catch (error) {
        logError('Failed to set up mouse event listeners', error);
    }
}

// Initialize notification window
function initializeNotification() {
    try {
        log('Initializing notification window');

        // Initialize DOM elements
        initializeElements();

        // Set up event listeners
        if (elements.closeBtn) {
            elements.closeBtn.addEventListener('click', closeNotification);
        }

        if (elements.content) {
            elements.content.addEventListener('click', handleNotificationClick);
        }

        // Set up mouse event listeners for hover behavior
        setupMouseEventListeners();

        // Listen for notification data from main process
        if (window.NotificationAPI) {
            window.NotificationAPI.onNotificationData((event, notificationData) => {
                log('Received notification data', notificationData);
                renderNotification(notificationData);
            });
        }

        // Handle keyboard events
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeNotification();
            }
        });

        log('Notification window initialized successfully');
    } catch (error) {
        logError('Failed to initialize notification window', error);
    }
}

// Handle window load
window.addEventListener('DOMContentLoaded', initializeNotification);

// Handle window unload
window.addEventListener('beforeunload', () => {
    log('Notification window unloading');
});

// Export for potential external use
window.NotificationRenderer = {
    renderNotification,
    updateProgress,
    closeNotification
}; 