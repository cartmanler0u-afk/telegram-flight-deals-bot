// Département des Mystères et moteur WTF : enquêtes à indices, hypothèses (vraies ou fausses),
// résolutions qui changent le monde, et anomalies rares (étage 13, doubles, morts
// administratives, couloirs impossibles, souvenirs contradictoires, légendes).
// Les anomalies ont des conditions, une rareté, un délai de récupération et une portée
// enregistrée : elles ne réécrivent jamais le passé, elles ajoutent des faits.

import { MYSTERY_SEEDS } from "./cast.js";
import { worldId, atPlace, withArticle } from "./core.js";
import { GHOST_FLOOR } from "./building.js";
import { accountOf } from "./ops.js";
import { hasLaw } from "./politics.js";

const DAYC = 48; // cycles par jour (cycles de 30 min)

// ------------------------------------------------------------------ mystères

export function mysteriesCycle(cx) {
  const { world, rng } = cx;
  const night = cx.hour >= 22 || cx.hour < 6;
  if (cx.hour >= 10 && cx.once("newmystery")) rumorSourceMystery(cx);
  for (const m of Object.values(world.mysteries)) {
    if (m.status !== "open") continue;
    if (m.dynamic && world.cycle - m.openedCycle > 14 * DAYC) {
      coldCase(cx, m);
      continue;
    }
    const investigators = m.investigators.map((id) => world.people[id]).filter((p) => p && ["active", "admin_dead", "double"].includes(p.status));
    for (const inv of investigators) {
      if (night && hasLaw(world, "curfew")) continue;
      const focus = m.focus === inv.id ? 0.004 : 0;
      const p = (0.0012 + (inv.skills.investigation || 3) * 0.0004 + focus) * leverage(world, m, inv, night) + (world.flags.auditUntil > world.cycle && m.id === "m-employee0" ? 0.006 : 0);
      if (rng.chance(p)) findClue(cx, m, inv);
    }
    if (cx.hour >= 17 && cx.once(`hyp:${m.id}`)) hypothesize(cx, m, investigators);
    const found = m.clues.filter((c) => c.found).reduce((s, c) => s + c.weight, 0);
    if (found >= m.required) {
      const solver = investigators.find((inv) => m.hypotheses.some((h) => h.by === inv.id && h.correct));
      if (solver) solveMystery(cx, m, solver);
    }
  }
}

// Les grands mystères du Bâtiment ne cèdent qu'aux bonnes conditions : être allé au 13,
// enquêter la nuit, profiter d'un audit du Registre… Sinon on piétine, longtemps.
function leverage(world, m, inv, night) {
  if (m.dynamic) return 1;
  if (m.id === "m-floor13") return inv.flags.visited13 ? 2 : 0.3;
  if (m.id === "m-nightroom") return night && inv.traits.includes("nightowl") ? 2.5 : night ? 1 : 0.25;
  if (m.id === "m-employee0") return inv.floor === "f2" || inv.id === "r-ambroise" ? 1 : 0.3;
  return 1;
}

function findClue(cx, m, inv) {
  const index = m.clues.findIndex((c) => !c.found);
  if (index < 0) return null;
  const clue = m.clues[index];
  const journalist = inv.id === "r-felix" || inv.traits.includes("gossip");
  return cx.commit({
    source: "system",
    kind: "clue",
    key: `clue:${m.id}:${index}`,
    ops: [{ op: "mystery", id: m.id, action: "clue", index, by: inv.id }],
    event: { kind: "clue", title: `${m.title} : ${inv.name} trouve un indice`, text: clue.text, actors: [inv.id], importance: clue.weight >= 2 ? 4 : 3, public: journalist, tags: ["mystère", "indice"] },
    facts: [{ kind: "clue", text: clue.text, about: [inv.id], status: "confirmed", truth: true, public: journalist, knownBy: [inv.id], mystery: m.id }],
  });
}

