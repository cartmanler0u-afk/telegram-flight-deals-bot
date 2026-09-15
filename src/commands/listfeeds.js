import { listFeeds } from "../store.js";

export function registerListFeeds(bot) {
  bot.command("listfeeds", async (ctx) => {
    const feeds = await listFeeds();
    if (feeds.length === 0) {
      ctx.reply("Aucun flux RSS configuré. Utilisez /addfeed <url>.");
      return;
    }
    ctx.reply(`📡 Flux configurés :\n${feeds.map((f, i) => `${i + 1}. ${f}`).join("\n")}`);
  });
}
