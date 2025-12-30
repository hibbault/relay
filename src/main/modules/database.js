// Database Module - SQLite for persistent storage
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class RelayDatabase {
    constructor() {
        this.db = null;
        this.dbPath = null;
    }

    /**
     * Initialize the database
     */
    init() {
        // Store db in app data directory
        const userDataPath = app.getPath('userData');
        this.dbPath = path.join(userDataPath, 'relay.db');

        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL'); // Better performance

        // Create tables
        this.createTables();

        console.log('Database initialized at:', this.dbPath);
        return this;
    }

    createTables() {
        // System profile storage
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS system_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                profile_data TEXT NOT NULL
            )
        `);

        // Diagnostic history
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS diagnostics_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                type TEXT NOT NULL,
                results TEXT NOT NULL,
                issues_count INTEGER DEFAULT 0
            )
        `);

        // Solution/Action history (audit log)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS action_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                action_type TEXT NOT NULL,
                description TEXT,
                result TEXT,
                success INTEGER DEFAULT 0,
                rollback_available INTEGER DEFAULT 0
            )
        `);

        // Chat history
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL
            )
        `);

        // Known issues database
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS known_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern TEXT NOT NULL,
                description TEXT,
                solution TEXT,
                category TEXT,
                os_specific TEXT
            )
        `);

        // User preferences
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    // ============ System Profiles ============

    saveProfile(profile) {
        const stmt = this.db.prepare(`
            INSERT INTO system_profiles (profile_data) VALUES (?)
        `);
        const result = stmt.run(JSON.stringify(profile));
        return result.lastInsertRowid;
    }

    getLatestProfile() {
        const stmt = this.db.prepare(`
            SELECT * FROM system_profiles ORDER BY created_at DESC LIMIT 1
        `);
        const row = stmt.get();
        return row ? { ...row, profile_data: JSON.parse(row.profile_data) } : null;
    }

    // ============ Diagnostics History ============

    saveDiagnostics(type, results) {
        const stmt = this.db.prepare(`
            INSERT INTO diagnostics_history (type, results, issues_count) VALUES (?, ?, ?)
        `);
        const issuesCount = results.issues?.length || 0;
        const result = stmt.run(type, JSON.stringify(results), issuesCount);
        return result.lastInsertRowid;
    }

    getDiagnosticsHistory(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM diagnostics_history ORDER BY created_at DESC LIMIT ?
        `);
        return stmt.all(limit).map(row => ({
            ...row,
            results: JSON.parse(row.results)
        }));
    }

    // ============ Action History ============

    logAction(actionType, description, result, success, rollbackAvailable = false) {
        const stmt = this.db.prepare(`
            INSERT INTO action_history (action_type, description, result, success, rollback_available)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(
            actionType,
            description,
            JSON.stringify(result),
            success ? 1 : 0,
            rollbackAvailable ? 1 : 0
        ).lastInsertRowid;
    }

    getActionHistory(limit = 20) {
        const stmt = this.db.prepare(`
            SELECT * FROM action_history ORDER BY created_at DESC LIMIT ?
        `);
        return stmt.all(limit).map(row => ({
            ...row,
            result: JSON.parse(row.result),
            success: row.success === 1,
            rollback_available: row.rollback_available === 1
        }));
    }

    // ============ Chat History ============

    saveMessage(sessionId, role, content) {
        const stmt = this.db.prepare(`
            INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)
        `);
        return stmt.run(sessionId, role, content).lastInsertRowid;
    }

    getChatHistory(sessionId, limit = 50) {
        const stmt = this.db.prepare(`
            SELECT * FROM chat_history WHERE session_id = ? ORDER BY created_at ASC LIMIT ?
        `);
        return stmt.all(sessionId, limit);
    }

    getRecentSessions(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT session_id, MIN(created_at) as started_at, COUNT(*) as message_count
            FROM chat_history
            GROUP BY session_id
            ORDER BY started_at DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    // ============ Preferences ============

    setPreference(key, value) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO preferences (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(key, JSON.stringify(value));
    }

    getPreference(key, defaultValue = null) {
        const stmt = this.db.prepare(`SELECT value FROM preferences WHERE key = ?`);
        const row = stmt.get(key);
        return row ? JSON.parse(row.value) : defaultValue;
    }

    getAllPreferences() {
        const stmt = this.db.prepare(`SELECT key, value FROM preferences`);
        const rows = stmt.all();
        return rows.reduce((acc, row) => {
            acc[row.key] = JSON.parse(row.value);
            return acc;
        }, {});
    }

    // ============ Cleanup ============

    close() {
        if (this.db) {
            this.db.close();
        }
    }

    /**
     * Clean old records to save space
     */
    vacuum(daysToKeep = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);
        const cutoffStr = cutoff.toISOString();

        this.db.exec(`DELETE FROM diagnostics_history WHERE created_at < '${cutoffStr}'`);
        this.db.exec(`DELETE FROM chat_history WHERE created_at < '${cutoffStr}'`);
        this.db.exec(`VACUUM`);
    }
}

module.exports = { RelayDatabase };
