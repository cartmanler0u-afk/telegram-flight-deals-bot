// Création, migration et synchronisation de l'état persistant du Bâtiment 0.
//
// v2 : le Bâtiment devient visitable (étages → pièces → objets), peuplé d'environ 250
// personnages localisés (une pièce chacun), avec des relations asymétriques. Les employés
// de ton entreprise (QG) occupent l'Étage 11 ; embauches et licenciements s'y répercutent.

import { BUILDING_NAME, CHARTER, RESIDENTS, ROLE_PROFILES, DEFAULT_PROFILE, COMPANIES, ORGS, MYSTERY_SEEDS, START_RELATIONS } from "./cast.js";
import { buildBuilding, GHOST_FLOOR, COMPANY_FLOOR } from "./building.js";
import { DEFAULT_DISTRIBUTION, HOME_ROOMS, generateCast, starPeople, basePerson, enrichPerson } from "./castgen.js";
import { hash, makeRng } from "./core.js";
import { accountOf, ensureAccount, totalMoney } from "./ops.js";
import { addFact } from "./memory.js";
import { ROLES } from "../roster.js";

export const WORLD_VERSION = 2;

const SALARY_BY_ROLE = { director: 90, deputy: 60, manager: 60, intern: 20, cleaner: 35 };
const QG_ROOM_BY_ROLE = { director: "f11.direction", scribe: "f11.reunion", secretary: "f11.reunion", cleaner: "f11.cuisine", happiness: "f11.repos" };

export function defaultConfig() {
  return {
    cycleMinutes: 30,
    timeScale: 1,
    maxCatchUp: 24,
    maxBacklogDays: 3,
    paused: false,
    population: 250,
    distribution: { ...DEFAULT_DISTRIBUTION },
    chaos: 50,
    rarity: { common: 1, rare: 1, very_rare: 1, legendary: 1 },
    maxEventsPerCycle: 4,
    maxInteractionsPerCycle: 14,
    dialogue: "normal",
    ai: { available: false, enabled: true, dailyCalls: 8 },
    notify: { minImportance: 4, maxPerDay: 2, minGapMinutes: 120, quietStart: 23, quietEnd: 8, dailyReport: true, reportHour: 9 },
  };
}

function profileFor(agent) {
  const base = ROLE_PROFILES[agent.role] || DEFAULT_PROFILE;
  let ambition = base.ambition;
  const traits = agent.traits || [];
  if (traits.includes("showoff")) ambition = "fame";
  if (traits.includes("prankster") && ambition === "stability") ambition = "fame";
  if (traits.includes("hustler") && ambition === "stability") ambition = "wealth";
  return { ambition, skills: { ...base.skills } };
}

function employeePerson(agent, rng) {
  const profile = profileFor(agent);
  const workRoom = QG_ROOM_BY_ROLE[agent.role] || "f11.openspace";
  return enrichPerson(basePerson({
    id: agent.id,
    name: agent.name,
    kind: "employee",
    agentId: agent.id,
    title: ROLES[agent.role]?.label || "Employé",
    dept: "qg",
    floor: COMPANY_FLOOR,
    workRoom,
    homeRoom: HOME_ROOMS[hash(agent.id) % HOME_ROOMS.length],
    location: workRoom,
    employer: "bosscorp",
    salary: SALARY_BY_ROLE[agent.role] || 40,
    traits: [...(agent.traits || [])],
    ambition: { kind: profile.ambition },
    skills: profile.skills,
    weakness: null,
  }), rng);
}

function catPerson(cat, rng) {
  return enrichPerson(basePerson({
    id: cat.id,
    name: cat.name,
    kind: "animal",
    species: "chat",
    title: "Chat de l'Étage 11",
    dept: "qg",
    floor: COMPANY_FLOOR,
    workRoom: "f11.repos",
    homeRoom: "f11.repos",
    location: "f11.repos",
    employer: null,
    salary: 0,
    traits: ["lazy"],
    ambition: { kind: "power" },
    skills: { negotiation: 2, investigation: 5, charisma: 9, cunning: 6 },
    weakness: "s'endort pendant les votes",
    habits: ["napper"],
  }), rng);
}

