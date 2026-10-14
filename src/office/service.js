// Gère les QG de tous les utilisateurs : chargement, horloge, sauvegarde, notifications.

import { createInitialState, migrateState } from "../../webapp/shared/engine.js";
import { OfficeRuntime } from "../../webapp/shared/runtime.js";
import { createTemplateGenerator } from "../../webapp/shared/templates.js";

const SAVE_DELAY_MS = 1500;
const TICK_MS = 3000;

export class OfficeService {
  constructor({ repository, generator = null, notify = async () => {}, logger = console }) {
    this.repository = repository;
    this.generator = generator;
    this.notify = notify;
    this.logger = logger;
    this.offices = new Map(); // ownerId -> { runtime, rev }
    this.loading = new Map();
    this.saveTimers = new Map();
    this.lastSaveError = 0;
  }

  async start() {
    try {
      const rows = await this.repository.loadAll();
      for (const row of rows) this.mount(row.ownerId, migrateState(row.state));
      this.logger.log(`QG : ${rows.length} bureau(x) chargé(s).`);
    } catch (err) {
      this.logger.error(
        `QG : impossible de charger les bureaux (${err.message}). Avez-vous exécuté la dernière version de schema.sql dans Supabase ?`
      );
    }
    this.timer = setInterval(() => this.tickAll(), TICK_MS);
    this.timer.unref?.();
  }

  async stop() {
    clearInterval(this.timer);
    await this.flush();
  }

  mount(ownerId, state) {
    const office = { runtime: null, rev: 1 };
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
        const office = this.mount(ownerId, saved ? migrateState(saved) : createInitialState(Date.now(), { bossName, tzOffset }));
        if (!saved) this.scheduleSave(ownerId);
        office.runtime.tick();
        return office;
      })().finally(() => this.loading.delete(ownerId)));
    }
    return this.loading.get(ownerId);
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

  async save(ownerId) {
    clearTimeout(this.saveTimers.get(ownerId));
    this.saveTimers.delete(ownerId);
    const office = this.offices.get(ownerId);
    if (!office) return;
    try {
      await this.repository.save(ownerId, office.runtime.state);
    } catch (err) {
      // On ne spamme pas les logs si la table n'existe pas encore.
      if (Date.now() - this.lastSaveError > 60000) {
        this.lastSaveError = Date.now();
        this.logger.error(`QG : sauvegarde impossible (${err.message}). Vérifiez la table office_state (schema.sql).`);
      }
    }
  }

  async flush() {
    await Promise.all([...this.saveTimers.keys()].map((ownerId) => this.save(ownerId)));
  }
}
