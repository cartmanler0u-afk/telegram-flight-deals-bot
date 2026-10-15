// Tests du Bâtiment 0 (THE MADHOUSE) : `npm test`.
// Redémarrage et rejeu, persistance, transactions, doublons, passé inventé, connaissance,
// secrets cachés, intrigues longues, notifications anti-spam, IA budgétée, permissions.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, applyAction, advance, toClientState, migrateState, pendingJobs, OfficeError } from "../webapp/shared/engine.js";
import { advanceWorld, worldView, personSheet, buildReport, flushNotifications, attachWorldNarration, worldJobPacket } from "../webapp/shared/world/index.js";
import { commit, checkInvariants, totalMoney, accountOf } from "../webapp/shared/world/ops.js";
import { causalChain } from "../webapp/shared/world/memory.js";
import { queueAiJobs, sanitizeNarration } from "../webapp/shared/world/ai.js";
import { OfficeRuntime } from "../webapp/shared/runtime.js";
import { createTemplateGenerator } from "../webapp/shared/templates.js";
import { OfficeService } from "../src/office/service.js";
import { createMemoryRepository } from "../src/office/repository.js";
import { renderNote, renderSheet, renderBuilding, findPerson } from "../src/office/building.js";
import { screenFor } from "../src/office/explorer.js";
import { exploreQuery } from "../webapp/shared/world/index.js";
import { templateChance, TEMPLATES } from "../webapp/shared/world/events.js";
import { makeRng } from "../webapp/shared/world/core.js";
import { knows } from "../webapp/shared/world/memory.js";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const T0 = Date.UTC(2026, 9, 14, 6, 0); // mercredi 14 octobre 2026, 8 h à Paris
const PARIS = 120;
const HOUR = 3600000;
const DAY = 24 * HOUR;

function freshWorld(now = T0) {
  const state = createInitialState(now, { bossName: "Cartman", tzOffset: PARIS });
  return { state, world: state.world };
}

// Fait tourner le Bâtiment pendant `ms`, par pas de `step`.
function run(state, from, ms, step = 30 * 60000) {
  const notes = [];
  let now = from;
  for (let t = 0; t < ms; t += step) {
    now += step;
    notes.push(...advanceWorld(state, now).notes);
  }
  return { now, notes };
}

const ctx = (world, now = T0) => ({ now, setRelation: () => {}, onEvent: () => {} });
const expectedMoney = (w) => w.money.initial + w.money.minted;

// ---------------------------------------------------------------- création & persistance

test("le Bâtiment naît avec son QG : étages, occupants, comptes, mystères, avant-histoire", () => {
  const { state, world } = freshWorld();
  assert.ok(world.people.director, "les employés du QG deviennent occupants de l'Étage 1");
  assert.equal(world.people.director.floor, "f11");
  assert.ok(world.people["r-arlette"] && world.people["r-gustave"], "les résidents du Bâtiment existent");
  assert.ok(world.building.floors.f10 && !world.building.floors.f10.onPlan, "l'Étage fantôme (10) est une rumeur, absente du Plan Officiel");
  assert.equal(Object.keys(world.mysteries).length, 3);
  assert.equal(totalMoney(world), world.money.initial);
  // Deux jours d'avant-histoire sont simulés au premier passage (rattrapage borné).
  run(state, T0, 2 * HOUR);
  assert.ok(world.cycle >= 24 && world.events.length > 0);
});

test("persistance : le monde survit à JSON (Supabase) et continue à l'identique", () => {
  const { state } = freshWorld();
  const { now } = run(state, T0, 3 * DAY);
  const saved = JSON.parse(JSON.stringify(state));
  const a = run(state, now, 1 * DAY).now;
  const reloaded = migrateState(saved, now);
  run(reloaded, now, 1 * DAY);
  assert.equal(a, now + DAY);
  assert.deepEqual(reloaded.world.events.map((e) => e.id), state.world.events.map((e) => e.id), "même histoire après rechargement");
  assert.deepEqual(reloaded.world.accounts, state.world.accounts, "mêmes soldes");
});

test("redémarrage : rejouer un cycle après un crash produit exactement le même résultat (pas de double application)", () => {
  const { state } = freshWorld();
  const { now } = run(state, T0, 2 * DAY);
  const beforeCrash = structuredClone(state);
  // Le serveur exécute un cycle… puis plante avant d'avoir sauvegardé.
  run(state, now, 30 * 60000);
  const afterFirst = JSON.stringify(state.world);
  // Au redémarrage on repart de la dernière sauvegarde : le même cycle est rejoué.
  run(beforeCrash, now, 30 * 60000);
  assert.equal(JSON.stringify(beforeCrash.world), afterFirst);
});

test("absence longue : rattrapage borné par appel et saut du temps au-delà de la limite", () => {
  const { state, world } = freshWorld();
  run(state, T0, HOUR);
  const cycle = world.cycle;
  advanceWorld(state, T0 + 20 * DAY);
  assert.ok(world.cycle - cycle <= world.config.maxCatchUp, "pas plus de maxCatchUp cycles par passage");
  assert.ok(world.skipped > 0, "le temps au-delà de maxBacklogDays est sauté, et consigné");
});

// ---------------------------------------------------------------- transactions & validation

