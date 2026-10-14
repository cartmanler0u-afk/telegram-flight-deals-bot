// CHAOS DIRECTOR et moteur de narration émergente.
//
// Le Directeur ne joue pas un scénario : il observe l'état du Bâtiment (dettes, rivalités,
// entreprises au bord du gouffre, promesses non tenues, lois contestées, personnages oubliés…),
// repère les occasions qui RELIENT des éléments existants et propose des événements. Chaque
// proposition passe par le validateur (ops.js) ; rien n'est inventé dans le passé.
//
// Les intrigues (plots) sont des fils persistants : elles accumulent des événements,
// s'endorment, se réveillent, fusionnent, se résolvent ou échouent.

import { credits, worldId } from "./core.js";
import { accountOf, balance } from "./ops.js";
import { hasLaw, lawFollowup, canReachFloor } from "./politics.js";
import { sharePrice, ownerPerson, ownerName } from "./economy.js";

const DAYC = 48;

export function shorten(text, max) {
  const s = String(text || "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[\s,;:«»]+$/, "")}…`;
}

// ------------------------------------------------------------------ intrigues

const PLOT_TAGS = {
  debt_crisis: ["dette", "économie", "justice", "faillite"],
  power_struggle: ["pouvoir", "organisation", "politique", "élection"],
  scandal: ["scandale", "médias", "justice", "secret"],
  identity_dispute: ["double", "justice", "anomalie"],
  admin_ghost: ["administration", "justice", "anomalie"],
  mystery_hunt: ["mystère", "indice", "théorie", "révélation"],
  monopoly_war: ["économie", "loi", "justice", "contrat"],
  strike: ["travail", "organisation", "carrière"],
  election_race: ["élection", "politique", "médias"],
};

export function openPlot(cx, { kind, title, cast, subject, origin, goals, conflict }) {
  const { world } = cx;
  if (Object.values(world.plots).some((p) => p.subject === subject && ["active", "dormant", "merged"].includes(p.state))) return null;
  const id = worldId(world, "pl");
  const res = cx.commit({
    source: "director",
    kind: "plot_open",
    ops: [{ op: "plot", action: "create", plot: { id, kind, title, cast: [...new Set(cast.filter((x) => world.people[x]))], subject, origin, goals, conflict, beats: origin ? [origin] : [], tags: PLOT_TAGS[kind] || [] } }],
  });
  return res.ok ? world.plots[id] : null;
}

// Rattache chaque nouvel événement aux intrigues concernées.
export function attachToPlots(world, event) {
  if (!event || event.importance < 2) return;
  for (const plot of Object.values(world.plots)) {
    if (!["active", "dormant"].includes(plot.state)) continue;
    const castHit = event.actors.some((id) => plot.cast.includes(id));
    const tagHit = event.tags.some((t) => plot.tags.includes(t));
    const subjectHit = plot.subject && (event.key || "").includes(plot.subject.split(":").pop());
    if ((castHit && tagHit) || subjectHit) {
      if (!plot.beats.includes(event.id)) plot.beats.push(event.id);
      if (plot.beats.length > 30) plot.beats.shift();
      plot.lastBeatCycle = world.cycle;
      if (plot.state === "dormant") {
        plot.state = "active";
        plot.revived = (plot.revived || 0) + 1;
      }
      if (!event.plotId) event.plotId = plot.id;
    }
  }
}

function resolvePlot(cx, plot, outcome, text, state = "resolved") {
  return cx.commit({
    source: "director",
    kind: "plot_end",
    key: `plotend:${plot.id}`,
    ops: [{ op: "plot", id: plot.id, set: { state, resolution: { outcome, text, cycle: cx.world.cycle } } }],
    event: { kind: "plot_end", title: `${state === "failed" ? "Échec" : "Dénouement"} : ${plot.title}`, text, actors: plot.cast.slice(0, 4), causes: plot.beats.slice(-2), importance: 4, tags: plot.tags.slice(0, 2) },
  });
}

export function plotsCycle(cx) {
  const { world } = cx;
  for (const plot of Object.values(world.plots)) {
    if (!["active", "dormant"].includes(plot.state)) continue;
    const idle = world.cycle - plot.lastBeatCycle;
    if (plot.state === "active" && idle > 2 * DAYC) plot.state = "dormant";
    if (plot.state === "dormant" && idle > 10 * DAYC) plot.state = "forgotten";
    checkResolution(cx, plot);
  }
  mergePlots(cx);
}

function checkResolution(cx, plot) {
  const { world } = cx;
  const id = (plot.subject || "").split(":")[1];
  if (plot.kind === "debt_crisis") {
    const loan = world.loans[id];
    if (!loan) return;
    if (loan.status === "repaid") resolvePlot(cx, plot, "repaid", `La dette est soldée. ${ownerName(world, loan.borrower)} s'en sort, de justesse.`);
    else if (loan.status === "seized") resolvePlot(cx, plot, "seized", `Le Tribunal a fait saisir ${ownerName(world, loan.borrower)}. ${ownerName(world, loan.lender)} récupère ce qu'il peut.`, "resolved");
    else if (loan.borrower.startsWith("c:") && world.companies[loan.borrower.slice(2)]?.status === "bankrupt") resolvePlot(cx, plot, "bankrupt", `${ownerName(world, loan.borrower)} n'a pas survécu à sa dette.`, "failed");
  } else if (plot.kind === "identity_dispute" || plot.kind === "admin_ghost") {
    const c = Object.values(world.cases).find((x) => x.status === "judged" && x.plaintiff === plot.cast[0] && ["identity", "admin_death"].includes(x.kind));
    if (c) resolvePlot(cx, plot, c.ruling, `Le Tribunal a tranché : ${c.reasoning}`);
  } else if (plot.kind === "mystery_hunt") {
    const m = world.mysteries[id];
    if (m?.status === "solved") resolvePlot(cx, plot, "solved", `L'énigme « ${m.title} » est résolue par ${world.people[m.solvedBy]?.name || "un enquêteur"}.`);
  } else if (plot.kind === "strike") {
    if (!world.flags.strike) resolvePlot(cx, plot, "ended", "Le travail reprend. Pour l'instant.");
  } else if (plot.kind === "monopoly_war") {
    const law = world.laws[id];
    const loser = ["refectoire", "biscuiterie"].find((c) => world.companies[c]?.status === "bankrupt");
    if (loser) resolvePlot(cx, plot, "bankrupt", `${world.companies[loser].name} a perdu la guerre du déjeuner.`, "resolved");
    else if (law && ["annulled", "repealed"].includes(law.status)) resolvePlot(cx, plot, "law_down", `La ${law.title} est tombée. Le fromage revient au Réfectoire.`);
  } else if (plot.kind === "election_race") {
    if (world.parliament.lastElection?.cycle > plot.createdCycle) resolvePlot(cx, plot, "elected", `L'Hémicycle est renouvelé : ${world.parliament.seats.map((s) => world.people[s]?.name).join(", ")}.`);
  } else if (plot.kind === "scandal" || plot.kind === "power_struggle") {
    if (world.cycle - plot.createdCycle > 6 * DAYC && world.cycle - plot.lastBeatCycle > DAYC) resolvePlot(cx, plot, "faded", "L'affaire s'essouffle… mais laisse des traces dans les réputations et les rancunes.");
  }
}

// Seules des affaires de nature voisine peuvent se rejoindre.
const MERGEABLE = [
  ["scandal", "power_struggle"],
  ["debt_crisis", "monopoly_war"],
  ["identity_dispute", "admin_ghost"],
  ["strike", "power_struggle"],
];

function mergePlots(cx) {
  const { world } = cx;
  const live = Object.values(world.plots).filter((p) => p.state === "active");
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const shared = a.cast.filter((id) => b.cast.includes(id));
      if (shared.length < 2 || a.kind === b.kind || !MERGEABLE.some(([x, y]) => (a.kind === x && b.kind === y) || (a.kind === y && b.kind === x))) continue;
      const [keep, drop] = a.createdCycle <= b.createdCycle ? [a, b] : [b, a];
      if ((keep.mergedFrom || []).length >= 2) continue;
      const res = cx.commit({
        source: "director",
        kind: "plot_merge",
        key: `merge:${drop.id}`,
        ops: [
          { op: "plot", id: keep.id, set: { cast: [...new Set([...keep.cast, ...drop.cast])].slice(0, 10), beats: [...new Set([...keep.beats, ...drop.beats])].slice(-30), tags: [...new Set([...keep.tags, ...drop.tags])], mergedFrom: [...(keep.mergedFrom || []), drop.title] } },
          { op: "plot", id: drop.id, set: { state: "merged", mergedInto: keep.id } },
        ],
        event: { kind: "plot_merge", title: `Deux affaires se rejoignent : « ${keep.title} » et « ${drop.title} »`, text: `${shared.map((id) => world.people[id]?.name).join(" et ")} se retrouvent au cœur des deux histoires. Ce qui semblait séparé ne l'était pas.`, actors: shared, causes: [keep.beats.at(-1), drop.beats.at(-1)].filter(Boolean), importance: 4, tags: ["intrigue"] },
      });
      if (res.ok) return;
    }
  }
}

