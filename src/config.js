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
};

if (!config.telegramToken) {
  throw new Error("TELEGRAM_BOT_TOKEN manquant : copiez .env.example vers .env et renseignez-le.");
}

if (!config.supabaseUrl || !config.supabaseKey) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SECRET_KEY manquants : copiez .env.example vers .env et renseignez-les."
  );
}
