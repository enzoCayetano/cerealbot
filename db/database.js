const Database = require('better-sqlite3');

const db = new Database('elo.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        elo INTEGER NOT NULL DEFAULT 0,
        highest_elo INTEGER DEFAULT 0,
        rank INTEGER DEFAULT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        last_played TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
        match_id INTEGER PRIMARY KEY AUTOINCREMENT,
        winner_team TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        team_a_players TEXT, -- ids comma separated
        team_b_players TEXT
    );

    CREATE TABLE IF NOT EXISTS match_players (
        match_id INTEGER,
        user_id TEXT,
        team TEXT,
        elo_before INTEGER,
        elo_delta INTEGER,
        FOREIGN KEY (match_id) REFERENCES matches(match_id)
    );
`);

module.exports = db;