// Vues du Bâtiment pour la mini app et Telegram. Le joueur observe le Bâtiment comme un
// lecteur très bien informé, pas comme un dieu : la vérité des mystères, la véracité des
// rumeurs, l'exactitude des articles, les secrets non révélés, les virements occultes et
// les organisations clandestines restent cachés tant qu'ils n'ont pas été exposés.

import { TRAIT_LABELS } from "../roster.js";
import { LAW_CATALOG } from "./cast.js";
import { accountOf, balance, totalMoney } from "./ops.js";
import { priceIndex, sharePrice, ownerName } from "./economy.js";
import { whyLine } from "./report.js";

const AMBITIONS = { power: "le pouvoir", wealth: "la fortune", fame: "la célébrité", truth: "la vérité", stability: "la tranquillité", protect: "protéger les siens", change_role: "changer de rôle" };
const STATUS = { active: "en poste", fired: "licencié (toujours dans le Bâtiment)", admin_dead: "mort administrativement", double: "double non reconnu", missing: "disparu", retired: "retraité" };
const REL_LABELS = { ami: "ami·e", bff: "meilleur·e ami·e", couple: "en couple", crush: "béguin", rival: "rival·e", ex: "ex", mentor: "mentor" };
const SKILLS = { negotiation: "négociation", investigation: "enquête", charisma: "charisme", cunning: "ruse" };

const floorName = (world, id) => world.building.floors[id]?.name || "étage inconnu";
const personName = (world, id) => world.people[id]?.name || (id === "boss" ? "toi" : id === "syndic" ? "le Syndic" : id);
const orgVisible = (o) => o.public !== false && (!o.secret || o.exposed || o.public);

export function shortGoal(world, p) {
  const k = p.ambition?.kind;
  if (p.status === "admin_dead") return "Prouver au Registre qu'il existe";
  if (p.status === "double") return `Être reconnu comme le vrai ${personName(world, p.doubleOf)}`;
  if (p.status === "fired") return "Retrouver une place dans le Bâtiment";
  if (k === "power") return p.flags.deputy ? "Garder son siège à l'Hémicycle" : "Obtenir un siège ou diriger une organisation";
  if (k === "wealth") return "Faire fructifier son compte";
  if (k === "fame") return "Faire parler de lui/elle à la radio";
  if (k === "truth") return p.ambition?.theory ? `Prouver que ${p.ambition.theory.charAt(0).toLowerCase()}${p.ambition.theory.slice(1)}` : "Résoudre un mystère du Bâtiment";
  if (k === "protect") return "Défendre les occupants des étages inférieurs";
  if (k === "change_role") return "Changer de poste coûte que coûte";
  return "Que rien ne change";
}

