const Database = require('better-sqlite3');

const db = new Database('elo.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        elo INTEGER NOT NULL DEFAULT 1000
    );
    
    CREATE TABLE IF NOT EXISTS elo_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        delta INTEGER NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

module.exports = db;