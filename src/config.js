import "dotenv/config";

// Valeurs souvent collées depuis un téléphone : espaces, retours à la ligne ou guillemets en trop.
function clean(value) {
  const v = (value ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return v || undefined;
}

// supabase-js attend l'adresse du projet seule (https://xxxx.supabase.co) : une adresse copiée avec
// /rest/v1 ou un autre chemin donne « Invalid path specified in request URL ».
function projectUrl(value) {
  const v = clean(value);
  try {
    const url = new URL(v);
    if (url.hostname.endsWith(".supabase.co") && url.pathname !== "/") {
      console.warn(`SUPABASE_URL contenait un chemin en trop (${url.pathname}) : seule l'adresse ${url.origin} est utilisée.`);
      return url.origin;
    }
  } catch {
    // Adresse invalide : supabase-js l'expliquera.
  }
  return v;
}

export const config = {
  // Le token sert tel quel dans l'URL de l'API : un préfixe « bot » recopié en trop la casse.
  telegramToken: clean(process.env.TELEGRAM_BOT_TOKEN)?.replace(/^bot(?=\d+:)/i, ""),
  defaultChannelId: process.env.TELEGRAM_CHANNEL_ID || null,
  adminIds: (clean(process.env.ADMIN_USER_IDS) || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  kiwiApiKey: process.env.KIWI_API_KEY || null,
  checkIntervalMinutes: Number(process.env.CHECK_INTERVAL_MINUTES || 30),
  supabaseUrl: projectUrl(process.env.SUPABASE_URL),
  supabaseKey: clean(process.env.SUPABASE_SECRET_KEY),
  // QG des agents IA (mini app Telegram)
  webappUrl: clean(process.env.WEBAPP_URL) || null,
  port: Number(process.env.PORT || 3000),
  anthropicApiKey: clean(process.env.ANTHROPIC_API_KEY) || null,
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  anthropicEffort: process.env.ANTHROPIC_EFFORT || "medium",
  anthropicWebSearch: process.env.ANTHROPIC_WEB_SEARCH !== "false",
  officeNotifications: process.env.OFFICE_NOTIFICATIONS !== "false",
  // Bâtiment 0 (THE MADHOUSE) : simulation autonome, notifications, IA narrative budgétée
  worldNotifications: process.env.WORLD_NOTIFICATIONS !== "false",
  worldAi: process.env.WORLD_AI !== "false",
  worldAiDailyCalls: Math.max(0, Math.min(200, Number(process.env.WORLD_AI_DAILY_CALLS ?? 6) || 0)),
  // Mode test du chaos (simuler du temps, déclencher des événements) : administrateurs + ce drapeau.
  worldDevTools: process.env.WORLD_DEV_TOOLS === "true",
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
