// Media Utilities Module
// Provides common media operations for non-technical users
// Features: Video to GIF, Image resize, PDF split/merge

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { logger } = require('./logger');

const execAsync = promisify(exec);

class MediaUtils {
    constructor() {
        this.platform = os.platform();
        this.toolsAvailable = {};
        this.checkAvailableTools();
    }

    // Check which tools are available on the system
    async checkAvailableTools() {
        const tools = ['ffmpeg', 'convert', 'pdftk', 'gs'];

        for (const tool of tools) {
            try {
                await execAsync(`which ${tool}`);
                this.toolsAvailable[tool] = true;
            } catch {
                this.toolsAvailable[tool] = false;
            }
        }

        // sips is always available on macOS
        if (this.platform === 'darwin') {
            this.toolsAvailable['sips'] = true;
        }

        logger.info('[MediaUtils] Available tools:', this.toolsAvailable);
        return this.toolsAvailable;
    }

    // Get available tools status
    getToolsStatus() {
        return {
            ffmpeg: this.toolsAvailable['ffmpeg'] || false,
            imageTools: this.toolsAvailable['sips'] || this.toolsAvailable['convert'] || false,
            pdfTools: this.toolsAvailable['pdftk'] || this.toolsAvailable['gs'] || false
        };
    }

    // ============ Video to GIF ============

