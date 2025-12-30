// Relay - Electron Main Process
require('dotenv').config();
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Module imports
const { SystemProfiler } = require('./modules/profiler');
const { DiagnosticsEngine } = require('./modules/diagnostics');
const { AIEngine } = require('./modules/ai-engine');
const { SolutionEngine } = require('./modules/solutions');
const { StartupAnalyzer } = require('./modules/startup-analyzer');
const { SettingsManager } = require('./modules/settings');
const { HealthTips } = require('./modules/health-tips');
const { CommandExecutor } = require('./modules/command-executor');
const { NetworkDiagnostics } = require('./modules/network-diagnostics');
const { LogAnalyzer } = require('./modules/log-analyzer');

// Initialize settings (replaces basic electron-store)
const settings = new SettingsManager();

let mainWindow;
let tray;

// Initialize core modules
const profiler = new SystemProfiler();
const diagnostics = new DiagnosticsEngine();
const aiEngine = new AIEngine();
const solutionEngine = new SolutionEngine();
const startupAnalyzer = new StartupAnalyzer();
const healthTips = new HealthTips();
const commandExecutor = new CommandExecutor();
const networkDiagnostics = new NetworkDiagnostics();
const logAnalyzer = new LogAnalyzer();

function createWindow() {
    const uiSettings = settings.getUISettings();

    mainWindow = new BrowserWindow({
        width: 450,
        height: 700,
        minWidth: 400,
        minHeight: 500,
        frame: false,
        transparent: false,
        resizable: true,
        show: !uiSettings.startMinimized,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#1a1a2e'
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Handle close to tray
    mainWindow.on('close', (event) => {
        if (settings.get('ui.minimizeToTray', true) && !app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

function createTray() {
    // Create tray icon
    const iconPath = path.join(__dirname, '../../assets/tray-icon.png');

    let trayIcon;
    try {
        trayIcon = nativeImage.createFromPath(iconPath);
        if (trayIcon.isEmpty()) {
            // Create a simple icon programmatically
            trayIcon = nativeImage.createFromDataURL(
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAGPSURBVDiNpZM9S8NAGMf/l+SSWKsOpYug4ODoIgiCq4ODg5OgiF/AwcHNwcHBwdHNwUE/gYNOgiCI4OAiiIgOLnYRBV/qe0tykudjzBUvTeoD/3Du7p7n/u99dwoAqSp+lZSMbQnJKIVKNQDAd+2/gtq8k1fM8/cCGvFwVQDeRYCQgoNvJK9CxeN1bBNgM4VLAaAGkAYCEIgVE4CwMAZsqwCCAL9DAC7TMAhEZwA8ANsEZHMHYCuAe4CeAAAAFAUhAZgGEC8BGB4HfgdA8wcAAAEwAAAADmC8xBqJPACAQABJAFIAUgAAAAQgAJIApAFEAcQAAAAAaADxAQAAABzAAADsFbwLAAMDAFAAJwAGAHASAAEAALAP4B7AXgVYBrAJYAZAPQQcAqgDAA6AA7AOoJEC1gGwD2ANQFYBsgBIAfAA0AD2ABQKFXYBRAGsAAAAADAJQBzAOoBuAAAAAJACoAFACYAKADEAXwGuAaQBbAGYAwAAAAAJACoARAFsAaAAAABbAGIAdAAoAlABIAHgF8AqgDMAvAD4B/APsAKgB+APwCeAPwDqAQABJAL8B/AEAA7AOYBPAHoBVAL8B/AM=');
        }
    } catch (e) {
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Relay', click: () => mainWindow.show() },
        { label: 'Quick Scan', click: () => runQuickScan() },
        { type: 'separator' },
        { label: 'Startup Apps', click: () => analyzeStartup() },
        { label: 'Health Tip', click: () => showRandomTip() },
        { type: 'separator' },
        { label: 'Settings', click: () => openSettings() },
        { type: 'separator' },
        {
            label: 'Quit', click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Relay - Your Personal IT Assistant');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

async function runQuickScan() {
    mainWindow.show();
    mainWindow.webContents.send('start-quick-scan');
}

async function analyzeStartup() {
    mainWindow.show();
    mainWindow.webContents.send('analyze-startup');
}

async function showRandomTip() {
    mainWindow.show();
    const tip = healthTips.getRandomTip();
    mainWindow.webContents.send('show-tip', tip);
}

function openSettings() {
    mainWindow.show();
    mainWindow.webContents.send('open-settings');
}

// ============ IPC Handlers ============

// Get system profile
ipcMain.handle('get-system-profile', async () => {
    try {
        return await profiler.getFullProfile();
    } catch (error) {
        console.error('Profile error:', error);
        return { error: error.message };
    }
});

// Run diagnostics
ipcMain.handle('run-diagnostics', async (event, type) => {
    try {
        return await diagnostics.run(type);
    } catch (error) {
        console.error('Diagnostics error:', error);
        return { error: error.message };
    }
});

// Chat with AI
ipcMain.handle('chat', async (event, message, context) => {
    try {
        // Initialize AI with current settings if not done
        const aiSettings = settings.getAISettings();
        if (aiSettings.geminiApiKey || aiSettings.ollamaHost) {
            await aiEngine.initialize({
                geminiApiKey: aiSettings.geminiApiKey,
                geminiModel: aiSettings.geminiModel,
                useOllama: true,
                ollamaHost: aiSettings.ollamaHost,
                ollamaModel: aiSettings.ollamaModel,
                ollamaTimeout: aiSettings.ollamaTimeout
            });
        }
        return await aiEngine.chat(message, context);
    } catch (error) {
        console.error('AI error:', error);
        return { error: error.message };
    }
});

// Execute solution (with user approval)
ipcMain.handle('execute-solution', async (event, solution) => {
    try {
        return await solutionEngine.execute(solution);
    } catch (error) {
        console.error('Solution error:', error);
        return { error: error.message };
    }
});

// Get current system stats
ipcMain.handle('get-system-stats', async () => {
    try {
        return await diagnostics.getCurrentStats();
    } catch (error) {
        console.error('Stats error:', error);
        return { error: error.message };
    }
});

// ============ Startup Analyzer ============

ipcMain.handle('get-startup-apps', async () => {
    try {
        return await startupAnalyzer.getStartupApps();
    } catch (error) {
        console.error('Startup apps error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('analyze-startup-impact', async () => {
    try {
        return await startupAnalyzer.analyzeStartupImpact();
    } catch (error) {
        console.error('Startup analysis error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('disable-startup-item', async (event, item) => {
    try {
        return await startupAnalyzer.disableStartupItem(item);
    } catch (error) {
        console.error('Disable startup error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('open-startup-settings', async () => {
    try {
        return await startupAnalyzer.openStartupSettings();
    } catch (error) {
        console.error('Open startup settings error:', error);
        return { error: error.message };
    }
});

// ============ Health Tips ============

ipcMain.handle('get-random-tip', () => {
    return healthTips.getRandomTip();
});

ipcMain.handle('get-contextual-tip', (event, diagnostics) => {
    return healthTips.getTipForContext(diagnostics);
});

ipcMain.handle('get-onboarding-tips', () => {
    return healthTips.getOnboardingTips();
});

// ============ Settings ============

ipcMain.handle('get-settings', () => {
    return settings.getAll();
});

ipcMain.handle('get-ai-settings', () => {
    return settings.getAISettings();
});

ipcMain.handle('set-setting', (event, key, value) => {
    settings.set(key, value);
    return true;
});

ipcMain.handle('set-ai-settings', async (event, aiSettings) => {
    settings.setAISettings(aiSettings);

    // Reinitialize AI engine with new settings
    const geminiApiKey = process.env.GEMINI_API_KEY || aiSettings.geminiApiKey;
    const useOllama = aiSettings.provider === 'ollama';

    // Set preferred provider
    aiEngine.preferredProvider = aiSettings.provider === 'ollama' ? 'ollama' : 'gemini';

    await aiEngine.initialize({
        geminiApiKey: geminiApiKey,
        geminiModel: aiSettings.geminiModel,
        useOllama: true, // Always initialize Ollama as fallback
        ollamaHost: aiSettings.ollamaHost,
        ollamaModel: aiSettings.ollamaModel,
        ollamaTimeout: aiSettings.ollamaTimeout
    });

    console.log('AI Engine reinitialized. Preferred provider:', aiEngine.preferredProvider);
    return true;
});

ipcMain.handle('test-ollama-connection', async (event, host) => {
    return await settings.testOllamaConnection(host);
});

ipcMain.handle('determine-ai-provider', async () => {
    return await settings.determineAIProvider();
});

// ============ Command Executor IPC ============

ipcMain.handle('run-safe-command', async (event, commandKey) => {
    return await commandExecutor.runSafeCommand(commandKey);
});

ipcMain.handle('run-custom-command', async (event, command) => {
    return await commandExecutor.runCustomCommand(command);
});

ipcMain.handle('kill-process', async (event, pid, force) => {
    return await commandExecutor.killProcess(pid, force);
});

ipcMain.handle('kill-process-by-name', async (event, name) => {
    return await commandExecutor.killProcessByName(name);
});

ipcMain.handle('empty-trash', async () => {
    return await commandExecutor.emptyTrash();
});

ipcMain.handle('clear-caches', async () => {
    return await commandExecutor.clearCaches();
});

ipcMain.handle('flush-dns', async () => {
    return await commandExecutor.flushDNS();
});

ipcMain.handle('get-available-commands', () => {
    return commandExecutor.getAvailableCommands();
});

ipcMain.handle('open-app', async (event, appName) => {
    return await commandExecutor.openApp(appName);
});

ipcMain.handle('restart-app', async (event, appName) => {
    return await commandExecutor.restartApp(appName);
});

ipcMain.handle('check-network-speed', async () => {
    return await networkDiagnostics.runFullTest();
});

ipcMain.handle('run-deep-scan', async () => {
    return await logAnalyzer.runDeepScan();
});

ipcMain.handle('get-command-history', () => {
    return commandExecutor.getHistory();
});

// ============ App Lifecycle ============


app.whenReady().then(async () => {
    createWindow();
    createTray();

    // Initialize system profile on first run
    if (settings.get('firstRun', true)) {
        console.log('First run - creating system profile...');
        const profile = await profiler.getFullProfile();
        settings.set('systemProfile', profile);
        settings.set('firstRun', false);
        console.log('System profile created');

        // Send onboarding tips
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('first-run');
        });
    }

    // Check AI provider status and initialize
    // Prefer environment variable for Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY || settings.getAISettings().geminiApiKey;
    const aiSettings = settings.getAISettings();

    // Initialize AI engine
    await aiEngine.initialize({
        geminiApiKey: geminiApiKey,
        geminiModel: aiSettings.geminiModel,
        useOllama: true, // Always initialize Ollama as fallback
        ollamaHost: aiSettings.ollamaHost,
        ollamaModel: aiSettings.ollamaModel,
        ollamaTimeout: aiSettings.ollamaTimeout
    });

    const provider = geminiApiKey ? 'gemini' : (aiEngine.ollamaAvailable ? 'ollama' : 'fallback');
    console.log('AI Engine initialized with:', provider);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Don't quit on macOS, keep in tray
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
});
