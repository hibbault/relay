// Settings Manager Module
// Handles app configuration and AI provider settings

const Store = require('electron-store');

class SettingsManager {
    constructor() {
        this.store = new Store({
            name: 'relay-settings',
            defaults: {
                // AI Settings
                ai: {
                    provider: 'auto', // 'auto', 'gemini', 'ollama'
                    geminiApiKey: '',
                    geminiModel: 'gemini-2.5-flash', // 'gemini-2.5-flash' or 'gemma-3-27b-it'
                    ollamaHost: 'http://localhost:11434',
                    ollamaModel: 'qwen3:1.7b',
                    ollamaTimeout: 300000, // 5 minutes default
                    preferLocal: false, // Prefer local AI for privacy
                },

                // UI Settings
                ui: {
                    theme: 'dark',
                    compactMode: false,
                    showStatsPanel: true,
                    startMinimized: false,
                    minimizeToTray: true,
                },

                // Monitoring Settings
                monitoring: {
                    statsUpdateInterval: 3000, // ms
                    autoScan: false,
                    autoScanInterval: 3600000, // 1 hour
                    notifyOnIssues: true,
                },

                // Safety Settings
                safety: {
                    requireApproval: true,
                    logAllActions: true,
                    createRestorePoints: true,
                },

                // Privacy Settings
                privacy: {
                    sendAnonymousUsage: false,
                    storeConversations: true,
                    conversationRetentionDays: 30,
                },

                // First run
                firstRun: true,
                systemProfiled: false,
            }
        });
    }

    // ============ Getters ============

    get(key, defaultValue) {
        return this.store.get(key, defaultValue);
    }

    getAll() {
        return this.store.store;
    }

    getAISettings() {
        return this.store.get('ai');
    }

    getUISettings() {
        return this.store.get('ui');
    }

    getMonitoringSettings() {
        return this.store.get('monitoring');
    }

    getSafetySettings() {
        return this.store.get('safety');
    }

    getPrivacySettings() {
        return this.store.get('privacy');
    }

    // ============ Setters ============

    set(key, value) {
        this.store.set(key, value);
    }

    setMultiple(settings) {
        Object.entries(settings).forEach(([key, value]) => {
            this.store.set(key, value);
        });
    }

    setAISettings(settings) {
        const current = this.getAISettings();
        this.store.set('ai', { ...current, ...settings });
    }

    setUISettings(settings) {
        const current = this.getUISettings();
        this.store.set('ui', { ...current, ...settings });
    }

    // ============ Validation ============

    validateGeminiKey(key) {
        // Basic validation - Gemini keys start with AI
        return key && key.length > 20 && key.startsWith('AI');
    }

    async testOllamaConnection(host = null) {
        const ollamaHost = host || this.store.get('ai.ollamaHost');
        const http = require('http');
        const url = require('url');

        return new Promise((resolve) => {
            try {
                const parsed = new URL(`${ollamaHost}/api/tags`);
                const options = {
                    hostname: parsed.hostname,
                    port: parsed.port || 11434,
                    path: parsed.pathname,
                    method: 'GET',
                    timeout: 3000
                };

                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve({
                                connected: true,
                                models: json.models.map(m => m.name),
                                host: ollamaHost
                            });
                        } catch (e) {
                            resolve({ connected: false, error: 'Invalid response', host: ollamaHost });
                        }
                    });
                });

                req.on('error', (error) => {
                    resolve({ connected: false, error: error.message, host: ollamaHost });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({ connected: false, error: 'Connection timeout', host: ollamaHost });
                });

                req.end();
            } catch (error) {
                resolve({ connected: false, error: error.message, host: ollamaHost });
            }
        });
    }

    // ============ AI Provider Selection ============

    async determineAIProvider() {
        const aiSettings = this.getAISettings();
        console.log('AI Settings:', aiSettings);

        if (aiSettings.provider === 'gemini') {
            if (this.validateGeminiKey(aiSettings.geminiApiKey)) {
                return { provider: 'gemini', ready: true };
            }
            return { provider: 'gemini', ready: false, error: 'Invalid API key' };
        }

        if (aiSettings.provider === 'ollama') {
            const ollamaStatus = await this.testOllamaConnection();
            console.log('Ollama status (forced):', ollamaStatus);
            return {
                provider: 'ollama',
                ready: ollamaStatus.connected,
                error: ollamaStatus.error,
                models: ollamaStatus.models
            };
        }

        // Auto mode - try Ollama first if preferLocal, otherwise Gemini
        if (aiSettings.preferLocal) {
            const ollamaStatus = await this.testOllamaConnection();
            console.log('Ollama status (preferLocal):', ollamaStatus);
            if (ollamaStatus.connected) {
                return { provider: 'ollama', ready: true, models: ollamaStatus.models };
            }
        }

        // Try Gemini
        if (this.validateGeminiKey(aiSettings.geminiApiKey)) {
            return { provider: 'gemini', ready: true };
        }

        // Fallback to Ollama
        console.log('Trying Ollama fallback...');
        const ollamaStatus = await this.testOllamaConnection();
        console.log('Ollama status (fallback):', ollamaStatus);
        if (ollamaStatus.connected) {
            return { provider: 'ollama', ready: true, models: ollamaStatus.models };
        }

        return {
            provider: 'none',
            ready: false,
            error: 'No AI provider available. Please configure Gemini API key or install Ollama.'
        };
    }

    // ============ Reset ============

    reset() {
        this.store.clear();
    }

    resetSection(section) {
        const defaults = this.store.defaults;
        if (defaults[section]) {
            this.store.set(section, defaults[section]);
        }
    }

    // ============ Export/Import ============

    exportSettings() {
        const settings = this.store.store;
        // Remove sensitive data
        const safeSettings = { ...settings };
        if (safeSettings.ai) {
            safeSettings.ai = { ...safeSettings.ai, geminiApiKey: '***' };
        }
        return safeSettings;
    }

    importSettings(settings) {
        // Don't import API keys
        if (settings.ai) {
            delete settings.ai.geminiApiKey;
        }
        this.setMultiple(settings);
    }
}

module.exports = { SettingsManager };