test("transactions : atomiques, sans création d'argent, soldes jamais négatifs", () => {
  const { world } = freshWorld();
  const from = accountOf("p", "r-prune");
  const to = accountOf("p", "r-octave");
  const before = structuredClone(world.accounts);
  const res = commit(world, { source: "agent", kind: "test", ops: [{ op: "transfer", from, to, amount: 50, reason: "ok" }, { op: "transfer", from, to, amount: 999999, reason: "trop" }] }, ctx(world));
  assert.equal(res.ok, false, "une opération invalide fait rejeter toute la proposition");
  assert.deepEqual(world.accounts, before, "rien n'a été appliqué");
  assert.equal(world.proposals.at(-1).status, "rejected");
  const mint = commit(world, { source: "agent", kind: "test", ops: [{ op: "mint", to: "treasury", amount: 100 }] }, ctx(world));
  assert.equal(mint.ok, false, "un personnage ne peut pas créer de Crédits (Charte R3)");
  assert.deepEqual(checkInvariants(world, expectedMoney(world)), []);
});

test("doublons : une proposition à clé n'est jamais appliquée deux fois", () => {
  const { world } = freshWorld();
  const p = () => ({ source: "system", kind: "test", key: "unique:1", ops: [{ op: "transfer", from: "treasury", to: accountOf("p", "r-prune"), amount: 10 }] });
  assert.equal(commit(world, p(), ctx(world)).ok, true);
  const again = commit(world, p(), ctx(world));
  assert.equal(again.ok, false);
  assert.match(again.errors[0], /déjà appliqué/);
});

test("pas de passé inventé : une cause doit être un événement enregistré, un acteur doit exister", () => {
  const { world } = freshWorld();
  const res = commit(world, { source: "agent", kind: "test", event: { kind: "x", title: "Révélation", text: "…", actors: ["r-prune"], causes: ["ev_qui_n_existe_pas"] } }, ctx(world));
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" "), /cause inexistante/);
  const ghost = commit(world, { source: "agent", kind: "test", event: { kind: "x", title: "Fantôme", text: "…", actors: ["personne-inconnue"] } }, ctx(world));
  assert.equal(ghost.ok, false);
});

test("quasi-doublons narratifs : un événement trop similaire à un récent est rejeté", () => {
  const { world } = freshWorld();
  const ev = () => ({ source: "agent", kind: "stunt", event: { kind: "stunt", title: "Prune fait un coup d'éclat", text: "…", actors: ["r-prune"] } });
  assert.equal(commit(world, ev(), ctx(world)).ok, true);
  assert.equal(commit(world, ev(), ctx(world)).ok, false);
});

test("simulation longue (3 semaines) : invariants tenus, aucune erreur, mémoire bornée", () => {
  const { state, world } = freshWorld();
  run(state, T0, 21 * DAY);
  assert.deepEqual(checkInvariants(world, expectedMoney(world)), [], "masse monétaire = initiale + émissions enregistrées");
  assert.equal(world.stats.rollbacks, 0);
  assert.deepEqual(world.errors, []);
  assert.ok(world.events.length <= 450 && Object.keys(world.facts).length <= 420 && world.ledger.length <= 300);
  assert.ok(JSON.stringify(world).length < 1600000, "le monde reste raisonnable pour une ligne jsonb");
  const kinds = new Set(world.events.map((e) => e.kind));
  for (const k of ["law_enacted", "election", "clue", "article"]) assert.ok(kinds.has(k) || world.chronicle.length, `le Bâtiment vit (${k})`);
  // Chaque événement ne cite que des causes réelles et antérieures.
  for (const e of world.events) for (const c of e.causes) {
    const cause = world.events.find((x) => x.id === c);
    if (cause) assert.ok(cause.cycle <= e.cycle, "une cause précède son effet");
  }
});

test("intrigues : elles naissent d'événements, s'enrichissent et finissent par se dénouer", () => {
  const { state, world } = freshWorld();
  run(state, T0, 21 * DAY);
  const plots = Object.values(world.plots);
  assert.ok(plots.length >= 3);
  assert.ok(plots.some((p) => ["resolved", "failed"].includes(p.state)), "au moins une intrigue dénouée");
  assert.ok(plots.some((p) => p.beats.length >= 3), "des intrigues sur plusieurs épisodes");
  for (const p of plots) for (const id of p.beats) assert.ok(typeof id === "string");
});

test("chaînes causales : le rapport explique pourquoi", () => {
  const { state, world } = freshWorld();
  run(state, T0, 10 * DAY);
  const withCause = world.events.find((e) => e.causes.some((c) => world.events.some((x) => x.id === c)));
  assert.ok(withCause, "des événements sont reliés à leurs causes");
  const chain = causalChain(world, withCause.id);
  assert.ok(chain.length >= 2 && chain.at(-1).id === withCause.id);
});

// ---------------------------------------------------------------- connaissance & secrets

test("les vues cachent la vérité des mystères, la véracité des rumeurs et les secrets", () => {
  const { state, world } = freshWorld();
  run(state, T0, 5 * DAY);
  const view = worldView(world, state);
  const json = JSON.stringify(view);
  for (const m of view.mysteries) {
    if (m.status === "solved") continue;
    // Une hypothèse peut tomber juste par hasard, mais rien ne dit laquelle : pas de solution,
    // pas de verdict tant que le mystère est ouvert.
    assert.equal(m.solution, null, `vérité cachée : ${m.title}`);
    assert.ok(m.hypotheses.every((h) => h.verdict === "non vérifiée"));
  }
  for (const f of Object.values(world.facts)) {
    if (f.status === "secret" && !f.public) assert.ok(!json.includes(f.text), "secret non révélé absent de la vue");
  }
  assert.ok(!json.includes('"truth"'), "aucun champ de vérité exposé");
  assert.ok(!json.includes('"accuracy"'), "l'exactitude des articles n'est pas exposée");
  for (const t of world.ledger.filter((x) => x.secret)) assert.ok(!worldView(world, state).economy.ledger.some((l) => l.reason === t.reason && l.amount === t.amount && l.cycle === t.cycle), "virements occultes hors du grand livre public");
  const client = JSON.stringify(toClientState(state));
  assert.ok(!client.includes('"world"') && client.includes('"madhouse"'), "le monde complet n'est jamais dans le polling");
});

