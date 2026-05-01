const express = require('express');
const axios   = require('axios');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');

const app = express();
app.use(express.json());

// ─── Konfiguratsiya (env'dan o'qish, fallback bilan) ───────
const BOT_TOKEN = process.env.BOT_TOKEN || "8698600397:AAHzrvVYullbDxhrTvBtfP6MHsWUicFVwp4";
const CHAT_ID   = process.env.CHAT_ID   || "-1003721934768";
const SECRET    = process.env.SECRET    || "5sl";
const PORT      = process.env.PORT      || 3000;
const STATS_FILE = path.join(__dirname, 'stats.json');

// ─── HTTP keep-alive agent (latency'ni 200-500ms kamaytiradi) ─
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 10000,
});

const tg = axios.create({
  baseURL: `https://api.telegram.org/bot${BOT_TOKEN}`,
  httpsAgent: keepAliveAgent,
  timeout: 5000,
});

// ─── Statistika (faylga saqlanadi, server restart'da yo'qolmaydi) ─
let stats = { wins: 0, losses: 0, day: new Date().toDateString() };

function loadStats() {
  if (fs.existsSync(STATS_FILE)) {
    try {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    } catch (e) {
      console.error('Stats fayl o\'qib bo\'lmadi:', e.message);
    }
  }
}

function saveStats() {
  fs.writeFile(STATS_FILE, JSON.stringify(stats), () => {});
}

function checkDayReset() {
  const today = new Date().toDateString();
  if (today !== stats.day) {
    stats.wins = 0;
    stats.losses = 0;
    stats.day = today;
    saveStats();
  }
}

// ─── Yordamchi funksiyalar ───────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function getTime(ts) {
  const d = ts ? new Date(Number(ts)) : new Date();
  return d.toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tashkent',
  });
}

// Eski signallarni rad etish — 30 soniyadan eski bo'lsa tashlamaymiz
const STALE_THRESHOLD_MS = 30_000;
function isStale(ts) {
  if (!ts) return false;
  const age = Date.now() - Number(ts);
  return age > STALE_THRESHOLD_MS;
}

// ─── Telegram navbat (rate limit'dan himoya) ─────────────────
const queue = [];
let sending = false;

async function processQueue() {
  if (sending || queue.length === 0) return;
  sending = true;
  while (queue.length > 0) {
    const text = queue.shift();
    try {
      await tg.post('/sendMessage', {
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    } catch (err) {
      const retryAfter = err.response?.data?.parameters?.retry_after;
      if (retryAfter) {
        console.warn(`⏳ Rate limit, ${retryAfter}s kutilmoqda`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        queue.unshift(text);
      } else {
        console.error('❌ Telegram xatosi:', err.response?.data || err.message);
      }
    }
    await new Promise(r => setTimeout(r, 50));
  }
  sending = false;
}

function enqueue(text) {
  queue.push(text);
  processQueue();
}

// ─── Xabar formatlari ────────────────────────────────────────
function formatSignal(d) {
  const emoji = d.signal === 'BUY' ? '🚀' : '🔻';
  return (
    `${emoji} <b>${escapeHtml(d.signal)} — ${escapeHtml(d.symbol)}</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📍 <b>Entry:</b>  <code>${escapeHtml(d.entry)}</code>\n` +
    `🛑 <b>SL:</b>     <code>${escapeHtml(d.sl)}</code>\n` +
    `🎯 <b>TP1:</b>    <code>${escapeHtml(d.tp1)}</code>\n` +
    `🎯 <b>TP2:</b>    <code>${escapeHtml(d.tp2)}</code>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `⏱ TF: ${escapeHtml(d.tf)}m  |  🕐 ${getTime(d.ts)}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🟢 <b>${stats.wins}</b>  🔴 <b>${stats.losses}</b>`
  );
}

function formatResult(type, d) {
  const isWin = type === 'WIN';
  return (
    `${isWin ? '🟢' : '🔴'} <b>${isWin ? 'WIN' : 'LOSS'} — ${escapeHtml(d.symbol)}</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    (d.price ? `💵 <b>Narx:</b> <code>${escapeHtml(d.price)}</code>\n` : '') +
    `🕐 ${getTime(d.ts)}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🟢 <b>${stats.wins}</b>  🔴 <b>${stats.losses}</b>`
  );
}

// ─── Webhook endpoint ─────────────────────────────────────────
app.post('/webhook/:secret', (req, res) => {
  if (req.params.secret !== SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ✅ TradingView'ga DARHOL javob qaytaramiz (kechikish bo'lmasin)
  res.json({ ok: true });

  // Telegram yuborish background'da
  setImmediate(() => {
    try {
      const data = req.body;
      checkDayReset();

      // ⏱ Eski signal — tarmoq lagida 30s+ kechikkan bo'lsa, tashlamaymiz
      if (isStale(data.ts)) {
        const ageSec = Math.round((Date.now() - Number(data.ts)) / 1000);
        console.warn(`⏱ Eski signal rad etildi (${ageSec}s):`, data.symbol);
        return;
      }

      if (data.type === 'WIN' || data.type === 'LOSS') {
        if (data.type === 'WIN') stats.wins++;
        else stats.losses++;
        saveStats();
        enqueue(formatResult(data.type, data));
        console.log(`📊 ${data.type} | W:${stats.wins} L:${stats.losses}`);
        return;
      }

      if (data.signal) {
        enqueue(formatSignal(data));
        console.log(`✅ ${data.signal} ${data.symbol} @ ${data.entry}`);
        return;
      }

      console.warn('⚠️ Noma\'lum payload:', data);
    } catch (err) {
      console.error('❌ Webhook handler xatosi:', err.message);
    }
  });
});

// ─── Health check ─────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    status: '✅ 5SL Bot ishlamoqda',
    wins: stats.wins,
    losses: stats.losses,
    queue: queue.length,
    uptime: process.uptime(),
  });
});

// ─── Ishga tushirish ──────────────────────────────────────────
loadStats();
app.listen(PORT, () => console.log(`🚀 Server port ${PORT} da ishlamoqda`));

process.on('uncaughtException', (e) => console.error('💥 uncaughtException:', e));
process.on('unhandledRejection', (e) => console.error('💥 unhandledRejection:', e));
