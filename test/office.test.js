// Tests du QG des agents IA : `npm test` (node:test, sans dépendance).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  applyAction,
  createInitialState,
  routeTask,
  pendingJobs,
  attachTaskOutput,
  toClientState,
  OfficeError,
} from "../webapp/shared/engine.js";
import { OfficeRuntime } from "../webapp/shared/runtime.js";
import { createTemplateGenerator } from "../webapp/shared/templates.js";
import { parseFrenchEvent, formatLocal } from "../webapp/shared/dates.js";
import { signInitData, validateInitData } from "../src/office/auth.js";
import { createOfficeApp } from "../src/office/server.js";
import { OfficeService } from "../src/office/service.js";
import { createMemoryRepository } from "../src/office/repository.js";
import { createClaudeGenerator } from "../src/office/claude.js";

const T0 = Date.UTC(2026, 9, 14, 12, 0); // mercredi 14 octobre 2026, 14:00 à Paris
const PARIS = 120;
const flush = () => new Promise((r) => setTimeout(r, 20));

function freshRuntime(generator = createTemplateGenerator({ latencyMs: 0 })) {
  let now = T0;
  const notes = [];
  const state = createInitialState(now, { bossName: "Cartman", tzOffset: PARIS });
  const runtime = new OfficeRuntime({ state, generator, now: () => now, onNotify: (n) => notes.push(...n), onError: () => {} });
  return { runtime, state, notes, advanceBy: (ms) => { now += ms; runtime.tick(); }, now: () => now };
}

// ---------------------------------------------------------------- moteur

test("l'équipe de départ est complète et hiérarchisée", () => {
  const state = createInitialState(T0);
  const byId = Object.fromEntries(state.agents.map((a) => [a.id, a]));
  assert.equal(state.agents.length, 7);
  assert.equal(byId.webdev.managerId, "mgr-prod");
  assert.equal(byId.librarian.managerId, "mgr-orga");
  assert.equal(byId["mgr-prod"].managerId, "director");
  assert.equal(state.events.length, 1);
});

test("le directeur route chaque mission vers le bon agent", () => {
  const state = createInitialState(T0);
  const cases = {
    "Crée un site vitrine pour le restaurant": "webdev",
    "Range les documents du projet": "librarian",
    "Planifie un rdv client jeudi": "secretary",
    "Rédige le compte rendu de l'appel": "scribe",
    "Décision sur le budget marketing": "director",
  };
  for (const [text, agentId] of Object.entries(cases)) assert.equal(routeTask(state, text).agentId, agentId, text);
});

test("une mission passe en cours, est livrée en bibliothèque et notifiée", async () => {
  const { runtime, state, notes, advanceBy } = freshRuntime();
  const task = runtime.dispatch("task.create", { title: "Crée un site pour « Chez Mamie »", brief: "Restaurant lyonnais" });
  assert.equal(task.status, "working");
  await flush();
  assert.ok(task.output, "le générateur a produit un livrable");
  advanceBy(60000);
  assert.equal(task.status, "done");
  const doc = state.documents.find((d) => d.id === task.docId);
  assert.equal(doc.kind, "site");
  assert.match(doc.content, /<!DOCTYPE html>/);
  assert.match(doc.content, /Chez Mamie/);
  assert.ok(notes.some((n) => n.kind === "task_done"));
});

test("les dossiers importants attendent la validation du patron", async () => {
  const { runtime, state, advanceBy } = freshRuntime();
  const task = runtime.dispatch("task.create", { title: "Stratégie 2027", priority: "haute" });
  await flush();
  advanceBy(60000);
  assert.equal(task.status, "review");
  assert.throws(() => runtime.dispatch("task.review", { taskId: task.id, decision: "revise", comment: "" }), OfficeError);
  runtime.dispatch("task.review", { taskId: task.id, decision: "revise", comment: "Plus court" });
  assert.equal(task.revisions, 1);
  assert.equal(task.status, "working", "relancée immédiatement par l'agent libre");
  await flush();
  advanceBy(60000);
  runtime.dispatch("task.review", { taskId: task.id, decision: "approve" });
  assert.equal(task.status, "done");
  assert.ok(state.decisions.some((d) => d.text.includes("Stratégie 2027")));
});

