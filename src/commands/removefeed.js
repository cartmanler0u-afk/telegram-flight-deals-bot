import { removeFeed } from "../store.js";
import { requireAdmin } from "./adminGuard.js";

export function registerRemoveFeed(bot) {
  bot.command("removefeed", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const url = ctx.message.text.split(" ").slice(1).join(" ").trim();
    if (!url) {
      ctx.reply("Usage : /removefeed <url>");
      return;
    }

    const removed = await removeFeed(url);
    ctx.reply(removed ? "✅ Flux retiré." : "Ce flux n'était pas configuré.");
  });
}