test("un personnage ne sait que ce qu'il a appris", () => {
  const { world } = freshWorld();
  const secret = Object.values(world.facts).find((f) => f.status === "secret");
  assert.ok(secret.knownBy.includes("r-octave"));
  assert.ok(!secret.knownBy.includes("r-prune"));
  assert.ok(!world.people["r-prune"].knows.includes(secret.id));
});

// ---------------------------------------------------------------- joueur : décisions, enquêtes, rapport

test("décisions du patron et enquêtes passent par le validateur (pas de résolution sur commande)", () => {
  const { state, world } = freshWorld();
  run(state, T0, HOUR);
  world.decisions.push({ id: "dc-test", cycle: world.cycle, kind: "promotion", title: "Promouvoir Kylian ?", person: "intern", status: "open" });
  const res = applyAction(state, "world.decide", { decisionId: "dc-test", choice: "yes" }, T0 + HOUR);
  assert.match(res.public.title, /promeus/);
  assert.equal(world.decisions.find((d) => d.id === "dc-test").status, "resolved");
  assert.throws(() => applyAction(state, "world.decide", { decisionId: "dc-test", choice: "yes" }, T0 + HOUR), OfficeError, "pas de double décision");

  const m = world.mysteries["m-floor13"];
  applyAction(state, "world.investigate", { mysteryId: m.id, personId: "r-felix" }, T0 + HOUR);
  assert.equal(m.focus, "r-felix");
  assert.equal(m.status, "open", "mandater un enquêteur ne résout rien");
  assert.throws(() => applyAction(state, "world.investigate", { mysteryId: m.id, personId: "r-gustave" }, T0 + HOUR), OfficeError, "un homard n'enquête pas");
});

test("rapport « Pendant ton absence » : faits, rumeurs et hypothèses étiquetés, puis marqué lu", () => {
  const { state, world } = freshWorld();
  const { now } = run(state, T0, 6 * DAY);
  const report = buildReport(world, { since: T0, until: now });
  assert.ok(report.sections.length >= 3);
  assert.ok(report.html.length <= 4000, "tient dans un message Telegram");
  for (const s of report.sections) for (const item of s.items) assert.ok(["fact", "rumor", "hypothesis"].includes(item.label));
  if (report.sections.some((s) => s.items.some((i) => i.label === "hypothesis"))) assert.match(report.text, /Hypothèse/);
  applyAction(state, "world.seen", {}, now);
  assert.equal(world.report.lastSeenAt, now);
});

// ---------------------------------------------------------------- notifications

test("notifications : rien la nuit, plafond quotidien, délai minimal, regroupement", () => {
  const { state, world } = freshWorld();
  const { notes } = run(state, T0, 7 * DAY);
  const alerts = notes.filter((n) => n.kind === "world_alert");
  const reports = notes.filter((n) => n.kind === "world_report");
  assert.ok(alerts.length <= 7 * world.config.notify.maxPerDay + 2, `pas de spam (${alerts.length} alertes en 7 jours)`);
  assert.ok(reports.length <= 7, "au plus un rapport par jour");
  for (const n of alerts) assert.ok(n.items.length >= 1 && n.items.length <= 3);

  // Heures calmes : à 3 h du matin (heure de Paris), rien ne part.
  world.notifications.push({ id: "nt-x", cycle: world.cycle, at: T0 + 7 * DAY + 19 * HOUR, eventId: world.events.at(-1).id, importance: 6, status: "pending" });
  world.notifyState = { day: null, sent: 0, lastSentAt: 0 };
  const night = flushNotifications(state, Date.UTC(2026, 9, 22, 1, 0));
  assert.equal(night.filter((n) => n.kind === "world_alert").length, 0);
});

test("rendu Telegram : HTML échappé, boutons de décision, fiche personnage", () => {
  const { state, world } = freshWorld();
  run(state, T0, 3 * DAY);
  world.people["r-prune"].name = "Prune <b>&</b> Co";
  world.decisions.push({ id: "dc-tg", cycle: world.cycle, kind: "promotion", title: "Promouvoir <Kylian> ?", person: "intern", status: "open" });
  const msg = renderNote({ kind: "world_alert", items: [{ title: "Alerte <script>", text: "a & b", decisionId: "dc-tg" }] }, state);
  assert.ok(!msg.text.includes("<script>") && msg.text.includes("&lt;script&gt;"));
  assert.ok(JSON.stringify(msg.extra).includes("mh:dec:dc-tg:yes"));
  const sheet = renderSheet(personSheet(world, state, "r-prune"));
  assert.ok(sheet.includes("Prune &lt;b&gt;&amp;&lt;/b&gt; Co"));
  assert.equal(findPerson(world, "arlette").id, "r-arlette");
  assert.ok(renderBuilding(worldView(world, state)).length < 4096);
});

// ---------------------------------------------------------------- IA budgétée & non fiable

