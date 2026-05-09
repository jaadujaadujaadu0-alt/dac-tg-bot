const axios = require("axios");
const { getConfig, updateConfig } = require("./db");

const BASE_URL = process.env.BASE_URL;

let schedulerTimer = null;
let telegramBot = null;
let chatId = null;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAPI(endpoint) {
  try {
    const url = `${BASE_URL}${endpoint}`;

    const res = await axios.get(url, {
      headers: {
        accept: "application/json"
      },
      timeout: 30000
    });

    console.log("API:", endpoint, res.data);

    if (telegramBot && chatId) {
      telegramBot.sendMessage(
        chatId,
        `✅ ${endpoint}\n${JSON.stringify(res.data)}`
      );
    }

    return res.data;
  } catch (err) {
    console.error("API error:", endpoint, err.message);

    if (telegramBot && chatId) {
      telegramBot.sendMessage(
        chatId,
        `❌ ${endpoint}\n${err.message}`
      );
    }
  }
}

async function forceAction(action, amount = null) {
  switch (action) {
    case "faucet":
      return callAPI("/faucet");

    case "burn":
      return callAPI(`/burn?amount=${amount || 0.01}`);

    case "stake":
      return callAPI(`/stake?amount=${amount || 0.01}`);

    case "crate":
      return callAPI("/crate");

    case "reset":
      return callAPI("/reset");

    default:
      throw new Error("Unknown force action");
  }
}

async function runCycle() {
  const cfg = await getConfig();

  if (!cfg.running) {
    return;
  }

  console.log("Starting cycle...");

  await callAPI("/faucet");

  const actions = [];

  for (let i = 0; i < cfg.burn_count; i++) {
    actions.push({
      type: "burn",
      endpoint: `/burn?amount=${cfg.burn_amount}`
    });
  }

  for (let i = 0; i < cfg.stake_count; i++) {
    actions.push({
      type: "stake",
      endpoint: `/stake?amount=${cfg.stake_amount}`
    });
  }

  for (let i = 0; i < cfg.crate_count; i++) {
    actions.push({
      type: "crate",
      endpoint: "/crate"
    });
  }

  const randomizedActions = shuffle(actions);

  if (randomizedActions.length > 0) {
    const minGap = 30000;
    const maxGap = 300000;

    for (const action of randomizedActions) {
      const stillRunning = await getConfig();

      if (!stillRunning.running) {
        console.log("Scheduler stopped.");
        return;
      }

      const gap = randomInt(minGap, maxGap);

      console.log("Waiting", gap, "ms before", action.type);

      await sleep(gap);

      await callAPI(action.endpoint);
    }
  }

  await callAPI("/reset");

  scheduleNextCycle();
}

async function scheduleNextCycle() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  const cfg = await getConfig();

  if (!cfg.running) {
    return;
  }

  const delayMinutes = randomInt(
    cfg.min_delay_minutes,
    cfg.max_delay_minutes
  );

  const delayMs = delayMinutes * 60 * 1000;
  const nextRun = Date.now() + delayMs;

  await updateConfig({
    next_run: nextRun
  });

  console.log("Next run in", delayMinutes, "minutes");

  if (telegramBot && chatId) {
    telegramBot.sendMessage(
      chatId,
      `⏰ Next cycle in ${delayMinutes} minutes`
    );
  }

  schedulerTimer = setTimeout(async () => {
    await runCycle();
  }, delayMs);
}

async function startScheduler(bot, tgChatId) {
  telegramBot = bot;
  chatId = tgChatId;

  await updateConfig({
    running: 1
  });

  await scheduleNextCycle();
}

async function stopScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  await updateConfig({
    running: 0
  });
}

async function resumeScheduler(bot, tgChatId) {
  telegramBot = bot;
  chatId = tgChatId;

  const cfg = await getConfig();

  if (!cfg.running) {
    return;
  }

  if (cfg.next_run && cfg.next_run > Date.now()) {
    const remaining = cfg.next_run - Date.now();

    schedulerTimer = setTimeout(async () => {
      await runCycle();
    }, remaining);

    console.log("Resumed scheduler");
  } else {
    await scheduleNextCycle();
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  resumeScheduler,
  forceAction
};
