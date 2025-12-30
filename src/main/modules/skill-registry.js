// Skill Registry Module
// Centralized definition of all skills/capabilities
// AI prompt is generated dynamically from this registry

/**
 * Skill Definition Schema:
 * {
 *   id: string,              // Unique identifier (used in ACTION tags)
 *   name: string,            // Human-readable name
 *   category: string,        // 'system', 'utility', 'media', etc.
 *   description: string,     // What it does (shown to AI)
 *   aiDescription: string,   // How AI should describe it to users
 *   params: [                // Required/optional parameters
 *     { name: string, type: string, required: boolean, description: string, default: any }
 *   ],
 *   examples: string[],      // Example user requests that trigger this skill
 *   handler: string          // IPC handler name or function reference
 * }
 */

const SKILL_CATEGORIES = {
    SYSTEM: 'system',
    UTILITY: 'utility',
    MEDIA: 'media',
    NETWORK: 'network',
    FILE: 'file'
};

const skills = [
    // ============ SYSTEM SKILLS ============
    {
        id: 'run-diagnostics',
        name: 'Run Diagnostics',
        category: SKILL_CATEGORIES.SYSTEM,
        description: 'Run a system health scan',
        aiDescription: 'I can scan your system for performance, storage, network, or security issues.',
        params: [
            { name: 'diagnosticType', type: 'string', required: false, description: 'Type: quick, performance, storage, network, security', default: 'quick' }
        ],
        examples: ['check my computer', 'run a scan', 'is my computer healthy'],
        handler: 'run-diagnostics'
    },
    {
        id: 'query-system',
        name: 'Query System Info',
        category: SKILL_CATEGORIES.SYSTEM,
        description: 'Get system information',
        aiDescription: 'I can check various system stats and information.',
        params: [
            { name: 'queryType', type: 'string', required: true, description: 'Types: system-info, disk-usage, memory-info, process-list, top-processes, network-info, uptime, battery, startup-apps, installed-apps, temp-files-size, browser-processes, printer-status, printer-queue' }
        ],
        examples: ['what processes are running', 'show memory usage', 'check disk space'],
        handler: 'query-system'
    },
    {
        id: 'kill-process',
        name: 'Kill Process',
        category: SKILL_CATEGORIES.SYSTEM,
        description: 'Stop a specific application',
        aiDescription: 'I can close applications that are not responding or using too many resources.',
        params: [
            { name: 'processName', type: 'string', required: true, description: 'Name of the process to kill' }
        ],
        examples: ['close chrome', 'kill spotify', 'stop this app'],
        handler: 'kill-process-by-name'
    },
    {
        id: 'open-app',
        name: 'Open Application',
        category: SKILL_CATEGORIES.SYSTEM,
        description: 'Launch an application',
        aiDescription: 'I can open applications for you.',
        params: [
            { name: 'appName', type: 'string', required: true, description: 'Name of the application' }
        ],
        examples: ['open safari', 'launch spotify', 'start finder'],
        handler: 'open-app'
    },
    {
        id: 'restart-app',
        name: 'Restart Application',
        category: SKILL_CATEGORIES.SYSTEM,
        description: 'Close and reopen an application',
        aiDescription: 'I can restart applications to fix issues.',
        params: [
            { name: 'appName', type: 'string', required: true, description: 'Name of the application' }
        ],
        examples: ['restart chrome', 'reboot finder'],
        handler: 'restart-app'
    },
    {
        id: 'clear-caches',
        name: 'Clear Caches',
        category: SKILL_CATEGORIES.SYSTEM,
        description: 'Clear system cache files',
        aiDescription: 'I can clear temporary files and caches to free up space.',
        params: [],
        examples: ['clear cache', 'delete temp files', 'free up space'],
        handler: 'clear-caches'
    },
    {
        id: 'empty-trash',
        name: 'Empty Trash',
        category: SKILL_CATEGORIES.SYSTEM,
        description: 'Empty the trash/recycle bin',
        aiDescription: 'I can empty your trash to free up disk space.',
        params: [],
        examples: ['empty trash', 'clear recycle bin', 'delete trash'],
        handler: 'empty-trash'
    },
    {
        id: 'flush-dns',
        name: 'Flush DNS',
        category: SKILL_CATEGORIES.NETWORK,
        description: 'Reset network DNS cache',
        aiDescription: 'I can reset your DNS cache to fix website loading issues.',
        params: [],
        examples: ['flush dns', 'reset dns', 'website not loading'],
        handler: 'flush-dns'
    },
    {
        id: 'check-network-speed',
        name: 'Check Network Speed',
        category: SKILL_CATEGORIES.NETWORK,
        description: 'Run internet speed and latency test',
        aiDescription: 'I can test your internet speed and connection quality.',
        params: [],
        examples: ['test my internet', 'check wifi speed', 'how fast is my connection'],
        handler: 'check-network-speed'
    },
    {
        id: 'run-deep-scan',
        name: 'Deep System Scan',
        category: SKILL_CATEGORIES.SYSTEM,
        description: 'Analyze system logs for errors and crashes',
        aiDescription: 'I can do a deep scan of your system logs to find hidden problems.',
        params: [],
        examples: ['deep scan', 'check logs', 'find errors'],
        handler: 'run-deep-scan'
    },

    // ============ UTILITY SKILLS ============
    {
        id: 'generate-password',
        name: 'Generate Password',
        category: SKILL_CATEGORIES.UTILITY,
        description: 'Create a secure random password',
        aiDescription: 'I can generate a strong, secure password for you.',
        params: [
            { name: 'length', type: 'number', required: false, description: 'Password length', default: 16 },
            { name: 'includeSymbols', type: 'boolean', required: false, description: 'Include special characters', default: true },
            { name: 'includeNumbers', type: 'boolean', required: false, description: 'Include numbers', default: true }
        ],
        examples: ['generate a password', 'create secure password', 'new password please', 'make me a password'],
        handler: 'util-generate-password'
    },
    {
        id: 'generate-qrcode',
        name: 'Generate QR Code',
        category: SKILL_CATEGORIES.UTILITY,
        description: 'Create a QR code from text or URL',
        aiDescription: 'I can create a QR code from any text or website link.',
        params: [
            { name: 'content', type: 'string', required: true, description: 'Text or URL to encode' },
            { name: 'outputPath', type: 'string', required: false, description: 'Where to save the QR code' }
        ],
        examples: ['create qr code', 'make a qr code for my website', 'generate qr'],
        handler: 'util-generate-qrcode'
    },
    {
        id: 'file-hash',
        name: 'Calculate File Hash',
        category: SKILL_CATEGORIES.UTILITY,
        description: 'Calculate checksum to verify file integrity',
        aiDescription: 'I can calculate a file checksum to verify downloads.',
        params: [
            { name: 'filePath', type: 'string', required: true, description: 'Path to the file' },
            { name: 'algorithm', type: 'string', required: false, description: 'Hash algorithm: md5, sha1, sha256, sha512', default: 'sha256' }
        ],
        examples: ['verify this download', 'check file hash', 'calculate checksum', 'md5 of file'],
        handler: 'util-file-hash'
    },
    {
        id: 'format-json',
        name: 'Format JSON',
        category: SKILL_CATEGORIES.UTILITY,
        description: 'Pretty-print and format JSON data',
        aiDescription: 'I can format messy JSON to make it readable.',
        params: [
            { name: 'jsonString', type: 'string', required: true, description: 'JSON to format' }
        ],
        examples: ['format this json', 'prettify json', 'make json readable'],
        handler: 'util-format-json'
    },
    {
        id: 'text-stats',
        name: 'Text Statistics',
        category: SKILL_CATEGORIES.UTILITY,
        description: 'Count words, characters, sentences in text',
        aiDescription: 'I can count words and characters in your text.',
        params: [
            { name: 'text', type: 'string', required: true, description: 'Text to analyze' }
        ],
        examples: ['word count', 'how many characters', 'count words'],
        handler: 'util-text-stats'
    },
    {
        id: 'convert-case',
        name: 'Convert Text Case',
        category: SKILL_CATEGORIES.UTILITY,
        description: 'Convert text to UPPER, lower, or Title Case',
        aiDescription: 'I can convert text between uppercase, lowercase, and title case.',
        params: [
            { name: 'text', type: 'string', required: true, description: 'Text to convert' },
            { name: 'caseType', type: 'string', required: true, description: 'Case type: upper, lower, title, sentence, toggle' }
        ],
        examples: ['make this uppercase', 'convert to lowercase', 'title case this'],
        handler: 'util-convert-case'
    },
    {
        id: 'base64-encode',
        name: 'Base64 Encode',
        category: SKILL_CATEGORIES.UTILITY,
        description: 'Encode text to Base64',
        aiDescription: 'I can encode text to Base64 format.',
        params: [
            { name: 'text', type: 'string', required: true, description: 'Text to encode' }
        ],
        examples: ['encode to base64', 'base64 this'],
        handler: 'util-base64-encode'
    },
    {
        id: 'base64-decode',
        name: 'Base64 Decode',
        category: SKILL_CATEGORIES.UTILITY,
        description: 'Decode Base64 to text',
        aiDescription: 'I can decode Base64 back to normal text.',
        params: [
            { name: 'encoded', type: 'string', required: true, description: 'Base64 to decode' }
        ],
        examples: ['decode base64', 'decode this'],
        handler: 'util-base64-decode'
    },

    // ============ MEDIA SKILLS ============
    {
        id: 'video-to-gif',
        name: 'Video to GIF',
        category: SKILL_CATEGORIES.MEDIA,
        description: 'Convert a video or screen recording to GIF',
        aiDescription: 'I can convert your videos or screen recordings to animated GIFs.',
        params: [
            { name: 'inputPath', type: 'string', required: true, description: 'Path to video file' },
            { name: 'fps', type: 'number', required: false, description: 'Frames per second', default: 10 },
            { name: 'width', type: 'number', required: false, description: 'Output width in pixels', default: 480 },
            { name: 'duration', type: 'number', required: false, description: 'Max duration in seconds' }
        ],
        examples: ['convert video to gif', 'make a gif from this video', 'create gif'],
        handler: 'media-video-to-gif'
    },
    {
        id: 'heic-to-jpg',
        name: 'HEIC to JPG',
        category: SKILL_CATEGORIES.MEDIA,
        description: 'Convert iPhone HEIC photos to JPG format',
        aiDescription: 'I can convert iPhone photos (HEIC) to standard JPG format.',
        params: [
            { name: 'inputPath', type: 'string', required: true, description: 'Path to HEIC file' },
            { name: 'quality', type: 'number', required: false, description: 'JPG quality 1-100', default: 90 }
        ],
        examples: ['convert heic to jpg', 'convert iphone photo', 'heic to jpeg'],
        handler: 'media-heic-to-jpg'
    },
    {
        id: 'resize-image',
        name: 'Resize Image',
        category: SKILL_CATEGORIES.MEDIA,
        description: 'Resize an image by percentage or fixed dimensions',
        aiDescription: 'I can resize your images to any size you need.',
        params: [
            { name: 'inputPath', type: 'string', required: true, description: 'Path to image' },
            { name: 'width', type: 'number', required: false, description: 'New width in pixels' },
            { name: 'height', type: 'number', required: false, description: 'New height in pixels' },
            { name: 'percentage', type: 'number', required: false, description: 'Scale percentage (e.g., 50)' }
        ],
        examples: ['resize this image', 'make image smaller', 'scale to 50%', 'resize to 800 pixels'],
        handler: 'media-resize-image'
    },
    {
        id: 'compress-image',
        name: 'Compress Image',
        category: SKILL_CATEGORIES.MEDIA,
        description: 'Reduce image file size',
        aiDescription: 'I can compress your images to reduce file size.',
        params: [
            { name: 'inputPath', type: 'string', required: true, description: 'Path to image' },
            { name: 'quality', type: 'number', required: false, description: 'Quality 1-100', default: 80 }
        ],
        examples: ['compress this image', 'reduce image size', 'make image smaller file'],
        handler: 'media-compress-image'
    },
    {
        id: 'compress-pdf',
        name: 'Compress PDF',
        category: SKILL_CATEGORIES.MEDIA,
        description: 'Reduce PDF file size',
        aiDescription: 'I can compress PDFs to make them smaller for sharing.',
        params: [
            { name: 'inputPath', type: 'string', required: true, description: 'Path to PDF' },
            { name: 'quality', type: 'string', required: false, description: 'Quality: screen, ebook, printer, prepress', default: 'ebook' }
        ],
        examples: ['compress this pdf', 'make pdf smaller', 'reduce pdf size'],
        handler: 'media-compress-pdf'
    },
    {
        id: 'split-pdf',
        name: 'Split PDF',
        category: SKILL_CATEGORIES.MEDIA,
        description: 'Extract specific pages from a PDF',
        aiDescription: 'I can extract specific pages from your PDF.',
        params: [
            { name: 'inputPath', type: 'string', required: true, description: 'Path to PDF' },
            { name: 'pages', type: 'string', required: true, description: 'Pages to extract, e.g., "1-3" or "1,3,5"' }
        ],
        examples: ['split this pdf', 'extract pages 1-3', 'get page 5 from pdf'],
        handler: 'media-split-pdf'
    },
    {
        id: 'merge-pdfs',
        name: 'Merge PDFs',
        category: SKILL_CATEGORIES.MEDIA,
        description: 'Combine multiple PDFs into one',
        aiDescription: 'I can combine multiple PDFs into a single file.',
        params: [
            { name: 'inputPaths', type: 'array', required: true, description: 'Array of PDF file paths' }
        ],
        examples: ['merge these pdfs', 'combine pdf files', 'join pdfs together'],
        handler: 'media-merge-pdfs'
    }
];

