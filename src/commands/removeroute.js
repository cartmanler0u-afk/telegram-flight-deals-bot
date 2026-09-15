import { removeRoute } from "../store.js";
import { requireAdmin } from "./adminGuard.js";

export function registerRemoveRoute(bot) {
  bot.command("removeroute", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const id = ctx.message.text.split(" ")[1];
    if (!id) {
      ctx.reply("Usage : /removeroute <id>");
      return;
    }

    const removed = await removeRoute(id);
    ctx.reply(removed ? "✅ Route retirée." : "Aucune route avec cet id.");
  });
}
