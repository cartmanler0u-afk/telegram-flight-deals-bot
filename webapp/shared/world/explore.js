// Vues d'exploration du Bâtiment (mini app ET Telegram) : bâtiment → étage → pièce →
// personnage, annuaire paginé, actualités, enquêtes, entreprises, politique, anomalies,
// historique et Centre de contrôle du propriétaire.
//
// Tout est construit à partir de l'état ACTUEL de la simulation : on ne fabrique jamais un
// événement pour rendre un écran intéressant. Si rien ne se passe, on le dit, et on
// propose d'aller voir ailleurs. Les secrets non révélés restent cachés (cf. view.js).

import { sortedFloors, roomsOfFloor, isGhostOpen, GHOST_FLOOR, floorOf, PALIER } from "./building.js";
import { accountOf, balance, totalMoney } from "./ops.js";
import { personSheet, economyView, mysteryView, relationsView, REL_LABELS } from "./view.js";
import { PERSONALITY, HUMOR_TAGS, HABIT_LABELS, DEPTS } from "./castgen.js";
import { localParts } from "./core.js";
import { whyLine } from "./report.js";
import { GAGS } from "./humor.js";
import { LAW_CATALOG } from "./cast.js";

const HOUR = 3600000;
const awake = (p) => p.activity?.kind !== "sleep";
const MOOD = (m) => (m >= 75 ? "😄" : m >= 55 ? "🙂" : m >= 35 ? "😐" : m >= 20 ? "😟" : "😫");

export function clock(world) {
  const t = world.simTime ?? world.lastCycleAt;
  const { hour, minute, weekday } = localParts(world, t);
  const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  return { label: `${days[weekday]} ${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`, hour, weekday };
}

function occupancy(world) {
  const map = {};
  for (const p of Object.values(world.people)) {
    if (!p.location || ["gone", "missing"].includes(p.status)) continue;
    (map[p.location] ||= []).push(p);
  }
  return map;
}

const publicEvents = (world) => world.events.filter((e) => e.public);
const eventsOnFloor = (world, floorId, since = 0) => publicEvents(world).filter((e) => e.room && floorOf(e.room) === floorId && e.at >= since);

function eventLite(world, e) {
  return {
    id: e.id,
    at: e.at,
    kind: e.kind,
    title: e.title,
    text: e.text,
    importance: e.importance,
    rare: !!e.rare,
    tier: e.tier || null,
    source: e.source || "natural",
    room: e.room || null,
    roomName: e.room ? world.building.rooms[e.room]?.name || null : null,
    actors: e.actors.map((id) => ({ id, name: world.people[id]?.name || id })),
    dialogue: (e.dialogue || []).map((d) => ({ who: world.people[d.who]?.name || d.who, line: d.line })),
    narration: e.narration?.text || null,
    why: e.importance >= 3 ? whyLine(world, e) : null,
  };
}

function floorAccess(world, f) {
  if (f.rules?.ghost && !isGhostOpen(world)) return f.discovered ? "fermé (apparaît parfois la nuit)" : "rumeur";
  if (f.status === "sealed") return "scellé";
  if (f.status === "closed") return "fermé temporairement";
  return null;
}

// ------------------------------------------------------------------ bâtiment

export function buildingOverview(world, state, now = Date.now()) {
  const occ = occupancy(world);
  const since = now - 6 * HOUR;
  const floors = sortedFloors(world)
    .filter((f) => f.discovered || f.id !== GHOST_FLOOR || isGhostOpen(world))
    .map((f) => {
      const people = f.rooms.reduce((s, id) => s + (occ[id]?.length || 0), 0);
      const awakeCount = f.rooms.reduce((s, id) => s + (occ[id]?.filter(awake).length || 0), 0);
      const recent = eventsOnFloor(world, f.id, since);
      return {
        id: f.id,
        level: f.level,
        name: f.name,
        short: f.short,
        kind: f.kind,
        blurb: f.blurb,
        people,
        awake: awakeCount,
        activity: recent.length,
        hot: recent.some((e) => e.importance >= 4 || e.rare),
        access: floorAccess(world, f),
        rule: f.rules?.temp?.text || null,
        onPlan: f.onPlan,
        lastEvent: recent.at(-1)?.title || null,
      };
    });
  const ghostRumor = !world.building.floors[GHOST_FLOOR]?.discovered && !isGhostOpen(world);
  const all = Object.values(world.people).filter((p) => !["gone"].includes(p.status));
  return {
    name: world.name,
    clock: clock(world).label,
    cycle: world.cycle,
    mood: world.mood,
    pressure: Math.round(world.building.pressure),
    elevator: world.building.elevator.mood,
    population: all.length,
    awake: all.filter(awake).length,
    missing: all.filter((p) => p.status === "missing").length,
    ghost: { open: isGhostOpen(world), rumor: ghostRumor },
    floors,
    headlines: publicEvents(world).filter((e) => e.importance >= 3).slice(-4).reverse().map((e) => eventLite(world, e)),
    decisions: world.decisions.filter((d) => d.status === "open").length,
  };
}

