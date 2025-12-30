// Module exports for main process
module.exports = {
    SystemProfiler: require('./profiler').SystemProfiler,
    DiagnosticsEngine: require('./diagnostics').DiagnosticsEngine,
    AIEngine: require('./ai-engine').AIEngine,
    SolutionEngine: require('./solutions').SolutionEngine,
    RelayDatabase: require('./database').RelayDatabase,
    StartupAnalyzer: require('./startup-analyzer').StartupAnalyzer,
    SettingsManager: require('./settings').SettingsManager,
    HealthTips: require('./health-tips').HealthTips,
    CommandExecutor: require('./command-executor').CommandExecutor
};
