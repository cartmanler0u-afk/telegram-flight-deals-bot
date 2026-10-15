// Politique et justice : Parlement (dépôt, vote, quorum, abrogation), lois qui modifient
// réellement la simulation, élections, et Tribunal des Couloirs.

import { PARLIAMENT_FLOOR, COURT_FLOOR } from "./building.js";
import { LAW_CATALOG } from "./cast.js";
import { credits, worldId } from "./core.js";
import { accountOf, balance } from "./ops.js";
import { bankrupt, ownerName } from "./economy.js";

const SEATS = 5;

export function hasLaw(world, code) {
  return Object.values(world.laws).some((l) => l.code === code && l.status === "enacted");
}

export function canVote(world, p) {
  if (!p) return false;
  if (p.kind === "animal" && !hasLaw(world, "animal_personhood") && !(p.species === "pigeon" && hasLaw(world, "pigeon_vote"))) return false;
  if (p.status === "active" || p.status === "double") return true;
  if (["fired", "admin_dead"].includes(p.status)) return hasLaw(world, "fired_vote");
  return false;
}

// L'Ascenseur B décide qui atteint quel étage (lois, rancunes, étages scellés).
export function canReachFloor(world, p, floorId) {
  const floor = world.building.floors[floorId];
  if (!floor || !p) return false;
  if (["sealed", "closed"].includes(floor.status) && p.floor !== floorId) return false;
  if (p.floor === floorId) return true;
  const grudge = world.building.elevator.grudges[p.id];
  if (grudge && grudge > world.cycle) return false;
  if (hasLaw(world, "elevator_filter") && p.reputation < 30) return false;
  return true;
}

export function stanceOf(world, p) {
  const stance = { order: 0, upper: 0, truth: 0 };
  for (const org of Object.values(world.orgs)) {
    if (org.status !== "active" || !org.members.includes(p.id)) continue;
    stance.order += org.stance?.order || 0;
    stance.upper += org.stance?.upper || 0;
    if (org.kind === "secret") stance.truth += 1;
  }
  if (p.traits.includes("zealous") || p.traits.includes("meticulous")) stance.order += 0.5;
  if (p.ambition?.kind === "truth") stance.truth += 1;
  if (p.kind === "animal") stance.upper -= 1;
  return stance;
}

function lawAlignment(world, law, p) {
  const st = stanceOf(world, p);
  const def = LAW_CATALOG[law.code];
  if (law.code === "repeal") {
    const target = world.laws[law.target];
    return target ? -lawAlignment(world, target, p) : 0;
  }
  let score = 0;
  for (const tag of def?.sponsors || []) {
    if (tag === "order") score += st.order;
    if (tag === "upper") score += st.upper;
    if (tag === "lower") score -= st.upper;
    if (tag === "truth") score += st.truth;
  }
  // Intérêts personnels : on ne vote pas une loi qui vous coûte.
  if (law.code === "cheese_ban" && world.companies.refectoire?.shares[p.id]) score -= 3;
  if (law.code === "cheese_ban" && world.companies.biscuiterie?.shares[p.id]) score += 3;
  if (law.code === "nap_tax" && p.traits.includes("lazy")) score -= 2;
  if (law.code === "plant_declaration" && world.companies.serres?.shares[p.id]) score += 3;
  if (law.code === "elevator_filter" && p.reputation < 35) score -= 3;
  return score;
}

// ------------------------------------------------------------------ cycle politique

export function politicsCycle(cx) {
  const { world } = cx;
  if (cx.hour >= 11 && cx.once("court")) tribunal(cx);
  if (cx.hour >= 15 && cx.once("session")) session(cx);
  if (cx.hour >= 16 && cx.once("laweffects")) lawEffects(cx);
  if (world.cycle >= world.parliament.nextElectionCycle && cx.hour >= 18 && cx.once("election")) election(cx);
}