function residentPerson(def, rng) {
  const rest = { ...def };
  delete rest.wealth; // la fortune est un compte, pas un champ du personnage
  return enrichPerson(basePerson({
    kind: "resident",
    homeRoom: def.kind === "animal" ? def.workRoom : HOME_ROOMS[hash(def.id) % HOME_ROOMS.length],
    location: def.workRoom,
    star: true,
    ...rest,
  }), rng);
}

// Relation (éventuellement asymétrique) : ab = ce que a ressent pour b, ba = l'inverse.
export function putRelation(world, a, b, kind, scoreAB, scoreBA = scoreAB, note = "", now = 0) {
  const [x, y] = [a, b].sort();
  const ab = x === a ? scoreAB : scoreBA;
  const ba = x === a ? scoreBA : scoreAB;
  world.relations[`${x}|${y}`] = { a: x, b: y, kind, score: Math.round((ab + ba) / 2), ab, ba, since: now, note, from: null };
}

export function createWorld(state, now) {
  const seed = hash(`${state.createdAt || now}|${state.boss?.name || "Boss"}|madhouse`) || 7;
  const rng = makeRng(seed);
  const { floors, rooms, objects } = buildBuilding();
  const world = {
    version: WORLD_VERSION,
    name: BUILDING_NAME,
    seed,
    cycle: 0,
    seq: 0,
    rev: 0,
    createdAt: now,
    lastCycleAt: now - 2 * 86400000, // le Bâtiment a déjà deux jours d'histoire quand tu arrives
    simTime: now - 2 * 86400000,
    tzOffset: state.settings?.tzOffset || 0,
    config: defaultConfig(),
    building: {
      charter: CHARTER.map((r) => ({ ...r })),
      floors,
      rooms,
      elevator: { name: "Ascenseur B", mood: 60, grudges: {}, legalPerson: false },
      pressure: 20,
    },
    objects,
    people: {},
    relations: {},
    accounts: {},
    ledger: [],
    money: { minted: 0, initial: 0, arrivals: 0 },
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
    arcs: {},
    gags: {},
    facts: {},
    events: [],
    chronicle: [],
    metrics: [],
    proposals: [],
    scheduled: [],
    decisions: [],
    owner: { follows: [], actions: [], debug: [] },
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
    gaps: [],
    errors: [],
  };

  // Comptes de base : Trésor du Syndic, le propriétaire (toi), l'Employé n°0 (fantôme du Registre).
  ensureAccount(world, "treasury", { owner: "syndic", kind: "treasury", balance: 60000 });
  ensureAccount(world, "boss", { owner: "boss", kind: "boss", balance: 5000 });
  ensureAccount(world, "emp0", { owner: "employee-0", kind: "phantom", balance: 0 });

  const add = (p, wealth) => {
    world.people[p.id] = p;
    ensureAccount(world, accountOf("p", p.id), { owner: p.id, balance: Math.max(0, Math.round(wealth || 0)) });
  };
  for (const def of RESIDENTS) add(residentPerson(def, rng), def.wealth);
  for (const s of starPeople()) {
    const { wealth, ...p } = s;
    add(enrichPerson(p, rng), wealth);
  }
  syncPeople(world, state, now, { silent: true });
  for (const p of Object.values(world.people)) {
    if (p.kind === "employee") world.accounts[accountOf("p", p.id)].balance = 150 + Math.round(rng.next() * 250);
  }
  topUpPopulation(world, now, { silent: true });

  for (const c of COMPANIES) {
    const { cash, sharesTo, ...rest } = c;
    world.companies[c.id] = { ...rest, status: "active", reputation: 55, demand: 1, shares: { ...sharesTo }, totalShares: 100, foundedCycle: 0, history: [] };
    ensureAccount(world, accountOf("c", c.id), { owner: c.id, kind: "company", balance: cash * 3 });
  }
  for (const o of ORGS) {
    const members = o.members.filter((id) => world.people[id]);
    if (!members.length) continue;
    world.orgs[o.id] = { ...o, members, leader: members.includes(o.leader) ? o.leader : members[0], status: "active", reputation: 50, public: !o.secret, foundedCycle: 0, history: [] };
    ensureAccount(world, accountOf("o", o.id), { owner: o.id, kind: "org", balance: o.id === "o-club" ? 3000 : 150 });
  }
  // Le Parti du Bon Sens Pratique : un groupe de covoiturage devenu le premier parti du Bâtiment.
  const pbsp = world.orgs["o-pbsp"];
  if (pbsp) {
    const recruits = rng.shuffle(Object.values(world.people).filter((p) => p.kind === "resident" && !p.star && !p.flags.club)).slice(0, 22).map((p) => p.id);
    pbsp.members = [...new Set([...pbsp.members, ...recruits])];
  }
  const club = world.orgs["o-club"];
  if (club) club.members = [...new Set([...club.members, ...Object.values(world.people).filter((p) => p.flags.club).map((p) => p.id)])];

  for (const [a, b, kind, score, note] of START_RELATIONS) {
    if (world.people[a] && world.people[b]) putRelation(world, a, b, kind, score, score, note, now);
  }
  seedRelations(world, rng, now);

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
  world.phantom = { beneficiary: world.mysteries["m-employee0"].truth.suspect };

  seedKnowledge(world, rng);
  world.money.initial = totalMoney(world);
  return world;
}

