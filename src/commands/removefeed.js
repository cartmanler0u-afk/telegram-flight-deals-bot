import { readStore, writeStore } from "../store.js";
import { requireAdmin } from "./adminGuard.js";

export function registerRemoveFeed(bot) {
  bot.command("removefeed", (ctx) => {
    if (!requireAdmin(ctx)) return;
    const url = ctx.message.text.split(" ").slice(1).join(" ").trim();
    if (!url) {
      ctx.reply("Usage : /removefeed <url>");
      return;
    }

    const store = readStore();
    const before = store.feeds.length;
    store.feeds = store.feeds.filter((f) => f !== url);
    writeStore(store);
    ctx.reply(before === store.feeds.length ? "Ce flux n'était pas configuré." : "✅ Flux retiré.");
  });
}
