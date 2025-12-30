// Diagnostics Engine Module
// Real-time system diagnostics and health monitoring
const si = require('systeminformation');

class DiagnosticsEngine {
    constructor() {
        this.baselineStats = null;
    }

    /**
     * Set baseline stats for comparison
     */
    setBaseline(stats) {
        this.baselineStats = stats;
    }

    /**
     * Get current system stats (lightweight, for real-time monitoring)
     */
    async getCurrentStats() {
        try {
            const [load, mem, fsSize, networkStats, currentLoad] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize(),
                si.networkStats(),
                si.processes()
            ]);

            return {
                timestamp: new Date().toISOString(),
                cpu: {
                    usage: Math.round(load.currentLoad),
                    usagePerCore: load.cpus.map(c => Math.round(c.load))
                },
                memory: {
                    total: mem.total,
                    used: mem.used,
                    usedPercent: Math.round((mem.used / mem.total) * 100),
                    free: mem.free,
                    available: mem.available
                },
                disk: fsSize.map(fs => ({
                    mount: fs.mount,
                    usedPercent: Math.round(fs.use),
                    available: fs.available
                })),
                network: {
                    rx: networkStats.reduce((sum, n) => sum + (n.rx_sec || 0), 0),
                    tx: networkStats.reduce((sum, n) => sum + (n.tx_sec || 0), 0)
                },
                processes: {
                    total: currentLoad.all,
                    running: currentLoad.running,
                    blocked: currentLoad.blocked
                }
            };
        } catch (error) {
            console.error('Failed to get current stats:', error);
            throw error;
        }
    }

    /**
     * Run diagnostics by type
     */
    async run(type) {
        switch (type) {
            case 'performance':
                return this.runPerformanceDiagnostics();
            case 'storage':
                return this.runStorageDiagnostics();
            case 'network':
                return this.runNetworkDiagnostics();
            case 'security':
                return this.runSecurityDiagnostics();
            case 'full':
                return this.runFullDiagnostics();
            default:
                return this.runQuickDiagnostics();
        }
    }

    /**
     * Quick diagnostics - fast overview
     */
    async runQuickDiagnostics() {
        const stats = await this.getCurrentStats();
        const issues = [];

        // Check CPU
        if (stats.cpu.usage > 80) {
            issues.push({
                type: 'warning',
                category: 'cpu',
                message: `High CPU usage: ${stats.cpu.usage}%`,
                suggestion: 'Some applications may be using too much processing power'
            });
        }

        // Check Memory
        if (stats.memory.usedPercent > 85) {
            issues.push({
                type: 'warning',
                category: 'memory',
                message: `High memory usage: ${stats.memory.usedPercent}%`,
                suggestion: 'Too many applications open or a memory-hungry app'
            });
        }

        // Check Disk
        for (const disk of stats.disk) {
            if (disk.usedPercent > 90) {
                issues.push({
                    type: 'critical',
                    category: 'storage',
                    message: `Low disk space on ${disk.mount}: ${100 - disk.usedPercent}% free`,
                    suggestion: 'Consider cleaning up files or uninstalling unused apps'
                });
            }
        }

        return {
            type: 'quick',
            stats,
            issues,
            healthy: issues.length === 0,
            summary: issues.length === 0
                ? 'Your system looks healthy!'
                : `Found ${issues.length} issue(s) to address`
        };
    }

    /**
     * Performance diagnostics - detailed performance analysis
     */
    async runPerformanceDiagnostics() {
        try {
            const [
                stats,
                processes,
                services,
                cpuTemp
            ] = await Promise.all([
                this.getCurrentStats(),
                si.processes(),
                si.services('*'),
                si.cpuTemperature().catch(() => null)
            ]);

            // Sort processes by CPU usage
            const topCpuProcesses = processes.list
                .sort((a, b) => b.cpu - a.cpu)
                .slice(0, 10)
                .map(p => ({
                    name: p.name,
                    pid: p.pid,
                    cpu: Math.round(p.cpu * 100) / 100,
                    memory: Math.round(p.mem * 100) / 100
                }));

            // Sort processes by memory usage
            const topMemProcesses = processes.list
                .sort((a, b) => b.mem - a.mem)
                .slice(0, 10)
                .map(p => ({
                    name: p.name,
                    pid: p.pid,
                    cpu: Math.round(p.cpu * 100) / 100,
                    memory: Math.round(p.mem * 100) / 100
                }));

            const issues = [];

            // Analyze CPU hogs
            topCpuProcesses.forEach(p => {
                if (p.cpu > 50) {
                    issues.push({
                        type: 'warning',
                        category: 'cpu',
                        message: `${p.name} is using ${p.cpu}% CPU`,
                        process: p,
                        suggestion: `Consider closing ${p.name} to free up CPU`
                    });
                }
            });

            // Analyze memory hogs
            topMemProcesses.forEach(p => {
                if (p.memory > 15) {
                    issues.push({
                        type: 'info',
                        category: 'memory',
                        message: `${p.name} is using ${p.memory}% of memory`,
                        process: p,
                        suggestion: `${p.name} is memory-intensive`
                    });
                }
            });

            // Check temperature if available
            if (cpuTemp && cpuTemp.main && cpuTemp.main > 80) {
                issues.push({
                    type: 'critical',
                    category: 'temperature',
                    message: `CPU temperature is high: ${cpuTemp.main}°C`,
                    suggestion: 'Check cooling system and ventilation'
                });
            }

            return {
                type: 'performance',
                stats,
                topCpuProcesses,
                topMemProcesses,
                temperature: cpuTemp,
                issues,
                healthy: issues.filter(i => i.type === 'critical').length === 0
            };
        } catch (error) {
            console.error('Performance diagnostics failed:', error);
            throw error;
        }
    }

    /**
     * Storage diagnostics - disk space and file analysis
     */
    async runStorageDiagnostics() {
        try {
            const [diskLayout, fsSize, blockDevices] = await Promise.all([
                si.diskLayout(),
                si.fsSize(),
                si.blockDevices()
            ]);

            const partitions = fsSize.map(fs => ({
                mount: fs.mount,
                type: fs.type,
                size: fs.size,
                used: fs.used,
                usedPercent: Math.round(fs.use),
                available: fs.available,
                availableFormatted: this.formatBytes(fs.available)
            }));

            const issues = [];

            partitions.forEach(p => {
                if (p.usedPercent > 95) {
                    issues.push({
                        type: 'critical',
                        category: 'storage',
                        message: `${p.mount} is almost full (${p.usedPercent}% used)`,
                        partition: p,
                        suggestion: `Only ${p.availableFormatted} remaining. Immediate cleanup needed!`
                    });
                } else if (p.usedPercent > 85) {
                    issues.push({
                        type: 'warning',
                        category: 'storage',
                        message: `${p.mount} is getting full (${p.usedPercent}% used)`,
                        partition: p,
                        suggestion: `${p.availableFormatted} remaining. Consider cleanup.`
                    });
                }
            });

            return {
                type: 'storage',
                disks: diskLayout,
                partitions,
                issues,
                healthy: issues.filter(i => i.type === 'critical').length === 0
            };
        } catch (error) {
            console.error('Storage diagnostics failed:', error);
            throw error;
        }
    }

    /**
     * Network diagnostics
     */
    async runNetworkDiagnostics() {
        try {
            const [interfaces, stats, connections, defaultGateway] = await Promise.all([
                si.networkInterfaces(),
                si.networkStats(),
                si.networkConnections(),
                si.networkGatewayDefault()
            ]);

            const activeInterfaces = interfaces.filter(i => !i.internal && i.ip4);
            const issues = [];

            // Check if no network
            if (activeInterfaces.length === 0) {
                issues.push({
                    type: 'critical',
                    category: 'network',
                    message: 'No active network connection detected',
                    suggestion: 'Check your WiFi or Ethernet connection'
                });
            }

            // Check gateway
            if (!defaultGateway) {
                issues.push({
                    type: 'critical',
                    category: 'network',
                    message: 'No default gateway configured',
                    suggestion: 'Network may not be properly configured'
                });
            }

            return {
                type: 'network',
                interfaces: activeInterfaces.map(i => ({
                    name: i.iface,
                    type: i.type,
                    ip: i.ip4,
                    mac: i.mac,
                    speed: i.speed,
                    connected: i.operstate === 'up'
                })),
                stats: stats.map(s => ({
                    interface: s.iface,
                    rxSec: s.rx_sec,
                    txSec: s.tx_sec
                })),
                connections: connections.length,
                gateway: defaultGateway,
                issues,
                healthy: issues.filter(i => i.type === 'critical').length === 0
            };
        } catch (error) {
            console.error('Network diagnostics failed:', error);
            throw error;
        }
    }

    /**
     * Security diagnostics (basic)
     */
    async runSecurityDiagnostics() {
        try {
            const [users, processes, services] = await Promise.all([
                si.users(),
                si.processes(),
                si.services('*')
            ]);

            const issues = [];

            // Check for suspicious processes (basic heuristics)
            const suspiciousPatterns = ['miner', 'cryptominer', 'xmrig'];
            processes.list.forEach(p => {
                const nameLower = p.name.toLowerCase();
                if (suspiciousPatterns.some(pattern => nameLower.includes(pattern))) {
                    issues.push({
                        type: 'critical',
                        category: 'security',
                        message: `Potentially suspicious process: ${p.name}`,
                        process: { name: p.name, pid: p.pid },
                        suggestion: 'This process name matches known malware patterns'
                    });
                }
            });

            // Check for high CPU processes that might be miners
            processes.list
                .filter(p => p.cpu > 80 && p.name !== 'electron')
                .forEach(p => {
                    issues.push({
                        type: 'info',
                        category: 'security',
                        message: `High CPU process: ${p.name} (${Math.round(p.cpu)}%)`,
                        process: { name: p.name, pid: p.pid },
                        suggestion: 'Verify this is a legitimate application'
                    });
                });

            return {
                type: 'security',
                activeUsers: users.length,
                processCount: processes.all,
                serviceCount: services.length,
                issues,
                healthy: issues.filter(i => i.type === 'critical').length === 0
            };
        } catch (error) {
            console.error('Security diagnostics failed:', error);
            throw error;
        }
    }

    /**
     * Full diagnostics - everything
     */
    async runFullDiagnostics() {
        const [performance, storage, network, security] = await Promise.all([
            this.runPerformanceDiagnostics(),
            this.runStorageDiagnostics(),
            this.runNetworkDiagnostics(),
            this.runSecurityDiagnostics()
        ]);

        const allIssues = [
            ...performance.issues,
            ...storage.issues,
            ...network.issues,
            ...security.issues
        ];

        return {
            type: 'full',
            performance,
            storage,
            network,
            security,
            allIssues,
            issueCount: allIssues.length,
            criticalCount: allIssues.filter(i => i.type === 'critical').length,
            healthy: allIssues.filter(i => i.type === 'critical').length === 0
        };
    }

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }
}

module.exports = { DiagnosticsEngine };
