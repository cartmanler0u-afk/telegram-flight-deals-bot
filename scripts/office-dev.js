// Lance uniquement la mini app du QG en local (sans Telegram ni Supabase) :
//   npm run office:dev
// Ouvre http://localhost:3000 dans un navigateur : le QG démarre en mode démo.
// Pour tester l'API comme dans Telegram, l'URL "test API" affichée contient un initData signé.

import "dotenv/config";
import { createOfficeApp } from "../src/office/server.js";
import { OfficeService } from "../src/office/service.js";
import { createMemoryRepository } from "../src/office/repository.js";
import { createClaudeGenerator } from "../src/office/claude.js";
import { signInitData } from "../src/office/auth.js";

const port = Number(process.env.PORT || 3000);
const botToken = "dev:local-token";
const apiKey = process.env.ANTHROPIC_API_KEY || null;
const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const ai = apiKey ? { enabled: true, model } : { enabled: false, model: null };

const service = new OfficeService({
  repository: createMemoryRepository(),
  generator: apiKey ? createClaudeGenerator({ apiKey, model, effort: process.env.ANTHROPIC_EFFORT || "medium" }) : null,
  notify: async (ownerId, notes) => console.log(`[notification → ${ownerId}]`, notes.map((n) => n.text).join(" | ")),
});
await service.start();

const app = createOfficeApp({ service, botToken, ai, sendDocument: async (ownerId, doc) => console.log(`[envoi Telegram simulé → ${ownerId}] ${doc.title}`) });
app.listen(port, () => {
  const initData = signInitData(
    { user: JSON.stringify({ id: 42, first_name: "Boss" }), auth_date: String(Math.floor(Date.now() / 1000)) },
    botToken
  );
  console.log(`QG en local : http://localhost:${port}  (mode démo dans un navigateur classique)`);
  console.log(`IA : ${ai.enabled ? model : "désactivée (ANTHROPIC_API_KEY absente)"}`);
  console.log(`initData de test (en-tête Authorization: tma …) :\n${initData}`);
});
