const db = require('./database');

function registerUser(userId, username)
{
    const taken = db.prepare(`
        SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) AND user_id != ?
    `).get(username, userId);

    if (taken) return { success: false, reason: 'username_taken' };

    const existing = db.prepare(`
        SELECT user_id FROM users WHERE user_id = ?
    `).get(userId);

    if (existing) return { success: false, reason: 'already_registered' };

    db.prepare(`
        INSERT INTO users (user_id, username, elo) VALUES (?, ?, 1000)
    `).run(userId, username);

    return { success: true };
}

function setUsername(userId, newUsername)
{
    const existing = db.prepare(`
        SELECT user_id FROM users WHERE user_id = ?
    `).get(userId);

    if (!existing) return { success: false, reason: 'user_not_found' };

    const taken = db.prepare(`
        SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) AND user_id != ?
    `).get(newUsername, userId);

    if (taken) return { success: false, reason: 'username_taken' };

    db.prepare(`
        UPDATE users SET username = ? WHERE user_id = ?
    `).run(newUsername, userId);

    return { success: true };
}

function getElo(userId)
{
    const row = db.prepare(`
        SELECT elo FROM users WHERE user_id = ?
    `).get(userId);

    return row?.elo ?? null;
}

function getUserStats(userId, username)
{
    return db.prepare(`
        SELECT * FROM users WHERE user_id = ?
    `).get(userId) ?? null;
}

function setElo(userId, elo)
{
    const user = db.prepare(`SELECT user_id FROM users WHERE user_id = ?`).get(userId);
    if (!user) return null;

    db.prepare(`
        UPDATE users SET elo = ? WHERE user_id = ?
    `).run(elo, userId);
}

function addElo(userId, delta, reason = null)
{
    ensureUser(userId);

    const current = getElo(userId);
    const next = current + delta;

    setElo(userId, next);

    db.prepare(`
        INSERT INTO elo_history (user_id, delta, reason)
        VALUES (?, ?, ?)
    `).run(userId, delta, reason);

    return next;
}

function updateRanks()
{
    db.prepare(`
        UPDATE users
        SET rank = (
            SELECT COUNT(*) + 1
            FROM users AS u2
            WHERE u2.elo > users.elo
        )
    `).run();
}

function sortTopUsers()
{
    const users = db.prepare(`
        SELECT user_id AS id, username, elo, wins, losses, games_played FROM users ORDER BY elo DESC   
    `).all();
    
    return users;
}

function getRecentMatches(limit = 10) 
{
    return db.prepare(`
        SELECT * FROM matches ORDER BY timestamp DESC LIMIT ?
    `).all(limit);
}

function getMatchPlayers(matchId) 
{
    return db.prepare(`
        SELECT mp.*, u.username FROM match_players mp
        LEFT JOIN users u ON mp.user_id = u.user_id
        WHERE mp.match_id = ?
    `).all(matchId);
}

function getUserMatchHistory(userId, limit = 10) 
{
    return db.prepare(`
        SELECT 
            m.match_id,
            m.winner_team,
            m.timestamp,
            mp.team,
            mp.elo_before,
            mp.elo_delta
        FROM match_players mp
        JOIN matches m ON mp.match_id = m.match_id
        WHERE mp.user_id = ?
        ORDER BY m.timestamp DESC
        LIMIT ?
    `).all(userId, limit);
}

function updateMatchResults(teamA_ids, teamB_ids, winner) 
{
    const VARIANCE = 5;
    const STREAK_BONUS_PER_LEVEL = 0.05; // 5% per streak level
    const STREAK_CAP = 3;


    // fetch elos
    const allIds = [...teamA_ids, ...teamB_ids];
    const placeholders = allIds.map(() => '?').join(',');
    const players = db.prepare(`
        SELECT user_id, elo, current_streak FROM users WHERE user_id IN (${placeholders})
    `).all(...allIds);

    const getPlayer = (id) => players.find(p => p.user_id === id) ?? { elo: 1000, current_streak: 0 };

    // calculate average team elo
    const avgA = teamA_ids.reduce((sum, id) => sum + getPlayer(id).elo, 0) / teamA_ids.length;
    const avgB = teamB_ids.reduce((sum, id) => sum + getPlayer(id).elo, 0) / teamB_ids.length;

    const expectedA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));

    const K = 32;
    const scoreA = winner === 'A' ? 1 : 0;
    const basePointChange = Math.round(K * (scoreA - expectedA));

    const winnerIds = winner === 'A' ? teamA_ids : teamB_ids;
    const loserIds  = winner === 'A' ? teamB_ids : teamA_ids;
    const winPoints = winner === 'A' ? basePointChange : -basePointChange;

    const now = new Date().toISOString();

    const updateWinner = db.prepare(`
        UPDATE users SET
            elo            = MAX(0, elo + ?),
            highest_elo    = MAX(highest_elo, elo + ?),
            wins           = wins + 1,
            games_played   = games_played + 1,
            current_streak = current_streak + 1,
            last_played    = ?
        WHERE user_id = ?
    `);

    const updateLoser = db.prepare(`
        UPDATE users SET
            elo            = MAX(0, elo - ?),
            losses         = losses + 1,
            games_played   = games_played + 1,
            current_streak = 0,
            last_played    = ?
        WHERE user_id = ?
    `);

    const changes = {};

    const transaction = db.transaction(() => {
        // Insert match record first to get match_id
        const matchInsert = db.prepare(`
            INSERT INTO matches (winner_team, team_a_players, team_b_players)
            VALUES (?, ?, ?)
        `).run(winner, teamA_ids.join(','), teamB_ids.join(','));

        const matchId = matchInsert.lastInsertRowid;

        const insertMatchPlayer = db.prepare(`
            INSERT INTO match_players (match_id, user_id, team, elo_before, elo_delta)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const id of winnerIds)
        {
            if (id.startsWith('GHOST_')) continue;

            const player = getPlayer(id);
            const streakLevel = Math.min(player.current_streak, STREAK_CAP);
            const streakMultiplier = 1 + (streakLevel * STREAK_BONUS_PER_LEVEL);
            const variance = Math.floor(Math.random() * (VARIANCE * 2 + 1)) - VARIANCE;
            const finalGain = Math.round(winPoints * streakMultiplier) + variance;

            updateWinner.run(finalGain, finalGain, now, id);
            changes[id] = finalGain;

            insertMatchPlayer.run(matchId, id, winner === 'A' ? 'A' : 'B', player.elo, finalGain);
        }

        for (const id of loserIds) 
        {
            if (id.startsWith('GHOST_')) continue;

            const player = getPlayer(id);
            const variance = Math.floor(Math.random() * (VARIANCE * 2 + 1)) - VARIANCE;
            const finalLoss = winPoints + variance;

            updateLoser.run(finalLoss, now, id);
            changes[id] = -finalLoss;

            insertMatchPlayer.run(matchId, id, winner === 'A' ? 'B' : 'A', player.elo, -finalLoss);
        }
    });

    transaction();
    updateRanks();
    
    return { basePointChange, changes };
}

module.exports = {
    registerUser,
    setUsername,
    getElo,
    getUserStats,
    setElo,
    addElo,
    sortTopUsers,
    updateMatchResults,
    getRecentMatches,
    getMatchPlayers,
    getUserMatchHistory,
};