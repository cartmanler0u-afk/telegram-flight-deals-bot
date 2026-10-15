// Moteur d'événements probabilistes : hasard + causalité.
//
// Chaque modèle d'événement a une rareté (courant, rare, très rare, légendaire), une
// probabilité de base par cycle, des préconditions sur l'ÉTAT RÉEL du monde (heure, pièce,
// personnes présentes, relations, économie, lois, anomalies…) et des conséquences
// (opérations validées). La probabilité effective dépend du réglage de rareté et du niveau
// de chaos ; elle est calculée par `templateChance` (testée). Un délai de récupération
// évite les répétitions ; un plafond limite le nombre d'événements par cycle.

import { quip, reactions, gag } from "./humor.js";
import { accountOf, balance } from "./ops.js";
import { credits, clamp, atPlace } from "./core.js";
import { isGhostOpen, GHOST_FLOOR, roomsOfFloor } from "./building.js";
import { DEPTS } from "./castgen.js";

const DAYC = 48;

export const TIER_BASE = { common: 1, rare: 0.18, very_rare: 0.03, legendary: 0.006 };
const TIER_IMPORTANCE = { common: 2, rare: 3, very_rare: 4, legendary: 5 };

// Probabilité effective d'un modèle à un cycle donné (avant préconditions).
export function templateChance(config, template) {
  const rarity = config.rarity?.[template.tier] ?? 1;
  const chaos = clamp(config.chaos ?? 50, 0, 100) / 50; // 1 = neutre, 0 = calme plat, 2 = chaos total
  const chaosFactor = template.tier === "common" ? 0.6 + chaos * 0.4 : 0.3 + chaos * 0.7;
  return clamp(template.p * TIER_BASE[template.tier] * rarity * chaosFactor, 0, 1);
}

// ------------------------------------------------------------------ utilitaires

const awake = (p) => p && p.activity?.kind !== "sleep" && !["gone", "missing"].includes(p.status);
const humans = (list) => (list || []).filter((p) => p.kind !== "animal" && awake(p));

function roomsWith(cx, predicate, min = 1) {
  return Object.entries(cx.occupancy || {})
    .map(([id, list]) => [cx.world.building.rooms[id], humans(list)])
    .filter(([room, list]) => room && list.length >= min && predicate(room, list));
}

function say(cx, id, situation, slots = {}) {
  const line = quip(cx.world, cx.rng, id, situation, { a: id, ...slots }, { force: true });
  return line ? { who: id, line } : null;
}

function goTo(p, room, cycles, reason, world) {
  return { op: "person", id: p.id, set: { flags: { ...p.flags, goTo: { room, until: world.cycle + cycles, reason } } } };
}

const feelOp = (from, to, delta, kind = null, note = null) => ({ op: "feel", from, to, delta, kind, note });

// ------------------------------------------------------------------ catalogue