function hypothesize(cx, m, investigators) {
  const { world, rng } = cx;
  const options = m.options || MYSTERY_SEEDS.find((s) => s.id === m.id)?.truths;
  if (!options?.length) return;
  // Les théoriciens parlent même sans indice ; les enquêteurs s'appuient sur ce qu'ils ont trouvé.
  const theorists = Object.values(world.people).filter((p) => p.status === "active" && p.ambition?.theory && !investigators.includes(p));
  const speaker = rng.pick([...investigators, ...(theorists.length ? [rng.pick(theorists)] : [])]);
  if (!speaker || !rng.chance(0.35)) return;
  const known = m.clues.filter((c) => c.found && (c.foundBy === speaker.id || cx.knowsClue(speaker.id, m.id, c.text))).reduce((s, c) => s + c.weight, 0);
  const guess = rng.weighted(options.map((t) => [t, t.id === m.truth.id ? 1 + known * 1.2 : 1]));
  const correct = guess.id === m.truth.id;
  if (m.hypotheses.some((h) => h.by === speaker.id && h.text === guess.text)) return;
  cx.commit({
    source: "agent",
    kind: "hypothesis",
    ops: [{ op: "mystery", id: m.id, action: "hypothesis", by: speaker.id, text: guess.text, correct }],
    event: { kind: "hypothesis", title: `${speaker.name} a une théorie sur « ${m.title} »`, text: `« ${guess.text} » ${known ? `Selon ${speaker.name}, les indices concordent.` : "Aucune preuve, mais beaucoup de conviction."}`, actors: [speaker.id], importance: 2, tags: ["mystère", "théorie"] },
    facts: [{ kind: "hypothesis", text: `${speaker.name} affirme : ${guess.text}`, about: [speaker.id], status: "hypothesis", truth: correct, public: true, mystery: m.id }],
  });
}

// Mystère émergent : « Qui a lancé la rumeur sur X ? ». La vérité est l'auteur RÉEL de la
// rumeur (événement privé enregistré) ; les indices sont tirés de l'état du Bâtiment.
function rumorSourceMystery(cx) {
  const { world, rng } = cx;
  const open = Object.values(world.mysteries).filter((m) => m.status === "open" && m.dynamic);
  if (open.length >= 2) return null;
  const lastOpened = Math.max(-999, ...Object.values(world.mysteries).filter((m) => m.dynamic).map((m) => m.openedCycle));
  if (world.cycle - lastOpened < 3 * DAYC) return null;
  const used = new Set(Object.values(world.mysteries).map((m) => m.sourceEvent).filter(Boolean));
  const smear = rng.pick(world.events.filter((e) => e.kind === "smear" && !e.public && !used.has(e.id) && world.cycle - e.cycle <= 4 * DAYC && e.actors.length === 2));
  if (!smear || !rng.chance(0.5)) return null;
  const [authorId, victimId] = smear.actors;
  const author = world.people[authorId];
  const victim = world.people[victimId];
  if (!author || !victim || victim.status !== "active") return null;
  if (Object.values(world.mysteries).some((m) => m.dynamic && m.investigators[0] === victim.id && world.cycle - m.openedCycle < 7 * DAYC)) return null;
  const floorName = (id) => world.building.floors[id]?.name || "un étage";
  const decoys = rng.shuffle(Object.values(world.people).filter((p) => p.id !== authorId && p.id !== victimId && p.kind !== "animal" && ["active", "fired", "double"].includes(p.status) && p.floor !== author.floor)).slice(0, 2);
  if (decoys.length < 2) return null;
  const friend = cx.friendsOf(authorId).map((id) => world.people[id]).find(Boolean);
  const C = (text, weight = 1) => ({ text, weight, found: false, foundBy: null, cycle: null });
  const suspects = rng.shuffle([author, ...decoys]);
  const id = worldId(world, "my");
  return cx.commit({
    source: "system",
    kind: "mystery_open",
    key: `mystery:${smear.id}`,
    ops: [{
      op: "mystery",
      action: "open",
      mystery: {
        id,
        dynamic: true,
        kind: "rumor_source",
        sourceEvent: smear.id,
        title: `Qui salit ${victim.name} ?`,
        question: `Qui a lancé la rumeur qui court sur ${victim.name} ?`,
        truth: { id: author.id, text: `C'est ${author.name} qui a lancé la rumeur sur ${victim.name}.`, suspect: author.id },
        options: suspects.map((s) => ({ id: s.id, text: `C'est ${s.name} qui a lancé la rumeur sur ${victim.name}.` })),
        suspects: suspects.map((s) => s.id),
        clues: [
          C(`La rumeur a été entendue pour la première fois ${atPlace(floorName(author.floor))}.`),
          C(`Le premier à l'avoir répétée travaille ${author.employer ? `chez ${world.companies[author.employer]?.name || "le Syndic"}` : "nulle part"}.`),
          C(friend ? `${friend.name} a entendu l'histoire « de la bouche même » d'un proche.` : "La machine à café du palier a tout entendu, mais refuse de témoigner.", 2),
          C(`Radio Cage d'Escalier a reçu un appel anonyme depuis ${withArticle(floorName(author.floor))}.`, 2),
        ],
        required: 4,
        investigators: [victim.id, world.people["r-felix"]?.status === "active" ? "r-felix" : null].filter(Boolean),
      },
    }],
    event: { kind: "mystery_open", title: `Nouveau mystère : qui salit ${victim.name} ?`, text: `Une rumeur empoisonne la réputation de ${victim.name}. Trois noms circulent : ${suspects.map((s) => s.name).join(", ")}. ${victim.name} jure de trouver le coupable.`, actors: [victim.id], importance: 3, tags: ["mystère", "rumeur"] },
  });
}