// Création d'intrigues à partir d'événements structurants (appelé après chaque événement).
export function plotsFromEvent(cx, event) {
  if (!event) return;
  const { world } = cx;
  const k = event.kind;
  if (k === "loan_default") {
    const loan = Object.values(world.loans).find((l) => (event.key || "").endsWith(l.id));
    if (loan) openPlot(cx, { kind: "debt_crisis", title: `La dette de ${ownerName(world, loan.borrower)}`, cast: [ownerPerson(world, loan.borrower), ownerPerson(world, loan.lender)], subject: `loan:${loan.id}`, origin: event.id, goals: "Récupérer l'argent / survivre", conflict: "créancier contre débiteur" });
  } else if (k === "double") {
    openPlot(cx, { kind: "identity_dispute", title: `L'affaire des deux ${world.people[event.actors[0]]?.name}`, cast: [event.actors[0], `${event.actors[0]}-bis`], subject: `double:${event.actors[0]}`, origin: event.id, goals: "Être reconnu comme l'original", conflict: "une identité, deux personnes" });
  } else if (k === "admin_death") {
    openPlot(cx, { kind: "admin_ghost", title: `${world.people[event.actors[0]]?.name}, mort administratif`, cast: [event.actors[0]], subject: `ghost:${event.actors[0]}`, origin: event.id, goals: "Prouver son existence", conflict: "une personne contre le Registre" });
  } else if (k === "clue") {
    const m = Object.values(world.mysteries).find((x) => event.title.startsWith(x.title));
    if (m) openPlot(cx, { kind: "mystery_hunt", title: `L'enquête : ${m.title}`, cast: m.investigators, subject: `mystery:${m.id}`, origin: event.id, goals: m.question, conflict: "la vérité contre ceux qui la cachent" });
  } else if (k === "scoop") {
    openPlot(cx, { kind: "scandal", title: `Scandale : ${shorten(event.title.replace(/^La Gazette révèle un secret : /, ""), 70)}`, cast: event.actors, subject: `scoop:${event.id}`, origin: event.id, goals: "Sauver sa réputation", conflict: "la presse contre les puissants" });
  } else if (k === "coup" || k === "coup_failed") {
    openPlot(cx, { kind: "power_struggle", title: `Guerre de pouvoir : ${world.people[event.actors[0]]?.name} contre ${world.people[event.actors[1]]?.name}`, cast: event.actors, subject: `power:${event.actors.slice().sort().join("-")}`, origin: event.id, goals: "Le contrôle de l'organisation", conflict: "ambition contre légitimité" });
  } else if (k === "strike") {
    openPlot(cx, { kind: "strike", title: "La grève des étages inférieurs", cast: event.actors, subject: `strike:${event.cycle}`, origin: event.id, goals: "Obtenir gain de cause", conflict: "travail contre direction" });
  } else if (k === "law_proposed" && (event.text || "").includes("Prohibition Fromagère")) {
    const law = Object.values(world.laws).find((l) => l.code === "cheese_ban" && l.status === "proposed");
    if (law) openPlot(cx, { kind: "monopoly_war", title: "La guerre du fromage", cast: ["r-gaspard", "r-leonie", law.sponsor], subject: `law:${law.id}`, origin: event.id, goals: "Contrôler le déjeuner du Bâtiment", conflict: "Réfectoire contre Biscuiterie" });
  } else if (k === "candidacy" && world.parliament.nextElectionCycle - world.cycle <= 2 * DAYC) {
    const plot = Object.values(world.plots).find((p) => p.kind === "election_race" && p.state === "active");
    if (plot) plot.cast = [...new Set([...plot.cast, ...event.actors])];
    else openPlot(cx, { kind: "election_race", title: `Les élections du ${new Date(event.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`, cast: [...world.parliament.seats, ...event.actors], subject: `election:${world.parliament.nextElectionCycle}`, origin: event.id, goals: "Les cinq sièges de l'Hémicycle", conflict: "sortants contre ambitieux" });
  }
}

