// Startup Analyzer Module
// Analyzes and manages startup applications
const si = require('systeminformation');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class StartupAnalyzer {
    constructor() {
        this.platform = process.platform;
    }

    /**
     * Get list of startup applications
     */
    async getStartupApps() {
        if (this.platform === 'darwin') {
            return this.getMacStartupApps();
        } else if (this.platform === 'win32') {
            return this.getWindowsStartupApps();
        }
        return { items: [], error: 'Platform not supported' };
    }

    /**
     * macOS startup items
     */
    async getMacStartupApps() {
        const items = [];

        try {
            // Login Items via AppleScript
            const { stdout: loginItems } = await execPromise(`
                osascript -e 'tell application "System Events" to get the name of every login item'
            `).catch(() => ({ stdout: '' }));

            if (loginItems.trim()) {
                const names = loginItems.trim().split(', ');
                names.forEach(name => {
                    items.push({
                        name: name.trim(),
                        type: 'login_item',
                        location: 'Login Items',
                        enabled: true,
                        canDisable: true
                    });
                });
            }

            // Launch Agents (user)
            const userLaunchAgents = path.join(os.homedir(), 'Library/LaunchAgents');
            try {
                const agentFiles = await fs.readdir(userLaunchAgents);
                for (const file of agentFiles) {
                    if (file.endsWith('.plist')) {
                        items.push({
                            name: file.replace('.plist', ''),
                            type: 'launch_agent',
                            location: 'User Launch Agents',
                            path: path.join(userLaunchAgents, file),
                            enabled: true,
                            canDisable: true
                        });
                    }
                }
            } catch (e) {
                // Directory might not exist
            }

            // System Launch Agents
            const systemLaunchAgents = '/Library/LaunchAgents';
            try {
                const sysAgentFiles = await fs.readdir(systemLaunchAgents);
                for (const file of sysAgentFiles) {
                    if (file.endsWith('.plist') && !file.startsWith('com.apple')) {
                        items.push({
                            name: file.replace('.plist', ''),
                            type: 'system_launch_agent',
                            location: 'System Launch Agents',
                            path: path.join(systemLaunchAgents, file),
                            enabled: true,
                            canDisable: false // Requires admin
                        });
                    }
                }
            } catch (e) {
                // Might not have access
            }

        } catch (error) {
            console.error('Error getting Mac startup apps:', error);
        }

        return { items, platform: 'darwin' };
    }

    /**
     * Windows startup items
     */
    async getWindowsStartupApps() {
        const items = [];

        try {
            // Query registry for startup apps
            const { stdout: regOutput } = await execPromise(
                'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" 2>nul'
            ).catch(() => ({ stdout: '' }));

            if (regOutput) {
                const lines = regOutput.split('\n').filter(l => l.includes('REG_'));
                lines.forEach(line => {
                    const match = line.match(/^\s+(\S+)\s+REG_\w+\s+(.+)$/);
                    if (match) {
                        items.push({
                            name: match[1],
                            type: 'registry_run',
                            location: 'Registry (Current User)',
                            path: match[2].trim(),
                            enabled: true,
                            canDisable: true
                        });
                    }
                });
            }

            // Startup folder
            const startupFolder = path.join(os.homedir(),
                'AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup');
            try {
                const files = await fs.readdir(startupFolder);
                for (const file of files) {
                    if (file !== 'desktop.ini') {
                        items.push({
                            name: file.replace(/\.(lnk|exe)$/, ''),
                            type: 'startup_folder',
                            location: 'Startup Folder',
                            path: path.join(startupFolder, file),
                            enabled: true,
                            canDisable: true
                        });
                    }
                }
            } catch (e) {
                // Folder might not exist
            }

            // Task Scheduler startup tasks
            try {
                const { stdout: taskOutput } = await execPromise(
                    'schtasks /query /fo CSV /v 2>nul | findstr /i "logon"'
                ).catch(() => ({ stdout: '' }));

                if (taskOutput) {
                    const lines = taskOutput.split('\n').filter(l => l.trim());
                    lines.forEach(line => {
                        const parts = line.split(',').map(p => p.replace(/"/g, ''));
                        if (parts.length > 1 && !parts[0].includes('\\Microsoft\\')) {
                            items.push({
                                name: parts[0].split('\\').pop(),
                                type: 'scheduled_task',
                                location: 'Task Scheduler',
                                enabled: true,
                                canDisable: false
                            });
                        }
                    });
                }
            } catch (e) {
                // Task scheduler query failed
            }

        } catch (error) {
            console.error('Error getting Windows startup apps:', error);
        }

        return { items, platform: 'win32' };
    }

    /**
     * Analyze startup impact
     */
    async analyzeStartupImpact() {
        const { items } = await this.getStartupApps();

        // Categorize by potential impact
        const highImpact = [];
        const mediumImpact = [];
        const lowImpact = [];
        const unknown = [];

        // Known high-impact patterns
        const highImpactPatterns = [
            /spotify/i,
            /discord/i,
            /steam/i,
            /origin/i,
            /epic.*games/i,
            /adobe/i,
            /creative.*cloud/i,
            /onedrive/i,
            /dropbox/i,
            /google.*drive/i,
            /teams/i,
            /slack/i,
            /zoom/i
        ];

        // Known low-impact (usually essential)
        const lowImpactPatterns = [
            /audio|sound/i,
            /bluetooth/i,
            /keyboard|mouse/i,
            /touchpad/i,
            /security|defender|antivirus/i
        ];

        items.forEach(item => {
            const name = item.name.toLowerCase();

            if (highImpactPatterns.some(p => p.test(name))) {
                highImpact.push({ ...item, impact: 'high', reason: 'Resource-intensive application' });
            } else if (lowImpactPatterns.some(p => p.test(name))) {
                lowImpact.push({ ...item, impact: 'low', reason: 'System utility or driver' });
            } else if (item.type === 'login_item' || item.type === 'registry_run') {
                mediumImpact.push({ ...item, impact: 'medium', reason: 'Third-party application' });
            } else {
                unknown.push({ ...item, impact: 'unknown', reason: 'Could not determine impact' });
            }
        });

        return {
            total: items.length,
            highImpact,
            mediumImpact,
            lowImpact,
            unknown,
            recommendation: this.generateRecommendation(highImpact, mediumImpact)
        };
    }

    generateRecommendation(highImpact, mediumImpact) {
        const messages = [];

        if (highImpact.length > 3) {
            messages.push(`You have ${highImpact.length} resource-intensive apps starting automatically. Consider disabling some to speed up boot time.`);
        }

        if (highImpact.length + mediumImpact.length > 10) {
            messages.push('You have many startup apps. This may slow down your computer when it starts.');
        }

        const suggestions = highImpact
            .slice(0, 3)
            .map(app => `• ${app.name}: ${app.reason}`);

        if (suggestions.length > 0) {
            messages.push('Consider disabling:\n' + suggestions.join('\n'));
        }

        return messages.length > 0
            ? messages.join('\n\n')
            : 'Your startup configuration looks reasonable!';
    }

    /**
     * Disable a startup item (macOS only for now)
     */
    async disableStartupItem(item) {
        if (this.platform === 'darwin' && item.type === 'login_item') {
            try {
                await execPromise(`
                    osascript -e 'tell application "System Events" to delete login item "${item.name}"'
                `);
                return { success: true, message: `Disabled ${item.name} from startup` };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        return {
            success: false,
            error: 'Cannot disable this item automatically. You may need to do it manually.'
        };
    }

    /**
     * Open startup settings for user
     */
    async openStartupSettings() {
        try {
            if (this.platform === 'darwin') {
                await execPromise('open "x-apple.systempreferences:com.apple.LoginItems-Settings.extension"');
            } else if (this.platform === 'win32') {
                await execPromise('taskmgr /7'); // Opens Task Manager to Startup tab
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = { StartupAnalyzer };
