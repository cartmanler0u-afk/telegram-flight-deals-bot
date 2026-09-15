import { requireAdmin } from "./adminGuard.js";
import { runDropCycle } from "../scheduler.js";

export function registerTestDrop(bot) {
  bot.command("testdrop", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.reply("🔎 Recherche en cours...");
    await runDropCycle(bot);
    await ctx.reply("✅ Cycle terminé.");
  });
}
