// Vie quotidienne des ~250 habitants : besoins, emplois du temps, déplacements, activités,
// rencontres et rumeurs de proximité.
//
// Niveau de détail adapté aux ressources : TOUT LE MONDE a des besoins, un emploi du temps
// et une localisation mise à jour à chaque cycle (règles déterministes, coût négligeable) ;
// seules quelques RENCONTRES par cycle sont résolues (paires de personnes réellement
// présentes dans la même pièce), et seules les rencontres marquantes deviennent des
// événements. Une rumeur ne circule qu'entre personnes qui se croisent.

import { accessDenied, floorDistance, floorOf, roomId, PALIER } from "./building.js";
import { clamp, hash, atPlace } from "./core.js";
import { knows } from "./memory.js";
import { quip, reactions, gag } from "./humor.js";

const DAYC = 48;
const AWAKE_KINDS = new Set(["work", "meeting", "food", "social", "transit", "special", "secret", "owner"]);

// ------------------------------------------------------------------ activités

const WORK_VERBS = {
  accueil: ["accueille un visiteur qui cherche « le bureau de Gérard »", "remplit le registre des visites avec une calligraphie soignée", "surveille l'aquarium de Gustave, par principe", "répond au téléphone : « Bâtiment 0, j'écoute »"],
  cafeteria: ["épluche des pommes de terre avec une rage contenue", "réchauffe des plateaux-repas", "négocie avec le distributeur de café", "sert le plat du jour : « surprise du Chef »"],
  logistique: ["scanne des colis qui n'ont pas de destinataire", "conduit un chariot élévateur trop vite", "recompte l'inventaire, qui ne tombe toujours pas juste", "range un carton marqué « NE PAS OUVRIR (sauf Ludovic) »"],
  etrange: ["inventorie un objet qui n'était pas là hier", "écoute un mur avec un stéthoscope", "classe un dossier daté de la semaine prochaine", "note quelque chose qu'il refuse de montrer"],
  rh: ["prépare un entretien « bienveillant mais ferme »", "met à jour un organigramme qui change toutes les heures", "imprime des évaluations à 3 étoiles", "organise un atelier « mieux se connaître pour mieux se surveiller »"],
  direction: ["prépare un PowerPoint sur la préparation des PowerPoint", "fait semblant de comprendre un tableau croisé dynamique", "valide une décision prise par quelqu'un d'autre", "réécrit la vision stratégique pour la quatrième fois de la semaine"],
  bourse: ["crie « ACHÈTE ! » sans savoir quoi", "recalcule un taux d'intérêt créatif", "pitche une start-up à un pouf", "surveille le cours de la part de la Biscuiterie"],
  medias: ["cherche un angle", "monte une vidéo verticale de 9 secondes", "réécrit un titre jusqu'à ce qu'il soit faux", "prépare une interview « sans concession »"],
  labos: ["mélange deux liquides « pour voir »", "teste un prototype de chaise auto-réservante", "pose une question à K.E.V.I.N. (réponse : « ça dépend »)", "rédige un protocole après l'expérience"],
  parlement: ["amende un amendement", "compte les voix sur ses doigts", "rédige une proposition de loi sur les post-it", "négocie à voix basse près de la buvette"],
  club: ["savoure un jus de raisin millésimé", "parle de vacances que personne n'a prises", "observe la salle en évaluant les dettes de chacun", "chuchote un nom en regardant vers la porte"],
  hotel: ["plie des draps avec une précision militaire", "recense les chaussettes orphelines", "range le salon après la fête d'hier", "note qui est rentré à quelle heure"],
  tribunal: ["tamponne une pièce à conviction", "relit le règlement intérieur, crayon à la main", "interroge la plante témoin", "classe une plainte contre le distributeur de café"],
  technique: ["répare une fuite qui n'en est pas une", "parle doucement à une fougère", "redémarre un serveur qui « se souvient »", "règle le chauffage d'un étage de trop"],
  qg: ["travaille sur une mission pour ton entreprise", "défend son agrafeuse", "fait une visio avec un client imaginaire", "prépare un livrable pour le patron"],
};
const ROOM_VERBS = {
  meeting: ["assiste à une réunion dont personne ne connaît l'objet", "prend des notes pour avoir l'air occupé", "attend son tour de parole depuis 40 minutes", "propose de « faire un point »"],
  food: ["mange un plateau-repas en jugeant celui des autres", "fait la queue au distributeur", "partage un dessert, à contrecœur", "lit la Gazette en mâchant fort"],
  social: ["discute près de la machine à café", "écoute aux portes, l'air de rien", "partage une théorie à voix basse", "regarde le pigeon du Hall avec respect"],
  rest: ["dort", "regarde le plafond en repensant à la réunion", "écrit un mail qu'il n'enverra jamais", "fait une sieste réglementaire"],
  transit: ["attend l'Ascenseur B", "monte l'escalier en soufflant", "fait semblant de téléphoner sur le palier"],
  special: ["observe la pièce avec méfiance", "touche un objet qu'il ne faudrait pas toucher", "prend des notes sur ce qui n'existe pas"],
  secret: ["fouille discrètement", "fait semblant d'être perdu"],
  owner: ["attend le propriétaire"],
};

