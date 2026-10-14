// Personnages autonomes : à chaque cycle, quelques occupants (choisis selon leur influence,
// leur ambition et le temps depuis lequel on ne les a pas vus) prennent UNE décision qui
// découle de leurs motivations, de ce qu'ils savent et des règles en vigueur.
// Tout est déterministe (graine du cycle) : aucun appel IA n'est nécessaire ici.

import { STARTUP_PRODUCTS } from "./cast.js";
import { credits, worldId, clamp } from "./core.js";
import { accountOf, balance } from "./ops.js";
import { knows } from "./memory.js";
import { hasLaw, canVote, stanceOf } from "./politics.js";
import { sharePrice } from "./economy.js";

const ACTIVE = new Set(["active", "fired", "admin_dead", "double"]);

export function canAct(cx, p) {
  if (!p || !ACTIVE.has(p.status)) return false;
  if (p.kind === "animal" && !hasLaw(cx.world, "animal_personhood")) return p.id.startsWith("cat-") && cx.rng.chance(0.3);
  if (hasLaw(cx.world, "curfew") && (cx.hour >= 22 || cx.hour < 6) && p.skills.cunning < 7) return false;
  return true;
}

export function agentsCycle(cx) {
  const { world, rng } = cx;
  const pool = Object.values(world.people).filter((p) => canAct(cx, p) && (p.cooldownUntil || 0) <= world.cycle);
  const night = cx.hour >= 23 || cx.hour < 7;
  const count = night ? (rng.chance(0.15) ? 1 : 0) : rng.chance(0.25) ? 2 : rng.chance(0.6) ? 1 : 0;
  const chosen = [];
  for (let i = 0; i < count && pool.length; i++) {
    const p = rng.weighted(pool.filter((x) => !chosen.includes(x)).map((x) => [x, 8 + x.influence * 0.4 + (world.cycle - (x.lastSeenCycle || 0) > 96 ? 25 : 0) + (x.ambition?.kind === "power" ? 4 : 0)]));
    if (!p) break;
    chosen.push(p);
  }
  for (const p of chosen) {
    const res = decide(cx, p);
    p.cooldownUntil = world.cycle + (res?.ok ? rng.int(6, 16) : rng.int(2, 5));
  }
}

function decide(cx, p) {
  const { rng } = cx;
  const kind = p.kind === "animal" ? "animal" : p.ambition?.kind || "stability";
  const options = ACTIONS[kind] || ACTIONS.stability;
  for (const action of rng.shuffle(options)) {
    const res = action(cx, p);
    if (res) return res;
  }
  return null;
}

const acct = (p) => accountOf("p", p.id);
const money = (cx, p) => (cx.world.accounts[acct(p)]?.frozen ? 0 : balance(cx.world, acct(p)));

// ------------------------------------------------------------------ actions

