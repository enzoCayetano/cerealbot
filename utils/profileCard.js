const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { getRankWithOAA, getRankColor, getRankProgress } = require('./ranks');
const path = require('path');
GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Outfit-Bold.ttf'), 'Outfit');

const W = 800, H = 250;

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

function drawStatBox(ctx, x, y, label, value, accent = '#5865F2') {
    const bw = 120, bh = 60, br = 10;

    // Box background
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    drawRoundRect(ctx, x, y, bw, bh, br);
    ctx.fill();

    // Accent top border
    ctx.fillStyle = accent;
    drawRoundRect(ctx, x, y, bw, 3, 2);
    ctx.fill();

    // Label
    ctx.fillStyle = '#8b8fa8';
    ctx.font = '11px "Outfit"';
    ctx.fillText(label.toUpperCase(), x + 12, y + 20);

    // Value
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Outfit"';
    ctx.fillText(value, x + 12, y + 46);
}

async function generateProfileCard(profile, avatarURL) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // ── Background ──────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f1117');
    bg.addColorStop(1, '#1a1d2e');
    ctx.fillStyle = bg;
    drawRoundRect(ctx, 0, 0, W, H, 18);
    ctx.fill();

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
    }
    for (let i = 0; i < H; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
    }

    // Accent glow blob top-left
    const glow = ctx.createRadialGradient(80, 80, 0, 80, 80, 160);
    glow.addColorStop(0, 'rgba(88,101,242,0.25)');
    glow.addColorStop(1, 'rgba(88,101,242,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── Avatar ───────────────────────────────────────────────────
    const AVATAR_SIZE = 90;
    const ax = 30, ay = (H - AVATAR_SIZE) / 2 - 50;

    try {
        const avatar = await loadImage(avatarURL + '?size=256');

        // Glowing ring
        ctx.shadowColor = '#5865F2';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#5865F2';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ax + AVATAR_SIZE / 2, ay + AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Clip avatar to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + AVATAR_SIZE / 2, ay + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, ax, ay, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    } catch {
        // Fallback circle if avatar fails
        ctx.fillStyle = '#5865F2';
        ctx.beginPath();
        ctx.arc(ax + AVATAR_SIZE / 2, ay + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── Name & ELO ───────────────────────────────────────────────
    const textX = ax + AVATAR_SIZE + 24;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Outfit"';
    ctx.fillText(profile.username, textX, ay + 32);

    ctx.fillStyle = '#8b8fa8';
    ctx.font = '14px "Outfit"';
    ctx.fillText(`Rank #${profile.rank ?? '—'}`, textX, ay + 52);

    // ELO badge
    const eloText = `${profile.elo} ELO`;
    ctx.font = 'bold 13px "Outfit"';
    const eloW = ctx.measureText(eloText).width + 20;
    ctx.fillStyle = 'rgba(88,101,242,0.3)';
    drawRoundRect(ctx, textX, ay + 62, eloW, 24, 6);
    ctx.fill();
    ctx.strokeStyle = '#5865F2';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#a5b4fc';
    ctx.fillText(eloText, textX + 10, ay + 79);

    // Streak badge (only if streak >= 2)
    if (profile.current_streak >= 2) {
        const streakText = `Win Streak - ${profile.current_streak}`;
        ctx.font = 'bold 13px "Outfit"';
        const sw = ctx.measureText(streakText).width + 20;
        ctx.fillStyle = 'rgba(255,150,50,0.2)';
        drawRoundRect(ctx, textX + eloW + 10, ay + 62, sw, 24, 6);
        ctx.fill();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fdba74';
        ctx.fillText(streakText, textX + eloW + 18, ay + 79);
    }

    // ── Stat Boxes ───────────────────────────────────────────────
    const winrate = profile.games_played > 0
        ? ((profile.wins / profile.games_played) * 100).toFixed(1) + '%'
        : '0.0%';

    const stats = [
        { label: 'Wins',     value: `${profile.wins}`,          accent: '#57F287' },
        { label: 'Losses',   value: `${profile.losses}`,        accent: '#ED4245' },
        { label: 'Played',   value: `${profile.games_played}`,  accent: '#5865F2' },
        { label: 'Winrate',  value: winrate,                    accent: '#FEE75C' },
        { label: 'Peak ELO', value: `${profile.highest_elo}`,   accent: '#EB459E' },
    ];

    const boxW = 80, gap = 60;
    const totalW = stats.length * boxW + (stats.length - 1) * gap;
    let bx = (W - totalW) / 3; // center the row
    const by = H - 100;

    for (const stat of stats) {
        drawStatBox(ctx, bx, by, stat.label, stat.value, stat.accent);
        bx += boxW + gap;
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateProfileCard };