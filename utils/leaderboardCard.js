const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Outfit-Bold.ttf'), 'Outfit');

const W = 600;
const ROW_H = 52;
const HEADER_H = 80;
const PADDING = 24;
const ITEMS_PER_PAGE = 10;

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

async function generateLeaderboardCard(users, page, totalPages) {
    const start = page * ITEMS_PER_PAGE;
    const pageUsers = users.slice(start, start + ITEMS_PER_PAGE);

    const H = HEADER_H + pageUsers.length * ROW_H + PADDING;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // ── Background ──────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f1117');
    bg.addColorStop(1, '#1a1d2e');
    drawRoundRect(ctx, 0, 0, W, H, 18);
    ctx.fillStyle = bg;
    ctx.fill();

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
    }
    for (let i = 0; i < H; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
    }

    // Top glow
    const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 200);
    glow.addColorStop(0, 'rgba(255,165,0,0.12)');
    glow.addColorStop(1, 'rgba(255,165,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── Header ───────────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Outfit"';
    ctx.textAlign = 'center';
    ctx.fillText('Server Leaderboard', W / 2, 42);

    ctx.fillStyle = '#8b8fa8';
    ctx.font = '13px "Outfit"';
    ctx.fillText(`Page ${page + 1} of ${totalPages}`, W / 2, 64);

    // Divider
    ctx.strokeStyle = 'rgba(255,165,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, HEADER_H - 4);
    ctx.lineTo(W - PADDING, HEADER_H - 4);
    ctx.stroke();

    // ── Rows ─────────────────────────────────────────────────────
    ctx.textAlign = 'left';

    for (let i = 0; i < pageUsers.length; i++) {
        const user = pageUsers[i];
        const globalRank = start + i + 1;
        const y = HEADER_H + i * ROW_H;
        const isEven = i % 2 === 0;

        // Row background (alternating)
        ctx.fillStyle = isEven ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0)';
        drawRoundRect(ctx, PADDING, y + 4, W - PADDING * 2, ROW_H - 6, 8);
        ctx.fill();

        // Highlight top 3 rows with a left accent bar
        if (globalRank <= 3) {
            ctx.fillStyle = RANK_COLORS[globalRank - 1];
            ctx.fillRect(PADDING, y + 4, 3, ROW_H - 6);
        }

        // Rank number
        const rankColor = globalRank <= 3 ? RANK_COLORS[globalRank - 1] : '#8b8fa8';
        ctx.fillStyle = rankColor;
        ctx.font = globalRank <= 3 ? 'bold 15px "Outfit"' : '14px "Outfit"';
        ctx.textAlign = 'left';
        const rankText = `#${globalRank}`;
        ctx.fillText(rankText, PADDING + 12, y + ROW_H / 2 + 5);

        // Username
        ctx.fillStyle = globalRank <= 3 ? '#ffffff' : '#d4d7e0';
        ctx.font = globalRank <= 3 ? 'bold 15px "Outfit"' : '14px "Outfit"';
        ctx.fillText(user.username ?? 'Unknown', PADDING + 56, y + ROW_H / 2 + 5);

        // ELO — right aligned
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFA500';
        ctx.font = 'bold 14px "Outfit"';
        ctx.fillText(`${user.elo} ELO`, W - PADDING - 12, y + ROW_H / 2 + 5);

        // Win/loss if available
        if (user.wins !== undefined && user.losses !== undefined) {
            ctx.fillStyle = '#8b8fa8';
            ctx.font = '12px "Outfit"';
            ctx.fillText(`${user.wins}W / ${user.losses}L`, W - PADDING - 12, y + ROW_H / 2 + 20);
        }

        ctx.textAlign = 'left';
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateLeaderboardCard };