// Preload script - Secure bridge between main and renderer
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('relay', {
    // System profiling
    getSystemProfile: () => ipcRenderer.invoke('get-system-profile'),

    // Diagnostics
    runDiagnostics: (type) => ipcRenderer.invoke('run-diagnostics', type),
    getSystemStats: () => ipcRenderer.invoke('get-system-stats'),

    // AI Chat
    chat: (message, context) => ipcRenderer.invoke('chat', message, context),

    // Solution execution
    executeSolution: (solution) => ipcRenderer.invoke('execute-solution', solution),

    // Startup analyzer
    getStartupApps: () => ipcRenderer.invoke('get-startup-apps'),
    analyzeStartupImpact: () => ipcRenderer.invoke('analyze-startup-impact'),
    disableStartupItem: (item) => ipcRenderer.invoke('disable-startup-item', item),
    openStartupSettings: () => ipcRenderer.invoke('open-startup-settings'),

    // Health tips
    getRandomTip: () => ipcRenderer.invoke('get-random-tip'),
    getContextualTip: (diagnostics) => ipcRenderer.invoke('get-contextual-tip', diagnostics),
    getOnboardingTips: () => ipcRenderer.invoke('get-onboarding-tips'),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    getAISettings: () => ipcRenderer.invoke('get-ai-settings'),
    setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
    setAISettings: (settings) => ipcRenderer.invoke('set-ai-settings', settings),
    testOllamaConnection: (host) => ipcRenderer.invoke('test-ollama-connection', host),
    determineAIProvider: () => ipcRenderer.invoke('determine-ai-provider'),

    // Command Execution
    runSafeCommand: (commandKey) => ipcRenderer.invoke('run-safe-command', commandKey),
    runCustomCommand: (command) => ipcRenderer.invoke('run-custom-command', command),
    killProcess: (pid, force) => ipcRenderer.invoke('kill-process', pid, force),
    killProcessByName: (name) => ipcRenderer.invoke('kill-process-by-name', name),
    openApp: (appName) => ipcRenderer.invoke('open-app', appName),
    restartApp: (appName) => ipcRenderer.invoke('restart-app', appName),
    emptyTrash: () => ipcRenderer.invoke('empty-trash'),
    clearCaches: () => ipcRenderer.invoke('clear-caches'),
    flushDNS: () => ipcRenderer.invoke('flush-dns'),
    checkNetworkSpeed: () => ipcRenderer.invoke('check-network-speed'),
    runDeepScan: () => ipcRenderer.invoke('run-deep-scan'),
    getAvailableCommands: () => ipcRenderer.invoke('get-available-commands'),
    getCommandHistory: () => ipcRenderer.invoke('get-command-history'),

    // Event listeners from main process
    onQuickScan: (callback) => ipcRenderer.on('start-quick-scan', callback),
    onAnalyzeStartup: (callback) => ipcRenderer.on('analyze-startup', callback),
    onShowTip: (callback) => ipcRenderer.on('show-tip', (event, tip) => callback(tip)),
    onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
    onFirstRun: (callback) => ipcRenderer.on('first-run', callback),

    // Media Utilities
    mediaGetToolsStatus: () => ipcRenderer.invoke('media-get-tools-status'),
    mediaGetFileInfo: (filePath) => ipcRenderer.invoke('media-get-file-info', filePath),
    mediaVideoToGif: (inputPath, options) => ipcRenderer.invoke('media-video-to-gif', inputPath, options),
    mediaResizeImage: (inputPath, options) => ipcRenderer.invoke('media-resize-image', inputPath, options),
    mediaCompressImage: (inputPath, options) => ipcRenderer.invoke('media-compress-image', inputPath, options),
    mediaSplitPdf: (inputPath, options) => ipcRenderer.invoke('media-split-pdf', inputPath, options),
    mediaMergePdfs: (inputPaths, options) => ipcRenderer.invoke('media-merge-pdfs', inputPaths, options),
    mediaHeicToJpg: (inputPath, options) => ipcRenderer.invoke('media-heic-to-jpg', inputPath, options),
    mediaCompressPdf: (inputPath, options) => ipcRenderer.invoke('media-compress-pdf', inputPath, options),

    // Utility Tools
    utilGeneratePassword: (options) => ipcRenderer.invoke('util-generate-password', options),
    utilGenerateQRCode: (content, options) => ipcRenderer.invoke('util-generate-qrcode', content, options),
    utilFileHash: (filePath, algorithm) => ipcRenderer.invoke('util-file-hash', filePath, algorithm),
    utilVerifyHash: (filePath, expectedHash, algorithm) => ipcRenderer.invoke('util-verify-hash', filePath, expectedHash, algorithm),
    utilTextStats: (text) => ipcRenderer.invoke('util-text-stats', text),
    utilConvertCase: (text, caseType) => ipcRenderer.invoke('util-convert-case', text, caseType),
    utilRemoveDuplicateLines: (text) => ipcRenderer.invoke('util-remove-duplicate-lines', text),
    utilBase64Encode: (text) => ipcRenderer.invoke('util-base64-encode', text),
    utilBase64Decode: (encoded) => ipcRenderer.invoke('util-base64-decode', encoded),
    utilFormatJson: (jsonString) => ipcRenderer.invoke('util-format-json', jsonString),
    utilValidateJson: (jsonString) => ipcRenderer.invoke('util-validate-json', jsonString),

    // File Dialogs
    openFileDialog: (options) => ipcRenderer.invoke('dialog-open-file', options),
    saveFileDialog: (options) => ipcRenderer.invoke('dialog-save-file', options)
});
