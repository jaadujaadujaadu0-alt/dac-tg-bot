require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { getConfig, updateConfig } = require("./db");
const {
  startScheduler,
  stopScheduler,
  forceAction
} = require("./scheduler");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN missing in .env");
}

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

function formatTime(ts) {
  if (!ts || ts <= 0) return "Not scheduled";
  return new Date(ts).toLocaleString();
}

async function sendStatus(chatId) {
  const cfg = await getConfig();

  const text = `
📊 DAC BOT STATUS

Running: ${cfg.running ? "YES" : "NO"}

Burn Amount: ${cfg.burn_amount}
Stake Amount: ${cfg.stake_amount}

Burn Count: ${cfg.burn_count}
Stake Count: ${cfg.stake_count}
Crate Count: ${cfg.crate_count}

Window:
${cfg.min_delay_minutes} min → ${cfg.max_delay_minutes} min

Next Run:
${formatTime(cfg.next_run)}

Commands:
/start
/stop
/status

/setburnamount 0.01
/setstakeamount 0.01

/setburncount 2
/setstakecount 3
/setcratecount 5

/setwindow 1445 1470

/force faucet
/force burn
/force stake
/force crate
/force reset
`.trim();

  bot.sendMessage(chatId, text);
}

/*
 START
*/
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await startScheduler(bot, chatId);
    bot.sendMessage(chatId, "✅ Scheduler started");
  } catch (err) {
    bot.sendMessage(chatId, `❌ ${err.message}`);
  }
});

/*
 STOP
*/
bot.onText(/^\/stop$/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await stopScheduler();
    bot.sendMessage(chatId, "🛑 Scheduler stopped");
  } catch (err) {
    bot.sendMessage(chatId, `❌ ${err.message}`);
  }
});

/*
 STATUS
*/
bot.onText(/^\/status$/, async (msg) => {
  await sendStatus(msg.chat.id);
});

/*
 SET BURN AMOUNT
*/
bot.onText(/^\/setburnamount\s+([0-9.]+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseFloat(match[1]);

  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, "Invalid amount");
  }

  await updateConfig({
    burn_amount: amount
  });

  bot.sendMessage(chatId, `✅ Burn amount set to ${amount}`);
});

/*
 SET STAKE AMOUNT
*/
bot.onText(/^\/setstakeamount\s+([0-9.]+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseFloat(match[1]);

  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, "Invalid amount");
  }

  await updateConfig({
    stake_amount: amount
  });

  bot.sendMessage(chatId, `✅ Stake amount set to ${amount}`);
});

/*
 SET BURN COUNT
*/
bot.onText(/^\/setburncount\s+([0-9]+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const count = parseInt(match[1]);

  if (isNaN(count) || count < 0) {
    return bot.sendMessage(chatId, "Invalid count");
  }

  await updateConfig({
    burn_count: count
  });

  bot.sendMessage(chatId, `✅ Burn count set to ${count}`);
});

/*
 SET STAKE COUNT
*/
bot.onText(/^\/setstakecount\s+([0-9]+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const count = parseInt(match[1]);

  if (isNaN(count) || count < 0) {
    return bot.sendMessage(chatId, "Invalid count");
  }

  await updateConfig({
    stake_count: count
  });

  bot.sendMessage(chatId, `✅ Stake count set to ${count}`);
});

/*
 SET CRATE COUNT
*/
bot.onText(/^\/setcratecount\s+([0-9]+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const count = parseInt(match[1]);

  if (isNaN(count) || count < 0) {
    return bot.sendMessage(chatId, "Invalid count");
  }

  await updateConfig({
    crate_count: count
  });

  bot.sendMessage(chatId, `✅ Crate count set to ${count}`);
});

/*
 SET WINDOW
 example:
 /setwindow 1445 1470
*/
bot.onText(/^\/setwindow\s+([0-9]+)\s+([0-9]+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const min = parseInt(match[1]);
  const max = parseInt(match[2]);

  if (isNaN(min) || isNaN(max) || min <= 0 || max < min) {
    return bot.sendMessage(chatId, "Invalid window");
  }

  await updateConfig({
    min_delay_minutes: min,
    max_delay_minutes: max
  });

  bot.sendMessage(
    chatId,
    `✅ Window updated: ${min} → ${max} minutes`
  );
});

/*
 FORCE
*/
bot.onText(/^\/force\s+(faucet|burn|stake|crate|reset)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const action = match[1].toLowerCase();

  try {
    const cfg = await getConfig();

    let amount = null;

    if (action === "burn") {
      amount = cfg.burn_amount;
    }

    if (action === "stake") {
      amount = cfg.stake_amount;
    }

    await forceAction(action, amount);

    bot.sendMessage(chatId, `⚡ Forced ${action}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ ${err.message}`);
  }
});

/*
 UNKNOWN COMMAND
*/
bot.on("message", async (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith("/")) {
    const known = [
      "/start",
      "/stop",
      "/status",
      "/setburnamount",
      "/setstakeamount",
      "/setburncount",
      "/setstakecount",
      "/setcratecount",
      "/setwindow",
      "/force"
    ];

    const matched = known.some(cmd => msg.text.startsWith(cmd));

    if (!matched) {
      bot.sendMessage(msg.chat.id, "Unknown command");
    }
  }
});

module.exports = bot;