function session(cx) {
  const { world, rng } = cx;
  const deputies = world.parliament.seats.map((id) => world.people[id]).filter(Boolean);
  if (!deputies.length) return;
  const present = deputies.filter((d) => canReachFloor(world, d, PARLIAMENT_FLOOR) && !["missing"].includes(d.status));
  const absent = deputies.filter((d) => !present.includes(d));
  world.parliament.sessions += 1;

  // Vote des lois en discussion.
  for (const law of Object.values(world.laws).filter((l) => l.status === "proposed" && l.proposedCycle < world.cycle)) {
    if (present.length < 3) {
      cx.commit({
        source: "system",
        kind: "quorum",
        key: `quorum:${law.id}:${cx.dayKey}`,
        event: { kind: "no_quorum", title: `Pas de quorum à l'Hémicycle : le vote sur « ${law.title} » est reporté`, text: `${absent.map((d) => d.name).join(", ")} n'ont pas pu atteindre l'étage 4${hasLaw(world, "elevator_filter") ? " (l'Ascenseur B applique la Loi sur la Dignité Verticale)" : ""}.`, actors: absent.map((d) => d.id), importance: 3, tags: ["politique"] },
      });
      continue;
    }
    const votes = { for: [], against: [], absent: absent.map((d) => d.id) };
    for (const d of present) {
      let score = lawAlignment(world, law, d) * 2;
      const rel = cx.relation(d.id, law.sponsor);
      if (rel?.kind === "rival") score -= 2;
      if (["ami", "bff", "couple"].includes(rel?.kind)) score += 1.5;
      if (law.lobby?.[d.id]) score += 3;
      if (d.id === law.sponsor) score += 10;
      score += rng.next() * 2 - 1;
      (score > 0 ? votes.for : votes.against).push(d.id);
    }
    const passed = votes.for.length > votes.against.length;
    const sponsor = world.people[law.sponsor];
    const ops = [{ op: "law", id: law.id, set: { status: passed ? "enacted" : "rejected", votes, quorumFlaw: absent.length >= 2 } }];
    if (passed && law.code === "repeal") ops.push({ op: "law", id: law.target, set: { status: "repealed" } });
    if (sponsor) ops.push({ op: "person", id: sponsor.id, reputation: passed ? 3 : -2 });
    const target = law.code === "repeal" ? world.laws[law.target] : null;
    const result = cx.commit({
      source: "system",
      kind: passed ? "law_enacted" : "law_rejected",
      key: `vote:${law.id}`,
      ops,
      event: {
        kind: passed ? "law_enacted" : "law_rejected",
        title: passed ? (target ? `Abrogation : « ${target.title} » n'existe plus` : `Loi adoptée : ${law.title}`) : `Loi rejetée : ${law.title}`,
        text: `${passed ? (target ? `La ${target.title} est abrogée` : law.text) : "L'Hémicycle a dit non"} (${votes.for.length} pour, ${votes.against.length} contre${votes.absent.length ? `, ${votes.absent.length} absent(s)` : ""}). Texte porté par ${sponsor?.name || "un député"}.${passed && !target ? " Applicable dès le prochain cycle (Charte, R4)." : ""}`,
        actors: [law.sponsor, ...votes.against.slice(0, 2)],
        causes: [law.eventId].filter(Boolean),
        importance: passed ? 4 : 3,
        tags: ["politique", "loi"],
      },
      facts: [{ text: passed ? `${target ? `Abrogation de « ${target.title} »` : `${law.title} : ${law.text}`}` : `${law.title} a été rejetée.`, about: [law.sponsor], public: true }],
    });
    if (result.ok && passed && law.code !== "repeal") {
      cx.commit({ source: "system", kind: "followup", ops: [{ op: "schedule", dueCycle: world.cycle + 6, kind: "law_followup", payload: { law: law.id } }] });
      applyLawOnEnactment(cx, law, result.event);
    }
  }

  // Dépôt d'une nouvelle loi (au plus une en discussion à la fois).
  if (Object.values(world.laws).some((l) => l.status === "proposed")) return;
  if (!rng.chance(0.55) || !present.length) return;
  const sponsor = rng.pick(present.filter((d) => d.kind !== "animal" || hasLaw(world, "animal_personhood")));
  if (!sponsor) return;
  const enacted = Object.values(world.laws).filter((l) => l.status === "enacted");
  // Abrogation d'une loi contraire à ses convictions, ou dépôt d'un texte aligné.
  const toRepeal = enacted.filter((l) => l.code !== "repeal" && lawAlignment(world, l, sponsor) < -1 && world.cycle - l.enactedCycle > 48);
  let law;
  if (toRepeal.length && rng.chance(0.5)) {
    const target = rng.pick(toRepeal);
    law = { id: worldId(world, "lw"), code: "repeal", target: target.id, title: `Abrogation de la ${target.title}`, text: `Supprime la ${target.title}.`, sponsor: sponsor.id };
  } else {
    const options = Object.entries(LAW_CATALOG).filter(([code]) => !hasLaw(world, code)).map(([code, def]) => [code, Math.max(0.2, lawAlignment(world, { code }, sponsor) + 1.5) * (code === "animal_personhood" && Object.values(world.people).some((p) => p.kind === "animal" && p.flags.campaigning) ? 3 : 1)]);
    const code = rng.weighted(options);
    if (!code) return;
    const def = LAW_CATALOG[code];
    law = { id: worldId(world, "lw"), code, title: def.title, text: def.text, sponsor: sponsor.id };
  }
  const res = cx.commit({
    source: "system",
    kind: "law_proposed",
    ops: [{ op: "law", action: "propose", law }],
    event: { kind: "law_proposed", title: `Proposition de loi : ${law.title}`, text: `${sponsor.name} dépose « ${law.title} » : ${law.text} Vote au prochain passage en séance.`, actors: [sponsor.id], importance: 2, tags: ["politique", "loi"] },
    facts: [{ text: `${sponsor.name} a déposé « ${law.title} ».`, about: [sponsor.id], public: true }],
  });
  if (res.ok) world.laws[law.id].eventId = res.event.id;
}

