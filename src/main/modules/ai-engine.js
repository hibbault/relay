// AI Engine Module
// Hybrid AI integration - Gemini API + Ollama for local inference
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http');
const { logger } = require('./logger');

class AIEngine {
    constructor() {
        this.geminiClient = null;
        this.ollamaHost = 'http://localhost:11434';
        this.ollamaModel = 'qwen3:1.7b';
        this.ollamaAvailable = false;
        this.conversationHistory = [];
        this.systemPrompt = this.buildSystemPrompt();
        this.useLocal = false; // Fallback to local when offline
        this.preferredProvider = 'gemini'; // 'gemini' or 'ollama'
    }

    buildSystemPrompt() {
        return `You are Relay, a friendly and patient AI IT assistant. Your purpose is to help non-technical users solve their computer problems.

PERSONALITY:
- Speak in plain, simple language - avoid technical jargon
- Be patient and reassuring - users may be frustrated
- Use friendly, conversational tone
- Explain WHY things happen, not just what to do
- Celebrate small wins with the user

CAPABILITIES - You can:
- Analyze system diagnostics and stats
- Run system queries to gather information
- Execute approved fixes on the user's computer
- Kill problematic processes
- Clear caches and temp files
- Empty the trash
- Flush DNS cache

UTILITY TOOLS - You can also help with everyday tasks:
- Generate secure passwords
- Create QR codes from text or URLs
- Convert HEIC photos to JPG (iPhone photos)
- Resize and compress images
- Split, merge, and compress PDF files
- Calculate file checksums (verify downloads)
- Format and validate JSON
- Text utilities: word count, case conversion, remove duplicates
- Encode/decode Base64

For utility requests, DIRECTLY perform the action without running diagnostics first!
Examples:
- "generate a password" → Generate and show the password immediately
- "convert my photo" → Ask for the file path, then convert
- "create a QR code for my website" → Generate the QR code

AVAILABLE ACTIONS (use these exact types in your response):
- "run-diagnostics" - Run a system health scan
- "kill-process" - Stop a specific application (include processName)
- "clear-caches" - Clear system cache files
- "empty-trash" - Empty the trash/recycle bin
- "flush-dns" - Reset network DNS cache
- "check-network-speed" - Run internet speed and latency test
- "run-deep-scan" - Analyze system logs for errors and crashes
- "open-app" - Launch an application (include appName)
- "restart-app" - Close and reopen an application (include appName)
- "query-system" - Get system information (include queryType: system-info, disk-usage, memory-info, process-list, top-processes, network-info, uptime, battery, startup-apps, installed-apps, temp-files-size, browser-processes, printer-status, printer-queue)

UTILITY ACTIONS:
- "generate-password" - Create a secure password (length=16, symbols=true)
- "generate-qrcode" - Create QR code (include content and optionally outputPath)
- "heic-to-jpg" - Convert HEIC to JPG (include inputPath)
- "resize-image" - Resize an image (include inputPath, width or height or percentage)
- "compress-image" - Compress an image (include inputPath, quality=80)
- "compress-pdf" - Compress a PDF (include inputPath, quality=ebook)
- "split-pdf" - Extract pages from PDF (include inputPath, pages like "1-3")
- "merge-pdfs" - Combine PDFs (include inputPaths as array)
- "file-hash" - Calculate checksum (include filePath, algorithm=sha256)

When you want to perform an action, include it in your response like this:
[ACTION: type="action-type" param="value"]

Examples:
- "Let me check what's using your memory. [ACTION: type="query-system" queryType="top-processes"]"
- "Here's a secure password for you! [ACTION: type="generate-password" length="16"]"
- "I'll create that QR code for you. [ACTION: type="generate-qrcode" content="https://example.com"]"

IMPORTANT RULES:
1. NEVER suggest or run dangerous actions like deleting system files
2. ALWAYS explain what an action will do before suggesting it
3. If unsure, ask for more information
4. Be honest about limitations
5. Prioritize safety over convenience
6. For destructive actions, always ask user permission first
7. For printer issues, ALWAYS check status and queue first before suggesting fixes.

DIAGNOSTIC PROTOCOL (AGENTIC MODE):
For complex or vague issues (e.g., "slow computer", "internet issues", "crashes"):
1.  **Empathize & Hypothesize**: Acknowledge the frustration and briefly list 2-3 possible causes.
2.  **Create a Diagnostic Plan**: Show the user a checklist of diagnostics you will perform. Use Markdown checkboxes:
    - [ ] Check CPU and Memory usage
    - [ ] Scan for application errors/crashes
    - [ ] Check storage space and disk health
3.  **Perform First Step**: Append the FIRST relevant action to your response.
4.  **Analyze & Continue**: When you receive [SYSTEM_RESULT], analyze it and ALWAYS:
    - Mark the completed item as [x]
    - Explain what you found in plain English
    - If the issue isn't resolved, immediately append the NEXT action
    - Continue until you find the root cause or exhaust your checklist
5.  **Conclude**: When you've identified the problem, suggest a FIX action and ask for permission.

SYSTEM RESULTS:
You will receive data in the format [SYSTEM_RESULT: queryType="..." output="..."].
- DO NOT repeat the raw output to the user.
- INTERPRET the data in plain English (e.g., "Chrome is using 2.5GB of memory - that's quite a lot!").
- If the result is empty or an error, explain what might be wrong.
- ALWAYS append another [ACTION] tag if there are more steps in your checklist, UNLESS you've found the root cause.

CONTINUATION SIGNAL:
- If you need to perform another diagnostic step, end your response with: [ACTION: type="query-system" queryType="..."]
- If you've found the issue and want to offer a fix, use: [ACTION: type="..." ...]
- If you're done and waiting for user input, do NOT include an action tag.

RESPONSE FORMAT:
- Keep responses concise but complete
- Use bullet points for lists
- Explain findings in simple terms
- Ask permission before executing fixes (not diagnostics)

You are chatting with a user who needs help with their computer. Be their patient friend.`
    }