// ============ REGISTRY FUNCTIONS ============

/**
 * Get all skills
 */
function getAllSkills() {
    return skills;
}

/**
 * Get skills by category
 */
function getSkillsByCategory(category) {
    return skills.filter(s => s.category === category);
}

/**
 * Get a specific skill by ID
 */
function getSkillById(id) {
    return skills.find(s => s.id === id);
}

/**
 * Generate the capabilities section for AI prompt
 */
function generateCapabilitiesPrompt() {
    const systemSkills = getSkillsByCategory(SKILL_CATEGORIES.SYSTEM);
    const networkSkills = getSkillsByCategory(SKILL_CATEGORIES.NETWORK);
    const utilitySkills = getSkillsByCategory(SKILL_CATEGORIES.UTILITY);
    const mediaSkills = getSkillsByCategory(SKILL_CATEGORIES.MEDIA);

    let prompt = `CAPABILITIES - You can:\n`;

    // System capabilities
    prompt += `\nSYSTEM DIAGNOSTICS:\n`;
    [...systemSkills, ...networkSkills].forEach(skill => {
        prompt += `- ${skill.aiDescription}\n`;
    });

    // Utility capabilities
    prompt += `\nUTILITY TOOLS:\n`;
    utilitySkills.forEach(skill => {
        prompt += `- ${skill.aiDescription}\n`;
    });

    // Media capabilities
    prompt += `\nMEDIA & FILE TOOLS:\n`;
    mediaSkills.forEach(skill => {
        prompt += `- ${skill.aiDescription}\n`;
    });

    return prompt;
}