function activityFor(rng, p, room, slot) {
  if (!room) return { kind: "idle", label: "est quelque part" };
  if (slot === "sleep" && room.kind === "rest") return { kind: "sleep", label: p.kind === "animal" ? "dort en boule" : rng.pick(["dort", "dort (ronfle légèrement)", "dort en rêvant d'une promotion"]) };
  if (p.kind === "animal") return { kind: "animal", label: rng.pick(p.species === "pigeon" ? ["roucoule de façon politique", "picore des miettes de croissant", "fixe un candidat"] : p.species === "homard" ? ["juge le Hall depuis son aquarium", "bouge une pince, lentement"] : ["dort sur un clavier", "réclame des croquettes", "observe un humain avec mépris"]) };
  if (room.kind === "work" && room.id === p.workRoom) return { kind: "work", label: rng.pick(WORK_VERBS[p.dept] || WORK_VERBS.qg) };
  const kind = room.kind === "work" ? "work" : room.kind;
  return { kind, label: rng.pick(ROOM_VERBS[room.kind] || ROOM_VERBS.social) };
}

// ------------------------------------------------------------------ emplois du temps

const within = (hour, start, end) => (start <= end ? hour >= start && hour < end : hour >= start || hour < end);

function sleepWindow(p) {
  if (p.habits?.includes("nightowl")) return [3, 11];
  if (p.habits?.includes("early")) return [22, 6];
  return [23, 7];
}

function workWindow(p) {
  const h = hash(p.id);
  const start = p.habits?.includes("early") ? 7 : p.habits?.includes("late") ? 10 : 8 + (h % 2);
  const end = p.habits?.includes("overtime") ? 20 : 17 + ((h >> 3) % 2);
  return [start, end];
}

export function slotOf(p, hour, weekday) {
  if (p.kind === "animal") return within(hour, 22, 7) ? "sleep" : "animal";
  if (within(hour, ...sleepWindow(p))) return "sleep";
  const lunch = p.habits?.includes("lunch_late") ? 14 : 12 + (hash(p.id) % 2);
  if (hour === lunch) return "lunch";
  const weekend = weekday === 0 || weekday === 6;
  const [ws, we] = workWindow(p);
  if (!weekend && hour >= ws && hour < we) return p.dept === "club" ? "club" : "work";
  if (weekend && hour >= 10 && hour < 19) return "leisure";
  return "evening";
}

function foodRoom(cx, p) {
  if (p.dept === "club" || p.flags?.club) return "f7.diner";
  if (p.dept === "parlement") return "f6.buvette";
  if (p.dept === "qg") return "f11.cuisine";
  const strike = !!cx.world.flags.strike;
  const cheese = cx.hasLaw("cheese_ban");
  const options = [["f0.cafeteria", strike ? 0 : cheese ? 3 : 7], ["f3.biscuiterie", p.traits?.includes("foodie") ? 3 : 1.5], ["f8.cuisine", 2]];
  return cx.rng.weighted(options);
}

