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
import { createWorld, syncPeople, WORLD_VERSION } from "./state.js";
import { commit as commitProposal, checkInvariants } from "./ops.js";
import { spreadRumors, compact, knows } from "./memory.js";
import { economyCycle } from "./economy.js";
import { politicsCycle, hasLaw } from "./politics.js";
import { agentsCycle, influenceCycle } from "./agents.js";
import { mysteriesCycle, anomaliesCycle } from "./wtf.js";
import { mediaCycle } from "./media.js";
import { attachToPlots, plotsFromEvent, plotsCycle, runScheduled, directorCycle, decide, expireDecisions } from "./director.js";
import { buildReport } from "./report.js";
import { queueAiJobs } from "./ai.js";

export { worldView, personSheet } from "./view.js";
export { buildReport } from "./report.js";
export { pendingWorldJobs, worldJobPacket, attachWorldNarration } from "./ai.js";

const FRIEND_KINDS = new Set(["ami", "bff", "couple"]);
const RELATION_KINDS = new Set(["ami", "bff", "couple", "crush", "rival", "ex", "mentor"]);

// Ordre d'exécution des systèmes dans un cycle.
const SYSTEMS = [
  ["scheduled", runScheduled],
  ["economy", economyCycle],
  ["politics", politicsCycle],
  ["agents", agentsCycle],
  ["mysteries", mysteriesCycle],
  ["anomalies", anomaliesCycle],
  ["media", mediaCycle],
  ["rumors", (cx) => spreadRumors(cx.world, cx.rng, cx.friendsOf)],
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
  // Migrations futures : compléter sans jamais réécrire l'historique.
  w.relations ||= {};
  w.flags ||= {};
  w.decisions ||= [];
  w.jobs ||= [];
  w.notifications ||= [];
  w.config.notify = { ...defaultNotify(), ...(w.config.notify || {}) };
  w.config.ai = { available: false, enabled: true, dailyCalls: 8, ...(w.config.ai || {}) };
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

// Les relations entre deux employés de l'Étage 1 vivent dans le QG (panneau RH) ;
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
    since: prev?.kind === kind ? prev.since : now,
    note: clampText(note ?? (prev?.kind === kind ? prev.note : ""), 160),
    from: prev?.from ?? null,
  };
  return store[key];
}

// ------------------------------------------------------------------ contexte d'un cycle

function makeContext(state, at, rng) {
  const world = state.world;
  const parts = localParts(world, at);
  const cx = {
    world,
    state,
    rng,
    now: at,
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
  };
  const ctx = {
    now: at,
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
  const rng = makeRng(hash(`${world.seed}:${world.cycle}`));
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

  const problems = checkInvariants(world, world.money.initial + world.money.minted);
  if (problems.length) {
    // Cycle annulé : on revient à l'instantané, on avance quand même l'horloge pour ne pas
    // rejouer indéfiniment le même cycle fautif, et l'incident est conservé.
    state.world = snapshot;
    if (relSnapshot) state.life.relations = relSnapshot;
    snapshot.cycle += 1;
    snapshot.lastCycleAt = at;
    snapshot.stats.rollbacks = (snapshot.stats.rollbacks || 0) + 1;
    logError(snapshot, "invariants", new Error(problems.slice(0, 3).join(" ; ")));
    return { rolledBack: true, problems };
  }
  if (world.cycle % 12 === 0) compact(world);
  return { rolledBack: false, applied: world.stats.applied - appliedBefore };
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

  if (world.config.paused) return { changed, notes };
  const step = Math.max(5, world.config.cycleMinutes) * 60000;
  const backlog = now - world.lastCycleAt;
  if (backlog > world.config.maxBacklogDays * DAY) {
    // Absence trop longue : le Bâtiment « saute » le temps manquant, et le consigne.
    const skipped = Math.floor((backlog - world.config.maxBacklogDays * DAY) / step);
    world.lastCycleAt += skipped * step;
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
  return { changed, notes };
}

function recordArrivals(state, changes, now) {
  const world = state.world;
  const ctx = { now, setRelation: (a, b, kind, score, note) => setRelation(state, a, b, kind, score, note, now) };
  for (const c of changes) {
    const p = c.person;
    const text = {
      arrival: p.kind === "animal" ? [`${p.name} s'installe à l'Étage 1`, `Un nouveau chat dans le Bâtiment. Gustave, depuis son aquarium, le fixe longuement.`] : [`${p.name} rejoint ton entreprise à l'Étage 1`, `Badge, plante verte réglementaire et formulaire B-12 : ${p.name} est désormais occupant du Bâtiment.`],
      fired: [`${p.name} est licencié de l'Étage 1… mais reste dans le Bâtiment`, `Sans badge ni bureau, ${p.name} erre désormais entre les étages. Le Bâtiment ne laisse partir personne.`],
      rehired: [`${p.name} retrouve un poste à l'Étage 1`, `Retour discret. Le Registre n'avait pas encore fini de le rayer.`],
    }[c.kind];
    if (!text) continue;
    commitProposal(world, { source: "system", kind: c.kind === "arrival" ? "arrival" : c.kind, allowRepeat: true, event: { kind: c.kind === "arrival" ? "arrival" : c.kind, title: text[0], text: text[1], actors: [p.id], importance: c.kind === "fired" ? 3 : 2, tags: ["carrière"] } }, ctx);
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
};

function intIn(key, value) {
  const n = Math.round(Number(value));
  const [a, b] = CONFIG_LIMITS[key];
  if (!Number.isFinite(n) || n < a || n > b) throw new WorldError(`Valeur invalide pour ${key} (${a}–${b}).`);
  return n;
}

// Actions « world.* » (mini app et Telegram). Le patron observe et arbitre ; il ne réécrit pas
// le Bâtiment : chaque action passe par le validateur comme n'importe quelle proposition.
export function applyWorldAction(state, type, payload, now) {
  const world = ensureWorld(state, now);
  switch (type) {
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
      for (const key of ["cycleMinutes", "maxCatchUp", "maxBacklogDays"]) if (payload[key] !== undefined) cfg[key] = intIn(key, payload[key]);
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