test("un agent traite ses missions une par une, par priorité", () => {
  const state = createInitialState(T0);
  applyAction(state, "task.create", { title: "A", agentId: "scribe" }, T0);
  applyAction(state, "task.create", { title: "B", agentId: "scribe", priority: "critique" }, T0 + 1);
  advance(state, T0 + 2);
  const working = state.tasks.filter((t) => t.status === "working");
  assert.equal(working.length, 1);
  assert.equal(working[0].title, "B", "la mission critique passe devant");
  attachTaskOutput(state, working[0].id, { kind: "note", content: "ok" });
  advance(state, T0 + 600000);
  assert.equal(working[0].status, "review", "critique = validation du patron");
  assert.equal(state.tasks.find((t) => t.title === "A").status, "working");
});

test("les limites protègent le QG", () => {
  const state = createInitialState(T0);
  for (let i = 0; i < 8; i++) applyAction(state, "task.create", { title: `T${i}`, agentId: "scribe" }, T0);
  assert.throws(() => applyAction(state, "task.create", { title: "Une de trop", agentId: "scribe" }, T0), /trop de missions/);
  assert.throws(() => applyAction(state, "task.create", { title: "" }, T0), /titre/);
  assert.throws(() => applyAction(state, "agent.fire", { agentId: "webdev" }, T0), /seul/);
  assert.throws(() => applyAction(state, "agent.fire", { agentId: "director" }, T0), /directeur/);
  assert.throws(() => applyAction(state, "doc.add", { title: "x", url: "javascript:alert(1)" }, T0), /http/);
});

test("recrutement et départ redistribuent les missions", () => {
  const state = createInitialState(T0);
  const dev = applyAction(state, "agent.hire", { role: "webdev", name: "Alice" }, T0);
  assert.equal(dev.managerId, "mgr-prod");
  const task = applyAction(state, "task.create", { title: "Landing", agentId: dev.id }, T0);
  applyAction(state, "agent.fire", { agentId: dev.id }, T0);
  assert.equal(task.agentId, "webdev");
  const mgr = applyAction(state, "agent.hire", { role: "manager", dept: "organisation" }, T0);
  assert.equal(mgr.managerId, "director");
  const sec = applyAction(state, "agent.hire", { role: "secretary" }, T0);
  assert.equal(sec.managerId, mgr.id, "le manager le moins chargé du pôle prend la recrue");
});

test("réunion : notes → compte rendu, décisions et actions transformables en missions", async () => {
  const { runtime, state } = freshRuntime();
  const meeting = runtime.dispatch("meeting.start", { title: "Kickoff", attendees: ["Léo", "mgr-prod"] });
  assert.deepEqual(meeting.attendees, ["scribe", "webdev", "mgr-prod"]);
  assert.throws(() => runtime.dispatch("meeting.start", { title: "Autre" }), /déjà/);
  runtime.dispatch("meeting.note", { meetingId: meeting.id, text: "On décide de lancer en novembre" });
  runtime.dispatch("meeting.note", { meetingId: meeting.id, text: "Action : Léo doit préparer la maquette" });
  runtime.dispatch("meeting.end", { meetingId: meeting.id });
  assert.equal(meeting.status, "summarizing");
  await flush();
  assert.equal(meeting.status, "ended");
  assert.equal(meeting.decisions.length, 1);
  assert.equal(meeting.actions[0].agentId, "webdev");
  assert.equal(state.documents.find((d) => d.id === meeting.docId).kind, "minutes");
  const task = runtime.dispatch("meeting.actionToTask", { meetingId: meeting.id, index: 0 });
  assert.equal(task.agentId, "webdev");
  assert.throws(() => runtime.dispatch("meeting.actionToTask", { meetingId: meeting.id, index: 0 }), /déjà/);
});

test("planning : rappels et réunions planifiées qui démarrent seules", () => {
  const state = createInitialState(T0, { tzOffset: PARIS });
  const ev = applyAction(state, "event.add", { title: "Point produit", start: T0 + 30 * 60000, durationMin: 30, isMeeting: true, attendees: ["Manon"], remindMinutes: 15 }, T0);
  assert.deepEqual(ev.attendees, ["mgr-prod"]);
  assert.equal(advance(state, T0 + 10 * 60000).notes.length, 0);
  const { notes } = advance(state, T0 + 16 * 60000);
  assert.equal(notes[0].kind, "reminder");
  const started = advance(state, T0 + 31 * 60000).notes;
  assert.equal(started[0].kind, "meeting_started");
  assert.equal(state.meetings.at(-1).status, "live");
  advance(state, T0 + 71 * 60000);
  assert.equal(state.meetings.at(-1).status, "ended", "sans notes, la réunion se clôt sans compte rendu");
});