// Effets immédiats de certaines lois.
function applyLawOnEnactment(cx, law, event) {
  const { world } = cx;
  if (law.code === "animal_personhood") {
    const animals = Object.values(world.people).filter((p) => p.kind === "animal");
    cx.commit({
      source: "system",
      kind: "personhood",
      key: `personhood:${law.id}`,
      ops: animals.map((a) => ({ op: "person", id: a.id, career: "Devient une personne juridique" })),
      event: { kind: "animals_vote", title: "Les animaux du Bâtiment deviennent des personnes", text: `${animals.map((a) => a.name).join(", ")} peuvent désormais voter, posséder un compte et se présenter aux élections.`, actors: animals.map((a) => a.id).slice(0, 6), causes: [event.id], importance: 4, tags: ["politique", "animaux"] },
    });
  }
  if (law.code === "ceo_real_work") {
    const ceo = Object.values(world.people).find((p) => p.flags?.ceo && p.status === "active");
    if (ceo) {
      cx.commit({
        source: "system",
        kind: "ceo_work",
        key: `ceowork:${law.id}`,
        ops: [{ op: "person", id: ceo.id, set: { flags: { ...ceo.flags, goTo: { room: "f0.cafeteria", until: world.cycle + 16, reason: "Loi du Retour au Réel" } } }, career: "Journée de travail réel (plonge à la Cafétéria)" }],
        event: { kind: "ceo_work", title: `${ceo.name} fait la plonge à la Cafétéria`, text: `En application de la Loi du Retour au Réel, ${ceo.name} passe la journée en cuisine. Il demande où se trouve « le bouton pour déléguer ».`, actors: [ceo.id, "r-gaspard"].filter((id) => world.people[id]), room: "f0.cafeteria", causes: [event.id], importance: 4, tags: ["politique", "direction"] },
      });
    }
  }
  if (law.code === "registry_audit") {
    cx.commit({ source: "system", kind: "audit", ops: [{ op: "building", pressure: 8 }, { op: "schedule", dueCycle: world.cycle + 3 * 48, kind: "audit_end", payload: { law: law.id } }] });
    world.flags.auditUntil = world.cycle + 3 * 48;
  }
}