// Quelques amitiés et rivalités de départ entre collègues (parfois à sens unique).
function seedRelations(world, rng, now) {
  const byDept = {};
  for (const p of Object.values(world.people)) if (p.kind !== "animal") (byDept[p.dept] ||= []).push(p);
  for (const list of Object.values(byDept)) {
    for (const p of list) {
      if (!rng.chance(0.55)) continue;
      const other = rng.pick(list.filter((x) => x.id !== p.id));
      if (!other) continue;
      const key = [p.id, other.id].sort().join("|");
      if (world.relations[key]) continue;
      const roll = rng.next();
      if (roll < 0.45) putRelation(world, p.id, other.id, "ami", rng.int(25, 60), rng.int(20, 60), "Collègues de longue date.", now);
      else if (roll < 0.7) putRelation(world, p.id, other.id, "rival", rng.int(-60, -20), rng.int(-50, -10), rng.pick(["Une histoire de place de parking.", "Le vol présumé d'un stylo quatre couleurs.", "Une réunion de 2019 jamais digérée.", "Rivalité pour la plante la mieux exposée."]), now);
      else if (roll < 0.82) putRelation(world, p.id, other.id, "crush", rng.int(30, 60), rng.int(-10, 25), "Une admiration discrète. Pas forcément réciproque.", now);
      else putRelation(world, p.id, other.id, "ami", rng.int(40, 70), rng.int(-40, -10), "Admiration à sens unique : l'autre ne le supporte pas.", now);
    }
  }
}

