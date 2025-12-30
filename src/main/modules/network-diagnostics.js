const https = require('https');
const dns = require('dns');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const { logger } = require('./logger');

class NetworkDiagnostics {
    constructor() {
        this.testHost = 'www.google.com';
        this.downloadTestUrl = 'https://speed.cloudflare.com/__down?bytes=10000000'; // 10MB test file
    }

    /**
     * Run full network diagnostics
     */
    async runFullTest() {
        logger.info('NET', 'Starting network diagnostics');

        return {
            timestamp: new Date().toISOString(),
            connection: await this.checkConnection(),
            latency: await this.measureLatency(),
            speed: await this.measureDownloadSpeed()
        };
    }

    /**
     * Check basic internet connectivity
     */
    async checkConnection() {
        return new Promise((resolve) => {
            dns.lookup(this.testHost, (err) => {
                if (err) {
                    logger.warn('NET', 'DNS lookup failed', { error: err.code });
                    resolve({ connected: false, error: 'No internet connection (DNS lookup failed)' });
                } else {
                    resolve({ connected: true, message: 'Internet is reachable' });
                }
            });
        });
    }

    /**
     * Measure latency (ping)
     */
    async measureLatency() {
        // Platform specific ping command
        const platform = process.platform;
        let command;

        if (platform === 'win32') {
            command = `ping -n 4 ${this.testHost}`;
        } else {
            command = `ping -c 4 ${this.testHost}`;
        }

        try {
            const start = Date.now();
            const { stdout } = await execAsync(command);
            const duration = Date.now() - start;

            // Basic parsing logic (improved parsing could be added)
            let avgLatency = 'N/A';

            if (platform === 'win32') {
                const match = stdout.match(/Average = (\d+)ms/);
                if (match) avgLatency = parseInt(match[1]);
            } else {
                const match = stdout.match(/avg\/max\/mdev = [\d.]+\/([\d.]+)\//);
                if (match) avgLatency = parseFloat(match[1]);
            }

            // Fallback if parsing fails but command worked
            if (avgLatency === 'N/A') {
                avgLatency = Math.round(duration / 4); // Rough estimate
            }

            return {
                success: true,
                avgMs: avgLatency,
                host: this.testHost
            };
        } catch (error) {
            logger.error('NET', 'Ping failed', { error: error.message });
            return { success: false, error: 'Ping failed' };
        }
    }

    /**
     * Measure download speed
     */
    async measureDownloadSpeed() {
        logger.info('NET', 'Starting download speed test...');

        return new Promise((resolve) => {
            const start = Date.now();
            let loaded = 0;

            const req = https.get(this.downloadTestUrl, (res) => {
                // If status is not 200, fail
                if (res.statusCode !== 200) {
                    resolve({ success: false, error: `Server returned ${res.statusCode}` });
                    return;
                }

                res.on('data', (chunk) => {
                    loaded += chunk.length;

                    // Stop if we exceeded 5 seconds to avoid wasting data/time
                    if (Date.now() - start > 5000) {
                        res.destroy();
                    }
                });

                res.on('end', () => {
                    const duration = (Date.now() - start) / 1000; // seconds
                    const speedBps = (loaded * 8) / duration;
                    const speedMbps = (speedBps / 1000000).toFixed(2);

                    logger.info('NET', 'Speed test finished', { mbps: speedMbps, duration });

                    resolve({
                        success: true,
                        mbps: speedMbps,
                        loadedMB: (loaded / 1024 / 1024).toFixed(2)
                    });
                });
            });

            req.on('error', (err) => {
                logger.error('NET', 'Speed test failed', { error: err.message });
                resolve({ success: false, error: err.message });
            });

            // Timeout safety
            req.setTimeout(8000, () => {
                req.destroy();
                resolve({ success: false, error: 'Test timed out' });
            });
        });
    }
}

module.exports = { NetworkDiagnostics };
