// Serveur HTTP de la mini app : fichiers statiques + API JSON authentifiée par Telegram.

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import express from "express";
import { validateInitData } from "./auth.js";
import { OfficeError, getDocument, toClientState, publicResult } from "../../webapp/shared/engine.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEBAPP_DIR = path.resolve(here, "../../webapp");
const THREE_DIR = path.dirname(path.dirname(createRequire(import.meta.url).resolve("three")));

export function createOfficeApp({ service, botToken, allowedUserIds = [], ai = { enabled: false }, sendDocument = null, logger = console }) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use(express.json({ limit: "1mb" }));

  // Authentification : chaque requête porte l'initData signé par Telegram.
  api.use(async (req, res, next) => {
    const header = req.get("authorization") || "";
    const initData = header.startsWith("tma ") ? header.slice(4) : null;
    const auth = validateInitData(initData, botToken);
    if (!auth) return res.status(401).json({ error: "Session Telegram invalide ou expirée : rouvre le QG depuis le bot." });
    const ownerId = String(auth.user.id);
    if (allowedUserIds.length > 0 && !allowedUserIds.includes(ownerId)) {
      return res.status(403).json({ error: "Ce QG est réservé aux administrateurs du bot." });
    }
    const tzOffset = Number(req.get("x-tz-offset"));
    req.office = await service.get(ownerId, { bossName: auth.user.first_name, tzOffset: Number.isFinite(tzOffset) ? tzOffset : 0 });
    req.ownerId = ownerId;
    req.me = { id: ownerId, name: auth.user.first_name || "Boss" };
    if (Number.isFinite(tzOffset) && req.office.runtime.state.settings.tzOffset !== tzOffset) {
      req.office.runtime.dispatch("settings.update", { tzOffset });
    }
    next();
  });

  const snapshot = (req) => ({
    rev: req.office.rev,
    serverNow: Date.now(),
    state: toClientState(req.office.runtime.state),
    ai,
    me: req.me,
    mode: "telegram",
    devTools: !!req.office.runtime.devTools,
  });

  api.get("/state", (req, res) => {
    if (Number(req.query.rev) === req.office.rev) {
      return res.json({ unchanged: true, rev: req.office.rev, serverNow: Date.now() });
    }
    res.json(snapshot(req));
  });

  api.post("/action", (req, res) => {
    const { type, payload } = req.body || {};
    if (typeof type !== "string") throw new OfficeError("Action manquante.");
    const result = req.office.runtime.dispatch(type, payload && typeof payload === "object" ? payload : {});
    res.json({ ok: true, result: publicResult(result), ...snapshot(req) });
  });

  api.post("/query", async (req, res) => {
    const { type, payload } = req.body || {};
    const result = await req.office.runtime.query(String(type || ""), payload || {});
    res.json({ ok: true, result });
  });

  api.get("/documents/:id", (req, res) => {
    res.json({ document: getDocument(req.office.runtime.state, req.params.id) });
  });

  api.post("/documents/:id/send", async (req, res) => {
    if (!sendDocument) throw new OfficeError("L'envoi vers Telegram n'est pas disponible.");
    const doc = getDocument(req.office.runtime.state, req.params.id);
    await sendDocument(req.ownerId, doc);
    res.json({ ok: true });
  });

  api.use((err, req, res, next) => {
    if (err instanceof OfficeError) return res.status(400).json({ error: err.message });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "Contenu trop volumineux (1 Mo max)." });
    logger.error("API QG :", err);
    res.status(500).json({ error: "Erreur interne du QG." });
  });

  app.use("/api", api);
  app.use("/vendor/three/build", express.static(path.join(THREE_DIR, "build")));
  app.use("/vendor/three/examples/jsm", express.static(path.join(THREE_DIR, "examples/jsm")));
  app.use(express.static(WEBAPP_DIR));
  return app;
}
