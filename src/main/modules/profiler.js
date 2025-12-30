// System Profiler Module
// Collects comprehensive system information to create a baseline profile
const si = require('systeminformation');

class SystemProfiler {
    constructor() {
        this.cache = null;
        this.cacheTime = null;
        this.cacheDuration = 3600000; // 1 hour cache
    }

    /**
     * Get full system profile - used on first run and periodic updates
     */
    async getFullProfile() {
        try {
            const [
                system,
                bios,
                baseboard,
                chassis,
                cpu,
                cpuFlags,
                mem,
                memLayout,
                osInfo,
                diskLayout,
                fsSize,
                graphics,
                networkInterfaces,
                audio,
                battery
            ] = await Promise.all([
                si.system(),
                si.bios(),
                si.baseboard(),
                si.chassis(),
                si.cpu(),
                si.cpuFlags(),
                si.mem(),
                si.memLayout(),
                si.osInfo(),
                si.diskLayout(),
                si.fsSize(),
                si.graphics(),
                si.networkInterfaces(),
                si.audio(),
                si.battery()
            ]);

            const profile = {
                timestamp: new Date().toISOString(),
                system: {
                    manufacturer: system.manufacturer,
                    model: system.model,
                    version: system.version,
                    serial: system.serial,
                    uuid: system.uuid
                },
                bios: {
                    vendor: bios.vendor,
                    version: bios.version,
                    releaseDate: bios.releaseDate
                },
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    speed: cpu.speed,
                    speedMax: cpu.speedMax,
                    cores: cpu.cores,
                    physicalCores: cpu.physicalCores,
                    processors: cpu.processors
                },
                memory: {
                    total: mem.total,
                    totalFormatted: this.formatBytes(mem.total),
                    slots: memLayout.length,
                    modules: memLayout.map(m => ({
                        size: m.size,
                        sizeFormatted: this.formatBytes(m.size),
                        type: m.type,
                        clockSpeed: m.clockSpeed
                    }))
                },
                os: {
                    platform: osInfo.platform,
                    distro: osInfo.distro,
                    release: osInfo.release,
                    codename: osInfo.codename,
                    arch: osInfo.arch,
                    hostname: osInfo.hostname,
                    build: osInfo.build
                },
                storage: {
                    disks: diskLayout.map(d => ({
                        name: d.name,
                        type: d.type,
                        size: d.size,
                        sizeFormatted: this.formatBytes(d.size),
                        vendor: d.vendor
                    })),
                    partitions: fsSize.map(p => ({
                        mount: p.mount,
                        type: p.type,
                        size: p.size,
                        sizeFormatted: this.formatBytes(p.size),
                        used: p.used,
                        usedFormatted: this.formatBytes(p.used),
                        usedPercent: p.use
                    }))
                },
                graphics: {
                    controllers: graphics.controllers.map(g => ({
                        vendor: g.vendor,
                        model: g.model,
                        vram: g.vram,
                        vramFormatted: g.vram ? `${g.vram} MB` : 'Unknown'
                    })),
                    displays: graphics.displays.map(d => ({
                        vendor: d.vendor,
                        model: d.model,
                        resolution: `${d.resolutionX}x${d.resolutionY}`,
                        size: d.size
                    }))
                },
                network: {
                    interfaces: networkInterfaces
                        .filter(n => !n.internal)
                        .map(n => ({
                            name: n.iface,
                            type: n.type,
                            ip4: n.ip4,
                            mac: n.mac,
                            speed: n.speed
                        }))
                },
                audio: {
                    devices: audio.map(a => ({
                        name: a.name,
                        manufacturer: a.manufacturer,
                        default: a.default
                    }))
                },
                battery: battery.hasBattery ? {
                    hasBattery: true,
                    cycleCount: battery.cycleCount,
                    maxCapacity: battery.maxCapacity,
                    designedCapacity: battery.designedCapacity,
                    health: battery.maxCapacity && battery.designedCapacity
                        ? Math.round((battery.maxCapacity / battery.designedCapacity) * 100)
                        : null
                } : {
                    hasBattery: false
                }
            };

            this.cache = profile;
            this.cacheTime = Date.now();

            return profile;
        } catch (error) {
            console.error('Failed to create system profile:', error);
            throw error;
        }
    }

    /**
     * Get quick profile (cached if available)
     */
    async getQuickProfile() {
        if (this.cache && this.cacheTime && (Date.now() - this.cacheTime < this.cacheDuration)) {
            return this.cache;
        }
        return this.getFullProfile();
    }

    /**
     * Get hardware summary for display
     */
    async getHardwareSummary() {
        const profile = await this.getQuickProfile();
        return {
            computer: `${profile.system.manufacturer} ${profile.system.model}`.trim(),
            cpu: profile.cpu.brand,
            ram: profile.memory.totalFormatted,
            storage: profile.storage.disks.map(d => `${d.name} (${d.sizeFormatted})`).join(', '),
            os: `${profile.os.distro} ${profile.os.release}`,
            graphics: profile.graphics.controllers.map(g => g.model).join(', ')
        };
    }

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }
}

module.exports = { SystemProfiler };