// ------------------------------------------------------------------ étage

export function floorView(world, state, floorId, now = Date.now()) {
  const f = world.building.floors[floorId];
  if (!f) return null;
  const occ = occupancy(world);
  const rooms = roomsOfFloor(world, floorId).filter((r) => r.discovered || r.kind === "transit");
  const recent = eventsOnFloor(world, floorId, now - 12 * HOUR);
  const people = rooms.flatMap((r) => occ[r.id] || []);
  const meetings = rooms.filter((r) => r.kind === "meeting" && (occ[r.id] || []).filter(awake).length >= 2);
  const working = people.filter((p) => p.activity?.kind === "work").length;
  const sleeping = people.filter((p) => !awake(p)).length;
  const objects = Object.values(world.objects || {}).filter((o) => floorOf(o.room) === floorId && !o.hidden);
  const notableObjects = objects.filter((o) => (o.history || []).length && o.state !== (o.baseline ?? "ok"));
  const arcs = Object.values(world.arcs || {}).filter((a) => a.state === "active" && a.events.some((id) => world.events.find((e) => e.id === id)?.room?.startsWith(`${floorId}.`)));

  // Résumé vivant, construit à partir de ce qui se passe réellement sur l'étage.
  const lines = [];
  const access = floorAccess(world, f);
  if (access) lines.push(`Accès : ${access}.`);
  if (meetings.length) lines.push(`${meetings.length === 1 ? "Une réunion est" : `${meetings.length} réunions sont`} en cours (${meetings.map((r) => r.name).join(", ")}).`);
  if (people.length) lines.push(`${people.length} personne(s) sur l'étage : ${working} au travail${sleeping ? `, ${sleeping} endormie(s)` : ""}.`);
  const highlight = recent.filter((e) => e.importance >= 2).at(-1);
  if (highlight) lines.push(`${highlight.title}.`);
  for (const o of notableObjects.slice(0, 2)) lines.push(`${o.name} : ${o.state}.`);
  if (f.rules?.temp) lines.push(`Règle du moment : ${f.rules.temp.text}`);
  for (const a of arcs.slice(0, 1)) lines.push(`Une affaire est en cours ici : « ${a.title} ».`);
  if (!people.length && !recent.length) {
    const { hour, weekday } = clock(world);
    lines.push(hour < 6 || hour >= 23 ? "L'étage dort. Les néons, eux, veillent." : weekday === 0 || weekday === 6 ? "C'est le week-end : les bureaux sont vides, les rumeurs non." : "Rien ne bouge pour l'instant. Le silence a l'air d'attendre quelque chose.");
  } else if (!lines.length) lines.push("Rien de notable pour l'instant : chacun vaque à ses occupations.");

  return {
    id: f.id,
    level: f.level,
    name: f.name,
    short: f.short,
    blurb: f.blurb,
    access,
    rule: f.rules?.temp?.text || null,
    summary: lines.join(" "),
    rooms: rooms.map((r) => {
      const here = occ[r.id] || [];
      const last = r.log.filter((l) => l.public !== false).at(-1);
      return {
        id: r.id,
        name: r.name,
        kind: r.kind,
        people: here.length,
        awake: here.filter(awake).length,
        sample: here.filter(awake).slice(0, 2).map((p) => `${p.name} ${p.activity?.label || ""}`.trim()),
        lastEvent: last ? { title: last.title, at: last.at } : null,
        locked: r.access === "owner" ? "propriétaire" : r.access === "members" ? "membres" : r.access === "staff" ? "personnel" : r.access === "ghost" && !isGhostOpen(world) ? "fantôme" : null,
        offPlan: r.onPlan === false,
      };
    }),
    events: recent.slice(-8).reverse().map((e) => eventLite(world, e)),
    arcs: arcs.map((a) => ({ id: a.id, title: a.title })),
  };
}