// ------------------------------------------------------------------ conséquences différées

export function runScheduled(cx) {
  const { world } = cx;
  const due = world.scheduled.filter((s) => s.dueCycle <= world.cycle);
  if (!due.length) return;
  world.scheduled = world.scheduled.filter((s) => s.dueCycle > world.cycle);
  for (const s of due) {
    try {
      SCHEDULED[s.kind]?.(cx, s.payload, s);
    } catch (err) {
      world.errors.push({ cycle: world.cycle, where: `scheduled:${s.kind}`, message: String(err?.message || err).slice(0, 200) });
    }
  }
}

const SCHEDULED = {
  law_followup: (cx, payload) => lawFollowup(cx, payload),
  audit_end: (cx) => {
    cx.world.flags.auditUntil = 0;
  },
  file_case: (cx, payload, s) => {
    const { world } = cx;
    const plaintiff = world.people[payload.plaintiff];
    if (!plaintiff || plaintiff.status === "missing") return;
    if (payload.kind === "admin_death" && plaintiff.status !== "admin_dead") return;
    const id = worldId(world, "cs");
    cx.commit({
      source: "system",
      kind: "case_filed",
      ops: [{ op: "case", action: "file", case: { id, kind: payload.kind, plaintiff: payload.plaintiff, defendant: payload.defendant || null, subject: payload.subject || `${payload.kind}:${payload.plaintiff}`, title: payload.title, eventId: s.cause } }],
      event: { kind: "case_filed", title: `Plainte déposée : ${payload.title}`, text: `Le greffe du Tribunal des Couloirs enregistre l'affaire. Audience sous deux jours.`, actors: [payload.plaintiff, payload.defendant].filter((x) => world.people[x]), causes: [s.cause].filter(Boolean), importance: 3, tags: ["justice"] },
    });
  },
  floor_vote: (cx, payload) => {
    const { world, rng } = cx;
    const floor = world.building.floors[payload.floor];
    if (!floor || floor.onPlan) return;
    const deputies = world.parliament.seats.map((id) => world.people[id]).filter((d) => d && canReachFloor(world, d, "f4"));
    let yes = 0;
    for (const d of deputies) if ((d.ambition?.kind === "truth" ? 2 : 0) + (d.traits.includes("zealous") ? -1 : 0) + rng.next() * 2 - 1 > 0) yes += 1;
    const register = yes > deputies.length / 2;
    cx.commit({
      source: "system",
      kind: "floor_vote",
      key: `floorvote:${floor.id}`,
      ops: [{ op: "floor", id: floor.id, set: register ? { onPlan: true, status: "open", discovered: true } : { status: "sealed" } }],
      event: { kind: "floor_vote", title: register ? `${floor.name} entre au Plan Officiel` : `${floor.name} est scellé par l'Hémicycle`, text: register ? `${yes} député(s) sur ${deputies.length} votent son inscription. Il existe désormais légalement : les lois s'y appliquent (Charte, R4).` : `L'Hémicycle refuse son inscription (${yes} pour). L'accès est scellé… officiellement.`, actors: deputies.map((d) => d.id).slice(0, 4), importance: 4, tags: ["bâtiment", "politique"] },
    });
  },
  strike_end: (cx, payload) => {
    const { world } = cx;
    if (!world.flags.strike || world.flags.strike.since !== payload.since) return;
    world.flags.strike = null;
    cx.commit({ source: "system", kind: "strike_end", key: `strikeend:${payload.since}`, event: { kind: "strike_end", title: "Fin de la grève, sans accord", text: "Les grévistes reprennent le travail, épuisés et toujours furieux. Le Réfectoire rouvre ses portes.", actors: [payload.leader].filter((x) => world.people[x]), importance: 3, tags: ["travail"] } });
  },
  promise: (cx, payload) => keepOrBreakPromise(cx, payload),
};

