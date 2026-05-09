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
        SELECT user_id AS id, username, elo FROM users ORDER BY elo DESC   
    `).all();
    
    return users;
}

function updateMatchResults(teamA_ids, teamB_ids, winner) 
{
    // fetch elos
    const allIds = [...teamA_ids, ...teamB_ids];
    const placeholders = allIds.map(() => '?').join(',');
    const players = db.prepare(`
        SELECT user_id, elo FROM users WHERE user_id IN (${placeholders})
    `).all(...allIds);

    const getElo = (id) => players.find(p => p.user_id === id)?.elo ?? 1000;

    // calculate average team elo
    const avgA = teamA_ids.reduce((sum, id) => sum + getElo(id), 0) / teamA_ids.length;
    const avgB = teamB_ids.reduce((sum, id) => sum + getElo(id), 0) / teamB_ids.length;

    const expectedA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));

    const K = 32;
    const scoreA = winner === 'A' ? 1 : 0;
    const pointChange = Math.round(K * (scoreA - expectedA));

    const winnerIds = winner === 'A' ? teamA_ids : teamB_ids;
    const loserIds  = winner === 'A' ? teamB_ids : teamA_ids;
    const winPoints = winner === 'A' ? pointChange : -pointChange;

    const now = new Date().toISOString();

    const updateWinner = db.prepare(`
        UPDATE users SET
            elo          = MAX(0, elo + ?),
            highest_elo  = MAX(highest_elo, elo + ?),
            wins         = wins + 1,
            games_played = games_played + 1,
            current_streak = current_streak + 1,
            last_played  = ?
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

    const transaction = db.transaction(() => {
        winnerIds.forEach(id => {
            if (!id.startsWith('GHOST_')) updateWinner.run(winPoints, winPoints, now, id);
        });
        loserIds.forEach(id => {
            if (!id.startsWith('GHOST_')) updateLoser.run(winPoints, now, id);
        });
    });

    transaction();
    updateRanks();
    return pointChange;
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
};