test("la vue client n'embarque pas le contenu lourd des documents", async () => {
  const { runtime, state, advanceBy } = freshRuntime();
  runtime.dispatch("task.create", { title: "Site pour « Zen »", type: "site", agentId: "webdev" });
  await flush();
  advanceBy(60000);
  const client = toClientState(state);
  const site = client.documents.find((d) => d.kind === "site");
  assert.equal(site.content, undefined);
  assert.ok(site.size > 1000);
  assert.equal(client.tasks[0].output.content, undefined);
});

// ---------------------------------------------------------------- dates

test("analyse des rendez-vous en français", () => {
  const cases = [
    ["Réunion client jeudi 15h30", "Réunion client", "jeu. 15 oct. 15:30", 45, true],
    ["dentiste demain 9h", "Dentiste", "jeu. 15 oct. 09:00", 60, false],
    ["appel avec Paul le 23/10 à 11h pendant 30 min", "Appel avec Paul", "ven. 23 oct. 11:00", 30, false],
    ["déjeuner vendredi midi", "Déjeuner", "ven. 16 oct. 12:00", 60, false],
    ["anniversaire 2 novembre", "Anniversaire", "lun. 2 nov. 10:00", 60, false],
    ["point budget dans 2 heures", "Point budget", "mer. 14 oct. 16:00", 45, true],
  ];
  for (const [text, title, when, duration, meeting] of cases) {
    const p = parseFrenchEvent(text, { now: T0, tzOffset: PARIS });
    assert.equal(p.title, title, text);
    assert.equal(formatLocal(p.start, PARIS), when, text);
    assert.equal(p.durationMin, duration, text);
    assert.equal(p.isMeeting, meeting, text);
  }
});

// ---------------------------------------------------------------- authentification Telegram

test("validation de l'initData Telegram", () => {
  const token = "123:ABC";
  const fields = { user: JSON.stringify({ id: 7, first_name: "Kenny" }), auth_date: String(Math.floor(Date.now() / 1000)), query_id: "AAE" };
  const signed = signInitData(fields, token);
  assert.equal(validateInitData(signed, token).user.id, 7);
  assert.equal(validateInitData(signed, "autre:token"), null);
  assert.equal(validateInitData(signed.replace("Kenny", "Butters"), token), null);
  const old = signInitData({ ...fields, auth_date: String(Math.floor(Date.now() / 1000) - 3 * 86400) }, token);
  assert.equal(validateInitData(old, token), null);
  assert.equal(validateInitData("", token), null);
});

// ---------------------------------------------------------------- API HTTP

test("API de la mini app : authentification, actions, documents", async (t) => {
  const token = "999:TEST";
  const sent = [];
  const service = new OfficeService({ repository: createMemoryRepository(), logger: { log() {}, error() {} } });
  await service.start();
  const app = createOfficeApp({ service, botToken: token, allowedUserIds: ["42"], sendDocument: async (owner, doc) => sent.push([owner, doc.title]), logger: { error() {} } });
  const server = app.listen(0);
  t.after(async () => {
    server.close();
    await service.stop();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = (id) => ({ Authorization: `tma ${signInitData({ user: JSON.stringify({ id, first_name: "Boss" }), auth_date: String(Math.floor(Date.now() / 1000)) }, token)}`, "Content-Type": "application/json", "X-Tz-Offset": "120" });

  assert.equal((await fetch(`${base}/api/state`)).status, 401);
  assert.equal((await fetch(`${base}/api/state`, { headers: auth(1) })).status, 403);

  const first = await (await fetch(`${base}/api/state`, { headers: auth(42) })).json();
  assert.equal(first.state.agents.length, 7);
  assert.equal(first.state.settings.tzOffset, 120);
  const same = await (await fetch(`${base}/api/state?rev=${first.rev}`, { headers: auth(42) })).json();
  assert.equal(same.unchanged, true);

  const created = await (await fetch(`${base}/api/action`, { method: "POST", headers: auth(42), body: JSON.stringify({ type: "doc.add", payload: { title: "Charte", content: "# Charte\nBleu et or" } }) })).json();
  assert.ok(created.result.id);
  const bad = await fetch(`${base}/api/action`, { method: "POST", headers: auth(42), body: JSON.stringify({ type: "task.create", payload: { title: "" } }) });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /titre/);

  const { document } = await (await fetch(`${base}/api/documents/${created.result.id}`, { headers: auth(42) })).json();
  assert.equal(document.content, "# Charte\nBleu et or");
  assert.equal((await fetch(`${base}/api/documents/${created.result.id}/send`, { method: "POST", headers: auth(42) })).status, 200);
  assert.deepEqual(sent, [["42", "Charte"]]);

  const parsed = await (await fetch(`${base}/api/query`, { method: "POST", headers: auth(42), body: JSON.stringify({ type: "parseEvents", payload: { text: "dentiste demain 9h" } }) })).json();
  assert.equal(parsed.result[0].title, "Dentiste");

  assert.equal((await fetch(`${base}/vendor/three/build/three.module.js`)).status, 200);
  assert.equal((await fetch(`${base}/shared/engine.js`)).status, 200);
});

// ---------------------------------------------------------------- générateur Claude (client simulé)

function fakeClient(replies) {
  const calls = [];
  const make = (beta) => ({
    stream(params) {
      calls.push({ beta, params });
      const reply = replies.shift();
      return { finalMessage: async () => (typeof reply === "function" ? reply(params) : reply) };
    },
  });
  return { calls, messages: make(false), beta: { messages: make(true) } };
}

const textMessage = (text, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "thinking", thinking: "" }, { type: "text", text }] });

