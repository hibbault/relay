// Command Executor Module
// Safely executes system commands with whitelist and approval system

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const { logger } = require('./logger');

const execAsync = promisify(exec);

class CommandExecutor {
    constructor() {
        this.platform = os.platform();
        this.history = [];

        // Define safe commands that don't require approval
        this.safeCommands = this.getSafeCommands();

        // Commands that need user approval
        this.dangerousPatterns = [
            /rm\s+-rf/i,
            /rmdir/i,
            /del\s+\/s/i,
            /format/i,
            /mkfs/i,
            /dd\s+if=/i,
            />\s*\/dev\//i,
            /sudo/i,
            /chmod\s+777/i,
            /killall/i,
            /shutdown/i,
            /reboot/i,
        ];
    }

    /**
     * Get platform-specific safe commands
     */
    getSafeCommands() {
        const common = {
            // System info queries (read-only)
            'system-info': {
                darwin: 'system_profiler SPHardwareDataType',
                win32: 'systeminfo',
                linux: 'lscpu && free -h'
            },
            'disk-usage': {
                darwin: 'df -h',
                win32: 'wmic logicaldisk get size,freespace,caption',
                linux: 'df -h'
            },
            'memory-info': {
                darwin: 'vm_stat',
                win32: 'wmic memorychip get capacity',
                linux: 'free -h'
            },
            'process-list': {
                darwin: 'ps -ax -o pid,%mem,%cpu,comm | head -20',
                win32: 'powershell "Get-Process | Select-Object -First 20"',
                linux: 'ps aux | head -20'
            },
            'top-processes': {
                darwin: 'ps -amcwwwxo pid,%mem,%cpu,command | head -11',
                win32: 'powershell "Get-Process | Sort-Object -Property WS -Descending | Select-Object -First 10"',
                linux: 'ps aux --sort=-%mem | head -10'
            },
            'network-info': {
                darwin: 'networksetup -listallhardwareports && ifconfig en0',
                win32: 'ipconfig',
                linux: 'ip addr'
            },
            'dns-servers': {
                darwin: 'scutil --dns | grep nameserver | head -5',
                win32: 'powershell "(Get-DnsClientServerAddress).ServerAddresses"',
                linux: 'cat /etc/resolv.conf'
            },
            'uptime': {
                darwin: 'uptime',
                win32: 'powershell "(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime"',
                linux: 'uptime'
            },
            'battery': {
                darwin: 'pmset -g batt',
                win32: 'powershell "(Get-WmiObject Win32_Battery).EstimatedChargeRemaining"',
                linux: 'upower -i /org/freedesktop/UPower/devices/battery_BAT0'
            },
            'startup-apps': {
                darwin: 'osascript -e \'tell application "System Events" to get name of every login item\'',
                win32: 'powershell "Get-CimInstance Win32_StartupCommand | Select-Object Name, Command"',
                linux: 'ls ~/.config/autostart'
            },
            'installed-apps': {
                darwin: 'ls /Applications',
                win32: 'powershell "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName | Select-Object -First 30"',
                linux: 'dpkg --list | head -30'
            },
            'temp-files-size': {
                darwin: 'du -sh ~/Library/Caches 2>/dev/null || echo "N/A"',
                win32: 'powershell "(Get-ChildItem $env:TEMP -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB"',
                linux: 'du -sh /tmp 2>/dev/null || echo "N/A"'
            },
            'browser-processes': {
                darwin: 'ps aux | grep -iE "(Chrome|Safari|Firefox)" | grep -v grep | head -10',
                win32: 'powershell "Get-Process | Where-Object { $_.Name -match \'chrome|firefox|msedge\' } | Select-Object -First 10"',
                linux: 'ps aux | grep -E "(chrome|firefox)" | grep -v grep | head -10'
            },
            'printer-status': {
                darwin: 'lpstat -p',
                win32: 'powershell "Get-Printer | Select-Object Name,PrinterStatus,JobCount"',
                linux: 'lpstat -p'
            },
            'printer-queue': {
                darwin: 'lpstat -o',
                win32: 'powershell "Get-PrintJob -PrinterName *"',
                linux: 'lpstat -o'
            }
        };

        return common;
    }

    /**
     * Check if a command is safe (no approval needed)
     */
    isSafeCommand(commandKey) {
        return this.safeCommands.hasOwnProperty(commandKey);
    }

    /**
     * Check if a raw command contains dangerous patterns
     */
    isDangerous(command) {
        return this.dangerousPatterns.some(pattern => pattern.test(command));
    }