function keepOrBreakPromise(cx, { fact }) {
  const { world } = cx;
  const f = world.facts[fact];
  if (!f?.data || f.data.settled) return;
  const debtor = world.people[f.data.from];
  const creditor = world.people[f.data.to];
  if (!debtor || !creditor) return;
  const acct = accountOf("p", debtor.id);
  f.data.settled = true;
  if (balance(world, acct) >= f.data.amount && !world.accounts[acct].frozen) {
    cx.commit({ source: "agent", kind: "promise_kept", ops: [{ op: "transfer", from: acct, to: accountOf("p", creditor.id), amount: f.data.amount, reason: "Remboursement d'une promesse" }, { op: "relation", a: debtor.id, b: creditor.id, kind: "ami", score: 45, note: "Promesse tenue." }], event: { kind: "promise_kept", title: `${debtor.name} rembourse ${creditor.name}, comme promis`, text: `${credits(f.data.amount)} rendus à l'heure. Rare dans ce Bâtiment.`, actors: [debtor.id, creditor.id], causes: [f.source].filter(Boolean), importance: 2, tags: ["relations"] } });
  } else {
    cx.commit({ source: "agent", kind: "promise_broken", ops: [{ op: "relation", a: debtor.id, b: creditor.id, kind: "rival", score: -35, note: "Promesse non tenue." }, { op: "person", id: debtor.id, reputation: -3 }], event: { kind: "promise_broken", title: `${debtor.name} ne rembourse pas ${creditor.name}`, text: `La promesse est oubliée, pas la dette. ${creditor.name} le raconte à tout l'étage.`, actors: [debtor.id, creditor.id], causes: [f.source].filter(Boolean), importance: 3, tags: ["relations", "dette"] }, facts: [{ text: `${debtor.name} n'a pas rendu les ${credits(f.data.amount)} promis à ${creditor.name}.`, about: [debtor.id, creditor.id], status: "rumor", truth: true, knownBy: [creditor.id] }] });
  }
}

// ------------------------------------------------------------------ CHAOS DIRECTOR

const OPPORTUNITIES = [
  ["promise", promiseOpportunities],
  ["strike", strikeOpportunity],
  ["rescue", rescueOpportunity],
  ["rivalry", rivalryOpportunity],
  ["contract", contractOpportunity],
  ["comeback", comebackOpportunity],
  ["debt_watch", debtWatch],
];