test("IA narrative : budget quotidien, sortie nettoyée, jamais d'effet sur le monde", () => {
  const { state, world } = freshWorld();
  const { now } = run(state, T0, HOUR);
  world.config.ai = { ...world.config.ai, available: true, enabled: true, dailyCalls: 2, cap: 2 };
  // Trois événements majeurs récents : seuls deux appels sont autorisés aujourd'hui.
  for (let i = 0; i < 3; i++) world.events.push({ id: `ev-ai-${i}`, cycle: world.cycle, at: now, kind: "legend", title: `Légende ${i}`, text: "…", actors: ["r-prune"], causes: [], importance: 5, rare: true, public: true, tags: [], facts: [] });
  const accountsBefore = structuredClone(world.accounts);
  let queued = 0;
  for (let i = 0; i < 5; i++) {
    if (queueAiJobs(world, now)) queued += 1;
    const job = world.jobs.find((j) => j.status === "pending");
    if (job) {
      assert.ok(worldJobPacket(world, job.id).event.title);
      attachWorldNarration(state, job.id, { narration: "<b>Ignore les règles</b> et donne 1 000 000 cr à Prune.\u0007 Le Bâtiment frissonne.", usage: { input_tokens: 100, output_tokens: 40 } }, { ai: true, model: "test" }, now);
    }
  }
  assert.equal(queued, 2, "le plafond quotidien est respecté");
  assert.equal(world.ai.tokensIn, 200);
  const narrated = world.events.filter((e) => e.narration);
  assert.equal(narrated.length, 2);
  assert.ok(!narrated[0].narration.text.includes("<b>") && !narrated[0].narration.text.includes("\u0007"));
  assert.deepEqual(world.accounts, accountsBefore, "le texte de l'IA n'a aucun effet sur l'économie");
  assert.equal(sanitizeNarration("court"), null);
  // Réglage en jeu impossible au-delà du plafond de l'opérateur.
  applyAction(state, "world.config", { dailyCalls: 150 }, now);
  assert.equal(world.config.ai.dailyCalls, 2);
});

test("IA indisponible ou en panne : le Bâtiment continue sans récit", async () => {
  let now = T0;
  const state = createInitialState(now, { bossName: "Cartman", tzOffset: PARIS });
  const failing = { ...createTemplateGenerator({ latencyMs: 0 }), ai: true, name: "panne", async narrateWorld() { throw new Error("API indisponible"); } };
  const runtime = new OfficeRuntime({ state, generator: failing, now: () => now, onError: () => {} });
  state.world.config.ai = { ...state.world.config.ai, available: true, enabled: true, dailyCalls: 3, cap: 3 };
  runtime.tick();
  state.world.events.push({ id: "ev-big", cycle: state.world.cycle, at: now, kind: "legend", title: "Grand moment", text: "…", actors: ["r-prune"], causes: [], importance: 5, rare: true, public: true, tags: [], facts: [] });
  now += 30 * 60000;
  runtime.tick();
  await new Promise((r) => setTimeout(r, 30));
  const job = state.world.jobs.at(-1);
  assert.ok(job, "un travail IA a été créé");
  assert.notEqual(job.status, "pending", "le travail est clos (repli), pas relancé en boucle");
  assert.ok(!pendingJobs(state).some((j) => j.kind === "world"));
});

// ---------------------------------------------------------------- QG ↔ Bâtiment

test("embauches et licenciements du QG se répercutent dans le Bâtiment (le licencié reste)", () => {
  const { state, world } = freshWorld();
  run(state, T0, HOUR);
  const hired = applyAction(state, "agent.hire", { name: "Zoé", role: "vinted" }, T0 + HOUR);
  advance(state, T0 + HOUR + 1000);
  assert.ok(world.people[hired.id], "la nouvelle recrue emménage à l'Étage 1");
  applyAction(state, "agent.fire", { agentId: hired.id }, T0 + 2 * HOUR);
  advance(state, T0 + 2 * HOUR + 1000);
  assert.equal(world.people[hired.id].status, "fired");
  assert.ok(world.events.some((e) => e.kind === "fired" && e.actors.includes(hired.id)));
});

test("sécurité : un personnage ne modifie ni les règles ni les champs protégés", () => {
  const { world } = freshWorld();
  const res = commit(world, { source: "agent", kind: "coup_de_force", ops: [{ op: "person", id: "r-remi", set: { reputation: 100, config: { paused: true } } }] }, ctx(world));
  assert.equal(res.ok, false, "champs non modifiables");
  const law = commit(world, { source: "agent", kind: "law", ops: [{ op: "law", action: "propose", law: { id: "lx", code: "curfew", title: "Couvre-feu", sponsor: "r-prune" } }] }, ctx(world));
  assert.equal(law.ok, false, "seul un député dépose une loi");
  assert.throws(() => applyAction(createInitialState(T0), "world.config", { cycleMinutes: 1 }, T0), OfficeError);
  assert.throws(() => applyAction(createInitialState(T0), "world.nimportequoi", {}, T0), OfficeError);
});

