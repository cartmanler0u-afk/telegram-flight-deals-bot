// Arcs narratifs systémiques : des chaînes d'événements qui durent des jours, bifurquent,
// stagnent ou se résolvent selon l'ÉTAT RÉEL du monde (personnes disponibles, argent,
// lois votées, preuves trouvées, témoins réellement présents…).
//
// Le moteur n'écrit pas le scénario : chaque étape vérifie ses conditions, tire au sort,
// choisit ses acteurs parmi ceux qui existent, et applique des conséquences validées.
// Les personnages n'agissent qu'avec ce qu'ils savent ; un arc peut échouer ou être
// récupéré par une autre intrigue (via les intrigues/plots du Directeur).

import { quip, reactions, gag } from "./humor.js";
import { accountOf, balance } from "./ops.js";
import { credits, worldId, clamp } from "./core.js";
import { openPlot } from "./director.js";
import { knows } from "./memory.js";

const DAYC = 48;
const awake = (p) => p && !["gone", "missing"].includes(p.status) && p.status !== "fired";
const say = (cx, id, situation, slots = {}) => {
  const line = quip(cx.world, cx.rng, id, situation, { a: id, ...slots }, { force: true });
  return line ? { who: id, line } : null;
};
const person = (cx, id) => cx.world.people[id];
const pickPerson = (cx, filter) => cx.rng.pick(Object.values(cx.world.people).filter((p) => awake(p) && p.kind !== "animal" && filter(p)));
const goTo = (cx, p, room, cycles, reason) => ({ op: "person", id: p.id, set: { flags: { ...p.flags, goTo: { room, until: cx.world.cycle + cycles, reason } } } });
const feelOp = (from, to, delta, kind = null, note = null) => ({ op: "feel", from, to, delta, kind, note });

// ------------------------------------------------------------------ définitions

