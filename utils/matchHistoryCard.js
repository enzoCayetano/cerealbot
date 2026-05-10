const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
 
// Register your fonts — adjust path to wherever you put your .ttf files
// GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Outfit-Bold.ttf'), 'Outfit');
// GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Outfit-Regular.ttf'), 'Outfit');
 
const FONT = 'Outfit'; // change to 'sans-serif' if you haven't set up fonts yet
 
const W = 700;
const PADDING = 28;
const HEADER_H = 78;
const MATCH_H = 155;
const FOOTER_H = 40;
 
// ── Helpers ──────────────────────────────────────────────────────────────────
 
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
 
function truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    while (text.length > 0 && ctx.measureText(text + '…').width > maxWidth) {
        text = text.slice(0, -1);
    }
    return text + '…';
}
 
function formatDelta(delta) {
    return delta >= 0 ? `+${delta}` : `${delta}`;
}
 
function formatDate(ts) {
    return new Date(ts).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}
 
// ── Draw a single match card row ─────────────────────────────────────────────
 
function drawMatchRow(ctx, match, players, y, targetUserId = null) {
    const x = PADDING;
    const w = W - PADDING * 2;
    const h = MATCH_H;
    const r = 12;
 
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');
    const wonA  = match.winner_team === 'A';
 
    // Determine if target user won (for user-specific view)
    let userWon = null;
    if (targetUserId) {
        const self = players.find(p => p.user_id === targetUserId);
        if (self) userWon = self.team === match.winner_team;
    }
 
    // Card background
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.fill();
 
    // Left accent bar — green/red based on win/loss or neutral purple for global
    const accentColor = userWon === null
        ? '#5865F2'
        : userWon ? '#57F287' : '#ED4245';
 
    ctx.fillStyle = accentColor;
    drawRoundRect(ctx, x, y, 4, h, 2);
    ctx.fill();
 
    // Match ID + date — top left
    ctx.fillStyle = '#8b8fa8';
    ctx.font = `500 12px "${FONT}", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`MATCH #${match.match_id}`, x + 16, y + 18);
 
    // Date — top right
    ctx.textAlign = 'right';
    ctx.fillText(formatDate(match.timestamp), x + w - 8, y + 18);
 
    // Winner badge — centered top
    ctx.textAlign = 'center';
    const badgeText = `TEAM ${match.winner_team} WIN`;
    const badgeColor = match.winner_team === 'A' ? '#5865F2' : '#EB459E';
    const badgeW = ctx.measureText(badgeText).width + 20;
    ctx.fillStyle = badgeColor + '33';
    drawRoundRect(ctx, W / 2 - badgeW / 2, y + 6, badgeW, 20, 4);
    ctx.fill();
    ctx.fillStyle = badgeColor;
    ctx.font = `700 11px "${FONT}", sans-serif`;
    ctx.fillText(badgeText, W / 2, y + 20);
 
    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 32);
    ctx.lineTo(x + w - 8, y + 32);
    ctx.stroke();
 
    // Team columns
    const colW = (w - 32) / 2;
    const teamAx = x + 16;
    const teamBx = x + 16 + colW + 16;
    const teamY  = y + 48;
 
    // Team A header
    ctx.textAlign = 'left';
    ctx.fillStyle = wonA ? '#57F287' : '#ED4245';
    ctx.font = `700 11px "${FONT}", sans-serif`;
    ctx.fillText(wonA ? 'TEAM A  ✓' : 'TEAM A  ✗', teamAx, teamY);
 
    // Team B header
    ctx.fillStyle = !wonA ? '#57F287' : '#ED4245';
    ctx.fillText(!wonA ? 'TEAM B  ✓' : 'TEAM B  ✗', teamBx, teamY);
 
    // Player rows
    const playerStartY = teamY + 14;
    const lineH = 16;
 
    const drawPlayers = (team, startX) => {
        team.forEach((p, i) => {
            const py = playerStartY + i * lineH;
            const isTarget = p.user_id === targetUserId;
            const delta = formatDelta(p.elo_delta);
            const deltaColor = p.elo_delta >= 0 ? '#57F287' : '#ED4245';
            const name = p.username ?? p.user_id;
 
            // Highlight target player
            if (isTarget) {
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                drawRoundRect(ctx, startX - 4, py - 11, colW, 14, 3);
                ctx.fill();
            }
 
            // Name
            ctx.fillStyle = isTarget ? '#ffffff' : '#c4c9d4';
            ctx.font = `${isTarget ? '700' : '400'} 12px "${FONT}", sans-serif`;
            ctx.textAlign = 'left';
            const maxNameW = colW - 52;
            ctx.fillText(truncate(ctx, name, maxNameW), startX, py);
 
            // Delta
            ctx.fillStyle = deltaColor;
            ctx.font = `700 12px "${FONT}", sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillText(delta, startX + colW - 8, py);
        });
    };
 
    drawPlayers(teamA, teamAx);
    drawPlayers(teamB, teamBx);
 
    // Vertical divider between teams
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 30);
    ctx.lineTo(x + w / 2, y + h - 8);
    ctx.stroke();
}
 
// ── Main export ──────────────────────────────────────────────────────────────
 
async function generateMatchHistoryCard(matches, matchPlayers, page, totalPages, targetUser = null) {
    const H = HEADER_H + matches.length * (MATCH_H + 10) + FOOTER_H;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
 
    // ── Background ──────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d0f18');
    bg.addColorStop(1, '#131625');
    drawRoundRect(ctx, 0, 0, W, H, 20);
    ctx.fillStyle = bg;
    ctx.fill();
 
    // Dot grid texture
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let gx = 20; gx < W; gx += 28) {
        for (let gy = 20; gy < H; gy += 28) {
            ctx.beginPath();
            ctx.arc(gx, gy, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
 
    // Top glow
    const topGlow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 220);
    topGlow.addColorStop(0, 'rgba(88,101,242,0.18)');
    topGlow.addColorStop(1, 'rgba(88,101,242,0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, H);
 
    // ── Header ───────────────────────────────────────────────────
    ctx.textAlign = 'center';
 
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 22px "${FONT}", sans-serif`;
    const title = targetUser ? `${targetUser.username}'s Match History` : 'Recent Matches';
    ctx.fillText(title, W / 2, 55);
 
    // Header underline
    ctx.strokeStyle = 'rgba(88,101,242,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, HEADER_H - 4);
    ctx.lineTo(W - PADDING, HEADER_H - 4);
    ctx.stroke();
 
    // ── Match rows ───────────────────────────────────────────────
    matches.forEach((match, i) => {
        if (!match || !match.match_id) return; // ADD THIS
        const players = matchPlayers[match.match_id] ?? [];
        const y = HEADER_H + i * (MATCH_H + 10);
        drawMatchRow(ctx, match, players, y, targetUser?.id ?? null);
    });
 
    // ── Footer ───────────────────────────────────────────────────
    const footerY = H - FOOTER_H + 12;
    ctx.fillStyle = '#8b8fa8';
    ctx.font = `400 12px "${FONT}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${page + 1} of ${totalPages}`, W / 2, footerY);
 
    return canvas.toBuffer('image/png');
}
 
module.exports = { generateMatchHistoryCard };
 