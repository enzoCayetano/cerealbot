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
        SELECT username, elo FROM users ORDER BY elo DESC   
    `).all();
    
    return users;
}

module.exports = {
    ensureUser,
    getElo,
    setElo,
    addElo,
    sortTopUsers,
};