function baseRoom(cx, p, slot) {
  const { rng } = cx;
  const w = cx.world;
  switch (slot) {
    case "sleep":
      return p.homeRoom;
    case "animal":
      if (p.species === "homard") return "f0.hall";
      if (p.species === "pigeon") return rng.weighted([["f0.hall", 7], ["f0.cafeteria", 1.5], ["f6.hemicycle", p.flags?.campaigning ? 4 : 1]]);
      return rng.weighted([[p.workRoom, 7], ["f11.openspace", 2], ["f0.hall", 0.5]]);
    case "lunch":
      return foodRoom(cx, p);
    case "work":
      if (!p.employer && p.kind !== "resident") return rng.pick(["f0.hall", "fm1.objets", "f0.plaintes"]);
      return p.workRoom || p.homeRoom;
    case "club":
      return rng.weighted([["f7.salon", 5], ["f7.fumoir", 2], ["f7.diner", 1]]);
    case "leisure":
      return rng.weighted([["f8.salon", 4], ["f0.hall", 2], ["f12.serres", 1], ["f8.buanderie", 1.5], ["f0.cafeteria", 2], [p.homeRoom, 3], ["f3.startups", p.traits?.includes("hustler") ? 2 : 0.2]]);
    default: {
      if (p.flags?.club || p.dept === "club") return rng.weighted([["f7.fumoir", 4], ["f7.salon", 3], [p.homeRoom, 2]]);
      if (p.dept === "parlement" && rng.chance(0.5)) return "f6.buvette";
      if (p.habits?.includes("karaoke") || p.traits?.includes("party")) return rng.weighted([["f8.salon", 5], ["f0.hall", 1]]);
      if (p.traits?.includes("gossip")) return rng.weighted([["f8.buanderie", 3], ["f8.salon", 2], ["f0.hall", 1]]);
      if (w.flags.party && w.flags.party.until > w.cycle && rng.chance(0.5)) return w.flags.party.room;
      return rng.weighted([[p.homeRoom, 4], ["f8.salon", 2.5], ["f0.hall", 1.5], ["f0.cafeteria", 1], ["f8.cuisine", 1]]);
    }
  }
}

// Petites pauses pendant le travail (café, potins, sieste, réunion…).
function breakRoom(cx, p) {
  const { rng, hour } = cx;
  const h = p.habits || [];
  if (h.includes("coffee") && rng.chance(0.12)) return "f0.cafeteria";
  if (h.includes("gossip_break") && rng.chance(0.08)) return rng.pick(["f8.buanderie", "f0.hall"]);
  if (h.includes("napper") && hour >= 14 && hour < 16 && rng.chance(0.18)) return p.homeRoom;
  if (h.includes("plants") && rng.chance(0.04)) return "f12.serres";
  const meetingRooms = { direction: ["f2.reunionA", "f2.reunionA", "f2.reunionB"], rh: ["f1.seminaire", "f1.entretiens"], medias: ["f4.tv"], labos: ["f5.social"], bourse: ["f3.negos"], qg: ["f11.reunion"] }[p.dept];
  if (meetingRooms && rng.chance(p.dept === "direction" ? 0.22 : 0.08)) return rng.pick(meetingRooms);
  if (p.dept === "parlement" && hour >= 15 && hour < 17) return "f6.hemicycle";
  if (p.dept === "tribunal" && hour === 11) return "f9.audience";
  return null;
}

function targetFor(cx, p, slot) {
  const go = p.flags?.goTo;
  if (go && go.until > cx.world.cycle && cx.world.building.rooms[go.room]) return go.room;
  if (slot === "work") {
    if (p.location === p.workRoom) return breakRoom(cx, p) || p.workRoom;
    if (p.slot === "work" && p.flags?.onBreak) return p.workRoom; // la pause est finie
    return baseRoom(cx, p, slot);
  }
  // Même créneau qu'au cycle précédent : on reste en général où l'on est (on ne zappe pas de pièce en pièce).
  if (slot === p.slot && slot !== "lunch" && p.location !== `${p.location.split(".")[0]}.palier` && cx.rng.chance(slot === "sleep" ? 1 : 0.85)) return p.location;
  return baseRoom(cx, p, slot);
}

// ------------------------------------------------------------------ besoins

