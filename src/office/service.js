// Gère les QG de tous les utilisateurs : chargement, horloge, sauvegarde, notifications.
//
// Le Bâtiment 0 (state.world) est persisté à part quand le dépôt le permet (table madhouse_world) :
//  - le QG est sauvegardé sans le monde (bien plus léger, sauvegardé souvent) ;
//  - le monde n'est réécrit que lorsque sa révision change, au plus toutes les WORLD_SAVE_MS ;
//  - un bail empêche deux instances du serveur de simuler le même monde en même temps ;
//  - un monde plus avancé en base n'est jamais écrasé par un monde plus ancien.
// Sans la table (ancien schéma), tout reste dans office_state comme avant.

import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { addDeals, createInitialState, migrateState } from "../../webapp/shared/engine.js";
import { OfficeRuntime } from "../../webapp/shared/runtime.js";
import { createTemplateGenerator } from "../../webapp/shared/templates.js";
import { ensureWorld } from "../../webapp/shared/world/index.js";

const SAVE_DELAY_MS = 1500;
const TICK_MS = 3000;
const WORLD_SAVE_MS = 15000;
const LEASE_MS = 120000;
const LEASE_RENEW_MS = 30000;
// Table absente (ancien schéma) : on bascule sur l'ancien stockage ; toute autre erreur est passagère.
const missingTable = (err) => /does not exist|could not find the table|schema cache|42P01|PGRST205/i.test(`${err?.code || ""} ${err?.message || ""}`);

export class OfficeService {
  constructor({ repository, generator = null, notify = async () => {}, logger = console, worldAi = { available: false, cap: 0 }, devTools = false, holder = null, timing = {} }) {
    this.devTools = devTools;
    this.repository = repository;
    this.generator = generator;
    this.worldAi = worldAi;
    this.notify = notify;
    this.logger = logger;
    this.offices = new Map(); // ownerId -> { runtime, rev, worldSavedRev, worldSavedAt }
    this.loading = new Map();
    this.saveTimers = new Map();
    this.lastSaveError = 0;
    this.timing = { worldSaveMs: WORLD_SAVE_MS, leaseMs: LEASE_MS, leaseRenewMs: LEASE_RENEW_MS, ...timing };
    // Identifiant de cette instance pour le bail (caractères sûrs pour les filtres PostgREST).
    this.holder = holder || `${hostname().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24) || "bot"}-${process.pid}-${randomUUID().slice(0, 8)}`;
    this.splitWorld = ["loadWorld", "saveWorld", "acquireWorldLease"].every((fn) => typeof repository[fn] === "function");
  }

  async start() {
    try {
      const rows = await this.repository.loadAll();
      for (const row of rows) {
        const { state, worldActive, worldInTable } = await this.hydrate(row.ownerId, row.state);
        this.mount(row.ownerId, state, { worldActive, worldInTable });
      }
      this.logger.log(`QG : ${rows.length} bureau(x) chargé(s).`);
    } catch (err) {
      this.logger.error(
        `QG : impossible de charger les bureaux (${err.message}). Avez-vous exécuté la dernière version de schema.sql dans Supabase ?`
      );
    }
    this.timer = setInterval(() => this.tickAll(), TICK_MS);
    this.timer.unref?.();
    this.leaseTimer = setInterval(() => this.renewLeases().catch((err) => this.logger.error("QG : bail du Bâtiment :", err.message)), this.timing.leaseRenewMs);
    this.leaseTimer.unref?.();
  }

  async stop() {
    clearInterval(this.timer);
    clearInterval(this.leaseTimer);
    await this.flush({ force: true });
    if (!this.splitWorld) return;
    for (const [ownerId, office] of this.offices) {
      clearTimeout(office.worldRetry);
      if (!office.runtime.worldActive) continue;
      await this.repository.releaseWorldLease?.(ownerId, this.holder).catch(() => {});
    }
  }