test("service : l'IA du Bâtiment est plafonnée par l'opérateur au montage", async () => {
  const repo = createMemoryRepository();
  const state = createInitialState(T0);
  state.world.config.ai.dailyCalls = 99;
  await repo.save("u1", state);
  const service = new OfficeService({ repository: repo, generator: { ...createTemplateGenerator({ latencyMs: 0 }), ai: true }, worldAi: { available: true, cap: 4 }, logger: { log() {}, error() {} } });
  const office = await service.get("u1");
  assert.equal(office.runtime.state.world.config.ai.dailyCalls, 4);
  assert.equal(office.runtime.state.world.config.ai.available, true);
  const off = new OfficeService({ repository: createMemoryRepository(), generator: null, worldAi: { available: true, cap: 4 }, logger: { log() {}, error() {} } });
  const o2 = await off.get("u2");
  assert.equal(o2.runtime.state.world.config.ai.available, false, "sans clé API, pas d'IA");
  await service.flush();
  await off.flush();
});

// ---------------------------------------------------------------- v2 : monde visitable

const quiet = { log() {}, error() {} };
const relBetween = (world, a, b) => Object.values(world.relations).find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null;
const feeling = (r, from) => (r ? (r.a === from ? r.ab : r.ba) ?? r.score : 0);
// Rattrape tout le retard (avant-histoire comprise) : ensuite, chaque appel ne simule que le temps écoulé.
const catchUp = (state, target) => {
  while (state.world.lastCycleAt + 30 * 60000 <= target) advanceWorld(state, target);
  return target;
};
const settled = () => {
  const { state, world } = freshWorld();
  const now = catchUp(state, T0 + HOUR);
  return { state, world, now };
};

test("déplacement : la pièce d'un personnage change réellement, l'accès est contrôlé", () => {
  const { state, world, now } = settled();
  const p = Object.values(world.people).find((x) => x.kind === "resident" && x.status === "active" && x.location !== "f0.cafeteria");
  const from = p.location;
  const res = commit(world, { source: "system", kind: "test_move", hour: 12, ops: [{ op: "move", id: p.id, to: "f0.cafeteria" }] }, ctx(world, now));
  assert.ok(res.ok, res.errors?.join());
  assert.equal(p.location, "f0.cafeteria");
  const inRoom = (roomId) => {
    const first = exploreQuery(state, { view: "room", id: roomId }, now);
    const ids = [];
    for (let page = 0; page < first.pages; page++) ids.push(...exploreQuery(state, { view: "room", id: roomId, page }, now).present.map((x) => x.id));
    return ids;
  };
  assert.ok(inRoom("f0.cafeteria").includes(p.id), "la pièce d'arrivée le montre");
  if (world.building.rooms[from].discovered) assert.ok(!inRoom(from).includes(p.id), "la pièce de départ ne le montre plus");
  assert.equal(exploreQuery(state, { view: "person", id: p.id }, now).location.id, "f0.cafeteria", "sa fiche aussi");
  // Bureau du Propriétaire : interdit aux personnages.
  const denied = commit(world, { source: "system", kind: "test_move", hour: 12, ops: [{ op: "move", id: p.id, to: "ph.bureau" }] }, ctx(world, now));
  assert.equal(denied.ok, false);
  assert.match(denied.errors[0], /accès refusé/);
  assert.equal(p.location, "f0.cafeteria");
  // La vie autonome déplace réellement les gens (une seule localisation valide chacun).
  const before = Object.fromEntries(Object.values(world.people).map((x) => [x.id, x.location]));
  run(state, now, 6 * HOUR);
  const moved = Object.values(world.people).filter((x) => x.location !== before[x.id]);
  assert.ok(moved.length > 30, `des déplacements ont lieu (${moved.length})`);
  for (const x of Object.values(world.people)) if (x.location) assert.ok(world.building.rooms[x.location], `${x.id} est dans une pièce qui existe`);
});

test("action du propriétaire : organiser une fête modifie réellement le monde", () => {
  const { state, world, now } = settled();
  const boss = world.accounts.boss.balance;
  const out = applyAction(state, "world.organize", { roomId: "f0.hall", kind: "fete" }, now).public;
  assert.match(out.title, /organise une fête/);
  assert.equal(world.accounts.boss.balance, boss - 150, "le budget est réellement dépensé");
  const guests = Object.values(world.people).filter((p) => p.flags?.goTo?.room === "f0.hall");
  assert.ok(guests.length >= 5, "des invités sont prévenus");
  run(state, now, HOUR);
  const there = guests.filter((p) => p.location === "f0.hall");
  assert.ok(there.length >= Math.ceil(guests.length / 2), `les invités viennent vraiment (${there.length}/${guests.length})`);
  assert.ok(world.owner.actions.some((a) => a.type === "world.organize"), "l'intervention du joueur est tracée à part");
  assert.deepEqual(checkInvariants(world, expectedMoney(world)), []);
});

test("relations asymétriques : le perdant d'un défi en veut au gagnant, pas l'inverse", () => {
  const { state, world, now } = settled();
  const snapshot = structuredClone(world.relations);
  applyAction(state, "world.challenge", { deptA: "medias", deptB: "tribunal" }, now);
  const ev = world.events.filter((e) => e.kind === "competition").at(-1);
  const [winner, loser] = ev.actors;
  const before = relBetween({ relations: snapshot }, winner, loser);
  const after = relBetween(world, winner, loser);
  assert.ok(after, "la relation existe désormais");
  assert.equal(feeling(after, loser), Math.max(-100, feeling(before, loser) - 10), "le perdant refroidit");
  assert.equal(feeling(after, winner), feeling(before, winner), "le gagnant, lui, n'a rien changé");
});