// ------------------------------------------------------------------ pièce

export function roomView(world, state, roomIdValue, { page = 0, per = 10 } = {}) {
  const r = world.building.rooms[roomIdValue];
  if (!r || (!r.discovered && r.kind !== "transit")) return null;
  const f = world.building.floors[r.floor];
  const here = (occupancy(world)[r.id] || []).sort((a, b) => Number(awake(b)) - Number(awake(a)) || (b.influence || 0) - (a.influence || 0));
  const pages = Math.max(1, Math.ceil(here.length / per));
  const p0 = Math.min(Math.max(0, page), pages - 1);
  const events = publicEvents(world).filter((e) => e.room === r.id).slice(-8).reverse().map((e) => eventLite(world, e));
  const older = r.log.filter((l) => l.public !== false && !events.some((e) => e.id === l.id)).slice(-5).reverse();
  const objects = Object.values(world.objects || {}).filter((o) => o.room === r.id && !o.hidden).map((o) => ({ id: o.id, name: o.name, state: o.state, desc: o.desc, history: (o.history || []).slice(-4).map((h) => h.text) }));
  const arcs = Object.values(world.arcs || {}).filter((a) => ["active", "dormant"].includes(a.state) && a.events.some((id) => world.events.find((e) => e.id === id)?.room === r.id));
  const busy = here.length ? [] : roomsOfFloor(world, r.floor).map((x) => [x, (occupancy(world)[x.id] || []).length]).filter(([x, n]) => n > 0 && x.id !== r.id).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([x, n]) => ({ id: x.id, name: x.name, people: n }));
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    desc: r.desc,
    floor: { id: f.id, name: f.name, short: f.short },
    access: r.access,
    offPlan: r.onPlan === false,
    rule: f.rules?.temp?.text || null,
    present: here.slice(p0 * per, p0 * per + per).map((p) => ({ id: p.id, name: p.name, title: p.title, activity: p.activity?.label || "est là", mood: MOOD(p.mood ?? 50), asleep: !awake(p), animal: p.kind === "animal", star: !!p.star })),
    total: here.length,
    page: p0,
    pages,
    events,
    older,
    objects,
    exits: r.exits.map((id) => world.building.rooms[id]).filter((x) => x && (x.discovered || x.kind === "transit")).map((x) => ({ id: x.id, name: x.name })),
    leads: arcs.map((a) => ({ id: a.id, title: a.title, state: a.state })),
    suggestions: busy,
    empty: here.length === 0,
  };
}

export function objectView(world, objectId) {
  const o = world.objects?.[objectId];
  if (!o || o.hidden) return null;
  return { id: o.id, name: o.name, state: o.state, desc: o.desc, room: world.building.rooms[o.room]?.name || null, roomId: o.room, history: (o.history || []).slice(-8).map((h) => h.text) };
}

// ------------------------------------------------------------------ personnage

export function personView(world, state, id) {
  const sheet = personSheet(world, state, id);
  if (!sheet) return null;
  const p = world.people[id];
  const room = world.building.rooms[p.location];
  const rels = relationsView(state, world, id);
  return {
    ...sheet,
    age: p.age,
    dept: DEPTS[p.dept]?.label || (p.dept === "qg" ? "Ton entreprise" : p.dept),
    location: room ? { id: room.id, name: room.name, floor: world.building.floors[room.floor]?.short } : null,
    activity: p.status === "missing" ? "introuvable (dernière trace : l'Étage fantôme)" : p.activity?.label || "—",
    mood: { value: p.mood ?? 50, emoji: MOOD(p.mood ?? 50) },
    needs: p.needs || null,
    personality: (p.traits || []).map((t) => PERSONALITY[t] || t),
    likes: p.likes || [],
    flaws: p.flaws || [],
    fears: p.fears || [],
    habits: (p.habits || []).map((h) => HABIT_LABELS[h] || h),
    humor: { styles: (p.humor?.tags || []).map((t) => HUMOR_TAGS[t] || t), refs: { fan: "adore les références", hater: "déteste les références", wrong: "comprend les références de travers", none: "ne fait pas de références" }[p.humor?.refs] || "" },
    quirk: p.quirk || null,
    goals: { short: sheet.goals.short, long: p.goals?.long || sheet.goals.long },
    recent: (p.recent || []).slice().reverse().map((r) => r.text),
    opinions: (p.beliefs || []).filter((b) => b.fact && world.facts[b.fact] && (world.facts[b.fact].public || world.facts[b.fact].status !== "secret")).slice(-4).map((b) => ({ text: world.facts[b.fact].text, stance: b.stance })),
    relationsDetail: rels.slice(0, 10).map((r) => ({ ...r, describe: describeRelation(world, p, r) })),
    followed: (world.owner?.follows || []).includes(id),
    star: !!p.star,
  };
}

