import { readStore, writeStore } from "../store.js";
import { requireAdmin } from "./adminGuard.js";

export function registerAddFeed(bot) {
  bot.command("addfeed", (ctx) => {
    if (!requireAdmin(ctx)) return;
    const url = ctx.message.text.split(" ").slice(1).join(" ").trim();
    if (!url) {
      ctx.reply("Usage : /addfeed <url_du_flux_rss>");
      return;
    }

    const store = readStore();
    if (store.feeds.includes(url)) {
      ctx.reply("Ce flux est déjà configuré.");
      return;
    }

    store.feeds.push(url);
    writeStore(store);
    ctx.reply(`✅ Flux ajouté :\n${url}`);
  });
}