export function directorCycle(cx) {
  const { world, rng } = cx;
  // Les promesses arrivent à échéance quoi qu'il arrive.
  for (const f of Object.values(world.facts)) {
    if (f.kind === "promise" && f.data && !f.data.settled && f.data.dueCycle <= world.cycle) keepOrBreakPromise(cx, { fact: f.id });
  }
  if (world.flags.strike && world.cycle - world.flags.strike.since > 2 * DAYC) SCHEDULED.strike_end(cx, world.flags.strike);
  const daytime = cx.hour >= 8 && cx.hour < 22;
  if (!rng.chance(daytime ? 0.12 : 0.03)) return;
  // On évalue toutes les occasions puis on en retient une, pondérée par son intérêt narratif.
  const candidates = [];
  for (const [name, finder] of OPPORTUNITIES) {
    for (const opp of finder(cx) || []) candidates.push([{ name, ...opp }, opp.score]);
  }
  const chosen = rng.weighted(candidates);
  if (!chosen) return;
  const res = chosen.run();
  world.director = { ...(world.director || {}), last: { cycle: world.cycle, opportunity: chosen.name, ok: !!res?.ok } };
}

function promiseOpportunities() {
  return [];
}

function strikeOpportunity(cx) {
  const { world } = cx;
  const union = world.orgs["o-union"];
  if (!union || union.status !== "active" || world.flags.strike) return [];
  const last = world.events.filter((e) => e.kind === "strike").at(-1);
  if (last && world.cycle - last.cycle < 5 * DAYC) return [];
  const unpaid = cx.recent((e) => e.kind === "unpaid_wages", DAYC);
  const hostile = Object.values(world.laws).filter((l) => l.status === "enacted" && ["nap_tax", "elevator_filter", "meeting_form", "curfew"].includes(l.code) && world.cycle - l.enactedCycle < 4 * DAYC);
  if (!unpaid.length && !hostile.length) return [];
  const leader = world.people[union.leader];
  if (!leader || leader.status !== "active") return [];
  const cause = unpaid.at(-1) || world.events.find((e) => e.id === hostile[0]?.eventId) || null;
  return [{
    score: 6,
    run: () => {
      const since = world.cycle;
      const res = cx.commit({
        source: "director",
        kind: "strike",
        ops: [{ op: "schedule", dueCycle: world.cycle + 2 * DAYC, kind: "strike_end", payload: { since, leader: leader.id } }, { op: "building", mood: -6 }],
        event: { kind: "strike", title: `Grève ! ${union.name} bloque le Réfectoire`, text: `${leader.name} appelle à la grève ${unpaid.length ? "après les salaires impayés" : `contre la ${hostile[0].title}`}. Le Réfectoire est fermé, les plateaux-repas restent au frais.`, actors: [leader.id, ...union.members.slice(0, 3)], causes: [cause?.id].filter(Boolean), importance: 4, tags: ["travail", "organisation"] },
        decision: { kind: "strike", title: "La grève bloque le Réfectoire : verser une prime de 300 cr à l'Union ?", org: union.id },
      });
      if (res.ok) world.flags.strike = { since, union: union.id, leader: leader.id };
      return res;
    },
  }];
}

function rescueOpportunity(cx) {
  const { world, rng } = cx;
  const out = [];
  for (const c of Object.values(world.companies)) {
    if (c.status !== "active" || c.id === "bosscorp" || c.kind === "bank") continue;
    const cash = balance(world, accountOf("c", c.id));
    if (cash > c.dailyCost * 2) continue;
    const savior = rng.pick(Object.values(world.people).filter((p) => p.status === "active" && p.ambition?.kind === "wealth" && p.id !== c.ceo && balance(world, accountOf("p", p.id)) >= 900));
    const ceoShares = c.shares[c.ceo] || 0;
    if (savior && ceoShares >= 20) {
      out.push({
        score: 5,
        run: () => {
          const amount = 700;
          const n = 20;
          return cx.commit({
            source: "director",
            kind: "rescue",
            ops: [{ op: "transfer", from: accountOf("p", savior.id), to: accountOf("c", c.id), amount, reason: `Renflouement de ${c.name}` }, { op: "company", id: c.id, action: "shares", from: c.ceo, to: savior.id, n }, { op: "relation", a: savior.id, b: c.ceo, kind: "ami", score: 20, note: "Sauvetage financier (avec conditions)." }],
            event: { kind: "rescue", title: `${savior.name} sauve ${c.name} de la faillite`, text: `${credits(amount)} injectés en échange de ${n} parts arrachées à ${world.people[c.ceo]?.name}. « Je ne fais pas ça pour l'argent », jure ${savior.name}, qui le fait pour l'argent.`, actors: [savior.id, c.ceo], causes: cx.recent((e) => e.actors.includes(c.ceo) && ["unpaid_wages", "loan_default"].includes(e.kind), 2 * DAYC).map((e) => e.id).slice(-1), importance: 4, tags: ["économie"] },
          });
        },
      });
    }
    if (balance(world, accountOf("c", "bosscorp")) >= 1200 && !world.decisions.some((d) => d.status === "open" && d.company === c.id)) {
      out.push({
        score: 4,
        run: () => cx.commit({
          source: "director",
          kind: "funding_request",
          key: `funding:${c.id}:${cx.dayKey}`,
          event: { kind: "funding_request", title: `${c.name} appelle ton entreprise au secours`, text: `${world.people[c.ceo]?.name} demande 800 cr à ton entreprise contre 25 parts. Sans réponse, ${c.name} risque la faillite.`, actors: [c.ceo], importance: 3, tags: ["économie", "décision"] },
          decision: { kind: "funding", title: `Investir 800 cr dans ${c.name} (25 parts) ?`, company: c.id, amount: 800, shares: 25 },
        }),
      });
    }
  }
  return out;
}

