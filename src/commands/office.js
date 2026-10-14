import { Markup } from "telegraf";
import { config } from "../config.js";
import { isAdmin } from "./adminGuard.js";

export function registerOffice(bot) {
  const handler = async (ctx) => {
    if (!isAdmin(ctx)) {
      ctx.reply("⛔ Le QG est réservé aux administrateurs du bot.");
      return;
    }
    if (!config.webappUrl) {
      ctx.reply(
        "🏢 Le QG n'est pas encore publié : définissez WEBAPP_URL (adresse https publique de ce serveur) dans .env puis redémarrez le bot. Voir README → « QG des agents IA »."
      );
      return;
    }
    if (ctx.chat?.type !== "private") {
      const username = ctx.botInfo?.username;
      ctx.reply(
        "🏢 Le QG s'ouvre en message privé avec le bot.",
        username ? Markup.inlineKeyboard([Markup.button.url("Ouvrir la conversation", `https://t.me/${username}`)]) : {}
      );
      return;
    }
    ctx.reply(
      "🏢 Ton QG t'attend : directeur, managers, studio web, bibliothèque, secrétariat et salle de réunion.",
      Markup.inlineKeyboard([Markup.button.webApp("🏢 Ouvrir le QG", config.webappUrl)])
    );
  };
  bot.command("office", handler);
  bot.command("qg", handler);
}