    async videoToGif(inputPath, options = {}) {
        if (!this.toolsAvailable['ffmpeg']) {
            return {
                success: false,
                error: 'ffmpeg is not installed. Install with: brew install ffmpeg'
            };
        }

        const {
            fps = 10,
            width = 480,
            maxColors = 64,
            duration = null,  // null = full video
            outputPath = null
        } = options;

        // Generate output path if not provided
        const inputDir = path.dirname(inputPath);
        const inputName = path.basename(inputPath, path.extname(inputPath));
        const output = outputPath || path.join(inputDir, `${inputName}.gif`);

        try {
            // Build ffmpeg command with palette generation for better quality
            let durationFlag = duration ? `-t ${duration}` : '';
            const cmd = `ffmpeg -y -i "${inputPath}" ${durationFlag} -vf "fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${maxColors}[p];[s1][p]paletteuse=dither=bayer" -loop 0 "${output}"`;

            logger.info('[MediaUtils] Converting video to GIF:', cmd);
            await execAsync(cmd);

            // Get file size
            const stats = fs.statSync(output);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            return {
                success: true,
                outputPath: output,
                size: `${sizeMB} MB`,
                message: `Created GIF: ${path.basename(output)} (${sizeMB} MB)`
            };
        } catch (error) {
            logger.error('[MediaUtils] Video to GIF failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============ Image Resize ============

    async resizeImage(inputPath, options = {}) {
        const {
            width = null,
            height = null,
            percentage = null,
            outputPath = null
        } = options;

        // Determine output path
        const inputDir = path.dirname(inputPath);
        const inputExt = path.extname(inputPath);
        const inputName = path.basename(inputPath, inputExt);
        const output = outputPath || path.join(inputDir, `${inputName}_resized${inputExt}`);

        try {
            let cmd;

            if (this.platform === 'darwin' && this.toolsAvailable['sips']) {
                // Use macOS built-in sips
                // First, copy the file
                fs.copyFileSync(inputPath, output);

                if (percentage) {
                    // Get original dimensions first
                    const { stdout } = await execAsync(`sips -g pixelWidth -g pixelHeight "${inputPath}"`);
                    const widthMatch = stdout.match(/pixelWidth:\s*(\d+)/);
                    const heightMatch = stdout.match(/pixelHeight:\s*(\d+)/);

                    if (widthMatch && heightMatch) {
                        const newWidth = Math.round(parseInt(widthMatch[1]) * percentage / 100);
                        const newHeight = Math.round(parseInt(heightMatch[1]) * percentage / 100);
                        cmd = `sips -z ${newHeight} ${newWidth} "${output}"`;
                    }
                } else if (width && height) {
                    cmd = `sips -z ${height} ${width} "${output}"`;
                } else if (width) {
                    cmd = `sips --resampleWidth ${width} "${output}"`;
                } else if (height) {
                    cmd = `sips --resampleHeight ${height} "${output}"`;
                }
            } else if (this.toolsAvailable['convert']) {
                // Use ImageMagick
                let resizeArg;
                if (percentage) {
                    resizeArg = `${percentage}%`;
                } else if (width && height) {
                    resizeArg = `${width}x${height}!`;
                } else if (width) {
                    resizeArg = `${width}x`;
                } else if (height) {
                    resizeArg = `x${height}`;
                }
                cmd = `convert "${inputPath}" -resize ${resizeArg} "${output}"`;
            } else {
                return {
                    success: false,
                    error: 'No image tools available. On macOS sips should be available. Install ImageMagick with: brew install imagemagick'
                };
            }

            logger.info('[MediaUtils] Resizing image:', cmd);
            await execAsync(cmd);

            // Get new dimensions
            let dimensions = '';
            if (this.platform === 'darwin') {
                const { stdout } = await execAsync(`sips -g pixelWidth -g pixelHeight "${output}"`);
                const w = stdout.match(/pixelWidth:\s*(\d+)/);
                const h = stdout.match(/pixelHeight:\s*(\d+)/);
                if (w && h) dimensions = `${w[1]}x${h[1]}`;
            }

            return {
                success: true,
                outputPath: output,
                dimensions,
                message: `Resized image saved: ${path.basename(output)} ${dimensions ? `(${dimensions})` : ''}`
            };
        } catch (error) {
            logger.error('[MediaUtils] Image resize failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============ Compress Image ============

    async compressImage(inputPath, options = {}) {
        const {
            quality = 80,  // 1-100
            outputPath = null
        } = options;

        const inputDir = path.dirname(inputPath);
        const inputExt = path.extname(inputPath).toLowerCase();
        const inputName = path.basename(inputPath, inputExt);
        const output = outputPath || path.join(inputDir, `${inputName}_compressed${inputExt}`);

        try {
            let cmd;

            if (this.platform === 'darwin' && this.toolsAvailable['sips']) {
                // sips can set JPEG quality
                fs.copyFileSync(inputPath, output);
                if (inputExt === '.jpg' || inputExt === '.jpeg') {
                    cmd = `sips -s formatOptions ${quality} "${output}"`;
                } else {
                    // Convert to JPEG for better compression
                    const jpgOutput = path.join(inputDir, `${inputName}_compressed.jpg`);
                    cmd = `sips -s format jpeg -s formatOptions ${quality} "${inputPath}" --out "${jpgOutput}"`;
                    return this._runCompressCommand(cmd, jpgOutput, inputPath);
                }
            } else if (this.toolsAvailable['convert']) {
                cmd = `convert "${inputPath}" -quality ${quality} "${output}"`;
            } else {
                return {
                    success: false,
                    error: 'No image tools available'
                };
            }

            return this._runCompressCommand(cmd, output, inputPath);
        } catch (error) {
            logger.error('[MediaUtils] Image compression failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async _runCompressCommand(cmd, outputPath, inputPath) {
        logger.info('[MediaUtils] Compressing image:', cmd);
        await execAsync(cmd);

        const originalSize = fs.statSync(inputPath).size;
        const newSize = fs.statSync(outputPath).size;
        const savedPercent = ((1 - newSize / originalSize) * 100).toFixed(1);

        return {
            success: true,
            outputPath,
            originalSize: this._formatBytes(originalSize),
            newSize: this._formatBytes(newSize),
            savedPercent: `${savedPercent}%`,
            message: `Compressed: ${this._formatBytes(originalSize)} → ${this._formatBytes(newSize)} (saved ${savedPercent}%)`
        };
    }

    // ============ PDF Split ============

    async splitPdf(inputPath, options = {}) {
        const {
            pages = null,  // e.g., "1-3" or "1,3,5" or "1-3,7"
            outputPath = null
        } = options;

        if (!pages) {
            return {
                success: false,
                error: 'Please specify which pages to extract (e.g., "1-3" or "1,3,5")'
            };
        }

        const inputDir = path.dirname(inputPath);
        const inputName = path.basename(inputPath, '.pdf');
        const output = outputPath || path.join(inputDir, `${inputName}_pages_${pages.replace(/,/g, '_')}.pdf`);

        try {
            let cmd;

            if (this.toolsAvailable['pdftk']) {
                // pdftk uses "cat" command for page ranges
                // Convert "1-3,5" format to pdftk format
                const pdftkPages = pages.replace(/-/g, '-');
                cmd = `pdftk "${inputPath}" cat ${pdftkPages} output "${output}"`;
            } else if (this.toolsAvailable['gs']) {
                // Ghostscript - works for simple ranges
                const pageRange = pages.split('-');
                const firstPage = pageRange[0];
                const lastPage = pageRange[1] || pageRange[0];
                cmd = `gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dFirstPage=${firstPage} -dLastPage=${lastPage} -sOutputFile="${output}" "${inputPath}"`;
            } else {
                return {
                    success: false,
                    error: 'No PDF tools available. Install with: brew install pdftk-java'
                };
            }

            logger.info('[MediaUtils] Splitting PDF:', cmd);
            await execAsync(cmd);

            return {
                success: true,
                outputPath: output,
                message: `Extracted pages ${pages} to: ${path.basename(output)}`
            };
        } catch (error) {
            logger.error('[MediaUtils] PDF split failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============ PDF Merge ============

    async mergePdfs(inputPaths, options = {}) {
        const { outputPath = null } = options;

        if (!inputPaths || inputPaths.length < 2) {
            return {
                success: false,
                error: 'Please provide at least 2 PDF files to merge'
            };
        }

        const firstInputDir = path.dirname(inputPaths[0]);
        const output = outputPath || path.join(firstInputDir, 'merged.pdf');

        try {
            let cmd;
            const inputFiles = inputPaths.map(p => `"${p}"`).join(' ');

            if (this.toolsAvailable['pdftk']) {
                cmd = `pdftk ${inputFiles} cat output "${output}"`;
            } else if (this.toolsAvailable['gs']) {
                cmd = `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -sOutputFile="${output}" ${inputFiles}`;
            } else {
                return {
                    success: false,
                    error: 'No PDF tools available. Install with: brew install pdftk-java'
                };
            }

            logger.info('[MediaUtils] Merging PDFs:', cmd);
            await execAsync(cmd);

            return {
                success: true,
                outputPath: output,
                fileCount: inputPaths.length,
                message: `Merged ${inputPaths.length} PDFs into: ${path.basename(output)}`
            };
        } catch (error) {
            logger.error('[MediaUtils] PDF merge failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============ Get File Info ============

    async getMediaInfo(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const stats = fs.statSync(filePath);
        const info = {
            path: filePath,
            name: path.basename(filePath),
            size: this._formatBytes(stats.size),
            sizeBytes: stats.size,
            type: this._getFileType(ext)
        };

        try {
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'].includes(ext)) {
                if (this.platform === 'darwin') {
                    const { stdout } = await execAsync(`sips -g pixelWidth -g pixelHeight "${filePath}"`);
                    const w = stdout.match(/pixelWidth:\s*(\d+)/);
                    const h = stdout.match(/pixelHeight:\s*(\d+)/);
                    if (w && h) {
                        info.width = parseInt(w[1]);
                        info.height = parseInt(h[1]);
                        info.dimensions = `${w[1]}x${h[1]}`;
                    }
                }
            } else if (['.mov', '.mp4', '.avi', '.mkv', '.webm'].includes(ext)) {
                if (this.toolsAvailable['ffmpeg']) {
                    const { stderr } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of csv=p=0 "${filePath}"`);
                    const parts = stderr.trim().split(',');
                    if (parts.length >= 2) {
                        info.width = parseInt(parts[0]);
                        info.height = parseInt(parts[1]);
                        info.dimensions = `${parts[0]}x${parts[1]}`;
                        if (parts[2]) info.duration = `${parseFloat(parts[2]).toFixed(1)}s`;
                    }
                }
            } else if (ext === '.pdf') {
                if (this.toolsAvailable['pdftk']) {
                    const { stdout } = await execAsync(`pdftk "${filePath}" dump_data | grep NumberOfPages`);
                    const match = stdout.match(/NumberOfPages:\s*(\d+)/);
                    if (match) info.pageCount = parseInt(match[1]);
                }
            }
        } catch (e) {
            // Info extraction failed, continue with basic info
        }

        return info;
    }

    // ============ Helpers ============

    _formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    _getFileType(ext) {
        const types = {
            '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
            '.webp': 'image', '.heic': 'image', '.bmp': 'image',
            '.mov': 'video', '.mp4': 'video', '.avi': 'video', '.mkv': 'video', '.webm': 'video',
            '.pdf': 'pdf',
            '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio'
        };
        return types[ext] || 'unknown';
    }

    // Get available operations for a file type
    getAvailableOperations(fileType) {
        const operations = {
            image: ['resize', 'compress'],
            video: ['toGif'],
            pdf: ['split', 'merge'],
            unknown: []
        };
        return operations[fileType] || operations.unknown;
    }
}

module.exports = { MediaUtils };