function updateNeeds(p, room, others) {
  const n = (p.needs ||= { energy: 70, hunger: 30, social: 50, stress: 30 });
  for (const k of Object.keys(n)) n[k] = Math.round(n[k]);
  if (p.kind === "animal") {
    // Les animaux du bâtiment font la sieste quand ils veulent et quelqu'un finit toujours par les nourrir.
    n.energy = clamp(n.energy + (n.energy < 30 ? 8 : -1.5), 0, 100);
    n.hunger = n.hunger > 70 ? 25 : clamp(n.hunger + 2, 0, 100);
    n.social = clamp(n.social + (others > 0 ? 2 : -1), 0, 100);
    n.stress = Math.round(clamp(n.stress + (n.stress > 30 ? -2 : 1), 0, 100));
    for (const k of Object.keys(n)) n[k] = Math.round(n[k]);
    p.mood = Math.round(clamp(75 - n.stress * 0.4 + (n.social - 50) * 0.1, 0, 100));
    return;
  }
  const asleep = p.activity?.kind === "sleep";
  const trait = (t) => p.traits?.includes(t);
  n.energy = clamp(n.energy + (asleep ? 9 : -2.2), 0, 100);
  n.hunger = clamp(n.hunger + (asleep ? 0.5 : 2.6), 0, 100);
  if (room?.kind === "food" && !asleep) n.hunger = clamp(n.hunger - 45, 0, 100);
  else if (p.slot === "evening" && n.hunger > 45) n.hunger = clamp(n.hunger - 12, 0, 100); // dîner rapide chez soi
  // Le besoin social converge vers un plafond : on ne sature pas, et les timides fatiguent dans la foule.
  if (asleep) n.social = clamp(n.social - 0.5, 0, 100);
  else if (others === 0) n.social = clamp(n.social - 2.5, 0, 100);
  else if (others > 12 && trait("shy")) n.social = clamp(n.social - 2, 0, 100);
  else n.social = clamp(n.social + (85 - n.social) * 0.15, 0, 100);
  const meeting = room?.kind === "meeting";
  const working = p.slot === "work" && p.location === p.workRoom;
  const workload = working ? 2 + (trait("zealous") || trait("ambitious") || trait("meticulous") ? 1 : 0) - (trait("lazy") || trait("calm") ? 1 : 0) : 0;
  const relief = asleep ? 2 : room?.kind === "social" || room?.kind === "rest" ? 3 : working ? 0 : 0.5;
  n.stress = Math.round(clamp(n.stress + workload + (meeting ? 3 : 0) + (n.hunger > 75 ? 2 : 0) + (n.energy < 20 ? 2 : 0) + (n.social < 25 ? 1 : 0) - relief, 0, 100));
  n.energy = Math.round(n.energy);
  n.hunger = Math.round(n.hunger);
  n.social = Math.round(n.social);
  p.mood = Math.round(clamp(78 - n.stress * 0.45 - Math.max(0, n.hunger - 60) * 0.5 - Math.max(0, 35 - n.energy) * 0.6 + (n.social - 50) * 0.15, 0, 100));
}

// ------------------------------------------------------------------ cycle de vie

export function lifeCycle(cx) {
  const { world, rng } = cx;
  const people = Object.values(world.people).filter((p) => !["gone", "missing"].includes(p.status) && p.location);
  const laws = Object.values(world.laws).filter((l) => l.status === "enacted").map((l) => l.code);
  const moves = [];
  const refusals = [];
  for (const p of people) {
    const slot = slotOf(p, cx.hour, cx.weekday);
    let target = targetFor(cx, p, slot);
    if (!target || !world.building.rooms[target]) target = p.location;
    let to = target;
    if (target !== p.location) {
      const denied = accessDenied(world, p, world.building.rooms[target], { hour: cx.hour, laws });
      if (denied) to = p.location;
      else if (floorOf(target) !== floorOf(p.location) && p.kind !== "animal") {
        // L'Ascenseur B a son caractère ; les méfiants prennent l'escalier.
        const dist = floorDistance(world, p.location, target);
        const stairs = p.habits?.includes("stairs") || dist <= 1;
        if (stairs) p.needs.energy = clamp(p.needs.energy - Math.min(12, dist * 1.5), 0, 100);
        else {
          const grudge = (world.building.elevator.grudges[p.id] || 0) > world.cycle;
          const refuse = grudge ? 0.85 : world.building.elevator.mood < 30 ? 0.2 : 0.015;
          if (rng.chance(refuse)) {
            to = roomId(floorOf(p.location), PALIER);
            refusals.push(p);
          }
        }
      }
    }
    const room = world.building.rooms[to];
    const changed = to !== p.location || slot !== p.slot || rng.chance(0.08);
    p.flags.onBreak = slot === "work" && to !== p.workRoom && to !== p.location ? true : slot === "work" && to === p.workRoom ? false : p.flags.onBreak;
    p.slot = slot;
    if (to !== p.location || changed) {
      const activity = refusals.includes(p) ? { kind: "transit", label: "attend l'Ascenseur B, qui fait semblant de ne pas le voir" } : activityFor(rng, p, room, slot);
      if (to !== p.location) moves.push({ op: "move", id: p.id, to, activity });
      else p.activity = { ...activity, since: world.cycle };
    }
  }
  if (moves.length) {
    const res = cx.commit({ source: "system", kind: "routine", observational: true, hour: cx.hour, laws, ops: moves });
    if (res.ok) cx.metric("moves", moves.length);
  }

  // Occupation réelle des pièces après les déplacements.
  const occupancy = {};
  for (const p of people) (occupancy[p.location] ||= []).push(p);
  for (const p of people) updateNeeds(p, world.building.rooms[p.location], (occupancy[p.location]?.length || 1) - 1);
  cx.occupancy = occupancy;

  elevatorTales(cx, refusals);
  encounters(cx, occupancy);
  needsDrama(cx, people);
}