export const TEMPLATES = [
  // ---------------------------------------------------------------- courants
  {
    id: "meeting_meltdown", tier: "common", p: 0.35, cooldown: 6, hours: [9, 18],
    cast(cx) {
      const pick = cx.rng.pick(roomsWith(cx, (r) => r.kind === "meeting", 3));
      if (!pick) return null;
      const [room, list] = pick;
      const [a, b] = cx.rng.shuffle(list);
      return { room, a, b, witnesses: list.filter((p) => p !== a && p !== b).map((p) => p.id) };
    },
    run(cx, { room, a, b, witnesses }) {
      const line = gag(cx.world, "meetings", a.id);
      const dialogue = [say(cx, a.id, "meeting", { b: b.id }), say(cx, b.id, "argument", { b: a.id }), ...reactions(cx.world, cx.rng, "generic", { witnesses }, 1)].filter(Boolean);
      return {
        ops: [feelOp(a.id, b.id, -12, null, "La réunion qui a dégénéré."), feelOp(b.id, a.id, -10), ...witnesses.slice(0, 4).map((id) => ({ op: "person", id, set: { mood: Math.max(0, cx.world.people[id].mood - 6) } }))],
        event: { kind: "meeting_meltdown", title: `La réunion de ${room.name} dégénère`, text: `${a.name} et ${b.name} s'opposent sur un point de l'ordre du jour que personne n'avait lu. ${line}`, actors: [a.id, b.id, ...witnesses.slice(0, 2)], room: room.id, tags: ["réunion", "conflit"], dialogue },
      };
    },
  },
  {
    id: "absurd_excuse", tier: "common", p: 0.3, cooldown: 8, hours: [9, 12],
    cast(cx) {
      const late = Object.values(cx.world.people).filter((p) => awake(p) && p.kind !== "animal" && p.habits?.includes("late") && p.location === p.workRoom);
      const p = cx.rng.pick(late);
      if (!p) return null;
      const boss = humans(cx.occupancy[p.workRoom]).find((x) => x.id !== p.id);
      return { p, boss };
    },
    run(cx, { p, boss }) {
      const believed = (p.skills?.charisma || 4) + cx.rng.int(0, 5) > 8;
      return {
        ops: [{ op: "person", id: p.id, reputation: believed ? 1 : -2 }, ...(boss ? [feelOp(boss.id, p.id, believed ? 1 : -4)] : [])],
        event: { kind: "excuse", title: `${p.name} arrive en retard avec une excuse ${believed ? "qui passe" : "qui ne passe pas"}`, text: `${believed ? "Personne n'ose contester." : `${boss ? boss.name : "Son voisin de bureau"} note l'heure dans un carnet.`}`, actors: [p.id, boss?.id], room: p.location, tags: ["travail", "excuse"], dialogue: [say(cx, p.id, "excuse")].filter(Boolean) },
      };
    },
  },
  {
    id: "rumor_birth", tier: "common", p: 0.15, cooldown: 4, hours: [8, 23],
    cast(cx) {
      const pick = cx.rng.pick(roomsWith(cx, (r) => ["social", "food"].includes(r.kind), 2));
      if (!pick) return null;
      const [room, list] = pick;
      const teller = list.find((p) => p.traits?.includes("paranoid") || p.traits?.includes("gossip") || p.archetype === "complotiste") || (cx.rng.chance(0.3) ? list[0] : null);
      if (!teller) return null;
      const targets = Object.values(cx.world.people).filter((p) => p.id !== teller.id && p.kind !== "animal" && (p.star || p.influence > 55));
      const target = cx.rng.pick(targets);
      return target ? { room, teller, target, listeners: list.filter((p) => p !== teller).slice(0, 3) } : null;
    },
    run(cx, { room, teller, target, listeners }) {
      const theories = [
        `${target.name} serait payé en secret par le Club des Puissants`,
        `${target.name} dormirait à l'Étage fantôme les nuits de pleine lune`,
        `${target.name} aurait un double qui fait ses réunions à sa place`,
        `${target.name} préparerait une OPA sur la Cafétéria`,
        `${target.name} aurait inventé son propre diplôme (en natation)`,
        `${target.name} parlerait en secret avec K.E.V.I.N. tous les soirs`,
      ];
      const text = cx.rng.pick(theories);
      return {
        ops: listeners.map((l) => feelOp(l.id, teller.id, 2)),
        event: { kind: "rumor_birth", title: `Une nouvelle rumeur naît ${atPlace(room.name)}`, text: `${teller.name} lance, l'air de rien : « ${text}. » ${listeners.length} personne(s) ont entendu.`, actors: [teller.id, ...listeners.map((l) => l.id)], room: room.id, public: false, tags: ["rumeur"], dialogue: [say(cx, teller.id, "rumor", { b: listeners[0]?.id })].filter(Boolean) },
        facts: [{ kind: "rumor", text: `${text}.`, about: [target.id], status: "rumor", truth: false, knownBy: [teller.id, ...listeners.map((l) => l.id)] }],
        observational: true,
      };
    },
  },
  {
    id: "friendship", tier: "common", p: 0.12, cooldown: 4, hours: [8, 23],
    cast(cx) {
      const pick = cx.rng.pick(roomsWith(cx, (r) => ["social", "food", "work"].includes(r.kind), 2));
      if (!pick) return null;
      const [room, list] = pick;
      const [a, b] = cx.rng.shuffle(list);
      const r = cx.relation(a.id, b.id);
      if (r && ["rival", "couple", "bff", "ex"].includes(r.kind)) return null;
      return { room, a, b };
    },
    run(cx, { room, a, b }) {
      const why = cx.rng.pick(["une passion commune pour les tableurs colorés", "la même haine du lundi", "un fou rire pendant une alarme incendie", "le même avis sur le pigeon", "une partie de mots fléchés", "une théorie sur l'Étage fantôme", "un amour partagé des génériques d'anime"]);
      return {
        ops: [feelOp(a.id, b.id, 25, "ami", `Rapprochés par ${why}.`), feelOp(b.id, a.id, 22, "ami")],
        event: { kind: "friendship", title: `${a.name} et ${b.name} deviennent amis`, text: `${room.name} : ils se découvrent ${why}. Le Bâtiment compte un duo de plus.`, actors: [a.id, b.id], room: room.id, tags: ["relations", "amitié"], dialogue: [say(cx, a.id, "generic", { b: b.id })].filter(Boolean) },
      };
    },
  },
  {
    id: "silly_competition", tier: "common", p: 0.12, cooldown: DAYC, hours: [10, 16],
    cast(cx) {
      const depts = Object.keys(DEPTS).filter((d) => d !== "club");
      const [d1, d2] = cx.rng.shuffle(depts);
      const champion = (d) => cx.rng.pick(Object.values(cx.world.people).filter((p) => p.dept === d && p.status === "active" && p.kind !== "animal"));
      const a = champion(d1);
      const b = champion(d2);
      return a && b ? { d1, d2, a, b } : null;
    },
    run(cx, { d1, d2, a, b }) {
      const contest = cx.rng.pick(["le tournoi de chaise roulante du couloir", "le concours du bureau le mieux rangé", "la course d'escalier sans ascenseur", "le championnat de lancer de trombones", "le concours de la plus longue réunion sans conclusion", "le défi « zéro mail pendant une heure »"]);
      const winner = cx.rng.chance(0.5 + ((a.skills.charisma || 5) - (b.skills.charisma || 5)) / 20) ? a : b;
      const loser = winner === a ? b : a;
      return {
        ops: [{ op: "person", id: winner.id, reputation: 4, career: `Vainqueur de ${contest}` }, { op: "person", id: loser.id, reputation: -1 }, feelOp(loser.id, winner.id, -8, null, `A perdu ${contest} contre lui.`)],
        event: { kind: "competition", title: `${DEPTS[d1].label} contre ${DEPTS[d2].label} : ${contest}`, text: `${winner.name} l'emporte pour ${DEPTS[winner.dept]?.label || "son service"}. Le trophée est en carton. Il sera exposé au Tableau d'affichage.`, actors: [winner.id, loser.id], room: "f0.hall", tags: ["compétition", "gag"], dialogue: [say(cx, winner.id, "competition"), say(cx, loser.id, "competition")].filter(Boolean) },
      };
    },
  },
  {
    id: "change_mind", tier: "common", p: 0.12, cooldown: 12, hours: [9, 19],
    cast(cx) {
      const law = Object.values(cx.world.laws).find((l) => l.status === "proposed");
      const deputy = cx.rng.pick(cx.world.parliament.seats.map((id) => cx.world.people[id]).filter((p) => awake(p) && p.id !== law?.sponsor));
      return law && deputy ? { law, deputy } : null;
    },
    run(cx, { law, deputy }) {
      const pro = cx.rng.chance(0.5);
      return {
        ops: [{ op: "law", id: law.id, set: { lobby: { ...(law.lobby || {}), [deputy.id]: pro ? 1 : -1 } } }, { op: "person", id: deputy.id, reputation: -1 }],
        event: { kind: "change_mind", title: `${deputy.name} change d'avis sur la ${law.title}`, text: `Hier contre, aujourd'hui ${pro ? "pour" : "contre (encore plus)"}. ${deputy.name} explique que c'est « la même position, mais dans l'autre sens ».`, actors: [deputy.id], tags: ["politique"], dialogue: [say(cx, deputy.id, "changemind")].filter(Boolean) },
      };
    },
  },
  {
    id: "company_trouble", tier: "common", p: 0.12, cooldown: DAYC / 2, hours: [9, 18],
    cast(cx) {
      const c = cx.rng.pick(Object.values(cx.world.companies).filter((x) => x.status === "active" && x.id !== "bosscorp" && balance(cx.world, accountOf("c", x.id)) > 400));
      return c ? { c } : null;
    },
    run(cx, { c }) {
      const amount = cx.rng.int(120, 450);
      const problem = cx.rng.pick(["une machine tombe en panne", "un fournisseur livre 400 parapluies au lieu de 40", "le logo a été imprimé à l'envers sur 2 000 gobelets", "un stagiaire a cliqué sur « commander » au lieu de « annuler »", "une fuite d'eau inonde les archives", "le site interne affiche « ERREUR 418 : je suis une théière »"]);
      return {
        ops: [{ op: "transfer", from: accountOf("c", c.id), to: "treasury", amount, reason: `Réparations et frais (${problem})` }, { op: "company", id: c.id, action: "set", set: { reputation: Math.max(0, c.reputation - 3) } }],
        event: { kind: "company_trouble", title: `${c.name} : ${problem}`, text: `Coût de l'incident : ${credits(amount)}. ${cx.world.people[c.ceo]?.name || "La direction"} parle d'un « incident isolé », pour la troisième fois ce mois-ci.`, actors: [c.ceo], tags: ["économie", "entreprise"], dialogue: [say(cx, c.ceo, "money_loss", { x: credits(amount) })].filter(Boolean) },
      };
    },
  },
  {
    id: "unauthorized_party", tier: "common", p: 0.18, cooldown: DAYC, hours: [19, 23],
    cast(cx) {
      if (cx.world.flags.party?.until > cx.world.cycle) return null;
      const host = cx.rng.pick(Object.values(cx.world.people).filter((p) => awake(p) && p.kind !== "animal" && (p.traits?.includes("party") || p.archetype === "fetard")));
      return host ? { host, room: cx.rng.pick(["f8.salon", "f0.hall", "f8.cuisine", "f12.serres"]) } : null;
    },
    run(cx, { host, room }) {
      const theme = cx.rng.pick(["soirée karaoké génériques d'anime", "fête des chaussettes orphelines", "anniversaire surprise de Gustave", "soirée « on fête un truc »", "pot de départ de quelqu'un qui ne part pas"]);
      cx.world.flags.party = { room, until: cx.world.cycle + 4, host: host.id, theme };
      return {
        ops: [goTo(host, room, 4, "Organise une fête", cx.world), { op: "building", mood: 2 }],
        event: { kind: "party", title: `Fête sans autorisation : ${theme}`, text: `${host.name} organise une ${theme} ${atPlace(cx.world.building.rooms[room].name)}. Aucune autorisation n'a été demandée. Le bruit, lui, s'en charge.`, actors: [host.id], room, tags: ["fête", "vie sociale"], dialogue: [say(cx, host.id, "party")].filter(Boolean) },
        schedule: { dueCycle: cx.world.cycle + 5, kind: "party_aftermath", payload: { host: host.id, room, theme } },
      };
    },
  },
  {
    id: "contradiction", tier: "common", p: 0.12, cooldown: 12, hours: [9, 20],
    cast(cx) {
      const believers = Object.values(cx.world.people).filter((p) => awake(p) && (p.beliefs || []).some((b) => b.stance === "croit"));
      const p = cx.rng.pick(believers);
      if (!p) return null;
      const belief = p.beliefs.find((b) => b.stance === "croit");
      const fact = cx.world.facts[belief.fact];
      const target = fact && cx.world.people[fact.about[0]];
      if (!target || target.id === p.id) return null;
      return { p, target, fact };
    },
    run(cx, { p, target, fact }) {
      return {
        ops: [feelOp(p.id, target.id, -8, null, "Ses propos ne collent pas avec ce qu'on raconte."), { op: "person", id: target.id, reputation: -1 }],
        event: { kind: "contradiction", title: `${p.name} relève une contradiction chez ${target.name}`, text: `« Tu dis l'inverse de ce qu'on raconte sur toi. » ${target.name} répond que les rumeurs ne sont pas des faits. ${p.name} répond que les faits non plus, parfois.`, actors: [p.id, target.id], tags: ["rumeur", "conflit"], dialogue: [say(cx, p.id, "contradiction", { b: target.id })].filter(Boolean) },
      };
    },
  },
  {
    id: "coffee_breakdown", tier: "common", p: 0.1, cooldown: DAYC, hours: [7, 17],
    cast(cx) {
      const machine = cx.world.objects["o-cafe"];
      if (!machine || machine.state !== "ok") return null;
      const victim = cx.rng.pick(humans(cx.occupancy["f0.cafeteria"]));
      return victim ? { machine, victim } : null;
    },
    run(cx, { machine, victim }) {
      const line = gag(cx.world, "coffee", victim.id);
      const what = cx.rng.pick(["rend la monnaie en boutons de chemise", "sert un café froid… brûlant", "affiche « BIENTÔT » en boucle", "a avalé le badge de " + victim.name, "ne sert plus que de l'eau chaude « aromatisée café »"]);
      return {
        ops: [{ op: "object", id: machine.id, set: { state: "en panne" }, note: `Panne : ${what}` }, { op: "person", id: victim.id, set: { mood: Math.max(0, victim.mood - 8) } }],
        event: { kind: "coffee_breakdown", title: `Le distributeur de café ${what}`, text: `${line} ${victim.name} est la première victime de la journée.`, actors: [victim.id], room: "f0.cafeteria", tags: ["café", "gag"], dialogue: [say(cx, victim.id, "coffee")].filter(Boolean) },
        schedule: { dueCycle: cx.world.cycle + cx.rng.int(4, 14), kind: "coffee_repair", payload: {} },
      };
    },
  },
  {
    id: "kevin_says", tier: "common", p: 0.08, cooldown: DAYC / 2, hours: [9, 18],
    cast(cx) {
      const asker = cx.rng.pick(humans(cx.occupancy["f5.ia"]));
      return asker ? { asker } : null;
    },
    run(cx, { asker }) {
      const q = cx.rng.pick(["Faut-il fermer l'Étage fantôme ?", "Le PDG comprend-il son entreprise ?", "Dois-je demander une augmentation ?", "Qui a volé mon taboulé ?", "Le pigeon peut-il gouverner ?"]);
      const line = gag(cx.world, "kevin", asker.id);
      return {
        ops: [{ op: "person", id: asker.id, set: { mood: Math.max(0, asker.mood - 3) } }],
        event: { kind: "kevin", title: `${asker.name} interroge K.E.V.I.N. : « ${q} »`, text: `Réponse de l'IA : « Ça dépend. » ${line}`, actors: [asker.id], room: "f5.ia", tags: ["ia", "gag"] },
      };
    },
  },
  {
    id: "pigeon_omen", tier: "common", p: 0.1, cooldown: DAYC / 2, hours: [8, 19],
    cast(cx) {
      const pigeon = cx.world.people["s-roucoulade"];
      if (!pigeon || !awake(pigeon)) return null;
      const target = cx.rng.pick(humans(cx.occupancy[pigeon.location]));
      return target ? { pigeon, target } : null;
    },
    run(cx, { pigeon, target }) {
      const line = gag(cx.world, "pigeon", target.id);
      const candidate = target.flags?.candidate || target.flags?.deputy;
      return {
        ops: [{ op: "person", id: target.id, reputation: candidate ? 4 : 1 }, { op: "person", id: pigeon.id, reputation: 1 }],
        event: { kind: "pigeon_omen", title: `Roucoulade se pose sur l'épaule de ${target.name}`, text: `Le pigeon du Hall a choisi. ${candidate ? "Pour un candidat, c'est un présage que personne n'ose ignorer." : "Personne ne sait ce que cela signifie, mais tout le monde l'a vu."} ${line}`, actors: [target.id, pigeon.id], room: pigeon.location, tags: ["pigeon", "gag"], dialogue: [say(cx, target.id, "pigeon")].filter(Boolean) },
      };
    },
  },
  {
    id: "orphan_package", tier: "common", p: 0.12, cooldown: DAYC / 2, hours: [7, 16],
    cast(cx) {
      const clerk = cx.rng.pick(humans(cx.occupancy["fm1.quai"]));
      return clerk ? { clerk } : null;
    },
    run(cx, { clerk }) {
      const n = (cx.world.flags.packageSeq || 0) + 1;
      cx.world.flags.packageSeq = n;
      const content = cx.rng.pick(["qui fait tic-tac (c'est un réveil, a priori)", "plein de tampons « Vu et approuvé »", "adressé à « l'Étage 10 »", "qui contient un autre colis, qui contient un autre colis", "de 400 parapluies d'intérieur", "qui miaule légèrement"]);
      return {
        ops: [{ op: "object", action: "create", object: { id: `o-colis-${n}`, name: `Colis n°${n} sans destinataire`, room: "fm1.quai", state: "en attente", desc: `Un colis ${content}. Aucun destinataire. L'étiquette dit seulement « URGENT (depuis 2017) ».` } }],
        event: { kind: "orphan_package", title: `Un colis sans destinataire arrive au quai : n°${n}`, text: `${clerk.name} réceptionne un colis ${content}. Personne ne l'a commandé. Tout le monde veut savoir ce qu'il y a dedans.`, actors: [clerk.id], room: "fm1.quai", tags: ["logistique", "mystère"] },
      };
    },
  },
  {
    id: "supply_heist", tier: "common", p: 0.08, cooldown: DAYC, hours: [18, 23],
    cast(cx) {
      const thief = cx.rng.pick(Object.values(cx.world.people).filter((p) => awake(p) && p.kind !== "animal" && (p.flags?.candidate || p.archetype === "requin") && (p.skills.cunning || 0) >= 5));
      return thief ? { thief } : null;
    },
    run(cx, { thief }) {
      const crates = cx.world.objects["o-fournitures"];
      const buyer = cx.rng.pick(Object.values(cx.world.people).filter((p) => p.id !== thief.id && p.kind !== "animal" && balance(cx.world, accountOf("p", p.id)) > 200));
      if (!crates || !buyer) return null;
      const amount = cx.rng.int(60, 180);
      return {
        ops: [{ op: "transfer", from: accountOf("p", buyer.id), to: accountOf("p", thief.id), amount, reason: "Fournitures (marché noir du sous-sol)", secret: true }, { op: "object", id: crates.id, set: { state: "inventaire faux" }, note: `Une caisse manque. ${thief.flags?.candidate ? "Pour financer une campagne ?" : ""}` }, { op: "move", id: thief.id, to: "fm1.entrepot", force: true, activity: { kind: "secret", label: "porte une caisse un peu trop lourde" } }],
        event: { kind: "supply_heist", title: `Une caisse de fournitures disparaît de l'entrepôt`, text: `Personne n'a rien vu. L'inventaire, lui, ne tombe plus juste du tout. Des stylos quatre couleurs circulent à prix d'or au sous-sol.`, actors: [thief.id], room: "fm1.entrepot", public: true, tags: ["vol", "logistique"] },
        facts: [{ kind: "secret", text: `${thief.name} a volé une caisse de fournitures et l'a revendue à ${buyer.name} sur le marché noir.`, about: [thief.id, buyer.id], status: "secret", truth: true, knownBy: [thief.id, buyer.id] }],
      };
    },
  },

  // ---------------------------------------------------------------- rares
  {
    id: "unknown_department", tier: "rare", p: 0.4, cooldown: 4 * DAYC, hours: [9, 17],
    cast(cx) {
      const p = cx.rng.pick(Object.values(cx.world.people).filter((x) => x.status === "active" && x.kind === "resident" && !x.star && x.ambition?.kind !== "power"));
      return p ? { p } : null;
    },
    run(cx, { p }) {
      const dept = cx.rng.pick(["Département de la Réconciliation des Agrafes", "Direction des Initiatives Rétroactives", "Service de la Pause Stratégique", "Bureau des Choses Qu'on Verra Plus Tard", "Pôle d'Excellence en Excellence"]);
      return {
        ops: [{ op: "person", id: p.id, set: { title: `Directeur du ${dept}` }, career: `Nommé directeur du ${dept} (département dont personne ne connaissait l'existence)`, reputation: 5 }],
        event: { kind: "unknown_department", title: `${p.name} nommé directeur du « ${dept} »`, text: `Personne ne savait que ce département existait. Pas même ${p.name}. Le Registre affirme qu'il existe depuis 1998, dans un placard du 2e.`, actors: [p.id], tags: ["carrière", "bureaucratie"], dialogue: [say(cx, p.id, "promotion")].filter(Boolean) },
      };
    },
  },
  {
    id: "lab_experiment", tier: "rare", p: 0.45, cooldown: 3 * DAYC, hours: [10, 22],
    cast(cx) {
      if (cx.world.flags.experiment?.until > cx.world.cycle) return null;
      const scientist = cx.rng.pick(humans([...(cx.occupancy["f5.labo"] || []), ...(cx.occupancy["f5.prototypes"] || []), ...(cx.occupancy["fm2.labo"] || [])]));
      return scientist ? { scientist } : null;
    },
    run(cx, { scientist }) {
      const effect = cx.rng.pick([
        ["franchise", "Pendant quelques heures, tout le monde dit exactement ce qu'il pense."],
        ["politesse", "Pendant quelques heures, plus personne n'arrive à se disputer : tout finit en compliments."],
        ["lenteur", "Le temps semble ralentir : les réunions durent deux fois plus longtemps."],
        ["echo", "Chacun entend ses propres phrases répétées une seconde plus tard."],
      ]);
      cx.world.flags.experiment = { effect: effect[0], until: cx.world.cycle + 6, by: scientist.id };
      return {
        ops: [{ op: "building", pressure: 6 }, { op: "person", id: scientist.id, reputation: -2, career: `Expérience « ${effect[0]} » (effets secondaires notables)` }],
        event: { kind: "lab_experiment", title: `Une expérience du Labo perturbe le Bâtiment : effet « ${effect[0]} »`, text: `${scientist.name} a « juste testé un truc ». ${effect[1]}`, actors: [scientist.id], tags: ["laboratoire", "anomalie"], dialogue: [say(cx, scientist.id, "anomaly")].filter(Boolean) },
      };
    },
  },
  {
    id: "viral_video", tier: "rare", p: 0.5, cooldown: 3 * DAYC, hours: [9, 22],
    cast(cx) {
      const jordy = cx.world.people["s-jordy"];
      const candidates = Object.values(cx.world.people).filter((p) => awake(p) && p.kind !== "animal" && p.id !== "s-jordy" && (p.traits?.includes("clumsy") || p.activity?.kind === "transit" || p.needs?.stress > 70));
      const victim = cx.rng.pick(candidates);
      return jordy && victim && jordy.status === "active" ? { jordy, victim } : null;
    },
    run(cx, { jordy, victim }) {
      const scene = cx.rng.pick(["chantant seul dans l'Ascenseur B coincé entre deux étages", "glissant sur une feuille de présence", "expliquant à une plante pourquoi il mérite une augmentation", "tentant de négocier avec le distributeur de café", "dansant pendant une alarme incendie"]);
      return {
        ops: [{ op: "person", id: victim.id, reputation: -4, set: { flags: { ...victim.flags, viral: cx.world.cycle } } }, { op: "person", id: jordy.id, reputation: 3 }, feelOp(victim.id, jordy.id, -25, null, "M'a filmé sans prévenir.")],
        event: { kind: "viral_video", title: `${victim.name} devient célèbre malgré lui : la vidéo fait le tour du Bâtiment`, text: `Jordy Lumière a filmé ${victim.name} ${scene}. 240 vues en une heure, soit tout le Bâtiment, deux fois.`, actors: [victim.id, jordy.id], tags: ["médias", "célébrité"], dialogue: [say(cx, jordy.id, "generic"), say(cx, victim.id, "scandal")].filter(Boolean) },
        schedule: { dueCycle: cx.world.cycle + cx.rng.int(12, 40), kind: "viral_aftermath", payload: { victim: victim.id } },
      };
    },
  },
  {
    id: "department_strike", tier: "rare", p: 0.4, cooldown: 5 * DAYC, hours: [8, 11],
    cast(cx) {
      if (cx.world.flags.deptStrike?.until > cx.world.cycle) return null;
      const byDept = {};
      for (const p of Object.values(cx.world.people)) if (p.kind !== "animal" && p.status === "active" && DEPTS[p.dept]) (byDept[p.dept] ||= []).push(p);
      const angry = Object.entries(byDept).map(([d, list]) => [d, list, list.reduce((s, p) => s + p.mood, 0) / list.length]).filter(([, list, mood]) => list.length >= 4 && mood < 48).sort((a, b) => a[2] - b[2])[0];
      return angry ? { dept: angry[0], list: angry[1], mood: Math.round(angry[2]) } : null;
    },
    run(cx, { dept, list, mood }) {
      const leader = list.sort((a, b) => (b.skills.charisma || 0) - (a.skills.charisma || 0))[0];
      cx.world.flags.deptStrike = { dept, until: cx.world.cycle + DAYC, leader: leader.id };
      return {
        ops: [...list.slice(0, 30).map((p) => goTo(p, "f0.hall", DAYC / 2, "Grève du service", cx.world)), { op: "building", mood: -4 }],
        event: { kind: "dept_strike", title: `Le service ${DEPTS[dept].label} se met en grève`, text: `Moral du service : ${mood}/100. Mené par ${leader.name}, tout le service s'installe dans le Hall avec des pancartes écrites au surligneur. Revendication principale : « qu'on nous écoute ». Revendication secondaire : « un vrai café ».`, actors: [leader.id, ...list.slice(0, 3).map((p) => p.id)], room: "f0.hall", tags: ["travail", "grève"], dialogue: [say(cx, leader.id, "generic")].filter(Boolean) },
      };
    },
  },
  {
    id: "secret_dinner_leak", tier: "rare", p: 0.4, cooldown: 4 * DAYC, hours: [20, 23],
    cast(cx) {
      const diners = humans(cx.occupancy["f7.diner"]);
      const witness = cx.rng.pick(Object.values(cx.world.people).filter((p) => awake(p) && p.location?.startsWith("f7.") && !p.flags?.club));
      return diners.length >= 2 ? { diners, witness } : null;
    },
    run(cx, { diners, witness }) {
      const plan = cx.rng.pick(["racheter discrètement la Cafétéria", "faire tomber la présidence de l'Hémicycle", "renommer le Hall en leur honneur", "imposer une cotisation « ascenseur premium »"]);
      return {
        ops: diners.slice(0, 4).map((d) => ({ op: "person", id: d.id, reputation: -2 })),
        event: { kind: "secret_dinner", title: `Un dîner secret du Club fuite : ils voulaient ${plan}`, text: `${diners.map((d) => d.name).slice(0, 3).join(", ")} dînaient à huis clos. ${witness ? `${witness.name} passait « par hasard ».` : "Les murs du 7e ne sont pas si épais."} La crise politique couve.`, actors: [...diners.slice(0, 3).map((d) => d.id), witness?.id], room: "f7.diner", tags: ["politique", "scandale", "club"] },
        facts: [{ kind: "rumor", text: `Le Club des Puissants projette de ${plan}.`, about: diners.slice(0, 3).map((d) => d.id), status: "rumor", truth: true, knownBy: [witness?.id, ...diners.map((d) => d.id)].filter(Boolean) }],
      };
    },
  },
  {
    id: "official_history", tier: "rare", p: 0.3, cooldown: 6 * DAYC, hours: [9, 18],
    cast(cx) {
      const finder = cx.rng.pick(humans([...(cx.occupancy["f2.registre"] || []), ...(cx.occupancy["fm2.archives"] || [])]));
      return finder ? { finder } : null;
    },
    run(cx, { finder }) {
      const doc = cx.rng.pick(["le Bâtiment aurait été inauguré deux fois, à dix ans d'écart, par la même personne", "le premier Syndic aurait été un ascenseur", "le Plan Officiel original compte 14 étages… et deux sous-sols de plus", "la Charte des Murs aurait eu un article R7, soigneusement découpé"]);
      return {
        ops: [{ op: "person", id: finder.id, reputation: 2 }, { op: "building", pressure: 4 }],
        event: { kind: "official_history", title: `${finder.name} trouve un document qui contredit l'histoire officielle`, text: `Selon une archive jaunie, ${doc}. Le Syndic parle d'une « coquille ». Ambroise Folio parle d'une « preuve ».`, actors: [finder.id], tags: ["archives", "complot"], dialogue: [say(cx, finder.id, "anomaly")].filter(Boolean) },
        facts: [{ kind: "rumor", text: `Une archive affirme que ${doc}.`, about: [finder.id], status: "rumor", truth: null, knownBy: [finder.id] }],
      };
    },
  },
  {
    id: "absurd_floor_rule", tier: "rare", p: 0.4, cooldown: 3 * DAYC, hours: [8, 10],
    cast(cx) {
      const floors = Object.values(cx.world.building.floors).filter((f) => f.onPlan && !f.rules?.temp && !["ph", GHOST_FLOOR].includes(f.id));
      const floor = cx.rng.pick(floors);
      const author = cx.world.people["s-gontran"] || cx.world.people["r-arlette"];
      return floor && author ? { floor, author } : null;
    },
    run(cx, { floor, author }) {
      const rule = cx.rng.pick([
        ["silence", "Silence absolu : on communique par post-it."],
        ["debout", "Toutes les réunions se tiennent debout. Sur un pied, si possible."],
        ["cravate", "Port de la cravate obligatoire, y compris pour les chats."],
        ["sourire", "Sourire obligatoire de 9 h à 17 h. Un contrôleur passera."],
        ["vouvoiement", "Vouvoiement obligatoire, y compris envers soi-même."],
      ]);
      return {
        ops: [{ op: "floor", id: floor.id, set: { rules: { ...floor.rules, temp: { id: rule[0], text: rule[1], until: cx.world.cycle + 2 * DAYC } } } }, { op: "building", mood: -2 }],
        event: { kind: "floor_rule", title: `Nouvelle règle au ${floor.short} : ${rule[1]}`, text: `Note de service signée ${author.name}, affichée au Tableau d'affichage. Valable 48 heures. Les habitants du ${floor.short} découvrent leur nouvelle vie.`, actors: [author.id], room: "f0.affichage", tags: ["bureaucratie", "règle", "affiche"], dialogue: [say(cx, author.id, "law")].filter(Boolean) },
      };
    },
  },
  {
    id: "packages_vanish", tier: "rare", p: 0.35, cooldown: 5 * DAYC, hours: [6, 9],
    cast(cx) {
      const parcels = Object.values(cx.world.objects).filter((o) => o.id.startsWith("o-colis-") && o.state === "en attente" && o.room === "fm1.quai");
      const ludo = cx.world.people["s-ludovic"];
      return parcels.length && ludo?.status === "active" ? { parcels, ludo } : null;
    },
    run(cx, { parcels, ludo }) {
      return {
        ops: parcels.map((o) => ({ op: "object", id: o.id, set: { room: "fm1.secrete", state: "disparu" }, note: "Disparu du quai pendant la nuit." })),
        event: { kind: "packages_vanish", title: `${parcels.length} colis disparaissent du quai pendant la nuit`, text: `Le quai est vide. Ludovic Palette affirme que les colis sont « en cours d'acheminement ». Vers où, il ne le dit pas.`, actors: [ludo.id], room: "fm1.quai", tags: ["logistique", "mystère"], dialogue: [say(cx, ludo.id, "excuse")].filter(Boolean) },
        facts: [{ kind: "secret", text: `Les colis disparus du quai sont rangés dans la salle secrète, derrière le bureau de Ludovic Palette.`, about: [ludo.id], status: "secret", truth: true, knownBy: [ludo.id] }],
      };
    },
  },

  // ---------------------------------------------------------------- très rares
  {
    id: "ghost_floor_opens", tier: "very_rare", p: 0.6, cooldown: 7 * DAYC, hours: [22, 4],
    cast(cx) {
      if (isGhostOpen(cx.world)) return null;
      const pressure = cx.world.building.pressure;
      return pressure >= 25 || cx.world.building.floors[GHOST_FLOOR]?.anomaly >= 45 ? { pressure } : null;
    },
    run(cx) {
      const { world, rng } = cx;
      const duration = rng.int(2, 5);
      const curious = rng.shuffle(Object.values(world.people).filter((p) => awake(p) && p.kind !== "animal" && (p.ambition?.kind === "truth" || p.ambition?.theory || p.traits?.includes("nightowl")))).slice(0, rng.int(2, 5));
      const rooms = roomsOfFloor(world, GHOST_FLOOR).filter((r) => r.access === "ghost" && r.kind !== "transit");
      return {
        ops: [{ op: "floor", id: GHOST_FLOOR, set: { discovered: true }, anomaly: 10 }, { op: "building", pressure: -15 }, ...curious.map((p) => goTo(p, rng.pick(rooms).id, duration, "Curiosité (Étage fantôme)", world)), { op: "schedule", dueCycle: world.cycle + duration, kind: "ghost_close", payload: {} }],
        mutate: () => {
          world.flags.ghostOpenUntil = world.cycle + duration + 1;
        },
        event: { kind: "ghost_floor_opens", title: "L'Étage fantôme apparaît", text: `Cette nuit, l'Ascenseur B affiche un « 10 ». ${curious.length ? `${curious.map((p) => p.name).join(", ")} montent voir.` : "Personne n'ose monter."} Le couloir tourne à gauche. Le café du Bureau 10-0 est chaud.`, actors: curious.map((p) => p.id), room: `${GHOST_FLOOR}.palier`, rare: true, tags: ["anomalie", "étage fantôme"] },
      };
    },
  },
  {
    id: "floor_closed", tier: "very_rare", p: 0.4, cooldown: 7 * DAYC, hours: [6, 20],
    cast(cx) {
      const floor = cx.rng.pick(Object.values(cx.world.building.floors).filter((f) => f.status === "open" && !["f0", "ph", "f11", "f8"].includes(f.id)));
      return floor ? { floor } : null;
    },
    run(cx, { floor }) {
      const reason = cx.rng.pick(["une odeur de café brûlé impossible à localiser", "un audit surprise", "une porte qui refuse de reconnaître les badges", "un brouillard léger, mais administratif"]);
      return {
        ops: [{ op: "floor", id: floor.id, set: { status: "closed", note: `Fermé : ${reason}` } }, { op: "schedule", dueCycle: cx.world.cycle + cx.rng.int(6, 20), kind: "floor_reopen", payload: { floor: floor.id } }],
        event: { kind: "floor_closed", title: `${floor.name} devient inaccessible`, text: `Cause officielle : ${reason}. Ceux qui sont à l'intérieur y restent. Ceux qui sont dehors découvrent qu'ils avaient besoin d'y aller.`, actors: [], room: `${floor.id}.palier`, rare: true, tags: ["bâtiment", "anomalie"] },
        observational: false,
      };
    },
  },
  {
    id: "mastermind_reveal", tier: "very_rare", p: 0.5, cooldown: 14 * DAYC, hours: [10, 18],
    cast(cx) {
      const bernard = cx.world.people["s-bernard"];
      const hidden = (cx.world.flags.mastermindCount || 0);
      return bernard?.status === "active" && hidden >= 3 ? { bernard, hidden } : null;
    },
    run(cx, { bernard, hidden }) {
      return {
        ops: [{ op: "person", id: bernard.id, reputation: 15, career: "Reconnu comme l'homme derrière les rideaux" }],
        mutate: () => {
          cx.world.flags.mastermindCount = 0;
        },
        event: { kind: "mastermind", title: `Bernard Quelconque, l'homme que personne ne voyait, était derrière ${hidden} affaires`, text: `Une photocopie de trop : on découvre que Bernard, de la reprographie, est à l'origine de ${hidden} événements récents. Tout le monde se souvient soudain de son prénom.`, actors: [bernard.id], rare: true, tags: ["intrigue", "révélation"] },
      };
    },
  },
];

// ------------------------------------------------------------------ moteur

export function eventsCycle(cx) {
  const { world, rng } = cx;
  world.eventCooldowns ||= {};
  // Les règles temporaires d'étage et les expériences expirent d'elles-mêmes.
  for (const f of Object.values(world.building.floors)) if (f.rules?.temp && f.rules.temp.until <= world.cycle) f.rules = { ...f.rules, temp: null };
  if (world.flags.experiment && world.flags.experiment.until <= world.cycle) world.flags.experiment = null;
  const max = Math.max(0, world.config.maxEventsPerCycle ?? 4);
  let fired = 0;
  for (const t of rng.shuffle(TEMPLATES)) {
    if (fired >= max) break;
    if ((world.eventCooldowns[t.id] || 0) > world.cycle) continue;
    if (t.hours && !inHours(cx.hour, t.hours)) continue;
    if (!rng.chance(templateChance(world.config, t))) continue;
    const res = fire(cx, t);
    if (res?.ok) fired += 1;
  }
  return fired;
}

const inHours = (hour, [a, b]) => (a <= b ? hour >= a && hour <= b : hour >= a || hour <= b);

// Déclenche un modèle (aussi utilisé par le mode test du chaos, avec `force`).
export function fire(cx, t, { source = "natural" } = {}) {
  const { world } = cx;
  const ctx = t.cast(cx);
  if (!ctx) return null;
  const plan = t.run(cx, ctx);
  if (!plan) return null;
  const ops = [...(plan.ops || [])];
  if (plan.schedule) ops.push({ op: "schedule", ...plan.schedule });
  const res = cx.commit({
    source: source === "debug" ? "debug" : "director",
    kind: t.id,
    observational: plan.observational,
    ops,
    facts: plan.facts,
    event: { importance: TIER_IMPORTANCE[t.tier], rare: t.tier !== "common", tier: t.tier, source, ...plan.event, tags: [...(plan.event.tags || []), t.tier === "common" ? "quotidien" : "rare"] },
  });
  if (res.ok) {
    plan.mutate?.();
    world.eventCooldowns[t.id] = world.cycle + (t.cooldown || 1);
    cx.metric(`tier_${t.tier}`, 1);
    if (world.people["s-bernard"] && t.tier !== "common" && cx.rng.chance(0.25)) world.flags.mastermindCount = (world.flags.mastermindCount || 0) + 1;
  }
  return res;
}

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}
