import { readStore, writeStore } from "../store.js";
import { requireAdmin } from "./adminGuard.js";

export function registerRemoveRoute(bot) {
  bot.command("removeroute", (ctx) => {
    if (!requireAdmin(ctx)) return;
    const id = ctx.message.text.split(" ")[1];
    if (!id) {
      ctx.reply("Usage : /removeroute <id>");
      return;
    }

    const store = readStore();
    const before = store.routes.length;
    store.routes = store.routes.filter((r) => r.id !== id);
    writeStore(store);
    ctx.reply(before === store.routes.length ? "Aucune route avec cet id." : "✅ Route retirée.");
  });
}