export function relationsView(state, world, id) {
  const all = [...Object.values(state.life?.relations || {}), ...Object.values(world.relations || {})];
  return all
    .filter((r) => (r.a === id || r.b === id) && world.people[r.a === id ? r.b : r.a])
    .map((r) => {
      const other = r.a === id ? r.b : r.a;
      return { id: other, name: personName(world, other), kind: r.kind, label: REL_LABELS[r.kind] || r.kind, score: r.score, note: r.note };
    })
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

// Fiche complète d'un personnage (ce que le Bâtiment sait publiquement de lui).
export function personSheet(world, state, id) {
  const p = world.people[id];
  if (!p) return null;
  const rels = relationsView(state, world, id);
  const orgs = Object.values(world.orgs).filter((o) => o.members.includes(id) && o.status === "active" && orgVisible(o));
  const hiddenOrgs = Object.values(world.orgs).filter((o) => o.members.includes(id) && o.status === "active" && !orgVisible(o)).length;
  const hypotheses = Object.values(world.mysteries).flatMap((m) => m.hypotheses.filter((h) => h.by === id).map((h) => ({ mystery: m.title, text: h.text, verdict: m.status === "solved" ? (h.correct ? "confirmée" : "fausse — croyait à tort") : "non vérifiée" })));
  const secretsKept = p.knows.map((f) => world.facts[f]).filter((f) => f && f.status === "secret" && !f.public).length;
  const promises = p.knows.map((f) => world.facts[f]).filter((f) => f?.kind === "promise" && f.public && f.data && !f.data.settled);
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    species: p.species || null,
    title: p.title,
    floor: floorName(world, p.floor),
    employer: p.employer === "syndic" ? "Syndic Général" : p.employer ? world.companies[p.employer]?.name || p.employer : "aucun",
    status: STATUS[p.status] || p.status,
    traits: (p.traits || []).map((t) => TRAIT_LABELS[t] || t),
    skills: Object.entries(p.skills || {}).map(([k, v]) => ({ key: k, label: SKILLS[k] || k, value: v })),
    weakness: p.weakness || null,
    ambition: AMBITIONS[p.ambition?.kind] || "aucune",
    conviction: p.ambition?.theory || null,
    goals: { short: shortGoal(world, p), long: `Long terme : ${AMBITIONS[p.ambition?.kind] || "survivre au Bâtiment"}` },
    wealth: balance(world, accountOf("p", p.id)),
    frozen: !!world.accounts[accountOf("p", p.id)]?.frozen,
    reputation: p.reputation,
    influence: p.influence,
    influenceHistory: (p.influenceHistory || []).map((h) => h.value),
    legend: !!p.flags.legend,
    deputy: !!p.flags.deputy,
    doubleOf: p.doubleOf ? personName(world, p.doubleOf) : null,
    relations: rels.slice(0, 8),
    alliances: orgs.map((o) => ({ id: o.id, name: o.name, leader: o.leader === id })),
    rivalries: rels.filter((r) => r.kind === "rival").map((r) => r.name),
    hiddenAffiliations: hiddenOrgs > 0,
    secretsKept,
    knowsCount: p.knows.length,
    beliefs: hypotheses,
    commitments: promises.map((f) => f.text),
    companies: Object.values(world.companies).filter((c) => (c.shares[id] || 0) > 0).map((c) => ({ id: c.id, name: c.name, shares: c.shares[id], ceo: c.ceo === id })),
    memories: p.memories.map((eid) => world.events.find((e) => e.id === eid)).filter((e) => e && e.public).slice(-6).map((e) => e.title),
    career: p.career.slice(-6).map((c) => c.text),
    lastSeenCycle: p.lastSeenCycle,
  };
}

function eventView(world, e, { why = false } = {}) {
  return { id: e.id, at: e.at, cycle: e.cycle, kind: e.kind, title: e.title, text: e.text, importance: e.importance, rare: e.rare, tags: e.tags, plotId: e.plotId, actors: e.actors.map((id) => ({ id, name: personName(world, id) })), why: why ? whyLine(world, e) : null, narration: e.narration || null };
}