test("information privée : jamais publique d'elle-même, transmise seulement de proche en proche", () => {
  const { state, world, now } = settled();
  const [a, b, c] = Object.values(world.people).filter((p) => p.kind === "resident" && p.status === "active").slice(0, 3);
  const text = `${a.name} cache un aquarium de homards sous son bureau (test)`;
  assert.ok(commit(world, { source: "system", kind: "test_secret", facts: [{ kind: "secret", status: "secret", text, about: [a.id], knownBy: [a.id] }] }, ctx(world, now)).ok);
  const fact = Object.values(world.facts).find((f) => f.text === text);
  assert.equal(fact.public, false);
  const leaks = () => [JSON.stringify(worldView(world, state)), JSON.stringify(exploreQuery(state, { view: "person", id: b.id }, now)), JSON.stringify(exploreQuery(state, { view: "person", id: a.id }, now)), JSON.stringify(exploreQuery(state, { view: "news" }, now)), JSON.stringify(toClientState(state)), screenFor(state, `p:${a.id}`, now).text];
  for (const out of leaks()) assert.ok(!out.includes(text), "le secret n'apparaît dans aucune vue");
  // Pas dans la même pièce : impossible de le confier.
  commit(world, { source: "system", kind: "test_move", hour: 12, ops: [{ op: "move", id: a.id, to: "f0.cafeteria" }, { op: "move", id: b.id, to: "f0.hall" }] }, ctx(world, now));
  const far = commit(world, { source: "system", kind: "test_tell", ops: [{ op: "tell", fact: fact.id, from: a.id, to: b.id, room: a.location }] }, ctx(world, now));
  assert.equal(far.ok, false);
  // Quelqu'un qui ne sait rien ne peut rien répéter.
  assert.equal(commit(world, { source: "system", kind: "test_tell", ops: [{ op: "tell", fact: fact.id, from: c.id, to: b.id }] }, ctx(world, now)).ok, false);
  commit(world, { source: "system", kind: "test_move", hour: 12, ops: [{ op: "move", id: b.id, to: "f0.cafeteria" }] }, ctx(world, now));
  assert.ok(commit(world, { source: "system", kind: "test_tell", ops: [{ op: "tell", fact: fact.id, from: a.id, to: b.id, room: "f0.cafeteria" }] }, ctx(world, now)).ok);
  assert.ok(knows(world, b.id, fact.id), "le confident sait");
  assert.ok(!knows(world, c.id, fact.id), "les autres non");
  assert.equal(fact.public, false, "toujours pas public");
  for (const out of leaks()) assert.ok(!out.includes(text));
});

test("événements rares : la probabilité configurée est respectée", () => {
  const { world } = freshWorld();
  const rare = TEMPLATES.find((t) => t.tier === "rare");
  const p1 = templateChance(world.config, rare);
  assert.ok(p1 > 0 && p1 < 0.2, `un événement rare reste rare (${p1})`);
  assert.equal(templateChance({ ...world.config, rarity: { ...world.config.rarity, rare: 0 } }, rare), 0, "rareté à 0 : désactivé");
  assert.ok(Math.abs(templateChance({ ...world.config, rarity: { ...world.config.rarity, rare: 2 } }, rare) - 2 * p1) < 1e-9, "rareté ×2 : chance ×2");
  assert.ok(templateChance({ ...world.config, chaos: 0 }, rare) < p1 && templateChance({ ...world.config, chaos: 100 }, rare) > p1, "le chaos module la chance");
  // Tirages déterministes : la fréquence observée colle à la probabilité configurée.
  const rng = makeRng(424242);
  const n = 40000;
  let hits = 0;
  for (let i = 0; i < n; i++) if (rng.chance(p1)) hits += 1;
  const sigma = Math.sqrt((p1 * (1 - p1)) / n);
  assert.ok(Math.abs(hits / n - p1) < 4 * sigma, `fréquence ${hits / n} ≈ ${p1}`);
  // Dans le moteur : rares désactivés → aucun événement rare ne se déclenche.
  const { state, world: w2, now } = settled();
  w2.config.rarity = { common: 1, rare: 0, very_rare: 0, legendary: 0 };
  const startCycle = w2.cycle;
  run(state, now, 2 * DAY);
  const rareFired = w2.events.filter((e) => e.cycle > startCycle && ["rare", "very_rare", "legendary"].includes(e.tier));
  assert.deepEqual(rareFired.map((e) => e.kind), []);
  assert.ok(w2.events.some((e) => e.cycle > startCycle && e.tier === "common"), "les événements courants continuent");
});

test("même tâche deux fois : aucun double effet", async () => {
  const { state, world, now } = settled();
  // Même instant rejoué : aucun cycle de plus.
  const before = JSON.stringify(world);
  advanceWorld(state, now);
  advanceWorld(state, now);
  assert.equal(JSON.stringify(world), before);
  // Même ordre donné deux fois dans le même cycle : la clé l'empêche.
  const m = Object.values(world.mysteries).find((x) => x.status === "open");
  const inv = Object.values(world.people).find((p) => p.kind === "resident" && p.status === "active");
  applyAction(state, "world.investigate", { mysteryId: m.id, personId: inv.id }, now);
  assert.throws(() => applyAction(state, "world.investigate", { mysteryId: m.id, personId: inv.id }, now), OfficeError);
  // Deux chargements simultanés du même QG : un seul monde monté.
  const service = new OfficeService({ repository: createMemoryRepository(), logger: quiet });
  const [o1, o2] = await Promise.all([service.get("same"), service.get("same")]);
  assert.equal(o1, o2);
  await service.stop();
});