test("générateur Claude : site HTML, planning structuré, repli serveur", async () => {
  const client = fakeClient([
    textMessage("```html\n<!DOCTYPE html><html><head><title>Studio Zen</title></head><body>Yoga</body></html>\n```"),
    textMessage(JSON.stringify({ message: "C'est calé !", events: [{ title: "Rdv client", start_local: "2026-10-15T15:30", duration_min: 60, is_meeting: false, attendees: ["Léo"] }] })),
  ]);
  const gen = createClaudeGenerator({ apiKey: "x", model: "claude-opus-5-5", client });
  const state = createInitialState(T0, { tzOffset: PARIS });
  const agent = (id) => state.agents.find((a) => a.id === id);

  const site = await gen.runTask({ task: { title: "Site yoga", brief: "", type: "site", priority: "normale", feedback: [] }, agent: agent("webdev"), state, now: T0 });
  assert.equal(site.kind, "site");
  assert.equal(site.title, "Site — Studio Zen");
  assert.match(site.content, /^<!DOCTYPE html>/);
  assert.equal(client.calls[0].beta, true);
  assert.equal(client.calls[0].params.fallbacks, "default");
  assert.deepEqual(client.calls[0].params.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(client.calls[0].params.model, "claude-opus-5-5");
  assert.equal(client.calls[0].params.output_config.effort, "medium");

  const planning = await gen.runTask({ task: { title: "Cale un rdv client", brief: "jeudi 15h30", type: "planning", priority: "normale", feedback: [] }, agent: agent("secretary"), state, now: T0 });
  assert.equal(planning.events.length, 1);
  assert.equal(formatLocal(planning.events[0].start, PARIS), "jeu. 15 oct. 15:30");
  assert.equal(client.calls[1].params.output_config.format.type, "json_schema");
});

test("générateur Claude : modèle sans repli serveur et refus géré", async () => {
  const client = fakeClient([textMessage("", "refusal")]);
  const gen = createClaudeGenerator({ apiKey: "x", model: "claude-haiku-5-5", client });
  const state = createInitialState(T0);
  await assert.rejects(gen.directorBrief({ state, now: T0 }), /décliné/);
  assert.equal(client.calls[0].beta, false);
  assert.equal(client.calls[0].params.fallbacks, undefined);
});

test("si l'IA échoue, l'agent livre quand même grâce aux modèles", async () => {
  const failing = { ai: true, model: "test", runTask: async () => { throw new Error("API indisponible"); } };
  const { runtime, advanceBy } = freshRuntime(failing);
  const task = runtime.dispatch("task.create", { title: "Rédige une note", agentId: "scribe" });
  await flush();
  assert.ok(task.output);
  assert.equal(task.ai.used, false);
  assert.match(task.ai.error, /indisponible/);
  advanceBy(60000);
  assert.equal(task.status, "done");
});

test("les travaux interrompus sont relancés après un redémarrage", () => {
  const state = createInitialState(T0);
  applyAction(state, "task.create", { title: "Note", agentId: "scribe" }, T0);
  advance(state, T0);
  assert.deepEqual(pendingJobs(state).map((j) => j.kind), ["task"]);
});