// Vue complète pour la mini app (servie à la demande, jamais dans le polling).
export function worldView(world, state, { events = 40 } = {}) {
  const floors = Object.values(world.building.floors)
    .filter((f) => f.discovered || f.status !== "rumored")
    .sort((a, b) => b.level - a.level)
    .map((f) => ({ id: f.id, level: f.level, name: f.name, kind: f.kind, status: f.status, onPlan: f.onPlan, blurb: f.blurb, note: f.note || null, anomaly: f.anomaly >= 50 ? "forte" : f.anomaly >= 20 ? "légère" : null, occupants: Object.values(world.people).filter((p) => p.floor === f.id && p.status !== "missing").length }));
  const rumoredFloors = Object.values(world.building.floors).filter((f) => !f.discovered && f.status === "rumored").map((f) => ({ id: f.id, name: `${f.name} (rumeur)` }));
  const people = Object.values(world.people)
    .map((p) => ({ id: p.id, name: p.name, kind: p.kind, species: p.species || null, title: p.title, floor: p.floor, floorName: floorName(world, p.floor), status: p.status, reputation: p.reputation, influence: p.influence, wealth: balance(world, accountOf("p", p.id)), legend: !!p.flags.legend, deputy: !!p.flags.deputy }))
    .sort((a, b) => b.influence - a.influence);
  const publicEvents = world.events.filter((e) => e.public);
  return {
    name: world.name,
    cycle: world.cycle,
    tzOffset: world.tzOffset || 0,
    lastCycleAt: world.lastCycleAt,
    cycleMinutes: world.config.cycleMinutes,
    paused: world.config.paused,
    mood: world.mood,
    pressure: Math.round(world.building.pressure),
    elevator: { name: world.building.elevator.name, mood: world.building.elevator.mood, legalPerson: world.building.elevator.legalPerson },
    charter: world.building.charter,
    floors,
    rumoredFloors,
    people,
    events: publicEvents.slice(-events).reverse().map((e) => eventView(world, e, { why: e.importance >= 3 })),
    chronicle: world.chronicle.slice(-14).reverse(),
    economy: economyView(world),
    orgs: Object.values(world.orgs).filter(orgVisible).map((o) => ({ id: o.id, name: o.name, kind: o.kind, status: o.status, leader: personName(world, o.leader), members: o.members.map((m) => personName(world, m)), goal: o.goal, reputation: o.reputation, treasury: balance(world, accountOf("o", o.id)) })),
    parliament: { seats: world.parliament.seats.map((id) => personName(world, id)), speaker: personName(world, world.parliament.speaker), nextElectionCycle: world.parliament.nextElectionCycle, cyclesToElection: Math.max(0, world.parliament.nextElectionCycle - world.cycle) },
    laws: Object.values(world.laws).map((l) => ({ id: l.id, title: l.title, text: l.text, code: l.code, status: l.status, sponsor: personName(world, l.sponsor), votes: l.votes ? { for: l.votes.for.length, against: l.votes.against.length, absent: l.votes.absent.length } : null, rule: LAW_CATALOG[l.code]?.text || l.text })),
    cases: Object.values(world.cases).slice(-12).reverse().map((c) => ({ id: c.id, title: c.title, kind: c.kind, status: c.status, ruling: c.ruling || null, reasoning: c.reasoning || null })),
    mysteries: Object.values(world.mysteries).map((m) => mysteryView(world, m)),
    rumors: Object.values(world.facts).filter((f) => f.public && f.status === "rumor").slice(-12).reverse().map((f) => ({ id: f.id, text: f.text, label: "Rumeur — non vérifiée" })),
    hypotheses: Object.values(world.facts).filter((f) => f.public && f.status === "hypothesis").slice(-8).reverse().map((f) => ({ id: f.id, text: f.text, label: "Hypothèse" })),
    facts: Object.values(world.facts).filter((f) => f.public && f.status === "confirmed").slice(-12).reverse().map((f) => ({ id: f.id, text: f.text })),
    plots: Object.values(world.plots).filter((p) => p.state !== "merged" && p.beats.some((id) => publicEvents.some((e) => e.id === id))).sort((a, b) => b.lastBeatCycle - a.lastBeatCycle).slice(0, 12).map((p) => ({ id: p.id, title: p.title, kind: p.kind, state: p.state, cast: p.cast.map((id) => personName(world, id)), goals: p.goals, conflict: p.conflict, beats: p.beats.map((id) => publicEvents.find((e) => e.id === id)?.title).filter(Boolean).slice(-5), resolution: p.resolution?.text || null, revived: p.revived || 0 })),
    anomalies: world.anomalies.slice(-12).reverse().map((a) => ({ id: a.id, kind: a.kind, cycle: a.cycle, effects: a.effects || [], scope: describeScope(world, a.scope), explained: a.explained })),
    media: world.media.articles.slice(-10).reverse().map((a) => ({ id: a.id, outlet: world.media.outlets[a.outlet]?.name || a.outlet, title: a.title, text: a.text, satire: !!a.satire, denied: Object.values(world.cases).some((c) => c.kind === "defamation" && c.subject === `article:${a.id}` && c.ruling === "plaintiff") })),
    decisions: world.decisions.filter((d) => d.status === "open").map((d) => ({ id: d.id, title: d.title, kind: d.kind })),
    stats: { applied: world.stats.applied, rejected: world.stats.rejected, rollbacks: world.stats.rollbacks || 0, skipped: world.skipped || 0, ai: { ...world.ai, enabled: world.config.ai.enabled && world.config.ai.available, dailyCalls: world.config.ai.dailyCalls } },
    director: world.director?.last || null,
    report: { lastSeenAt: world.report.lastSeenAt },
  };
}

