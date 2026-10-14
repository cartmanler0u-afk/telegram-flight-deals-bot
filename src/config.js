import "dotenv/config";

export const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  defaultChannelId: process.env.TELEGRAM_CHANNEL_ID || null,
  adminIds: (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  kiwiApiKey: process.env.KIWI_API_KEY || null,
  checkIntervalMinutes: Number(process.env.CHECK_INTERVAL_MINUTES || 30),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SECRET_KEY,
  // QG des agents IA (mini app Telegram)
  webappUrl: process.env.WEBAPP_URL || null,
  port: Number(process.env.PORT || 3000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  anthropicEffort: process.env.ANTHROPIC_EFFORT || "medium",
  officeNotifications: process.env.OFFICE_NOTIFICATIONS !== "false",
};

if (!config.telegramToken) {
  throw new Error("TELEGRAM_BOT_TOKEN manquant : copiez .env.example vers .env et renseignez-le.");
}

if (!config.supabaseUrl || !config.supabaseKey) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SECRET_KEY manquants : copiez .env.example vers .env et renseignez-les."
  );
}

if (config.webappUrl && !/^https:\/\//i.test(config.webappUrl)) {
  throw new Error("WEBAPP_URL doit être une adresse https:// (exigence de Telegram pour les mini apps).");
}
