const WebSocket = require('ws');
const log = require('./logger').GetLogger('XSOverlay');

class XSOverlayClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.pingInterval = null;
        this.clientName = 'CVRX';
        this.port = 42070;
        this.host = 'localhost';
    }

    connect() {
        if (this.isConnected) {
            log.debug('[XSOverlay] Already connected');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const url = `ws://${this.host}:${this.port}/?client=${this.clientName}`;
            log.info(`[XSOverlay] Attempting to connect to ${url}`);

            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                log.info('[XSOverlay] Connected successfully');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startPing();
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    log.debug('[XSOverlay] Received message:', message);
                } catch (err) {
                    log.warn('[XSOverlay] Failed to parse message:', data.toString());
                }
            });

            this.ws.on('error', (error) => {
                log.error('[XSOverlay] WebSocket error:', error.message);
                this.isConnected = false;
                reject(error);
            });

            this.ws.on('close', (code, reason) => {
                log.info(`[XSOverlay] Connection closed: ${code} - ${reason}`);
                this.isConnected = false;
                this.stopPing();
                this.scheduleReconnect();
            });

            this.ws.on('pong', () => {
                // Connection is alive
            });
        });
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
            }
        }, 30000); // Ping every 30 seconds
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log.warn('[XSOverlay] Max reconnection attempts reached, giving up');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        log.info(`[XSOverlay] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect().catch(err => {
                    log.error('[XSOverlay] Reconnection failed:', err.message);
                });
            }
        }, delay);
    }

    sendNotification(notification) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            log.warn('[XSOverlay] Cannot send notification - not connected');
            return Promise.reject(new Error('Not connected to XSOverlay'));
        }

        const notificationData = {
            type: 1,
            index: 0,
            timeout: notification.timeout || 3.0,
            height: notification.height || 175,
            opacity: notification.opacity || 1.0,
            volume: 0.0, // No audio - CVRX handles audio
            audioPath: "",
            title: notification.title || "",
            content: notification.content || "",
            useBase64Icon: false, // We're using file paths now
            icon: notification.icon || "",
            sourceApp: this.clientName
        };

        const xsMessage = {
            sender: this.clientName,
            target: "xsoverlay",
            command: "SendNotification",
            jsonData: JSON.stringify(notificationData),
            rawData: null
        };

        return new Promise((resolve, reject) => {
            try {
                const message = JSON.stringify(xsMessage);
                log.info('[XSOverlay] Sending notification:', {
                    title: notificationData.title,
                    content: notificationData.content,
                    hasIcon: !!notificationData.icon,
                    iconPath: notificationData.icon || 'default',
                    useBase64Icon: notificationData.useBase64Icon
                });
                log.debug('[XSOverlay] Full message structure:', xsMessage);
                
                this.ws.send(message, (error) => {
                    if (error) {
                        log.error('[XSOverlay] Failed to send notification:', error.message);
                        reject(error);
                    } else {
                        log.info('[XSOverlay] Notification sent successfully');
                        resolve();
                    }
                });
            } catch (err) {
                log.error('[XSOverlay] Failed to serialize notification:', err.message);
                reject(err);
            }
        });
    }

    disconnect() {
        log.info('[XSOverlay] Disconnecting...');
        this.stopPing();
        this.isConnected = false;
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isReady() {
        return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}

// Singleton instance
let xsoverlayClient = null;

function getXSOverlayClient() {
    if (!xsoverlayClient) {
        xsoverlayClient = new XSOverlayClient();
    }
    return xsoverlayClient;
}

module.exports = {
    XSOverlayClient,
    getXSOverlayClient
};