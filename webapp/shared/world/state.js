// Création et synchronisation de l'état persistant du Bâtiment 0. Les employés de ton
// entreprise (QG) et ses chats deviennent des occupants du Bâtiment ; les embauches et les
// licenciements faits dans le QG se répercutent dans le monde.

import { BUILDING_NAME, CHARTER, FLOORS, RESIDENTS, ROLE_PROFILES, DEFAULT_PROFILE, COMPANIES, ORGS, MYSTERY_SEEDS, START_RELATIONS } from "./cast.js";
import { hash, makeRng } from "./core.js";
import { accountOf, ensureAccount, totalMoney } from "./ops.js";
import { addFact } from "./memory.js";
import { ROLES } from "../roster.js";

export const WORLD_VERSION = 1;

const SALARY_BY_ROLE = { director: 90, deputy: 60, manager: 60, intern: 20, cleaner: 35 };

function profileFor(agent) {
  const base = ROLE_PROFILES[agent.role] || DEFAULT_PROFILE;
  let ambition = base.ambition;
  const traits = agent.traits || [];
  if (traits.includes("showoff")) ambition = "fame";
  if (traits.includes("prankster") && ambition === "stability") ambition = "fame";
  if (traits.includes("hustler") && ambition === "stability") ambition = "wealth";
  return { ambition, skills: { ...base.skills } };
}

function newPerson(data) {
  return {
    kind: "employee",
    status: "active",
    reputation: 50,
    influence: 0,
    influenceHistory: [],
    lastSeenCycle: 0,
    mentions: 0,
    memories: [],
    knows: [],
    beliefs: [],
    career: [],
    flags: {},
    cooldownUntil: 0,
    ...data,
  };
}

function employeePerson(agent) {
  const profile = profileFor(agent);
  return newPerson({
    id: agent.id,
    name: agent.name,
    kind: "employee",
    agentId: agent.id,
    title: ROLES[agent.role]?.label || "Employé",
    floor: "f1",
    employer: "bosscorp",
    salary: SALARY_BY_ROLE[agent.role] || 40,
    traits: [...(agent.traits || [])],
    ambition: { kind: profile.ambition },
    skills: profile.skills,
    weakness: null,
  });
}

function catPerson(cat) {
  return newPerson({
    id: cat.id,
    name: cat.name,
    kind: "animal",
    species: "chat",
    title: "Chat de l'Étage 1",
    floor: "f1",
    employer: null,
    salary: 0,
    traits: ["lazy"],
    ambition: { kind: "power" },
    skills: { negotiation: 2, investigation: 5, charisma: 9, cunning: 6 },
    weakness: "s'endort pendant les votes",
  });
}