// Effets quotidiens des lois en vigueur : amendes, taxes, achats obligatoires.
function lawEffects(cx) {
  const { world, rng } = cx;
  const fines = [];
  if (hasLaw(world, "forbidden_word")) {
    for (const p of Object.values(world.people)) {
      if (p.kind === "animal" || p.status !== "active") continue;
      if ((p.traits.includes("showoff") || p.traits.includes("hustler") || p.archetype === "startupper") && rng.chance(0.2)) fines.push([p, 5, "a dit « synergie »", -5]);
    }
  }
  if (hasLaw(world, "nap_tax")) {
    for (const p of Object.values(world.people)) if (p.traits.includes("lazy") && p.status === "active" && rng.chance(0.5)) fines.push([p, 5, "sieste constatée"]);
  }
  if (hasLaw(world, "plant_declaration")) {
    const serres = world.companies.serres;
    const leaders = Object.values(world.people).filter((p) => p.status === "active" && p.kind !== "animal" && !p.flags.plant && (Object.values(world.companies).some((c) => c.ceo === p.id) || p.title?.toLowerCase().includes("directeur") || p.title === "Manager"));
    for (const p of leaders) {
      const acct = accountOf("p", p.id);
      if (serres?.status === "active" && balance(world, acct) >= serres.price) {
        cx.commit({ source: "system", kind: "plant", ops: [{ op: "transfer", from: acct, to: accountOf("c", "serres"), amount: serres.price, reason: "Plante déclarée (Loi sur le Patrimoine Végétal)" }, { op: "person", id: p.id, set: { flags: { ...p.flags, plant: true } } }] });
      } else fines.push([p, 30, "aucune plante déclarée"]);
    }
  }
  if (hasLaw(world, "meeting_47")) {
    // Les réunions s'éternisent : les participants y restent au moins un cycle de plus.
    for (const p of Object.values(world.people)) {
      const room = world.building.rooms?.[p.location];
      if (room?.kind === "meeting" && p.status === "active" && !p.flags.goTo) p.flags = { ...p.flags, goTo: { room: p.location, until: world.cycle + 2, reason: "Loi des 47 Minutes" } };
    }
  }
  const ops = [];
  const fined = [];
  for (const [p, amount, why, rep] of fines) {
    const acct = accountOf("p", p.id);
    if (balance(world, acct) >= amount && !world.accounts[acct].frozen) {
      ops.push({ op: "transfer", from: acct, to: "treasury", amount, reason: `Amende : ${why}` });
      if (rep) ops.push({ op: "person", id: p.id, reputation: rep });
      fined.push(`${p.name} (${why})`);
    }
  }
  if (!ops.length) return;
  cx.commit({
    source: "system",
    kind: "fines",
    allowRepeat: true,
    ops,
    event: fined.length >= 3 ? { kind: "fines", title: `Pluie d'amendes : ${fined.length} contrevenants`, text: `Le Trésor encaisse : ${fined.slice(0, 5).join(", ")}${fined.length > 5 ? "…" : ""}.`, actors: fines.slice(0, 4).map(([p]) => p.id), importance: 2, tags: ["loi"] } : undefined,
  });
}

