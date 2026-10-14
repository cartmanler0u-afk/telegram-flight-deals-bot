import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { registerCommands } from "./commands/index.js";
import { startScheduler } from "./scheduler.js";
import { startOffice } from "./office/index.js";

const bot = new Telegraf(config.telegramToken);

bot.start((ctx) =>
  ctx.reply(
    "✈️ Bot de bons plans billets d'avion prêt ! Tapez /help pour la liste des commandes.\n🏢 Tapez /office pour ouvrir le QG de vos agents IA."
  )
);

registerCommands(bot);
startScheduler(bot);
const office = await startOffice(bot);

bot.launch();
console.log("Bot Telegram démarré.");

async function shutdown(signal) {
  bot.stop(signal);
  await office.stop();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
