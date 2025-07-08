const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const log = require('./logger').GetLogger('SoundManager');
const Config = require('./config');

class SoundManager {
    constructor() {
        this.soundsPath = path.join(app.getAppPath(), 'client', 'notification', 'sounds');
        this.soundFiles = {
            'friend': 'friend-online.ogg',
            'invite': 'instance-invite.ogg',
            'info': 'update-available.ogg',
            'update': 'update-available.ogg'
        };
        
        // Debouncing mechanism to prevent audio spam
        this.soundDebounce = {
            'friend': {
                lastPlayed: 0,
                debounceTime: 10000 // 10 seconds for friend notifications
            },
            'invite': {
                lastPlayed: 0,
                debounceTime: 2000 // 2 seconds for invite notifications
            },
            'info': {
                lastPlayed: 0,
                debounceTime: 5000 // 5 seconds for info notifications
            },
            'update': {
                lastPlayed: 0,
                debounceTime: 5000 // 5 seconds for update notifications
            }
        };
        
        log.info('SoundManager initialized');
        this.validateSoundFiles();
    }

    // Validate that all sound files exist
    validateSoundFiles() {
        try {
            for (const [type, filename] of Object.entries(this.soundFiles)) {
                const soundPath = path.join(this.soundsPath, filename);
                if (!fs.existsSync(soundPath)) {
                    log.warn(`Sound file not found: ${soundPath}`);
                } else {
                    log.debug(`Sound file validated: ${filename}`);
                }
            }
        } catch (error) {
            log.error('Error validating sound files:', error);
        }
    }

    // Play a notification sound based on the notification type
    // notificationType - The type of notification ('friend', 'invite', 'info', 'update')
    // Returns: Whether the sound was played successfully
    async playNotificationSound(notificationType) {
        try {
            // Check if notification sounds are enabled
            if (!Config.GetNotificationSoundsEnabled()) {
                log.debug('Notification sounds are disabled, skipping sound playback');
                return false;
            }

            // Check debounce timing to prevent audio spam
            const now = Date.now();
            const debounceConfig = this.soundDebounce[notificationType];
            
            if (debounceConfig) {
                const timeSinceLastPlayed = now - debounceConfig.lastPlayed;
                if (timeSinceLastPlayed < debounceConfig.debounceTime) {
                    log.debug(`Sound debounced for ${notificationType}: ${timeSinceLastPlayed}ms since last played (debounce: ${debounceConfig.debounceTime}ms)`);
                    return false;
                }
            }

            // Get the sound file for this notification type
            const soundFile = this.soundFiles[notificationType];
            if (!soundFile) {
                log.warn(`No sound file mapped for notification type: ${notificationType}`);
                return false;
            }

            const soundPath = path.join(this.soundsPath, soundFile);
            
            // Verify the sound file exists
            if (!fs.existsSync(soundPath)) {
                log.warn(`Sound file not found: ${soundPath}`);
                return false;
            }

            // Update the last played time before playing
            if (debounceConfig) {
                debounceConfig.lastPlayed = now;
            }

            // Play the sound using HTML5 Audio API in a hidden BrowserWindow
            const volume = Config.GetNotificationVolume ? Config.GetNotificationVolume() : 1.0;
            const success = await this.playAudioFile(soundPath, volume);
            
            if (success) {
                log.debug(`Successfully played notification sound: ${soundFile}`);
            } else {
                log.warn(`Failed to play notification sound: ${soundFile}`);
            }

            return success;
        } catch (error) {
            log.error('Error playing notification sound:', error);
            return false;
        }
    }

    // Play an audio file using a temporary BrowserWindow
    // soundPath - Full path to the sound file
    // Returns: Whether the sound was played successfully
    async playAudioFile(soundPath, volume = 1.0) {
        return new Promise((resolve) => {
            try {
                const { BrowserWindow } = require('electron');
                
                // Create a hidden window just for playing audio
                const audioWindow = new BrowserWindow({
                    show: false,
                    skipTaskbar: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        webSecurity: false // Allow loading local files
                    }
                });

                // Load a minimal HTML page that plays the audio
                const htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Sound Player</title>
                    </head>
                    <body>
                        <script>
                            const audio = new Audio('file://${soundPath.replace(/\\/g, '/')}');
                            audio.volume = ${volume}; // Set volume from config
                            
                            audio.onended = () => {
                                window.close();
                            };
                            
                            audio.onerror = (error) => {
                                console.error('Audio playback error:', error);
                                window.close();
                            };
                            
                            audio.play().catch(error => {
                                console.error('Failed to play audio:', error);
                                window.close();
                            });
                        </script>
                    </body>
                    </html>
                `;

                audioWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

                // Set timeout to close the window if it doesn't close naturally
                const timeout = setTimeout(() => {
                    if (!audioWindow.isDestroyed()) {
                        audioWindow.close();
                    }
                    resolve(false);
                }, 5000); // 5 second timeout

                audioWindow.on('closed', () => {
                    clearTimeout(timeout);
                    resolve(true);
                });

                audioWindow.webContents.on('did-fail-load', () => {
                    clearTimeout(timeout);
                    if (!audioWindow.isDestroyed()) {
                        audioWindow.close();
                    }
                    resolve(false);
                });

            } catch (error) {
                log.error('Error creating audio window:', error);
                resolve(false);
            }
        });
    }

    // Get the sound file path for a notification type
    // notificationType - The notification type
    // Returns: The sound file path or null if not found
    getSoundFilePath(notificationType) {
        const soundFile = this.soundFiles[notificationType];
        if (soundFile) {
            return path.join(this.soundsPath, soundFile);
        }
        return null;
    }

    // Get all available sound files
    // Returns: Object mapping notification types to sound files
    getAvailableSounds() {
        return { ...this.soundFiles };
    }

    // Reset debounce timers for all notification types
    // This can be useful for testing or if you want to allow sounds immediately
    resetDebounceTimers() {
        log.debug('Resetting all sound debounce timers');
        for (const notificationType in this.soundDebounce) {
            this.soundDebounce[notificationType].lastPlayed = 0;
        }
    }

    // Reset debounce timer for a specific notification type
    // notificationType - The notification type to reset
    resetDebounceTimer(notificationType) {
        if (this.soundDebounce[notificationType]) {
            log.debug(`Resetting debounce timer for ${notificationType}`);
            this.soundDebounce[notificationType].lastPlayed = 0;
        }
    }

    // Get debounce status for all notification types
    // Returns: Object containing debounce information
    getDebounceStatus() {
        const now = Date.now();
        const status = {};
        
        for (const [type, config] of Object.entries(this.soundDebounce)) {
            const timeSinceLastPlayed = now - config.lastPlayed;
            const timeUntilNextAllowed = Math.max(0, config.debounceTime - timeSinceLastPlayed);
            
            status[type] = {
                lastPlayed: config.lastPlayed,
                debounceTime: config.debounceTime,
                timeSinceLastPlayed,
                timeUntilNextAllowed,
                canPlayNow: timeUntilNextAllowed === 0
            };
        }
        
        return status;
    }
}

// Create singleton instance
const soundManager = new SoundManager();

module.exports = soundManager; 