function rivalryOpportunity(cx) {
  const { world, rng } = cx;
  const rels = cx.relations().filter((r) => r.kind === "rival" && world.people[r.a] && world.people[r.b] && world.people[r.a].status === "active" && world.people[r.b].status === "active");
  const hot = rels.filter((r) => world.people[r.a].influence + world.people[r.b].influence >= 70 && !world.events.some((e) => e.kind === "smear" && world.cycle - e.cycle < 3 * DAYC && e.actors.includes(r.a) && e.actors.includes(r.b)));
  const r = rng.pick(hot);
  if (!r) return [];
  const [a, b] = rng.shuffle([world.people[r.a], world.people[r.b]]);
  const host = world.people["r-nadia"];
  return [{
    score: 4,
    run: () => {
      // L'un fait courir une rumeur sur l'autre : vraie s'il connaît un secret, fausse sinon.
      const secret = a.knows.map((id) => world.facts[id]).find((f) => f && f.status === "secret" && f.about.includes(b.id));
      const rumorText = secret ? secret.text : rng.pick([`${b.name} aurait truqué le dernier vote de son organisation.`, `${b.name} dormirait à l'Étage 13 certaines nuits.`, `${b.name} serait en réalité payé par la Banque du Sous-Sol.`, `${b.name} aurait volé la plante du Hall.`]);
      return cx.commit({
        source: "director",
        kind: "smear",
        ops: [{ op: "relation", a: a.id, b: b.id, kind: "rival", score: -60, note: "Campagne de rumeurs." }],
        event: { kind: "smear", title: `${a.name} fait courir une rumeur sur ${b.name}`, text: `À la machine à café, ${a.name} glisse à qui veut l'entendre : « ${rumorText} »${host ? " Radio Cage d'Escalier tend l'oreille." : ""}`, actors: [a.id, b.id], importance: 3, public: false, tags: ["rumeur", "pouvoir"] },
        facts: [{ kind: "rumor", text: rumorText, about: [b.id], status: "rumor", truth: secret ? true : false, knownBy: [a.id, host?.id, "r-felix"].filter((x) => world.people[x]) }],
      });
    },
  }];
}

// Un dirigeant menacé par une loi signe un contrat AVANT son adoption… qui servira plus tard.
function contractOpportunity(cx) {
  const { world } = cx;
  const law = Object.values(world.laws).find((l) => l.status === "proposed" && l.code === "cheese_ban");
  const gaspard = world.people["r-gaspard"];
  if (!law || !gaspard || gaspard.status !== "active" || world.facts[world.flags.cheeseContract]) return [];
  return [{
    score: 7,
    run: () => {
      const res = cx.commit({
        source: "director",
        kind: "contract",
        key: `contract:${law.id}`,
        event: { kind: "contract", title: `${gaspard.name} signe en urgence un contrat fromager de 30 jours`, text: `Le vote sur la ${law.title} approche. ${gaspard.name} fait tamponner au Registre un contrat d'approvisionnement en fromage, daté d'aujourd'hui. Ambroise Folio note l'heure exacte : ${new Date(cx.now).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`, actors: [gaspard.id, "r-ambroise"].filter((x) => world.people[x]), causes: [law.eventId].filter(Boolean), importance: 3, tags: ["économie", "contrat", "loi"] },
        facts: [{ kind: "contract", text: `${gaspard.name} a signé un contrat fromager AVANT le vote de la ${law.title}.`, about: [gaspard.id], public: true, data: { law: law.id, cycle: world.cycle } }],
      });
      if (res.ok) {
        world.flags.cheeseContract = res.event.facts[0];
        world.scheduled.push({ id: worldId(world, "sc"), dueCycle: world.cycle + 4 * DAYC, kind: "file_case", payload: { kind: "contract", plaintiff: gaspard.id, defendant: law.sponsor, subject: `contract:${law.id}`, title: `${gaspard.name} contre la Prohibition Fromagère (contrat antérieur)` }, cause: res.event.id });
      }
      return res;
    },
  }];
}