function coldCase(cx, m) {
  const { world } = cx;
  return cx.commit({
    source: "system",
    kind: "cold_case",
    key: `cold:${m.id}`,
    ops: [{ op: "mystery", id: m.id, action: "status", status: "cold" }],
    event: { kind: "cold_case", title: `Affaire classée : ${m.title}`, text: `Deux semaines sans conclusion. Le dossier rejoint les Objets Trouvés. ${m.hypotheses.length ? `${m.hypotheses.length} théorie(s) restent en circulation, aucune prouvée.` : "Personne n'a même osé une théorie."}`, actors: m.investigators.filter((id) => world.people[id]).slice(0, 3), importance: 2, tags: ["mystère"] },
  });
}

function solveMystery(cx, m, solver) {
  const { world } = cx;
  const t = m.truth;
  const ops = [{ op: "mystery", id: m.id, action: "solve", by: solver.id }, { op: "person", id: solver.id, reputation: 12, career: `Résout le mystère « ${m.title} »` }, { op: "building", mood: 4 }];
  const followups = [];
  let consequence = "";
  if (m.id === "m-floor13") {
    ops.push({ op: "floor", id: GHOST_FLOOR, set: { discovered: true, status: "contested", note: t.text } });
    if (t.id === "sealed") {
      ops.push({ op: "person", id: "r-arlette", reputation: -15 });
      consequence = "Le Syndic a menti pendant des années. L'Hémicycle devra décider si l'Étage 10 entre au Plan Officiel.";
    } else {
      ops.push({ op: "person", id: "r-edith", reputation: -10 }, { op: "company", id: "labo", action: "set", set: { reputation: 35 } }, { op: "building", pressure: 10 });
      consequence = "Le Laboratoire a fabriqué un étage par accident. Personne ne sait comment le retirer.";
    }
    followups.push({ op: "schedule", dueCycle: world.cycle + DAYC, kind: "floor_vote", payload: { floor: GHOST_FLOOR } });
  } else if (m.id === "m-employee0") {
    if (t.id === "arlette") {
      ops.push({ op: "person", id: "r-arlette", reputation: -25 }, { op: "account", id: "emp0", frozen: true });
      followups.push({ op: "schedule", dueCycle: world.cycle + 12, kind: "file_case", payload: { kind: "embezzlement", plaintiff: "r-colette", defendant: "r-arlette", title: "L'Union contre Arlette Tampon (dossier n°0)" } });
      consequence = "La Syndic Générale détournait le salaire d'un employé imaginaire. L'Union réclame un procès.";
    } else if (t.id === "marcel") {
      ops.push({ op: "person", id: "r-marcel", set: { status: "admin_dead" }, career: "Fusionné administrativement avec l'Employé n°0" }, { op: "account", id: accountOf("p", "r-marcel"), frozen: true });
      followups.push({ op: "schedule", dueCycle: world.cycle + 24, kind: "file_case", payload: { kind: "admin_death", plaintiff: "r-marcel", title: "Marcel Pivert contre le Registre" } });
      consequence = "Marcel était l'Employé n°0. Le Registre, incapable de gérer deux identités, a déclaré Marcel administrativement mort. Il continue d'ouvrir la porte du Hall.";
    } else {
      ops.push({ op: "person", id: "r-gustave", set: { flags: { ...(world.people["r-gustave"]?.flags || {}), employee: true, campaigning: true } }, career: "Reconnu salarié du Bâtiment" }, { op: "account", id: "emp0", frozen: true });
      consequence = "Gustave le homard est officiellement salarié depuis toujours. Une pétition réclame la personnalité juridique des animaux.";
    }
    world.flags.emp0Frozen = true;
  } else if (m.kind === "rumor_source") {
    const victim = m.investigators[0];
    ops.push({ op: "person", id: t.suspect, reputation: -10, career: "Démasqué comme source d'une rumeur" });
    if (world.people[victim] && victim !== t.suspect) ops.push({ op: "relation", a: victim, b: t.suspect, kind: "rival", score: -80, note: "Il/elle a lancé la rumeur." }, { op: "person", id: victim, reputation: 6 });
    consequence = "La rumeur s'effondre ; son auteur, beaucoup moins vite.";
  } else if (m.id === "m-nightroom") {
    if (t.id === "cercle") {
      ops.push({ op: "org", id: "o-cercle", action: "set", set: { public: true } }, { op: "person", id: "r-ambroise", reputation: 6 });
      consequence = "Le Cercle du Plan Originel sort de l'ombre. Ses membres sont désormais connus de tous.";
    } else if (t.id === "loans") {
      ops.push({ op: "person", id: "r-octave", reputation: -15 }, { op: "person", id: "r-arlette", reputation: -10 });
      const secret = Object.values(world.facts).find((f) => f.status === "secret" && f.about.includes("r-octave"));
      if (secret) ops.push({ op: "learn", fact: secret.id, people: [], publicize: true });
      consequence = "La Banque du Sous-Sol négociait des prêts secrets avec le Syndic. Les comptes publics sont à revoir.";
    } else {
      for (const cat of Object.values(world.people).filter((p) => p.id.startsWith("cat-"))) ops.push({ op: "person", id: cat.id, set: { flags: { ...cat.flags, campaigning: true } } });
      consequence = "Les chats dormaient dans la salle des commissions. Leur popularité explose.";
    }
  }
  cx.commit({
    source: "system",
    kind: "mystery_solved",
    key: `solved:${m.id}`,
    ops: [...ops, ...followups],
    event: {
      kind: "mystery_solved",
      title: `MYSTÈRE RÉSOLU — ${m.title}`,
      text: `${solver.name} rassemble les indices : ${t.text} ${consequence}`,
      actors: [solver.id, t.suspect].filter((id) => world.people[id]),
      causes: cx.recent((e) => e.kind === "clue" && e.title.startsWith(m.title), 2000).map((e) => e.id).slice(-3),
      importance: 5,
      rare: true,
      tags: ["mystère", "révélation"],
    },
    facts: [{ text: `${m.title} : ${t.text}`, about: [solver.id, t.suspect].filter((id) => world.people[id]), public: true, mystery: m.id }],
  });
}

