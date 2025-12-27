const db = require('./database');

function ensureUser(userId)
{
    db.prepare(`
        INSERT INTO users (user_id)
        VALUES (?)
        ON CONFLICT(user_id) DO NOTHING
    `).run(userId);
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

module.exports = {
    getElo,
    setElo,
    addElo,
};