export function createWorld(state, now) {
  const seed = hash(`${state.createdAt || now}|${state.boss?.name || "Boss"}|madhouse`) || 7;
  const rng = makeRng(seed);
  const world = {
    version: WORLD_VERSION,
    name: BUILDING_NAME,
    seed,
    cycle: 0,
    seq: 0,
    createdAt: now,
    lastCycleAt: now - 2 * 86400000, // le Bâtiment a déjà deux jours d'histoire quand tu arrives
    tzOffset: state.settings?.tzOffset || 0,
    config: {
      cycleMinutes: 30,
      maxCatchUp: 24,
      maxBacklogDays: 3,
      paused: false,
      ai: { available: false, enabled: true, dailyCalls: 8 },
      notify: { minImportance: 4, maxPerDay: 2, minGapMinutes: 120, quietStart: 23, quietEnd: 8, dailyReport: true, reportHour: 9 },
    },
    building: {
      charter: CHARTER.map((r) => ({ ...r })),
      floors: Object.fromEntries(FLOORS.map((f) => [f.id, { ...f, discovered: f.status !== "rumored", controller: null, anomaly: f.id === "f13" ? 40 : 0, history: [] }])),
      elevator: { name: "Ascenseur B", mood: 60, grudges: {}, legalPerson: false },
      pressure: 20,
    },
    people: {},
    relations: {}, // relations impliquant au moins un occupant (celles entre employés restent dans state.life)
    accounts: {},
    ledger: [],
    money: { minted: 0, initial: 0 },
    loans: {},
    companies: {},
    orgs: {},
    parliament: { seats: [], speaker: null, nextElectionCycle: 0, lastElection: null, sessions: 0 },
    laws: {},
    cases: {},
    media: {
      outlets: {
        gazette: { id: "gazette", name: "La Gazette de l'Ascenseur", company: "gazette", journalist: "r-felix", credibility: 62, style: "sérieux" },
        radio: { id: "radio", name: "Radio Cage d'Escalier", company: "gazette", journalist: "r-nadia", credibility: 35, style: "satirique" },
      },
      articles: [],
    },
    mysteries: {},
    anomalies: [],
    plots: {},
    facts: {},
    events: [],
    chronicle: [],
    proposals: [],
    scheduled: [],
    decisions: [],
    notifications: [],
    applied: {},
    daily: {},
    flags: {},
    mood: 60,
    stats: { applied: 0, rejected: 0, rollbacks: 0 },
    ai: { day: null, calls: 0, tokensIn: 0, tokensOut: 0, skipped: 0 },
    jobs: [],
    // Tu arrives aujourd'hui : l'avant-histoire n'est pas une « absence » à rattraper.
    report: { lastSeenAt: now, lastSentAt: now, lastSentDay: null },
    errors: [],
  };

  // Comptes de base : Trésor du Syndic, le patron (toi), l'Employé n°0 (fantôme du Registre).
  ensureAccount(world, "treasury", { owner: "syndic", kind: "treasury", balance: 30000 });
  ensureAccount(world, "boss", { owner: "boss", kind: "boss", balance: 500 });
  ensureAccount(world, "emp0", { owner: "employee-0", kind: "phantom", balance: 0 });

  for (const def of RESIDENTS) {
    const { wealth, ...rest } = def;
    world.people[def.id] = newPerson({ kind: "resident", ...rest });
    ensureAccount(world, accountOf("p", def.id), { owner: def.id, balance: wealth || 0 });
  }
  syncPeople(world, state, now, { silent: true });
  for (const p of Object.values(world.people)) {
    if (p.kind === "employee") world.accounts[accountOf("p", p.id)].balance = 150 + Math.round(rng.next() * 250);
  }

  for (const c of COMPANIES) {
    const { cash, sharesTo, ...rest } = c;
    world.companies[c.id] = { ...rest, status: "active", reputation: 55, demand: 1, shares: { ...sharesTo }, totalShares: 100, foundedCycle: 0, history: [] };
    ensureAccount(world, accountOf("c", c.id), { owner: c.id, kind: "company", balance: cash });
  }
  for (const o of ORGS) {
    const members = o.members.filter((id) => world.people[id]);
    world.orgs[o.id] = { ...o, members, status: "active", reputation: 50, public: !o.secret, foundedCycle: 0, history: [] };
    ensureAccount(world, accountOf("o", o.id), { owner: o.id, kind: "org", balance: 150 });
  }

  for (const [a, b, kind, score, note] of START_RELATIONS) {
    if (!world.people[a] || !world.people[b]) continue;
    const [x, y] = [a, b].sort();
    world.relations[`${x}|${y}`] = { a: x, b: y, kind, score, since: now, note, from: null };
  }

  // Parlement de départ : cinq sièges, présidé par le député Rémi Pallier.
  world.parliament.seats = ["r-remi", "r-arlette", "r-colette", "r-octave", "r-leonie"].filter((id) => world.people[id]);
  world.parliament.speaker = "r-remi";
  world.parliament.nextElectionCycle = 7 * 48;
  for (const id of world.parliament.seats) world.people[id].flags.deputy = true;

  // Mystères : la vérité est tirée au sort et gardée secrète.
  for (const seed0 of MYSTERY_SEEDS) {
    const truth = rng.pick(seed0.truths);
    world.mysteries[seed0.id] = {
      id: seed0.id,
      title: seed0.title,
      question: seed0.question,
      status: "open",
      truth: { id: truth.id, text: truth.text, suspect: truth.suspect || truth.beneficiary || null },
      clues: buildClues(seed0.id, truth),
      required: seed0.required,
      hypotheses: [],
      investigators: [],
      openedCycle: 0,
    };
  }
  // L'Employé n°0 touche un salaire bien réel : la trace est dans le grand livre.
  world.phantom = { beneficiary: world.mysteries["m-employee0"].truth.suspect };

  // Quelques connaissances de départ (publiques, privées et secrètes).
  addFact(world, { kind: "lore", text: "L'Ascenseur B s'est encore arrêté à un étage qui n'existe pas au Plan.", about: ["f13"], status: "rumor", truth: true, knownBy: ["r-hector", "r-marcel", "r-ambroise"], mystery: "m-floor13" });
  addFact(world, { kind: "lore", text: "Le Registre verse chaque mois un salaire à un « Employé n°0 » que personne n'a jamais vu.", about: ["r-ambroise"], status: "confirmed", truth: true, knownBy: ["r-ambroise", "r-arlette"], mystery: "m-employee0" });
  addFact(world, { kind: "secret", text: "La Banque du Sous-Sol a prêté discrètement au Laboratoire Inappliqué pour couvrir ses pertes.", about: ["r-octave", "r-edith"], status: "secret", truth: true, knownBy: ["r-octave", "r-edith"] });
  if (world.people.director && world.people.hr) {
    addFact(world, { kind: "lore", text: "Victor a déposé une plainte contre Gérard des RH pour « regard insistant ». Classée sans suite.", about: ["director", "hr"], status: "confirmed", truth: true, public: true });
  }

  world.money.initial = totalMoney(world);
  return world;
}