function describeRelation(world, p, r) {
  const label = REL_LABELS[r.kind] || r.kind;
  if (r.asymmetric) return r.mine > r.theirs ? `admire ${r.name}… qui ne le lui rend pas` : `${r.name} l'apprécie, sans retour`;
  return `${label} (${r.mine >= 0 ? "+" : ""}${r.mine})`;
}

// ------------------------------------------------------------------ annuaire

export function directoryView(world, { page = 0, per = 12, floor = null, dept = null, q = "", sort = "influence" } = {}) {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let list = Object.values(world.people).filter((p) => p.status !== "gone");
  if (floor) list = list.filter((p) => floorOf(p.location) === floor);
  if (dept) list = list.filter((p) => p.dept === dept);
  if (q) list = list.filter((p) => norm(`${p.name} ${p.title}`).includes(norm(q)));
  list.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : (b.influence || 0) - (a.influence || 0) || a.name.localeCompare(b.name)));
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p0 = Math.min(Math.max(0, page), pages - 1);
  return {
    total: list.length,
    page: p0,
    pages,
    items: list.slice(p0 * per, p0 * per + per).map((p) => ({ id: p.id, name: p.name, title: p.title, dept: DEPTS[p.dept]?.label || (p.dept === "qg" ? "Ton entreprise" : ""), where: world.building.rooms[p.location]?.name || "?", floor: world.building.floors[floorOf(p.location)]?.short || "?", status: p.status, influence: p.influence || 0, mood: MOOD(p.mood ?? 50), star: !!p.star, animal: p.kind === "animal" })),
    depts: Object.entries(DEPTS).map(([id, d]) => ({ id, label: d.label })),
  };
}

// ------------------------------------------------------------------ sections

export function newsView(world, { page = 0, per = 10, minImportance = 2 } = {}) {
  const list = publicEvents(world).filter((e) => e.importance >= minImportance).reverse();
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p0 = Math.min(Math.max(0, page), pages - 1);
  return { total: list.length, page: p0, pages, items: list.slice(p0 * per, p0 * per + per).map((e) => eventLite(world, e)), media: world.media.articles.slice(-6).reverse().map((a) => ({ outlet: world.media.outlets[a.outlet]?.name || a.outlet, title: a.title, text: a.text, satire: !!a.satire })) };
}

export function investigationsView(world) {
  return {
    mysteries: Object.values(world.mysteries).map((m) => mysteryView(world, m)),
    arcs: Object.values(world.arcs || {}).sort((a, b) => b.lastCycle - a.lastCycle).slice(0, 12).map((a) => ({ id: a.id, title: a.title, state: a.state, cast: Object.values(a.cast).filter((id) => world.people[id]).map((id) => world.people[id].name).slice(0, 5), steps: a.events.map((id) => world.events.find((e) => e.id === id)).filter((e) => e && e.public).map((e) => e.title).slice(-4) })),
    rumors: Object.values(world.facts).filter((f) => f.public && f.status === "rumor").slice(-10).reverse().map((f) => f.text),
    rumorsFull: Object.values(world.facts).filter((f) => f.public && f.status === "rumor").slice(-10).reverse().map((f) => ({ id: f.id, text: f.text, investigation: f.investigation ? { verdict: f.investigation.verdict || null } : null })),
    gags: Object.values(world.gags || {}).map((g) => ({ label: GAGS[g.id]?.label || g.id, count: g.count })),
  };
}

export function companiesView(world) {
  return economyView(world);
}