// Les oubliés reviennent : licenciés fortunés, morts administratifs, doubles délaissés.
function comebackOpportunity(cx) {
  const { world, rng } = cx;
  const forgotten = Object.values(world.people).filter((p) => world.cycle - (p.lastSeenCycle || 0) > 3 * DAYC && ["fired", "admin_dead", "double"].includes(p.status));
  const p = rng.pick(forgotten);
  if (!p) return [];
  return [{
    score: 5,
    run: () => {
      if (p.status === "fired" && balance(world, accountOf("p", p.id)) >= 300) {
        const target = rng.pick(Object.values(world.companies).filter((c) => c.status === "active" && c.id !== "bosscorp" && Object.keys(c.shares).some((h) => h !== p.id && h !== "boss" && c.shares[h] >= 10)));
        if (!target) return null;
        const seller = Object.keys(target.shares).find((h) => h !== p.id && h !== "boss" && target.shares[h] >= 10);
        const price = sharePrice(world, target);
        const n = Math.max(1, Math.min(10, Math.floor(balance(world, accountOf("p", p.id)) / 2 / price)));
        return cx.commit({
          source: "director",
          kind: "comeback",
          ops: [{ op: "transfer", from: accountOf("p", p.id), to: seller === "syndic" ? "treasury" : accountOf("p", seller), amount: n * price, reason: `Rachat de ${n} parts de ${target.name}` }, { op: "company", id: target.id, action: "shares", from: seller, to: p.id, n }, { op: "person", id: p.id, set: { title: "Investisseur (ancien licencié)" }, career: `Revient comme actionnaire de ${target.name}`, reputation: 4 }],
          event: { kind: "comeback", title: `Le retour de ${p.name}, licencié devenu investisseur`, text: `On le croyait parti. ${p.name} rachète ${n} parts de ${target.name} et réclame un siège au conseil.`, actors: [p.id, target.ceo], causes: p.memories.slice(-1), importance: 4, tags: ["économie", "carrière"] },
        });
      }
      if (p.status === "admin_dead") {
        return cx.commit({
          source: "director",
          kind: "ghost",
          event: { kind: "ghost", title: `${p.name}, officiellement mort, refuse de disparaître`, text: `${p.name} continue de pointer chaque matin. ${hasLaw(world, "fired_vote") ? "Grâce à la Loi du Dernier Mot, il compte même voter." : "Le Registre lui envoie des condoléances par courrier interne."}`, actors: [p.id], causes: p.memories.slice(-1), importance: 3, tags: ["administration", "anomalie"] },
        });
      }
      return cx.commit({
        source: "director",
        kind: "double_life",
        event: { kind: "double_life", title: `${p.name} se construit une autre vie`, text: `Sans badge, sans poste, ${p.name} s'est installé aux Objets Trouvés et y tient un comptoir de conseils. On fait la queue.`, actors: [p.id], importance: 3, tags: ["double", "carrière"] },
      });
    },
  }];
}

// Repère les dettes qui vont mal tourner et ouvre l'intrigue avant le défaut.
function debtWatch(cx) {
  const { world } = cx;
  const out = [];
  for (const loan of Object.values(world.loans)) {
    if (loan.status !== "active" || loan.dueCycle - world.cycle > 2 * DAYC) continue;
    if (balance(world, loan.borrower) >= loan.balance) continue;
    if (Object.values(world.plots).some((p) => p.subject === `loan:${loan.id}`)) continue;
    out.push({
      score: 5,
      run: () => {
        const res = cx.commit({
          source: "director",
          kind: "debt_warning",
          key: `debtwarn:${loan.id}`,
          event: { kind: "debt_warning", title: `${ownerName(world, loan.borrower)} ne pourra pas rembourser à temps`, text: `Échéance dans moins de deux jours, ${credits(loan.balance)} dus à ${ownerName(world, loan.lender)}. Le créancier commence à compter les meubles.`, actors: [ownerPerson(world, loan.borrower), ownerPerson(world, loan.lender)], causes: [loan.eventId].filter(Boolean), importance: 3, tags: ["dette", "économie"] },
        });
        if (res.ok) openPlot(cx, { kind: "debt_crisis", title: `La dette de ${ownerName(world, loan.borrower)}`, cast: [ownerPerson(world, loan.borrower), ownerPerson(world, loan.lender)], subject: `loan:${loan.id}`, origin: res.event.id, goals: "Rembourser ou saisir", conflict: "créancier contre débiteur" });
        return res;
      },
    });
  }
  // Après un défaut, le créancier saisit le Tribunal.
  for (const loan of Object.values(world.loans)) {
    if (loan.status !== "defaulted" || loan.sued) continue;
    const lender = ownerPerson(world, loan.lender);
    if (!lender || !world.people[lender]) continue;
    out.push({
      score: 6,
      run: () => {
        loan.sued = true;
        const id = worldId(world, "cs");
        return cx.commit({
          source: "director",
          kind: "case_filed",
          ops: [{ op: "case", action: "file", case: { id, kind: "debt", plaintiff: lender, defendant: ownerPerson(world, loan.borrower), subject: `loan:${loan.id}`, title: `${ownerName(world, loan.lender)} contre ${ownerName(world, loan.borrower)} (dette)` } }],
          event: { kind: "case_filed", title: `${ownerName(world, loan.lender)} poursuit ${ownerName(world, loan.borrower)} pour dette`, text: `${credits(loan.balance)} réclamés devant le Tribunal des Couloirs.`, actors: [lender, ownerPerson(world, loan.borrower)], causes: world.events.filter((e) => e.key === `default:${loan.id}`).map((e) => e.id), importance: 3, tags: ["justice", "dette"] },
        });
      },
    });
  }
  return out;
}

