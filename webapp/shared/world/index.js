// Orchestrateur du Bâtiment 0 (THE MADHOUSE).
//
// Un CYCLE = 30 minutes de temps du Bâtiment (configurable). Le temps du Bâtiment suit le
// temps réel : à chaque tic de l'horloge du QG, on exécute les cycles échus (rattrapage
// borné après une absence ou un redémarrage). Chaque cycle :
//   1. charge l'état et un contexte (heure locale, hasard déterministe graine+cycle) ;
//   2. exécute les systèmes déterministes (conséquences différées, économie, politique,
//      agents, mystères, anomalies, médias, rumeurs, CHAOS DIRECTOR, intrigues) ;
//   3. chaque changement passe par une proposition validée (ops.js), journalisée ;
//   4. vérifie les invariants (masse monétaire, soldes, organisations) : en cas d'échec,
//      le cycle entier est annulé (retour à l'instantané) et l'incident est journalisé ;
//   5. compacte la mémoire et choisit, avec parcimonie, ce qui mérite une notification.
// Rejouer un cycle après un crash produit le même résultat (hasard dérivé de la graine).

import { DAY, HOUR, hash, makeRng, localParts, clampText } from "./core.js";
import { createWorld, syncPeople, topUpPopulation, migrateWorldV1, defaultConfig, WORLD_VERSION } from "./state.js";
import { commit as commitProposal, checkInvariants, accountOf } from "./ops.js";
import { compact, knows } from "./memory.js";
import { lifeCycle } from "./life.js";
import { eventsCycle, templateById, fire, TEMPLATES } from "./events.js";
import { arcsCycle, startArc, ARC_DEFS } from "./arcs.js";
import { LAW_CATALOG } from "./cast.js";
import { DEPTS } from "./castgen.js";
import { accessDenied, floorOf } from "./building.js";
import { credits } from "./core.js";
import { economyCycle } from "./economy.js";
import { politicsCycle, hasLaw } from "./politics.js";
import { agentsCycle, influenceCycle } from "./agents.js";
import { mysteriesCycle, anomaliesCycle } from "./wtf.js";
import { mediaCycle } from "./media.js";
import { attachToPlots, plotsFromEvent, plotsCycle, runScheduled, directorCycle, decide, expireDecisions } from "./director.js";
import { buildReport, eventCategories } from "./report.js";
import { queueAiJobs } from "./ai.js";
import { buildingOverview, floorView, roomView, personView, directoryView, newsView, investigationsView, companiesView, politicsView, anomaliesView, historyView, controlCenter, objectView } from "./explore.js";

export { worldView, personSheet } from "./view.js";
export { buildingOverview, floorView, roomView, personView, directoryView, newsView, investigationsView, companiesView, politicsView, anomaliesView, historyView, controlCenter, objectView, clock } from "./explore.js";
export { buildReport } from "./report.js";
export { pendingWorldJobs, worldJobPacket, attachWorldNarration } from "./ai.js";

const FRIEND_KINDS = new Set(["ami", "bff", "couple"]);
const RELATION_KINDS = new Set(["ami", "bff", "couple", "crush", "rival", "ex", "mentor"]);

// Ordre d'exécution des systèmes dans un cycle.
const SYSTEMS = [
  ["scheduled", runScheduled],
  ["life", lifeCycle],
  ["economy", economyCycle],
  ["politics", politicsCycle],
  ["agents", agentsCycle],
  ["events", eventsCycle],
  ["arcs", arcsCycle],
  ["mysteries", mysteriesCycle],
  ["anomalies", anomaliesCycle],
  ["media", mediaCycle],
  ["population", populationCycle],
  ["director", directorCycle],
  ["plots", plotsCycle],
  ["influence", influenceCycle],
  ["decisions", expireDecisions],
];

// ------------------------------------------------------------------ création & migration

export function ensureWorld(state, now) {
  if (!state.world || typeof state.world !== "object" || !state.world.people) {
    state.world = createWorld(state, now);
    return state.world;
  }
  const w = state.world;
  if ((w.version || 1) < 2) {
    // v1 → v2 : la « Grande Renumérotation ». Rien n'est effacé : tout est déménagé, et consigné.
    const res = migrateWorldV1(w, state, now);
    commitProposal(w, {
      source: "system",
      kind: "renumbering",
      key: "migration:v2",
      ops: [{ op: "building", mood: -2 }],
      event: { kind: "renumbering", title: "La Grande Renumérotation", text: `Le Syndic renumérote tout le Bâtiment : chaque service déménage, l'Étage 13 devient l'Étage 10 (que l'ascenseur ignore toujours), ton entreprise monte au 11 et la Banque du Sous-Sol s'installe au 3e sans changer de nom. ${res.arrivals} nouveaux habitants emménagent. Les archives d'avant gardent les anciens numéros.`, actors: ["r-arlette"].filter((id) => w.people[id]), importance: 4, rare: true, tags: ["bâtiment", "administration"] },
    }, { now, setRelation: () => {} });
  }
  // Migrations futures : compléter sans jamais réécrire l'historique.
  w.relations ||= {};
  w.flags ||= {};
  w.decisions ||= [];
  w.jobs ||= [];
  w.notifications ||= [];
  const base = defaultConfig();
  w.config = { ...base, ...w.config, rarity: { ...base.rarity, ...(w.config.rarity || {}) }, distribution: { ...base.distribution, ...(w.config.distribution || {}) } };
  w.config.notify = { ...defaultNotify(), ...(w.config.notify || {}) };
  w.config.ai = { available: false, enabled: true, dailyCalls: 8, ...(w.config.ai || {}) };
  w.metrics ||= [];
  w.money.arrivals ||= 0;
  w.notifyState ||= { day: null, sent: 0, lastSentAt: 0 };
  w.version = WORLD_VERSION;
  return w;
}

function defaultNotify() {
  return { minImportance: 4, maxPerDay: 2, minGapMinutes: 120, quietStart: 23, quietEnd: 8, dailyReport: true, reportHour: 9 };
}

// ------------------------------------------------------------------ relations

const relKey = (a, b) => [a, b].sort().join("|");
const isEmployee = (state, id) => (state.agents || []).some((a) => a.id === id);