// Conséquence différée : les perdants d'une loi la contestent au Tribunal.
export function lawFollowup(cx, payload) {
  const { world, rng } = cx;
  const law = world.laws[payload.law];
  if (!law || law.status !== "enacted") return;
  const appeal = LAW_CATALOG[law.code]?.appeal;
  const byGroup = {
    union: "r-colette", lower: "r-colette", order: "r-arlette", truth: "r-ambroise", refectoire: "r-gaspard",
    any: rng.pick(Object.values(world.people).filter((p) => p.status === "active" && p.kind !== "animal" && lawAlignment(world, law, p) < 0))?.id,
  };
  const plaintiff = world.people[byGroup[appeal]];
  if (!plaintiff || plaintiff.id === law.sponsor || plaintiff.status !== "active") return;
  cx.commit({
    source: "system",
    kind: "case_filed",
    ops: [{ op: "case", action: "file", case: { id: worldId(world, "cs"), kind: "law_challenge", plaintiff: plaintiff.id, defendant: law.id, subject: `law:${law.id}`, title: `${plaintiff.name} contre la ${law.title}` } }],
    event: { kind: "case_filed", title: `${plaintiff.name} attaque la ${law.title} devant le Tribunal`, text: `${plaintiff.name} conteste la loi${law.quorumFlaw ? " en invoquant l'absence de plusieurs députés lors du vote" : ""}. Audience à venir devant la juge Hermine Statut.`, actors: [plaintiff.id, law.sponsor], causes: [law.eventId].filter(Boolean), importance: 3, tags: ["justice", "loi"] },
  });
}

// ------------------------------------------------------------------ élections