// ------------------------------------------------------------------ décisions du patron

export function decide(cx, decisionId, choice) {
  const { world } = cx;
  const d = world.decisions.find((x) => x.id === decisionId);
  if (!d || d.status !== "open") throw new Error("Cette décision n'est plus d'actualité.");
  const accept = choice === "yes";
  let res = null;
  if (d.kind === "promotion") {
    const p = world.people[d.person];
    res = cx.commit({
      source: "boss",
      kind: "promotion",
      ops: p ? [{ op: "person", id: p.id, set: accept ? { title: `${p.title} (promu·e par le patron)`, flags: { ...p.flags, buildingTitle: true } } : {}, reputation: accept ? 6 : -3, career: accept ? "Promotion accordée par le patron" : "Promotion refusée par le patron" }, ...(accept ? [] : [{ op: "person", id: p.id, set: { ambition: { kind: "power" } } }])] : [],
      event: { kind: accept ? "promotion" : "promotion_refused", title: accept ? `Tu promeus ${p?.name}` : `Tu refuses la promotion de ${p?.name}`, text: accept ? `${p?.name} affiche sa nouvelle fonction sur la porte. Avec du scotch.` : `${p?.name} encaisse. On dit qu'il regarde désormais du côté de l'Hémicycle.`, actors: [p?.id], causes: [d.eventId].filter(Boolean), importance: 3, tags: ["carrière", "décision"] },
    });
  } else if (d.kind === "funding") {
    const c = world.companies[d.company];
    const from = accountOf("c", "bosscorp");
    if (accept && c?.status === "active") {
      const ceoShares = c.shares[c.ceo] || 0;
      const n = Math.min(d.shares, ceoShares);
      res = cx.commit({
        source: "boss",
        kind: "boss_invest",
        ops: [{ op: "transfer", from, to: accountOf("c", c.id), amount: d.amount, reason: `Investissement de ton entreprise dans ${c.name}` }, ...(n > 0 ? [{ op: "company", id: c.id, action: "shares", from: c.ceo, to: "boss", n }] : [])],
        event: { kind: "boss_invest", title: `Ton entreprise investit ${credits(d.amount)} dans ${c.name}`, text: `${world.people[c.ceo]?.name} te serre la main un peu trop longtemps. Tu détiens désormais ${n} parts.`, actors: [c.ceo], causes: [d.eventId].filter(Boolean), importance: 3, tags: ["économie", "décision"] },
      });
    } else {
      res = cx.commit({ source: "boss", kind: "boss_refuse", event: { kind: "boss_refuse", title: `Tu refuses d'investir dans ${c?.name}`, text: `${world.people[c?.ceo]?.name || "La direction"} se tourne vers la Banque du Sous-Sol.`, actors: [c?.ceo], causes: [d.eventId].filter(Boolean), importance: 2, tags: ["économie", "décision"] } });
    }
  } else if (d.kind === "strike") {
    const org = world.orgs[d.org];
    if (accept && org) {
      res = cx.commit({ source: "boss", kind: "boss_bonus", ops: [{ op: "transfer", from: accountOf("c", "bosscorp"), to: accountOf("o", org.id), amount: 300, reason: "Prime de fin de grève" }, { op: "building", mood: 5 }], event: { kind: "strike_end", title: "Tu finances une prime : fin de la grève", text: `L'Union accepte les 300 cr. Le Réfectoire rouvre, les employés de l'Étage 1 deviennent soudain très populaires.`, actors: [org.leader], causes: [d.eventId].filter(Boolean), importance: 3, tags: ["travail", "décision"] } });
      if (res.ok) world.flags.strike = null;
    } else {
      res = cx.commit({ source: "boss", kind: "boss_ignore", event: { kind: "boss_ignore", title: "Tu laisses la grève suivre son cours", text: "L'Union note ton silence. Elle s'en souviendra aux élections.", actors: [org?.leader], causes: [d.eventId].filter(Boolean), importance: 2, tags: ["travail", "décision"] } });
    }
  }
  if (!res?.ok) throw new Error(res?.errors?.[0] || "Décision impossible.");
  d.status = "resolved";
  d.choice = accept ? "yes" : "no";
  d.resolvedCycle = world.cycle;
  return res;
}

export function expireDecisions(cx) {
  const { world } = cx;
  for (const d of world.decisions) {
    if (d.status === "open" && world.cycle - d.cycle > DAYC) {
      d.status = "expired";
      d.choice = "no";
    }
  }
  if (world.decisions.length > 30) world.decisions.splice(0, world.decisions.length - 30);
}