// ------------------------------------------------------------------ anomalies

export function anomaliesCycle(cx) {
  const { world, rng } = cx;
  const b = world.building;
  b.pressure = Math.max(0, Math.round((b.pressure - 0.04 + (world.companies.labo?.status === "active" && (cx.hour >= 22 || cx.hour < 5) ? 0.12 : 0)) * 100) / 100);
  const pressure = b.pressure + (world.flags.auditUntil > world.cycle ? 10 : 0);
  const people = Object.values(world.people).filter((p) => p.status === "active" && p.kind !== "animal");

  // L'Ascenseur B s'arrête à l'Étage fantôme (le passager y est réellement déposé).
  if (rng.chance(pressure / 2600)) {
    const p = rng.pick(people);
    if (p) {
      cx.commit({
        source: "system",
        kind: "floor13_stop",
        ops: [{ op: "person", id: p.id, set: { flags: { ...p.flags, visited13: world.cycle } } }, { op: "move", id: p.id, to: `${GHOST_FLOOR}.couloir`, force: true, activity: { kind: "special", label: "cherche la sortie d'un couloir qui tourne à gauche" } }, { op: "floor", id: GHOST_FLOOR, anomaly: 5 }, { op: "building", pressure: 3 }],
        event: { kind: "floor13_stop", title: `${p.name} a passé vingt minutes à l'Étage fantôme`, room: `${GHOST_FLOOR}.couloir`, text: `L'Ascenseur B s'est ouvert sur un couloir que personne n'a jamais vu. ${p.name} en est revenu ${rng.pick(["avec une plante qui n'existe pas aux Serres", "en parlant d'une moquette « trop parfaite »", "avec dix minutes d'avance sur sa montre", "sans pouvoir décrire ce qu'il a vu"])}.`, actors: [p.id], importance: 3, tags: ["anomalie", "étage fantôme"] },
        facts: [{ text: `${p.name} affirme être allé à l'Étage fantôme.`, about: [p.id, GHOST_FLOOR], status: "rumor", truth: true, knownBy: [p.id], mystery: "m-floor13" }],
      });
    }
  }

  // Les doubles : seulement après une visite au 13 et sous forte pression.
  const lastDouble = world.anomalies.filter((a) => a.kind === "double").at(-1);
  if (pressure >= 55 && (!lastDouble || world.cycle - lastDouble.cycle > 5 * DAYC) && rng.chance(0.03)) {
    const original = rng.pick(people.filter((p) => p.flags.visited13 && world.cycle - p.flags.visited13 < 4 * DAYC && !p.doubleOf && !world.people[`${p.id}-bis`]));
    if (original) createDouble(cx, original);
  }

  // Mort administrative : erreur du Registre (audit en cours ou pression élevée).
  const lastDeath = world.anomalies.filter((a) => a.kind === "admin_death").at(-1);
  if ((!lastDeath || world.cycle - lastDeath.cycle > 4 * DAYC) && (world.flags.auditUntil > world.cycle ? rng.chance(0.02) : pressure >= 50 && rng.chance(0.004))) {
    const victim = rng.pick(people.filter((p) => !["r-arlette", "r-hermine"].includes(p.id)));
    if (victim) adminDeath(cx, victim);
  }

  // Couloir impossible.
  const lastCorridor = world.anomalies.filter((a) => a.kind === "corridor").at(-1);
  if (pressure >= 65 && (!lastCorridor || world.cycle - lastCorridor.cycle > 6 * DAYC) && rng.chance(0.012)) corridor(cx);

  // Souvenirs contradictoires (sans modifier le passé enregistré).
  const lastSplit = world.anomalies.filter((a) => a.kind === "memory_split").at(-1);
  if (pressure >= 72 && (!lastSplit || world.cycle - lastSplit.cycle > 5 * DAYC) && rng.chance(0.012)) memorySplit(cx);

  if (cx.weekday === 0 && cx.hour >= 20 && cx.once("legend")) legends(cx);
}