    /**
     * Initialize AI clients
     */
    async initialize(config = {}) {
        // Initialize Gemini
        if (config.geminiApiKey) {
            try {
                const genAI = new GoogleGenerativeAI(config.geminiApiKey);
                const modelName = config.geminiModel || 'gemini-2.5-flash';

                // Models that support systemInstruction
                const supportsSystemInstruction = modelName.startsWith('gemini-');

                const modelConfig = { model: modelName };
                if (supportsSystemInstruction) {
                    modelConfig.systemInstruction = this.systemPrompt;
                }

                this.geminiClient = genAI.getGenerativeModel(modelConfig);
                this.geminiModelName = modelName;
                this.geminiSupportsSystemInstruction = supportsSystemInstruction;

                // Test connection
                await this.geminiClient.generateContent('Hello');
                this.geminiAvailable = true;
                logger.info('AI', 'Gemini AI initialized', { model: modelName, systemInstruction: supportsSystemInstruction });
            } catch (error) {
                logger.error('AI', 'Failed to initialize Gemini', { error: error.message });
            }
        }

        // Initialize Ollama (local) - using http module
        if (config.useOllama) {
            this.ollamaHost = config.ollamaHost || 'http://localhost:11434';
            this.ollamaModel = config.ollamaModel || 'qwen3:1.7b';
            this.ollamaTimeout = config.ollamaTimeout || 300000;
            try {
                const connected = await this.testOllamaConnection();
                this.ollamaAvailable = connected;
                if (connected) {
                    console.log('Ollama (local) initialized');
                }
            } catch (error) {
                console.warn('Ollama not available:', error.message);
                this.ollamaAvailable = false;
            }
        }
    }