export const ARC_DEFS = {
  // 1. La caisse noire : une somme disparaît, la chaîne d'accusations se met en route.
  caisse: {
    title: "L'affaire de la caisse noire",
    tags: ["économie", "scandale", "justice", "politique"],
    p: 0.012,
    start(cx) {
      const firmin = person(cx, "s-firmin");
      const culprit = pickPerson(cx, (p) => ["direction", "logistique", "bourse"].includes(p.dept) && (p.skills.cunning || 0) >= 6 && p.id !== "s-firmin" && !p.flags?.ceo);
      const ceo = Object.values(cx.world.people).find((p) => p.flags?.ceo && awake(p));
      if (!awake(firmin) || !culprit || !ceo || balance(cx.world, "treasury") < 5000) return null;
      return { cast: { firmin: firmin.id, culprit: culprit.id, ceo: ceo.id }, data: { amount: cx.rng.int(15, 35) * 100 } };
    },
    stages: [
      { wait: 0, run(cx, arc) {
        const { firmin, culprit } = arc.cast;
        const amount = arc.data.amount;
        return {
          ops: [{ op: "transfer", from: "treasury", to: accountOf("p", culprit), amount, reason: "Prestation de conseil en synergie (facture n°0042)", secret: true }],
          event: { kind: "arc_caisse", title: `Le service comptable perd ${credits(amount)}`, text: `${person(cx, firmin).name} recompte trois fois : il manque ${credits(amount)} au Trésor. « Ce n'est pas une perte, c'est une disparition », précise-t-il, livide.`, actors: [firmin], room: "f2.finances", importance: 3, tags: ["économie"], dialogue: [say(cx, firmin, "money_loss", { x: credits(amount) })].filter(Boolean) },
          facts: [{ kind: "secret", text: `${person(cx, culprit).name} a encaissé ${credits(amount)} du Trésor via une fausse facture de « conseil en synergie ».`, about: [culprit], status: "secret", truth: true, knownBy: [culprit] }],
        };
      } },
      { wait: 2, chance: 0.4, run(cx, arc) {
        const { firmin, ceo } = arc.cast;
        return {
          ops: [feelOp(firmin, ceo, -20, null, "L'accuse d'avoir vidé la caisse."), { op: "person", id: ceo, reputation: -3 }],
          event: { kind: "arc_caisse", title: `${person(cx, firmin).name} accuse la Direction`, text: `Devant la machine à café, ${person(cx, firmin).name} affirme que « l'argent est monté, pas descendu ». Tout le monde regarde vers le Bureau du PDG.`, actors: [firmin, ceo], room: "f0.cafeteria", importance: 3, tags: ["scandale"], dialogue: [say(cx, firmin, "scandal"), say(cx, ceo, "scandal")].filter(Boolean) },
          facts: [{ kind: "rumor", text: `La Direction aurait vidé la caisse du Trésor.`, about: [ceo], status: "rumor", truth: arc.cast.culprit === ceo, knownBy: [firmin] }],
        };
      } },
      { wait: 3, chance: 0.4, run(cx, arc) {
        const investigator = pickPerson(cx, (p) => p.dept === "tribunal" && /Enquêteur|Expert/.test(p.title)) || pickPerson(cx, (p) => (p.skills.investigation || 0) >= 7);
        if (!investigator) return null;
        arc.cast.investigator = investigator.id;
        return {
          ops: [{ op: "transfer", from: "treasury", to: accountOf("p", investigator.id), amount: 200, reason: "Honoraires d'enquête (affaire de la caisse)" }, goTo(cx, investigator, "f2.finances", 8, "Enquête sur la caisse noire")],
          event: { kind: "arc_caisse", title: `La Direction engage ${investigator.name} pour enquêter`, text: `Mission : retrouver ${credits(arc.data.amount)}. Moyens : un carnet, une loupe, et l'accès au Bureau financier « sauf le tiroir du bas ».`, actors: [investigator.id, arc.cast.ceo], room: "f2.finances", importance: 3, tags: ["justice", "enquête"] },
        };
      } },
      { wait: 4, chance: 0.35, run(cx, arc) {
        const inv = person(cx, arc.cast.investigator);
        if (!awake(inv)) return null;
        const found = cx.rng.chance(0.35 + (inv.skills.investigation || 5) * 0.06);
        const scapegoat = found ? null : pickPerson(cx, (p) => p.dept === "direction" && p.id !== arc.cast.culprit && p.id !== arc.cast.firmin);
        arc.data.lead = found ? arc.cast.culprit : scapegoat?.id;
        if (!arc.data.lead) return null;
        return {
          ops: [{ op: "person", id: inv.id, reputation: 3 }],
          event: { kind: "arc_caisse", title: `${inv.name} découvre une fausse facture`, text: `Facture n°0042 : « conseil en synergie », ${credits(arc.data.amount)}, signée d'initiales. Selon ${inv.name}, elles désignent ${person(cx, arc.data.lead).name}.${found ? "" : " (Les initiales sont… ambiguës.)"}`, actors: [inv.id, arc.data.lead], room: "f2.finances", importance: 4, tags: ["enquête", "preuve"] },
          facts: [{ kind: "clue", text: `Une fausse facture de « conseil en synergie » de ${credits(arc.data.amount)} désignerait ${person(cx, arc.data.lead).name}.`, about: [arc.data.lead], status: "secret", truth: found, knownBy: [inv.id] }],
        };
      } },
      { wait: 2, chance: 0.5, run(cx, arc) {
        const culprit = person(cx, arc.cast.culprit);
        const guarded = cx.rng.chance(0.4 + (person(cx, "s-rodrigue") ? 0.2 : 0));
        arc.data.evidence = guarded ? "sauvée" : "détruite";
        return {
          ops: [{ op: "object", action: "create", object: { id: `o-facture-${arc.id}`, name: "La facture n°0042", room: "f9.scelles", state: arc.data.evidence, desc: "La fausse facture de « conseil en synergie ». Pièce à conviction." } }, { op: "move", id: culprit.id, to: "f9.attente", force: true, activity: { kind: "secret", label: "rôde près de la salle des pièces à conviction" } }],
          event: { kind: "arc_caisse", title: guarded ? "Quelqu'un tente de faire disparaître la facture — sans succès" : "La facture n°0042 disparaît des pièces à conviction", text: guarded ? `Rodrigue Cadenas surprend une silhouette près des scellés. La facture est sauvée ; la silhouette, elle, court vite.` : `Le carton des scellés est vide. Le Tribunal parle d'« égarement administratif ».`, actors: [culprit.id, "s-rodrigue"].filter((id) => person(cx, id)), room: "f9.scelles", importance: 3, public: guarded, tags: ["preuve", "justice"] },
        };
      } },
      { wait: 2, chance: 0.4, run(cx, arc) {
        const journalist = person(cx, "r-felix") && awake(person(cx, "r-felix")) ? person(cx, "r-felix") : person(cx, "s-odile");
        if (!awake(journalist)) return null;
        return {
          ops: [{ op: "article", article: { outlet: "gazette", title: `Caisse noire : ${credits(arc.data.amount)} évaporés au Trésor`, text: `Selon nos informations, une facture de « conseil en synergie » serait au cœur de l'affaire. La Direction refuse de commenter. La Directrice financière refuse de commenter le refus.`, about: [arc.cast.ceo], accuracy: "incomplete", tone: -3 } }, { op: "person", id: arc.cast.ceo, reputation: -4 }, { op: "person", id: journalist.id, reputation: 4 }],
          event: { kind: "arc_caisse", title: `${journalist.name} révèle une partie de l'affaire dans la Gazette`, text: `La Gazette titre sur la caisse noire. Il manque encore le nom. Il manque toujours le nom.`, actors: [journalist.id, arc.cast.ceo], room: "f4.redaction", importance: 4, tags: ["médias", "scandale"], dialogue: [say(cx, journalist.id, "scandal")].filter(Boolean) },
        };
      } },
      { wait: 1, chance: 0.5, run(cx, arc) {
        const target = person(cx, arc.data.lead || arc.cast.ceo);
        const witnesses = (cx.occupancy?.["f0.cafeteria"] || []).filter((p) => p.kind !== "animal").map((p) => p.id).slice(0, 5);
        return {
          ops: [{ op: "person", id: target.id, reputation: -5 }],
          event: { kind: "arc_caisse", title: `La rumeur éclate à la Cafétéria : « c'est ${target.name} »`, text: `Entre deux plateaux-repas, le nom circule. ${witnesses.length} personnes l'entendent, quarante le répètent.`, actors: [target.id, ...witnesses.slice(0, 2)], room: "f0.cafeteria", importance: 3, tags: ["rumeur"], dialogue: reactions(cx.world, cx.rng, "rumor", { actors: [target.id], witnesses }, 2) },
          facts: [{ kind: "rumor", text: `${target.name} aurait détourné ${credits(arc.data.amount)} du Trésor.`, about: [target.id], status: "rumor", truth: target.id === arc.cast.culprit, knownBy: witnesses }],
        };
      } },
      { wait: 2, chance: 0.5, run(cx, arc) {
        const ceo = person(cx, arc.cast.ceo);
        const announce = cx.rng.pick(["la Semaine de la Gratitude Obligatoire", "un séminaire sur « l'audace de ne rien changer »", "le remplacement des chaises par des ballons de yoga", "un nouveau logo, plus vertical"]);
        return {
          ops: [{ op: "building", mood: -2 }, { op: "person", id: ceo.id, reputation: -1 }],
          event: { kind: "arc_caisse", title: `${ceo.name} détourne l'attention : il annonce ${announce}`, text: `Conférence de presse improvisée dans le Hall. Aucune question sur la caisse n'est autorisée. Trois questions sur la caisse sont posées.`, actors: [ceo.id], room: "f0.hall", importance: 3, tags: ["direction", "satire"], dialogue: [say(cx, ceo.id, "generic")].filter(Boolean) },
        };
      } },
      { wait: 3, chance: 0.5, run(cx, arc) {
        const deputy = cx.rng.pick(cx.world.parliament.seats.map((id) => person(cx, id)).filter(awake));
        if (!deputy || Object.values(cx.world.laws).some((l) => l.code === "spending_cap" && ["proposed", "enacted"].includes(l.status))) return { skip: true };
        const law = { id: worldId(cx.world, "lw"), code: "spending_cap", title: "Loi du Plafond de Dépense", text: "Toute dépense de plus de 1 000 cr de la Direction doit être votée par l'Hémicycle.", sponsor: deputy.id };
        return {
          ops: [{ op: "law", action: "propose", law }],
          event: { kind: "law_proposed", title: `Proposition de loi : ${law.title}`, text: `En pleine affaire de la caisse noire, ${deputy.name} dépose un texte pour encadrer les dépenses de la Direction.`, actors: [deputy.id], room: "f6.hemicycle", importance: 3, tags: ["politique", "loi"] },
        };
      } },
      { wait: 2, chance: 0.5, run(cx, arc) {
        const firmin = person(cx, arc.cast.firmin);
        const allies = Object.values(cx.world.people).filter((p) => awake(p) && p.kind !== "animal" && (p.ambition?.kind === "protect" || p.ambition?.kind === "truth") && p.id !== firmin.id).slice(0, 5);
        const id = `o-transparence-${arc.id}`;
        return {
          ops: [{ op: "org", action: "create", org: { id, name: "L'Alliance pour la Transparence des Agrafes", kind: "movement", leader: firmin.id, members: [firmin.id, ...allies.map((p) => p.id)], goal: "Faire voter le Plafond de Dépense et retrouver la caisse.", stance: { order: 1, upper: -1 } } }],
          event: { kind: "arc_caisse", title: "Une alliance se forme autour de la caisse noire", text: `${firmin.name} fédère ${allies.length} personnes. Leur logo : une agrafe, fermée. Leur slogan : « Rendez l'argent (fictif) ».`, actors: [firmin.id, ...allies.slice(0, 3).map((p) => p.id)], room: "f6.lobby", importance: 3, tags: ["politique", "organisation"] },
        };
      } },
      { wait: 4, chance: 0.4, run(cx, arc) {
        const accused = person(cx, arc.data.lead || arc.cast.culprit);
        const truth = accused.id === arc.cast.culprit;
        const proof = arc.data.evidence === "sauvée";
        const convicted = proof || cx.rng.chance(0.3);
        const ops = [{ op: "person", id: accused.id, reputation: convicted ? -12 : 3, career: convicted ? "Condamné dans l'affaire de la caisse noire" : "Relaxé dans l'affaire de la caisse noire" }];
        if (convicted && truth) {
          const refund = Math.min(arc.data.amount, balance(cx.world, accountOf("p", accused.id)));
          if (refund > 0) ops.push({ op: "transfer", from: accountOf("p", accused.id), to: "treasury", amount: refund, reason: "Restitution (affaire de la caisse noire)" });
        }
        return {
          ops,
          event: { kind: "arc_caisse", title: convicted ? `Verdict : ${accused.name} condamné dans l'affaire de la caisse noire` : `Verdict : ${accused.name} relaxé faute de preuves`, text: `${proof ? "La facture n°0042 a fait la différence." : "La facture ayant disparu, le Tribunal juge sur la foi des témoignages."} ${convicted && !truth ? "Un détail dérange : la vraie signature n'est peut-être pas la sienne." : ""}`, actors: [accused.id, "r-hermine"].filter((id) => person(cx, id)), room: "f9.audience", importance: 4, tags: ["justice", "verdict"], dialogue: [say(cx, accused.id, "trial")].filter(Boolean) },
          end: convicted && truth ? "resolved" : "failed",
          facts: convicted && !truth ? [{ kind: "rumor", text: `${accused.name} aurait été condamné à la place du vrai coupable de la caisse noire.`, about: [accused.id], status: "rumor", truth: true, knownBy: [arc.cast.investigator, arc.cast.culprit].filter(Boolean) }] : [],
        };
      } },
    ],
  },

  // 2. Le portrait : le PDG dépense une fortune dans un portrait de lui-même.
  portrait: {
    title: "Le portrait du PDG",
    tags: ["direction", "satire", "économie", "justice"],
    p: 0.01,
    start(cx) {
      const ceo = Object.values(cx.world.people).find((p) => p.flags?.ceo && awake(p));
      const artist = pickPerson(cx, (p) => p.traits?.includes("artist") || p.archetype === "artiste");
      if (!ceo || !artist || cx.world.objects["o-portrait"] || balance(cx.world, "treasury") < 12000) return null;
      if (Object.values(cx.world.laws).some((l) => l.code === "spending_cap" && l.status === "enacted")) return null; // la loi empêche réellement la dépense
      return { cast: { ceo: ceo.id, artist: artist.id, cfo: "s-agathe", accountant: "s-firmin" }, data: { amount: cx.rng.int(60, 90) * 100 } };
    },
    stages: [
      { wait: 0, run(cx, arc) {
        const { ceo, artist } = arc.cast;
        return {
          ops: [{ op: "transfer", from: "treasury", to: accountOf("p", artist), amount: arc.data.amount, reason: "Commande : portrait officiel du PDG (format « monumental »)" }, { op: "object", action: "create", object: { id: "o-portrait", name: "Le portrait géant du PDG", room: "f2.couloir", state: "accroché", value: arc.data.amount, desc: `Trois mètres de haut. ${person(cx, ceo).name} y pose en armure, sur un cheval, devant un tableur.` } }],
          event: { kind: "arc_portrait", title: `${person(cx, ceo).name} dépense ${credits(arc.data.amount)} dans un portrait géant de lui-même`, text: `Le budget du trimestre est devenu une toile de trois mètres. ${person(cx, arc.cast.cfo)?.name || "La directrice financière"} refuse de commenter le portrait.`, actors: [ceo, artist, arc.cast.cfo].filter((id) => person(cx, id)), room: "f2.couloir", importance: 4, tags: ["direction", "satire"], dialogue: [person(cx, arc.cast.accountant) && { who: arc.cast.accountant, line: "« Bonne nouvelle : le portrait est un actif immobilisé. Mauvaise nouvelle : il prend plus de valeur comptable que l'entreprise. »" }].filter(Boolean) },
        };
      } },
      { wait: 2, chance: 0.5, run(cx, arc) {
        gag(cx.world, "portrait", arc.cast.ceo);
        return {
          ops: [{ op: "article", article: { outlet: "gazette", title: "L'entreprise investit massivement dans son principal produit : son directeur général", text: "La toile, estimée à " + credits(arc.data.amount) + ", représente le PDG en armure. Le cheval n'a pas été consulté.", about: [arc.cast.ceo], accuracy: "exact", tone: -3 } }, { op: "person", id: arc.cast.ceo, reputation: -4 }],
          event: { kind: "arc_portrait", title: "La Gazette : « L'entreprise investit massivement dans son principal produit : son directeur général »", text: "Le numéro s'arrache. Quelqu'un l'a affiché sous le portrait.", actors: [arc.cast.ceo, "s-odile"].filter((id) => person(cx, id)), room: "f4.redaction", importance: 3, tags: ["médias", "satire"] },
        };
      } },
      { wait: 2, chance: 0.4, run(cx, arc) {
        const ceo = person(cx, arc.cast.ceo);
        const attendees = (cx.occupancy?.["f2.reunionA"] || []).filter((p) => p.kind !== "animal").map((p) => p.id).slice(0, 4);
        return {
          ops: [goTo(cx, ceo, "f2.reunionA", 3, "Défendre le portrait"), { op: "person", id: ceo.id, reputation: -1 }],
          event: { kind: "arc_portrait", title: `${ceo.name} défend son portrait en réunion`, text: `« Ce n'est pas un portrait, c'est une vision. » La présentation dure 47 minutes et comporte 22 diapositives sur le cheval.`, actors: [ceo.id, ...attendees.slice(0, 2)], room: "f2.reunionA", importance: 3, tags: ["réunion", "satire"], dialogue: [say(cx, ceo.id, "meeting"), ...reactions(cx.world, cx.rng, "portrait", { witnesses: attendees }, 1)].filter(Boolean) },
        };
      } },
      { wait: 6, chance: 0.3, run(cx, arc) {
        const party = cx.rng.pick(Object.values(cx.world.orgs).filter((o) => o.status === "active" && ["party", "union", "movement"].includes(o.kind)));
        if (!party) return { skip: true };
        gag(cx.world, "portrait", arc.cast.ceo);
        return {
          ops: [{ op: "org", id: party.id, action: "set", set: { goal: `${party.goal} Et décrocher le portrait.` }, reputation: 3 }],
          event: { kind: "arc_portrait", title: `Le portrait devient un symbole politique : ${party.name} en fait son affiche`, text: `Sur les tracts : le portrait, barré d'une agrafe. Slogan : « Pas avec notre budget ».`, actors: [party.leader], room: "f6.partis", importance: 3, tags: ["politique", "gag"] },
        };
      } },
      { wait: 4, chance: 0.3, run(cx, arc) {
        const vandal = pickPerson(cx, (p) => (p.traits?.includes("impulsive") || p.archetype === "rebelle" || p.archetype === "artiste") && p.id !== arc.cast.artist);
        if (!vandal) return null;
        arc.cast.vandal = vandal.id;
        return {
          ops: [{ op: "object", id: "o-portrait", set: { state: "vandalisé (moustache au feutre)" }, note: "Une moustache est apparue pendant la nuit." }],
          event: { kind: "arc_portrait", title: "Le portrait du PDG est vandalisé pendant la nuit", text: `Une moustache en guidon de vélo, au feutre indélébile. Le cheval, lui, a été épargné.`, actors: [arc.cast.ceo], room: "f2.couloir", importance: 3, tags: ["vandalisme", "gag"] },
          facts: [{ kind: "secret", text: `${vandal.name} a dessiné la moustache sur le portrait du PDG.`, about: [vandal.id], status: "secret", truth: true, knownBy: [vandal.id] }],
        };
      } },
      { wait: 3, chance: 0.4, run(cx, arc) {
        if (cx.world.companies.banque?.status !== "active") return { skip: true };
        const premium = Math.min(400, balance(cx.world, "treasury"));
        return {
          ops: [{ op: "transfer", from: "treasury", to: accountOf("c", "banque"), amount: premium, reason: "Assurance « œuvre d'art » du portrait du PDG" }, { op: "object", id: "o-portrait", set: { state: "assuré (et toujours moustachu)" }, note: "Assuré par la Banque." }],
          event: { kind: "arc_portrait", title: "La Banque assure le portrait… après le vandalisme", text: `Prime : ${credits(premium)}. Octave Lingot précise que la moustache n'est pas couverte.`, actors: [arc.cast.ceo, "r-octave"].filter((id) => person(cx, id)), room: "f3.banque", importance: 3, tags: ["économie", "gag"] },
        };
      } },
      { wait: 4, chance: 0.4, run(cx, arc) {
        const suspect = person(cx, arc.cast.vandal);
        const judge = person(cx, "r-hermine");
        if (!suspect || !judge) return { end: "resolved" };
        const proven = knows(cx.world, "s-rodrigue", Object.values(cx.world.facts).find((f) => f.about.includes(suspect.id) && f.text.includes("moustache"))?.id) || cx.rng.chance(0.45);
        return {
          ops: [{ op: "person", id: suspect.id, reputation: proven ? -6 : 2, career: proven ? "Condamné pour la moustache du portrait" : "Relaxé dans l'affaire de la moustache" }],
          event: { kind: "arc_portrait", title: proven ? `${suspect.name} condamné(e) pour la moustache du portrait` : `Procès de la moustache : ${suspect.name} relaxé(e)`, text: proven ? `Peine : repeindre le portrait. Le cheval comprend.` : `Faute de preuves, la moustache reste. Elle a désormais son propre compte de fans.`, actors: [suspect.id, judge.id, arc.cast.ceo], room: "f9.audience", importance: 4, tags: ["justice", "gag"], dialogue: [say(cx, suspect.id, "trial")].filter(Boolean) },
          end: "resolved",
        };
      } },
    ],
  },

  // 3. Le syndicat des pigeons : licenciement, indignation, et un pigeon en politique.
  pigeons: {
    title: "Le syndicat des pigeons",
    tags: ["politique", "pigeon", "travail", "rh"],
    p: 0.01,
    start(cx) {
      const pigeon = person(cx, "s-roucoulade");
      const founder = pickPerson(cx, (p) => ["militant", "rebelle", "optimiste"].includes(p.archetype) && p.kind === "resident" && p.employer);
      const drh = person(cx, "s-mireille");
      if (!pigeon || !founder || !awake(drh) || cx.world.orgs["o-pigeons"]) return null;
      return { cast: { pigeon: pigeon.id, founder: founder.id, drh: drh.id }, data: {} };
    },
    stages: [
      { wait: 0, run(cx, arc) {
        const { founder, pigeon } = arc.cast;
        return {
          ops: [{ op: "org", action: "create", org: { id: "o-pigeons", name: "Syndicat des Pigeons du Hall", kind: "union", leader: founder, members: [founder, pigeon], goal: "Des miettes pour tous et un perchoir à l'Hémicycle.", stance: { order: -1, upper: -1 } } }],
          event: { kind: "arc_pigeons", title: `${person(cx, founder).name} fonde le Syndicat des Pigeons du Hall`, text: `Adhérents : deux. Dont un pigeon. Cotisation : une miette par mois.`, actors: [founder, pigeon], room: "f0.hall", importance: 3, tags: ["organisation", "pigeon"], dialogue: [say(cx, founder, "pigeon")].filter(Boolean) },
        };
      } },
      { wait: 2, chance: 0.4, run(cx, arc) {
        const founder = person(cx, arc.cast.founder);
        return {
          ops: [{ op: "person", id: founder.id, set: { employer: null, salary: 0, title: "Ex-employé (syndicaliste aviaire)" }, career: "Licencié pour avoir créé un syndicat de pigeons" }, feelOp(founder.id, arc.cast.drh, -40, null, "M'a licencié pour un syndicat de pigeons.")],
          event: { kind: "arc_pigeons", title: `${founder.name} est licencié pour avoir créé un syndicat de pigeons`, text: `Entretien de six minutes avec Mireille Vautrin. Motif : « confusion entre représentation du personnel et ornithologie ».`, actors: [founder.id, arc.cast.drh], room: "f1.drh", importance: 4, tags: ["rh", "licenciement"], dialogue: [say(cx, arc.cast.drh, "firing", { b: founder.id }), say(cx, founder.id, "firing")].filter(Boolean) },
        };
      } },
      { wait: 2, chance: 0.4, run(cx, arc) {
        const pigeon = person(cx, arc.cast.pigeon);
        const supporters = Object.values(cx.world.people).filter((p) => awake(p) && p.kind !== "animal" && (p.ambition?.kind === "protect" || p.traits?.includes("kind"))).slice(0, 8);
        const line = gag(cx.world, "pigeon", pigeon.id);
        return {
          ops: [{ op: "person", id: pigeon.id, reputation: 6, set: { flags: { ...pigeon.flags, campaigning: true } } }, ...supporters.slice(0, 6).map((p) => ({ op: "org", id: "o-pigeons", action: "join", person: p.id }))],
          event: { kind: "arc_pigeons", title: "Indignation : Roucoulade devient un symbole", text: `${supporters.length} personnes rejoignent le Syndicat des Pigeons. ${line}`, actors: [pigeon.id, ...supporters.slice(0, 2).map((p) => p.id)], room: "f0.hall", importance: 3, tags: ["pigeon", "politique"] },
        };
      } },
      { wait: 3, chance: 0.4, run(cx, arc) {
        const deputy = cx.rng.pick(cx.world.parliament.seats.map((id) => person(cx, id)).filter((p) => awake(p) && p.ambition?.kind !== "power")) || cx.rng.pick(cx.world.parliament.seats.map((id) => person(cx, id)).filter(awake));
        if (!deputy || Object.values(cx.world.laws).some((l) => l.code === "pigeon_vote" && ["proposed", "enacted"].includes(l.status))) return { skip: true };
        const law = { id: worldId(cx.world, "lw"), code: "pigeon_vote", title: "Loi Roucoulade", text: "Le pigeon du Hall obtient un droit de vote.", sponsor: deputy.id };
        return {
          ops: [{ op: "law", action: "propose", law }],
          event: { kind: "law_proposed", title: "Proposition de loi : le pigeon du Hall obtient un droit de vote", text: `${deputy.name} dépose la Loi Roucoulade « par souci de cohérence démocratique ».`, actors: [deputy.id, arc.cast.pigeon], room: "f6.hemicycle", importance: 3, tags: ["politique", "loi", "pigeon"] },
        };
      } },
      { wait: 6, chance: 0.3, run(cx, arc) {
        const law = Object.values(cx.world.laws).find((l) => l.code === "pigeon_vote");
        if (!law || law.status === "proposed") return null;
        const pigeon = person(cx, arc.cast.pigeon);
        const won = law.status === "enacted";
        return {
          ops: [{ op: "person", id: pigeon.id, reputation: won ? 10 : -2, set: { flags: { ...pigeon.flags, candidate: won, campaigning: won } }, career: won ? "Obtient le droit de vote" : "Débouté par l'Hémicycle" }],
          event: { kind: "arc_pigeons", title: won ? "Roucoulade vote pour la première fois — et se présente aux élections" : "L'Hémicycle refuse le vote au pigeon", text: won ? "Il a déposé une plume dans l'urne. Le dépouillement a été long." : "Le Syndicat des Pigeons annonce un recours, déposé en miettes.", actors: [pigeon.id, arc.cast.founder], room: "f6.hemicycle", importance: 4, rare: won, tags: ["politique", "pigeon"] },
          end: won ? "resolved" : "failed",
        };
      } },
    ],
  },

  // 4. Les colis fantômes : un logisticien trop curieux découvre la salle secrète.
  colis: {
    title: "Les colis fantômes",
    tags: ["logistique", "mystère", "scandale", "justice"],
    p: 0.012,
    start(cx) {
      const ludo = person(cx, "s-ludovic");
      const curious = pickPerson(cx, (p) => p.dept === "logistique" && p.id !== "s-ludovic" && (p.skills.investigation || 0) >= 4);
      const vanished = Object.values(cx.world.objects).filter((o) => o.id.startsWith("o-colis-") && o.state === "disparu");
      if (!awake(ludo) || !curious || !vanished.length) return null;
      return { cast: { ludo: ludo.id, curious: curious.id }, data: { count: vanished.length } };
    },
    stages: [
      { wait: 0, run(cx, arc) {
        const curious = person(cx, arc.cast.curious);
        return {
          ops: [goTo(cx, curious, "fm1.bureau", 3, "Suit Ludovic")],
          event: { kind: "arc_colis", title: `${curious.name} commence à suivre Ludovic Palette`, text: `${arc.data.count} colis disparus, et toujours la même réponse : « en cours d'acheminement ». ${curious.name} décide de voir où ils s'acheminent.`, actors: [curious.id, arc.cast.ludo], room: "fm1.quai", importance: 3, tags: ["logistique", "enquête"] },
        };
      } },
      { wait: 2, chance: 0.45, run(cx, arc) {
        const curious = person(cx, arc.cast.curious);
        const secret = Object.values(cx.world.facts).find((f) => f.status === "secret" && f.about.includes(arc.cast.ludo) && f.text.includes("salle secrète"));
        return {
          ops: [{ op: "person", id: curious.id, set: { flags: { ...curious.flags, knowsRoom: [...(curious.flags.knowsRoom || []), "fm1.secrete", "fm1.marche"] } } }, { op: "move", id: curious.id, to: "fm1.secrete", force: true, activity: { kind: "secret", label: "contemple des étagères pleines de colis disparus" } }, ...(secret ? [{ op: "learn", fact: secret.id, people: [curious.id] }] : [])],
          event: { kind: "arc_colis", title: `${curious.name} découvre une salle secrète derrière le bureau logistique`, text: `Une pièce absente de tous les plans. Des colis, soigneusement rangés par ordre alphabétique d'expéditeur. Une plante. Un fauteuil.`, actors: [curious.id], room: "fm1.secrete", importance: 4, public: false, tags: ["secret", "logistique"] },
        };
      } },
      { wait: 1, chance: 0.5, run(cx, arc) {
        const curious = person(cx, arc.cast.curious);
        const ludo = person(cx, arc.cast.ludo);
        const greedy = curious.traits?.includes("opportunist") || curious.ambition?.kind === "wealth";
        arc.data.branch = greedy ? "chantage" : "révélation";
        if (greedy) {
          const amount = Math.min(300, balance(cx.world, accountOf("p", ludo.id)));
          if (amount <= 0) return { skip: true };
          return {
            ops: [{ op: "transfer", from: accountOf("p", ludo.id), to: accountOf("p", curious.id), amount, reason: "« Prime de discrétion »", secret: true }, feelOp(ludo.id, curious.id, -40, null, "Me fait chanter.")],
            event: { kind: "arc_colis", title: "Un arrangement discret au sous-sol", text: `${curious.name} et Ludovic Palette ont une longue conversation. Personne ne sait ce qui s'est dit. ${curious.name} s'achète un nouveau stylo, très cher.`, actors: [curious.id, ludo.id], room: "fm1.bureau", importance: 3, public: false, tags: ["secret", "chantage"] },
            facts: [{ kind: "secret", text: `${curious.name} fait chanter Ludovic Palette au sujet de la salle secrète.`, about: [curious.id, ludo.id], status: "secret", truth: true, knownBy: [curious.id, ludo.id] }],
          };
        }
        const journalist = person(cx, "r-felix") || person(cx, "s-odile");
        const secret = Object.values(cx.world.facts).find((f) => f.status === "secret" && f.about.includes(ludo.id) && f.text.includes("salle secrète"));
        return {
          ops: [...(secret && journalist ? [{ op: "learn", fact: secret.id, people: [journalist.id] }] : []), feelOp(ludo.id, curious.id, -30)],
          event: { kind: "arc_colis", title: `${curious.name} confie sa découverte à la Gazette`, text: `Rendez-vous à la buanderie de l'Hôtel, entre deux machines. ${journalist?.name || "La Gazette"} prend des notes, et des photos des chaussettes orphelines pour l'ambiance.`, actors: [curious.id, journalist?.id], room: "f8.buanderie", importance: 3, public: false, tags: ["médias", "secret"] },
        };
      } },
      { wait: 3, chance: 0.4, run(cx, arc) {
        const ludo = person(cx, arc.cast.ludo);
        const raid = arc.data.branch === "révélation" || cx.rng.chance(0.3);
        if (!raid) return { end: "dormant" };
        const parcels = Object.values(cx.world.objects).filter((o) => o.room === "fm1.secrete");
        return {
          ops: [{ op: "room", id: "fm1.secrete", set: { discovered: true } }, { op: "room", id: "fm1.marche", set: { discovered: true } }, ...parcels.map((o) => ({ op: "object", id: o.id, set: { room: "f9.scelles", state: "saisi" }, note: "Saisi lors de la descente au sous-sol." })), { op: "person", id: ludo.id, reputation: -15, set: { title: "Responsable logistique (suspendu)" }, career: "Suspendu après la découverte de la salle secrète" }],
          event: { kind: "arc_colis", title: "Descente au sous-sol : la salle secrète et le marché noir sont découverts", text: `Rodrigue Cadenas mène l'opération. ${parcels.length} colis saisis, un marché noir de fournitures démantelé, et Ludovic Palette suspendu. Il affirme que tout était « en cours d'acheminement ».`, actors: [ludo.id, "s-rodrigue", arc.cast.curious].filter((id) => person(cx, id)), room: "fm1.secrete", importance: 4, rare: true, tags: ["scandale", "logistique"], dialogue: [say(cx, ludo.id, "scandal")].filter(Boolean) },
          facts: [{ text: "La salle secrète de l'entrepôt contenait les colis disparus.", about: [ludo.id], public: true }],
          end: "resolved",
        };
      } },
    ],
  },

  // 5. Le séminaire de confiance (pendant que l'équipe RH prépare le renversement de la DRH).
  seminaire: {
    title: "Le séminaire de confiance",
    tags: ["rh", "pouvoir", "organisation"],
    p: 0.01,
    start(cx) {
      const drh = person(cx, "s-mireille");
      const team = Object.values(cx.world.people).filter((p) => awake(p) && p.dept === "rh" && p.id !== "s-mireille" && p.kind !== "animal");
      if (!awake(drh) || team.length < 3) return null;
      const plotter = team.sort((a, b) => (b.skills.cunning || 0) - (a.skills.cunning || 0))[0];
      return { cast: { drh: drh.id, plotter: plotter.id }, data: { team: team.slice(0, 8).map((p) => p.id) } };
    },
    stages: [
      { wait: 0, run(cx, arc) {
        return {
          ops: arc.data.team.map((id) => goTo(cx, person(cx, id), "f1.seminaire", 3, "Séminaire de confiance")),
          event: { kind: "arc_seminaire", title: "La DRH organise un séminaire sur la confiance", text: `Mireille Vautrin convoque tout le service : « La confiance, c'est comme une scène de crime : il faut la reconstituer. »`, actors: [arc.cast.drh, ...arc.data.team.slice(0, 3)], room: "f1.seminaire", importance: 3, tags: ["rh", "réunion"], dialogue: [say(cx, arc.cast.drh, "meeting")].filter(Boolean) },
        };
      } },
      { wait: 1, chance: 0.5, run(cx, arc) {
        const plotter = person(cx, arc.cast.plotter);
        const conspirators = arc.data.team.filter((id) => id !== plotter.id).slice(0, 4);
        return {
          ops: [{ op: "org", action: "create", org: { id: `o-confiance-${arc.id}`, name: "Le Comité de la Confiance Réelle", kind: "secret", leader: plotter.id, members: [plotter.id, ...conspirators], goal: "Renverser la DRH (avec bienveillance).", stance: { order: -1, upper: 0 }, secret: true } }],
          event: { kind: "arc_seminaire", title: "Pendant l'exercice de la chute arrière, un complot se forme", text: `Pendant que chacun se laisse tomber en arrière, ${plotter.name} rattrape surtout des alliés.`, actors: [plotter.id, ...conspirators.slice(0, 2)], room: "f1.seminaire", importance: 3, public: false, tags: ["complot", "rh"] },
          facts: [{ kind: "secret", text: `${plotter.name} prépare le renversement de Mireille Vautrin avec une partie du service RH.`, about: [plotter.id, arc.cast.drh], status: "secret", truth: true, knownBy: [plotter.id, ...conspirators] }],
        };
      } },
      { wait: 4, chance: 0.4, run(cx, arc) {
        const drh = person(cx, arc.cast.drh);
        const plotter = person(cx, arc.cast.plotter);
        const discovered = Object.values(cx.world.facts).some((f) => f.text.includes("renversement de Mireille") && knows(cx.world, drh.id, f.id)) || cx.rng.chance((drh.skills.investigation || 5) / 14);
        if (discovered) {
          return {
            ops: [{ op: "person", id: plotter.id, set: { title: "Chargé des archives des évaluations (sous-sol)", workRoom: "fm1.objets" }, career: "Muté aux Objets trouvés après un complot éventé", reputation: -6 }, feelOp(drh.id, plotter.id, -50, null, "A tenté de me renverser.")],
            event: { kind: "arc_seminaire", title: `Complot éventé : la DRH mute ${plotter.name} aux Objets trouvés`, text: `« Je savais. Je sais toujours. » Mireille Vautrin raye un nom sur son mur de liège.`, actors: [drh.id, plotter.id], room: "f1.drh", importance: 4, tags: ["rh", "pouvoir"], dialogue: [say(cx, drh.id, "firing", { b: plotter.id })].filter(Boolean) },
            end: "failed",
          };
        }
        return {
          ops: [{ op: "person", id: drh.id, set: { title: "DRH « en transition »" }, career: "Mise en minorité par son propre service", reputation: -10 }, { op: "person", id: plotter.id, set: { title: "DRH par intérim" }, career: "Prend la tête des RH après un vote de défiance", reputation: 8 }],
          event: { kind: "arc_seminaire", title: `Vote de défiance aux RH : ${plotter.name} remplace Mireille Vautrin`, text: `Le séminaire sur la confiance s'achève par un vote à main levée. Mireille Vautrin note que « les mains levées ne mentent jamais ».`, actors: [plotter.id, drh.id], room: "f1.seminaire", importance: 4, rare: true, tags: ["rh", "pouvoir", "coup"] },
          end: "resolved",
        };
      } },
    ],
  },

  // 6. Le distributeur saboté : enquête sur indices et témoignages réellement disponibles.
  cafe: {
    title: "Qui a saboté le distributeur ?",
    tags: ["café", "enquête", "justice"],
    p: 0.012,
    start(cx) {
      const machine = cx.world.objects["o-cafe"];
      const count = cx.world.gags?.coffee?.count || 0;
      const culprit = pickPerson(cx, (p) => (p.likes || []).some((l) => /thé|silence/.test(l)) || p.traits?.includes("grumpy") || p.archetype === "rebelle");
      if (!machine || machine.state === "saboté" || count < 1 || !culprit) return null;
      return { cast: { culprit: culprit.id, gaspard: "r-gaspard" }, data: {} };
    },
    stages: [
      { wait: 0, run(cx, arc) {
        const witnesses = (cx.occupancy?.["f0.cafeteria"] || []).filter((p) => p.kind !== "animal" && p.id !== arc.cast.culprit).map((p) => p.id).slice(0, 3);
        arc.data.witnesses = witnesses;
        return {
          ops: [{ op: "object", id: "o-cafe", set: { state: "saboté" }, note: "Retrouvé ouvert, un tournevis planté dans le monnayeur." }],
          event: { kind: "arc_cafe", title: "Le distributeur de café a été saboté", text: `Un tournevis dans le monnayeur, un mot « ENFIN LE SILENCE » scotché sur l'écran. ${witnesses.length ? `${witnesses.length} personne(s) étaient dans la Cafétéria à ce moment-là.` : "Personne n'a rien vu."}`, actors: [arc.cast.gaspard, ...witnesses].filter((id) => person(cx, id)), room: "f0.cafeteria", importance: 3, tags: ["café", "sabotage"] },
          facts: [
            { kind: "secret", text: `${person(cx, arc.cast.culprit).name} a saboté le distributeur de café.`, about: [arc.cast.culprit], status: "secret", truth: true, knownBy: [arc.cast.culprit] },
            ...witnesses.slice(0, 1).map((w) => ({ kind: "clue", text: `${person(cx, w).name} a vu quelqu'un avec un tournevis près du distributeur.`, about: [w], status: "confirmed", truth: true, knownBy: [w] })),
          ],
        };
      } },
      { wait: 2, chance: 0.5, run(cx, arc) {
        const inv = pickPerson(cx, (p) => p.dept === "tribunal" && /Enquêteur|Huissier|Expert/.test(p.title)) || person(cx, "s-rodrigue");
        if (!awake(inv)) return null;
        arc.cast.investigator = inv.id;
        // Le témoignage ne vaut que ce que vaut le témoin (un paranoïaque accuse plus facilement).
        const witness = arc.data.witnesses?.[0] && person(cx, arc.data.witnesses[0]);
        const reliable = witness && !witness.traits?.includes("paranoid") && cx.rng.chance(0.65);
        const accused = reliable ? person(cx, arc.cast.culprit) : pickPerson(cx, (p) => p.dept === "technique" || p.traits?.includes("clumsy"));
        arc.data.accused = accused?.id;
        if (!accused) return null;
        return {
          ops: [goTo(cx, accused, "f9.attente", 4, "Convoqué au Tribunal")],
          event: { kind: "arc_cafe", title: `L'enquête du distributeur désigne ${accused.name}`, text: `${inv.name} recueille ${witness ? `le témoignage de ${witness.name}` : "des rumeurs"} et un tournevis portant des traces de… café. ${accused.name} est convoqué au Tribunal des Couloirs.`, actors: [inv.id, accused.id, witness?.id], room: "f9.enquetes", importance: 3, tags: ["enquête", "justice"] },
        };
      } },
      { wait: 3, chance: 0.5, run(cx, arc) {
        const accused = person(cx, arc.data.accused);
        const guilty = accused?.id === arc.cast.culprit;
        const convicted = guilty ? cx.rng.chance(0.75) : cx.rng.chance(0.35);
        const ops = [{ op: "person", id: accused.id, reputation: convicted ? -6 : 1, career: convicted ? "Condamné pour le sabotage du distributeur" : "Relaxé dans l'affaire du distributeur" }, { op: "object", id: "o-cafe", set: { state: "ok" }, note: "Réparé après le procès." }];
        if (convicted && balance(cx.world, accountOf("p", accused.id)) >= 60 && cx.world.companies.refectoire) ops.push({ op: "transfer", from: accountOf("p", accused.id), to: accountOf("c", "refectoire"), amount: 60, reason: "Dommages et intérêts (distributeur de café)" });
        return {
          ops,
          event: { kind: "arc_cafe", title: convicted ? `Procès du distributeur : ${accused.name} condamné${guilty ? "" : " (à tort ?)"}` : `Procès du distributeur : ${accused.name} relaxé`, text: `${convicted ? "Peine : soixante crédits et une lettre d'excuses au distributeur." : "Le vrai coupable court toujours, probablement vers une théière."}`, actors: [accused.id, "r-hermine"].filter((id) => person(cx, id)), room: "f9.audience", importance: 3, tags: ["justice", "café"], dialogue: [say(cx, accused.id, "trial")].filter(Boolean) },
          facts: convicted && !guilty ? [{ kind: "rumor", text: `${accused.name} aurait été condamné à la place du vrai saboteur du distributeur.`, about: [accused.id], status: "rumor", truth: true, knownBy: [arc.cast.culprit] }] : [],
          end: convicted && guilty ? "resolved" : "failed",
        };
      } },
    ],
  },

  // 7. La photo du lendemain : une prophétie qui tente de se réaliser.
  photo: {
    title: "La photo du lendemain",
    tags: ["anomalie", "mystère", "étage fantôme"],
    p: 0.008,
    start(cx) {
      if (cx.world.building.pressure < 20) return null;
      const finder = pickPerson(cx, (p) => p.dept === "etrange" || p.location?.startsWith("fm2."));
      const subject = pickPerson(cx, (p) => p.id !== finder?.id && p.kind !== "animal");
      if (!finder || !subject) return null;
      const room = cx.rng.pick(["f0.hall", "f6.hemicycle", "f4.tv", "f8.salon", "f2.reunionA", "f0.cafeteria"]);
      return { cast: { finder: finder.id, subject: subject.id }, data: { room, dueCycle: cx.world.cycle + DAYC, deed: cx.rng.pick(["en train de rire aux éclats", "tenant un trophée en carton", "serrant la main de Gustave", "debout sur une chaise", "en larmes, un dossier à la main"]) } };
    },
    stages: [
      { wait: 0, run(cx, arc) {
        const finder = person(cx, arc.cast.finder);
        const subject = person(cx, arc.cast.subject);
        const roomName = cx.world.building.rooms[arc.data.room].name;
        return {
          ops: [{ op: "object", action: "create", object: { id: `o-photo-${arc.id}`, name: "La photo datée de demain", room: "fm2.anomalies", state: "en attente", desc: `Une photo de ${subject.name} ${arc.data.deed}, dans ${roomName}. Date au dos : demain.` } }, { op: "building", pressure: 4 }],
          event: { kind: "arc_photo", title: `${finder.name} trouve une photo de ${subject.name}… datée de demain`, text: `Dans la Salle des anomalies : ${subject.name} ${arc.data.deed}, dans ${roomName}. Personne ne sait qui l'a déposée. Séraphin Demain hoche la tête, pas surpris.`, actors: [finder.id, subject.id], room: "fm2.anomalies", importance: 4, rare: true, tags: ["anomalie", "mystère"], dialogue: [say(cx, finder.id, "anomaly")].filter(Boolean) },
          facts: [{ kind: "rumor", text: `Une photo montre ${subject.name} ${arc.data.deed} — datée de demain.`, about: [subject.id], status: "rumor", truth: null, knownBy: [finder.id, subject.id] }],
        };
      } },
      { wait: 1, chance: 0.6, run(cx, arc) {
        const subject = person(cx, arc.cast.subject);
        const avoid = !subject.traits?.includes("paranoid") && cx.rng.chance(0.5);
        arc.data.avoid = avoid;
        return {
          ops: [{ op: "person", id: subject.id, set: { mood: Math.max(0, subject.mood - 10) } }],
          event: { kind: "arc_photo", title: avoid ? `${subject.name} jure d'éviter ${cx.world.building.rooms[arc.data.room].name} demain` : `${subject.name} veut prouver que la photo ment : rendez-vous demain sur place`, text: avoid ? "Plan : rester dans sa chambre. Avec la porte fermée. Et la plante devant." : "« Si j'y vais et que rien ne se passe, la photo a tort. » Logique imparable, selon lui.", actors: [subject.id], importance: 2, tags: ["anomalie"] },
        };
      } },
      { wait: 1, until: (cx, arc) => cx.world.cycle >= arc.data.dueCycle, run(cx, arc) {
        const subject = person(cx, arc.cast.subject);
        // Le hasard décide si la prophétie se réalise : l'éviter ne suffit pas toujours.
        const fulfilled = cx.rng.chance(arc.data.avoid ? 0.35 : 0.6);
        if (fulfilled) {
          return {
            ops: [{ op: "move", id: subject.id, to: arc.data.room, force: true, activity: { kind: "special", label: arc.data.deed } }, { op: "object", id: `o-photo-${arc.id}`, set: { state: "réalisée" }, note: "La scène a eu lieu, exactement comme sur la photo." }, { op: "building", pressure: 6 }],
            event: { kind: "arc_photo", title: `La photo du lendemain était exacte : ${subject.name}, ${arc.data.deed}`, text: `${arc.data.avoid ? "Malgré tous ses efforts, " : ""}${subject.name} se retrouve exactement dans la scène de la photo. Quelqu'un, quelque part, a dû appuyer sur le déclencheur.`, actors: [subject.id], room: arc.data.room, importance: 4, rare: true, tags: ["anomalie", "prophétie"] },
            end: "resolved",
          };
        }
        return {
          ops: [{ op: "object", id: `o-photo-${arc.id}`, set: { state: "périmée" }, note: "Le lendemain est passé sans la scène. La date au dos indique désormais : après-demain." }, { op: "building", pressure: -3 }],
          event: { kind: "arc_photo", title: "La photo du lendemain s'est trompée… ou pas encore", text: `Rien ne s'est passé. Mais la date au dos de la photo a changé : « après-demain ». Séraphin Demain sourit.`, actors: [subject.id, "s-seraphin"].filter((id) => person(cx, id)), room: "fm2.anomalies", importance: 3, tags: ["anomalie"] },
          end: "dormant",
        };
      } },
    ],
  },

  // 8. Le vice-président de la pause déjeuner : piston, jalousie, loi anti-copinage.
  vp: {
    title: "Le Vice-Président de la Pause Déjeuner",
    tags: ["direction", "carrière", "politique"],
    p: 0.01,
    start(cx) {
      const ceo = Object.values(cx.world.people).find((p) => p.flags?.ceo && awake(p));
      const friend = person(cx, "s-maxime");
      if (!ceo || !awake(friend) || friend.title.includes("Vice-président de la Pause")) return null;
      return { cast: { ceo: ceo.id, friend: friend.id }, data: {} };
    },
    stages: [
      { wait: 0, run(cx, arc) {
        const { ceo, friend } = arc.cast;
        return {
          ops: [{ op: "person", id: friend, set: { title: "Vice-président de la Pause Déjeuner", salary: 140 }, career: `Nommé VP de la Pause Déjeuner par ${person(cx, ceo).name} (son meilleur ami)`, reputation: 3 }],
          event: { kind: "arc_vp", title: `${person(cx, ceo).name} invente un poste pour son meilleur ami : Vice-président de la Pause Déjeuner`, text: `Missions : « optimiser la convivialité méridienne ». Salaire : doublé. Bureau : la Cafétéria, entre 12 h et 14 h.`, actors: [ceo, friend], room: "f2.pdg", importance: 4, tags: ["direction", "carrière", "satire"], dialogue: [say(cx, friend, "promotion")].filter(Boolean) },
        };
      } },
      { wait: 2, chance: 0.5, run(cx, arc) {
        const jealous = Object.values(cx.world.people).filter((p) => awake(p) && p.dept === "direction" && p.id !== arc.cast.friend && p.ambition?.kind === "power").slice(0, 4);
        if (!jealous.length) return { skip: true };
        return {
          ops: jealous.map((p) => feelOp(p.id, arc.cast.friend, -20, null, "Promu par copinage.")),
          event: { kind: "arc_vp", title: "La Direction grince des dents", text: `${jealous.map((p) => p.name).join(", ")} demandent à leur tour des vice-présidences. On parle de « VP du Café », de « VP du Couloir » et de « VP des VP ».`, actors: jealous.map((p) => p.id), room: "f2.couloir", importance: 3, tags: ["carrière", "jalousie"] },
        };
      } },
      { wait: 2, chance: 0.5, run(cx, arc) {
        const floor = cx.world.building.floors.f2;
        return {
          ops: [{ op: "floor", id: "f2", set: { rules: { ...floor.rules, temp: { id: "pause1147", text: "Déjeuner obligatoire à 11 h 47 précises, en musique.", until: cx.world.cycle + 2 * DAYC } } } }, { op: "building", mood: -2 }],
          event: { kind: "arc_vp", title: "Première décision du VP : déjeuner à 11 h 47 précises, en musique", text: "La playlist officielle compte un seul morceau. Il dure 47 minutes.", actors: [arc.cast.friend], room: "f0.cafeteria", importance: 3, tags: ["bureaucratie", "règle"] },
        };
      } },
      { wait: 4, chance: 0.4, run(cx, arc) {
        const friend = person(cx, arc.cast.friend);
        const deputies = cx.world.parliament.seats.map((id) => person(cx, id)).filter(awake);
        const against = deputies.filter((d) => d.ambition?.kind !== "power" || cx.rng.chance(0.4)).length;
        const abolished = against > deputies.length / 2;
        return {
          ops: abolished ? [{ op: "person", id: friend.id, set: { title: "Ancien VP de la Pause Déjeuner", salary: 70 }, career: "Poste supprimé par l'Hémicycle", reputation: -3 }] : [{ op: "person", id: friend.id, reputation: 2 }],
          event: { kind: "arc_vp", title: abolished ? "L'Hémicycle supprime la Vice-présidence de la Pause Déjeuner" : "La Vice-présidence de la Pause Déjeuner survit au vote", text: abolished ? `${against} député(s) votent la suppression. ${friend.name} garde la playlist, à titre honorifique.` : `Seulement ${against} voix contre. Le poste est désormais « stratégique ».`, actors: [friend.id, ...deputies.slice(0, 2).map((d) => d.id)], room: "f6.hemicycle", importance: 4, tags: ["politique", "carrière"] },
          end: "resolved",
        };
      } },
    ],
  },
};