function createDouble(cx, original) {
  const { world, rng } = cx;
  const id = `${original.id}-bis`;
  const twin = {
    ...structuredClone(original),
    id,
    name: `${original.name} (bis)`,
    agentId: null,
    status: "double",
    doubleOf: original.id,
    employer: null,
    salary: 0,
    ambition: { kind: rng.pick(["power", "wealth", "fame"].filter((k) => k !== original.ambition?.kind)) },
    memories: [...original.memories],
    knows: [...original.knows],
    career: [{ cycle: world.cycle, text: "Sorti de l'Ascenseur B au retour de l'Étage fantôme" }],
    flags: { double: true },
    cooldownUntil: 0,
  };
  const res = cx.commit({
    source: "system",
    kind: "double",
    key: `double:${original.id}`,
    ops: [
      { op: "addPerson", person: twin },
      { op: "anomaly", anomaly: { kind: "double", scope: { people: [original.id, id] }, effects: ["deux personnes revendiquent la même identité"] } },
      { op: "schedule", dueCycle: world.cycle + 12, kind: "file_case", payload: { kind: "identity", plaintiff: original.id, defendant: id, title: `${original.name} contre ${original.name} (bis)` } },
      { op: "building", pressure: -15 },
    ],
    event: {
      kind: "double",
      title: `DEUX ${original.name.toUpperCase()} : un double sort de l'Ascenseur B`,
      text: `Quelques jours après sa visite à l'Étage fantôme, un second ${original.name} se présente au Hall. Mêmes souvenirs jusqu'au mardi, ambitions différentes depuis. Les deux revendiquent le même badge, le même bureau et le même compte. Le Registre refuse de choisir.`,
      actors: [original.id],
      causes: cx.recent((e) => e.kind === "floor13_stop" && e.actors.includes(original.id), 4 * DAYC).map((e) => e.id).slice(-1),
      importance: 5,
      rare: true,
      tags: ["anomalie", "double"],
    },
    facts: [{ text: `Il existe désormais deux ${original.name}.`, about: [original.id], public: true }],
  });
  if (res.ok) {
    world.people[id].memories.push(res.event.id);
    cx.commit({ source: "system", kind: "double_rel", ops: [{ op: "relation", a: original.id, b: id, kind: "rival", score: -70, note: "Ils ne supportent pas de se voir dans un miroir qui répond." }] });
  }
  return res;
}

