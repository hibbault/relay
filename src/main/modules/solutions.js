// Solution Engine Module
// Executes fixes and solutions with safety mechanisms
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SolutionEngine {
    constructor() {
        this.platform = process.platform;
        this.auditLog = [];
    }

    /**
     * Execute a solution with safety checks
     */
    async execute(solution) {
        // Validate solution
        if (!solution || !solution.type) {
            throw new Error('Invalid solution provided');
        }

        // Check if it's a safe solution
        if (!this.isSafe(solution)) {
            return {
                success: false,
                error: 'This action requires additional approval due to safety concerns',
                requiresApproval: true
            };
        }

        // Log the action
        this.log('execute', solution);

        try {
            switch (solution.type) {
                case 'kill-process':
                    return await this.killProcess(solution.pid, solution.processName);

                case 'clear-cache':
                    return await this.clearCache(solution.cacheType);

                case 'flush-dns':
                    return await this.flushDNS();

                case 'suggest-restart':
                    return await this.suggestRestart();

                case 'suggest-close-app':
                    return await this.suggestCloseApp();

                case 'suggest-cleanup':
                    return await this.diskCleanup();

                case 'suggest-diagnostics':
                    return { success: true, message: 'Diagnostics suggested' };

                case 'restart-service':
                    return await this.restartService(solution.serviceName);

                case 'optimize-startup':
                    return await this.optimizeStartup();

                case 'disk-cleanup':
                    return await this.diskCleanup();

                case 'fix-network':
                    return await this.fixNetwork(solution.action);

                case 'empty-trash':
                    return await this.emptyTrash();

                default:
                    return {
                        success: false,
                        error: `Unknown solution type: ${solution.type}`
                    };
            }
        } catch (error) {
            this.log('error', { solution, error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if solution is safe to execute
     */
    isSafe(solution) {
        const dangerousTypes = [
            'delete-system-file',
            'modify-registry',
            'format-drive',
            'disable-security'
        ];

        return !dangerousTypes.includes(solution.type);
    }

    /**
     * Kill a process by PID
     */
    async killProcess(pid, processName) {
        if (!pid) {
            throw new Error('Process ID required');
        }

        let command;
        if (this.platform === 'darwin' || this.platform === 'linux') {
            command = `kill -9 ${pid}`;
        } else {
            command = `taskkill /PID ${pid} /F`;
        }

        try {
            await execPromise(command);
            return {
                success: true,
                message: `Successfully closed ${processName || 'the process'}`,
                action: 'process-killed',
                details: { pid, processName }
            };
        } catch (error) {
            throw new Error(`Failed to close process: ${error.message}`);
        }
    }

    /**
     * Clear various caches
     */
    async clearCache(cacheType = 'all') {
        const results = [];

        if (this.platform === 'darwin') {
            // macOS cache clearing
            const commands = [];

            if (cacheType === 'all' || cacheType === 'system') {
                commands.push({
                    name: 'System caches',
                    cmd: 'sudo purge 2>/dev/null || echo "Requires admin"'
                });
            }

            if (cacheType === 'all' || cacheType === 'dns') {
                commands.push({
                    name: 'DNS cache',
                    cmd: 'sudo dscacheutil -flushcache 2>/dev/null; sudo killall -HUP mDNSResponder 2>/dev/null || echo "DNS flushed"'
                });
            }

            for (const cmd of commands) {
                try {
                    await execPromise(cmd.cmd);
                    results.push({ name: cmd.name, success: true });
                } catch (e) {
                    results.push({ name: cmd.name, success: false, error: e.message });
                }
            }
        } else if (this.platform === 'win32') {
            // Windows cache clearing
            const commands = [];

            if (cacheType === 'all' || cacheType === 'temp') {
                commands.push({
                    name: 'Temp files',
                    cmd: 'del /q/f/s %TEMP%\\* 2>nul'
                });
            }

            if (cacheType === 'all' || cacheType === 'dns') {
                commands.push({
                    name: 'DNS cache',
                    cmd: 'ipconfig /flushdns'
                });
            }

            for (const cmd of commands) {
                try {
                    await execPromise(cmd.cmd, { shell: true });
                    results.push({ name: cmd.name, success: true });
                } catch (e) {
                    results.push({ name: cmd.name, success: false, error: e.message });
                }
            }
        }

        return {
            success: results.every(r => r.success),
            message: `Cache clearing complete. ${results.filter(r => r.success).length}/${results.length} successful`,
            action: 'cache-cleared',
            details: results
        };
    }

    /**
     * Flush DNS cache
     */
    async flushDNS() {
        let command;

        if (this.platform === 'darwin') {
            command = 'sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder';
        } else if (this.platform === 'win32') {
            command = 'ipconfig /flushdns';
        } else {
            command = 'sudo systemctl restart systemd-resolved';
        }

        try {
            await execPromise(command);
            return {
                success: true,
                message: 'DNS cache has been cleared. This can help fix website loading issues.',
                action: 'dns-flushed'
            };
        } catch (error) {
            throw new Error(`Failed to flush DNS: ${error.message}`);
        }
    }

    /**
     * Restart a system service
     */
    async restartService(serviceName) {
        if (!serviceName) {
            throw new Error('Service name required');
        }

        let command;

        if (this.platform === 'darwin') {
            command = `launchctl kickstart -k system/${serviceName}`;
        } else if (this.platform === 'win32') {
            command = `net stop "${serviceName}" && net start "${serviceName}"`;
        } else {
            command = `sudo systemctl restart ${serviceName}`;
        }

        try {
            await execPromise(command);
            return {
                success: true,
                message: `Service ${serviceName} has been restarted`,
                action: 'service-restarted',
                details: { serviceName }
            };
        } catch (error) {
            throw new Error(`Failed to restart service: ${error.message}`);
        }
    }

    /**
     * Open startup items manager (can't directly remove items safely)
     */
    async optimizeStartup() {
        let command;

        if (this.platform === 'darwin') {
            // Open System Preferences > Login Items
            command = 'open "x-apple.systempreferences:com.apple.LoginItems-Settings.extension"';
        } else if (this.platform === 'win32') {
            // Open Task Manager Startup tab
            command = 'taskmgr /7';
        } else {
            return {
                success: false,
                message: 'Startup optimization is not available on this system',
                action: 'startup-not-available'
            };
        }

        try {
            await execPromise(command);
            return {
                success: true,
                message: "I've opened the startup items manager. You can disable programs you don't need at startup from here.",
                action: 'startup-manager-opened',
                userAction: true
            };
        } catch (error) {
            throw new Error(`Failed to open startup manager: ${error.message}`);
        }
    }

    /**
     * Disk cleanup
     */
    async diskCleanup() {
        if (this.platform === 'darwin') {
            // Open Finder's "Storage Management"
            try {
                await execPromise('open -a "System Preferences" && sleep 1 && open "x-apple.systempreferences:com.apple.settings.Storage"');
                return {
                    success: true,
                    message: "I've opened the Storage Management settings. You can see what's taking up space and clean up from here.",
                    action: 'storage-manager-opened',
                    userAction: true
                };
            } catch (error) {
                throw new Error(`Failed to open storage manager: ${error.message}`);
            }
        } else if (this.platform === 'win32') {
            try {
                await execPromise('cleanmgr');
                return {
                    success: true,
                    message: "I've opened Windows Disk Cleanup. Select the files you want to remove and click OK.",
                    action: 'disk-cleanup-opened',
                    userAction: true
                };
            } catch (error) {
                throw new Error(`Failed to open disk cleanup: ${error.message}`);
            }
        }

        return {
            success: false,
            message: 'Disk cleanup is not available on this system'
        };
    }

    /**
     * Fix common network issues
     */
    async fixNetwork(action = 'reset') {
        let commands = [];

        if (this.platform === 'darwin') {
            commands = [
                { name: 'Flush DNS', cmd: 'sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder' },
                { name: 'Renew DHCP', cmd: 'sudo ipconfig set en0 DHCP' }
            ];
        } else if (this.platform === 'win32') {
            commands = [
                { name: 'Flush DNS', cmd: 'ipconfig /flushdns' },
                { name: 'Release IP', cmd: 'ipconfig /release' },
                { name: 'Renew IP', cmd: 'ipconfig /renew' },
                { name: 'Reset Winsock', cmd: 'netsh winsock reset' }
            ];
        }

        const results = [];
        for (const cmd of commands) {
            try {
                await execPromise(cmd.cmd);
                results.push({ name: cmd.name, success: true });
            } catch (e) {
                results.push({ name: cmd.name, success: false, error: e.message });
            }
        }

        return {
            success: results.some(r => r.success),
            message: `Network reset complete. You may need to reconnect to WiFi.`,
            action: 'network-reset',
            details: results,
            userAction: true
        };
    }

    /**
     * Empty trash
     */
    async emptyTrash() {
        let command;

        if (this.platform === 'darwin') {
            command = 'rm -rf ~/.Trash/*';
        } else if (this.platform === 'win32') {
            command = 'rd /s /q %systemdrive%\\$Recycle.Bin';
        } else {
            command = 'rm -rf ~/.local/share/Trash/*';
        }

        try {
            await execPromise(command);
            return {
                success: true,
                message: 'Trash has been emptied! This should free up some disk space.',
                action: 'trash-emptied'
            };
        } catch (error) {
            throw new Error(`Failed to empty trash: ${error.message}`);
        }
    }

    /**
     * Suggest a system restart
     */
    async suggestRestart() {
        if (this.platform === 'darwin') {
            return {
                success: true,
                message: "To restart your Mac, click the 🍎 Apple menu in the top-left corner and select 'Restart...'. This will refresh all your system processes.",
                userAction: true
            };
        } else if (this.platform === 'win32') {
            return {
                success: true,
                message: "To restart your PC, click the Start button, select the Power icon, and then choose 'Restart'.",
                userAction: true
            };
        }
        return { success: true, message: "Please restart your computer to apply changes." };
    }

    /**
     * Suggest closing resource-heavy apps
     */
    async suggestCloseApp() {
        if (this.platform === 'darwin') {
            try {
                // Open Force Quit Applications window
                await execPromise('osascript -e "tell application \\"System Events\\" to key code 53 using {command down, option down}"');
                return {
                    success: true,
                    message: "I've opened the 'Force Quit Applications' window. You can select apps that aren't responding or using too much memory and click 'Force Quit'.",
                    userAction: true
                };
            } catch (e) {
                // Fallback: search-style query
                return {
                    success: true,
                    message: "You can find heavy apps by opening 'Activity Monitor' from your Applications/Utilities folder."
                };
            }
        }
        return {
            success: true,
            message: "I recommend checking your Task Manager (Ctrl+Shift+Esc) to find and close programs that are using too much memory."
        };
    }

    /**
     * Log action to audit log
     */
    log(action, details) {
        this.auditLog.push({
            timestamp: new Date().toISOString(),
            action,
            details,
            platform: this.platform
        });
    }

    /**
     * Get audit log
     */
    getAuditLog() {
        return this.auditLog;
    }
}

module.exports = { SolutionEngine };