export function relationBetween(state, a, b) {
  const key = relKey(a, b);
  return state.world?.relations?.[key] || state.life?.relations?.[key] || null;
}

function allRelations(state) {
  return [...Object.values(state.life?.relations || {}), ...Object.values(state.world?.relations || {})];
}

// Sentiment de `from` envers `to` (relations asymétriques du Bâtiment). Le type de relation
// découle des deux sentiments ; les relations entre employés du QG restent symétriques.
function feel(state, from, to, delta, kind, note, now) {
  const world = state.world;
  const key = relKey(from, to);
  if (isEmployee(state, from) && isEmployee(state, to) && state.life?.relations) {
    const prev = state.life.relations[key];
    const score = Math.max(-100, Math.min(100, Math.round((prev?.score || 0) + delta / 2)));
    return setRelation(state, from, to, kind || prev?.kind || (score < -30 ? "rival" : "ami"), score, note, now);
  }
  const [x, y] = [from, to].sort();
  let r = world.relations[key];
  if (!r) {
    if (Math.abs(delta) < 3 && !kind) return null; // un bavardage anodin ne crée pas de relation
    r = world.relations[key] = { a: x, b: y, kind: "connaissance", score: 0, ab: 0, ba: 0, since: now, note: "" };
    world.metricsMet = (world.metricsMet || 0) + 1;
  }
  const dir = r.a === from ? "ab" : "ba";
  r[dir] = Math.max(-100, Math.min(100, Math.round((r[dir] ?? r.score ?? 0) + delta)));
  r.score = Math.round(((r.ab ?? 0) + (r.ba ?? 0)) / 2);
  const before = r.kind;
  let next = kind || r.kind;
  if (!kind) {
    const lo = Math.min(r.ab, r.ba);
    if (r.kind === "couple" && r.score < -10) next = "ex";
    else if (r.kind !== "couple" && lo <= -35) next = "rival";
    else if (r.kind === "rival" && lo >= 15) next = "ami";
    else if (["connaissance", "ami"].includes(r.kind) && r.ab >= 70 && r.ba >= 70) next = "bff";
    else if (r.kind === "connaissance" && r.ab >= 30 && r.ba >= 30) next = "ami";
  }
  if (next !== before) {
    r.kind = next;
    r.since = now;
    world.metricsPending = (world.metricsPending || 0) + 1;
  }
  if (note) r.note = clampText(note, 160);
  return r;
}

// Les relations entre deux employés de l'Étage 11 vivent dans le QG (panneau RH) ;
// toutes les autres vivent dans le monde du Bâtiment.
function setRelation(state, a, b, kind, score, note, now) {
  if (!RELATION_KINDS.has(kind)) kind = score < 0 ? "rival" : "ami";
  const key = relKey(a, b);
  const store = isEmployee(state, a) && isEmployee(state, b) && state.life?.relations ? state.life.relations : state.world.relations;
  const prev = store[key];
  const [x, y] = [a, b].sort();
  store[key] = {
    a: x,
    b: y,
    kind,
    score: Math.max(-100, Math.min(100, Math.round(score ?? prev?.score ?? 0))),
    ...(store === state.world.relations ? { ab: Math.round(score ?? prev?.ab ?? 0), ba: Math.round(score ?? prev?.ba ?? 0) } : {}),
    since: prev?.kind === kind ? prev.since : now,
    note: clampText(note ?? (prev?.kind === kind ? prev.note : ""), 160),
    from: prev?.from ?? null,
  };
  return store[key];
}

// ------------------------------------------------------------------ contexte d'un cycle

function makeContext(state, at, rng) {
  const world = state.world;
  const parts = localParts(world, world.simTime ?? at);
  const cx = {
    world,
    state,
    rng,
    now: at,
    simTime: world.simTime ?? at,
    cycle: world.cycle,
    hour: parts.hour,
    weekday: parts.weekday,
    dayKey: parts.dayKey,
    commit: (proposal) => commitProposal(world, proposal, ctx),
    // Vrai une seule fois par jour du Bâtiment pour une clé donnée.
    once(key) {
      if (world.daily[key] === parts.dayKey) return false;
      world.daily[key] = parts.dayKey;
      return true;
    },
    relation: (a, b) => relationBetween(state, a, b),
    relations: () => allRelations(state),
    friendsOf: (id) => allRelations(state).filter((r) => (r.a === id || r.b === id) && FRIEND_KINDS.has(r.kind)).map((r) => (r.a === id ? r.b : r.a)),
    hasLaw: (code) => hasLaw(world, code),
    recent: (filter, cycles) => world.events.filter((e) => world.cycle - e.cycle <= cycles && filter(e)),
    knowsClue: (personId, mysteryId, text) => Object.values(world.facts).some((f) => f.mystery === mysteryId && f.kind === "clue" && f.text === text && knows(world, personId, f.id)),
    feel: (from, to, delta, kind = null, note = null) => feel(state, from, to, delta, kind, note, at),
    metric: (name, n = 1) => metric(world, name, n),
  };
  const ctx = {
    now: at,
    feel: (from, to, delta, kind, note) => feel(state, from, to, delta, kind, note, at),
    setRelation: (a, b, kind, score, note) => setRelation(state, a, b, kind, score, note, at),
    onEvent: (event, proposal) => onEvent(cx, event, proposal),
  };
  return cx;
}

