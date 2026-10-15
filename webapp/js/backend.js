// Accès aux données du QG : API du bot (dans Telegram) ou simulation locale (mode démo).

import { OfficeRuntime } from "../shared/runtime.js";
import { createInitialState, migrateState, toClientState, getDocument, publicResult } from "../shared/engine.js";
import { createTemplateGenerator } from "../shared/templates.js";
import { tg } from "./ui/dom.js";

const POLL_MS = 2500;

class Emitter {
  constructor() {
    this.listeners = new Set();
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn(this.state);
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ----------------------------------------------------------------------------
// Mode Telegram : le serveur du bot fait autorité.

class RemoteBackend extends Emitter {
  constructor(initData) {
    super();
    this.mode = "telegram";
    this.initData = initData;
    this.rev = null;
    this.offset = 0;
    this.docCache = new Map();
  }

  now() {
    return Date.now() + this.offset;
  }

  async request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: {
        Authorization: `tma ${this.initData}`,
        "X-Tz-Offset": String(-new Date().getTimezoneOffset()),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      // réponse non JSON
    }
    if (!res.ok) throw new ApiError(data?.error || `Erreur ${res.status}`, res.status);
    return data;
  }

  absorb(data) {
    if (typeof data.serverNow === "number") this.offset = data.serverNow - Date.now();
    if (data.unchanged) return false;
    if (data.state) {
      this.state = data.state;
      this.rev = data.rev;
      this.ai = data.ai || this.ai;
      this.me = data.me || this.me;
      this.devTools = !!data.devTools;
      this.emit();
      return true;
    }
    return false;
  }

  async load() {
    this.absorb(await this.request("GET", "/api/state"));
  }

  async refresh() {
    this.absorb(await this.request("GET", `/api/state?rev=${this.rev ?? ""}`));
  }

  start() {
    const loop = async () => {
      if (!document.hidden) {
        try {
          await this.refresh();
          this.lastError = null;
        } catch (err) {
          if ((err.status === 401 || err.status === 403) && this.lastError?.status !== err.status) {
            window.dispatchEvent(new CustomEvent("qg:auth-error", { detail: err.message }));
          }
          this.lastError = err;
        }
      }
      this.timer = setTimeout(loop, POLL_MS);
    };
    this.timer = setTimeout(loop, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.refresh().catch(() => {});
    });
  }

  async action(type, payload = {}) {
    const data = await this.request("POST", "/api/action", { type, payload });
    this.absorb(data);
    return data.result;
  }

  async query(type, payload = {}) {
    return (await this.request("POST", "/api/query", { type, payload })).result;
  }

  async getDocument(id) {
    const meta = this.state.documents.find((d) => d.id === id);
    const cached = this.docCache.get(id);
    if (cached && meta && cached.size === meta.size) return cached;
    const { document } = await this.request("GET", `/api/documents/${encodeURIComponent(id)}`);
    this.docCache.set(id, document);
    return document;
  }

  async sendDocument(id) {
    await this.request("POST", `/api/documents/${encodeURIComponent(id)}/send`);
    return "telegram";
  }

  clearCache() {
    this.docCache.clear();
  }
}

// ----------------------------------------------------------------------------
// Mode démo : tout le QG tourne dans le navigateur (données dans ce navigateur).

const STORAGE_KEY = "qg-agents-ia-demo-v1";

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // stockage plein ou indisponible : la démo continue en mémoire
  }
}

class LocalBackend extends Emitter {
  constructor() {
    super();
    this.mode = "demo";
    this.devTools = true; // démo locale : bac à sable, le mode test du chaos est disponible
    this.ai = { enabled: false, model: null };
    this.me = { id: "demo", name: tg?.initDataUnsafe?.user?.first_name || "Boss" };
  }

  now() {
    return Date.now();
  }

  async load() {
    const tzOffset = -new Date().getTimezoneOffset();
    const saved = readStorage();
    const state = saved ? migrateState(saved) : createInitialState(Date.now(), { bossName: this.me.name, tzOffset });
    state.settings.tzOffset = tzOffset;
    let saveTimer = null;
    let emitQueued = false;
    this.runtime = new OfficeRuntime({
      devTools: true,
      state,
      generator: createTemplateGenerator({ latencyMs: 900 }),
      onChange: () => {
        if (!saveTimer) saveTimer = setTimeout(() => {
          saveTimer = null;
          writeStorage(this.runtime.state);
        }, 800);
        if (!emitQueued) {
          emitQueued = true;
          queueMicrotask(() => {
            emitQueued = false;
            this.state = toClientState(this.runtime.state);
            this.emit();
          });
        }
      },
    });
    this.state = toClientState(state);
    this.runtime.tick();
  }

  start() {
    setInterval(() => this.runtime.tick(), 1000);
  }

  async refresh() {}

  async action(type, payload = {}) {
    const result = this.runtime.dispatch(type, payload);
    this.state = toClientState(this.runtime.state);
    this.emit();
    return publicResult(result);
  }

  async query(type, payload = {}) {
    return this.runtime.query(type, payload);
  }

  async getDocument(id) {
    return { ...getDocument(this.runtime.state, id) };
  }

  async sendDocument(id) {
    const doc = getDocument(this.runtime.state, id);
    const isSite = doc.kind === "site";
    const blob = new Blob([doc.content || ""], { type: isSite ? "text/html" : "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-") || "document"}.${isSite ? "html" : "md"}`;
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    return "download";
  }

  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignoré
    }
    location.reload();
  }
}

export async function createBackend() {
  const initData = tg?.initData;
  if (initData) {
    const remote = new RemoteBackend(initData);
    await remote.load();
    return remote;
  }
  const local = new LocalBackend();
  await local.load();
  return local;
}