function adminDeath(cx, victim) {
  const { world } = cx;
  return cx.commit({
    source: "system",
    kind: "admin_death",
    key: `death:${victim.id}:${world.cycle}`,
    ops: [
      { op: "person", id: victim.id, set: { status: "admin_dead" }, career: "Déclaré mort par le Registre" },
      { op: "account", id: accountOf("p", victim.id), frozen: true },
      { op: "anomaly", anomaly: { kind: "admin_death", scope: { people: [victim.id] }, effects: ["compte gelé", "salaire suspendu", "droit de vote suspendu"] } },
      { op: "schedule", dueCycle: world.cycle + 24, kind: "file_case", payload: { kind: "admin_death", plaintiff: victim.id, title: `${victim.name} contre le Registre` } },
    ],
    event: {
      kind: "admin_death",
      title: `${victim.name} est déclaré mort par le Registre`,
      text: `Une ligne du Registre a changé pendant la nuit. ${victim.name} n'existe plus administrativement : compte gelé, salaire suspendu, badge refusé. ${victim.name} est pourtant venu travailler ce matin, très vexé.`,
      actors: [victim.id],
      importance: 4,
      rare: true,
      tags: ["anomalie", "administration"],
    },
    facts: [{ text: `Le Registre considère que ${victim.name} est mort.`, about: [victim.id], public: true }],
  });
}

function corridor(cx) {
  const { world, rng } = cx;
  const levels = Object.values(world.building.floors).map((f) => f.level);
  const base = rng.pick(levels.filter((l) => l >= 0 && l < 12 && l !== 10));
  if (base === undefined) return null;
  const floor = Object.values(world.building.floors).find((f) => f.level === base);
  if (!floor) return null;
  const id = `${floor.id}.x${world.cycle.toString(36)}`;
  const name = rng.pick([`Couloir ${base}½`, `Palier ${base} bis`, `Mezzanine du ${base}`]);
  return cx.commit({
    source: "system",
    kind: "corridor",
    ops: [
      { op: "room", action: "add", room: { id, floor: floor.id, name, kind: "special", desc: "Apparu sans permis de construire. De la moquette, un distributeur de boissons et une plante en pot. Absent du Plan Officiel.", onPlan: false } },
      { op: "anomaly", anomaly: { kind: "corridor", scope: { floor: floor.id, room: id }, effects: ["nouvel espace hors Plan"] } },
      { op: "schedule", dueCycle: world.cycle + DAYC, kind: "floor_vote", payload: { room: id } },
      { op: "building", pressure: -20 },
    ],
    event: { kind: "corridor", title: `Un « ${name} » apparaît entre deux étages`, text: `Il n'y était pas hier. Il y a de la moquette, un distributeur de boissons et une plante en pot. Le Plan Officiel ne le mentionne pas : l'Hémicycle devra décider de son existence légale.`, actors: ["r-ambroise", "r-arlette"].filter((x) => world.people[x]), importance: 4, rare: true, tags: ["anomalie", "bâtiment"] },
    facts: [{ text: `Un espace nommé « ${name} » est apparu hors du Plan Officiel.`, about: [floor.id], public: true }],
  });
}

