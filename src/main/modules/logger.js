// Logger Module - Centralized logging with levels
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class Logger {
    constructor() {
        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        };

        // Set from env or default to INFO
        const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
        this.currentLevel = this.levels[envLevel] ?? this.levels.INFO;

        this.colors = {
            DEBUG: '\x1b[36m', // Cyan
            INFO: '\x1b[32m',  // Green
            WARN: '\x1b[33m',  // Yellow
            ERROR: '\x1b[31m', // Red
            RESET: '\x1b[0m'
        };

        this.logFile = null;
        this.initLogFile();
    }

    initLogFile() {
        try {
            // Only create log file if app is ready
            if (app?.isReady()) {
                const logDir = path.join(app.getPath('userData'), 'logs');
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }
                const date = new Date().toISOString().split('T')[0];
                this.logFile = path.join(logDir, `relay-${date}.log`);
            }
        } catch (e) {
            // Ignore if can't create log file
        }
    }

    formatMessage(level, module, message, data) {
        const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
        const dataStr = data ? ` ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level}] [${module}] ${message}${dataStr}`;
    }

    log(level, module, message, data = null) {
        if (this.levels[level] < this.currentLevel) return;

        const formatted = this.formatMessage(level, module, message, data);
        const color = this.colors[level] || this.colors.RESET;

        // Console output with color
        console.log(`${color}${formatted}${this.colors.RESET}`);

        // File output without color
        if (this.logFile) {
            try {
                fs.appendFileSync(this.logFile, formatted + '\n');
            } catch (e) {
                // Ignore file write errors
            }
        }
    }

    debug(module, message, data) {
        this.log('DEBUG', module, message, data);
    }

    info(module, message, data) {
        this.log('INFO', module, message, data);
    }

    warn(module, message, data) {
        this.log('WARN', module, message, data);
    }

    error(module, message, data) {
        this.log('ERROR', module, message, data);
    }

    // Convenience method for logging objects
    dump(module, label, obj) {
        this.debug(module, label, obj);
    }

    setLevel(level) {
        this.currentLevel = this.levels[level.toUpperCase()] ?? this.levels.INFO;
    }
}

// Singleton instance
const logger = new Logger();

module.exports = { logger, Logger };
