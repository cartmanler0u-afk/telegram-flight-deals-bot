// Médias du Bâtiment : La Gazette de l'Ascenseur (sérieuse, possédée en partie par la Banque)
// et Radio Cage d'Escalier (satirique). Un article peut être exact, incomplet, biaisé ou faux ;
// il influence la réputation, rend publiques des rumeurs et peut finir au Tribunal.

import { accountOf } from "./ops.js";
import { knows } from "./memory.js";

export function mediaCycle(cx) {
  if (cx.hour >= 8 && cx.once("gazette")) gazette(cx);
  if (cx.hour >= 19 && cx.once("radio")) radio(cx);
}

function covered(world, eventId) {
  return world.media.articles.some((a) => a.sourceEvent === eventId);
}

// Biais du propriétaire : la Gazette ménage la Banque et ses amis.
function bias(cx, aboutIds) {
  const owners = Object.entries(cx.world.companies.gazette?.shares || {}).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const owner = owners[0];
  if (!owner) return 0;
  if (aboutIds.includes(owner)) return 2;
  if (aboutIds.some((id) => cx.relation(id, owner)?.kind === "rival")) return -2;
  if (aboutIds.some((id) => ["ami", "bff", "couple"].includes(cx.relation(id, owner)?.kind))) return 1;
  return 0;
}

function gazette(cx) {
  const { world, rng } = cx;
  const outlet = world.media.outlets.gazette;
  const journalist = world.people[outlet.journalist];
  if (!journalist || journalist.status !== "active" || world.companies.gazette?.status !== "active") return;

  // 1. Enquête : Félix remonte une trace secrète du grand livre (pots-de-vin, lobbying, n°0…).
  const secrets = Object.values(world.facts).filter((f) => f.status === "secret" && !f.public);
  const known = secrets.filter((f) => knows(world, journalist.id, f.id));
  if (!known.length && secrets.length && rng.chance(0.04 + (journalist.skills.investigation || 5) * 0.01)) {
    const found = rng.pick(secrets);
    cx.commit({ source: "system", kind: "dig", ops: [{ op: "learn", fact: found.id, people: [journalist.id] }] });
    known.push(found);
  }
  if (known.length) {
    const scoop = known[0];
    const tone = -4;
    const ops = [{ op: "learn", fact: scoop.id, people: [], publicize: true }];
    for (const id of scoop.about) if (world.people[id]) ops.push({ op: "person", id, reputation: -12 });
    ops.push({ op: "person", id: journalist.id, reputation: 6 });
    ops.push({ op: "article", article: { outlet: outlet.id, title: `RÉVÉLATIONS : ${scoop.text.slice(0, 90)}`, text: `Documents à l'appui, ${journalist.name} révèle : ${scoop.text}`, about: scoop.about, accuracy: "exact", tone, factIds: [scoop.id], sourceEvent: scoop.source } });
    return cx.commit({
      source: "system",
      kind: "scoop",
      key: `scoop:${scoop.id}`,
      ops,
      event: { kind: "scoop", title: `La Gazette révèle un secret : ${scoop.text.slice(0, 80)}`, text: `${journalist.name} publie l'enquête en une. ${scoop.about.map((id) => world.people[id]?.name).filter(Boolean).join(" et ")} ${scoop.about.length > 1 ? "sont" : "est"} au centre du scandale.`, actors: [journalist.id, ...scoop.about], causes: [scoop.source].filter((id) => id && world.events.some((e) => e.id === id)), importance: 4, tags: ["médias", "scandale"] },
      facts: [{ text: scoop.text, about: scoop.about, public: true }],
    });
  }

  // 2. Couverture du fait marquant des dernières 24 h.
  const recent = world.events.filter((e) => e.public && e.importance >= 3 && world.cycle - e.cycle <= 48 && !covered(world, e.id) && !["scoop", "article"].includes(e.kind));
  const top = recent.sort((a, b) => b.importance - a.importance || b.cycle - a.cycle)[0];
  if (top) {
    const b = bias(cx, top.actors);
    const accuracy = b ? "biased" : top.actors.length > 2 && rng.chance(0.3) ? "incomplete" : "exact";
    const tone = b || (["bankruptcy", "loan_default", "unpaid_wages", "coup_failed", "admin_death"].includes(top.kind) ? -2 : 1);
    return publish(cx, outlet, journalist, { title: top.title, text: `${b > 0 ? "Un succès salué par tous : " : b < 0 ? "Encore un fiasco : " : ""}${top.text}`, about: top.actors.slice(0, 3), accuracy, tone, sourceEvent: top.id }, top);
  }

  // 3. Rumeur publiée sans vérification (faiblesse connue de Félix).
  const rumor = Object.values(world.facts).find((f) => f.status === "rumor" && !f.public && knows(world, journalist.id, f.id));
  if (rumor && rng.chance(0.6)) {
    const accuracy = rumor.truth === true ? "exact" : rumor.truth === false ? "false" : "incomplete";
    const res = publish(cx, outlet, journalist, { title: `Selon nos informations… ${rumor.text.slice(0, 80)}`, text: `${rumor.text} (Information non confirmée.)`, about: rumor.about, accuracy, tone: -2, factIds: [rumor.id] }, null, rumor);
    if (res?.ok && accuracy === "false") {
      const target = rumor.about.map((id) => world.people[id]).find((p) => p && p.status === "active" && p.skills.cunning >= 5);
      if (target) {
        const article = world.media.articles.at(-1);
        cx.commit({ source: "system", kind: "followup", ops: [{ op: "schedule", dueCycle: world.cycle + 6, kind: "file_case", payload: { kind: "defamation", plaintiff: target.id, defendant: journalist.id, subject: `article:${article.id}`, title: `${target.name} contre la Gazette de l'Ascenseur` } }] });
      }
    }
    return res;
  }
  return null;
}