export function politicsView(world) {
  return {
    parliament: { seats: world.parliament.seats.map((id) => world.people[id]?.name || id), speaker: world.people[world.parliament.speaker]?.name || "—", cyclesToElection: Math.max(0, world.parliament.nextElectionCycle - world.cycle) },
    orgs: Object.values(world.orgs).filter((o) => o.status === "active" && (o.public !== false && (!o.secret || o.public))).map((o) => ({ id: o.id, name: o.name, kind: o.kind, leader: world.people[o.leader]?.name || "—", members: o.members.length, goal: o.goal, reputation: o.reputation })),
    laws: Object.values(world.laws).slice(-12).reverse().map((l) => ({ id: l.id, title: l.title, text: l.text, status: l.status, sponsor: world.people[l.sponsor]?.name || "—", votes: l.votes ? { for: l.votes.for.length, against: l.votes.against.length, absent: l.votes.absent.length } : null })),
    cases: Object.values(world.cases).slice(-8).reverse().map((c) => ({ title: c.title, status: c.status, reasoning: c.reasoning || null })),
    catalog: Object.entries(LAW_CATALOG).filter(([code]) => !Object.values(world.laws).some((l) => l.code === code && ["proposed", "enacted"].includes(l.status))).map(([code, d]) => [code, { title: d.title, text: d.text }]),
  };
}

export function anomaliesView(world) {
  return {
    pressure: Math.round(world.building.pressure),
    ghost: { open: isGhostOpen(world), discovered: !!world.building.floors[GHOST_FLOOR]?.discovered, anomaly: world.building.floors[GHOST_FLOOR]?.anomaly || 0 },
    missing: Object.values(world.people).filter((p) => p.status === "missing").map((p) => p.name),
    records: world.anomalies.slice(-12).reverse().map((a) => ({ kind: a.kind, cycle: a.cycle, effects: a.effects || [], explained: a.explained })),
    events: publicEvents(world).filter((e) => e.tags?.includes("anomalie")).slice(-8).reverse().map((e) => eventLite(world, e)),
  };
}

export function historyView(world) {
  return {
    chronicle: world.chronicle.slice(-10).reverse(),
    major: publicEvents(world).filter((e) => e.importance >= 4).slice(-12).reverse().map((e) => eventLite(world, e)),
    gaps: (world.gaps || []).map((g) => ({ from: g.from, to: g.to, cycles: g.cycles })),
  };
}

// ------------------------------------------------------------------ Centre de contrôle (Dernier étage)

export function controlCenter(world, state, now = Date.now()) {
  const day = world.metrics.filter((m) => m.at >= now - 24 * HOUR);
  const sum = (k) => day.reduce((s, m) => s + (m[k] || 0), 0);
  const people = Object.values(world.people);
  const conflicts = Object.values(world.relations).filter((r) => r.kind === "rival").sort((a, b) => Math.min(a.ab, a.ba) - Math.min(b.ab, b.ba)).slice(0, 6).map((r) => ({ a: world.people[r.a]?.name, b: world.people[r.b]?.name, note: r.note }));
  const secrets = Object.values(world.facts).filter((f) => f.public && (f.kind === "secret" || f.variantOf || f.status === "secret")).slice(-8).reverse().map((f) => f.text);
  return {
    clock: clock(world).label,
    cycle: world.cycle,
    stats: {
      population: people.filter((p) => p.status !== "gone").length,
      awake: people.filter(awake).length,
      missing: people.filter((p) => p.status === "missing").length,
      events24h: sum("events"),
      interactions24h: sum("interactions"),
      relations24h: sum("relations"),
      rumors24h: sum("rumors"),
      moves24h: sum("moves"),
      rare24h: sum("rare"),
      applied: world.stats.applied,
      rejected: world.stats.rejected,
      rollbacks: world.stats.rollbacks || 0,
      skippedCycles: world.skipped || 0,
      relations: Object.keys(world.relations).length,
      facts: Object.keys(world.facts).length,
    },
    conflicts,
    finances: { total: totalMoney(world), treasury: balance(world, "treasury"), owner: balance(world, "boss"), company: balance(world, accountOf("c", "bosscorp")), minted: world.money.minted },
    secrets,
    arcs: Object.values(world.arcs || {}).filter((a) => a.state === "active").map((a) => ({ id: a.id, title: a.title, stage: a.stage })),
    decisions: world.decisions.slice(-10).reverse().map((d) => ({ id: d.id, title: d.title, status: d.status, choice: d.choice || null })),
    ownerActions: (world.owner?.actions || []).slice(-10).reverse(),
    follows: (world.owner?.follows || []).map((id) => world.people[id]).filter(Boolean).map((p) => ({ id: p.id, name: p.name, where: world.building.rooms[p.location]?.name, activity: p.activity?.label, last: p.recent?.at(-1)?.text || null })),
    config: structuredClone(world.config),
    ai: { ...world.ai },
    errors: world.errors.slice(-5),
    debug: (world.owner?.debug || []).slice(-8).reverse(),
  };
}

export { PALIER };
