const Database = require('better-sqlite3');

const db = new Database('elo.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        elo INTEGER NOT NULL DEFAULT 1000,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        last_played TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
        match_id INTEGER PRIMARY KEY AUTOINCREMENT,
        winner_team TEXT,
        elo_change INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        team_a_players TEXT, -- ids comma separated
        team_b_players TEXT
    );
`);

module.exports = db;