// Secrets de départ : chacun garde les siens ; le gardien en connaît une bonne partie.
function seedKnowledge(world, rng) {
  addFact(world, { kind: "lore", text: "L'Ascenseur B s'est encore arrêté à un étage qui n'existe pas au Plan.", about: [GHOST_FLOOR], status: "rumor", truth: true, knownBy: ["r-hector", "r-marcel", "r-ambroise"].filter((id) => world.people[id]), mystery: "m-floor13" });
  addFact(world, { kind: "lore", text: "Le Registre verse chaque mois un salaire à un « Employé n°0 » que personne n'a jamais vu.", about: ["r-ambroise"], status: "confirmed", truth: true, knownBy: ["r-ambroise", "r-arlette"], mystery: "m-employee0" });
  addFact(world, { kind: "secret", text: "La Banque du Sous-Sol a prêté discrètement au Laboratoire Inappliqué pour couvrir ses pertes.", about: ["r-octave", "r-edith"], status: "secret", truth: true, knownBy: ["r-octave", "r-edith"] });
  addFact(world, { kind: "secret", text: "Ludovic Palette stocke les colis disparus dans une salle absente des plans, derrière son bureau.", about: ["s-ludovic"], status: "secret", truth: true, knownBy: ["s-ludovic"] });
  addFact(world, { kind: "secret", text: "Bernard Quelconque photocopie chaque document confidentiel qui passe par la reprographie.", about: ["s-bernard"], status: "secret", truth: true, knownBy: ["s-bernard"] });
  if (world.people.director && world.people.hr) {
    addFact(world, { kind: "lore", text: "Victor a déposé une plainte contre Gérard des RH pour « regard insistant ». Classée sans suite.", about: ["director", "hr"], status: "confirmed", truth: true, public: true });
  }
  const gardien = world.people["r-marcel"];
  for (const p of Object.values(world.people)) {
    if (!p.secretTemplate) continue;
    const fact = addFact(world, { kind: "secret", text: p.secretTemplate.replace("{name}", p.name), about: [p.id], status: "secret", truth: true, knownBy: [p.id, gardien && rng.chance(0.6) ? gardien.id : null] });
    delete p.secretTemplate;
    p.flags.secret = fact.id;
  }
}

// Ajoute de nouveaux habitants jusqu'à la population configurée (création et hausse du réglage).
export function topUpPopulation(world, now, { silent = false, max = Infinity } = {}) {
  const target = world.config.population;
  const current = Object.values(world.people).filter((p) => p.status !== "gone").length;
  const missing = Math.min(max, target - current);
  if (missing <= 0) return [];
  const existing = new Set(Object.keys(world.people));
  const numbers = Object.keys(world.people).filter((id) => /^c-\d+$/.test(id)).map((id) => Number(id.slice(2)));
  const start = (numbers.length ? Math.max(...numbers) : 0) + 1;
  const cast = generateCast(world.seed, missing, { distribution: world.config.distribution, existingIds: existing, start });
  const arrivals = [];
  for (const p of cast) {
    const { wealth, ...person } = p;
    person.lastSeenCycle = world.cycle;
    world.people[person.id] = person;
    ensureAccount(world, accountOf("p", person.id), { owner: person.id, balance: wealth });
    if (!silent) world.money.arrivals = (world.money.arrivals || 0) + wealth;
    arrivals.push(person);
  }
  return arrivals;
}

function buildClues(mysteryId, truth) {
  const C = (text, weight = 1) => ({ text, weight, found: false, foundBy: null, cycle: null });
  if (mysteryId === "m-floor13") {
    return truth.id === "sealed"
      ? [C("Une ancienne version du Plan Officiel comporte une page arrachée entre le 9 et le 11."), C("Le bouton « 10 » de l'Ascenseur B a été arraché à la main, et récemment."), C("Un tampon du Syndic daté d'avant la Charte mentionne « scellement définitif ».", 2), C("Arlette Tampon possède une clé que personne n'a jamais vue servir.", 2), C("Les relevés de chauffage consomment un étage de trop.")]
      : [C("Les apparitions de l'Étage 10 coïncident avec les expériences nocturnes du Laboratoire."), C("Les reflets dans l'Ascenseur B montrent parfois un couloir inversé."), C("Un carnet du Labo mentionne « dédoublement d'espace, à ne pas reproduire ».", 2), C("Édith Vasseur a commandé deux fois plus de craie que nécessaire.", 2), C("Les relevés de chauffage consomment un étage de trop.")];
  }
  if (mysteryId === "m-employee0") {
    const who = { arlette: "Arlette Tampon", marcel: "Marcel Pivert", gustave: "l'aquarium du Hall" }[truth.id];
    return [C("Le salaire de l'Employé n°0 est versé chaque jour par le Trésor du Syndic."), C("Le compte de l'Employé n°0 est vidé quelques heures après chaque versement."), C(`Les retraits du compte n°0 portent la mention « ${truth.id === "gustave" ? "entretien aquatique" : "avance personnelle"} ».`, 2), C(`Le Registre montre que le dossier n°0 a été modifié avec le tampon de ${truth.id === "arlette" ? "la Syndic Générale" : truth.id === "marcel" ? "la conciergerie" : "l'accueil du Hall"}.`, 2), C(`Les fonds aboutissent finalement chez ${who}.`, 3)];
  }
  const who = { cercle: "des capuches du Cercle", loans: "des reçus de la Banque du Sous-Sol", cats: "des poils de chat" }[truth.id];
  return [C("La salle des commissions est réservée chaque nuit par le compte « 0000 »."), C(`Le ménage du matin y trouve ${who}.`, 2), C(`Le compte « 0000 » a été créé depuis ${truth.id === "cats" ? "un terminal de l'Étage 11" : truth.id === "loans" ? "la Banque" : "le Registre"}.`, 2), C("Les réunions nocturnes se terminent toujours à 4 h 12.")];
}

