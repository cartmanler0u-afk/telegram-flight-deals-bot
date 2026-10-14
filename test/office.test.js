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
  migrateState,
  addDeals,
  OfficeError,
} from "../webapp/shared/engine.js";
import { ROLES, DEPARTMENTS } from "../webapp/shared/roster.js";
import { setDealSink, shareDeals } from "../src/office/bridge.js";
import Anthropic from "@anthropic-ai/sdk";
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

test("l'entreprise de départ est complète et hiérarchisée", () => {
  const state = createInitialState(T0);
  const byId = Object.fromEntries(state.agents.map((a) => [a.id, a]));
  assert.equal(state.agents.length, 27);
  assert.equal(new Set(state.agents.map((a) => a.id)).size, 27, "identifiants uniques");
  for (const agent of state.agents) {
    assert.ok(ROLES[agent.role], `rôle connu pour ${agent.id}`);
    assert.ok(DEPARTMENTS[agent.dept], `pôle connu pour ${agent.id}`);
    if (agent.id !== "director") assert.ok(byId[agent.managerId], `${agent.id} a un responsable`);
  }
  assert.equal(byId.webdev.managerId, "mgr-tech");
  assert.equal(byId.librarian.managerId, "mgr-orga");
  assert.equal(byId.cleaner.managerId, "mgr-orga");
  assert.equal(byId.vinted.managerId, "mgr-vente");
  assert.equal(byId.dealhunter.managerId, "mgr-sourcing");
  assert.equal(byId.tiktok.managerId, "mgr-prod");
  assert.equal(byId["mgr-tech"].managerId, "director");
  assert.equal(state.agents.filter((a) => a.role === "dealhunter").length, 2, "deux dénicheurs de bons plans");
  assert.ok(state.agents.some((a) => a.role === "cleaner"), "quelqu'un fait le ménage");
  assert.equal(state.settings.companyName, "Boss Corp");
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
    "Rédige une annonce Vinted pour une veste The North Face": "vinted",
    "Trouve des bons plans sneakers à revendre": "dealhunter",
    "Trouve un fournisseur de hoodies en gros": "sourcer",
    "Monte une vidéo TikTok de 30 s sur le déballage": "tiktok",
    "Story Snap pour la promo du week-end": "snap",
    "Post pour le canal Telegram": "telegram",
    "Calcule la marge sur les ventes du mois": "accountant",
    "Automatise un bot Telegram qui répond aux clients": "automation",
    "Prépare l'envoi des colis de la semaine": "logistics",
    "Réponds au client mécontent de sa commande": "support",
    "Plan de lancement OFM : recrutement de créatrices": "talent",
    "Shooting photo des nouveaux articles": "photographer",
    "Fais le ménage dans le cache": "cleaner",
  };
  for (const [text, agentId] of Object.entries(cases)) assert.equal(routeTask(state, text).agentId, agentId, text);
  // Mission confiée à un pôle : un membre du pôle, jamais quelqu'un d'ailleurs.
  const routed = routeTask(state, "Crée un site pour la boutique", { dept: "vente" });
  assert.equal(state.agents.find((a) => a.id === routed.agentId).dept, "vente");
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
  assert.equal(dev.managerId, "mgr-tech");
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
  assert.equal(first.state.agents.length, 27);
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
      calls.push({ beta, params: { ...params } });
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


// ---------------------------------------------------------------- entreprise v2

function v1State() {
  // État tel qu'enregistré par la première version du QG (7 agents, pôle « production »).
  const state = createInitialState(T0, { bossName: "Cartman", tzOffset: PARIS });
  const keep = ["director", "mgr-orga", "secretary", "librarian", "scribe", "mgr-prod", "webdev"];
  state.agents = state.agents.filter((a) => keep.includes(a.id)).map(({ traits, specialty, ...a }) => ({ ...a, dept: ["mgr-prod", "webdev"].includes(a.id) ? "production" : a.dept }));
  state.agents.find((a) => a.id === "webdev").managerId = "mgr-prod";
  for (const key of ["version", "deals", "trash", "housekeeping"]) delete state[key];
  delete state.settings.companyName;
  delete state.settings.dealWatch;
  applyAction(state, "task.create", { title: "Site pour « Chez Mamie »", agentId: "webdev" }, T0);
  applyAction(state, "doc.add", { title: "Charte", content: "Bleu et or" }, T0);
  return state;
}

test("migration v1 → v2 : l'entreprise s'agrandit sans rien perdre", async () => {
  const state = migrateState(v1State(), T0 + 1000);
  const byId = Object.fromEntries(state.agents.map((a) => [a.id, a]));
  assert.equal(state.version, 2);
  assert.equal(state.agents.length, 27);
  assert.equal(byId.webdev.dept, "tech");
  assert.equal(byId.webdev.managerId, "mgr-tech", "Léo rejoint le studio web de Paul");
  assert.equal(byId["mgr-prod"].dept, "social");
  assert.equal(state.tasks[0].title, "Site pour « Chez Mamie »");
  assert.equal(state.documents.find((d) => d.title === "Charte").content, "Bleu et or");
  assert.deepEqual(state.deals, []);
  assert.equal(state.settings.companyName, "Cartman Corp");
  assert.match(state.log.at(-1).text, /s'agrandit : 20 nouveaux collègues/);
  assert.equal(migrateState(state, T0 + 2000).agents.length, 27, "migration idempotente");

  // Même chose à travers le service (état sauvegardé en base par l'ancienne version).
  const repository = createMemoryRepository();
  await repository.save("42", v1State());
  const service = new OfficeService({ repository, logger: { log() {}, error() {} } });
  const office = await service.get("42");
  assert.equal(office.runtime.state.agents.length, 27);
  await service.stop();
});

test("ménage : corbeille, restauration et grand ménage par Josiane", () => {
  const { runtime, state, notes, advanceBy } = freshRuntime();
  const doc = runtime.dispatch("doc.add", { title: "Vieux brouillon", content: "x".repeat(2000) });
  runtime.dispatch("doc.delete", { docId: doc.id });
  assert.equal(state.trash.length, 1);
  assert.equal(toClientState(state).trash[0].content, undefined, "pas de contenu lourd côté client");
  runtime.dispatch("doc.restore", { docId: doc.id });
  assert.ok(state.documents.some((d) => d.id === doc.id));
  assert.throws(() => runtime.dispatch("doc.restore", { docId: doc.id }), /corbeille/);
  runtime.dispatch("doc.delete", { docId: doc.id });
  for (let i = 0; i < 80; i++) state.log.push({ at: T0, agentId: "intern", text: `bruit ${i}`, icon: "•" });

  const task = runtime.dispatch("office.clean");
  assert.equal(task.type, "cleaning");
  assert.equal(task.agentId, "cleaner");
  assert.equal(runtime.dispatch("office.clean").id, task.id, "pas de double ménage");
  assert.equal(task.status, "working");
  assert.ok(task.output, "le ménage ne dépend pas de l'IA");
  advanceBy(5 * 60000);
  assert.equal(task.status, "done", "le ménage n'attend pas de validation");
  assert.equal(state.trash.length, 0, "corbeille vidée");
  assert.ok(state.log.length <= 55, "journal allégé");
  assert.equal(state.housekeeping.runs, 1);
  assert.equal(state.housekeeping.by, "cleaner");
  assert.ok(state.housekeeping.lastReport.trash >= 1);
  const report = state.documents.find((d) => d.id === task.docId);
  assert.match(report.content, /Corbeille vidée \| 1/);
  assert.ok(notes.some((n) => n.kind === "task_done"));
});

test("ménage automatique toutes les 8 heures", () => {
  const state = createInitialState(T0);
  advance(state, T0 + 3600000);
  assert.equal(state.tasks.length, 0);
  advance(state, T0 + 8 * 3600000 + 60000);
  const task = state.tasks.find((t) => t.type === "cleaning");
  assert.equal(task.source, "auto");
  assert.equal(task.agentId, "cleaner");
  advance(state, T0 + 8 * 3600000 + 61000);
  assert.equal(task.status, "working");
  advance(state, T0 + 9 * 3600000);
  assert.equal(task.status, "done");
  assert.equal(state.tasks.filter((t) => t.type === "cleaning").length, 1);
});

test("bons plans : dédoublonnage, analyse par le pôle sourcing et veille automatique", () => {
  const state = createInitialState(T0);
  const added = addDeals(state, [
    { title: "Paris → Lisbonne 39 € A/R", link: "https://example.com/lisbonne", source: "Bot vols" },
    { title: "Nike Dunk à 55 €", link: "https://example.com/dunk" },
    { title: "Paris → Lisbonne 39 € A/R (repost)", link: "https://example.com/lisbonne" },
    { title: "Lien douteux", link: "javascript:alert(1)" },
    { title: "" },
  ], T0, "dealhunter");
  assert.equal(added.length, 3);
  assert.equal(state.deals.find((d) => d.title === "Lien douteux").link, null);
  assert.equal(addDeals(state, [{ title: "Nike Dunk à 55 €", link: "https://example.com/dunk" }], T0).length, 0);

  const task = applyAction(state, "deal.toTask", { dealId: added[1].id }, T0);
  assert.equal(state.agents.find((a) => a.id === task.agentId).dept, "sourcing");
  assert.match(task.brief, /example\.com\/dunk/);
  applyAction(state, "deal.dismiss", { dealId: added[0].id }, T0);
  assert.equal(added[0].dismissed, true);

  assert.throws(() => applyAction(state, "dealWatch.update", { enabled: true, topics: "" }, T0), /sujet/);
  applyAction(state, "dealWatch.update", { enabled: true, everyHours: 1, topics: "Vols depuis Paris\nConsoles reconditionnées" }, T0);
  assert.equal(state.settings.dealWatch.everyHours, 3, "fréquence bornée");
  advance(state, T0 + 1000);
  const watch = state.tasks.filter((t) => t.source === "veille");
  assert.equal(watch.length, 1);
  assert.equal(watch[0].type, "dealhunt");
  assert.equal(state.agents.find((a) => a.id === watch[0].agentId).role, "dealhunter");
  advance(state, T0 + 2000);
  assert.equal(state.tasks.filter((t) => t.source === "veille").length, 1, "une seule veille à la fois");
});

test("les bons plans du bot de vols arrivent chez le dénicheur voyages", async () => {
  const service = new OfficeService({ repository: createMemoryRepository(), logger: { log() {}, error() {} } });
  const office = await service.get("42", { bossName: "Cartman" });
  setDealSink((deals) => service.broadcastDeals(deals));
  shareDeals([{ title: "Paris → Tokyo 480 € A/R", link: "https://example.com/tokyo", summary: "Air France, mars", source: "Secret Flying" }]);
  const [deal] = office.runtime.state.deals;
  assert.equal(deal.title, "Paris → Tokyo 480 € A/R");
  assert.equal(deal.category, "vol");
  assert.equal(deal.hunterId, "dealhunter", "Lucas est le spécialiste vols & voyages");
  shareDeals([]);
  setDealSink(null);
  shareDeals([{ title: "ignoré" }]);
  assert.equal(office.runtime.state.deals.length, 1);
  await service.stop();
});

test("les modèles produisent des livrables métier (annonce, montage, compta, stagiaire)", async () => {
  const { runtime, state, advanceBy } = freshRuntime();
  const listing = runtime.dispatch("task.create", { title: "Rédige une annonce Vinted pour une veste The North Face", brief: "Taille M, très bon état" });
  const video = runtime.dispatch("task.create", { title: "Monte une vidéo TikTok de 30 s sur le déballage" });
  const finance = runtime.dispatch("task.create", { title: "Calcule la marge sur les ventes du mois" });
  const intern = runtime.dispatch("task.create", { title: "Liste des idées pour le pot de vendredi", agentId: "intern" });
  await flush();
  advanceBy(10 * 60000);
  const doc = (task) => state.documents.find((d) => d.id === task.docId);
  assert.equal(listing.agentId, "vinted");
  assert.equal(doc(listing).kind, "listing");
  assert.match(doc(listing).title, /^Annonce — Veste The North Face/);
  assert.equal(doc(video).kind, "video");
  assert.equal(doc(finance).kind, "finance");
  assert.match(doc(intern).content, /stagiaire/);
});

// ---------------------------------------------------------------- recherche web des dénicheurs

test("générateur Claude : les dénicheurs cherchent sur le web et citent leurs sources", async () => {
  const searchResult = {
    type: "web_search_tool_result",
    tool_use_id: "srv_1",
    content: [
      { type: "web_search_result", url: "https://example.com/promo", title: "Promo [flash] sneakers" },
      { type: "web_search_result", url: "https://example.com/promo", title: "doublon" },
    ],
  };
  const client = fakeClient([
    { stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "promo sneakers" } }, searchResult] },
    textMessage("## Bons plans\n- Nike Dunk à 55 €"),
  ]);
  const gen = createClaudeGenerator({ apiKey: "x", model: "claude-opus-5-5", client });
  const state = createInitialState(T0, { tzOffset: PARIS });
  addDeals(state, [{ title: "Déjà vu : Jordan 1 à 90 €" }], T0);
  const hunter = state.agents.find((a) => a.id === "dealhunter-2");
  const out = await gen.runTask({ task: { title: "Bons plans sneakers", brief: "", type: "dealhunt", priority: "normale", feedback: [] }, agent: hunter, state, now: T0 });

  assert.equal(client.calls.length, 2, "le tour mis en pause est relancé");
  assert.deepEqual(client.calls[0].params.tools.map((t) => t.type), ["web_search_20260209"]);
  assert.match(client.calls[0].params.messages[0].content, /Date du jour : 2026-10-14/);
  assert.match(client.calls[0].params.messages[0].content, /Déjà vu : Jordan 1/);
  assert.equal(client.calls[1].params.messages[1].role, "assistant");
  assert.equal(out.kind, "deals");
  assert.match(out.content, /Nike Dunk/);
  assert.match(out.content, /## Sources consultées\n- \[Promo flash sneakers\]\(https:\/\/example\.com\/promo\)$/);
  assert.equal(out.summary, "1 source(s) web consultée(s)");

  // Les autres rôles n'ont pas l'outil de recherche.
  client.calls.length = 0;
  const writerClient = fakeClient([textMessage("Texte")]);
  const gen2 = createClaudeGenerator({ apiKey: "x", model: "claude-opus-5-5", client: writerClient });
  await gen2.runTask({ task: { title: "Post", brief: "", type: "content", priority: "normale", feedback: [] }, agent: state.agents.find((a) => a.id === "writer"), state, now: T0 });
  assert.equal(writerClient.calls[0].params.tools, undefined);
});

