import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { registerCommands } from "./commands/index.js";
import { startScheduler } from "./scheduler.js";

const bot = new Telegraf(config.telegramToken);

bot.start((ctx) =>
  ctx.reply("✈️ Bot de bons plans billets d'avion prêt ! Tapez /help pour la liste des commandes.")
);

registerCommands(bot);
startScheduler(bot);

bot.launch();
console.log("Bot Telegram démarré.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