function elevatorTales(cx, refusals) {
  const { world, rng } = cx;
  if (!refusals.length) return;
  cx.metric("elevator", refusals.length);
  const p = rng.chance(0.18) ? refusals.find((x) => x.star) || (rng.chance(0.3) ? refusals[0] : null) : null;
  if (!p) return;
  const line = gag(world, "elevator", p.id);
  const said = quip(world, rng, p.id, "elevator", {}, { force: true });
  cx.commit({
    source: "system",
    kind: "elevator_refusal",
    ops: [{ op: "building", elevatorMood: 1 }, { op: "person", id: p.id, reputation: -1 }],
    event: { kind: "elevator_refusal", title: `L'Ascenseur B refuse ${p.name}`, text: `Les portes se sont refermées devant ${p.name}, puis rouvertes pour quelqu'un d'autre. ${line}`, actors: [p.id], room: p.location, importance: 2, tags: ["ascenseur", "gag"], dialogue: said ? [{ who: p.id, line: said }] : [] },
  });
}

// ------------------------------------------------------------------ rencontres

const ROOM_WEIGHT = { social: 1, food: 1, meeting: 0.8, work: 0.45, transit: 0.4, special: 0.5, secret: 0.6, rest: 0.15 };

function encounters(cx, occupancy) {
  const { world, rng } = cx;
  const budget = Math.round(world.config.maxInteractionsPerCycle * (0.6 + world.config.chaos / 125));
  const rooms = rng.shuffle(Object.entries(occupancy).filter(([id, list]) => list.filter((p) => p.activity?.kind !== "sleep" && p.kind !== "animal").length >= 2));
  let done = 0;
  for (const [roomIdValue, list] of rooms) {
    if (done >= budget) break;
    const room = world.building.rooms[roomIdValue];
    if (!rng.chance(ROOM_WEIGHT[room.kind] ?? 0.5)) continue;
    const awake = list.filter((p) => p.activity?.kind !== "sleep" && p.kind !== "animal");
    const [a, b] = rng.shuffle(awake);
    if (!a || !b) continue;
    interact(cx, room, a, b, awake);
    done += 1;
  }
  cx.metric("interactions", done);
}

function feeling(cx, from, to) {
  const r = cx.relation(from, to);
  if (!r) return 0;
  if (r.ab === undefined) return r.score || 0;
  return r.a === from ? r.ab : r.ba;
}

