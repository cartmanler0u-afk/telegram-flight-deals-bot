// Fait vivre un QG : applique les actions, fait avancer l'horloge et confie le
// travail au générateur (IA Claude côté serveur, modèles hors-ligne en démo).

import {
  advance,
  applyAction,
  attachBrief,
  attachMeetingSummary,
  attachTaskOutput,
  findAgent,
  findTask,
  pendingJobs,
} from "./engine.js";
import { createTemplateGenerator } from "./templates.js";
import { worldJobPacket, attachWorldNarration, worldView, personSheet, buildReport, exploreQuery } from "./world/index.js";

export class OfficeRuntime {
  constructor({
    state,
    generator,
    fallback = createTemplateGenerator({ latencyMs: 0 }),
    now = () => Date.now(),
    onChange = () => {},
    onNotify = () => {},
    onError = (err) => console.error(err),
    devTools = false,
    worldActive = true,
  }) {
    this.devTools = devTools;
    // false quand une autre instance du serveur détient le bail du Bâtiment 0 :
    // le QG continue de vivre, le monde reste consultable mais n'avance pas ici.
    this.worldActive = worldActive;
    this.state = state;
    this.fallback = fallback;
    this.generator = generator || fallback;
    this.now = now;
    this.onChange = onChange;
    this.onNotify = onNotify;
    this.onError = onError;
    this.inflight = new Set();
  }

  dispatch(type, payload) {
    const result = applyAction(this.state, type, payload || {}, this.now(), { devTools: this.devTools, worldActive: this.worldActive });
    this.onChange();
    this.tick();
    return result;
  }

  // Modification directe de l'état par le serveur (ex. bons plans reçus du bot de vols).
  apply(fn) {
    const result = fn(this.state, this.now());
    this.onChange();
    this.tick();
    return result;
  }

  tick() {
    const { notes, changed } = advance(this.state, this.now(), { world: this.worldActive });
    if (changed) this.onChange();
    if (notes.length) this.onNotify(notes);
    this.launchJobs();
  }

  launchJobs() {
    for (const job of pendingJobs(this.state)) {
      if (job.kind === "world" && !this.worldActive) continue;
      const key = `${job.kind}:${job.id}`;
      if (this.inflight.has(key)) continue;
      this.inflight.add(key);
      this.runJob(job)
        .catch((err) => {
          this.onError(err);
          this.failJob(job, err);
        })
        .finally(() => {
          this.inflight.delete(key);
          this.tick();
        });
    }
  }

  async runJob(job) {
    const now = this.now();
    if (job.kind === "task") {
      const task = findTask(this.state, job.id);
      if (!task) return;
      const agent = findAgent(this.state, task.agentId);
      const { result, meta } = await this.withFallback("runTask", { task: { ...task }, agent, state: this.state, now });
      if (attachTaskOutput(this.state, job.id, result, meta)) this.onChange();
    } else if (job.kind === "meeting") {
      const meeting = this.state.meetings.find((m) => m.id === job.id);
      if (!meeting) return;
      const { result, meta } = await this.withFallback("summarizeMeeting", { meeting: { ...meeting }, state: this.state, now });
      if (attachMeetingSummary(this.state, job.id, result, this.now(), meta)) {
        this.onChange();
        this.onNotify([{ kind: "meeting_summary", meetingId: job.id, text: `📝 Le compte rendu de « ${meeting.title} » est prêt.` }]);
      }
    } else if (job.kind === "brief") {
      const { result } = await this.withFallback("directorBrief", { state: this.state, now });
      if (attachBrief(this.state, result, this.now())) this.onChange();
    } else if (job.kind === "world") {
      // Récit IA d'un événement du Bâtiment : sortie non fiable, nettoyée et purement décorative.
      const packet = worldJobPacket(this.state.world, job.id);
      const { result, meta } = packet ? await this.withFallback("narrateWorld", { packet }) : { result: null, meta: { ai: false } };
      if (attachWorldNarration(this.state, job.id, result, meta, this.now())) this.onChange();
    }
  }

  // Dernier recours si même le générateur de secours échoue : on clôt le travail
  // proprement plutôt que de le relancer en boucle.
  failJob(job, err) {
    const message = `Le travail n'a pas pu aboutir (${err?.message || err}). Relance la demande.`;
    const now = this.now();
    if (job.kind === "task") attachTaskOutput(this.state, job.id, { kind: "report", content: message }, { error: message });
    else if (job.kind === "meeting") attachMeetingSummary(this.state, job.id, { summary: message }, now, { error: message });
    else if (job.kind === "brief") attachBrief(this.state, message, now);
    else if (job.kind === "world") attachWorldNarration(this.state, job.id, null, { error: message }, now);
    this.onChange();
  }

  // Questions ponctuelles (sans effet sur l'état), ex. analyser une demande de rendez-vous.
  async query(type, payload = {}) {
    if (type === "parseEvents") {
      const text = String(payload.text || "").slice(0, 500);
      const { result } = await this.withFallback("parseEvents", {
        text,
        now: this.now(),
        tzOffset: this.state.settings.tzOffset || 0,
        state: this.state,
      });
      return result;
    }
    // Lectures du Bâtiment 0 (servies à la demande : le monde complet n'est pas dans le polling).
    if (type === "world.view") return worldView(this.state.world, this.state);
    if (type === "world.explore") return exploreQuery(this.state, payload, this.now());
    if (type === "world.person") return personSheet(this.state.world, this.state, String(payload.id || ""));
    if (type === "world.report") return buildReport(this.state.world, { since: this.state.world.report.lastSeenAt, until: this.now() });
    throw new Error(`Requête inconnue : ${type}`);
  }

  async withFallback(method, args) {
    if (this.generator !== this.fallback) {
      try {
        const result = await this.generator[method](args);
        return { result, meta: { ai: !!this.generator.ai, model: this.generator.model || null } };
      } catch (err) {
        this.onError(err);
        const result = await this.fallback[method](args);
        return { result, meta: { ai: false, error: err?.message || String(err) } };
      }
    }
    return { result: await this.fallback[method](args), meta: { ai: false } };
  }
}
