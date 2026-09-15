import { readStore } from "../store.js";

export function registerListRoutes(bot) {
  bot.command("listroutes", (ctx) => {
    const { routes } = readStore();
    if (routes.length === 0) {
      ctx.reply("Aucune route surveillée. Utilisez /addroute.");
      return;
    }
    ctx.reply(
      routes.map((r) => `\`${r.id}\` — ${r.from} → ${r.to}, max ${r.maxPrice} ${r.currency}`).join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
