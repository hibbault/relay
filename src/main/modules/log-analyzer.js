const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { logger } = require('./logger');

class LogAnalyzer {
    constructor() {
        this.platform = os.platform();
    }

    /**
     * Run a deep system scan for errors
     */
    async runDeepScan() {
        logger.info('LOG', 'Starting deep system scan (log analysis)');

        const timestamp = new Date().toISOString();
        const errors = await this.getRecentSystemErrors();
        const crashes = await this.getRecentCrashReports();

        return {
            timestamp,
            errors,
            crashes,
            scanId: Date.now()
        };
    }

    /**
     * Get recent system errors (last 1 hour/24 hours)
     */
    async getRecentSystemErrors() {
        try {
            if (this.platform === 'darwin') {
                // macOS: Use log show (can be slow, limiting to very recent)
                // Filter for error messages in the last 15 minutes to keep it fast
                const { stdout } = await execAsync('log show --predicate "type == error" --last 15m --style syslog | grep -v "Sandbox" | tail -n 20');

                return stdout.split('\n')
                    .filter(line => line.trim().length > 0)
                    .map(line => {
                        // Basic parsing
                        const parts = line.split(']: ');
                        return {
                            message: parts[1] || line,
                            timestamp: line.substring(0, 19),
                            source: 'system.log'
                        };
                    });
            } else if (this.platform === 'win32') {
                // Windows: Get System and Application errors
                const script = `
                    Get-EventLog -LogName System -EntryType Error -Newest 10 | Select-Object TimeGenerated, Source, Message | ConvertTo-Json;
                    Get-EventLog -LogName Application -EntryType Error -Newest 10 | Select-Object TimeGenerated, Source, Message | ConvertTo-Json
                `;

                const { stdout } = await execAsync(`powershell "${script}"`);

                // Parse JSON output (sometimes it's a list, sometimes single object)
                let events = [];
                try {
                    // PowerShell sometimes outputs multiple JSON blocks, need to handle that
                    const jsonStr = `[${stdout.replace(/}\s*{/g, '},{')}]`;
                    const data = JSON.parse(stdout); // Try direct parse first

                    if (Array.isArray(data)) events = data;
                    else events = [data];
                } catch (e) {
                    // Fallback if simple parse fails
                    logger.warn('LOG', 'Failed to parse Windows event log JSON', { error: e.message });
                }

                return events.map(e => ({
                    message: e.Message,
                    timestamp: e.TimeGenerated,
                    source: e.Source
                }));

            } else {
                // Linux: dmesg or journalctl
                const { stdout } = await execAsync('journalctl -p 3 -n 15 --output=short');
                return stdout.split('\n')
                    .filter(l => l.length > 0)
                    .map(line => ({ message: line, source: 'journalctl' }));
            }
        } catch (error) {
            logger.error('LOG', 'Failed to get system errors', { error: error.message });
            return [];
        }
    }

    /**
     * Check for recent crash reports
     */
    async getRecentCrashReports() {
        try {
            if (this.platform === 'darwin') {
                const crashDir = path.join(os.homedir(), 'Library/Logs/DiagnosticReports');
                const files = await fs.readdir(crashDir).catch(() => []);

                // Filter for .crash or .ips files created in last 24h
                const recentCrashes = [];
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

                for (const file of files) {
                    if (file.endsWith('.crash') || file.endsWith('.ips')) {
                        const stat = await fs.stat(path.join(crashDir, file));
                        if (stat.mtimeMs > oneDayAgo) {
                            recentCrashes.push({
                                file: file,
                                app: file.split('_')[0],
                                timestamp: stat.mtime
                            });
                        }
                    }
                }

                return recentCrashes.slice(0, 5); // Return top 5 recent

            } else if (this.platform === 'win32') {
                // Windows Error Reporting (checked via Event Log under 'Application Error' usually)
                // Already covered partly by getRecentSystemErrors, but we can look specifically for AppCrash
                return [];
            }

            return [];
        } catch (error) {
            logger.warn('LOG', 'Failed to check crash reports', { error: error.message });
            return [];
        }
    }
}

module.exports = { LogAnalyzer };
