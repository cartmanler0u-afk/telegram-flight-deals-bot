// Mémoire du Bâtiment : journal d'événements immuable (avec liens de causalité), faits et
// connaissances par personnage, rumeurs, hypothèses et chronique compactée.
//
// Statuts d'un fait :
//   confirmed  — fait établi (public ou privé)
//   secret     — fait réel connu d'un petit cercle
//   rumor      — information qui circule ; sa véracité (truth) est cachée au joueur
//   hypothesis — théorie formulée par un personnage ; vraie, fausse ou partielle
// Un personnage ne « sait » que les faits où il figure dans knownBy (ou les faits publics).

import { clampText, localParts, worldId } from "./core.js";
import { logInRoom } from "./building.js";

// Au-delà de ce nombre de personnes informées, une rumeur est « de notoriété publique ».
export const WIDESPREAD = 60;

export const LIMITS = { events: 450, facts: 420, chronicleDays: 90, linesPerDay: 12, memories: 14, ledger: 300, appliedKeys: 2500, relations: 1800, metrics: 24 * 8, beliefs: 12, closedPlots: 30, closedArcs: 20, closedMysteries: 8, judgedCases: 25, deadLaws: 15, createdObjects: 40 };

// Ne garde que les `keep` éléments clos les plus récents d'une collection (les ouverts restent tous).
function pruneClosed(store, isClosed, recency, keep, protect = () => false) {
  const closed = Object.values(store || {}).filter((x) => isClosed(x) && !protect(x)).sort((a, b) => recency(b) - recency(a));
  for (const x of closed.slice(keep)) delete store[x.id];
}

// ------------------------------------------------------------------ faits

export function addFact(world, { kind = "fact", text, about = [], status = "confirmed", truth = true, public: isPublic = false, knownBy = [], source = null, mystery = null, variantOf = null, data = null }) {
  const fact = {
    id: worldId(world, "fa"),
    cycle: world.cycle,
    kind,
    text: clampText(text, 240),
    about: [...new Set(about.filter(Boolean))],
    status,
    truth,
    public: !!isPublic,
    knownBy: [...new Set(knownBy.filter(Boolean))],
    source,
    mystery,
    variantOf,
  };
  if (data) fact.data = data;
  world.facts[fact.id] = fact;
  for (const id of fact.knownBy) learn(world, id, fact.id);
  return fact;
}

export function knows(world, personId, factId) {
  const fact = world.facts[factId];
  if (!fact) return false;
  return fact.public || fact.knownBy.includes(personId);
}

export function learn(world, personId, factId) {
  const fact = world.facts[factId];
  const person = world.people[personId];
  if (!fact || !person) return false;
  if (!fact.public && !fact.knownBy.includes(personId)) {
    fact.knownBy.push(personId);
    if (fact.knownBy.length > WIDESPREAD && fact.status !== "secret") {
      fact.public = true;
      fact.widespread = world.cycle;
    }
  }
  if (!person.knows.includes(factId)) {
    person.knows.push(factId);
    if (person.knows.length > 60) person.knows.splice(0, person.knows.length - 60);
  }
  return true;
}

// Ce que le personnage pense d'une information : il y croit, il doute, ou il compte s'en servir.
export function believe(world, personId, factId, stance) {
  const person = world.people[personId];
  if (!person) return;
  if (!Array.isArray(person.beliefs)) person.beliefs = [];
  const existing = person.beliefs.find((b) => b.fact === factId);
  if (existing) Object.assign(existing, { stance, cycle: world.cycle });
  else person.beliefs.push({ fact: factId, stance, cycle: world.cycle });
  if (person.beliefs.length > 16) person.beliefs.shift();
}

export function publicize(world, factId) {
  const fact = world.facts[factId];
  if (fact) fact.public = true;
  return fact;
}

// Ce qu'un personnage sait (ou croit savoir) sur un sujet donné.
export function knowledgeOf(world, personId, aboutId = null) {
  return Object.values(world.facts).filter((f) => knows(world, personId, f.id) && (!aboutId || f.about.includes(aboutId)));
}