function interact(cx, room, a, b, present) {
  const { world, rng } = cx;
  const ab = feeling(cx, a.id, b.id);
  const ba = feeling(cx, b.id, a.id);
  const has = (p, t) => p.traits?.includes(t);
  const witnesses = present.filter((p) => p.id !== a.id && p.id !== b.id).map((p) => p.id).slice(0, 4);

  // Dispute : rivalité, impulsivité, mauvaise humeur, faim.
  const exp = world.flags.experiment?.effect;
  const rule = world.building.floors[room.floor]?.rules?.temp?.id;
  const tension = exp === "politesse" ? 0 : (exp === "franchise" ? 2 : 1) * ((ab < -25 ? 0.22 : 0.012) + (has(a, "impulsive") ? 0.06 : 0) + (has(a, "grumpy") ? 0.03 : 0) + (a.needs.hunger > 80 ? 0.05 : 0) + (a.needs.stress > 75 ? 0.06 : 0) + world.config.chaos / 2500);
  if (rng.chance(tension)) return argue(cx, room, a, b, witnesses);

  // Rapprochement (adultes, jamais forcé, et pas forcément réciproque).
  if ((has(a, "romantic") || cx.relation(a.id, b.id)?.kind === "crush") && ab >= 25 && a.age >= 18 && b.age >= 18 && rng.chance(0.18)) return approach(cx, room, a, b, ba, witnesses);

  // Potins : on partage ce qu'on sait (rumeurs, secrets qui fuitent).
  if (rule !== "silence" && ((has(a, "gossip") && rng.chance(0.6)) || rng.chance(exp === "franchise" ? 0.45 : 0.18))) {
    if (gossip(cx, room, a, b, witnesses)) return;
  }

  // Bavardage : les relations bougent, sans événement.
  const warmth = has(a, "grumpy") ? rng.int(-2, 2) : rng.int(1, 4);
  cx.feel(a.id, b.id, warmth);
  cx.feel(b.id, a.id, has(b, "grumpy") ? rng.int(-2, 2) : rng.int(0, 3));
}

function argue(cx, room, a, b, witnesses) {
  const { world, rng } = cx;
  const before = cx.relation(a.id, b.id)?.kind || null;
  const delta = -rng.int(8, 16);
  a.needs.stress = clamp(a.needs.stress + 12, 0, 100);
  b.needs.stress = clamp(b.needs.stress + 10, 0, 100);
  const subject = rng.pick(["d'une agrafeuse", "de la place près de la fenêtre", "d'un mail en copie cachée", "du dernier yaourt du frigo", "de la réservation de la salle", "du volume de la musique", "d'une virgule dans un compte rendu", "du pigeon", "d'un post-it arraché", "de la température de la pièce", "d'un « répondre à tous »", "d'une tasse « empruntée »"]);
  const note = `Dispute à propos ${subject}.`;
  cx.feel(a.id, b.id, delta, null, note);
  cx.feel(b.id, a.id, delta + rng.int(-4, 4), null, note);
  cx.metric("arguments", 1);
  const after = cx.relation(a.id, b.id)?.kind || null;
  const notable = (after !== before && after === "rival") || ((a.star || b.star) && rng.chance(0.25)) || (room.kind === "meeting" && rng.chance(0.4)) || (witnesses.length >= 4 && rng.chance(0.2));
  if (!notable) return;
  const dialogue = [quip(world, rng, a.id, "argument", { a: a.id, b: b.id }, { force: true }), quip(world, rng, b.id, "argument", { a: b.id, b: a.id })].map((line, i) => line && { who: i ? b.id : a.id, line }).filter(Boolean);
  dialogue.push(...reactions(world, rng, "generic", { actors: [], witnesses }, 1));
  cx.commit({
    source: "agent",
    kind: "argument",
    ops: [{ op: "person", id: a.id, reputation: -1 }, { op: "person", id: b.id, reputation: room.kind === "meeting" ? -1 : 0 }],
    event: { kind: "argument", title: `${a.name} et ${b.name} se disputent à propos ${subject}${room.kind === "meeting" ? " en pleine réunion" : ""}`, text: `${room.name} : le ton monte entre ${a.name} et ${b.name}.${after === "rival" && before !== "rival" ? " Ils sont désormais officiellement rivaux." : ""}${witnesses.length ? ` ${witnesses.length} témoin(s) font semblant de ne rien entendre.` : ""}`, actors: [a.id, b.id, ...witnesses.slice(0, 2)], room: room.id, importance: after === "rival" && before !== "rival" ? 3 : 2, tags: ["conflit", "relations"], dialogue },
  });
}

