const db = require('./database');

function ensureUser(userId, username)
{
    const result = db.prepare(`
        INSERT INTO users (user_id, username, elo)
        VALUES (?, ?, 1000)
        ON CONFLICT(user_id) DO UPDATE SET username = excluded.username
    `).run(userId, username);

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

function updateMatchResults(teamA_ids, teamB_ids, winner)
{
    // fetch elos
    const allIds = [...teamA_ids, ...teamB_ids];
    const placeholders = allIds.map(() => '?').join(',');
    const players = db.prepare(`
        SELECT user_id, elo FROM users WHERE user_id IN (${placeholders})
    `).all(...allIds);

    const getElo = (id) => players.find(p => p.id === id)?.elo || 1000;

    // calculate average team elo
    const avgA = teamA_ids.reduce((sum, id) => sum + getElo(id), 0) / teamA_ids.length;
    const avgB = teamB_ids.reduce((sum, id) => sum + getElo(id), 0) / teamB_ids.length;

    const expectedA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));

    const K = 32;
    const scoreA = winner === 'A' ? 1 : 0;
    const pointChange = Math.round(K * (scoreA - expectedA));

    const updateStmt = db.prepare(`
        UPDATE users SET elo = elo + ? WHERE user_id = ?    
    `);

    const transaction = db.transaction(() => {
        teamA_ids.forEach(id => {
            if (!id.startsWith('GHOST_')) updateStmt.run(pointChange, id);
        });
        teamB_ids.forEach(id => {
            if (!id.startsWith('GHOST_')) updateStmt.run(-pointChange, id);
        });
    });

    transaction();
    return pointChange;
}

module.exports = {
    ensureUser,
    getElo,
    setElo,
    addElo,
    sortTopUsers,
    updateMatchResults,
};