/**
 * Generate the available actions section for AI prompt
 */
function generateActionsPrompt() {
    let prompt = `\nAVAILABLE ACTIONS (use these exact IDs in your response):\n`;

    skills.forEach(skill => {
        const paramList = skill.params
            .filter(p => p.required)
            .map(p => p.name)
            .join(', ');

        const optionalParams = skill.params
            .filter(p => !p.required)
            .map(p => `${p.name}=${p.default !== undefined ? p.default : '...'}`)
            .join(', ');

        let paramHint = '';
        if (paramList) paramHint = ` (required: ${paramList})`;
        if (optionalParams) paramHint += ` (optional: ${optionalParams})`;

        prompt += `- "${skill.id}" - ${skill.description}${paramHint}\n`;
    });

    prompt += `\nWhen you want to perform an action, include it in your response like this:\n`;
    prompt += `[ACTION: type="action-id" param1="value1" param2="value2"]\n\n`;
    prompt += `Examples:\n`;
    prompt += `- "Let me check what's using your memory. [ACTION: type="query-system" queryType="top-processes"]"\n`;
    prompt += `- "Here's a secure password for you! [ACTION: type="generate-password" length="16"]"\n`;
    prompt += `- "I'll convert that photo. [ACTION: type="heic-to-jpg" inputPath="/path/to/photo.heic"]"\n`;

    return prompt;
}

/**
 * Generate example triggers for fallback matching
 */
function getExampleTriggers() {
    const triggers = {};
    skills.forEach(skill => {
        triggers[skill.id] = skill.examples;
    });
    return triggers;
}

/**
 * Find matching skill based on user message
 */
function findMatchingSkill(message) {
    const lowerMessage = message.toLowerCase();

    for (const skill of skills) {
        for (const example of skill.examples) {
            // Check if key words from example are in the message
            const keywords = example.toLowerCase().split(' ').filter(w => w.length > 3);
            const matchCount = keywords.filter(kw => lowerMessage.includes(kw)).length;

            if (matchCount >= Math.ceil(keywords.length / 2)) {
                return skill;
            }
        }
    }

    return null;
}

module.exports = {
    SKILL_CATEGORIES,
    getAllSkills,
    getSkillsByCategory,
    getSkillById,
    generateCapabilitiesPrompt,
    generateActionsPrompt,
    getExampleTriggers,
    findMatchingSkill
};
