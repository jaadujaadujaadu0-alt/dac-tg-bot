require("dotenv").config();

const { initDB } = require("./db");
const bot = require("./bot");
const { resumeScheduler } = require("./scheduler");

async function bootstrap() {
  try {
    console.log("Starting DAC Telegram Bot...");

    initDB();

    /*
      optional admin auto resume
      if ADMIN_CHAT_ID exists, scheduler notifications resume there
    */
    const adminChatId = process.env.ADMIN_CHAT_ID
      ? Number(process.env.ADMIN_CHAT_ID)
      : null;

    if (adminChatId) {
      setTimeout(async () => {
        try {
          await resumeScheduler(bot, adminChatId);
          console.log("Scheduler resume check complete");
        } catch (err) {
          console.error("Resume failed:", err.message);
        }
      }, 2000);
    } else {
      console.log(
        "ADMIN_CHAT_ID not set. Scheduler will resume only after /start"
      );
    }

    console.log("Bot polling started");
  } catch (err) {
    console.error("Fatal startup error:", err);
    process.exit(1);
  }
}

bootstrap();

/*
 graceful shutdown
*/
process.on("SIGINT", () => {
  console.log("SIGINT received");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
