import { setChannelId } from "../store.js";
import { requireAdmin } from "./adminGuard.js";

export function registerSetChannel(bot) {
  bot.command("setchannel", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await setChannelId(ctx.chat.id);
    ctx.reply(`✅ Ce salon (\`${ctx.chat.id}\`) recevra désormais les drops de billets.`, {
      parse_mode: "Markdown",
    });
  });
}