function approach(cx, room, a, b, ba, witnesses) {
  const { world, rng } = cx;
  if (ba >= 25 && rng.chance(0.35)) {
    cx.feel(a.id, b.id, 15, "couple", "Ça s'est fait près de la machine à café.");
    cx.feel(b.id, a.id, 15, "couple");
    cx.metric("romances", 1);
    const dialogue = [quip(world, rng, a.id, "romance", { a: a.id, b: b.id }, { force: true }), quip(world, rng, b.id, "romance", { a: b.id, b: a.id })].map((line, i) => line && { who: i ? b.id : a.id, line }).filter(Boolean);
    return cx.commit({
      source: "agent",
      kind: "romance",
      ops: [{ op: "person", id: a.id, set: { mood: Math.min(100, a.mood + 15) } }, { op: "person", id: b.id, set: { mood: Math.min(100, b.mood + 15) } }],
      event: { kind: "romance", title: `${a.name} et ${b.name} : c'est officiel (enfin, presque)`, text: `${room.name}. Un regard, un plateau-repas partagé, et la buanderie de l'Hôtel a un nouveau sujet de conversation.`, actors: [a.id, b.id], room: room.id, importance: 3, tags: ["relations", "romance"], dialogue },
    });
  }
  cx.feel(b.id, a.id, -3);
  cx.feel(a.id, b.id, -5, null, "Un moment de malaise mémorable.");
  if (!rng.chance(0.3)) return null;
  const line = quip(world, rng, b.id, "awkward", { a: b.id, b: a.id }, { force: true });
  return cx.commit({
    source: "agent",
    kind: "awkward",
    ops: [{ op: "person", id: a.id, set: { mood: Math.max(0, a.mood - 10) } }],
    event: { kind: "awkward", title: `Moment de malaise entre ${a.name} et ${b.name}`, text: `${a.name} a tenté une approche. ${b.name} a soudain eu une plante à arroser. ${witnesses.length ? "Il y avait des témoins." : "Personne n'a rien vu (sauf la plante)."}`, actors: [a.id, b.id], room: room.id, importance: 2, tags: ["relations", "malaise"], dialogue: line ? [{ who: b.id, line }] : [] },
  });
}

// Transmission par proximité : a raconte à b quelque chose qu'il sait (et que b ignore).
function gossip(cx, room, a, b, witnesses) {
  const { world, rng } = cx;
  const candidates = (a.knows || []).map((id) => world.facts[id]).filter((f) => f && !f.public && !knows(world, b.id, f.id) && f.status !== "hypothesis");
  if (!candidates.length) return false;
  const fact = rng.pick(candidates);
  // Un secret ne se répète pas tel quel : il fuit (parfois), et devient une rumeur.
  if (fact.status === "secret") {
    const frank = world.flags.experiment?.effect === "franchise" ? 3 : 1;
    if (!(a.traits?.includes("gossip") ? rng.chance(0.3 * frank) : rng.chance(0.06 * frank))) return false;
    const distorted = rng.chance(0.3);
    const lower = `${fact.text.charAt(0).toLowerCase()}${fact.text.slice(1)}`;
    cx.metric("leaks", 1);
    return cx.commit({
      source: "agent",
      kind: "leak",
      observational: true,
      ops: [],
      facts: [{ kind: "rumor", text: distorted ? `On raconte que ${lower} — mais les détails changent selon qui le raconte.` : `Il paraît que ${lower}`, about: fact.about, status: "rumor", truth: distorted ? null : fact.truth, knownBy: [a.id, b.id], mystery: fact.mystery, variantOf: fact.id }],
      event: { kind: "leak", title: `Un secret fuit ${atPlace(room.name)}`, text: `${a.name} glisse quelque chose à l'oreille de ${b.name}. Le contenu reste entre eux… pour l'instant.`, actors: [a.id, b.id], room: room.id, importance: 2, public: false, tags: ["rumeur", "secret"] },
    }).ok;
  }
  const stance = b.traits?.includes("naive") || b.traits?.includes("gossip") ? "croit" : b.traits?.includes("opportunist") || b.archetype === "manipulateur" ? "exploite" : b.traits?.includes("paranoid") ? "croit" : b.traits?.includes("smart") || b.traits?.includes("meticulous") ? "doute" : rng.pick(["croit", "doute"]);
  const res = cx.commit({ source: "agent", kind: "tell", observational: true, ops: [{ op: "tell", fact: fact.id, from: a.id, to: b.id, room: room.id, stance }, { op: "feel", from: b.id, to: a.id, delta: 2 }] });
  if (res.ok) {
    cx.metric("rumors_spread", 1);
    // La personne visée apprend ce qu'on dit d'elle : la rumeur a un coût.
    if (fact.about.includes(b.id) && fact.status === "rumor") {
      cx.feel(b.id, a.id, -12, null, "M'a appris ce qu'on dit de moi.");
      b.needs.stress = clamp(b.needs.stress + 15, 0, 100);
      const line = quip(world, rng, b.id, "rumor", { a: b.id, b: a.id }, { force: true });
      cx.commit({
        source: "agent",
        kind: "rumor_hits",
        ops: [{ op: "person", id: b.id, set: { mood: Math.max(0, b.mood - 12) } }],
        event: { kind: "rumor_hits", title: `${b.name} découvre la rumeur qui court sur ${b.kind === "animal" ? "lui" : "son compte"}`, text: `${room.name} : ${a.name} lui répète ce qui se dit. ${b.name} ${stance === "exploite" ? "réfléchit déjà à comment s'en servir" : "blêmit"}.`, actors: [b.id, a.id], room: room.id, importance: 2, tags: ["rumeur"], dialogue: line ? [{ who: b.id, line }] : [] },
      });
    }
  }
  return res.ok;
}

