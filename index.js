const express = require('express');
const axios   = require('axios');
const app     = express();

app.use(express.json());

const BOT_TOKEN = "8698600397:AAHzrvVYullbDxhrTvBtfP6MHsWUicFVwp4";   // Telegram bot token
const CHAT_ID   = "-1003721934768";     // Telegram chat id
const SECRET    = "5sl" || 'mysecret'; // xavfsizlik


// ─── Kunlik statistika ───────────────────────
let wins   = 0;
let losses = 0;
let lastDay = new Date().toDateString();

function checkDayReset() {
  const today = new Date().toDateString();
  if (today !== lastDay) {
    wins   = 0;
    losses = 0;
    lastDay = today;
  }
}

// ─── Telegram yuborish ───────────────────────
async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id:    CHAT_ID,
    text:       text,
    parse_mode: 'HTML',
  });
}

// ─── Vaqt formati ────────────────────────────
function getTime() {
  return new Date().toLocaleTimeString('uz-UZ', {
    hour:   '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent'
  });
}

// ─── Signal xabari ───────────────────────────
function formatSignal(data) {
  const emoji  = data.signal === 'BUY' ? '🚀' : '🔻';
  const time   = getTime();

  return (
    `${emoji} <b>${data.signal} — ${data.symbol}</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📍 <b>Entry:</b>  <code>${data.entry}</code>\n` +
    `🛑 <b>SL:</b>     <code>${data.sl}</code>\n` +
    `🎯 <b>TP1:</b>    <code>${data.tp1}</code>\n` +
    `🎯 <b>TP2:</b>    <code>${data.tp2}</code>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `⏱ TF: ${data.tf}m  |  🕐 ${time}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🟢 Win: <b>${wins}</b>  |  🔴 Loss: <b>${losses}</b>`
  );
}

// ─── Natija xabari ───────────────────────────
function formatResult(type, data) {
  const time = getTime();
  const isWin = type === 'WIN';

  return (
    `${isWin ? '🟢' : '🔴'} <b>${isWin ? 'WIN' : 'LOSS'} — ${data.symbol}</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🕐 ${time}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🟢 Win: <b>${wins}</b>  |  🔴 Loss: <b>${losses}</b>`
  );
}

// ─── Webhook — Signal ────────────────────────
app.post('/webhook/:secret', async (req, res) => {
  if (req.params.secret !== SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const data = req.body;

  if (!data.signal || !data.symbol || !data.entry) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  checkDayReset();

  try {
    const msg = formatSignal(data);
    await sendTelegram(msg);
    console.log(`✅ Signal: ${data.signal} ${data.symbol} @ ${data.entry}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Xato:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Webhook — Natija (WIN/LOSS) ─────────────
app.post('/result/:secret', async (req, res) => {
  if (req.params.secret !== SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const data = req.body;
  // data.type = "WIN" yoki "LOSS"
  // data.symbol = "XAUUSD"

  if (!data.type || !data.symbol) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  checkDayReset();

  if (data.type === 'WIN') {
    wins++;
  } else {
    losses++;
  }

  try {
    const msg = formatResult(data.type, data);
    await sendTelegram(msg);
    console.log(`📊 Natija: ${data.type} | W:${wins} L:${losses}`);
    res.json({ ok: true, wins, losses });
  } catch (err) {
    console.error('❌ Xato:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: '✅ 5SL Bot ishlamoqda',
    wins,
    losses
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server port ${PORT} da ishlamoqda`);
});