function onEvent(cx, event, proposal) {
  const { world } = cx;
  if (event) {
    attachToPlots(world, event);
    plotsFromEvent(cx, event);
    metric(world, "events", 1);
    if (event.rare) {
      metric(world, "rare", 1);
      if (event.room) metric(world, `rare_${floorOf(event.room)}`, 1);
    }
    if (event.tags?.includes("rumeur")) metric(world, "rumors", 1);
    if (proposal.source === "boss") metric(world, "owner", 1);
    // Catégories du rapport d'absence, comptées au moment des faits (le journal, lui, est compacté).
    for (const cat of eventCategories(event)) metric(world, `cat_${cat}`, 1);
    if (eventCategories(event).includes("pertes")) {
      const lost = world.ledger.slice(-40).filter((tx) => tx.eventId === event.id && tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
      if (lost) metric(world, "money_lost", lost);
    }
  }
  let decision = null;
  if (proposal.decision) {
    const d = proposal.decision;
    const duplicate = world.decisions.some((x) => x.status === "open" && x.kind === d.kind && (x.person || x.company || x.org || null) === (d.person || d.company || d.org || null));
    if (!duplicate) {
      decision = { id: `dc${world.cycle.toString(36)}_${(world.seq = (world.seq || 0) + 1).toString(36)}`, cycle: world.cycle, at: cx.now, eventId: event?.id || null, status: "open", ...d, title: clampText(d.title, 140) };
      world.decisions.push(decision);
    }
  }
  queueNotification(cx, event, decision);
}

// Une notification n'est envisagée que pour ce qui compte vraiment, et jamais pour des
// cycles rattrapés après une longue absence (ils iront dans le rapport « Pendant ton absence »).
function queueNotification(cx, event, decision) {
  const { world } = cx;
  if (!event && !decision) return;
  if (cx.realNow - cx.now > 2 * HOUR || cx.now <= world.createdAt) return;
  const cfg = world.config.notify;
  const worthy = decision || (event.public && (event.importance >= cfg.minImportance || event.rare));
  if (!worthy) return;
  world.notifications.push({
    id: `nt${world.cycle.toString(36)}_${(world.seq = (world.seq || 0) + 1).toString(36)}`,
    cycle: world.cycle,
    at: cx.now,
    eventId: event?.id || null,
    decisionId: decision?.id || null,
    importance: decision ? 6 : event.importance + (event.rare ? 1 : 0),
    status: "pending",
  });
  if (world.notifications.length > 60) world.notifications.splice(0, world.notifications.length - 60);
}

// ------------------------------------------------------------------ cycle

function runCycle(state, at, realNow) {
  const before = state.world;
  const snapshot = structuredClone(before);
  const relSnapshot = state.life?.relations ? structuredClone(state.life.relations) : null;

  const world = state.world;
  world.cycle += 1;
  world.lastCycleAt = at;
  world.simTime = (world.simTime ?? at - world.config.cycleMinutes * 60000) + world.config.cycleMinutes * 60000;
  const rng = makeRng(hash(`${world.seed}:${world.cycle}`));
  metric(world, "cycles", 1);
  const cx = makeContext(state, at, rng);
  cx.realNow = realNow;
  const appliedBefore = world.stats.applied;

  for (const [name, system] of SYSTEMS) {
    try {
      system(cx);
    } catch (err) {
      logError(world, name, err);
    }
  }

  if (world.metricsPending) {
    metric(world, "relations", world.metricsPending);
    world.metricsPending = 0;
  }
  if (world.metricsMet) {
    metric(world, "met", world.metricsMet);
    world.metricsMet = 0;
  }
  const problems = checkInvariants(world, expectedMoney(world));
  if (problems.length) {
    // Cycle annulé : on revient à l'instantané, on avance quand même l'horloge pour ne pas
    // rejouer indéfiniment le même cycle fautif, et l'incident est conservé.
    state.world = snapshot;
    if (relSnapshot) state.life.relations = relSnapshot;
    snapshot.cycle += 1;
    snapshot.lastCycleAt = at;
    snapshot.simTime = world.simTime;
    snapshot.stats.rollbacks = (snapshot.stats.rollbacks || 0) + 1;
    logError(snapshot, "invariants", new Error(problems.slice(0, 3).join(" ; ")));
    return { rolledBack: true, problems };
  }
  if (world.cycle % 12 === 0) compact(world);
  return { rolledBack: false, applied: world.stats.applied - appliedBefore };
}

export function expectedMoney(world) {
  return world.money.initial + world.money.minted + (world.money.arrivals || 0);
}

// Statistiques par heure de temps simulé (base du rapport d'absence chiffré).
function metric(world, name, n = 1) {
  const hourKey = Math.floor((world.simTime ?? world.lastCycleAt) / HOUR);
  let bucket = world.metrics.at(-1);
  if (!bucket || bucket.h !== hourKey) {
    bucket = { h: hourKey, at: world.lastCycleAt };
    world.metrics.push(bucket);
    if (world.metrics.length > 24 * 8) world.metrics.shift();
  }
  bucket.last = world.lastCycleAt;
  bucket[name] = (bucket[name] || 0) + n;
}

// La population suit le réglage : les nouveaux arrivent par petits groupes (avec leurs économies).
function populationCycle(cx) {
  const { world } = cx;
  if (!(cx.hour >= 9 && cx.hour < 18)) return;
  const arrivals = topUpPopulation(world, cx.now, { max: 3 });
  if (!arrivals.length) return;
  const names = arrivals.map((p) => p.name);
  cx.commit({
    source: "system",
    kind: "newcomers",
    allowRepeat: true,
    ops: arrivals.map((p) => ({ op: "person", id: p.id, career: `Arrivé au Bâtiment (${p.title})` })),
    event: { kind: "newcomers", title: `${arrivals.length > 1 ? `${arrivals.length} nouveaux habitants` : `Un nouvel habitant`} : ${names.join(", ")}`, text: `L'Ascenseur B les a déposés au rez-de-chaussée avec leurs cartons. ${arrivals[0].name} (${arrivals[0].title}) demande déjà où se trouve « le vrai pouvoir ».`, actors: arrivals.map((p) => p.id), room: "f0.hall", importance: 2, tags: ["arrivée"] },
  });
}

function logError(world, where, err) {
  world.errors.push({ cycle: world.cycle, where, message: String(err?.message || err).slice(0, 200), at: String(err?.stack || "").split("\n")[1]?.trim().slice(0, 160) });
  if (world.errors.length > 30) world.errors.splice(0, world.errors.length - 30);
}

// Fait avancer le Bâtiment jusqu'à `now`. Retourne { changed, notes }.
export function advanceWorld(state, now) {
  const notes = [];
  const world = ensureWorld(state, now);
  let changed = false;
  if (Number.isFinite(state.settings?.tzOffset)) world.tzOffset = state.settings.tzOffset;

  // Le QG et le Bâtiment restent synchronisés (embauches, licenciements, chats).
  const changes = syncPeople(world, state, now);
  if (changes.length) {
    changed = true;
    recordArrivals(state, changes, now);
  }

  if (world.config.paused) {
    if (changed) world.rev = (world.rev || 0) + 1;
    return { changed, notes };
  }
  // Durée réelle d'un cycle : cycleMinutes de temps simulé, divisés par la vitesse du temps.
  const step = Math.max(1, (Math.max(5, world.config.cycleMinutes) * 60000) / Math.max(0.1, world.config.timeScale || 1));
  const backlog = now - world.lastCycleAt;
  if (backlog > world.config.maxBacklogDays * DAY) {
    // Absence trop longue : le Bâtiment « saute » le temps manquant, et le consigne (pas de
    // simulation fictive : le rapport dira honnêtement que ce temps n'a pas été simulé).
    const skipped = Math.floor((backlog - world.config.maxBacklogDays * DAY) / step);
    world.gaps ||= [];
    world.gaps.push({ from: world.lastCycleAt, to: world.lastCycleAt + skipped * step, cycles: skipped });
    if (world.gaps.length > 20) world.gaps.shift();
    world.lastCycleAt += skipped * step;
    world.simTime = (world.simTime ?? world.lastCycleAt) + skipped * world.config.cycleMinutes * 60000;
    world.skipped = (world.skipped || 0) + skipped;
    changed = true;
  }
  let ran = 0;
  while (world.lastCycleAt + step <= now && ran < world.config.maxCatchUp) {
    runCycle(state, state.world.lastCycleAt + step, now);
    ran += 1;
    changed = true;
  }
  if (ran && queueAiJobs(state.world, now)) changed = true;
  if (ran) notes.push(...flushNotifications(state, now));
  else if (state.world.notifications.some((n) => n.status === "pending")) {
    const out = flushNotifications(state, now);
    if (out.length) {
      notes.push(...out);
      changed = true;
    }
  }
  // Révision du monde : le serveur ne réécrit madhouse_world que lorsqu'elle change.
  if (changed) state.world.rev = (state.world.rev || 0) + 1;
  return { changed, notes };
}

function recordArrivals(state, changes, now) {
  const world = state.world;
  const ctx = { now, setRelation: (a, b, kind, score, note) => setRelation(state, a, b, kind, score, note, now) };
  for (const c of changes) {
    const p = c.person;
    const text = {
      arrival: p.kind === "animal" ? [`${p.name} s'installe à l'Étage 11`, `Un nouveau chat dans le Bâtiment. Gustave, depuis son aquarium, le fixe longuement.`] : [`${p.name} rejoint ton entreprise à l'Étage 11`, `Badge, plante verte réglementaire et formulaire B-12 : ${p.name} est désormais occupant du Bâtiment.`],
      fired: [`${p.name} est licencié de l'Étage 11… mais reste dans le Bâtiment`, `Sans badge ni bureau, ${p.name} erre désormais entre les étages. Le Bâtiment ne laisse partir personne.`],
      rehired: [`${p.name} retrouve un poste à l'Étage 11`, `Retour discret. Le Registre n'avait pas encore fini de le rayer.`],
    }[c.kind];
    if (!text) continue;
    commitProposal(world, { source: "system", kind: c.kind === "arrival" ? "arrival" : c.kind, allowRepeat: true, observational: true, event: { kind: c.kind === "arrival" ? "arrival" : c.kind, title: text[0], text: text[1], actors: [p.id], importance: c.kind === "fired" ? 3 : 2, tags: ["carrière"] } }, ctx);
  }
}

// ------------------------------------------------------------------ notifications

function inQuietHours(cfg, hour) {
  const { quietStart: s, quietEnd: e } = cfg;
  return s === e ? false : s < e ? hour >= s && hour < e : hour >= s || hour < e;
}

// Politique anti-spam : heures calmes, plafond quotidien, délai minimal, regroupement.
// Ce qui n'est pas envoyé n'est pas perdu : tout figure dans le rapport « Pendant ton absence ».
export function flushNotifications(state, now) {
  const world = state.world;
  const cfg = world.config.notify;
  const ns = (world.notifyState ||= { day: null, sent: 0, lastSentAt: 0 });
  const { hour, dayKey } = localParts(world, now);
  if (ns.day !== dayKey) Object.assign(ns, { day: dayKey, sent: 0 });
  const notes = [];

  for (const n of world.notifications) if (n.status === "pending" && now - n.at > 3 * HOUR) n.status = "digest";
  const pending = world.notifications.filter((n) => n.status === "pending");

  if (pending.length && !inQuietHours(cfg, hour) && ns.sent < cfg.maxPerDay && now - ns.lastSentAt >= cfg.minGapMinutes * 60000) {
    const batch = pending.sort((a, b) => b.importance - a.importance || a.at - b.at).slice(0, 3);
    const items = batch
      .map((n) => {
        const d = n.decisionId ? world.decisions.find((x) => x.id === n.decisionId && x.status === "open") : null;
        const e = n.eventId ? world.events.find((x) => x.id === n.eventId) : null;
        if (!d && !e) return null;
        return { title: d ? d.title : e.title, text: e?.text || "", eventId: e?.id || null, decisionId: d?.id || null, rare: !!e?.rare };
      })
      .filter(Boolean);
    for (const n of batch) n.status = "sent";
    if (items.length) {
      ns.sent += 1;
      ns.lastSentAt = now;
      notes.push({ kind: "world_alert", items, text: `🏢 Bâtiment 0 — ${items.map((i) => `${i.decisionId ? "🧾" : i.rare ? "✨" : "⚡"} ${i.title}`).join(" · ")}` });
    }
  }
  for (const n of pending) if (n.status === "pending" && pending.length > 6) n.status = "digest";

  // Rapport quotidien « Pendant ton absence » (une fois par jour, s'il s'est passé quelque chose).
  const rep = world.report;
  if (cfg.dailyReport && hour >= cfg.reportHour && !inQuietHours(cfg, hour) && rep.lastSentDay !== dayKey) {
    const since = Math.max(rep.lastSeenAt || 0, rep.lastSentAt || 0);
    const report = buildReport(world, { since, until: now });
    rep.lastSentDay = dayKey;
    if (report.notable >= 2) {
      rep.lastSentAt = now;
      notes.push({ kind: "world_report", report, text: report.text });
    }
  }
  if (world.notifications.length > 60) world.notifications.splice(0, world.notifications.length - 60);
  return notes;
}

// ------------------------------------------------------------------ actions du joueur

export class WorldError extends Error {}

const CONFIG_LIMITS = {
  cycleMinutes: [5, 240],
  maxCatchUp: [1, 96],
  maxBacklogDays: [1, 14],
  minImportance: [2, 6],
  maxPerDay: [0, 12],
  minGapMinutes: [0, 1440],
  quietStart: [0, 23],
  quietEnd: [0, 23],
  reportHour: [0, 23],
  dailyCalls: [0, 200],
  population: [50, 400],
  chaos: [0, 100],
  maxEventsPerCycle: [0, 20],
  maxInteractionsPerCycle: [0, 60],
};
const FLOAT_LIMITS = { timeScale: [0.25, 24], rarity: [0, 5] };

function floatIn(key, value) {
  const n = Number(value);
  const [a, b] = FLOAT_LIMITS[key];
  if (!Number.isFinite(n) || n < a || n > b) throw new WorldError(`Valeur invalide pour ${key} (${a}–${b}).`);
  return Math.round(n * 100) / 100;
}

// Journal des interventions du propriétaire (séparé des événements naturels et du débogage).
function logOwner(world, now, type, summary, kind = "actions") {
  world.owner ||= { follows: [], actions: [], debug: [] };
  world.owner[kind].push({ at: now, cycle: world.cycle, type, summary: clampText(summary, 160) });
  if (world.owner[kind].length > 40) world.owner[kind].shift();
}

function ownerContext(state, now, salt) {
  const world = state.world;
  const cx = makeContext(state, now, makeRng(hash(`${world.seed}:${salt}:${world.cycle}`)));
  cx.realNow = now;
  cx.occupancy = {};
  for (const p of Object.values(world.people)) if (p.location) (cx.occupancy[p.location] ||= []).push(p);
  return cx;
}

function needPerson(world, id) {
  const p = world.people[id];
  if (!p || ["gone", "missing"].includes(p.status)) throw new WorldError("Personnage introuvable (ou introuvable pour l'instant).");
  return p;
}

function ownerCommit(cx, proposal) {
  const res = cx.commit({ source: "boss", ...proposal, event: proposal.event && { ...proposal.event, source: "player", tags: [...(proposal.event.tags || []), "propriétaire"] } });
  if (!res.ok) throw new WorldError(res.errors[0]);
  return res;
}

// Mode test du chaos : uniquement en développement ou pour un administrateur autorisé.
function debugAction(state, type, payload, now) {
  const world = state.world;
  const cx = ownerContext(state, now, "debug");
  if (type === "world.debug.cycles") {
    const n = Math.max(1, Math.min(96, Math.round(Number(payload.n) || 1)));
    const before = world.events.length ? world.events.at(-1).id : null;
    const start = world.cycle;
    const step = Math.max(5, world.config.cycleMinutes) * 60000;
    for (let i = 0; i < n; i++) runCycle(state, state.world.lastCycleAt + step / Math.max(0.1, world.config.timeScale || 1), now);
    const w = state.world;
    const idx = before ? w.events.findIndex((e) => e.id === before) : -1;
    const created = w.events.slice(idx + 1);
    logOwner(w, now, type, `${n} cycle(s) simulé(s) (${start} → ${w.cycle}), ${created.length} événement(s)`, "debug");
    w.rev = (w.rev || 0) + 1;
    return { ok: true, cycles: n, from: start, to: w.cycle, events: created.slice(-30).map((e) => ({ id: e.id, title: e.title, kind: e.kind, tier: e.tier || null, room: e.room || null })), decisions: w.proposals.slice(-20).map((p) => ({ kind: p.kind, status: p.status, errors: p.errors || [] })), problems: checkInvariants(w, expectedMoney(w)) };
  }
  if (type === "world.debug.event") {
    const t = templateById(String(payload.template || ""));
    if (!t) throw new WorldError(`Modèle inconnu. Disponibles : ${TEMPLATES.map((x) => x.id).join(", ")}`);
    const res = fire(cx, t, { source: "debug" });
    if (!res?.ok) throw new WorldError(res?.errors?.[0] || "Préconditions non réunies pour ce modèle (personne au bon endroit, au bon moment ?).");
    logOwner(world, now, type, `Événement de test : ${res.event.title}`, "debug");
    return { ok: true, title: res.event.title, event: res.event.id };
  }
  if (type === "world.debug.arc") {
    if (!ARC_DEFS[payload.kind]) throw new WorldError(`Arc inconnu. Disponibles : ${Object.keys(ARC_DEFS).join(", ")}`);
    const arc = startArc(cx, payload.kind, { source: "debug" });
    if (!arc) throw new WorldError("Impossible de démarrer cet arc maintenant (acteurs ou conditions manquants).");
    logOwner(world, now, type, `Arc de test : ${arc.title}`, "debug");
    return { ok: true, title: arc.title, arc: arc.id };
  }
  if (type === "world.debug.check") return { ok: true, problems: consistencyCheck(world) };
  if (type === "world.debug.replay") {
    // Rejoue une copie isolée du monde avec une graine contrôlée : le vrai monde n'est pas touché.
    const sandbox = { ...structuredClone({ ...state, world: undefined }), world: structuredClone(world) };
    sandbox.world.seed = Math.round(Number(payload.seed)) >>> 0 || 1;
    const n = Math.max(1, Math.min(192, Math.round(Number(payload.cycles) || 48)));
    const startLen = sandbox.world.events.length;
    const step = Math.max(5, sandbox.world.config.cycleMinutes) * 60000;
    for (let i = 0; i < n; i++) runCycle(sandbox, sandbox.world.lastCycleAt + step, now);
    const created = sandbox.world.events.slice(Math.max(0, startLen - (world.events.length - sandbox.world.events.length)));
    return { ok: true, seed: sandbox.world.seed, cycles: n, events: sandbox.world.events.slice(-25).map((e) => ({ title: e.title, kind: e.kind, tier: e.tier || null })), count: created.length, problems: consistencyCheck(sandbox.world) };
  }
  throw new WorldError(`Outil de test inconnu : ${type}`);
}

// Vérifications de cohérence (en plus des invariants appliqués à chaque cycle).
export function consistencyCheck(world) {
  const problems = [...checkInvariants(world, expectedMoney(world))];
  for (const p of Object.values(world.people)) {
    for (const id of p.knows || []) {
      const f = world.facts[id];
      if (f && !f.public && !f.knownBy.includes(p.id)) problems.push(`${p.id} « sait » ${id} sans l'avoir appris`);
    }
    if (p.flags?.goTo && !world.building.rooms[p.flags.goTo.room]) problems.push(`${p.id} doit aller dans une pièce inexistante`);
  }
  for (const r of Object.values(world.relations)) if (!world.people[r.a] || !world.people[r.b]) problems.push(`relation orpheline ${r.a}|${r.b}`);
  for (const o of Object.values(world.objects || {})) if (!world.building.rooms[o.room]) problems.push(`objet ${o.id} dans une pièce inexistante`);
  const keys = new Set();
  for (const e of world.events) {
    if (e.key && keys.has(e.key)) problems.push(`événement en double (${e.key})`);
    if (e.key) keys.add(e.key);
  }
  return problems.slice(0, 30);
}

function intIn(key, value) {
  const n = Math.round(Number(value));
  const [a, b] = CONFIG_LIMITS[key];
  if (!Number.isFinite(n) || n < a || n > b) throw new WorldError(`Valeur invalide pour ${key} (${a}–${b}).`);
  return n;
}

// Actions « world.* » (mini app et Telegram). Le patron observe et arbitre ; il ne réécrit pas
// le Bâtiment : chaque action passe par le validateur comme n'importe quelle proposition.
export function applyWorldAction(state, type, payload, now, { devTools = false } = {}) {
  const world = ensureWorld(state, now);
  if (type.startsWith("world.debug.")) {
    if (!devTools) throw new WorldError("Mode test du chaos réservé au développement et aux administrateurs autorisés.");
    return debugAction(state, type, payload, now);
  }
  switch (type) {
    case "world.follow":
    case "world.unfollow": {
      const p = needPerson(world, payload.personId);
      world.owner ||= { follows: [], actions: [], debug: [] };
      world.owner.follows = type === "world.follow" ? [...new Set([...world.owner.follows, p.id])].slice(-12) : world.owner.follows.filter((id) => id !== p.id);
      logOwner(world, now, type, `${type === "world.follow" ? "Suit" : "Ne suit plus"} ${p.name}`);
      return { ok: true, title: type === "world.follow" ? `Tu suis désormais ${p.name}` : `Tu ne suis plus ${p.name}` };
    }
    case "world.organize": {
      // Organiser un événement fictif dans une pièce : les invités s'y rendent réellement.
      const room = world.building.rooms[payload.roomId];
      if (!room || !room.discovered || room.access === "owner") throw new WorldError("Pièce inaccessible pour un événement.");
      const kinds = { fete: ["une fête", 150], seminaire: ["un séminaire de cohésion", 120], tournoi: ["un tournoi de baby-foot", 100], conference: ["une conférence sur l'avenir du Bâtiment", 80] };
      const [label, cost] = kinds[payload.kind] || kinds.fete;
      const cx = ownerContext(state, now, `organize:${room.id}`);
      const guests = cx.rng.shuffle(Object.values(world.people).filter((p) => p.status === "active" && p.kind !== "animal" && p.activity?.kind !== "sleep" && !accessDenied(world, p, room, { hour: cx.hour }))).slice(0, 12);
      const res = ownerCommit(cx, {
        kind: "owner_event",
        ops: [{ op: "transfer", from: "boss", to: "treasury", amount: cost, reason: `Organisation : ${label}` }, ...guests.map((p) => ({ op: "person", id: p.id, set: { flags: { ...p.flags, goTo: { room: room.id, until: world.cycle + 3, reason: `Invité à ${label}` } } } })), { op: "schedule", dueCycle: world.cycle + 3, kind: "gathering_end", payload: { room: room.id, label, guests: guests.map((p) => p.id) } }],
        event: { kind: "owner_event", title: `Le propriétaire organise ${label} ${room.name.startsWith("L") ? "dans " : "à "}${room.name}`, text: `${guests.length} invité(s) : ${guests.slice(0, 5).map((p) => p.name).join(", ")}${guests.length > 5 ? "…" : ""}. Budget : ${credits(cost)}.`, actors: guests.slice(0, 4).map((p) => p.id), room: room.id, importance: 3, tags: ["fête", "vie sociale"] },
      });
      logOwner(world, now, type, res.event.title);
      return { ok: true, title: res.event.title };
    }
    case "world.proposeLaw": {
      const def = LAW_CATALOG[payload.code];
      if (!def) throw new WorldError("Loi inconnue du catalogue.");
      if (Object.values(world.laws).some((l) => l.status === "proposed")) throw new WorldError("Une loi est déjà en discussion à l'Hémicycle : il faut attendre son vote.");
      const cx = ownerContext(state, now, `law:${payload.code}`);
      const deputy = cx.rng.pick(world.parliament.seats.map((id) => world.people[id]).filter((d) => d && d.status === "active" && d.kind !== "animal"));
      if (!deputy) throw new WorldError("Aucun député disponible pour porter le texte.");
      const law = { id: `lw${world.cycle.toString(36)}_${(world.seq = (world.seq || 0) + 1).toString(36)}`, code: payload.code, title: def.title, text: def.text, sponsor: deputy.id, lobby: { [deputy.id]: 3 }, byOwner: true };
      const res = ownerCommit(cx, {
        kind: "owner_law",
        ops: [{ op: "transfer", from: "boss", to: accountOf("p", deputy.id), amount: 200, reason: "Frais de « conseil législatif » (propriétaire)" }, { op: "law", action: "propose", law }],
        event: { kind: "law_proposed", title: `Proposition de loi (soufflée par le propriétaire) : ${def.title}`, text: `${deputy.name} accepte de porter le texte : « ${def.text} » Le vote aura lieu en séance ; rien n'est garanti.`, actors: [deputy.id], room: "f6.hemicycle", importance: 3, tags: ["politique", "loi"] },
      });
      world.laws[law.id].eventId = res.event.id;
      logOwner(world, now, type, res.event.title);
      return { ok: true, title: res.event.title };
    }
    case "world.challenge": {
      const [d1, d2] = [payload.deptA, payload.deptB];
      if (!DEPTS[d1] || !DEPTS[d2] || d1 === d2) throw new WorldError("Choisis deux services différents.");
      const cx = ownerContext(state, now, `challenge:${d1}:${d2}`);
      const champ = (d) => cx.rng.pick(Object.values(world.people).filter((p) => p.dept === d && p.status === "active" && p.kind !== "animal"));
      const a = champ(d1);
      const b = champ(d2);
      if (!a || !b) throw new WorldError("Pas de champion disponible dans l'un des services.");
      const contest = cx.rng.pick(["une course de chaises à roulettes", "un concours de pliage de rapports", "un quiz sur le règlement intérieur", "un concours de la meilleure excuse"]);
      const winner = cx.rng.chance(0.5 + ((a.skills.charisma || 5) - (b.skills.charisma || 5)) / 20) ? a : b;
      const loser = winner === a ? b : a;
      const res = ownerCommit(cx, {
        kind: "owner_challenge",
        ops: [{ op: "transfer", from: "boss", to: "treasury", amount: 100, reason: "Trophée en carton (défi du propriétaire)" }, { op: "person", id: winner.id, reputation: 5, career: `Vainqueur du défi du propriétaire : ${contest}` }, { op: "feel", from: loser.id, to: winner.id, delta: -10, note: "Défi perdu." }],
        event: { kind: "competition", title: `Défi du propriétaire : ${DEPTS[d1].label} contre ${DEPTS[d2].label} (${contest})`, text: `${winner.name} l'emporte. ${loser.name} réclame un match retour, puis un recours, puis une commission d'enquête.`, actors: [winner.id, loser.id], room: "f0.hall", importance: 3, tags: ["compétition"] },
      });
      logOwner(world, now, type, res.event.title);
      return { ok: true, title: res.event.title };
    }
    case "world.fund": {
      const c = world.companies[payload.companyId];
      const amount = Math.round(Number(payload.amount));
      if (!c || c.status !== "active") throw new WorldError("Entreprise introuvable ou fermée.");
      if (!Number.isFinite(amount) || amount < 50 || amount > 5000) throw new WorldError("Montant entre 50 et 5 000 cr.");
      const cx = ownerContext(state, now, `fund:${c.id}`);
      const n = Math.min(Math.floor(amount / 100), c.shares[c.ceo] || 0);
      const res = ownerCommit(cx, {
        kind: "owner_fund",
        ops: [{ op: "transfer", from: "boss", to: accountOf("c", c.id), amount, reason: `Financement du propriétaire (${c.name})` }, ...(n > 0 ? [{ op: "company", id: c.id, action: "shares", from: c.ceo, to: "boss", n }] : [])],
        event: { kind: "owner_fund", title: `Le propriétaire finance ${c.name} (${credits(amount)})`, text: `${world.people[c.ceo]?.name || "La direction"} remercie chaleureusement, puis demande « et pour la suite ? ». Tu détiens ${n} part(s) de plus.`, actors: [c.ceo], importance: 3, tags: ["économie"] },
      });
      logOwner(world, now, type, res.event.title);
      return { ok: true, title: res.event.title };
    }
    case "world.promote": {
      const p = needPerson(world, payload.personId);
      const title = clampText(payload.title || `${p.title} (promu·e par le propriétaire)`, 60);
      const cx = ownerContext(state, now, `promote:${p.id}`);
      const rival = cx.relations().find((r) => (r.a === p.id || r.b === p.id) && r.kind === "rival");
      const res = ownerCommit(cx, {
        kind: "owner_promotion",
        ops: [{ op: "person", id: p.id, set: { title, salary: Math.round((p.salary || 0) * 1.2) }, career: `Promu par le propriétaire : ${title}`, reputation: 5 }, ...(rival ? [{ op: "feel", from: rival.a === p.id ? rival.b : rival.a, to: p.id, delta: -15, note: "Promu par piston (du propriétaire)." }] : [])],
        event: { kind: "promotion", title: `Le propriétaire promeut ${p.name} : ${title}`, text: `${p.name} change de badge. ${rival ? `${world.people[rival.a === p.id ? rival.b : rival.a]?.name} encaisse très mal.` : "Les collègues applaudissent, certains sincèrement."}`, actors: [p.id], importance: 3, tags: ["carrière"] },
      });
      logOwner(world, now, type, res.event.title);
      return { ok: true, title: res.event.title };
    }
    case "world.investigateRumor": {
      // Le propriétaire commande une enquête : le verdict dépendra des faits ET de l'enquêteur.
      const fact = world.facts[payload.factId];
      if (!fact || !fact.public || fact.status !== "rumor") throw new WorldError("Rumeur introuvable (seules les rumeurs publiques peuvent faire l'objet d'une enquête).");
      if (fact.investigation) throw new WorldError("Une enquête est déjà en cours ou close sur cette rumeur.");
      const cx = ownerContext(state, now, `rumor:${fact.id}`);
      const inv = Object.values(world.people).filter((p) => p.status === "active" && p.kind !== "animal" && (p.dept === "tribunal" || p.skills.investigation >= 8)).sort((a, b) => b.skills.investigation - a.skills.investigation)[0];
      if (!inv) throw new WorldError("Aucun enquêteur disponible.");
      fact.investigation = { by: inv.id, cycle: world.cycle };
      const res = ownerCommit(cx, {
        kind: "owner_investigation",
        ops: [{ op: "transfer", from: "boss", to: accountOf("p", inv.id), amount: 120, reason: "Enquête commandée par le propriétaire" }, { op: "schedule", dueCycle: world.cycle + cx.rng.int(6, 18), kind: "rumor_verdict", payload: { fact: fact.id, by: inv.id } }],
        event: { kind: "investigation", title: `Le propriétaire commande une enquête : « ${clampText(fact.text, 70)} »`, text: `${inv.name} est chargé de vérifier. Verdict attendu dans quelques heures.`, actors: [inv.id], room: "f9.enquetes", importance: 2, tags: ["enquête", "rumeur"] },
      });
      logOwner(world, now, type, res.event.title);
      return { ok: true, title: res.event.title };
    }
    case "world.seen":
      world.report.lastSeenAt = now;
      return { ok: true };
    case "world.decide": {
      const cx = makeContext(state, now, makeRng(hash(`${world.seed}:decision:${payload.decisionId}`)));
      cx.realNow = now;
      try {
        const res = decide(cx, String(payload.decisionId || ""), payload.choice === "yes" ? "yes" : "no");
        return { ok: true, title: res.event?.title || "Décision enregistrée" };
      } catch (err) {
        throw new WorldError(err.message);
      }
    }
    case "world.investigate": {
      // Le patron peut orienter une enquête (meilleures chances de trouver un indice),
      // jamais la résoudre : les conditions de résolution restent celles du mystère.
      const m = world.mysteries[payload.mysteryId];
      if (!m) throw new WorldError("Mystère inconnu.");
      if (m.status !== "open") throw new WorldError("Ce mystère n'est plus ouvert.");
      const p = world.people[payload.personId];
      if (!p || !["active", "admin_dead", "double"].includes(p.status) || p.kind === "animal") throw new WorldError("Cet enquêteur n'est pas disponible.");
      const cx = makeContext(state, now, makeRng(hash(`${world.seed}:investigate:${world.cycle}`)));
      cx.realNow = now;
      const res = cx.commit({
        source: "boss",
        kind: "investigation",
        key: `focus:${m.id}:${p.id}:${world.cycle}`,
        ops: [{ op: "mystery", id: m.id, action: "investigator", person: p.id }],
        event: { kind: "investigation", title: `Tu confies l'enquête « ${m.title} » à ${p.name}`, text: `${p.name} reçoit un carnet neuf et une lampe de poche. Aucune garantie de résultat : le Bâtiment ne se laisse pas interroger si facilement.`, actors: [p.id], importance: 2, tags: ["mystère", "décision"] },
      });
      if (!res.ok) throw new WorldError(res.errors[0]);
      m.focus = p.id;
      return { ok: true, title: res.event.title };
    }
    case "world.config": {
      // Réglages techniques (réservé à l'administrateur : vérifié par le serveur et le bot).
      const cfg = world.config;
      for (const key of ["cycleMinutes", "maxCatchUp", "maxBacklogDays", "population", "chaos", "maxEventsPerCycle", "maxInteractionsPerCycle"]) if (payload[key] !== undefined) cfg[key] = intIn(key, payload[key]);
      if (payload.timeScale !== undefined) cfg.timeScale = floatIn("timeScale", payload.timeScale);
      for (const tier of ["common", "rare", "very_rare", "legendary"]) if (payload[`rarity_${tier}`] !== undefined) cfg.rarity[tier] = floatIn("rarity", payload[`rarity_${tier}`]);
      if (payload.dialogue !== undefined) {
        if (!["bref", "normal", "riche"].includes(payload.dialogue)) throw new WorldError("Niveau de dialogue : bref, normal ou riche.");
        cfg.dialogue = payload.dialogue;
      }
      for (const key of ["minImportance", "maxPerDay", "minGapMinutes", "quietStart", "quietEnd", "reportHour"]) if (payload[key] !== undefined) cfg.notify[key] = intIn(key, payload[key]);
      if (payload.dailyReport !== undefined) cfg.notify.dailyReport = !!payload.dailyReport;
      if (payload.paused !== undefined) {
        cfg.paused = !!payload.paused;
        if (!cfg.paused) world.lastCycleAt = Math.max(world.lastCycleAt, now - cfg.cycleMinutes * 60000);
      }
      if (payload.aiEnabled !== undefined) cfg.ai.enabled = !!payload.aiEnabled;
      // Jamais au-delà du plafond fixé par l'opérateur (variable d'environnement côté serveur).
      if (payload.dailyCalls !== undefined) cfg.ai.dailyCalls = Math.min(intIn("dailyCalls", payload.dailyCalls), cfg.ai.cap ?? 0);
      return { ok: true, config: structuredClone(cfg) };
    }
    default:
      throw new WorldError(`Action inconnue : ${type}`);
  }
}

// Résumé minuscule pour l'état client (le monde complet est servi à la demande).
export function worldBadge(world) {
  if (!world) return null;
  const since = world.report?.lastSeenAt || 0;
  return {
    name: world.name,
    cycle: world.cycle,
    mood: world.mood,
    pressure: Math.round(world.building.pressure),
    unread: world.events.filter((e) => e.public && e.importance >= 3 && e.at > since).length,
    decisions: world.decisions.filter((d) => d.status === "open").length,
    headline: world.events.filter((e) => e.public && e.importance >= 3).at(-1)?.title || null,
  };
}

// Point d'entrée unique des écrans d'exploration (mini app et bot).
export function exploreQuery(state, payload = {}, now = Date.now()) {
  const world = ensureWorld(state, now);
  const v = String(payload.view || "building");
  const page = Math.max(0, Math.round(Number(payload.page) || 0));
  switch (v) {
    case "building": return buildingOverview(world, state, now);
    case "floor": return floorView(world, state, String(payload.id || ""), now);
    case "room": return roomView(world, state, String(payload.id || ""), { page });
    case "person": return personView(world, state, String(payload.id || ""));
    case "object": return objectView(world, String(payload.id || ""));
    case "directory": return directoryView(world, { page, floor: payload.floor || null, dept: payload.dept || null, q: String(payload.q || "").slice(0, 40) });
    case "news": return newsView(world, { page });
    case "investigations": return investigationsView(world);
    case "companies": return companiesView(world);
    case "politics": return politicsView(world);
    case "anomalies": return anomaliesView(world);
    case "history": return historyView(world);
    case "control": return controlCenter(world, state, now);
    case "report": return buildReport(world, { since: world.report.lastSeenAt, until: now });
    default: throw new WorldError(`Écran inconnu : ${v}`);
  }
}