  // Assemble l'état sauvegardé : QG (office_state) + monde (madhouse_world, s'il est plus avancé)
  // et prend le bail de simulation du monde.
  async hydrate(ownerId, saved, { bossName, tzOffset } = {}) {
    let raw = saved;
    let worldUnknown = false;
    let worldInTable = false;
    if (this.splitWorld) {
      try {
        const row = await this.repository.loadWorld(ownerId);
        if (row?.world) {
          if (!raw) raw = { ...createInitialState(Date.now(), { bossName, tzOffset }), world: row.world };
          else if (!raw.world || (row.world.cycle || 0) >= (raw.world.cycle || 0)) raw = { ...raw, world: row.world };
          worldInTable = raw.world === row.world;
        }
      } catch (err) {
        if (missingTable(err)) this.disableSplit(err);
        else {
          // Lecture ratée : on ne simule pas un monde incertain ; le bail le rechargera plus tard.
          worldUnknown = true;
          this.logger.error(`QG ${ownerId} : lecture du Bâtiment 0 impossible (${err.message}) — nouvel essai sous peu.`);
        }
      }
    }
    const state = raw ? migrateState(raw) : createInitialState(Date.now(), { bossName, tzOffset });
    const worldActive = worldUnknown ? false : await this.acquireLease(ownerId);
    return { state, worldActive, worldInTable, fresh: !saved };
  }

  // Ancien schéma (pas de table madhouse_world) : on garde tout dans office_state.
  disableSplit(err) {
    if (!this.splitWorld) return;
    this.splitWorld = false;
    this.logger.error(`QG : table madhouse_world indisponible (${err.message}) — le Bâtiment 0 reste sauvegardé dans office_state. Exécutez schema.sql pour l'activer.`);
  }

  async acquireLease(ownerId) {
    if (!this.splitWorld) return true;
    try {
      const ok = await this.repository.acquireWorldLease(ownerId, this.holder, this.timing.leaseMs);
      if (!ok) this.logger.log(`QG ${ownerId} : le Bâtiment 0 est simulé par une autre instance ; lecture seule ici.`);
      return ok;
    } catch (err) {
      if (missingTable(err)) {
        this.disableSplit(err);
        return true;
      }
      this.logger.error(`QG ${ownerId} : bail du Bâtiment 0 indisponible (${err.message}) — nouvel essai sous peu.`);
      return false;
    }
  }

  // Renouvelle les baux détenus ; reprend la main (en rechargeant le monde) quand un bail se libère.
  async renewLeases() {
    if (!this.splitWorld || this.renewing) return;
    this.renewing = true;
    try {
      for (const [ownerId, office] of this.offices) {
        const runtime = office.runtime;
        const ok = await this.repository.acquireWorldLease(ownerId, this.holder, this.timing.leaseMs);
        if (ok && !runtime.worldActive) {
          const row = await this.repository.loadWorld(ownerId);
          if (row?.world && (row.world.cycle || 0) >= (runtime.state.world?.cycle || 0)) {
            runtime.state.world = row.world;
            ensureWorld(runtime.state, Date.now());
            office.worldInTable = true;
          }
          office.worldSavedRev = runtime.state.world?.rev;
          runtime.worldActive = true;
          this.logger.log(`QG ${ownerId} : bail du Bâtiment 0 repris par cette instance.`);
          runtime.tick();
        } else if (!ok && runtime.worldActive) {
          runtime.worldActive = false;
          this.logger.error(`QG ${ownerId} : bail du Bâtiment 0 perdu — la simulation continue sur une autre instance.`);
        }
      }
    } finally {
      this.renewing = false;
    }
  }

  mount(ownerId, state, { worldActive = true, worldInTable = false } = {}) {
    // L'IA narrative du Bâtiment dépend de l'opérateur (clé API, WORLD_AI, plafond quotidien),
    // jamais d'un réglage en jeu : le plafond s'impose à tout réglage enregistré.
    if (state.world?.config?.ai) {
      state.world.config.ai.available = !!(this.worldAi.available && this.generator?.ai);
      state.world.config.ai.cap = this.worldAi.cap;
      state.world.config.ai.dailyCalls = Math.min(state.world.config.ai.dailyCalls, this.worldAi.cap);
    }
    // worldInTable : le monde courant est déjà dans madhouse_world. Tant que ce n'est pas le cas
    // (première sauvegarde après mise à jour), office_state garde sa copie : jamais de monde perdu.
    const office = { runtime: null, rev: 1, worldSavedRev: null, worldSavedAt: 0, worldInTable };
    office.runtime = new OfficeRuntime({
      state,
      generator: this.generator,
      fallback: createTemplateGenerator({ latencyMs: 0 }),
      onChange: () => {
        office.rev += 1;
        this.scheduleSave(ownerId);
      },
      onNotify: (notes) => this.notify(ownerId, notes, office.runtime.state).catch((err) => this.logger.error("QG : notification impossible :", err.message)),
      onError: (err) => this.logger.error(`QG ${ownerId} :`, err?.message || err),
      devTools: this.devTools,
      worldActive,
    });
    this.offices.set(ownerId, office);
    return office;
  }

