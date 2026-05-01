const express = require('express');
const axios   = require('axios');
const app     = express();

app.use(express.json());

const BOT_TOKEN = "8698600397:AAHzrvVYullbDxhrTvBtfP6MHsWUicFVwp4";   // Telegram bot token
const CHAT_ID   = "-1003721934768";     // Telegram chat id
const SECRET    = "5sl" || 'mysecret'; // xavfsizlik

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

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id:    CHAT_ID,
    text:       text,
    parse_mode: 'HTML',
  });
}

function getTime() {
  return new Date().toLocaleTimeString('uz-UZ', {
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'Asia/Tashkent'
  });
}

// ─── Signal xabari ───────────────────────────
function formatSignal(data) {
  const emoji = data.signal === 'BUY' ? '🚀' : '🔻';
  return (
    `${emoji} <b>${data.signal} — ${data.symbol}</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📍 <b>Entry:</b>  <code>${data.entry}</code>\n` +
    `🛑 <b>SL:</b>     <code>${data.sl}</code>\n` +
    `🎯 <b>TP1:</b>    <code>${data.tp1}</code>\n` +
    `🎯 <b>TP2:</b>    <code>${data.tp2}</code>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `⏱ TF: ${data.tf}m  |  🕐 ${getTime()}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🟢 <b>${wins}</b>  🔴 <b>${losses}</b>`
  );
}

// ─── Natija xabari ───────────────────────────
function formatResult(type, data) {
  const isWin = type === 'WIN';
  return (
    `${isWin ? '🟢' : '🔴'} <b>${isWin ? 'WIN' : 'LOSS'} — ${data.symbol}</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🕐 ${getTime()}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🟢 <b>${wins}</b>  🔴 <b>${losses}</b>`
  );
}

// ─── Signal webhook ──────────────────────────
app.post('/webhook/:secret', async (req, res) => {
  if (req.params.secret !== SECRET)
    return res.status(403).json({ error: 'Forbidden' });

  const data = req.body;
  checkDayReset();

  // Signal yoki Natija — ikkalasi ham shu endpointga keladi
  try {
    // Natija (WIN/LOSS)
    if (data.type === 'WIN' || data.type === 'LOSS') {
      if (data.type === 'WIN') wins++;
      else losses++;
      const msg = formatResult(data.type, data);
      await sendTelegram(msg);
      console.log(`📊 ${data.type} | W:${wins} L:${losses}`);
      return res.json({ ok: true, wins, losses });
    }

    // Signal (BUY/SELL)
    if (data.signal) {
      const msg = formatSignal(data);
      await sendTelegram(msg);
      console.log(`✅ ${data.signal} ${data.symbol} @ ${data.entry}`);
      return res.json({ ok: true });
    }

    res.status(400).json({ error: 'Invalid payload' });
  } catch (err) {
    console.error('❌ Xato:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: '✅ 5SL Bot ishlamoqda', wins, losses });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server port ${PORT} da ishlamoqda`));