// Les rumeurs circulent entre proches ; un secret qui fuit devient une rumeur, parfois déformée.
export function spreadRumors(world, rng, friendsOf) {
  const gossips = Object.values(world.people).filter((p) => p.status !== "missing" && (p.traits.includes("gossip") || rng.chance(0.08)));
  const spread = [];
  for (const person of gossips) {
    const candidates = person.knows.map((id) => world.facts[id]).filter((f) => f && !f.public && f.status !== "hypothesis");
    if (!candidates.length) continue;
    const fact = rng.pick(candidates);
    const friends = friendsOf(person.id).filter((id) => world.people[id] && !knows(world, id, fact.id));
    if (!friends.length) continue;
    const listener = rng.pick(friends);
    if (fact.status === "secret") {
      // Fuite : le secret devient une rumeur (exacte ou déformée).
      if (!rng.chance(0.25)) continue;
      const distorted = rng.chance(0.3);
      const rumor = addFact(world, {
        kind: "rumor",
        text: distorted ? `On raconte que ${fact.text.charAt(0).toLowerCase()}${fact.text.slice(1)} — mais les détails changent selon qui le raconte.` : `Il paraît que ${fact.text.charAt(0).toLowerCase()}${fact.text.slice(1)}`,
        about: fact.about,
        status: "rumor",
        truth: distorted ? null : fact.truth,
        knownBy: [person.id, listener],
        source: fact.source,
        mystery: fact.mystery,
        variantOf: fact.id,
      });
      spread.push({ from: person.id, to: listener, fact: rumor, leak: true });
    } else {
      learn(world, listener, fact.id);
      spread.push({ from: person.id, to: listener, fact, leak: false });
    }
  }
  return spread;
}

// ------------------------------------------------------------------ événements

export function recordEvent(world, { kind, title, text, actors = [], causes = [], importance = 2, rare = false, plotId = null, facts = [], public: isPublic = true, tags = [], key = null, room = null, source = "natural", dialogue = null, tier = null }, now) {
  const event = {
    id: worldId(world, "ev"),
    cycle: world.cycle,
    at: now,
    kind,
    title: clampText(title, 120),
    text: clampText(text, 600),
    actors: [...new Set(actors.filter(Boolean))],
    causes: [...new Set(causes.filter(Boolean))],
    importance,
    rare: !!rare,
    plotId,
    facts,
    public: !!isPublic,
    tags,
    key,
  };
  // Où ça s'est passé : la pièce explicite, sinon celle du premier acteur.
  const where = room || world.people[event.actors[0]]?.location || null;
  if (where && world.building.rooms?.[where]) event.room = where;
  if (source !== "natural") event.source = source;
  if (tier) event.tier = tier;
  if (dialogue?.length) event.dialogue = dialogue.slice(0, 6).map((l) => ({ who: l.who, line: clampText(l.line, 220) }));
  world.events.push(event);
  if (event.room) logInRoom(world, event.room, event);
  for (const id of event.actors) {
    const person = world.people[id];
    if (!person) continue;
    person.lastSeenCycle = world.cycle;
    person.mentions = (person.mentions || 0) + 1;
    // Dernières actions (consultables sur la fiche, même quand le journal global est compacté).
    person.recent ||= [];
    person.recent.push({ cycle: world.cycle, text: clampText(event.title, 80), id: event.id });
    if (person.recent.length > 5) person.recent.shift();
    if (importance >= 3) {
      person.memories.push(event.id);
      if (person.memories.length > LIMITS.memories) person.memories.shift();
    }
  }
  return event;
}

export function findEvent(world, id) {
  return world.events.find((e) => e.id === id) || null;
}

// Chaîne causale : on remonte les causes (la plus ancienne d'abord) jusqu'à l'événement.
export function causalChain(world, eventId, depth = 6) {
  const chain = [];
  const seen = new Set();
  let current = findEvent(world, eventId);
  while (current && chain.length < depth && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    const parent = current.causes.map((id) => findEvent(world, id)).filter(Boolean).sort((a, b) => b.importance - a.importance)[0];
    current = parent;
  }
  return chain;
}

// ------------------------------------------------------------------ compaction