function buildClues(mysteryId, truth) {
  const C = (text, weight = 1) => ({ text, weight, found: false, foundBy: null, cycle: null });
  if (mysteryId === "m-floor13") {
    return truth.id === "sealed"
      ? [C("Une ancienne version du Plan Officiel comporte une page arrachée entre le 12 et la Terrasse."), C("Le bouton « 13 » de l'Ascenseur B a été repeint à la main."), C("Un tampon du Syndic daté d'avant la Charte mentionne « scellement définitif ».", 2), C("Arlette Tampon possède une clé que personne n'a jamais vue servir.", 2), C("Les relevés de chauffage consomment un étage de trop.")]
      : [C("Les arrêts au 13 coïncident avec les expériences nocturnes du Laboratoire."), C("Les reflets dans l'Ascenseur B montrent parfois un couloir inversé."), C("Un carnet du Labo mentionne « dédoublement d'espace, à ne pas reproduire ».", 2), C("Édith Vasseur a commandé deux fois plus de craie que nécessaire.", 2), C("Les relevés de chauffage consomment un étage de trop.")];
  }
  if (mysteryId === "m-employee0") {
    const who = { arlette: "Arlette Tampon", marcel: "Marcel Pivert", gustave: "l'aquarium du Hall" }[truth.id];
    return [C("Le salaire de l'Employé n°0 est versé chaque jour par le Trésor du Syndic."), C("Le compte de l'Employé n°0 est vidé quelques heures après chaque versement."), C(`Les retraits du compte n°0 portent la mention « ${truth.id === "gustave" ? "entretien aquatique" : "avance personnelle"} ».`, 2), C(`Le Registre montre que le dossier n°0 a été modifié avec le tampon de ${truth.id === "arlette" ? "la Syndic Générale" : truth.id === "marcel" ? "la conciergerie" : "l'accueil du Hall"}.`, 2), C(`Les fonds aboutissent finalement chez ${who}.`, 3)];
  }
  const who = { cercle: "des capuches du Cercle", loans: "des reçus de la Banque du Sous-Sol", cats: "des poils de chat" }[truth.id];
  return [C("La salle des commissions est réservée chaque nuit par le compte « 0000 »."), C(`Le ménage du matin y trouve ${who}.`, 2), C(`Le compte « 0000 » a été créé depuis ${truth.id === "cats" ? "un terminal de l'Étage 1" : truth.id === "loans" ? "le Sous-Sol" : "le Registre"}.`, 2), C("Les réunions nocturnes se terminent toujours à 4 h 12.")];
}

// Synchronise les occupants avec le QG : nouveaux employés, départs, chats.
export function syncPeople(world, state, now, { silent = false } = {}) {
  const changes = [];
  const agents = new Map((state.agents || []).map((a) => [a.id, a]));
  for (const agent of agents.values()) {
    let person = world.people[agent.id];
    if (!person) {
      person = employeePerson(agent);
      world.people[agent.id] = person;
      ensureAccount(world, accountOf("p", agent.id), { owner: agent.id, balance: 0 });
      if (!silent) changes.push({ kind: "arrival", person });
    } else {
      person.name = agent.name;
      if (person.status === "fired" && person.kind === "employee") {
        person.status = "active";
        changes.push({ kind: "rehired", person });
      }
      const title = ROLES[agent.role]?.label;
      if (title && person.employer === "bosscorp" && person.title !== title && !person.flags.buildingTitle) person.title = title;
    }
  }
  for (const person of Object.values(world.people)) {
    if (person.kind !== "employee" || person.employer !== "bosscorp") continue;
    if (!agents.has(person.id) && person.status === "active") {
      person.status = "fired";
      person.employer = null;
      person.salary = 0;
      person.career.push({ cycle: world.cycle, text: "Licencié de l'Étage 1" });
      changes.push({ kind: "fired", person });
    }
  }
  for (const cat of state.life?.cats || []) {
    if (!world.people[cat.id]) {
      world.people[cat.id] = catPerson(cat);
      ensureAccount(world, accountOf("p", cat.id), { owner: cat.id, balance: 0 });
      if (!silent) changes.push({ kind: "arrival", person: world.people[cat.id] });
    } else {
      world.people[cat.id].name = cat.name;
    }
  }
  return changes;
}

// Personnes « présentes » (pouvant agir).
export function activePeople(world) {
  return Object.values(world.people).filter((p) => ["active", "admin_dead", "double", "fired"].includes(p.status));
}