function declareCandidacy(cx, p) {
  const { world } = cx;
  const until = world.parliament.nextElectionCycle - world.cycle;
  if (until > 144 || until < 0 || p.flags.deputy || p.flags.candidate || !canVote(world, p)) return null;
  const spend = Math.min(150, Math.floor(money(cx, p) / 3));
  const ops = [{ op: "person", id: p.id, set: { flags: { ...p.flags, candidate: true, campaign: (p.flags.campaign || 0) + spend } } }];
  if (spend >= 20) ops.push({ op: "transfer", from: acct(p), to: accountOf("c", "gazette"), amount: spend, reason: "Campagne électorale (affiches)" });
  return cx.commit({
    source: "agent",
    kind: "candidacy",
    ops,
    event: { kind: "candidacy", title: `${p.name} se présente aux élections`, text: `${p.name} (${p.title}) se lance dans la course à l'Hémicycle${spend >= 20 ? ` et dépense ${credits(spend)} en affiches dans l'ascenseur` : ""}. Slogan : « ${cx.rng.pick(["Plus haut, ensemble.", "Un étage, une voix.", "Le Bâtiment mérite mieux.", "Moins de formulaires, plus de café.", "Je connais les couloirs."])} »`, actors: [p.id], importance: 2, tags: ["politique", "élection"] },
  });
}

function joinOrFoundParty(cx, p) {
  const { world, rng } = cx;
  if (Object.values(world.orgs).some((o) => o.status === "active" && o.kind === "party" && o.members.includes(p.id))) return null;
  const st = stanceOf(world, p);
  const parties = Object.values(world.orgs).filter((o) => o.status === "active" && ["party", "union"].includes(o.kind));
  const fit = parties.map((o) => [o, 1 + Math.max(0, (o.stance?.order || 0) * st.order + (o.stance?.upper || 0) * st.upper + (o.members.some((m) => ["ami", "bff", "couple"].includes(cx.relation(p.id, m)?.kind)) ? 2 : 0))]);
  const org = rng.weighted(fit);
  if (org && rng.chance(0.75)) {
    return cx.commit({
      source: "agent",
      kind: "join_org",
      ops: [{ op: "org", id: org.id, action: "join", person: p.id }],
      event: { kind: "join_org", title: `${p.name} rejoint ${org.name}`, text: `${p.name} prend sa carte. ${world.people[org.leader]?.name || "La direction"} l'accueille avec un badge un peu trop grand.`, actors: [p.id, org.leader], importance: 2, tags: ["organisation"] },
    });
  }
  if (p.skills.charisma < 6 || money(cx, p) < 120) return null;
  const friends = cx.friendsOf(p.id).filter((id) => world.people[id] && ACTIVE.has(world.people[id].status)).slice(0, 2);
  const name = rng.pick(["Mouvement du Palier", "Parti de l'Escalier de Secours", "Rassemblement pour la Lumière Naturelle", "Front de Libération des Chaises", "Alliance des Étages Pairs", "Parti du Silence Collectif"]);
  if (Object.values(world.orgs).some((o) => o.name === name)) return null;
  const id = worldId(world, "or");
  return cx.commit({
    source: "agent",
    kind: "found_org",
    ops: [
      { op: "org", action: "create", org: { id, name, kind: "party", leader: p.id, members: [p.id, ...friends], goal: rng.pick(["Rendre l'Hémicycle accessible sans ascenseur.", "Abolir les formulaires inutiles (tous).", "Donner une voix aux étages oubliés."]), stance: { order: st.order >= 0 ? -1 : 1, upper: st.upper >= 0 ? -1 : 1 } } },
      { op: "transfer", from: acct(p), to: "treasury", amount: 100, reason: "Frais de dépôt de statuts" },
    ],
    event: { kind: "found_org", title: `Nouveau parti : ${name}`, text: `${p.name} fonde « ${name} »${friends.length ? ` avec ${friends.map((id) => world.people[id].name).join(" et ")}` : ""}. Statuts déposés au Registre (100 cr).`, actors: [p.id, ...friends], importance: 3, tags: ["organisation", "politique"] },
  });
}

function lobby(cx, p) {
  const { world, rng } = cx;
  const law = Object.values(world.laws).find((l) => l.status === "proposed");
  if (!law || money(cx, p) < 300 || p.skills.cunning < 6) return null;
  const deputy = rng.pick(world.parliament.seats.filter((id) => id !== p.id && id !== law.sponsor && !law.lobby?.[id]));
  if (!deputy) return null;
  return cx.commit({
    source: "agent",
    kind: "lobby",
    ops: [{ op: "transfer", from: acct(p), to: accountOf("p", deputy), amount: 120, reason: "Conseil stratégique", secret: true }, { op: "law", id: law.id, set: { lobby: { ...(law.lobby || {}), [deputy]: p.id } } }],
    facts: [{ kind: "secret", text: `${p.name} a versé 120 cr au député ${world.people[deputy].name} pour soutenir « ${law.title} ».`, about: [p.id, deputy], status: "secret", truth: true, knownBy: [p.id, deputy] }],
  });
}

function challengeLeader(cx, p) {
  const { world, rng } = cx;
  const org = Object.values(world.orgs).find((o) => o.status === "active" && o.members.includes(p.id) && o.leader !== p.id && o.members.length >= 3);
  if (!org) return null;
  const leader = world.people[org.leader];
  if (!leader || p.influence < leader.influence - 5 || !rng.chance(0.5)) return null;
  // Vote de défiance : chaque membre soutient celui dont il est le plus proche.
  let support = 0;
  for (const m of org.members) {
    if (m === p.id) support += 1;
    else if (m === leader.id) support -= 1;
    else {
      const a = relScore(cx, m, p.id) + world.people[m]?.reputation / 100;
      const b = relScore(cx, m, leader.id) + leader.reputation / 100;
      support += a > b ? 1 : -1;
    }
  }
  const coup = support > 0;
  const ops = coup
    ? [{ op: "org", id: org.id, action: "leader", person: p.id }, { op: "person", id: p.id, reputation: 4, career: `Prend la tête de ${org.name}` }, { op: "person", id: leader.id, reputation: -4, career: `Renversé à la tête de ${org.name}` }, { op: "relation", a: p.id, b: leader.id, kind: "rival", score: -50, note: `Putsch au sein de ${org.name}.` }]
    : [{ op: "org", id: org.id, action: "leave", person: p.id }, { op: "person", id: p.id, reputation: -3 }, { op: "relation", a: p.id, b: leader.id, kind: "rival", score: -40, note: `Tentative de putsch ratée au sein de ${org.name}.` }];
  return cx.commit({
    source: "agent",
    kind: "coup",
    ops,
    event: {
      kind: coup ? "coup" : "coup_failed",
      title: coup ? `Putsch : ${p.name} renverse ${leader.name} à la tête de ${org.name}` : `Putsch raté : ${p.name} est exclu de ${org.name}`,
      text: coup ? `Vote de défiance express (${org.members.length} membres). ${leader.name} découvre la nouvelle en lisant le panneau d'affichage.` : `${p.name} a tenté de renverser ${leader.name} et a perdu le vote. Exclusion immédiate, badge confisqué.`,
      actors: [p.id, leader.id],
      importance: 4,
      tags: ["organisation", "pouvoir"],
    },
  });
}

function relScore(cx, a, b) {
  const rel = cx.relation(a, b);
  return rel ? { ami: 2, bff: 3, couple: 4, crush: 1, rival: -3, ex: -1 }[rel.kind] || 0 : 0;
}

function radio(cx, p) {
  const { world, rng } = cx;
  const host = world.people["r-nadia"];
  if (!host || host.status !== "active" || p.id === host.id) return null;
  if (world.events.some((e) => e.kind === "radio" && world.cycle - e.cycle < 8)) return null;
  const flop = p.traits.includes("clumsy") || p.traits.includes("shy") ? rng.chance(0.6) : rng.chance(0.2);
  const delta = flop ? -3 : rng.int(2, 5);
  return cx.commit({
    source: "agent",
    kind: "radio",
    ops: [{ op: "person", id: p.id, reputation: delta }],
    event: { kind: "radio", title: flop ? `${p.name} rate son passage sur Radio Cage d'Escalier` : `${p.name} brille sur Radio Cage d'Escalier`, text: flop ? `Interrogé sur « ${rng.pick(["le sens de l'Étage 13", "le prix du fromage", "sa relation avec l'Ascenseur B", "la Charte des Murs"])} », ${p.name} a répondu par un long silence, puis par « synergie ».` : `${p.name} défend ses idées avec aplomb. Les auditeurs du 8e appellent pour en redemander.`, actors: [p.id, host.id], importance: 2, tags: ["médias"] },
  });
}

function stunt(cx, p) {
  const { rng, world } = cx;
  if (world.cycle - (p.flags.lastStunt ?? -999) < 96) return null;
  p.flags.lastStunt = world.cycle;
  const s = rng.pick([
    ["organise une conférence de presse dans l'Ascenseur B, entre deux étages", 3, 3],
    ["tente de battre le record de montée d'escaliers en tenant un plateau-repas", 2, 1],
    ["fait imprimer son portrait sur les gobelets du Réfectoire sans autorisation", -1, 2],
    ["lance une pétition pour renommer le Hall en son honneur", -2, 2],
  ]);
  return cx.commit({
    source: "agent",
    kind: "stunt",
    ops: [{ op: "person", id: p.id, reputation: s[1] }],
    event: { kind: "stunt", title: `${p.name} ${s[0]}`, text: `Coup d'éclat pour se faire connaître. ${s[1] > 0 ? "Ça marche, étrangement." : "Les réactions sont… partagées."}`, actors: [p.id], importance: s[2], tags: ["célébrité"] },
  });
}

function invest(cx, p) {
  const { world, rng } = cx;
  const cash = money(cx, p);
  if (cash < 300 || world.cycle - (p.flags.lastInvest ?? -999) < 96) return null;
  p.flags.lastInvest = world.cycle;
  const companies = Object.values(world.companies).filter((c) => c.status === "active" && c.id !== "bosscorp" && c.ceo !== p.id);
  const target = rng.weighted(companies.map((c) => [c, c.reputation + balance(world, accountOf("c", c.id)) / 100]));
  if (!target) return null;
  const price = sharePrice(world, target);
  const n = clamp(Math.floor((cash * 0.4) / price), 0, 15);
  if (n < 1) return null;
  const sellers = Object.entries(target.shares).filter(([holder, held]) => holder !== p.id && holder !== "boss" && held > n && (holder === "syndic" || world.accounts[accountOf("p", holder)]));
  const [seller] = rng.pick(sellers) || [];
  if (!seller) return null;
  const to = seller === "syndic" ? "treasury" : accountOf("p", seller);
  return cx.commit({
    source: "agent",
    kind: "invest",
    ops: [{ op: "transfer", from: acct(p), to, amount: n * price, reason: `Achat de ${n} parts de ${target.name}` }, { op: "company", id: target.id, action: "shares", from: seller, to: p.id, n }],
    event: { kind: "invest", title: `${p.name} achète ${n} parts de ${target.name}`, text: `${n} parts à ${credits(price)} pièce, rachetées à ${seller === "syndic" ? "le Syndic" : world.people[seller]?.name}. ${p.name} devient actionnaire.`, actors: [p.id, seller === "syndic" ? null : seller, target.ceo], importance: n >= 10 ? 3 : n >= 5 ? 2 : 1, tags: ["économie", "bourse"] },
  });
}

function startup(cx, p) {
  const { world, rng } = cx;
  if (Object.values(world.companies).some((c) => c.ceo === p.id && c.status === "active")) return null;
  let cash = money(cx, p);
  const ops = [];
  let loanEvent = "";
  if (cash < 600) {
    // Emprunt à la Banque du Sous-Sol, qui adore les projets absurdes.
    const bank = accountOf("c", "banque");
    if (world.companies.banque?.status !== "active" || balance(world, bank) < 3000 || p.reputation < 45 || cash < 150) return null;
    const loanId = worldId(world, "ln");
    ops.push({ op: "loan", action: "create", loan: { id: loanId, lender: bank, borrower: acct(p), principal: 500, rate: 2, dueCycle: world.cycle + 7 * 48 } });
    ops.push({ op: "transfer", from: bank, to: acct(p), amount: 500, reason: "Prêt de création d'entreprise" });
    cash += 500;
    loanEvent = " grâce à un prêt de 500 cr de la Banque du Sous-Sol (2 % par jour)";
  }
  const product = rng.pick(STARTUP_PRODUCTS.filter((x) => !Object.values(world.companies).some((c) => c.product === x)));
  if (!product) return null;
  const id = worldId(world, "co");
  const name = rng.pick([`${p.name.split(" ")[0]} & Associés`, `Start-up ${product.split(" ")[0]}`, `${p.name.split(" ")[0]} Industries`, `Neo-${product.split(" ")[0]}`]);
  ops.push({ op: "company", action: "create", company: { id, name, floor: "f3", ceo: p.id, product, price: rng.int(12, 35), dailyCost: 40, kind: "startup", demand: 0.6 + rng.next(), shares: { [p.id]: 100 }, totalShares: 100 } });
  ops.push({ op: "transfer", from: acct(p), to: accountOf("c", id), amount: 400, reason: "Capital de départ" });
  const res = cx.commit({
    source: "agent",
    kind: "startup",
    ops,
    event: { kind: "startup", title: `${p.name} fonde « ${name} » : ${product}`, text: `Nouvelle entreprise au Marché Intérieur${loanEvent}. ${p.name} promet de « disrupter l'étage 3 ».`, actors: [p.id], importance: 3, tags: ["économie", "entreprise"] },
  });
  if (res.ok && loanEvent) {
    const loan = Object.values(world.loans).find((l) => l.borrower === acct(p) && l.status === "active" && !l.eventId);
    if (loan) loan.eventId = res.event.id;
  }
  return res;
}

function lendToStruggler(cx, p) {
  const { world } = cx;
  if (money(cx, p) < 900 || p.skills.cunning < 6) return null;
  const struggler = Object.values(world.companies).find((c) => c.status === "active" && c.ceo !== p.id && c.kind !== "bank" && balance(world, accountOf("c", c.id)) < c.dailyCost * 3 && !Object.values(world.loans).some((l) => l.borrower === accountOf("c", c.id) && l.status === "active"));
  if (!struggler) return null;
  const amount = 600;
  const loanId = worldId(world, "ln");
  const res = cx.commit({
    source: "agent",
    kind: "loan",
    ops: [{ op: "loan", action: "create", loan: { id: loanId, lender: acct(p), borrower: accountOf("c", struggler.id), principal: amount, rate: 3, dueCycle: world.cycle + 5 * 48 } }, { op: "transfer", from: acct(p), to: accountOf("c", struggler.id), amount, reason: "Prêt d'urgence" }],
    event: { kind: "loan", title: `${p.name} prête ${credits(amount)} à ${struggler.name}, au bord du gouffre`, text: `Taux : 3 % par jour, remboursable sous 5 jours. ${world.people[struggler.ceo]?.name || "La direction"} signe sans lire la page 2.`, actors: [p.id, struggler.ceo], importance: 3, tags: ["économie", "dette"] },
    facts: [{ text: `${struggler.name} doit ${credits(amount)} à ${p.name} (3 %/jour).`, about: [p.id, struggler.ceo], public: true }],
  });
  if (res.ok) world.loans[loanId].eventId = res.event.id;
  return res;
}

function investigate(cx, p) {
  const { world, rng } = cx;
  const open = Object.values(world.mysteries).filter((m) => m.status === "open" && !m.investigators.includes(p.id));
  const m = rng.pick(open.filter((x) => x.investigators.length < 3));
  if (!m) return null;
  return cx.commit({
    source: "agent",
    kind: "investigate",
    ops: [{ op: "mystery", id: m.id, action: "investigator", person: p.id }],
    event: { kind: "investigation", title: `${p.name} ouvre une enquête : ${m.title}`, text: `${m.question} ${p.name} est bien décidé à trouver la réponse${p.ambition?.theory ? ` (sa théorie : ${p.ambition.theory.charAt(0).toLowerCase()}${p.ambition.theory.slice(1)})` : ""}.`, actors: [p.id], importance: 2, tags: ["mystère"] },
  });
}

function leak(cx, p) {
  const { world } = cx;
  const journalist = world.people["r-felix"];
  if (!journalist || journalist.id === p.id || journalist.status !== "active") return null;
  const secret = p.knows.map((id) => world.facts[id]).find((f) => f && f.status === "secret" && !knows(world, journalist.id, f.id) && !f.about.includes(p.id));
  if (!secret) return null;
  return cx.commit({
    source: "agent",
    kind: "leak",
    ops: [{ op: "learn", fact: secret.id, people: [journalist.id] }, { op: "relation", a: p.id, b: journalist.id, kind: "ami", score: 30, note: "Source confidentielle." }],
    event: { kind: "leak", title: `${p.name} glisse une enveloppe à Félix Morin`, text: "Rendez-vous discret près des boîtes aux lettres du Hall. Le contenu de l'enveloppe n'est pas (encore) public.", actors: [p.id, journalist.id], importance: 3, public: false, tags: ["médias", "secret"] },
  });
}

function mediate(cx, p) {
  const { world } = cx;
  const rivals = cx.relations().filter((r) => r.kind === "rival" && r.a !== p.id && r.b !== p.id && world.people[r.a] && world.people[r.b] && relScore(cx, p.id, r.a) > 0 && relScore(cx, p.id, r.b) > 0);
  const r = cx.rng.pick(rivals);
  if (!r) return null;
  const ok = cx.rng.chance(0.3 + p.skills.negotiation / 20);
  const a = world.people[r.a];
  const b = world.people[r.b];
  return cx.commit({
    source: "agent",
    kind: "mediation",
    ops: ok ? [{ op: "relation", a: a.id, b: b.id, kind: "ami", score: 20, note: `Réconciliés par ${p.name}.` }, { op: "person", id: p.id, reputation: 3 }] : [{ op: "person", id: p.id, reputation: -1 }],
    event: { kind: ok ? "reconciliation" : "mediation_failed", title: ok ? `${p.name} réconcilie ${a.name} et ${b.name}` : `${p.name} échoue à réconcilier ${a.name} et ${b.name}`, text: ok ? "Un café, deux excuses, une poignée de main un peu longue." : "La médiation a duré quatre minutes. Il a fallu évacuer la salle.", actors: [p.id, a.id, b.id], importance: ok ? 3 : 2, tags: ["relations"] },
  });
}

function helpFriend(cx, p) {
  const { world } = cx;
  if (money(cx, p) < 150) return null;
  const friend = cx.friendsOf(p.id).map((id) => world.people[id]).find((f) => f && ACTIVE.has(f.status) && balance(world, acct(f)) < 40 && !world.accounts[acct(f)].frozen);
  if (!friend) return null;
  const amount = 60;
  return cx.commit({
    source: "agent",
    kind: "help",
    ops: [{ op: "transfer", from: acct(p), to: acct(friend), amount, reason: "Coup de main entre amis" }],
    event: { kind: "help", title: `${p.name} dépanne ${friend.name}`, text: `${credits(amount)} prêtés « à rendre quand tu pourras ». ${friend.name} promet de rembourser d'ici trois jours.`, actors: [p.id, friend.id], importance: 2, tags: ["relations", "dette"] },
    facts: [{ kind: "promise", text: `${friend.name} a promis de rendre ${credits(amount)} à ${p.name}.`, about: [p.id, friend.id], knownBy: [p.id, friend.id], data: { from: friend.id, to: p.id, amount, dueCycle: world.cycle + 3 * 48 } }],
  });
}

function unionize(cx, p) {
  const { world } = cx;
  const union = world.orgs["o-union"];
  if (!union || union.status !== "active") return null;
  const unpaid = cx.recent((e) => e.kind === "unpaid_wages", 96);
  const recruit = unpaid.flatMap((e) => e.actors).map((id) => world.people[id]).find((x) => x && x.kind !== "animal" && !union.members.includes(x.id) && x.id !== union.leader);
  if (!recruit) return null;
  return cx.commit({
    source: "agent",
    kind: "unionize",
    ops: [{ op: "org", id: union.id, action: "join", person: recruit.id }],
    event: { kind: "join_org", title: `${recruit.name} adhère à l'Union des Étages Inférieurs`, text: `Après ses salaires impayés, ${recruit.name} signe la carte que lui tend ${p.name}.`, actors: [recruit.id, p.id], causes: [unpaid.at(-1)?.id], importance: 2, tags: ["organisation", "travail"] },
  });
}

function claimRole(cx, p) {
  const { world, rng } = cx;
  if (p.flags.claimed && world.cycle - p.flags.claimed < 7 * 48) return null;
  // Un personnage qui refuse son rôle cherche une autre place dans le Bâtiment.
  const strike = world.flags.strike;
  if (strike && p.skills.negotiation >= 6) {
    const union = world.orgs["o-union"];
    const res = cx.commit({
      source: "agent",
      kind: "negotiate",
      ops: [{ op: "person", id: p.id, reputation: 8, set: { title: "Négociatrice en chef du Bâtiment", flags: { ...p.flags, buildingTitle: true, claimed: world.cycle } }, career: "Négocie la fin de la grève" }],
      event: { kind: "strike_end", title: `${p.name} met fin à la grève`, text: `Personne ne lui avait rien demandé. Après six heures de discussions dans le Hall avec ${world.people[union?.leader]?.name || "les grévistes"}, ${p.name} obtient un accord. Le Bâtiment découvre sa meilleure négociatrice.`, actors: [p.id, union?.leader], importance: 4, tags: ["travail", "carrière"] },
    });
    if (res.ok) world.flags.strike = null;
    return res;
  }
  if (p.agentId && rng.chance(0.4)) {
    // Demande de promotion adressée au patron (toi) : une décision t'attend.
    return cx.commit({
      source: "agent",
      kind: "promotion_request",
      ops: [{ op: "person", id: p.id, set: { flags: { ...p.flags, claimed: world.cycle } } }],
      event: { kind: "promotion_request", title: `${p.name} réclame une promotion`, text: `${p.name} estime mériter mieux que « ${p.title} » et dépose une lettre très argumentée (11 pages, police 8) sur ton bureau.`, actors: [p.id], importance: 3, tags: ["carrière", "décision"] },
      decision: { kind: "promotion", title: `Promouvoir ${p.name} ?`, person: p.id },
    });
  }
  return declareCandidacy(cx, p) || joinOrFoundParty(cx, p);
}

function animalAction(cx, p) {
  const { world, rng } = cx;
  if (!p.flags.campaigning && (p.ambition?.kind === "power")) {
    return cx.commit({
      source: "agent",
      kind: "animal_campaign",
      ops: [{ op: "person", id: p.id, set: { flags: { ...p.flags, campaigning: true } } }],
      event: { kind: "animal_campaign", title: `${p.name} entre (involontairement) en politique`, text: `${p.name} ${p.species === "homard" ? "a fixé l'urne électorale pendant 40 minutes" : "s'est couché sur une pile de bulletins de vote"}. Des occupants y voient un signe. Une pétition circule pour la personnalité juridique des animaux.`, actors: [p.id], importance: 3, tags: ["animaux", "politique"] },
    });
  }
  if (hasLaw(world, "animal_personhood")) {
    const cats = Object.values(world.people).filter((x) => x.kind === "animal" && x.status === "active");
    if (!Object.values(world.orgs).some((o) => o.kind === "union" && o.members.includes(p.id)) && cats.length >= 2 && rng.chance(0.5)) {
      const id = "o-siestes";
      if (world.orgs[id]) return cx.commit({ source: "agent", kind: "join_org", ops: [{ op: "org", id, action: "join", person: p.id }], event: { kind: "join_org", title: `${p.name} rejoint le Syndicat des Siestes`, text: "Adhésion validée par un long bâillement.", actors: [p.id], importance: 2, tags: ["animaux"] } });
      return cx.commit({
        source: "agent",
        kind: "found_org",
        ops: [{ op: "org", action: "create", org: { id, name: "Syndicat des Siestes", kind: "union", leader: p.id, members: [p.id], goal: "Abolir la Taxe sur la Sieste et obtenir des radiateurs pour tous.", stance: { order: -1, upper: -1 } } }],
        event: { kind: "found_org", title: `${p.name} fonde le Syndicat des Siestes`, text: "Premier syndicat animal du Bâtiment. Revendication principale : le radiateur du 7e.", actors: [p.id], importance: 4, tags: ["animaux", "organisation"] },
      });
    }
    return declareCandidacy(cx, p);
  }
  return null;
}

const ACTIONS = {
  power: [declareCandidacy, joinOrFoundParty, lobby, challengeLeader],
  fame: [radio, stunt, declareCandidacy, joinOrFoundParty],
  wealth: [invest, startup, lendToStruggler, lobby],
  truth: [investigate, leak, radio],
  stability: [mediate, helpFriend, unionize],
  protect: [helpFriend, unionize, mediate],
  change_role: [claimRole, radio, investigate],
  animal: [animalAction],
};

// ------------------------------------------------------------------ influence & carrières

export function influenceCycle(cx) {
  const { world } = cx;
  if (!(cx.hour >= 19 && cx.once("influence"))) return;
  const recent = world.events.filter((e) => world.cycle - e.cycle <= 96);
  for (const p of Object.values(world.people)) {
    let titles = 0;
    if (p.flags.deputy) titles += 15;
    if (world.parliament.speaker === p.id) titles += 8;
    if (p.id === "r-hermine" || p.id === "r-arlette") titles += 14;
    titles += Object.values(world.companies).filter((c) => c.ceo === p.id && c.status === "active").length * 10;
    titles += Object.values(world.orgs).filter((o) => o.leader === p.id && o.status === "active").length * 8;
    if (p.flags.legend) titles += 10;
    const wealth = Math.log10(balance(world, accountOf("p", p.id)) + 1) * 8;
    const buzz = Math.min(20, recent.filter((e) => e.actors.includes(p.id)).reduce((s, e) => s + e.importance, 0));
    const ghost = p.status === "admin_dead" ? -10 : 0;
    p.influence = Math.round(clamp(p.reputation * 0.5 + wealth + titles + buzz + ghost, 0, 100));
    p.influenceHistory.push({ day: cx.dayKey, value: p.influence });
    if (p.influenceHistory.length > 14) p.influenceHistory.shift();
    p.reputation = Math.round(p.reputation + (50 - p.reputation) * 0.02);
  }
}