function election(cx) {
  const { world, rng } = cx;
  const people = Object.values(world.people);
  const candidates = people.filter((p) => canVote(world, p) && p.status === "active" && (world.parliament.seats.includes(p.id) || p.flags.candidate || (p.ambition?.kind === "power" && p.reputation >= 55) || (p.kind === "animal" && p.flags.campaigning)));
  if (candidates.length < SEATS) return;
  const voters = people.filter((p) => canVote(world, p));
  const tally = new Map(candidates.map((c) => [c.id, 0]));
  const recentArticles = world.media.articles.filter((a) => world.cycle - a.cycle < 7 * 48);
  for (const v of voters) {
    let best = null;
    let bestScore = -Infinity;
    for (const c of candidates) {
      let s = c.reputation / 10 + (c.flags.campaign || 0) / 120;
      const rel = cx.relation(v.id, c.id);
      if (rel) s += { ami: 3, bff: 5, couple: 6, crush: 2, rival: -6, ex: -3 }[rel.kind] || 0;
      if (Object.values(world.orgs).some((o) => o.status === "active" && o.members.includes(v.id) && o.members.includes(c.id))) s += 4;
      for (const a of recentArticles) if (a.about?.includes(c.id)) s += a.tone || 0;
      if (v.id === c.id) s += 8;
      s += rng.next() * 3;
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (best) tally.set(best.id, tally.get(best.id) + 1);
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || world.people[b[0]].reputation - world.people[a[0]].reputation);
  const seats = ranked.slice(0, SEATS).map(([id]) => id);
  const before = world.parliament.seats;
  const changed = seats.filter((id) => !before.includes(id));
  const ops = [{ op: "parliament", set: { seats, speaker: seats[0], nextElectionCycle: world.cycle + 7 * 48, lastElection: { cycle: world.cycle, results: ranked.slice(0, 8) } } }];
  for (const id of new Set([...before, ...seats])) {
    const p = world.people[id];
    if (!p) continue;
    ops.push({ op: "person", id, set: { flags: { ...p.flags, deputy: seats.includes(id), candidate: false, campaign: 0 } }, ...(seats.includes(id) && !before.includes(id) ? { career: "Élu au Parlement du Bâtiment", reputation: 5 } : {}), ...(!seats.includes(id) && before.includes(id) ? { career: "Battu aux élections", reputation: -3 } : {}) });
  }
  const speaker = world.people[seats[0]];
  const animalWin = seats.some((id) => world.people[id]?.kind === "animal");
  cx.commit({
    source: "system",
    kind: "election",
    key: `election:${world.cycle}`,
    ops,
    event: {
      kind: "election",
      title: changed.length >= 3 ? `Révolution électorale : ${changed.length} nouveaux députés, ${speaker.name} préside l'Hémicycle` : `Élections : ${speaker.name} arrive en tête`,
      text: `${voters.length} votants. Élus : ${seats.map((id) => `${world.people[id].name} (${tally.get(id)})`).join(", ")}.${changed.length ? ` Nouveaux : ${changed.map((id) => world.people[id].name).join(", ")}.` : " Aucun changement."}${animalWin ? " Un animal siège désormais à l'Hémicycle." : ""}`,
      actors: [...seats, ...before.filter((id) => !seats.includes(id))].slice(0, 7),
      importance: changed.length >= 3 || animalWin ? 5 : 4,
      rare: changed.length >= 3 || animalWin,
      tags: ["politique", "élection"],
    },
    facts: [{ text: `Parlement élu : ${seats.map((id) => world.people[id].name).join(", ")}.`, about: seats, public: true }],
  });
}

// ------------------------------------------------------------------ Tribunal des Couloirs

function tribunal(cx) {
  const { world, rng } = cx;
  const judge = world.people["r-hermine"];
  const docket = Object.values(world.cases).filter((c) => c.status === "filed" && world.cycle - c.filedCycle >= 2).slice(0, 2);
  if (!docket.length) return;
  if (!judge || judge.status !== "active" || !canReachFloor(world, judge, COURT_FLOOR)) {
    cx.commit({ source: "system", kind: "court_delay", key: `courtdelay:${cx.dayKey}`, event: { kind: "court_delay", title: "Audiences reportées : la juge n'a pas pu rejoindre le Tribunal", text: "L'Ascenseur B a refusé de monter au 5e. Les justiciables patientent dans le couloir.", actors: [judge?.id].filter(Boolean), importance: 2, tags: ["justice"] } });
    return;
  }
  for (const c of docket) rule(cx, c, judge, rng);
}

function counsel(cx, personId) {
  // Avoir Sandrine (juriste de ton entreprise) ou un bon négociateur à ses côtés aide.
  const { world } = cx;
  const p = world.people[personId];
  if (!p) return 0;
  const lawyer = Object.values(world.people).find((x) => x.agentId && x.title === "Juriste" && x.status === "active");
  const friendLawyer = lawyer && (lawyer.id === personId || ["ami", "bff", "couple"].includes(cx.relation(personId, lawyer.id)?.kind));
  return (p.skills?.negotiation || 3) / 2 + (friendLawyer ? 3 : 0);
}

function rule(cx, c, judge, rng) {
  const { world } = cx;
  const plaintiff = world.people[c.plaintiff];
  const defendant = world.people[c.defendant];
  let bribed = false;
  // Tentative de corruption (secrète) par une partie riche et rusée.
  const briber = [defendant, plaintiff].find((p) => p && p.skills.cunning >= 7 && balance(world, accountOf("p", p.id)) >= 400 && rng.chance(0.3));
  if (briber) {
    const res = cx.commit({
      source: "agent",
      kind: "bribe",
      ops: [{ op: "transfer", from: accountOf("p", briber.id), to: accountOf("p", judge.id), amount: 200, reason: "Honoraires de conseil", secret: true }],
      facts: [{ kind: "secret", text: `${briber.name} a versé 200 cr à la juge ${judge.name} avant l'audience « ${c.title} ».`, about: [briber.id, judge.id], status: "secret", truth: true, knownBy: [briber.id, judge.id] }],
    });
    bribed = res.ok ? briber.id : false;
  }
  let plaintiffWins;
  let consequence = [];
  let detail = "";
  const ps = counsel(cx, c.plaintiff) + rng.next() * 4;
  const ds = (defendant ? counsel(cx, c.defendant) : 3) + rng.next() * 4;
  if (c.kind === "law_challenge") {
    const law = world.laws[c.defendant];
    plaintiffWins = law?.quorumFlaw ? true : ps > ds + 2;
    if (bribed) plaintiffWins = bribed === c.plaintiff;
    if (plaintiffWins && law) consequence.push({ op: "law", id: law.id, set: { status: "annulled" } });
    detail = plaintiffWins ? `La ${law?.title} est annulée${law?.quorumFlaw ? " pour vice de procédure (quorum)" : ""}.` : `La ${law?.title} est maintenue.`;
  } else if (c.kind === "debt") {
    const loan = world.loans[c.subject.split(":")[1]];
    plaintiffWins = !!loan && loan.status === "defaulted";
    if (bribed === c.defendant) plaintiffWins = false;
    if (plaintiffWins && loan) {
      const seize = Math.min(balance(world, loan.borrower), loan.balance);
      if (seize > 0 && !world.accounts[loan.borrower].frozen) consequence.push({ op: "transfer", from: loan.borrower, to: loan.lender, amount: seize, reason: "Saisie ordonnée par le Tribunal" });
      consequence.push({ op: "loan", id: loan.id, set: { status: "seized", balance: Math.max(0, loan.balance - seize) } });
      detail = `Saisie de ${credits(seize)} au profit de ${ownerName(world, loan.lender)}.`;
      if (loan.borrower.startsWith("c:") && seize < loan.balance) {
        const company = world.companies[loan.borrower.slice(2)];
        const lenderHolder = loan.lender.startsWith("p:") ? loan.lender.slice(2) : loan.lender === "boss" ? "boss" : null;
        const majority = Object.entries(company?.shares || {}).sort((a, b) => b[1] - a[1])[0];
        if (company && lenderHolder && majority && majority[0] !== lenderHolder) {
          const n = Math.min(majority[1], 30);
          consequence.push({ op: "company", id: company.id, action: "shares", from: majority[0], to: lenderHolder, n });
          detail += ` ${n} parts de ${company.name} changent de main.`;
        }
      }
    } else detail = "Le Tribunal déboute le créancier.";
  } else if (c.kind === "identity") {
    const a = world.people[c.plaintiff];
    const b = world.people[c.defendant];
    const sa = (a?.memories.length || 0) + (a?.knows.length || 0) / 4 + rng.next() * 6;
    const sb = (b?.memories.length || 0) + (b?.knows.length || 0) / 4 + rng.next() * 6 + (bribed === c.defendant ? 10 : 0);
    plaintiffWins = sa >= sb;
    const loser = plaintiffWins ? b : a;
    const winner = plaintiffWins ? a : b;
    if (loser && winner) {
      const base = winner.name.replace(/ \(bis\)$/, "");
      consequence.push({ op: "person", id: winner.id, set: { name: base, status: "active", title: winner.title } });
      consequence.push({ op: "person", id: loser.id, set: { name: `${base} (copie certifiée)`, status: "double", title: "Copie certifiée conforme" }, career: "Déclaré copie par le Tribunal" });
      const fortune = balance(world, accountOf("p", loser.id));
      if (fortune > 0) consequence.push({ op: "transfer", from: accountOf("p", loser.id), to: accountOf("p", winner.id), amount: Math.floor(fortune / 2), reason: "Partage de fortune (jugement d'identité)", allowFrozen: true });
      detail = `${winner.name} est reconnu comme l'original. L'autre devient « ${base} (copie certifiée) » et doit rendre la moitié de sa fortune.`;
    }
  } else if (c.kind === "admin_death") {
    const friends = cx.friendsOf(c.plaintiff).length;
    plaintiffWins = friends >= 2 || !!world.flags.auditUntil || bribed === c.plaintiff;
    if (plaintiffWins) {
      consequence.push({ op: "person", id: c.plaintiff, set: { status: "active" }, career: "Ressuscité administrativement par le Tribunal" });
      consequence.push({ op: "account", id: accountOf("p", c.plaintiff), frozen: false });
      detail = `${friends} témoin(s) attestent que ${plaintiff?.name} existe. Le Registre est corrigé.`;
    } else detail = `Faute de témoins, ${plaintiff?.name} reste administrativement mort. Il continue pourtant de venir travailler.`;
  } else if (c.kind === "defamation") {
    const article = world.media.articles.find((a) => a.id === c.subject.split(":")[1]);
    plaintiffWins = article?.accuracy === "false";
    if (plaintiffWins) {
      const gazette = accountOf("c", "gazette");
      const amount = Math.min(150, balance(world, gazette));
      if (amount > 0) consequence.push({ op: "transfer", from: gazette, to: accountOf("p", c.plaintiff), amount, reason: "Dommages et intérêts (diffamation)" });
      consequence.push({ op: "person", id: c.plaintiff, reputation: 6 });
      detail = `L'article était faux : la Gazette paie ${credits(amount)}.`;
    } else {
      consequence.push({ op: "person", id: c.plaintiff, reputation: -4 });
      detail = "L'article n'était pas mensonger. Le plaignant ressort plus abîmé qu'il n'est entré.";
    }
  } else if (c.kind === "embezzlement") {
    const mystery = Object.values(world.mysteries).find((m) => m.status === "solved" && m.truth.suspect === c.defendant);
    plaintiffWins = !!mystery && bribed !== c.defendant;
    if (plaintiffWins && defendant) {
      consequence.push({ op: "person", id: defendant.id, reputation: -15, career: "Condamné pour détournement" });
      const restitution = Math.min(600, balance(world, accountOf("p", defendant.id)));
      if (restitution > 0) consequence.push({ op: "transfer", from: accountOf("p", defendant.id), to: "treasury", amount: restitution, reason: "Restitution ordonnée par le Tribunal" });
      detail = `${defendant.name} est condamné et rembourse ${credits(restitution)} au Trésor.`;
    } else detail = "Relaxe faute de preuves suffisantes.";
  } else {
    plaintiffWins = ps > ds;
    detail = plaintiffWins ? "Le plaignant obtient gain de cause." : "Le plaignant est débouté.";
  }
  const winner = plaintiffWins ? plaintiff : defendant;
  const result = cx.commit({
    source: "system",
    kind: "ruling",
    key: `ruling:${c.id}`,
    ops: [{ op: "case", id: c.id, set: { ruling: plaintiffWins ? "plaintiff" : "defendant", reasoning: detail, bribed: !!bribed } }, ...consequence],
    event: {
      kind: "ruling",
      title: `Jugement : ${c.title}`,
      text: `${judge.name} tranche en faveur ${plaintiffWins ? `de ${plaintiff?.name || "la partie plaignante"}` : `de ${defendant?.name || "la défense"}`}. ${detail}`,
      actors: [c.plaintiff, defendant?.id, judge.id],
      causes: c.eventId ? [c.eventId] : cx.recent((e) => e.kind === "case_filed" && e.actors.includes(c.plaintiff), 200).map((e) => e.id).slice(-1),
      importance: c.kind === "identity" ? 5 : 4,
      rare: c.kind === "identity",
      tags: ["justice"],
    },
    facts: [{ text: `Jugement « ${c.title} » : ${detail}`, about: [c.plaintiff, defendant?.id].filter(Boolean), public: true }],
  });
  if (!result.ok) return;
  if (winner) cx.commit({ source: "system", kind: "verdict_rep", ops: [{ op: "person", id: winner.id, reputation: 3 }] });
  // Une dette jugée sur une entreprise ruinée peut entraîner sa faillite.
  if (c.kind === "debt" && plaintiffWins) {
    const loan = world.loans[c.subject.split(":")[1]];
    const company = loan?.borrower.startsWith("c:") ? world.companies[loan.borrower.slice(2)] : null;
    if (company && balance(world, loan.borrower) < company.dailyCost) bankrupt(cx, company);
  }
}