// ------------------------------------------------------------------ besoins qui dégénèrent

function needsDrama(cx, people) {
  const { world, rng } = cx;
  for (const p of rng.shuffle(people).slice(0, 40)) {
    if (p.kind === "animal" || p.activity?.kind === "sleep") continue;
    // Faim extrême + frigo partagé à portée = vol de déjeuner (avec conséquences).
    if (p.needs.hunger > 88 && ["f8.cuisine", "f11.cuisine", "f0.cafeteria"].includes(p.location) && rng.chance(0.25)) {
      const victims = (cx.occupancy[p.location] || []).filter((x) => x.id !== p.id && x.kind !== "animal");
      const victim = rng.pick(victims.length ? victims : Object.values(world.people).filter((x) => x.homeRoom === p.homeRoom && x.id !== p.id));
      if (victim) {
        p.needs.hunger = 30;
        cx.feel(victim.id, p.id, -18, null, "Vol de déjeuner (non élucidé, mais on sait).");
        const line = quip(world, rng, victim.id, "lunch_theft", { a: victim.id, b: p.id }, { force: true });
        cx.commit({
          source: "agent",
          kind: "lunch_theft",
          ops: [{ op: "person", id: p.id, reputation: -2 }],
          event: { kind: "lunch_theft", title: `Le déjeuner de ${victim.name} a disparu`, text: `Le frigo de ${world.building.rooms[p.location].name} a encore frappé. Les soupçons se portent sur ${p.name}, qui a l'air étrangement rassasié.`, actors: [victim.id, p.id], room: p.location, importance: 2, tags: ["vol", "malaise"], dialogue: line ? [{ who: victim.id, line }] : [] },
          facts: [{ kind: "rumor", text: `${p.name} vole les déjeuners dans le frigo.`, about: [p.id], status: "rumor", truth: true, knownBy: [victim.id] }],
        });
        cx.metric("thefts", 1);
        continue;
      }
    }
    // Épuisement : stress maximal trop longtemps.
    if (p.needs.stress >= 95 && p.needs.energy < 30 && !p.flags?.burnout && rng.chance(0.15)) {
      cx.commit({
        source: "system",
        kind: "burnout",
        ops: [{ op: "person", id: p.id, set: { flags: { ...p.flags, burnout: world.cycle, goTo: { room: p.homeRoom, until: world.cycle + DAYC, reason: "repos forcé" } } } }],
        event: { kind: "burnout", title: `${p.name} craque : arrêt de 24 h`, text: `Après trop de réunions et pas assez de café, ${p.name} s'enferme dans sa chambre de l'Hôtel. La gouvernante dépose une tisane devant la porte.`, actors: [p.id], room: p.location, importance: 3, tags: ["travail", "épuisement"] },
      });
      p.needs.stress = 60;
      cx.metric("burnouts", 1);
    }
  }
}

export { AWAKE_KINDS };