// Synchronise les occupants avec le QG : nouveaux employés, départs, chats.
export function syncPeople(world, state, now, { silent = false } = {}) {
  const changes = [];
  const rng = makeRng(hash(`${world.seed}|sync|${world.cycle}`));
  const agents = new Map((state.agents || []).map((a) => [a.id, a]));
  for (const agent of agents.values()) {
    let person = world.people[agent.id];
    if (!person) {
      person = employeePerson(agent, rng);
      person.lastSeenCycle = world.cycle;
      world.people[agent.id] = person;
      ensureAccount(world, accountOf("p", agent.id), { owner: agent.id, balance: 0 });
      if (!silent) changes.push({ kind: "arrival", person });
    } else {
      person.name = agent.name;
      if (person.status === "fired" && person.kind === "employee") {
        person.status = "active";
        person.employer = "bosscorp";
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
      person.workRoom = "f0.hall";
      person.career.push({ cycle: world.cycle, text: "Licencié de l'Étage 11 (ton entreprise)" });
      changes.push({ kind: "fired", person });
    }
  }
  for (const cat of state.life?.cats || []) {
    if (!world.people[cat.id]) {
      world.people[cat.id] = catPerson(cat, rng);
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

// ------------------------------------------------------------------ migration v1 → v2

// Ancien plan (v1) → nouveau plan : chaque ancien étage rejoint son équivalent.
const FLOOR_MAP_V1 = { roof: "ph", f13: GHOST_FLOOR, f12: "f12", f11: "f12", f10: "f2", f9: "f2", f8: "f8", f7: "f5", f6: "f4", f5: "f9", f4: "f6", f3: "f3", f2: "f0", f1: COMPANY_FLOOR, f0: "f0", fm1: "f3", fm2: "fm1" };

// La « Grande Renumérotation » : rien n'est effacé, tout est déménagé, et c'est consigné.
export function migrateWorldV1(world, state, now) {
  const rng = makeRng(hash(`${world.seed}|v2`));
  const oldGhost = world.building.floors?.f13;
  const { floors, rooms, objects } = buildBuilding();
  if (oldGhost) Object.assign(floors[GHOST_FLOOR], { discovered: oldGhost.discovered, status: oldGhost.status === "rumored" ? "rumored" : oldGhost.status, onPlan: !!oldGhost.onPlan, anomaly: oldGhost.anomaly || 40, note: oldGhost.note || null });
  // Couloirs impossibles apparus en v1 : ils deviennent des pièces du palier le plus proche.
  for (const f of Object.values(world.building.floors || {})) {
    if (!f.id?.startsWith("fx")) continue;
    const id = `f0.${f.id}`;
    rooms[id] = { id, floor: "f0", name: f.name, kind: "special", desc: f.blurb || "Un couloir apparu sans permis de construire.", access: "public", exits: ["f0.palier"], log: [], discovered: true };
    rooms["f0.palier"].exits.push(id);
    floors.f0.rooms.push(id);
  }
  world.building = { ...world.building, floors, rooms };
  world.objects = objects;
  world.relations ||= {};
  for (const r of Object.values(world.relations)) {
    r.ab ??= r.score;
    r.ba ??= r.score;
  }
  for (const def of RESIDENTS) {
    const p = world.people[def.id];
    if (!p) continue;
    Object.assign(p, { floor: def.floor, dept: def.dept, workRoom: def.workRoom, homeRoom: def.homeRoom || HOME_ROOMS[hash(def.id) % HOME_ROOMS.length] });
    if (p.title !== def.title) p.career.push({ cycle: world.cycle, text: `Nouveau titre après la Grande Renumérotation : ${def.title}` });
    p.title = def.title;
  }
  for (const p of Object.values(world.people)) {
    if (!p.workRoom) {
      if (p.kind === "employee" || p.id.startsWith("cat-")) {
        p.floor = COMPANY_FLOOR;
        p.workRoom = p.kind === "animal" ? "f11.repos" : QG_ROOM_BY_ROLE[(state.agents || []).find((a) => a.id === p.id)?.role] || "f11.openspace";
        p.homeRoom = p.kind === "animal" ? "f11.repos" : HOME_ROOMS[hash(p.id) % HOME_ROOMS.length];
        p.dept = "qg";
      } else {
        p.floor = FLOOR_MAP_V1[p.floor] || "f0";
        p.workRoom = `${p.floor}.palier`;
        p.homeRoom = HOME_ROOMS[hash(p.id) % HOME_ROOMS.length];
      }
    }
    if (p.status === "fired" && p.kind === "employee") p.workRoom = "f0.hall";
    p.location = p.workRoom;
    enrichPerson(p, rng);
  }
  for (const c of Object.values(world.companies)) c.floor = FLOOR_MAP_V1[c.floor] || c.floor;
  const fresh = defaultConfig();
  world.config = { ...fresh, ...world.config, notify: { ...fresh.notify, ...(world.config.notify || {}) }, ai: { ...fresh.ai, ...(world.config.ai || {}) } };
  world.config.population = Math.max(fresh.population, Object.keys(world.people).length);
  world.money.arrivals ||= 0;
  world.simTime ??= world.lastCycleAt;
  Object.assign(world, { arcs: world.arcs || {}, gags: world.gags || {}, metrics: world.metrics || [], owner: world.owner || { follows: [], actions: [], debug: [] }, gaps: world.gaps || [], rev: world.rev || 0 });
  // Les stars et les nouveaux habitants emménagent (avec leurs économies, consignées).
  let brought = 0;
  for (const s of starPeople()) {
    if (world.people[s.id]) continue;
    const { wealth, ...p } = s;
    world.people[p.id] = enrichPerson(p, rng);
    ensureAccount(world, accountOf("p", p.id), { owner: p.id, balance: wealth });
    brought += wealth;
  }
  for (const o of ORGS) {
    if (world.orgs[o.id]) continue;
    const members = o.members.filter((id) => world.people[id]);
    if (!members.length) continue;
    world.orgs[o.id] = { ...o, members, leader: members[0], status: "active", reputation: 50, public: !o.secret, foundedCycle: world.cycle, history: [] };
    ensureAccount(world, accountOf("o", o.id), { owner: o.id, kind: "org", balance: 0 });
  }
  const arrivals = topUpPopulation(world, now, { silent: true });
  brought += arrivals.reduce((s, p) => s + world.accounts[accountOf("p", p.id)].balance, 0);
  world.money.arrivals += brought;
  seedRelations(world, rng, now);
  world.version = WORLD_VERSION;
  return { arrivals: arrivals.length, brought };
}