test("générateur Claude : sans recherche web sur le compte, on retente sans l'outil", async () => {
  const badRequest = (params) => {
    if (params.tools) throw new Anthropic.BadRequestError(400, { type: "invalid_request_error" }, "web search is not enabled", new Headers());
    return textMessage("Méthode de veille");
  };
  const client = fakeClient([badRequest, badRequest, badRequest]);
  const gen = createClaudeGenerator({ apiKey: "x", model: "claude-haiku-5-5", client });
  const state = createInitialState(T0);
  const task = { title: "Veille vols", brief: "", type: "dealhunt", priority: "normale", feedback: [] };
  const hunter = state.agents.find((a) => a.id === "dealhunter");
  const out = await gen.runTask({ task, agent: hunter, state, now: T0 });
  assert.equal(out.content, "Méthode de veille");
  assert.equal(client.calls.length, 2);
  assert.ok(client.calls[0].params.tools);
  assert.equal(client.calls[1].params.tools, undefined);
  await gen.runTask({ task, agent: hunter, state, now: T0 });
  assert.equal(client.calls.length, 3, "l'outil n'est plus proposé ensuite");
  assert.equal(client.calls[2].params.tools, undefined);

  const off = fakeClient([textMessage("ok")]);
  await createClaudeGenerator({ apiKey: "x", model: "claude-haiku-5-5", webSearch: false, client: off }).runTask({ task, agent: hunter, state, now: T0 });
  assert.equal(off.calls[0].params.tools, undefined, "ANTHROPIC_WEB_SEARCH=false");
});