// ------------------------------------------------------------------ moteur

const MAX_ACTIVE = 3;

export function arcsCycle(cx) {
  const { world, rng } = cx;
  world.arcs ||= {};
  const active = Object.values(world.arcs).filter((a) => a.state === "active");
  // Démarrage : rare, plafonné, jamais deux fois le même arc en même temps.
  if (active.length < MAX_ACTIVE && cx.hour >= 8 && cx.hour <= 20) {
    for (const [kind, def] of rng.shuffle(Object.entries(ARC_DEFS))) {
      if (active.some((a) => a.kind === kind)) continue;
      const last = Object.values(world.arcs).filter((a) => a.kind === kind).sort((a, b) => b.startedCycle - a.startedCycle)[0];
      if (last && world.cycle - last.startedCycle < 6 * DAYC) continue;
      const rarity = world.config.rarity?.rare ?? 1;
      const chaos = clamp(world.config.chaos ?? 50, 0, 100) / 50;
      if (!rng.chance(def.p * rarity * (0.4 + chaos * 0.6))) continue;
      if (startArc(cx, kind)) break;
    }
  }
  for (const arc of Object.values(world.arcs)) if (arc.state === "active") stepArc(cx, arc);
}

export function startArc(cx, kind, { source = "natural" } = {}) {
  const { world } = cx;
  const def = ARC_DEFS[kind];
  const setup = def?.start(cx);
  if (!setup) return null;
  const id = worldId(world, "arc");
  const arc = { id, kind, title: def.title, state: "active", stage: 0, cast: setup.cast, data: setup.data || {}, startedCycle: world.cycle, lastCycle: world.cycle, events: [], plotId: null, source };
  world.arcs[id] = arc;
  const res = stepArc(cx, arc, { force: true });
  if (!res?.ok) {
    delete world.arcs[id];
    return null;
  }
  const plot = openPlot(cx, { kind: `arc_${kind}`, title: def.title, cast: Object.values(arc.cast), subject: `arc:${id}`, origin: res.event?.id, goals: "Voir où mène l'affaire", conflict: def.tags.join(", ") });
  if (plot) {
    plot.tags = [...new Set([...plot.tags, ...def.tags])];
    arc.plotId = plot.id;
  }
  cx.metric("arcs_started", 1);
  return arc;
}