function describeScope(world, scope) {
  if (!scope) return null;
  const parts = [];
  if (scope.people) parts.push(scope.people.map((id) => personName(world, id)).join(", "));
  if (scope.floor) parts.push(floorName(world, scope.floor));
  if (scope.floors) parts.push(scope.floors.map((id) => floorName(world, id)).join(", "));
  return parts.join(" · ") || null;
}

export function mysteryView(world, m) {
  const publicClues = Object.values(world.facts).filter((f) => f.mystery === m.id && f.kind === "clue" && f.public).map((f) => f.text);
  return {
    id: m.id,
    title: m.title,
    question: m.question,
    status: m.status,
    cluesFound: m.clues.filter((c) => c.found).length,
    cluesTotal: m.clues.length,
    publicClues,
    investigators: m.investigators.map((id) => ({ id, name: personName(world, id) })),
    focus: m.focus ? personName(world, m.focus) : null,
    hypotheses: m.hypotheses.slice(-6).map((h) => ({ by: personName(world, h.by), text: h.text, verdict: m.status === "solved" ? (h.correct ? "confirmée" : "fausse") : "non vérifiée" })),
    solution: m.status === "solved" ? { text: m.truth.text, by: personName(world, m.solvedBy) } : null,
  };
}

export function economyView(world) {
  const people = Object.values(world.people).filter((p) => p.kind !== "animal" || balance(world, accountOf("p", p.id)) > 0);
  const fortunes = people.map((p) => ({ name: p.name, wealth: balance(world, accountOf("p", p.id)) })).sort((a, b) => b.wealth - a.wealth);
  const index = priceIndex(world);
  return {
    currency: "Crédits (cr) — monnaie fictive du Bâtiment",
    total: totalMoney(world),
    minted: world.money.minted,
    treasury: balance(world, "treasury"),
    boss: balance(world, "boss"),
    priceIndex: Number(index.toFixed(2)),
    // Indicateurs absurdes (mais calculés sur l'état réel).
    indicators: [
      { label: "Indice du Plateau-Repas", value: world.companies.refectoire ? `${world.companies.refectoire.price} cr` : "—" },
      { label: "Indice de Moquette Anxieuse", value: `${Math.round(world.building.pressure * 0.7 + (100 - world.mood) * 0.3)} / 100` },
      { label: "Taux de chômage vertical", value: `${Object.values(world.people).filter((p) => p.kind !== "animal" && !p.employer && p.status !== "missing").length} sans emploi` },
      { label: "Confiance dans l'Ascenseur B", value: `${world.building.elevator.mood} %` },
    ],
    companies: Object.values(world.companies).map((c) => ({ id: c.id, name: c.name, status: c.status, ceo: personName(world, c.ceo), floor: floorName(world, c.floor), cash: balance(world, accountOf("c", c.id)), product: c.product, price: c.price, reputation: c.reputation, sharePrice: sharePrice(world, c), holders: Object.entries(c.shares).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h, n]) => ({ name: h === "boss" ? "toi" : personName(world, h), n })) })),
    loans: Object.values(world.loans).filter((l) => l.status !== "repaid").slice(-10).map((l) => ({ id: l.id, lender: ownerName(world, l.lender), borrower: ownerName(world, l.borrower), balance: l.balance, status: l.status, dueInCycles: l.dueCycle - world.cycle })),
    fortunes: fortunes.slice(0, 8),
    // Grand livre public : les virements occultes (pots-de-vin, détournements) n'y figurent pas.
    ledger: world.ledger.filter((t) => !t.secret).slice(-15).reverse().map((t) => ({ from: t.from === "émission" ? "émission" : ownerName(world, t.from), to: ownerName(world, t.to), amount: t.amount, reason: t.reason, cycle: t.cycle })),
  };
}
