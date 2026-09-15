import { addFeed, listFeeds } from "../store.js";
import { requireAdmin } from "./adminGuard.js";

export function registerAddFeed(bot) {
  bot.command("addfeed", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const url = ctx.message.text.split(" ").slice(1).join(" ").trim();
    if (!url) {
      ctx.reply("Usage : /addfeed <url_du_flux_rss>");
      return;
    }

    const existing = await listFeeds();
    if (existing.includes(url)) {
      ctx.reply("Ce flux est déjà configuré.");
      return;
    }

    const ok = await addFeed(url);
    ctx.reply(ok ? `✅ Flux ajouté :\n${url}` : "⚠️ Erreur lors de l'ajout du flux.");
  });
}
