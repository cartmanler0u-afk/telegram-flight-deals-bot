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

export class OfficeRuntime {
  constructor({
    state,
    generator,
    fallback = createTemplateGenerator({ latencyMs: 0 }),
    now = () => Date.now(),
    onChange = () => {},
    onNotify = () => {},
    onError = (err) => console.error(err),
  }) {
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
    const result = applyAction(this.state, type, payload || {}, this.now());
    this.onChange();
    this.tick();
    return result;
  }

  tick() {
    const { notes, changed } = advance(this.state, this.now());
    if (changed) this.onChange();
    if (notes.length) this.onNotify(notes);
    this.launchJobs();
  }

  launchJobs() {
    for (const job of pendingJobs(this.state)) {
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
