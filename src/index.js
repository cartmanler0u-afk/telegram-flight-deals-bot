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

bot
  .launch(() => console.log(`Bot Telegram démarré (@${bot.botInfo.username}, Node ${process.version}).`))
  .catch((err) => {
    const code = err?.response?.error_code ?? err?.code;
    if (code === 409) {
      console.error("Bot arrêté : ce token est déjà utilisé par un autre programme (409 Conflict). Arrêtez l'autre copie du bot.");
    } else if (code === 401 || code === 404) {
      console.error("Bot arrêté : TELEGRAM_BOT_TOKEN refusé par Telegram. Vérifiez la variable.");
    } else {
      console.error(`Bot arrêté : connexion à Telegram impossible (${err?.message || err}).`);
    }
    process.exit(1);
  });

async function shutdown(signal) {
  console.log(`Arrêt demandé par la plateforme (${signal}).`);
  try {
    bot.stop(signal);
  } catch {
    // Le bot n'avait pas encore démarré.
  }
  await office.stop();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