  async get(ownerId, { bossName, tzOffset } = {}) {
    if (this.offices.has(ownerId)) return this.offices.get(ownerId);
    if (!this.loading.has(ownerId)) {
      this.loading.set(ownerId, (async () => {
        let saved = null;
        try {
          saved = await this.repository.load(ownerId);
        } catch (err) {
          this.logger.error(`QG : lecture impossible pour ${ownerId} (${err.message}).`);
        }
        const { state, worldActive, worldInTable, fresh } = await this.hydrate(ownerId, saved, { bossName, tzOffset });
        const office = this.mount(ownerId, state, { worldActive, worldInTable });
        if (fresh) this.scheduleSave(ownerId);
        office.runtime.tick();
        return office;
      })().finally(() => this.loading.delete(ownerId)));
    }
    return this.loading.get(ownerId);
  }

  // Bons plans trouvés par le bot de vols : remis au dénicheur spécialisé de chaque QG.
  broadcastDeals(deals) {
    const items = deals.map((d) => ({ title: d.title, link: d.link, summary: d.summary, source: d.source, category: "vol" }));
    for (const office of this.offices.values()) {
      office.runtime.apply((state, now) => {
        const hunter = state.agents.find((a) => a.role === "dealhunter" && /vol|voyage/i.test(a.specialty || "")) || state.agents.find((a) => a.role === "dealhunter");
        return addDeals(state, items, now, hunter?.id);
      });
    }
  }

  tickAll() {
    for (const office of this.offices.values()) {
      try {
        office.runtime.tick();
      } catch (err) {
        this.logger.error("QG : erreur d'horloge :", err.message);
      }
    }
  }

  scheduleSave(ownerId) {
    if (this.saveTimers.has(ownerId)) return;
    this.saveTimers.set(ownerId, setTimeout(() => this.save(ownerId), SAVE_DELAY_MS));
  }

  async save(ownerId, { force = false } = {}) {
    clearTimeout(this.saveTimers.get(ownerId));
    this.saveTimers.delete(ownerId);
    const office = this.offices.get(ownerId);
    if (!office) return;
    const state = office.runtime.state;
    try {
      if (!this.splitWorld) {
        await this.repository.save(ownerId, state);
        return;
      }
      // Le monde d'abord : le QG n'est allégé qu'une fois le monde réellement en base.
      await this.saveWorld(ownerId, office, state.world, { force });
      const light = { ...state };
      delete light.world;
      await this.repository.save(ownerId, office.worldInTable ? light : state);
    } catch (err) {
      // On ne spamme pas les logs si la table n'existe pas encore.
      if (Date.now() - this.lastSaveError > 60000) {
        this.lastSaveError = Date.now();
        this.logger.error(`QG : sauvegarde impossible (${err.message}). Vérifiez les tables office_state et madhouse_world (schema.sql).`);
      }
    }
  }

  async saveWorld(ownerId, office, world, { force = false } = {}) {
    if (!world || !office.runtime.worldActive || world.rev === office.worldSavedRev) return;
    const wait = office.worldSavedAt + this.timing.worldSaveMs - Date.now();
    if (!force && wait > 0) {
      // Trop tôt : on repassera (le QG, lui, est déjà sauvegardé).
      office.worldRetry ||= setTimeout(() => {
        office.worldRetry = null;
        this.save(ownerId);
      }, wait);
      office.worldRetry.unref?.();
      return;
    }
    const rev = world.rev;
    const res = await this.repository.saveWorld(ownerId, world, { holder: this.holder });
    if (res.ok) {
      office.worldSavedRev = rev;
      office.worldSavedAt = Date.now();
      office.worldInTable = true;
      return;
    }
    // Monde plus avancé en base, ou bail tenu ailleurs : on arrête de simuler ici plutôt que d'écraser.
    office.runtime.worldActive = false;
    this.logger.error(`QG ${ownerId} : sauvegarde du Bâtiment 0 refusée (${res.reason}) — simulation suspendue sur cette instance.`);
  }

  async flush({ force = false } = {}) {
    const owners = force ? [...this.offices.keys()] : [...this.saveTimers.keys()];
    await Promise.all(owners.map((ownerId) => this.save(ownerId, { force })));
  }
}