    /**
     * Run a predefined safe command
     */
    async runSafeCommand(commandKey) {
        if (!this.isSafeCommand(commandKey)) {
            return {
                success: false,
                error: `Unknown command: ${commandKey}`
            };
        }

        const commandMap = this.safeCommands[commandKey];
        const command = commandMap[this.platform];

        if (!command) {
            return {
                success: false,
                error: `Command not supported on ${this.platform}`
            };
        }

        logger.debug('CMD', `Running safe command: ${commandKey}`, { command });

        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000, // 30 second timeout
                maxBuffer: 1024 * 1024 // 1MB max output
            });

            this.logCommand(commandKey, command, true);

            return {
                success: true,
                output: stdout.trim(),
                stderr: stderr?.trim() || null
            };
        } catch (error) {
            logger.error('CMD', `Command failed: ${commandKey}`, { error: error.message });
            this.logCommand(commandKey, command, false, error.message);

            return {
                success: false,
                error: error.message,
                output: error.stdout?.trim() || null
            };
        }
    }

    /**
     * Run a custom command (requires approval in UI)
     */
    async runCustomCommand(command, options = {}) {
        // Security check
        if (this.isDangerous(command)) {
            logger.warn('CMD', 'Blocked dangerous command', { command });
            return {
                success: false,
                error: 'This command is not allowed for security reasons.',
                blocked: true
            };
        }

        logger.info('CMD', 'Running custom command', { command });

        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout: options.timeout || 60000,
                maxBuffer: 1024 * 1024,
                cwd: options.cwd || os.homedir()
            });

            this.logCommand('custom', command, true);

            return {
                success: true,
                output: stdout.trim(),
                stderr: stderr?.trim() || null
            };
        } catch (error) {
            logger.error('CMD', 'Custom command failed', { command, error: error.message });
            this.logCommand('custom', command, false, error.message);

            return {
                success: false,
                error: error.message,
                output: error.stdout?.trim() || null
            };
        }
    }

    /**
     * Kill a process by PID
     */
    async killProcess(pid, force = false) {
        const command = this.platform === 'win32'
            ? `taskkill ${force ? '/F' : ''} /PID ${pid}`
            : `kill ${force ? '-9' : ''} ${pid}`;

        logger.info('CMD', 'Killing process', { pid, force });

        try {
            await execAsync(command);
            this.logCommand('kill-process', command, true);
            return { success: true, message: `Process ${pid} terminated` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Kill a process by name
     */
    async killProcessByName(name) {
        // Sanitize process name
        const safeName = name.replace(/[^a-zA-Z0-9\s\-_.]/g, '');

        const command = this.platform === 'win32'
            ? `taskkill /F /IM "${safeName}.exe" 2>nul || taskkill /F /IM "${safeName}" 2>nul`
            : `pkill -x "${safeName}" || pkill "${safeName}"`;

        logger.info('CMD', 'Killing process by name', { name: safeName });

        try {
            await execAsync(command);
            this.logCommand('kill-by-name', command, true);
            return { success: true, message: `${safeName} terminated` };
        } catch (error) {
            // pkill returns error if no process found, which is ok
            if (error.message.includes('No matching')) {
                return { success: true, message: `${safeName} is not running` };
            }
            return { success: false, error: error.message };
        }
    }

    async open(target) {
        const command = this.platform === 'darwin'
            ? `open "${target}"`
            : this.platform === 'win32'
                ? `start "" "${target}"`
                : `xdg-open "${target}"`;

        logger.info('CMD', 'Opening', { target });

        try {
            await execAsync(command);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Launch an application
     */
    async openApp(appName) {
        // Sanitize app name to prevent command injection
        const safeName = appName.replace(/[^a-zA-Z0-9\s\-_.]/g, '');

        let command;
        if (this.platform === 'darwin') {
            command = `open -a "${safeName}"`;
        } else if (this.platform === 'win32') {
            // Try specific paths or just the name
            command = `start "" "${safeName}"`;
        } else {
            command = `${safeName}`;
        }

        logger.info('CMD', 'Opening App', { app: safeName });

        try {
            await execAsync(command);
            this.logCommand('open-app', command, true);
            return { success: true, message: `Opened ${safeName}` };
        } catch (error) {
            logger.error('CMD', 'Failed to open app', { app: safeName, error: error.message });
            return {
                success: false,
                error: `Could not open ${safeName}. It might not be installed or I can't find it.`
            };
        }
    }

    /**
     * Restart an application
     */
    async restartApp(appName) {
        logger.info('CMD', 'Restarting App', { app: appName });

        // 1. Kill the app
        const killResult = await this.killProcessByName(appName);

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 2. Open the app
        const openResult = await this.openApp(appName);

        if (openResult.success) {
            this.logCommand('restart-app', appName, true);
            return {
                success: true,
                message: `Restarted ${appName} successfully`
            };
        } else {
            return {
                success: false,
                error: `Closed ${appName} but failed to reopen it: ${openResult.error}`
            };
        }
    }

    /**
     * Empty the trash
     */
    async emptyTrash() {
        const command = this.platform === 'darwin'
            ? 'rm -rf ~/.Trash/*'
            : this.platform === 'win32'
                ? 'PowerShell.exe -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"'
                : 'rm -rf ~/.local/share/Trash/*';

        logger.info('CMD', 'Emptying trash');

        try {
            await execAsync(command);
            this.logCommand('empty-trash', command, true);
            return { success: true, message: 'Trash emptied successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get folder size in bytes
     */
    async getFolderSize(path) {
        try {
            if (this.platform === 'darwin' || this.platform === 'linux') {
                const { stdout } = await execAsync(`du -sk "${path}" 2>/dev/null | cut -f1`);
                return parseInt(stdout.trim()) * 1024 || 0; // Convert KB to bytes
            } else if (this.platform === 'win32') {
                const { stdout } = await execAsync(`powershell "(Get-ChildItem '${path}' -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum"`);
                return parseInt(stdout.trim()) || 0;
            }
        } catch (e) {
            return 0;
        }
        return 0;
    }

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Clear system caches with size reporting
     */
    async clearCaches() {
        const cleaned = [];
        let totalFreed = 0;

        if (this.platform === 'darwin') {
            const cachePaths = [
                { name: 'User Caches', path: `${os.homedir()}/Library/Caches` },
                { name: 'System Caches', path: '/Library/Caches' }
            ];

            for (const cache of cachePaths) {
                try {
                    const sizeBefore = await this.getFolderSize(cache.path);
                    await execAsync(`rm -rf "${cache.path}"/* 2>/dev/null`);
                    const sizeAfter = await this.getFolderSize(cache.path);
                    const freed = sizeBefore - sizeAfter;

                    if (freed > 0) {
                        cleaned.push(`${cache.name}: ${this.formatBytes(freed)}`);
                        totalFreed += freed;
                    }
                } catch (e) {
                    // Ignore permission errors
                }
            }

            this.logCommand('clear-caches', 'macOS cache clear', true);

            if (cleaned.length === 0) {
                return {
                    success: true,
                    message: 'Caches were already clean! No files to remove.'
                };
            }

            return {
                success: true,
                message: `Cleaned ${this.formatBytes(totalFreed)} total`,
                details: cleaned
            };

        } else if (this.platform === 'win32') {
            const tempPath = process.env.TEMP || `${os.homedir()}\\AppData\\Local\\Temp`;

            try {
                const sizeBefore = await this.getFolderSize(tempPath);
                await execAsync('del /q/f/s %TEMP%\\* 2>nul');
                const sizeAfter = await this.getFolderSize(tempPath);
                const freed = sizeBefore - sizeAfter;

                this.logCommand('clear-caches', 'Windows temp clear', true);

                if (freed > 0) {
                    return {
                        success: true,
                        message: `Cleaned ${this.formatBytes(freed)} of temp files`,
                        details: [`Temp folder: ${this.formatBytes(freed)}`]
                    };
                } else {
                    return {
                        success: true,
                        message: 'Temp folder was already clean!'
                    };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        return { success: false, error: 'Not supported on this platform' };
    }

    /**
     * Flush DNS cache
     */
    async flushDNS() {
        const command = this.platform === 'darwin'
            ? 'sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder'
            : this.platform === 'win32'
                ? 'ipconfig /flushdns'
                : 'sudo systemd-resolve --flush-caches';

        logger.info('CMD', 'Flushing DNS');

        try {
            await execAsync(command);
            this.logCommand('flush-dns', command, true);
            return { success: true, message: 'DNS cache flushed' };
        } catch (error) {
            return { success: false, error: error.message, requiresSudo: true };
        }
    }

    /**
     * Log command execution for audit
     */
    logCommand(type, command, success, error = null) {
        this.history.push({
            timestamp: new Date().toISOString(),
            type,
            command,
            success,
            error
        });

        // Keep only last 100 commands
        if (this.history.length > 100) {
            this.history = this.history.slice(-100);
        }
    }

    /**
     * Get command history
     */
    getHistory() {
        return this.history;
    }

    /**
     * Get list of available safe commands
     */
    getAvailableCommands() {
        return Object.keys(this.safeCommands).map(key => ({
            key,
            available: !!this.safeCommands[key][this.platform]
        }));
    }
}

module.exports = { CommandExecutor };
