const db = require('./database');

function ensureUser(userId, username)
{
    const result = db.prepare(`
        INSERT INTO users (user_id, username, elo)
        VALUES (?, ?, 1000)
        ON CONFLICT(user_id) DO UPDATE SET username = COALESCE(?, users.username)
    `).run(userId, username, username);

    return result.changes > 0;
}

function getElo(userId)
{
    ensureUser(userId);

    const row = db.prepare(`
        SELECT elo FROM users WHERE user_id = ?
    `).get(userId);

    return row.elo;
}

function getUserStats(userId, username)
{
    ensureUser(userId, username);

    const row = db.prepare(`
        SELECT * FROM users WHERE user_id = ?
    `).get(userId);

    return row;
}

function setElo(userId, elo)
{
    ensureUser(userId);

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

function sortTopUsers()
{
    const users = db.prepare(`
        SELECT user_id AS id, username, elo FROM users ORDER BY elo DESC   
    `).all();
    
    return users;
}

function updateMatchResults(teamA_ids, teamB_ids, winner) {
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
    return pointChange;
}

module.exports = {
    ensureUser,
    getElo,
    getUserStats,
    setElo,
    addElo,
    sortTopUsers,
    updateMatchResults,
};