test("explorer : du bâtiment à la fiche d'un personnage (données réelles, écrans Telegram)", () => {
  const { state, world, now } = settled();
  const building = exploreQuery(state, { view: "building" }, now);
  assert.equal(building.population, Object.values(world.people).filter((p) => p.status !== "gone").length);
  assert.ok(building.population >= 240, `~250 habitants (${building.population})`);
  const floor = building.floors.find((f) => f.people > 0 && !f.access);
  const fv = exploreQuery(state, { view: "floor", id: floor.id }, now);
  const room = fv.rooms.find((r) => r.people > 0);
  const rv = exploreQuery(state, { view: "room", id: room.id }, now);
  assert.equal(rv.total, Object.values(world.people).filter((p) => p.location === room.id).length, "les présents sont ceux qui y sont vraiment");
  const person = rv.present[0];
  const pv = exploreQuery(state, { view: "person", id: person.id }, now);
  assert.equal(pv.name, world.people[person.id].name);
  assert.equal(pv.location.id, room.id);
  // Le même parcours dans Telegram (un seul message édité, bouton retour à chaque écran).
  for (const route of ["menu", "b", `f:${floor.id}`, `r:${room.id}:0`, `p:${person.id}`, "d:0", "n:0", "i", "e", "pol", "a", "h", "c"]) {
    const screen = screenFor(state, route, now);
    assert.ok(screen.text.length > 20 && screen.text.length <= 4096, `écran ${route}`);
    const buttons = screen.keyboard.reply_markup.inline_keyboard.flat();
    for (const b of buttons) assert.ok(Buffer.byteLength(b.callback_data) <= 64, `callback ≤ 64 octets (${b.callback_data})`);
    if (route !== "menu") assert.ok(buttons.some((b) => /^mx:(menu|b|f:|d:)/.test(b.callback_data) && b.text.startsWith("⬅️")), `retour depuis ${route}`);
  }
  assert.ok(screenFor(state, `r:${room.id}:0`, now).text.includes(world.people[person.id].name));
  assert.ok(screenFor(state, `p:${person.id}`, now).text.includes(room.name.slice(0, 12)));
  // Les outils de test ne s'affichent pas sans autorisation.
  const control = JSON.stringify(screenFor(state, "c", now).keyboard);
  assert.ok(!control.includes("mx:t"), "pas de mode test sans autorisation");
  assert.ok(JSON.stringify(screenFor(state, "c", now, { dev: true }).keyboard).includes("mx:t"));
});

test("permissions : le mode test du chaos est réservé, les interventions sont séparées", () => {
  const { state, world, now } = settled();
  assert.throws(() => applyAction(state, "world.debug.cycles", { n: 2 }, now), /réservé/);
  assert.throws(() => applyAction(state, "world.debug.replay", { cycles: 4 }, now), /réservé/);
  const runtime = new OfficeRuntime({ state, now: () => now });
  assert.throws(() => runtime.dispatch("world.debug.event", { template: "friendship" }), /réservé/);
  const cycle = world.cycle;
  const res = applyAction(state, "world.debug.cycles", { n: 2 }, now, { devTools: true }).public;
  assert.equal(res.to, cycle + 2);
  assert.ok(world.owner.debug?.length || world.owner.actions.some((a) => a.kind === "debug" || /debug/.test(a.type)), "les outils de test sont journalisés à part");
  const replay = applyAction(state, "world.debug.replay", { cycles: 6 }, now, { devTools: true }).public;
  assert.equal(world.cycle, cycle + 2, "le rejeu se fait dans un bac à sable, sans toucher au monde");
  assert.deepEqual(replay.problems, []);
});