function radio(cx) {
  const { world, rng } = cx;
  const outlet = world.media.outlets.radio;
  const host = world.people[outlet.journalist];
  if (!host || host.status !== "active") return null;
  const recent = world.events.filter((e) => e.public && e.importance >= 2 && world.cycle - e.cycle <= 48 && e.actors.length && !e.kind.startsWith("radio"));
  const target = rng.pick(recent);
  if (!target) return null;
  const victim = world.people[target.actors[0]];
  const joke = rng.pick([
    `« ${target.title} » : on a demandé à l'Ascenseur B, il a refusé de commenter.`,
    `Après « ${target.title} », ${victim?.name || "la personne concernée"} envisage une reconversion dans la plante verte.`,
    `Sondage express au Réfectoire : 64 % des occupants pensent que « ${target.title} » est une métaphore.`,
  ]);
  return publish(cx, outlet, host, { title: `Le billet de ${host.name}`, text: joke, about: victim ? [victim.id] : [], accuracy: "biased", tone: -1, sourceEvent: target.id, satire: true }, target);
}

function publish(cx, outlet, author, article, sourceEvent, rumor = null) {
  const { world } = cx;
  const ops = [{ op: "article", article: { outlet: outlet.id, ...article } }];
  for (const id of article.about || []) if (world.people[id]) ops.push({ op: "person", id, reputation: Math.max(-4, Math.min(3, article.tone)) });
  if (rumor) ops.push({ op: "learn", fact: rumor.id, people: [], publicize: true });
  const readers = Math.max(0, Math.round(10 + outlet.credibility / 4));
  const res = cx.commit({
    source: "system",
    kind: "article",
    ops,
    event: {
      kind: "article",
      title: `${outlet.name} : ${article.title}`.slice(0, 120),
      text: article.text,
      actors: [author.id, ...(article.about || [])].filter((id) => world.people[id]).slice(0, 4),
      causes: [sourceEvent?.id].filter(Boolean),
      importance: article.satire ? 1 : rumor ? 3 : 2,
      tags: ["médias"],
      allowRepeat: true,
    },
    allowRepeat: true,
  });
  if (res.ok && world.companies.gazette?.status === "active") {
    // Ventes au numéro : quelques lecteurs paient 3 cr (argent réel du Bâtiment, pas créé).
    const buyers = Object.values(world.people).filter((p) => p.kind !== "animal" && p.status === "active" && !world.accounts[accountOf("p", p.id)].frozen && world.accounts[accountOf("p", p.id)].balance >= 3).slice(0, readers);
    if (buyers.length) cx.commit({ source: "system", kind: "sales", ops: buyers.map((p) => ({ op: "transfer", from: accountOf("p", p.id), to: accountOf("c", "gazette"), amount: 3, reason: `${outlet.name} du jour` })) });
  }
  return res;
}

