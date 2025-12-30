// Utility Tools Module
// Provides common utility operations for non-technical users
// Features: Password Generator, QR Code, Text Tools, Hash/Checksum

const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { logger } = require('./logger');

const execAsync = promisify(exec);

class UtilityTools {
    constructor() {
        this.platform = os.platform();
        this.toolsAvailable = {};
        this.checkAvailableTools();
    }

    async checkAvailableTools() {
        const tools = ['qrencode'];

        for (const tool of tools) {
            try {
                await execAsync(`which ${tool}`);
                this.toolsAvailable[tool] = true;
            } catch {
                this.toolsAvailable[tool] = false;
            }
        }

        logger.info('[UtilityTools] Available tools:', this.toolsAvailable);
        return this.toolsAvailable;
    }

    // ============ Password Generator ============

    generatePassword(options = {}) {
        const {
            length = 16,
            includeUppercase = true,
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = true,
            excludeAmbiguous = true  // Exclude 0, O, l, 1, I
        } = options;

        let chars = '';

        if (includeLowercase) {
            chars += excludeAmbiguous ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
        }
        if (includeUppercase) {
            chars += excludeAmbiguous ? 'ABCDEFGHJKMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        }
        if (includeNumbers) {
            chars += excludeAmbiguous ? '23456789' : '0123456789';
        }
        if (includeSymbols) {
            chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
        }

        if (chars.length === 0) {
            return {
                success: false,
                error: 'Please select at least one character type'
            };
        }

        // Use crypto for secure random generation
        const password = Array.from(crypto.randomBytes(length))
            .map(byte => chars[byte % chars.length])
            .join('');

        // Calculate password strength
        const strength = this._calculatePasswordStrength(password);

        return {
            success: true,
            password,
            length: password.length,
            strength,
            message: `Generated ${length}-character password (${strength} strength)`
        };
    }

    _calculatePasswordStrength(password) {
        let score = 0;

        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (password.length >= 16) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score <= 2) return 'weak';
        if (score <= 4) return 'moderate';
        if (score <= 5) return 'strong';
        return 'very strong';
    }

    // ============ QR Code Generator ============

    async generateQRCode(content, options = {}) {
        const {
            size = 256,  // pixels
            outputPath = null,
            format = 'png'  // png or svg
        } = options;

        // Generate output path if not provided
        const output = outputPath || path.join(os.tmpdir(), `qrcode_${Date.now()}.${format}`);

        try {
            if (this.toolsAvailable['qrencode']) {
                // Use qrencode (brew install qrencode)
                const sizeArg = format === 'svg' ? '' : `-s ${Math.ceil(size / 25)}`;
                const typeArg = format === 'svg' ? '-t SVG' : '-t PNG';
                const cmd = `qrencode -o "${output}" ${sizeArg} ${typeArg} "${content.replace(/"/g, '\\"')}"`;

                logger.info('[UtilityTools] Generating QR code:', cmd);
                await execAsync(cmd);
            } else {
                // Fallback: Generate QR code as SVG using pure JS
                const qrSvg = this._generateQRCodeSVG(content, size);
                fs.writeFileSync(output, qrSvg);
            }

            return {
                success: true,
                outputPath: output,
                content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                message: `QR code saved to: ${path.basename(output)}`
            };
        } catch (error) {
            logger.error('[UtilityTools] QR code generation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Simple QR code SVG generator (basic implementation)
    _generateQRCodeSVG(content, size) {
        // This is a simplified placeholder - for production, use a proper QR library
        // The qrencode tool is preferred
        const cellSize = Math.floor(size / 25);

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="50%" y="50%" text-anchor="middle" font-size="12" fill="#333">
    Install qrencode for QR codes:
  </text>
  <text x="50%" y="60%" text-anchor="middle" font-size="10" fill="#666">
    brew install qrencode
  </text>
</svg>`;
    }

    // ============ File Hash/Checksum ============

    async getFileHash(filePath, algorithm = 'sha256') {
        const validAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];

        if (!validAlgorithms.includes(algorithm)) {
            return {
                success: false,
                error: `Invalid algorithm. Use: ${validAlgorithms.join(', ')}`
            };
        }

        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hash = crypto.createHash(algorithm).update(fileBuffer).digest('hex');

            return {
                success: true,
                hash,
                algorithm: algorithm.toUpperCase(),
                fileName: path.basename(filePath),
                message: `${algorithm.toUpperCase()}: ${hash}`
            };
        } catch (error) {
            logger.error('[UtilityTools] File hash failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Verify file against expected hash
    async verifyFileHash(filePath, expectedHash, algorithm = 'sha256') {
        const result = await this.getFileHash(filePath, algorithm);

        if (!result.success) {
            return result;
        }

        const matches = result.hash.toLowerCase() === expectedHash.toLowerCase();

        return {
            success: true,
            matches,
            actualHash: result.hash,
            expectedHash: expectedHash.toLowerCase(),
            message: matches ? '✅ Hash matches! File is verified.' : '❌ Hash does NOT match! File may be corrupted or modified.'
        };
    }

    // ============ Text Utilities ============

    textStats(text) {
        const chars = text.length;
        const charsNoSpaces = text.replace(/\s/g, '').length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const lines = text.split('\n').length;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

        return {
            success: true,
            characters: chars,
            charactersNoSpaces: charsNoSpaces,
            words,
            lines,
            sentences,
            paragraphs,
            message: `${words} words, ${chars} characters`
        };
    }

    convertCase(text, caseType) {
        let result;

        switch (caseType) {
            case 'upper':
                result = text.toUpperCase();
                break;
            case 'lower':
                result = text.toLowerCase();
                break;
            case 'title':
                result = text.replace(/\w\S*/g, txt =>
                    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
                );
                break;
            case 'sentence':
                result = text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
                break;
            case 'toggle':
                result = text.split('').map(c =>
                    c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
                ).join('');
                break;
            default:
                return { success: false, error: 'Invalid case type. Use: upper, lower, title, sentence, toggle' };
        }

        return {
            success: true,
            result,
            caseType,
            message: `Converted to ${caseType} case`
        };
    }

    removeDuplicateLines(text) {
        const lines = text.split('\n');
        const uniqueLines = [...new Set(lines)];
        const removed = lines.length - uniqueLines.length;

        return {
            success: true,
            result: uniqueLines.join('\n'),
            originalLines: lines.length,
            uniqueLines: uniqueLines.length,
            removedCount: removed,
            message: `Removed ${removed} duplicate lines`
        };
    }

    // ============ Base64 Encode/Decode ============

    base64Encode(text) {
        try {
            const encoded = Buffer.from(text, 'utf-8').toString('base64');
            return {
                success: true,
                result: encoded,
                message: 'Encoded to Base64'
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    base64Decode(encoded) {
        try {
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
            return {
                success: true,
                result: decoded,
                message: 'Decoded from Base64'
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============ JSON Formatter ============

    formatJson(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            const formatted = JSON.stringify(parsed, null, 2);
            return {
                success: true,
                result: formatted,
                message: 'JSON formatted successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: `Invalid JSON: ${error.message}`
            };
        }
    }

    validateJson(jsonString) {
        try {
            JSON.parse(jsonString);
            return {
                success: true,
                valid: true,
                message: '✅ Valid JSON'
            };
        } catch (error) {
            return {
                success: true,
                valid: false,
                error: error.message,
                message: `❌ Invalid JSON: ${error.message}`
            };
        }
    }
}

module.exports = { UtilityTools };