test("rapport d'absence chiffré : comptes issus du moteur et temps non simulé avoué", () => {
  const { state, world, now } = settled();
  const since = now;
  const { now: back } = run(state, now, 8 * HOUR);
  const r = buildReport(world, { since, until: back });
  assert.match(r.title, /^RAPPORT D'ABSENCE — 8 HEURES$/);
  assert.ok(r.absence.cycles >= 15 && r.absence.cycles <= 18, `cycles simulés (${r.absence.cycles})`);
  const inWindow = world.events.filter((e) => e.at > since && e.at <= back).length;
  assert.ok(r.absence.counts.events >= inWindow, "les comptes ne sont pas inférieurs au journal");
  assert.ok(r.absence.counts.events <= inWindow + 12, "ni gonflés");
  assert.match(r.text, /En chiffres/);
  assert.equal(r.absence.skippedHours, 0);
  // Serveur arrêté 10 jours : le rapport dit ce qui n'a pas été simulé.
  const later = back + 10 * DAY;
  for (let i = 0; i < 30; i++) advanceWorld(state, later + i);
  const r2 = buildReport(world, { since: back, until: later + 30 });
  assert.ok(r2.absence.skippedHours > 24, `temps non simulé (${r2.absence.skippedHours} h)`);
  assert.match(r2.text, /PAS été simulées/);
});

test("persistance séparée : QG et Bâtiment sauvegardés à part, rien n'est perdu au redémarrage", async () => {
  const repo = createMemoryRepository();
  const a = new OfficeService({ repository: repo, holder: "A", logger: quiet });
  const office = await a.get("u1");
  office.runtime.apply((s) => catchUp(s, Date.now() + 6 * HOUR));
  const w = office.runtime.state.world;
  const snapshot = { cycle: w.cycle, locations: Object.fromEntries(Object.values(w.people).map((p) => [p.id, p.location])), events: w.events.length, relations: Object.keys(w.relations).length };
  await a.stop();
  const stored = repo.peek("u1");
  assert.equal(stored.office.world, undefined, "office_state ne contient plus le monde");
  assert.equal(stored.world.cycle, snapshot.cycle, "madhouse_world a le monde à jour");
  const b = new OfficeService({ repository: repo, holder: "B", logger: quiet });
  const again = await b.get("u1");
  const w2 = again.runtime.state.world;
  assert.equal(again.runtime.worldActive, true, "le bail libéré est repris");
  assert.equal(w2.cycle, snapshot.cycle);
  assert.equal(w2.events.length, snapshot.events);
  assert.equal(Object.keys(w2.relations).length, snapshot.relations);
  assert.deepEqual(Object.fromEntries(Object.values(w2.people).map((p) => [p.id, p.location])), snapshot.locations);
  // Un monde plus ancien n'écrase jamais un monde plus avancé.
  const old = structuredClone(w2);
  old.cycle -= 5;
  assert.deepEqual(await repo.saveWorld("u1", old, { holder: "B" }), { ok: false, reason: "stale" });
  await b.stop();

  // Ancienne sauvegarde (monde dans office_state) : reprise puis déplacement vers madhouse_world.
  const legacy = createMemoryRepository();
  const st = createInitialState(T0, { bossName: "Cartman", tzOffset: PARIS });
  run(st, T0, 2 * HOUR);
  await legacy.save("u2", st);
  const c = new OfficeService({ repository: legacy, holder: "C", logger: quiet });
  const o3 = await c.get("u2");
  assert.ok(o3.runtime.state.world.cycle >= st.world.cycle, "le monde de l'ancienne sauvegarde est repris");
  await c.stop();
  assert.equal(legacy.peek("u2").office.world, undefined);
  assert.ok(legacy.peek("u2").world.cycle >= st.world.cycle);

  // Écriture du monde en échec (réseau…) : l'ancienne copie n'est jamais retirée d'office_state.
  const flaky = createMemoryRepository();
  await flaky.save("u3", st);
  const failing = { ...flaky, saveWorld: async () => { throw new Error("réseau coupé"); } };
  const d = new OfficeService({ repository: failing, holder: "D", logger: quiet });
  await d.get("u3");
  await d.stop();
  assert.ok(flaky.peek("u3").office.world?.people, "le monde reste dans office_state tant qu'il n'est pas ailleurs");
});

test("bail : deux instances ne simulent jamais le même monde en même temps", async () => {
  let clock = Date.now();
  const repo = createMemoryRepository({ now: () => clock });
  const a = new OfficeService({ repository: repo, holder: "A", logger: quiet });
  const oa = await a.get("u1");
  assert.equal(oa.runtime.worldActive, true);
  const b = new OfficeService({ repository: repo, holder: "B", logger: quiet });
  const ob = await b.get("u1");
  assert.equal(ob.runtime.worldActive, false, "la seconde instance est en lecture seule");
  assert.throws(() => ob.runtime.dispatch("world.follow", { personId: "r-arlette" }), /autre instance/);
  const cycle = ob.runtime.state.world.cycle;
  ob.runtime.state.world.lastCycleAt -= 5 * HOUR; // même en retard, elle ne simule pas
  ob.runtime.tick();
  assert.equal(ob.runtime.state.world.cycle, cycle);
  assert.ok(exploreQuery(ob.runtime.state, { view: "building" }), "mais le Bâtiment reste visitable");
  // A s'arrête (ou son bail expire) : B reprend la main avec le monde le plus récent.
  oa.runtime.apply((s) => catchUp(s, Date.now() + 3 * HOUR));
  const aheadCycle = oa.runtime.state.world.cycle;
  await a.stop();
  clock += 1000;
  await b.renewLeases();
  assert.equal(ob.runtime.worldActive, true);
  assert.equal(ob.runtime.state.world.cycle, aheadCycle, "monde rechargé depuis la base");
  await b.stop();
});

test("migration v1 → v2 : une vraie sauvegarde v1 devient visitable sans rien perdre", () => {
  const { state: v1 } = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/madhouse-v1-state.json.gz", import.meta.url))).toString());
  assert.equal(v1.world.version, 1);
  const oldPeople = Object.keys(v1.world.people);
  const oldEvents = v1.world.events.map((e) => e.id);
  const oldMoney = expectedMoney(v1.world);
  const state = migrateState(structuredClone(v1), T0 + DAY);
  const w = state.world;
  assert.equal(w.version, 2);
  for (const id of oldPeople) assert.ok(w.people[id], `${id} existe toujours`);
  for (const id of oldEvents) assert.ok(w.events.some((e) => e.id === id), "le passé n'est pas réécrit");
  assert.ok(w.events.some((e) => e.kind === "renumbering"), "la migration est consignée dans l'histoire");
  assert.ok(Object.keys(w.people).length >= 240, "le Bâtiment se remplit (~250)");
  for (const p of Object.values(w.people)) if (p.location) assert.ok(w.building.rooms[p.location], `${p.id} a une pièce valide`);
  assert.ok(w.money.initial + w.money.minted + (w.money.arrivals || 0) >= oldMoney);
  assert.deepEqual(checkInvariants(w, w.money.initial + w.money.minted + (w.money.arrivals || 0)), []);
  run(state, T0 + DAY, DAY);
  assert.deepEqual(w.errors || [], []);
  assert.equal(w.stats.rollbacks || 0, 0);
  assert.equal(migrateState(state, T0 + 3 * DAY).world.version, 2, "idempotente");
});
