// Démarre le QG des agents IA : serveur de la mini app + horloge + notifications Telegram.

import { Markup } from "telegraf";
import { config } from "../config.js";
import { supabase } from "../database/supabase.js";
import { formatLocal } from "../../webapp/shared/dates.js";
import { createClaudeGenerator } from "./claude.js";
import { createSupabaseRepository } from "./repository.js";
import { createOfficeApp } from "./server.js";
import { OfficeService } from "./service.js";
import { setDealSink } from "./bridge.js";

const NOTIFIED_KINDS = new Set(["reminder", "needs_approval", "meeting_started", "meeting_summary", "task_done"]);

function openButton() {
  return config.webappUrl ? Markup.inlineKeyboard([Markup.button.webApp("🏢 Ouvrir le QG", config.webappUrl)]) : {};
}

function notificationText(note, state) {
  const tz = state.settings.tzOffset || 0;
  if (note.kind === "reminder") {
    const ev = state.events.find((e) => e.id === note.eventId);
    return ev ? `⏰ Rappel : « ${ev.title} » à ${formatLocal(ev.start, tz, { withDay: false })}` : note.text;
  }
  return note.text;
}

export async function startOffice(bot) {
  const ai = config.anthropicApiKey
    ? { enabled: true, model: config.anthropicModel }
    : { enabled: false, model: null };
  const generator = ai.enabled
    ? createClaudeGenerator({ apiKey: config.anthropicApiKey, model: config.anthropicModel, effort: config.anthropicEffort, webSearch: config.anthropicWebSearch })
    : null;

  const service = new OfficeService({
    repository: createSupabaseRepository(supabase),
    generator,
    notify: async (ownerId, notes, state) => {
      if (!config.officeNotifications) return;
      const lines = notes.filter((n) => NOTIFIED_KINDS.has(n.kind)).map((n) => notificationText(n, state));
      if (lines.length === 0) return;
      await bot.telegram.sendMessage(ownerId, lines.join("\n"), openButton());
    },
  });
  await service.start();
  setDealSink((deals) => service.broadcastDeals(deals));

  const app = createOfficeApp({
    service,
    botToken: config.telegramToken,
    allowedUserIds: config.adminIds,
    ai,
    sendDocument: async (ownerId, doc) => {
      if (doc.kind === "link" && doc.url) {
        await bot.telegram.sendMessage(ownerId, `🔗 ${doc.title}\n${doc.url}`);
        return;
      }
      const ext = doc.kind === "site" ? "html" : "md";
      const filename = `${doc.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document"}.${ext}`;
      await bot.telegram.sendDocument(
        ownerId,
        { source: Buffer.from(doc.content || "", "utf8"), filename },
        { caption: `📚 ${doc.title}` }
      );
    },
  });

  const server = app.listen(config.port, () => {
    console.log(`QG des agents IA servi sur le port ${config.port}${ai.enabled ? ` (IA : ${ai.model})` : " (mode modèles, sans IA)"}.`);
  });
  server.on("error", (err) => {
    console.error(`Serveur du QG indisponible sur le port ${config.port} : ${err.message}. Le bot continue sans la mini app.`);
  });

  if (config.webappUrl) {
    try {
      await bot.telegram.setChatMenuButton({
        menuButton: { type: "web_app", text: "🏢 QG", web_app: { url: config.webappUrl } },
      });
    } catch (err) {
      console.error("Impossible de configurer le bouton menu du QG :", err.message);
    }
  } else {
    console.log("WEBAPP_URL non défini : la commande /office expliquera comment publier la mini app.");
  }

  return {
    async stop() {
      server.close();
      await service.stop();
    },
  };
}
