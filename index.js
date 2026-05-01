const express = require('express');
const axios   = require('axios');
const app     = express();

app.use(express.json());

// ─── ENV dan olish ───────────────────────────
const BOT_TOKEN = "8698600397:AAHzrvVYullbDxhrTvBtfP6MHsWUicFVwp4";   // Telegram bot token
const CHAT_ID   = "-1003721934768";     // Telegram chat id
const SECRET    = "5sl" || 'mysecret'; // xavfsizlik

// ─── Telegram xabar yuborish ─────────────────
async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id:    CHAT_ID,
    text:       text,
    parse_mode: 'HTML',
  });
}

// ─── Signal formatlab chiqarish ──────────────
function formatMessage(data) {
  const emoji  = data.signal === 'BUY' ? '🚀' : '🔻';
  const action = data.signal === 'BUY' ? 'BUY' : 'SELL';
  const time   = new Date().toUTCString();

  return (
    `${emoji} <b>${action} — ${data.symbol}</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📍 <b>Entry:</b>  <code>${data.entry}</code>\n` +
    `🛑 <b>SL:</b>     <code>${data.sl}</code>\n` +
    `🎯 <b>TP1:</b>    <code>${data.tp1}</code>\n` +
    `🎯 <b>TP2:</b>    <code>${data.tp2}</code>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `⏱ <b>TF:</b> ${data.tf}m  |  🕐 ${time}`
  );
}

// ─── Webhook endpoint ─────────────────────────
app.post('/webhook/:secret', async (req, res) => {
  // Secret tekshirish
  if (req.params.secret !== SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const data = req.body;

  // Kerakli maydonlar bormi?
  if (!data.signal || !data.symbol || !data.entry) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const msg = formatMessage(data);
    await sendTelegram(msg);
    console.log(`✅ Signal yuborildi: ${data.signal} ${data.symbol} @ ${data.entry}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Xato:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: '✅ 5SL Bot ishlamoqda' });
});

// ─── Server start ─────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server port ${PORT} da ishlamoqda`);
});