// Les vieux événements mineurs sont résumés dans la chronique ; rien d'important n'est perdu.
export function compact(world) {
  const protectedIds = new Set();
  for (const plot of Object.values(world.plots)) if (plot.state === "active" || plot.state === "dormant") for (const id of plot.beats.slice(-6)) protectedIds.add(id);
  if (world.events.length > LIMITS.events) {
    const excess = world.events.length - LIMITS.events;
    const removable = world.events.filter((e) => !protectedIds.has(e.id)).sort((a, b) => a.importance - b.importance || a.cycle - b.cycle).slice(0, excess);
    const drop = new Set(removable.map((e) => e.id));
    for (const e of removable) {
      if (e.importance < 3) continue;
      const day = localParts(world, e.at).dayKey;
      let entry = world.chronicle.find((c) => c.day === day);
      if (!entry) {
        entry = { day, lines: [] };
        world.chronicle.push(entry);
        world.chronicle.sort((a, b) => a.day.localeCompare(b.day));
      }
      if (entry.lines.length < LIMITS.linesPerDay) entry.lines.push({ cycle: e.cycle, importance: e.importance, text: e.title });
    }
    world.events = world.events.filter((e) => !drop.has(e.id));
    for (const p of Object.values(world.people)) p.memories = p.memories.filter((id) => !drop.has(id));
    for (const plot of Object.values(world.plots)) plot.beats = plot.beats.filter((id) => !drop.has(id));
  }
  if (world.chronicle.length > LIMITS.chronicleDays) world.chronicle.splice(0, world.chronicle.length - LIMITS.chronicleDays);
  if (world.ledger.length > LIMITS.ledger) world.ledger.splice(0, world.ledger.length - LIMITS.ledger);
  // Les clés de dédoublonnage très anciennes sont oubliées (l'état lui-même protège contre
  // une seconde application : entreprise déjà en faillite, indice déjà trouvé, loi déjà votée…).
  // Les relations les plus tièdes s'effacent quand il y en a trop (les fortes restent).
  const rels = Object.entries(world.relations || {});
  if (rels.length > LIMITS.relations) {
    rels.sort((a, b) => Math.abs(a[1].ab ?? a[1].score) + Math.abs(a[1].ba ?? a[1].score) - (Math.abs(b[1].ab ?? b[1].score) + Math.abs(b[1].ba ?? b[1].score)));
    for (const [key] of rels.slice(0, rels.length - LIMITS.relations)) delete world.relations[key];
  }
  if ((world.metrics || []).length > LIMITS.metrics) world.metrics.splice(0, world.metrics.length - LIMITS.metrics);
  const keys = Object.keys(world.applied);
  if (keys.length > LIMITS.appliedKeys) for (const k of keys) if (world.cycle - world.applied[k] > 30 * 48) delete world.applied[k];

  // Croyances et connaissances qui pointent vers des faits oubliés ; consignes de déplacement expirées.
  for (const p of Object.values(world.people)) {
    if (p.beliefs?.length) p.beliefs = p.beliefs.filter((b) => world.facts[b.fact]).slice(-LIMITS.beliefs);
    if (p.knows?.length) p.knows = p.knows.filter((id) => world.facts[id]);
    if (p.flags?.goTo && !(p.flags.goTo.until > world.cycle)) delete p.flags.goTo;
  }
  // Affaires closes : on garde les plus récentes (le reste vit dans la chronique et les carrières).
  pruneClosed(world.plots, (x) => !["active", "dormant"].includes(x.state), (x) => x.lastBeatCycle ?? x.createdCycle ?? 0, LIMITS.closedPlots);
  const latestArc = {};
  for (const a of Object.values(world.arcs || {})) if (!latestArc[a.kind] || a.startedCycle > latestArc[a.kind].startedCycle) latestArc[a.kind] = a;
  pruneClosed(world.arcs, (x) => !["active", "dormant"].includes(x.state), (x) => x.lastCycle ?? x.startedCycle ?? 0, LIMITS.closedArcs, (x) => latestArc[x.kind] === x);
  pruneClosed(world.mysteries, (x) => x.status !== "open", (x) => x.solvedCycle ?? x.openedCycle ?? 0, LIMITS.closedMysteries);
  pruneClosed(world.cases, (x) => x.status === "judged" || x.status === "closed", (x) => x.judgedCycle ?? x.filedCycle ?? 0, LIMITS.judgedCases);
  pruneClosed(world.laws, (x) => ["rejected", "repealed", "annulled"].includes(x.status), (x) => x.cycle ?? x.votedCycle ?? 0, LIMITS.deadLaws);
  // Objets apparus en cours de route : les plus anciens finissent aux objets trouvés… puis à la benne.
  const busy = JSON.stringify([Object.values(world.arcs || {}).filter((a) => ["active", "dormant"].includes(a.state)), Object.values(world.mysteries).filter((m) => m.status === "open")]);
  pruneClosed(world.objects, (o) => o.createdCycle !== undefined && world.cycle - o.createdCycle > 14 * 48, (o) => o.createdCycle, LIMITS.createdObjects, (o) => busy.includes(o.id));

  const facts = Object.values(world.facts);
  if (facts.length > LIMITS.facts) {
    // On oublie d'abord les vieux faits publics anodins, jamais les secrets ni les indices de mystère.
    const removable = facts.filter((f) => f.status !== "secret" && !f.mystery && f.kind !== "promise").sort((a, b) => a.cycle - b.cycle).slice(0, facts.length - LIMITS.facts);
    for (const f of removable) {
      delete world.facts[f.id];
      for (const id of f.knownBy) {
        const p = world.people[id];
        if (p) p.knows = p.knows.filter((x) => x !== f.id);
      }
    }
  }
}
