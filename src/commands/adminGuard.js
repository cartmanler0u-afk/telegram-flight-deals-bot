import { config } from "../config.js";

export function isAdmin(ctx) {
  if (config.adminIds.length === 0) return true;
  return config.adminIds.includes(String(ctx.from?.id));
}

export function requireAdmin(ctx) {
  if (!isAdmin(ctx)) {
    ctx.reply("⛔ Cette commande est réservée aux administrateurs du bot.");
    return false;
  }
  return true;
}
