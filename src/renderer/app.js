// Relay - Renderer Application
// Handles UI interactions and communicates with main process

class RelayApp {
    constructor() {
        this.chatContainer = document.getElementById('chatContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.quickScanBtn = document.getElementById('quickScanBtn');
        this.statsPanel = document.getElementById('statsPanel');
        this.statsHeader = document.getElementById('statsHeader');
        this.modalOverlay = document.getElementById('modalOverlay');

        this.isProcessing = false;
        this.systemContext = {};
        this.statsUpdateInterval = null;

        this.init();
    }

    async init() {
        // Set up event listeners
        this.setupEventListeners();

        // Load system profile
        await this.loadSystemProfile();

        // Start stats monitoring
        this.startStatsMonitoring();

        // Listen for IPC events from main
        this.setupIPCListeners();

        // Check if AI is configured
        await this.checkAIConfiguration();
    }

    async checkAIConfiguration() {
        try {
            const settings = await window.relay.getSettings();
            const hasApiKey = settings.ai?.geminiApiKey && settings.ai.geminiApiKey.length > 10;

            // If no API key, show onboarding message
            if (!hasApiKey) {
                setTimeout(() => {
                    this.addMessage(
                        "👋 **Welcome to Relay!**\n\n" +
                        "To get started, I need an AI connection. You can:\n\n" +
                        "1. **Get a free Gemini API key** from Google AI Studio\n" +
                        "2. Click the ⚙️ Settings button to configure it\n\n" +
                        "Or if you have Ollama running locally, you can use that instead!",
                        'assistant',
                        [{ type: 'open-settings' }]
                    );
                }, 500);
            }
        } catch (error) {
            console.error('Failed to check AI config:', error);
        }
    }

    setupEventListeners() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });

        // Quick scan
        this.quickScanBtn.addEventListener('click', () => this.runQuickScan());

        // Stats panel toggle
        this.statsHeader.addEventListener('click', () => {
            this.statsPanel.classList.toggle('collapsed');
        });

        // Modal controls
        document.getElementById('modalClose').addEventListener('click', () => this.hideModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.hideModal());
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) this.hideModal();
        });

        // Window controls
        document.getElementById('minimizeBtn').addEventListener('click', () => {
            // Electron will handle this via IPC
            window.close(); // Minimizes to tray
        });
        document.getElementById('closeBtn').addEventListener('click', () => {
            window.close();
        });
    }

    setupIPCListeners() {
        // Listen for quick scan trigger from tray
        window.relay.onQuickScan(() => {
            this.runQuickScan();
        });

        // Listen for settings open request
        window.relay.onOpenSettings(() => {
            this.openSettings();
        });
    }

    async loadSystemProfile() {
        try {
            this.setStatus('busy', 'Loading system info...');
            const profile = await window.relay.getSystemProfile();

            if (!profile.error) {
                this.systemContext.systemProfile = profile;
                this.setStatus('online', 'Ready to help');
            } else {
                this.setStatus('error', 'Error loading system info');
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
            this.setStatus('error', 'Error loading system info');
        }
    }

    startStatsMonitoring() {
        // Update stats every 3 seconds
        this.updateStats();
        this.statsUpdateInterval = setInterval(() => this.updateStats(), 3000);
    }

    async updateStats() {
        try {
            const stats = await window.relay.getSystemStats();

            if (!stats.error) {
                this.systemContext.systemStats = stats;

                // Update UI
                document.getElementById('cpuBar').style.width = stats.cpu.usage + '%';
                document.getElementById('cpuValue').textContent = stats.cpu.usage + '%';

                document.getElementById('ramBar').style.width = stats.memory.usedPercent + '%';
                document.getElementById('ramValue').textContent = stats.memory.usedPercent + '%';

                // Use first disk for main display
                if (stats.disk && stats.disk.length > 0) {
                    document.getElementById('diskBar').style.width = stats.disk[0].usedPercent + '%';
                    document.getElementById('diskValue').textContent = stats.disk[0].usedPercent + '%';
                }

                // Update bar colors based on values
                this.updateStatBarColors(stats);
            }
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    updateStatBarColors(stats) {
        const cpuBar = document.getElementById('cpuBar');
        const ramBar = document.getElementById('ramBar');
        const diskBar = document.getElementById('diskBar');

        // CPU coloring
        if (stats.cpu.usage > 80) {
            cpuBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        } else {
            cpuBar.style.background = 'linear-gradient(90deg, #22c55e, #f59e0b)';
        }

        // RAM coloring
        if (stats.memory.usedPercent > 85) {
            ramBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        }

        // Disk coloring
        if (stats.disk && stats.disk[0] && stats.disk[0].usedPercent > 90) {
            diskBar.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isProcessing) return;

        // Clear input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        // Add user message to chat
        this.addMessage(message, 'user');

        // Show typing indicator
        this.isProcessing = true;
        this.setStatus('busy', 'Thinking...');
        const typingId = this.showTypingIndicator();

        try {
            // Send to AI
            const response = await window.relay.chat(message, this.systemContext);

            // Remove typing indicator
            this.removeTypingIndicator(typingId);

            if (response.error) {
                // Show error with helpful message
                let errorText = response.text || 'Sorry, something went wrong.';

                if (response.errorMessage) {
                    // Parse common errors
                    if (response.errorMessage.includes('API key')) {
                        errorText = "⚠️ **API Key Issue**\n\nIt looks like there's a problem with the API key. Please click the ⚙️ Settings button to configure your Gemini API key.";
                        this.addMessage(errorText, 'assistant', [{ type: 'open-settings' }]);
                    } else if (response.errorMessage.includes('quota') || response.errorMessage.includes('429')) {
                        errorText = "⚠️ **Rate Limit Reached**\n\nYou've hit the API rate limit. Please wait a moment before trying again, or consider upgrading your API plan.";
                        this.addMessage(errorText, 'assistant');
                    } else if (response.errorMessage.includes('404')) {
                        errorText = "⚠️ **Model Not Found**\n\nThe AI model isn't available. Try checking your API settings.";
                        this.addMessage(errorText, 'assistant', [{ type: 'open-settings' }]);
                    } else {
                        this.addMessage(errorText + `\n\n_Error: ${response.errorMessage}_`, 'assistant');
                    }
                } else {
                    this.addMessage(errorText, 'assistant');
                }
                this.setStatus('error', 'AI error');
            } else {
                // Parse and handle any embedded actions from AI response
                const { text, actions } = this.parseAIResponse(response.text);

                // Check for utility actions that should auto-execute
                const utilityActionTypes = ['generate-password', 'generate-qrcode', 'file-hash', 'text-stats', 'format-json', 'base64-encode', 'base64-decode', 'convert-case'];
                const utilityActions = actions.filter(a => utilityActionTypes.includes(a.type));
                const otherActions = actions.filter(a => !utilityActionTypes.includes(a.type));

                // If there are utility actions, execute them and show results
                if (utilityActions.length > 0) {
                    for (const action of utilityActions) {
                        const result = await this.executeUtilityAction(action);
                        if (result) {
                            this.addMessage(text + '\n\n' + result, 'assistant', otherActions);
                        } else {
                            this.addMessage(text, 'assistant', [...(response.actions || []), ...actions]);
                        }
                    }
                } else {
                    this.addMessage(text, 'assistant', [...(response.actions || []), ...actions]);
                }

                // Auto-execute query-system actions
                for (const action of actions) {
                    if (action.type === 'query-system' && action.queryType) {
                        await this.executeQueryAction(action);
                    }
                }

                this.setStatus('online', 'Ready to help');
            }
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addMessage("I'm having trouble right now. Let me try a fresh start. Can you describe the problem again?", 'assistant');
            this.setStatus('error', 'Connection issue');
        } finally {
            this.isProcessing = false;
        }
    }

    async processSystemMessage(systemMessage, stepCount = 0) {
        const MAX_AGENTIC_STEPS = 10; // Prevent infinite loops

        // Only check isProcessing for the first call (stepCount = 0)
        if (stepCount === 0 && this.isProcessing) return;
        if (stepCount >= MAX_AGENTIC_STEPS) {
            this.addMessage("I've run several diagnostics but haven't pinpointed the issue yet. Let me summarize what I found and we can discuss next steps.", 'assistant');
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        this.setStatus('busy', `Analyzing... (step ${stepCount + 1})`);
        const typingId = this.showTypingIndicator();

        try {
            const response = await window.relay.chat(systemMessage, this.systemContext);
            this.removeTypingIndicator(typingId);

            if (response.error) {
                console.error('System follow-up error:', response.errorMessage);
                this.setStatus('error', 'Analysis failed');
                this.isProcessing = false;
            } else {
                const { text, actions } = this.parseAIResponse(response.text);

                // Filter out auto-executable actions from buttons
                const autoExecTypes = ['query-system', 'run-deep-scan'];
                const userActions = actions.filter(a => !autoExecTypes.includes(a.type));
                this.addMessage(text, 'assistant', [...(response.actions || []), ...userActions]);

                // Auto-execute diagnostic actions (agentic continuation)
                const queryActions = actions.filter(a => a.type === 'query-system' && a.queryType);
                const deepScanActions = actions.filter(a => a.type === 'run-deep-scan');

                // Reset isProcessing before any recursive calls
                this.isProcessing = false;

                if (queryActions.length > 0) {
                    // Execute query-system action
                    await this.executeQueryActionAgentic(queryActions[0], stepCount + 1);
                } else if (deepScanActions.length > 0) {
                    // Execute deep scan action
                    await this.executeDeepScan(stepCount + 1);
                } else {
                    this.setStatus('online', 'Ready to help');
                }
            }
        } catch (error) {
            this.removeTypingIndicator(typingId);
            console.error('System process failed:', error);
            this.setStatus('error', 'Error');
            this.isProcessing = false;
        }
    }

    async executeQueryActionAgentic(action, stepCount) {
        const queryLabels = {
            'system-info': 'Checking system info',
            'disk-usage': 'Checking disk usage',
            'memory-info': 'Checking memory',
            'process-list': 'Getting process list',
            'top-processes': 'Finding top memory users',
            'network-info': 'Checking network',
            'uptime': 'Checking uptime',
            'battery': 'Checking battery',
            'startup-apps': 'Getting startup apps',
            'installed-apps': 'Getting installed apps',
            'temp-files-size': 'Checking temp files',
            'browser-processes': 'Finding browser processes',
            'printer-status': 'Checking printer status',
            'printer-queue': 'Checking print queue'
        };

        const label = queryLabels[action.queryType] || 'Gathering info';
        this.setStatus('busy', `${label}...`);

        try {
            const result = await window.relay.runSafeCommand(action.queryType);

            if (result.success && result.output) {
                this.systemContext.lastQueryResult = {
                    type: action.queryType,
                    output: result.output.substring(0, 2000)
                };

                // Continue the agentic loop
                await this.processSystemMessage(
                    `[SYSTEM_RESULT: queryType="${action.queryType}" output="${result.output.substring(0, 1500)}"]`,
                    stepCount
                );
            } else if (result.error) {
                await this.processSystemMessage(
                    `[SYSTEM_RESULT: queryType="${action.queryType}" error="${result.error}"]`,
                    stepCount
                );
            } else {
                await this.processSystemMessage(
                    `[SYSTEM_RESULT: queryType="${action.queryType}" output="No data returned"]`,
                    stepCount
                );
            }
        } catch (error) {
            console.error('Agentic query failed:', error);
            this.addMessage(`❌ Query failed: ${error.message}`, 'assistant');
            this.setStatus('error', 'Query failed');
        }
    }

    addMessage(content, sender, actions = []) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatar = sender === 'user' ? '👤' : '🤖';

        let actionsHTML = '';
        if (actions && actions.length > 0) {
            actionsHTML = `
                <div class="action-buttons">
                    ${actions.map((action, i) => `
                        <button class="action-btn primary" data-action="${action.type}" data-index="${i}">
                            ${this.getActionLabel(action)}
                        </button>
                    `).join('')}
                    <button class="action-btn secondary" data-action="skip">No thanks</button>
                </div>
            `;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                ${this.formatMessage(content)}
                ${actionsHTML}
            </div>
        `;

        // Add event listeners to action buttons
        if (actions && actions.length > 0) {
            messageDiv.querySelectorAll('.action-btn').forEach(btn => {
                btn.addEventListener('click', () => this.handleAction(btn.dataset, actions));
            });
        }

        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatMessage(content) {
        // Basic markdown-like formatting
        if (!content) return '';

        let formatted = content
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Inline code
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Checkboxes
            .replace(/\[ \]/g, '<span class="checkbox">⬜</span>')
            .replace(/\[x\]/gi, '<span class="checkbox-checked">✅</span>')
            // Lists
            .replace(/^- (.*)$/gm, '<li>$1</li>');

        // Wrap lists in <ul>
        formatted = formatted.replace(/(<li>.*<\/li>)/s, match => {
            return `<ul>${match}</ul>`;
        });

        // New lines
        return formatted.replace(/\n/g, '<br>');
    }

    getActionLabel(action) {
        switch (action.type) {
            case 'run-diagnostics':
            case 'suggest-diagnostics':
                return '🔍 Run Scan';
            case 'suggest-close-app':
            case 'kill-process':
                return '✕ Close App';
            case 'suggest-cleanup':
            case 'clear-caches':
                return '🧹 Clear Cache';
            case 'empty-trash':
                return '🗑️ Empty Trash';
            case 'flush-dns':
                return '🌐 Fix Network';
            case 'suggest-restart':
                return '🔄 Restart System';
            case 'open-settings':
                return '⚙️ Open Settings';
            case 'open-app':
                return '🚀 Open App';
            case 'restart-app':
                return '🔄 Restart App';
            case 'check-network-speed':
                return '📶 Test Speed';
            case 'run-deep-scan':
                return '🩺 Deep Scan';
            case 'query-system':
                return '🔍 Check';
            // Utility actions
            case 'generate-password':
                return '🔐 Generate Password';
            case 'generate-qrcode':
                return '📱 Create QR Code';
            case 'heic-to-jpg':
                return '🖼️ Convert Photo';
            case 'resize-image':
                return '📐 Resize Image';
            case 'compress-image':
                return '🗜️ Compress Image';
            case 'compress-pdf':
                return '📄 Compress PDF';
            case 'split-pdf':
                return '✂️ Split PDF';
            case 'merge-pdfs':
                return '📑 Merge PDFs';
            case 'file-hash':
                return '🔍 Verify File';
            default:
                return '✓ Do it';
        }
    }

    async handleAction(dataset, actions) {
        const { action, index } = dataset;

        if (action === 'skip') {
            this.addMessage("No problem! Let me know if there's anything else I can help with.", 'assistant');
            return;
        }

        const actionData = actions[parseInt(index)];

        // Utility actions that should execute and show results
        const utilityActionTypes = [
            'generate-password', 'generate-qrcode', 'file-hash', 'text-stats',
            'format-json', 'base64-encode', 'base64-decode', 'convert-case',
            'heic-to-jpg', 'resize-image', 'compress-image', 'compress-pdf',
            'split-pdf', 'merge-pdfs', 'video-to-gif'
        ];

        if (actionData.type === 'open-settings') {
            this.openSettings();
        } else if (actionData.type === 'suggest-diagnostics' || actionData.type === 'run-diagnostics') {
            await this.runDiagnostics(actionData.diagnosticType || 'quick');
        } else if (actionData.type === 'query-system') {
            await this.executeQueryAction(actionData);
        } else if (actionData.type === 'check-network-speed') {
            await this.executeNetworkTest();
        } else if (actionData.type === 'run-deep-scan') {
            await this.executeDeepScan();
        } else if (utilityActionTypes.includes(actionData.type)) {
            // Handle utility actions - execute and show result
            await this.handleUtilityAction(actionData);
        } else if (['kill-process', 'clear-caches', 'empty-trash', 'flush-dns', 'open-app', 'restart-app'].includes(actionData.type)) {
            // Show confirmation modal for these actions
            this.showActionConfirmation(actionData);
        } else {
            // Show confirmation modal for other actions
            this.showActionConfirmation(actionData);
        }
    }

    /**
     * Handle utility action button clicks
     */
    async handleUtilityAction(actionData) {
        // For actions that need a file, open a file picker
        const needsFile = await this.getFileIfNeeded(actionData);

        if (needsFile === 'canceled') {
            this.addMessage('No problem! Let me know if you need anything else.', 'assistant');
            return;
        }

        // Execute the action
        this.setStatus('busy', 'Working...');
        const result = await this.executeUtilityAction(actionData);

        if (result) {
            this.addMessage(result, 'assistant');
        } else {
            this.addMessage('❌ Action failed. Please try again.', 'assistant');
        }

        this.setStatus('online', 'Ready to help');
    }

    /**
     * Open file picker if the action needs a file input
     */
    async getFileIfNeeded(action) {
        const fileFilters = {
            'heic-to-jpg': [{ name: 'HEIC Images', extensions: ['heic', 'HEIC'] }],
            'resize-image': [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }],
            'compress-image': [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }],
            'compress-pdf': [{ name: 'PDF Files', extensions: ['pdf'] }],
            'split-pdf': [{ name: 'PDF Files', extensions: ['pdf'] }],
            'merge-pdfs': [{ name: 'PDF Files', extensions: ['pdf'] }],
            'video-to-gif': [{ name: 'Videos', extensions: ['mov', 'mp4', 'avi', 'mkv', 'webm'] }],
            'file-hash': [{ name: 'All Files', extensions: ['*'] }]
        };

        const titles = {
            'heic-to-jpg': 'Select HEIC Photo to Convert',
            'resize-image': 'Select Image to Resize',
            'compress-image': 'Select Image to Compress',
            'compress-pdf': 'Select PDF to Compress',
            'split-pdf': 'Select PDF to Split',
            'merge-pdfs': 'Select PDFs to Merge',
            'video-to-gif': 'Select Video to Convert',
            'file-hash': 'Select File to Hash'
        };

        // Single file actions
        const singleFileActions = ['heic-to-jpg', 'resize-image', 'compress-image', 'compress-pdf', 'split-pdf', 'video-to-gif', 'file-hash'];

        if (singleFileActions.includes(action.type) && !action.inputPath && !action.filePath) {
            const result = await window.relay.openFileDialog({
                title: titles[action.type] || 'Select File',
                filters: fileFilters[action.type] || [{ name: 'All Files', extensions: ['*'] }],
                multiple: false
            });

            if (result.canceled) {
                return 'canceled';
            }

            // Set the path on the action
            action.inputPath = result.filePath;
            action.filePath = result.filePath;
        }

        // Multi-file actions (merge-pdfs)
        if (action.type === 'merge-pdfs' && !action.inputPaths) {
            const result = await window.relay.openFileDialog({
                title: 'Select PDFs to Merge (select 2 or more)',
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
                multiple: true
            });

            if (result.canceled || result.filePaths.length < 2) {
                if (!result.canceled && result.filePaths.length < 2) {
                    this.addMessage('📂 Please select at least 2 PDF files to merge.', 'assistant');
                }
                return 'canceled';
            }

            action.inputPaths = result.filePaths;
        }

        // For split-pdf, also need pages
        if (action.type === 'split-pdf' && !action.pages) {
            // Ask for pages - for now, prompt via a simple dialog concept
            // We'll handle this in executeUtilityAction
            action.pages = action.pages || '1'; // Default to first page if not specified
        }

        return null;
    }

    /**
     * Check if a utility action needs user input first
     */
    checkIfNeedsInput(action) {
        switch (action.type) {
            case 'heic-to-jpg':
            case 'resize-image':
            case 'compress-image':
            case 'compress-pdf':
            case 'video-to-gif':
                if (!action.inputPath) {
                    return '📂 Please tell me the file path, or drag and drop the file.';
                }
                break;
            case 'split-pdf':
                if (!action.inputPath) {
                    return '📂 Please provide the PDF file path and which pages you want (e.g., "1-3" or "1,5,7").';
                }
                if (!action.pages) {
                    return '📄 Which pages would you like to extract? (e.g., "1-3" or "1,5,7")';
                }
                break;
            case 'merge-pdfs':
                if (!action.inputPaths || action.inputPaths.length < 2) {
                    return '📂 Please provide the paths to 2 or more PDF files to merge.';
                }
                break;
            case 'generate-qrcode':
                if (!action.content) {
                    return '📝 What text or URL would you like to turn into a QR code?';
                }
                break;
            case 'file-hash':
                if (!action.filePath) {
                    return '📂 Which file would you like me to calculate the checksum for?';
                }
                break;
        }
        return null;
    }

    async runQuickScan() {
        await this.runDiagnostics('quick');
    }

    async runDiagnostics(type) {
        this.setStatus('busy', 'Running scan...');
        this.addMessage(`Running ${type} diagnostics... 🔍`, 'assistant');

        const typingId = this.showTypingIndicator();

        try {
            const results = await window.relay.runDiagnostics(type);
            this.removeTypingIndicator(typingId);

            if (results.error) {
                this.addMessage(`Oops! I couldn't complete the scan: ${results.error}`, 'assistant');
                this.setStatus('error', 'Scan failed');
                return;
            }

            // Store results in context for AI
            this.systemContext.diagnostics = results;

            // Format and display results
            const formattedResults = this.formatDiagnosticsResults(results);
            this.addMessage(formattedResults.text, 'assistant', formattedResults.actions);

            this.setStatus('online', 'Ready to help');
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addMessage('Sorry, the scan encountered an error. Please try again.', 'assistant');
            this.setStatus('error', 'Scan error');
        }
    }

    async executeNetworkTest() {
        this.setStatus('busy', 'Testing network...');
        this.addMessage('Starting network speed test... this might take a few seconds 📶', 'assistant');
        const typingId = this.showTypingIndicator();

        try {
            const result = await window.relay.checkNetworkSpeed();
            this.removeTypingIndicator(typingId);

            if (result.connection && result.connection.connected) {
                let msg = `**Network Test Results** 📊\n\n`;
                msg += `✅ **Status**: Connected\n`;

                if (result.latency.success) {
                    msg += `⏱️ **Latency**: ${result.latency.avgMs}ms to ${result.latency.host}\n`;
                } else {
                    msg += `⚠️ **Latency**: Test failed (${result.latency.error})\n`;
                }

                if (result.speed.success) {
                    msg += `🚀 **Download Speed**: ${result.speed.mbps} Mbps\n`;
                    msg += `📦 **Data Transferred**: ${result.speed.loadedMB} MB in 5s\n`;
                } else {
                    msg += `⚠️ **Speed Test**: Failed (${result.speed.error})\n`;
                }

                // Add interpretation
                if (result.speed.success) {
                    const speed = parseFloat(result.speed.mbps);
                    if (speed > 100) msg += `\n*Your internet is blazing fast!* 🔥`;
                    else if (speed > 25) msg += `\n*Your speed is good for streaming and calls.* 👍`;
                    else msg += `\n*Your connection is a bit slow.* 🐢`;
                }

                this.addMessage(msg, 'assistant', [{ type: 'suggest-diagnostics', label: 'Run Full Scan' }]);
            } else {
                this.addMessage(`❌ **No Internet Connection**\n\nUnknown error: ${result.connection.error || 'Check your wifi'}`, 'assistant');
            }

            this.setStatus('online', 'Ready to help');
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addMessage(`❌ Test failed: ${error.message}`, 'assistant');
            this.setStatus('error', 'Test error');
        }
    }

    async executeDeepScan(agenticStepCount = null) {
        this.setStatus('busy', 'Analyzing logs...');
        this.addMessage('Running deep system scan... checking logs and crash reports 🩺', 'assistant');
        const typingId = this.showTypingIndicator();

        try {
            const results = await window.relay.runDeepScan();
            this.removeTypingIndicator(typingId);

            const errorCount = results.errors ? results.errors.length : 0;
            const crashCount = results.crashes ? results.crashes.length : 0;

            // Build a summary for the AI
            let summary = `Errors: ${errorCount}, Crashes: ${crashCount}. `;
            if (crashCount > 0) {
                summary += `Crashing apps: ${results.crashes.map(c => c.app).join(', ')}. `;
            }
            if (errorCount === 0 && crashCount === 0) {
                summary += 'System logs are clean.';
            }

            // If in agentic mode, send results to AI for continuation
            if (agenticStepCount !== null) {
                await this.processSystemMessage(
                    `[SYSTEM_RESULT: queryType="deep-scan" output="${summary}"]`,
                    agenticStepCount
                );
            } else {
                // Non-agentic: show formatted results directly
                let msg = `**Deep Scan Results** 📋\n\n`;

                if (errorCount === 0 && crashCount === 0) {
                    msg += `✅ **System Logs Clean**: No recent critical errors found.\n`;
                    msg += `✅ **Crash Reports Clean**: No recent app crashes detected.\n\n`;
                    msg += `Your system seems very stable!`;
                } else {
                    if (crashCount > 0) {
                        msg += `🔴 **Found ${crashCount} Recent Crashes**:\n`;
                        results.crashes.forEach(crash => {
                            msg += `- **${crash.app}**: ${new Date(crash.timestamp).toLocaleString()}\n`;
                        });
                        msg += '\n';
                    } else {
                        msg += `✅ **No Crashes Detected**\n\n`;
                    }

                    if (errorCount > 0) {
                        msg += `⚠️ **Found ${errorCount} Recent System Errors**:\n`;
                        results.errors.slice(0, 3).forEach(err => {
                            const shortMsg = err.message.length > 80 ? err.message.substring(0, 80) + '...' : err.message;
                            msg += `- [${new Date(err.timestamp).toLocaleTimeString()}] ${shortMsg}\n`;
                        });
                        if (errorCount > 3) {
                            msg += `...and ${errorCount - 3} more.\n`;
                        }
                    } else {
                        msg += `✅ **No System Errors Detected**\n`;
                    }

                    msg += '\n*Note: Some errors are normal background noise. Focus on repeated app crashes.*';
                }

                this.addMessage(msg, 'assistant');
                this.setStatus('online', 'Ready to help');
            }

        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addMessage(`❌ Scan failed: ${error.message}`, 'assistant');
            this.setStatus('error', 'Scan error');
        }
    }

    formatDiagnosticsResults(results) {
        let text = '';
        let actions = [];

        if (results.healthy) {
            text = `**Great news!** Your system looks healthy! ✅\n\n`;
            text += `Here's a quick summary:\n`;
            text += `- **CPU**: ${results.stats?.cpu?.usage || 'N/A'}% usage\n`;
            text += `- **Memory**: ${results.stats?.memory?.usedPercent || 'N/A'}% used\n`;
        } else {
            text = `I found **${results.issues?.length || 0} issue(s)** that might need attention:\n\n`;

            results.issues?.forEach(issue => {
                const icon = issue.type === 'critical' ? '🔴' : (issue.type === 'warning' ? '🟡' : '🔵');
                text += `${icon} **${issue.message}**\n`;
                if (issue.suggestion) {
                    text += `   ↳ ${issue.suggestion}\n`;
                }
                text += '\n';
            });

            // Add action suggestions based on issues
            if (results.issues?.some(i => i.category === 'cpu' || i.category === 'memory')) {
                actions.push({ type: 'suggest-close-app', label: 'Show heavy apps' });
            }
            if (results.issues?.some(i => i.category === 'storage')) {
                actions.push({ type: 'suggest-cleanup', label: 'Clean up storage' });
            }
        }

        text += '\nWould you like me to help fix any of these?';

        return { text, actions };
    }

    showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = id;
        typingDiv.className = 'message assistant';
        typingDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        this.chatContainer.appendChild(typingDiv);
        this.scrollToBottom();
        return id;
    }

    removeTypingIndicator(id) {
        const typing = document.getElementById(id);
        if (typing) typing.remove();
    }

    setStatus(type, text) {
        this.statusIndicator.className = `status-indicator ${type}`;
        this.statusText.textContent = text;
    }

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    showActionConfirmation(action) {
        const modal = document.getElementById('actionModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalConfirm = document.getElementById('modalConfirm');

        modalTitle.textContent = 'Confirm Action';
        modalBody.innerHTML = `
            <p>I'm about to <strong>${this.getActionDescription(action)}</strong>.</p>
            <p>This action is safe and you can undo it if needed.</p>
            <p>Want me to proceed?</p>
        `;

        modalConfirm.onclick = async () => {
            this.hideModal();
            // Use executeApprovedAction for new command types
            if (['kill-process', 'clear-caches', 'empty-trash', 'flush-dns', 'open-app', 'restart-app'].includes(action.type)) {
                await this.executeApprovedAction(action);
            } else {
                await this.executeSolution(action);
            }
        };

        this.modalOverlay.classList.add('active');
    }

    hideModal() {
        this.modalOverlay.classList.remove('active');
    }

    getActionDescription(action) {
        switch (action.type) {
            case 'kill-process':
                return `close ${action.processName || 'the application'}`;
            case 'open-app':
                return `open ${action.appName || 'the application'}`;
            case 'restart-app':
                return `restart ${action.appName || 'the application'}`;
            case 'clear-caches':
                return 'clear system caches and temporary files';
            case 'flush-dns':
                return 'reset your network DNS settings';
            case 'empty-trash':
                return 'empty the trash/recycle bin';
            case 'disk-cleanup':
                return 'open disk cleanup utility';
            default:
                return 'perform this action';
        }
    }

    async executeSolution(solution) {
        this.setStatus('busy', 'Working on it...');
        this.addMessage('On it! Let me take care of that... ⚙️', 'assistant');

        try {
            const result = await window.relay.executeSolution(solution);

            if (result.success) {
                this.addMessage(`✅ **Done!** ${result.message}`, 'assistant');
                if (result.userAction) {
                    this.addMessage("I've opened a window for you. Let me know when you're done!", 'assistant');
                }
            } else {
                if (result.requiresApproval) {
                    this.addMessage(`⚠️ This action requires special permissions. ${result.error}`, 'assistant');
                } else {
                    this.addMessage(`❌ Sorry, that didn't work: ${result.error}. Let's try something else.`, 'assistant');
                }
            }

            this.setStatus('online', 'Ready to help');
        } catch (error) {
            this.addMessage(`Something went wrong: ${error.message}. Don't worry, nothing was changed.`, 'assistant');
            this.setStatus('error', 'Action failed');
        }
    }

    openSettings() {
        const overlay = document.getElementById('settingsOverlay');
        const providerSelect = document.getElementById('aiProvider');
        const geminiSettings = document.getElementById('geminiSettings');
        const ollamaSettings = document.getElementById('ollamaSettings');

        // Load current settings
        window.relay.getSettings().then(settings => {
            console.log('Loaded settings:', settings);

            // AI Provider - use saved provider, default to gemini if has key
            const provider = settings.ai?.provider || (settings.ai?.geminiApiKey ? 'gemini' : 'ollama');
            providerSelect.value = provider === 'auto' ? 'gemini' : provider;

            document.getElementById('geminiApiKey').value = settings.ai?.geminiApiKey || '';
            document.getElementById('geminiModel').value = settings.ai?.geminiModel || 'gemini-2.5-flash';
            document.getElementById('ollamaHost').value = settings.ai?.ollamaHost || 'http://localhost:11434';
            document.getElementById('ollamaModel').value = settings.ai?.ollamaModel || 'qwen3:1.7b';
            document.getElementById('ollamaTimeout').value = Math.round((settings.ai?.ollamaTimeout || 300000) / 60000);

            // Preferences
            document.getElementById('minimizeToTray').checked = settings.ui?.minimizeToTray !== false;
            document.getElementById('showStats').checked = settings.ui?.showStatsPanel !== false;
            document.getElementById('requireApproval').checked = settings.safety?.requireApproval !== false;

            // Toggle visibility based on provider
            this.toggleProviderSettings(providerSelect.value);
        });

        // Provider change handler
        providerSelect.onchange = () => {
            this.toggleProviderSettings(providerSelect.value);
        };

        // Link handler
        document.getElementById('geminiKeyLink').onclick = (e) => {
            e.preventDefault();
            require('electron').shell.openExternal('https://aistudio.google.com/app/apikey');
        };

        // Close handlers
        document.getElementById('settingsClose').onclick = () => overlay.classList.remove('active');
        document.getElementById('settingsCancel').onclick = () => overlay.classList.remove('active');

        // Save handler
        document.getElementById('settingsSave').onclick = async () => {
            const geminiKey = document.getElementById('geminiApiKey').value.trim();
            const geminiModel = document.getElementById('geminiModel').value;
            const ollamaHost = document.getElementById('ollamaHost').value.trim();
            const ollamaModel = document.getElementById('ollamaModel').value.trim();
            const ollamaTimeout = parseInt(document.getElementById('ollamaTimeout').value) * 60000 || 300000;
            const provider = providerSelect.value;

            const aiSettingsToSave = {
                provider: provider,
                geminiApiKey: geminiKey,
                geminiModel: geminiModel,
                ollamaHost: ollamaHost || 'http://localhost:11434',
                ollamaModel: ollamaModel || 'qwen3:1.7b',
                ollamaTimeout: ollamaTimeout
            };
            console.log('Saving AI settings:', aiSettingsToSave);

            // Save AI settings
            await window.relay.setAISettings(aiSettingsToSave);

            // Save UI settings
            await window.relay.setSetting('ui.minimizeToTray', document.getElementById('minimizeToTray').checked);
            await window.relay.setSetting('ui.showStatsPanel', document.getElementById('showStats').checked);
            await window.relay.setSetting('safety.requireApproval', document.getElementById('requireApproval').checked);

            overlay.classList.remove('active');
            this.addMessage('✅ Settings saved! The app will use the new configuration.', 'assistant');

            // Update stats panel visibility
            if (!document.getElementById('showStats').checked) {
                this.statsPanel.style.display = 'none';
            } else {
                this.statsPanel.style.display = 'block';
            }
        };

        overlay.classList.add('active');
    }

    toggleProviderSettings(provider) {
        const geminiSettings = document.getElementById('geminiSettings');
        const ollamaSettings = document.getElementById('ollamaSettings');

        if (provider === 'gemini') {
            geminiSettings.classList.remove('hidden');
            ollamaSettings.classList.add('hidden');
        } else {
            geminiSettings.classList.add('hidden');
            ollamaSettings.classList.remove('hidden');
        }
    }

    /**
     * Parse AI response for embedded actions
     * Format: [ACTION: type="action-type" param1="value1" param2="value2"]
     */
    parseAIResponse(responseText) {
        // Match the entire ACTION block
        const actionBlockRegex = /\[ACTION:\s*([^\]]+)\]/g;
        // Match individual key="value" pairs
        const paramRegex = /(\w+)="([^"]+)"/g;

        const actions = [];
        let text = responseText;

        let blockMatch;
        while ((blockMatch = actionBlockRegex.exec(responseText)) !== null) {
            const actionContent = blockMatch[1];
            const action = {};

            // Extract all parameters
            let paramMatch;
            while ((paramMatch = paramRegex.exec(actionContent)) !== null) {
                action[paramMatch[1]] = paramMatch[2];
            }

            if (action.type) {
                actions.push(action);
            }

            // Remove action tag from displayed text
            text = text.replace(blockMatch[0], '');
        }

        return { text: text.trim(), actions };
    }

    /**
     * Execute a query-system action and display results (starts agentic loop)
     */
    async executeQueryAction(action) {
        // Use the agentic version which handles the full loop
        await this.executeQueryActionAgentic(action, 0);
    }

    /**
     * Format command output for display
     */
    formatCommandOutput(queryType, output) {
        const labels = {
            'system-info': '💻 **System Info**',
            'disk-usage': '💾 **Disk Usage**',
            'memory-info': '🧠 **Memory Info**',
            'process-list': '📋 **Running Processes**',
            'top-processes': '📊 **Top Memory Users**',
            'network-info': '🌐 **Network Info**',
            'uptime': '⏱️ **Uptime**',
            'battery': '🔋 **Battery Status**',
            'startup-apps': '🚀 **Startup Apps**',
            'installed-apps': '📱 **Installed Apps**',
            'temp-files-size': '🗑️ **Temp Files Size**',
            'browser-processes': '🌐 **Browser Processes**'
        };

        const label = labels[queryType] || '📝 **Results**';

        // Truncate long output
        let displayOutput = output;
        if (output.length > 1000) {
            displayOutput = output.substring(0, 1000) + '\n... (truncated)';
        }

        return `${label}\n\`\`\`\n${displayOutput}\n\`\`\``;
    }

    /**
     * Execute an action that requires user approval
     */
    async executeApprovedAction(action) {
        this.setStatus('busy', 'Executing...');

        try {
            let result;
            switch (action.type) {
                case 'kill-process':
                    result = await window.relay.killProcessByName(action.processName);
                    break;
                case 'clear-caches':
                    result = await window.relay.clearCaches();
                    break;
                case 'empty-trash':
                    result = await window.relay.emptyTrash();
                    break;
                case 'flush-dns':
                    result = await window.relay.flushDNS();
                    break;
                case 'open-app':
                    result = await window.relay.openApp(action.appName);
                    break;
                case 'restart-app':
                    result = await window.relay.restartApp(action.appName);
                    break;
                default:
                    result = { success: false, error: 'Unknown action type' };
            }

            if (result.success) {
                let message = `✅ ${result.message || 'Done!'}`;

                // Add details if available (e.g., from clear-caches)
                if (result.details && result.details.length > 0) {
                    message += '\n\n**Cleaned:**\n' + result.details.map(d => `• ${d}`).join('\n');
                }

                this.addMessage(message, 'assistant');
            } else {
                this.addMessage(`❌ ${result.error || 'Action failed'}`, 'assistant');
            }

            this.setStatus('online', 'Ready to help');
        } catch (error) {
            this.addMessage(`❌ Error: ${error.message}`, 'assistant');
            this.setStatus('error', 'Action failed');
        }
    }

    /**
     * Execute utility actions and return formatted results
     */
    async executeUtilityAction(action) {
        try {
            let result;

            switch (action.type) {
                case 'generate-password':
                    const length = parseInt(action.length) || 16;
                    const includeSymbols = action.includeSymbols !== 'false';
                    const includeNumbers = action.includeNumbers !== 'false';
                    result = await window.relay.utilGeneratePassword({
                        length,
                        includeSymbols,
                        includeNumbers
                    });
                    if (result.success) {
                        return `🔐 **Your Secure Password:**\n\n\`${result.password}\`\n\n*Strength: ${result.strength} • ${result.length} characters*\n\n💡 *Tip: Copy this to a password manager!*`;
                    }
                    break;

                case 'generate-qrcode':
                    if (!action.content) {
                        return '❓ What text or URL would you like me to turn into a QR code?';
                    }
                    result = await window.relay.utilGenerateQRCode(action.content, {});
                    if (result.success) {
                        return `📱 **QR Code Created!**\n\nSaved to: \`${result.outputPath}\`\n\nContent: ${result.content}`;
                    }
                    break;

                case 'file-hash':
                    if (!action.filePath) {
                        return '❓ Which file would you like me to calculate the checksum for?';
                    }
                    result = await window.relay.utilFileHash(action.filePath, action.algorithm || 'sha256');
                    if (result.success) {
                        return `🔍 **${result.algorithm} Checksum:**\n\n\`${result.hash}\`\n\nFile: ${result.fileName}`;
                    }
                    break;

                case 'text-stats':
                    if (!action.text) {
                        return '❓ What text would you like me to analyze?';
                    }
                    result = await window.relay.utilTextStats(action.text);
                    if (result.success) {
                        return `📝 **Text Statistics:**\n\n• Words: ${result.words}\n• Characters: ${result.characters}\n• Lines: ${result.lines}\n• Sentences: ${result.sentences}`;
                    }
                    break;

                case 'format-json':
                    if (!action.jsonString) {
                        return '❓ Paste the JSON you want me to format.';
                    }
                    result = await window.relay.utilFormatJson(action.jsonString);
                    if (result.success) {
                        return `✅ **Formatted JSON:**\n\n\`\`\`json\n${result.result}\n\`\`\``;
                    } else {
                        return `❌ ${result.error}`;
                    }

                case 'base64-encode':
                    if (!action.text) {
                        return '❓ What text would you like me to encode?';
                    }
                    result = await window.relay.utilBase64Encode(action.text);
                    if (result.success) {
                        return `🔄 **Base64 Encoded:**\n\n\`${result.result}\``;
                    }
                    break;

                case 'base64-decode':
                    if (!action.encoded) {
                        return '❓ Paste the Base64 you want me to decode.';
                    }
                    result = await window.relay.utilBase64Decode(action.encoded);
                    if (result.success) {
                        return `🔄 **Decoded:**\n\n${result.result}`;
                    }
                    break;

                case 'convert-case':
                    if (!action.text || !action.caseType) {
                        return '❓ What text and case type (upper, lower, title)?';
                    }
                    result = await window.relay.utilConvertCase(action.text, action.caseType);
                    if (result.success) {
                        return `✅ **${action.caseType.toUpperCase()} Case:**\n\n${result.result}`;
                    }
                    break;

                // ============ MEDIA UTILITY ACTIONS ============

                case 'heic-to-jpg':
                    if (!action.inputPath) {
                        return '📂 Please provide the path to the HEIC file.';
                    }
                    result = await window.relay.mediaHeicToJpg(action.inputPath, {
                        quality: parseInt(action.quality) || 90
                    });
                    if (result.success) {
                        return `🖼️ **Converted to JPG!**\n\nSaved: \`${result.outputPath}\`\nSize: ${result.size}`;
                    }
                    break;

                case 'resize-image':
                    if (!action.inputPath) {
                        return '📂 Please provide the image file path.';
                    }
                    result = await window.relay.mediaResizeImage(action.inputPath, {
                        width: action.width ? parseInt(action.width) : null,
                        height: action.height ? parseInt(action.height) : null,
                        percentage: action.percentage ? parseInt(action.percentage) : null
                    });
                    if (result.success) {
                        return `📐 **Image Resized!**\n\nSaved: \`${result.outputPath}\`\nNew size: ${result.dimensions}`;
                    }
                    break;

                case 'compress-image':
                    if (!action.inputPath) {
                        return '📂 Please provide the image file path.';
                    }
                    result = await window.relay.mediaCompressImage(action.inputPath, {
                        quality: parseInt(action.quality) || 80
                    });
                    if (result.success) {
                        return `🗜️ **Image Compressed!**\n\n${result.message}`;
                    }
                    break;

                case 'compress-pdf':
                    if (!action.inputPath) {
                        return '📂 Please provide the PDF file path.';
                    }
                    result = await window.relay.mediaCompressPdf(action.inputPath, {
                        quality: action.quality || 'ebook'
                    });
                    if (result.success) {
                        return `📄 **PDF Compressed!**\n\n${result.message}\n\nSaved: \`${result.outputPath}\``;
                    }
                    break;

                case 'split-pdf':
                    if (!action.inputPath || !action.pages) {
                        return '📂 Please provide the PDF path and pages to extract (e.g., "1-3").';
                    }
                    result = await window.relay.mediaSplitPdf(action.inputPath, {
                        pages: action.pages
                    });
                    if (result.success) {
                        return `✂️ **PDF Split!**\n\n${result.message}`;
                    }
                    break;

                case 'merge-pdfs':
                    if (!action.inputPaths) {
                        return '📂 Please provide paths to 2 or more PDF files.';
                    }
                    // Parse inputPaths if it's a string
                    let paths = action.inputPaths;
                    if (typeof paths === 'string') {
                        paths = paths.split(',').map(p => p.trim());
                    }
                    result = await window.relay.mediaMergePdfs(paths, {});
                    if (result.success) {
                        return `📑 **PDFs Merged!**\n\n${result.message}`;
                    }
                    break;

                case 'video-to-gif':
                    if (!action.inputPath) {
                        return '📂 Please provide the video file path.';
                    }
                    result = await window.relay.mediaVideoToGif(action.inputPath, {
                        fps: parseInt(action.fps) || 10,
                        width: parseInt(action.width) || 480,
                        duration: action.duration ? parseInt(action.duration) : null
                    });
                    if (result.success) {
                        return `🎬 **GIF Created!**\n\nSaved: \`${result.outputPath}\`\nSize: ${result.size}`;
                    }
                    break;

                default:
                    return null;
            }

            if (result && !result.success) {
                return `❌ ${result.error || 'Action failed'}`;
            }

        } catch (error) {
            console.error('Utility action failed:', error);
            return `❌ Error: ${error.message}`;
        }

        return null;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RelayApp();

    // Settings button handler
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
        window.app.openSettings();
    });
});
