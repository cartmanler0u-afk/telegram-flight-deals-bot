import { readStore, writeStore } from "../store.js";
import { requireAdmin } from "./adminGuard.js";

export function registerSetChannel(bot) {
  bot.command("setchannel", (ctx) => {
    if (!requireAdmin(ctx)) return;
    const store = readStore();
    store.channelId = ctx.chat.id;
    writeStore(store);
    ctx.reply(`✅ Ce salon (\`${ctx.chat.id}\`) recevra désormais les drops de billets.`, {
      parse_mode: "Markdown",
    });
  });
}