    /**
     * Test Ollama connection using http
     */
    testOllamaConnection() {
        return new Promise((resolve) => {
            const parsed = new URL(`${this.ollamaHost}/api/tags`);
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || 11434,
                path: parsed.pathname,
                method: 'GET',
                timeout: 3000
            };

            const req = http.request(options, (res) => {
                res.on('data', () => { });
                res.on('end', () => resolve(res.statusCode === 200));
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.end();
        });
    }

    /**
     * Chat with AI - main interface
     */
    async chat(message, context = {}) {
        logger.debug('AI', 'Chat request received', { messageLength: message.length });

        // Build context-aware prompt
        const contextPrompt = this.buildContextPrompt(context);

        // Add to history
        this.conversationHistory.push({
            role: 'user',
            content: message
        });

        try {
            let response;

            // Use preferred provider (set by user in settings)
            const useOllama = this.preferredProvider === 'ollama' || this.useLocal;

            if (!useOllama && this.geminiClient) {
                logger.debug('AI', 'Using Gemini for response');
                response = await this.chatWithGemini(message, contextPrompt);
            } else if (this.ollamaAvailable) {
                logger.debug('AI', 'Using Ollama for response');
                response = await this.chatWithOllama(message, contextPrompt);
            } else if (this.geminiClient) {
                logger.debug('AI', 'Falling back to Gemini');
                response = await this.chatWithGemini(message, contextPrompt);
            } else {
                logger.debug('AI', 'Using fallback response');
                response = this.fallbackResponse(message, context);
            }

            // Add response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: response.text
            });

            return response;
        } catch (error) {
            logger.error('AI', 'Chat error', {
                error: error.message,
                stack: error.stack?.split('\n').slice(0, 3).join(' -> ')
            });

            // Try fallback to local if Gemini fails
            if (!this.useLocal && this.ollamaAvailable) {
                logger.warn('AI', 'Falling back to local AI...');
                this.useLocal = true;
                return this.chat(message, context);
            }

            return {
                text: "I'm having trouble connecting right now. Let me try to help with what I know. Can you describe your problem again?",
                error: true,
                errorMessage: error.message
            };
        }
    }

    /**
     * Build context prompt from system data
     */
    buildContextPrompt(context) {
        let contextStr = '';

        if (context.systemStats) {
            contextStr += `\nCURRENT SYSTEM STATUS:
- CPU Usage: ${context.systemStats.cpu?.usage || 'Unknown'}%
- Memory Usage: ${context.systemStats.memory?.usedPercent || 'Unknown'}%
- Disk: ${context.systemStats.disk?.map(d => `${d.mount}: ${d.usedPercent}% used`).join(', ') || 'Unknown'}`;
        }

        if (context.diagnostics) {
            contextStr += `\nDIAGNOSTICS RESULTS:
- Type: ${context.diagnostics.type}
- Issues Found: ${context.diagnostics.issues?.length || 0}
- Issues: ${context.diagnostics.issues?.map(i => i.message).join('; ') || 'None'}`;
        }

        if (context.systemProfile) {
            contextStr += `\nSYSTEM INFO:
- Computer: ${context.systemProfile.system?.manufacturer} ${context.systemProfile.system?.model}
- CPU: ${context.systemProfile.cpu?.brand}
- RAM: ${context.systemProfile.memory?.totalFormatted}
- OS: ${context.systemProfile.os?.distro} ${context.systemProfile.os?.release}`;
        }

        return contextStr;
    }

    /**
     * Chat with Gemini API
     */
    async chatWithGemini(message, contextPrompt) {
        // Only include system prompt if model doesn't support systemInstruction
        const systemPart = this.geminiSupportsSystemInstruction ? '' : `${this.systemPrompt}\n`;

        const fullPrompt = `${systemPart}${contextPrompt}

CONVERSATION HISTORY:
${this.conversationHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}

USER: ${message}

RELAY:`;

        const result = await this.geminiClient.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        // Parse for action suggestions
        const actions = this.parseActions(text);

        return {
            text,
            actions,
            source: 'gemini'
        };
    }

    /**
     * Chat with Ollama (local)
     */
    async chatWithOllama(message, contextPrompt) {
        const fullPrompt = `${this.systemPrompt}
${contextPrompt}

USER: ${message}

RELAY:`;

        return new Promise((resolve, reject) => {
            const parsed = new URL(`${this.ollamaHost}/api/generate`);
            const postData = JSON.stringify({
                model: this.ollamaModel,
                prompt: fullPrompt,
                stream: false
            });

            const options = {
                hostname: parsed.hostname,
                port: parsed.port || 11434,
                path: parsed.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: this.ollamaTimeout || 300000 // use setting or 5 min default
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const text = json.response;
                        const actions = this.parseActions(text);
                        resolve({
                            text,
                            actions,
                            source: 'ollama'
                        });
                    } catch (e) {
                        reject(new Error('Invalid Ollama response'));
                    }
                });
            });

            req.on('error', (error) => reject(error));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Ollama request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    /**
     * Fallback response for basic issues
     */
    fallbackResponse(message, context) {
        const lowerMessage = message.toLowerCase();

        // ============ UTILITY TOOL FALLBACKS ============

        if (lowerMessage.includes('password') && (lowerMessage.includes('generate') || lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('new'))) {
            return {
                text: "Sure! I'll generate a secure password for you right now. Here it is:",
                actions: [{ type: 'generate-password', length: 16, includeSymbols: true }],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('qr') && (lowerMessage.includes('code') || lowerMessage.includes('generate') || lowerMessage.includes('create'))) {
            return {
                text: "I can create a QR code for you! What text or URL would you like me to encode?",
                actions: [],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('heic') || (lowerMessage.includes('iphone') && lowerMessage.includes('photo'))) {
            return {
                text: "I can convert your HEIC photos to JPG! Just drag the file onto this window, or tell me the file path.",
                actions: [],
                source: 'fallback'
            };
        }

        if ((lowerMessage.includes('resize') || lowerMessage.includes('compress') || lowerMessage.includes('shrink')) && lowerMessage.includes('image')) {
            return {
                text: "I can resize or compress your image! Just tell me the file path and what size you'd like (e.g., '50%' or '800 pixels wide').",
                actions: [],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('pdf') && (lowerMessage.includes('compress') || lowerMessage.includes('smaller'))) {
            return {
                text: "I can compress your PDF to make it smaller! Just tell me the file path and I'll reduce its size.",
                actions: [],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('pdf') && (lowerMessage.includes('split') || lowerMessage.includes('extract') || lowerMessage.includes('pages'))) {
            return {
                text: "I can extract specific pages from your PDF! Tell me the file path and which pages you want (e.g., '1-3' or '1,3,5').",
                actions: [],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('pdf') && (lowerMessage.includes('merge') || lowerMessage.includes('combine') || lowerMessage.includes('join'))) {
            return {
                text: "I can merge multiple PDFs into one! Just give me the paths to the PDF files you want to combine.",
                actions: [],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('checksum') || lowerMessage.includes('hash') || lowerMessage.includes('verify') && lowerMessage.includes('download')) {
            return {
                text: "I can calculate the checksum of a file to verify it! What file would you like me to check, and what hash are you comparing against?",
                actions: [],
                source: 'fallback'
            };
        }

        // ============ SYSTEM DIAGNOSTIC FALLBACKS ============

        if (lowerMessage.includes('slow')) {
            return {
                text: "I understand your computer feels slow! Let me run a quick check to see what's going on. I'll look at your CPU, memory, and running programs to find the culprit. Would you like me to run a performance scan?",
                actions: [{ type: 'run-diagnostics', diagnosticType: 'performance' }],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('storage') || lowerMessage.includes('disk') || lowerMessage.includes('space')) {
            return {
                text: "Low storage can definitely cause problems! Let me check your disk space and see what's taking up room. Would you like me to scan your storage?",
                actions: [{ type: 'run-diagnostics', diagnosticType: 'storage' }],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('internet') || lowerMessage.includes('wifi') || lowerMessage.includes('network')) {
            return {
                text: "Network issues are frustrating! Let me check your network connections and see if everything looks okay. Want me to run a network diagnostic?",
                actions: [{ type: 'run-diagnostics', diagnosticType: 'network' }],
                source: 'fallback'
            };
        }

        if (lowerMessage.includes('virus') || lowerMessage.includes('malware') || lowerMessage.includes('security')) {
            return {
                text: "I understand the concern! Let me do a basic security check to look for anything suspicious. I'll check running processes and look for known bad patterns. Should I start?",
                actions: [{ type: 'run-diagnostics', diagnosticType: 'security' }],
                source: 'fallback'
            };
        }

        return {
            text: "I'm here to help! To better understand what's going on, would you like me to run a quick scan of your computer? I can check performance, storage, network, and security.",
            actions: [{ type: 'run-diagnostics', diagnosticType: 'quick' }],
            source: 'fallback'
        };
    }

    /**
     * Parse actions from AI response
     */
    parseActions(text) {
        const actions = [];
        const lowerText = text.toLowerCase();

        // Look for action triggers in the response
        if (lowerText.includes('run a scan') || lowerText.includes('run diagnostics') || lowerText.includes('check your system')) {
            actions.push({ type: 'suggest-diagnostics', diagnosticType: 'quick' });
        }

        if (lowerText.includes('close') && (lowerText.includes('application') || lowerText.includes('program') || lowerText.includes('app'))) {
            actions.push({ type: 'suggest-close-app' });
        }

        if (lowerText.includes('clean up') || lowerText.includes('delete') || lowerText.includes('remove files')) {
            actions.push({ type: 'suggest-cleanup' });
        }

        if ((lowerText.includes('restart') || lowerText.includes('reboot')) && (lowerText.includes('system') || lowerText.includes('computer') || lowerText.includes('mac') || lowerText.includes('pc'))) {
            actions.push({ type: 'suggest-restart' });
        }

        // App specific restart
        if (lowerText.includes('restart') && (lowerText.includes('app') || lowerText.includes('application') || lowerText.includes('program'))) {
            // Try to extract app name from "restart [Name]" or "restarting [Name]"
            const restartMatch = text.match(/restart(?:ing)?\s+([A-Z][a-zA-Z0-9.\-_]+)/i);
            if (restartMatch) {
                actions.push({ type: 'restart-app', appName: restartMatch[1] });
            } else {
                actions.push({ type: 'suggest-close-app' });
            }
        }

        return actions;
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Switch between cloud and local AI
     */
    setUseLocal(useLocal) {
        this.useLocal = useLocal;
    }
}

module.exports = { AIEngine };
