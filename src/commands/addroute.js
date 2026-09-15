import { addRoute } from "../store.js";
import { requireAdmin } from "./adminGuard.js";
import { config } from "../config.js";

export function registerAddRoute(bot) {
  bot.command("addroute", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    if (!config.kiwiApiKey) {
      ctx.reply("⚠️ KIWI_API_KEY n'est pas configurée — la surveillance de routes est désactivée.");
      return;
    }

    const [from, to, maxPrice, currency] = ctx.message.text.split(" ").slice(1);
    if (!from || !to || !maxPrice || Number.isNaN(Number(maxPrice))) {
      ctx.reply("Usage : /addroute <ORIGINE> <DESTINATION> <PRIX_MAX> [devise]");
      return;
    }

    const route = {
      id: `${from}-${to}-${Date.now()}`.toUpperCase(),
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      maxPrice: Number(maxPrice),
      currency: (currency || "EUR").toUpperCase(),
    };
    await addRoute(route);
    ctx.reply(
      `✅ Route surveillée : ${route.from} → ${route.to}, max ${route.maxPrice} ${route.currency} (id: \`${route.id}\`)`,
      { parse_mode: "Markdown" }
    );
  });
}
