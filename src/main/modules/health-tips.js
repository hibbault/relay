// Health Tips Module
// Proactive tips and recommendations for computer maintenance

class HealthTips {
    constructor() {
        this.tips = this.loadTips();
        this.shownTips = new Set();
    }

    loadTips() {
        return {
            performance: [
                {
                    id: 'restart_weekly',
                    title: 'Regular Restarts',
                    message: "Restarting your computer weekly helps clear temporary files and refresh system resources. It can prevent slowdowns!",
                    action: null,
                    priority: 'low'
                },
                {
                    id: 'close_tabs',
                    title: 'Browser Tabs',
                    message: "Each browser tab uses memory. If you notice slowdowns, try closing tabs you're not using. Bookmarks are great for saving pages for later!",
                    action: null,
                    priority: 'medium'
                },
                {
                    id: 'startup_apps',
                    title: 'Startup Applications',
                    message: "Too many apps starting when your computer boots can slow things down. Would you like me to check your startup apps?",
                    action: { type: 'analyze-startup' },
                    priority: 'medium'
                }
            ],
            storage: [
                {
                    id: 'downloads_cleanup',
                    title: 'Downloads Folder',
                    message: "Your Downloads folder can accumulate a lot of files over time. Consider moving important files and deleting the rest to free up space.",
                    action: { type: 'open-downloads' },
                    priority: 'low'
                },
                {
                    id: 'empty_trash',
                    title: 'Empty the Trash',
                    message: "Files in the Trash still take up space until you empty it. Would you like me to empty your trash?",
                    action: { type: 'empty-trash' },
                    priority: 'low'
                },
                {
                    id: 'storage_low',
                    title: 'Low Storage Warning',
                    message: "Running low on storage can slow down your computer and prevent updates. Let's find some space to free up.",
                    action: { type: 'disk-cleanup' },
                    priority: 'high'
                }
            ],
            security: [
                {
                    id: 'update_software',
                    title: 'Software Updates',
                    message: "Keeping your software updated is one of the best ways to stay secure. Updates often fix security issues.",
                    action: { type: 'check-updates' },
                    priority: 'high'
                },
                {
                    id: 'password_manager',
                    title: 'Password Security',
                    message: "Using a password manager helps you create and remember strong, unique passwords for each site. Much safer than reusing passwords!",
                    action: null,
                    priority: 'low'
                },
                {
                    id: 'backup_reminder',
                    title: 'Backup Your Data',
                    message: "Regular backups protect against data loss. Consider setting up automatic backups to an external drive or cloud service.",
                    action: null,
                    priority: 'medium'
                }
            ],
            network: [
                {
                    id: 'wifi_security',
                    title: 'WiFi Security',
                    message: "Make sure your home WiFi uses WPA3 or WPA2 security. Avoid WEP as it can be easily hacked.",
                    action: null,
                    priority: 'medium'
                },
                {
                    id: 'dns_optimization',
                    title: 'DNS Settings',
                    message: "Using a faster DNS like Cloudflare (1.1.1.1) or Google (8.8.8.8) can sometimes speed up web browsing.",
                    action: null,
                    priority: 'low'
                }
            ],
            maintenance: [
                {
                    id: 'browser_cache',
                    title: 'Clear Browser Cache',
                    message: "Clearing your browser cache occasionally can help fix loading issues and free up some space.",
                    action: null,
                    priority: 'low'
                },
                {
                    id: 'check_extensions',
                    title: 'Browser Extensions',
                    message: "Too many browser extensions can slow things down and some may not be trustworthy. Review your extensions periodically.",
                    action: null,
                    priority: 'medium'
                }
            ]
        };
    }

    /**
     * Get a relevant tip based on current system state
     */
    getTipForContext(diagnostics) {
        const tips = [];

        // Performance issues
        if (diagnostics?.stats?.cpu?.usage > 70) {
            tips.push(this.tips.performance.find(t => t.id === 'close_tabs'));
        }

        if (diagnostics?.stats?.memory?.usedPercent > 80) {
            tips.push(this.tips.performance.find(t => t.id === 'startup_apps'));
        }

        // Storage issues
        const lowDisk = diagnostics?.stats?.disk?.some(d => d.usedPercent > 85);
        if (lowDisk) {
            tips.push(this.tips.storage.find(t => t.id === 'storage_low'));
            tips.push(this.tips.storage.find(t => t.id === 'empty_trash'));
        }

        // Filter out already shown tips and nulls
        const availableTips = tips.filter(t => t && !this.shownTips.has(t.id));

        if (availableTips.length > 0) {
            const tip = availableTips[0];
            this.shownTips.add(tip.id);
            return tip;
        }

        return null;
    }

    /**
     * Get a random maintenance tip
     */
    getRandomTip() {
        const allTips = [
            ...this.tips.performance,
            ...this.tips.storage,
            ...this.tips.security,
            ...this.tips.network,
            ...this.tips.maintenance
        ];

        const unshown = allTips.filter(t => !this.shownTips.has(t.id));

        if (unshown.length === 0) {
            // Reset if all shown
            this.shownTips.clear();
            return allTips[Math.floor(Math.random() * allTips.length)];
        }

        const tip = unshown[Math.floor(Math.random() * unshown.length)];
        this.shownTips.add(tip.id);
        return tip;
    }

    /**
     * Get tips by category
     */
    getTipsByCategory(category) {
        return this.tips[category] || [];
    }

    /**
     * Format tip for display
     */
    formatTip(tip) {
        return `💡 **${tip.title}**\n\n${tip.message}`;
    }

    /**
     * Get onboarding tips for new users
     */
    getOnboardingTips() {
        return [
            {
                id: 'welcome',
                title: 'Welcome to Relay!',
                message: "I'm here to help with any computer problems. Just describe what's wrong in plain English - no tech speak needed!"
            },
            {
                id: 'quick_scan',
                title: 'Quick Scan',
                message: "Click the 🔍 button anytime to run a quick health check on your computer."
            },
            {
                id: 'safe_actions',
                title: 'Safe & Transparent',
                message: "I'll always explain what I'm going to do and ask for your permission before making any changes."
            },
            {
                id: 'always_here',
                title: 'Always Available',
                message: "I run in the background! Click my icon in the menu bar/system tray anytime you need help."
            }
        ];
    }

    resetShownTips() {
        this.shownTips.clear();
    }
}

module.exports = { HealthTips };