function stepArc(cx, arc, { force = false } = {}) {
  const { world, rng } = cx;
  const def = ARC_DEFS[arc.kind];
  const stage = def.stages[arc.stage];
  if (!stage) return finish(cx, arc, "resolved");
  if (!force) {
    if (world.cycle - arc.lastCycle < (stage.wait || 0) * 6) return null;
    if (stage.until && !stage.until(cx, arc)) return null;
    if (stage.chance !== undefined && !rng.chance(stage.chance)) {
      // Un arc qui piétine trop longtemps s'endort (il pourra être récupéré par une intrigue).
      if (world.cycle - arc.lastCycle > 8 * DAYC) finish(cx, arc, "dormant");
      return null;
    }
  }
  const plan = stage.run(cx, arc);
  if (!plan) return null;
  if (plan.skip) {
    arc.stage += 1;
    arc.lastCycle = world.cycle;
    return { ok: true };
  }
  if (!plan.event && plan.end) return finish(cx, arc, plan.end);
  const res = cx.commit({
    source: arc.source === "debug" ? "debug" : "director",
    kind: `arc_${arc.kind}`,
    key: `arc:${arc.id}:${arc.stage}`,
    ops: plan.ops || [],
    facts: plan.facts,
    event: { ...plan.event, source: arc.source === "debug" ? "debug" : "natural", tags: [...(plan.event.tags || []), "arc", ...ARC_DEFS[arc.kind].tags.slice(0, 2)] },
  });
  if (!res.ok) {
    arc.failures = (arc.failures || 0) + 1;
    arc.lastError = res.errors?.[0];
    if (arc.failures >= 4) finish(cx, arc, "failed");
    return res;
  }
  arc.events.push(res.event.id);
  arc.lastCycle = world.cycle;
  arc.stage += 1;
  const plot = arc.plotId && world.plots[arc.plotId];
  if (plot && !plot.beats.includes(res.event.id)) {
    plot.beats.push(res.event.id);
    plot.lastBeatCycle = world.cycle;
    res.event.plotId = plot.id;
  }
  if (plan.end || arc.stage >= def.stages.length) finish(cx, arc, plan.end || "resolved");
  return res;
}

function finish(cx, arc, state) {
  arc.state = state;
  arc.endedCycle = cx.world.cycle;
  const plot = arc.plotId && cx.world.plots[arc.plotId];
  if (plot && ["active", "dormant"].includes(plot.state)) {
    plot.state = state === "dormant" ? "dormant" : state;
    plot.resolution = { outcome: state, text: state === "resolved" ? "L'affaire a trouvé son dénouement." : state === "failed" ? "L'affaire s'est mal terminée… ou pas pour tout le monde." : "L'affaire s'est endormie. Pour l'instant.", cycle: cx.world.cycle };
  }
  cx.metric(`arcs_${state}`, 1);
  return { ok: true };
}
