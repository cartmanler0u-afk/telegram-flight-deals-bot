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
      console.error(`Bot arrêté : TELEGRAM_BOT_TOKEN refusé par Telegram (${code}) — ${describeToken(config.telegramToken)}.`);
    } else {
      console.error(`Bot arrêté : connexion à Telegram impossible (${err?.message || err}).`);
    }
    process.exit(1);
  });

// Décrit ce qui cloche dans le token sans jamais l'afficher (ni même un morceau).
function describeToken(token) {
  if (/^\d+:[\w-]{30,}$/.test(token)) return "sa forme est correcte : il a sans doute été régénéré, recopiez le dernier donné par @BotFather";
  const issues = [`${token.length} caractères`];
  if (/https?:|t\.me\//i.test(token)) issues.push("on dirait un lien, pas un token");
  else if (/^@|bot$/i.test(token) && !token.includes(":")) issues.push("on dirait le nom du bot (@…_bot), pas son token");
  else if (!token.includes(":")) issues.push("il manque le « : »");
  if (/\s/.test(token)) issues.push("il contient un espace ou un retour à la ligne");
  if (token.includes(":") && !/^\d+:/.test(token) && !/https?:/i.test(token)) issues.push("il ne commence pas par des chiffres suivis de « : »");
  return `forme invalide (${issues.join(", ")}) : il doit ressembler à 123456789:AAH… (environ 46 caractères, sans espace)`;
}

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