function memorySplit(cx) {
  const { world, rng } = cx;
  const past = rng.pick(world.events.filter((e) => e.importance >= 3 && e.public && world.cycle - e.cycle > DAYC && e.actors.length));
  const floorId = rng.pick(["f8", "f6", "f3", "f1"]);
  const group = Object.values(world.people).filter((p) => p.floor === floorId && p.status === "active").slice(0, 6);
  if (!past || group.length < 2) return null;
  const subject = world.people[past.actors[0]];
  const variant = `${subject?.name || "Quelqu'un"} n'aurait jamais ${rng.pick(["été présent", "dit un mot", "signé quoi que ce soit"])} lors de « ${past.title} »`;
  return cx.commit({
    source: "system",
    kind: "memory_split",
    ops: [{ op: "anomaly", anomaly: { kind: "memory_split", scope: { people: group.map((p) => p.id), event: past.id, floor: floorId }, effects: ["souvenirs divergents d'un événement enregistré"] } }, { op: "building", pressure: -18 }],
    event: { kind: "memory_split", title: `Souvenirs contradictoires ${atPlace(world.building.floors[floorId]?.name || "Bâtiment")}`, text: `${group.map((p) => p.name).join(", ")} se souviennent autrement de « ${past.title} » : selon eux, ${variant}. Les archives, elles, n'ont pas changé.`, actors: group.map((p) => p.id).slice(0, 5), causes: [past.id], importance: 4, rare: true, tags: ["anomalie", "mémoire"] },
    facts: [{ kind: "memory_variant", text: `Souvenir divergent : ${variant}.`, about: subject ? [subject.id] : [], status: "hypothesis", truth: false, knownBy: group.map((p) => p.id) }],
  });
}

// Les personnages secondaires peuvent devenir des légendes (et les puissants tomber).
function legends(cx) {
  const { world } = cx;
  const deltas = Object.values(world.people)
    .filter((p) => p.influenceHistory.length >= 5)
    .map((p) => ({ p, delta: p.influence - p.influenceHistory[Math.max(0, p.influenceHistory.length - 7)].value }));
  const riser = deltas.filter((d) => !d.p.flags.legend && d.delta >= 18 && d.p.influence >= 55).sort((a, b) => b.delta - a.delta)[0];
  if (riser) {
    cx.commit({
      source: "system",
      kind: "legend",
      key: `legend:${riser.p.id}`,
      ops: [{ op: "person", id: riser.p.id, set: { flags: { ...riser.p.flags, legend: true } }, reputation: 8, career: "Devient une Légende du Bâtiment" }],
      event: { kind: "legend", title: `${riser.p.name} entre dans la légende du Bâtiment`, text: `Il y a une semaine, ${riser.p.name} était « ${riser.p.title} ». Son influence a bondi de ${riser.delta} points. On commence à raconter ses exploits dans l'ascenseur.`, actors: [riser.p.id], causes: riser.p.memories.slice(-3), importance: 5, rare: true, tags: ["légende", "carrière"] },
    });
  }
  const faller = deltas.filter((d) => d.delta <= -22).sort((a, b) => a.delta - b.delta)[0];
  if (faller) {
    cx.commit({
      source: "system",
      kind: "fall",
      key: `fall:${faller.p.id}:${cx.dayKey}`,
      event: { kind: "fall", title: `La chute de ${faller.p.name}`, text: `${faller.delta} points d'influence en une semaine. Le badge de ${faller.p.name} ouvre désormais moins de portes.`, actors: [faller.p.id], causes: faller.p.memories.slice(-2), importance: 3, tags: ["carrière"] },
    });
  }
}
