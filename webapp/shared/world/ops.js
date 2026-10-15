// Noyau transactionnel du Bâtiment : toute modification du monde passe par une PROPOSITION
// composée d'opérations atomiques. Le validateur vérifie chaque opération (comptes, soldes,
// existence des personnages et lieux, causes réellement enregistrées, doublons, répétitions)
// avant d'appliquer l'ensemble ; sinon rien n'est appliqué et le rejet est journalisé.

import { clampText, worldId } from "./core.js";
import { addFact, learn, publicize, recordEvent, findEvent, believe } from "./memory.js";
import { accessDenied } from "./building.js";

export const ACCOUNT_KINDS = { p: "person", c: "company", o: "org" };

export function accountOf(kind, id) {
  return `${kind}:${id}`;
}

export function balance(world, accountId) {
  return world.accounts[accountId]?.balance ?? 0;
}

export function ensureAccount(world, id, { owner = null, kind = "person", balance: initial = 0 } = {}) {
  if (!world.accounts[id]) world.accounts[id] = { id, owner, kind, balance: initial, frozen: false };
  return world.accounts[id];
}

export function totalMoney(world) {
  return Object.values(world.accounts).reduce((s, a) => s + a.balance, 0);
}

const PERSON_FIELDS = new Set(["status", "title", "floor", "ambition", "employer", "salary", "flags", "doubleOf", "kind", "name", "dept", "workRoom", "homeRoom", "goals", "mood"]);
// Un changement de rôle doit toujours être justifié (entrée de carrière).
const ROLE_FIELDS = ["title", "dept", "employer", "workRoom"];
const OBJECT_FIELDS = new Set(["state", "room", "owner", "name", "desc", "value", "hidden"]);
const FLOOR_FIELDS = new Set(["status", "onPlan", "discovered", "controller", "note", "name", "rules"]);
const COMPANY_FIELDS = new Set(["status", "ceo", "price", "demand", "reputation", "note"]);
const LOAN_FIELDS = new Set(["status", "balance", "dueCycle", "rate", "note", "missed", "sued"]);
const ORG_FIELDS = new Set(["status", "leader", "goal", "reputation", "kind", "public"]);

const isInt = (n) => Number.isFinite(n) && Math.round(n) === n;

// ------------------------------------------------------------------ opérations

const OPS = {
  transfer: {
    validate(w, op, shadow) {
      if (!isInt(op.amount) || op.amount <= 0) return `montant invalide (${op.amount})`;
      const from = w.accounts[op.from] || (shadow.has(op.from) ? { balance: 0 } : null);
      const to = w.accounts[op.to] || (shadow.has(op.to) ? { balance: 0 } : null);
      if (!from) return `compte source inconnu (${op.from})`;
      if (!to) return `compte destinataire inconnu (${op.to})`;
      if (op.from === op.to) return "virement vers soi-même";
      if (from.frozen && !op.allowFrozen) return `compte gelé (${op.from})`;
      const available = shadow.get(op.from) ?? from.balance;
      if (available < op.amount) return `fonds insuffisants sur ${op.from} (${available} < ${op.amount})`;
      shadow.set(op.from, available - op.amount);
      shadow.set(op.to, (shadow.get(op.to) ?? to.balance) + op.amount);
      return null;
    },
    apply(w, op, ctx) {
      w.accounts[op.from].balance -= op.amount;
      w.accounts[op.to].balance += op.amount;
      w.ledger.push({ id: worldId(w, "tx"), cycle: w.cycle, from: op.from, to: op.to, amount: op.amount, reason: clampText(op.reason, 120), secret: !!op.secret, eventId: ctx.eventIdRef });
    },
  },
  mint: {
    validate(w, op, shadow, proposal) {
      if (proposal.source !== "system") return "seul le Trésor du Syndic peut émettre des Crédits (Charte, R3)";
      if (op.to !== "treasury") return "l'émission se fait uniquement vers le Trésor";
      if (!isInt(op.amount) || op.amount <= 0 || op.amount > 80000) return "montant d'émission invalide";
      shadow.set("treasury", (shadow.get("treasury") ?? w.accounts.treasury.balance) + op.amount);
      return null;
    },
    apply(w, op) {
      w.accounts.treasury.balance += op.amount;
      w.money.minted += op.amount;
      w.ledger.push({ id: worldId(w, "tx"), cycle: w.cycle, from: "émission", to: "treasury", amount: op.amount, reason: clampText(op.reason, 120), secret: false });
    },
  },
  account: {
    validate(w, op, shadow) {
      if (!op.id) return "compte sans identifiant";
      if (!w.accounts[op.id]) shadow.set(op.id, shadow.get(op.id) ?? 0);
      return null;
    },
    apply(w, op) {
      if (!w.accounts[op.id]) ensureAccount(w, op.id, { owner: op.owner, kind: op.kind || "person", balance: 0 });
      if (op.frozen !== undefined) w.accounts[op.id].frozen = !!op.frozen;
    },
  },
  person: {
    validate(w, op) {
      if (!w.people[op.id]) return `personnage inconnu (${op.id})`;
      for (const key of Object.keys(op.set || {})) if (!PERSON_FIELDS.has(key)) return `champ non modifiable (${key})`;
      if (ROLE_FIELDS.some((k) => op.set?.[k] !== undefined && op.set[k] !== w.people[op.id][k]) && !op.career) return "changement de rôle sans raison consignée";
      if (op.set?.workRoom && !w.building.rooms?.[op.set.workRoom]) return `pièce inconnue (${op.set.workRoom})`;
      return null;
    },
    apply(w, op) {
      const p = w.people[op.id];
      Object.assign(p, op.set || {});
      if (op.reputation) p.reputation = Math.max(0, Math.min(100, p.reputation + op.reputation));
      if (op.career) p.career.push({ cycle: w.cycle, text: clampText(op.career, 140) });
      if (p.career.length > 20) p.career.shift();
    },
  },
  addPerson: {
    validate(w, op, shadow) {
      if (!op.person?.id || !op.person.name) return "personnage incomplet";
      if (w.people[op.person.id]) return `personnage déjà existant (${op.person.id})`;
      shadow.set(accountOf("p", op.person.id), 0);
      return null;
    },
    apply(w, op) {
      w.people[op.person.id] = op.person;
      ensureAccount(w, accountOf("p", op.person.id), { owner: op.person.id, kind: "person" });
    },
  },
  // Déplacements : chaque personnage n'a qu'une localisation, une pièce existante et accessible.
  move: {
    validate(w, op, shadow, proposal) {
      const p = w.people[op.id];
      const room = w.building.rooms?.[op.to];
      if (!p) return `personnage inconnu (${op.id})`;
      if (!room) return `pièce inconnue (${op.to})`;
      if (!op.force) {
        const denied = accessDenied(w, p, room, { hour: proposal.hour ?? 12, laws: proposal.laws || [] });
        if (denied) return `accès refusé à ${room.name} : ${denied}`;
      }
      return null;
    },
    apply(w, op) {
      const p = w.people[op.id];
      p.location = op.to;
      if (op.activity) p.activity = { ...op.activity, since: w.cycle };
    },
  },
  // Sentiments (relations asymétriques) : a ressent quelque chose pour b, pas forcément l'inverse.
  feel: {
    validate(w, op) {
      if (!w.people[op.from] || !w.people[op.to]) return "sentiment entre personnages inconnus";
      if (op.from === op.to) return "relation avec soi-même";
      return null;
    },
    apply(w, op, ctx) {
      ctx.feel?.(op.from, op.to, op.delta || 0, op.kind || null, op.note || null);
    },
  },
  // Transmission d'une information : la source doit la connaître et les deux doivent être ensemble.
  tell: {
    validate(w, op) {
      const f = w.facts[op.fact];
      if (!f) return "fait inconnu";
      if (!w.people[op.from] || !w.people[op.to]) return "personnage inconnu";
      if (!f.public && !f.knownBy.includes(op.from)) return `${op.from} ne connaît pas cette information`;
      if (op.room && (w.people[op.from].location !== op.room || w.people[op.to].location !== op.room)) return "les deux personnages ne sont pas dans la même pièce";
      return null;
    },
    apply(w, op) {
      learn(w, op.to, op.fact);
      if (op.stance) believe(w, op.to, op.fact, op.stance);
    },
  },
  object: {
    validate(w, op) {
      if (op.action === "create") return op.object?.id && !w.objects[op.object.id] && w.building.rooms?.[op.object.room] ? null : "objet invalide";
      if (!w.objects?.[op.id]) return `objet inconnu (${op.id})`;
      for (const key of Object.keys(op.set || {})) if (!OBJECT_FIELDS.has(key)) return `champ d'objet non modifiable (${key})`;
      if (op.set?.room && !w.building.rooms?.[op.set.room]) return "pièce inconnue";
      return null;
    },
    apply(w, op) {
      if (op.action === "create") {
        w.objects[op.object.id] = { state: "ok", history: [], ...op.object, createdCycle: w.cycle };
        return;
      }
      const o = w.objects[op.id];
      Object.assign(o, op.set || {});
      if (op.note) {
        o.history.push({ cycle: w.cycle, text: clampText(op.note, 140) });
        if (o.history.length > 12) o.history.shift();
      }
    },
  },
  room: {
    validate(w, op) {
      if (op.action === "add") {
        const r = op.room;
        if (!r?.id || w.building.rooms[r.id] || !w.building.floors[r.floor]) return "pièce invalide ou déjà existante";
        return null;
      }
      return w.building.rooms?.[op.id] ? null : `pièce inconnue (${op.id})`;
    },
    apply(w, op) {
      if (op.action === "add") {
        const r = { access: "public", log: [], discovered: true, kind: "special", ...op.room, exits: [`${op.room.floor}.palier`] };
        w.building.rooms[r.id] = r;
        w.building.floors[r.floor].rooms.push(r.id);
        w.building.rooms[`${r.floor}.palier`]?.exits.push(r.id);
        return;
      }
      Object.assign(w.building.rooms[op.id], op.set || {});
    },
  },
  relation: {
    validate(w, op) {
      if (!w.people[op.a] || !w.people[op.b]) return "relation entre personnages inconnus";
      if (op.a === op.b) return "relation avec soi-même";
      return null;
    },
    apply(w, op, ctx) {
      ctx.setRelation(op.a, op.b, op.kind, op.score, op.note);
    },
  },
  org: {
    validate(w, op, shadow) {
      if (op.action === "create") {
        if (!op.org?.id || !op.org.name) return "organisation incomplète";
        if (w.orgs[op.org.id]) return "organisation déjà existante";
        if (!(op.org.members || []).length) return "une organisation doit avoir au moins un membre enregistré";
        if (op.org.members.some((m) => !w.people[m])) return "membre inconnu";
        if (!op.org.members.includes(op.org.leader)) return "le dirigeant doit être membre";
        shadow.set(accountOf("o", op.org.id), shadow.get(accountOf("o", op.org.id)) ?? 0);
        return null;
      }
      const org = w.orgs[op.id];
      if (!org) return `organisation inconnue (${op.id})`;
      if (org.status === "dissolved" && op.action !== "set") return "organisation dissoute";
      if (["join", "leave", "leader"].includes(op.action) && !w.people[op.person]) return "personnage inconnu";
      if (op.action === "join" && org.members.includes(op.person)) return "déjà membre";
      if (op.action === "leave" && !org.members.includes(op.person)) return "pas membre";
      if (op.action === "leader" && !org.members.includes(op.person)) return "le nouveau dirigeant doit être membre";
      if (op.action === "set") for (const key of Object.keys(op.set || {})) if (!ORG_FIELDS.has(key)) return `champ non modifiable (${key})`;
      return null;
    },
    apply(w, op) {
      if (op.action === "create") {
        w.orgs[op.org.id] = { status: "active", reputation: 50, history: [], public: true, ...op.org, foundedCycle: w.cycle };
        ensureAccount(w, accountOf("o", op.org.id), { owner: op.org.id, kind: "org" });
        return;
      }
      const org = w.orgs[op.id];
      if (op.action === "join") org.members.push(op.person);
      if (op.action === "leave") {
        org.members = org.members.filter((m) => m !== op.person);
        if (org.leader === op.person) org.leader = org.members[0] || null;
        if (!org.members.length) org.status = "dissolved";
      }
      if (op.action === "leader") org.leader = op.person;
      if (op.action === "dissolve") org.status = "dissolved";
      if (op.action === "set") Object.assign(org, op.set);
      if (op.reputation) org.reputation = Math.max(0, Math.min(100, org.reputation + op.reputation));
    },
  },
  company: {
    validate(w, op, shadow) {
      if (op.action === "create") {
        if (!op.company?.id || !op.company.name) return "entreprise incomplète";
        if (w.companies[op.company.id]) return "entreprise déjà existante";
        if (!w.people[op.company.ceo]) return "PDG inconnu";
        shadow.set(accountOf("c", op.company.id), shadow.get(accountOf("c", op.company.id)) ?? 0);
        return null;
      }
      const c = w.companies[op.id];
      if (!c) return `entreprise inconnue (${op.id})`;
      if (op.action === "shares") {
        const held = c.shares[op.from] || 0;
        if (!isInt(op.n) || op.n <= 0) return "nombre de parts invalide";
        if (held < op.n) return `${op.from} ne possède que ${held} part(s)`;
      }
      if (op.action === "set") for (const key of Object.keys(op.set || {})) if (!COMPANY_FIELDS.has(key)) return `champ non modifiable (${key})`;
      return null;
    },
    apply(w, op) {
      if (op.action === "create") {
        w.companies[op.company.id] = { status: "active", reputation: 50, demand: 1, history: [], ...op.company, foundedCycle: w.cycle };
        ensureAccount(w, accountOf("c", op.company.id), { owner: op.company.id, kind: "company" });
        return;
      }
      const c = w.companies[op.id];
      if (op.action === "set") Object.assign(c, op.set);
      if (op.action === "shares") {
        c.shares[op.from] -= op.n;
        if (!c.shares[op.from]) delete c.shares[op.from];
        c.shares[op.to] = (c.shares[op.to] || 0) + op.n;
      }
      if (op.reputation) c.reputation = Math.max(0, Math.min(100, c.reputation + op.reputation));
    },
  },
  loan: {
    validate(w, op) {
      if (op.action === "create") {
        const l = op.loan;
        if (!l?.id || !w.accounts[l.lender] || !w.accounts[l.borrower]) return "prêt invalide (comptes)";
        if (w.loans[l.id]) return "prêt déjà existant";
        if (!isInt(l.principal) || l.principal <= 0) return "principal invalide";
        return null;
      }
      if (!w.loans[op.id]) return `prêt inconnu (${op.id})`;
      for (const key of Object.keys(op.set || {})) if (!LOAN_FIELDS.has(key)) return `champ non modifiable (${key})`;
      return null;
    },
    apply(w, op) {
      if (op.action === "create") w.loans[op.loan.id] = { status: "active", balance: op.loan.principal, contractCycle: w.cycle, ...op.loan };
      else Object.assign(w.loans[op.id], op.set);
    },
  },
  law: {
    validate(w, op) {
      if (op.action === "propose") {
        if (!op.law?.id || !op.law.code) return "loi incomplète";
        if (w.laws[op.law.id]) return "loi déjà déposée";
        if (!w.parliament.seats.includes(op.law.sponsor)) return "seul un député peut déposer une loi";
        if (Object.values(w.laws).some((l) => l.code === op.law.code && ["proposed", "enacted"].includes(l.status))) return "une loi identique est déjà en vigueur ou en discussion";
        return null;
      }
      if (!w.laws[op.id]) return `loi inconnue (${op.id})`;
      return null;
    },
    apply(w, op) {
      if (op.action === "propose") w.laws[op.law.id] = { status: "proposed", votes: null, history: [], ...op.law, proposedCycle: w.cycle };
      else {
        Object.assign(w.laws[op.id], op.set || {});
        if (op.set?.status === "enacted") w.laws[op.id].enactedCycle = w.cycle;
      }
    },
  },
  case: {
    validate(w, op) {
      if (op.action === "file") {
        const c = op.case;
        if (!c?.id || !w.people[c.plaintiff]) return "plainte invalide (plaignant inconnu)";
        if (c.defendant && !w.people[c.defendant] && !w.companies[c.defendant] && !w.laws[c.defendant]) return "défendeur inconnu";
        if (Object.values(w.cases).some((x) => x.status === "filed" && x.subject === c.subject)) return "affaire déjà en cours sur ce sujet";
        return null;
      }
      if (!w.cases[op.id]) return `affaire inconnue (${op.id})`;
      if (w.cases[op.id].status !== "filed") return "affaire déjà jugée";
      return null;
    },
    apply(w, op) {
      if (op.action === "file") w.cases[op.case.id] = { status: "filed", filedCycle: w.cycle, ...op.case };
      else Object.assign(w.cases[op.id], { status: "judged", judgedCycle: w.cycle, ...op.set });
    },
  },
  floor: {
    validate(w, op) {
      if (op.action === "add") {
        if (!op.floor?.id || w.building.floors[op.floor.id]) return "étage invalide ou déjà existant";
        return null;
      }
      if (!w.building.floors[op.id]) return `étage inconnu (${op.id})`;
      for (const key of Object.keys(op.set || {})) if (!FLOOR_FIELDS.has(key)) return `champ non modifiable (${key})`;
      return null;
    },
    apply(w, op) {
      if (op.action === "add") {
        w.building.floors[op.floor.id] = { status: "contested", onPlan: false, discovered: true, anomaly: 0, history: [], ...op.floor };
        return;
      }
      const f = w.building.floors[op.id];
      Object.assign(f, op.set || {});
      if (op.anomaly) f.anomaly = Math.max(0, Math.min(100, (f.anomaly || 0) + op.anomaly));
    },
  },
  building: {
    validate() {
      return null;
    },
    apply(w, op) {
      if (op.pressure) w.building.pressure = Math.max(0, Math.min(100, w.building.pressure + op.pressure));
      if (op.elevatorMood) w.building.elevator.mood = Math.max(0, Math.min(100, w.building.elevator.mood + op.elevatorMood));
      if (op.grudge) w.building.elevator.grudges[op.grudge.person] = op.grudge.until;
      if (op.mood) w.mood = Math.max(0, Math.min(100, w.mood + op.mood));
    },
  },
  mystery: {
    validate(w, op) {
      if (op.action === "open") {
        const m = op.mystery;
        if (!m?.id || w.mysteries[m.id]) return "mystère invalide ou déjà ouvert";
        if (!m.truth || !(m.clues || []).length || !(m.options || []).some((o) => o.id === m.truth.id)) return "mystère sans vérité, indices ou suspects";
        if ((m.investigators || []).some((id) => !w.people[id])) return "enquêteur inconnu";
        return null;
      }
      const m = w.mysteries[op.id];
      if (!m) return `mystère inconnu (${op.id})`;
      if (m.status === "solved" && op.action !== "note") return "mystère déjà résolu";
      if (op.action === "clue" && (!m.clues[op.index] || m.clues[op.index].found)) return "indice déjà trouvé ou inexistant";
      if (op.action === "investigator" && !w.people[op.person]) return "enquêteur inconnu";
      return null;
    },
    apply(w, op, ctx) {
      if (op.action === "open") {
        w.mysteries[op.mystery.id] = { status: "open", hypotheses: [], investigators: [], openedCycle: w.cycle, origin: ctx.eventIdRef, ...op.mystery };
        return;
      }
      const m = w.mysteries[op.id];
      if (op.action === "clue") Object.assign(m.clues[op.index], { found: true, foundBy: op.by, cycle: w.cycle });
      if (op.action === "hypothesis") m.hypotheses.push({ by: op.by, text: clampText(op.text, 200), correct: !!op.correct, cycle: w.cycle });
      if (op.action === "investigator" && !m.investigators.includes(op.person)) m.investigators.push(op.person);
      if (op.action === "solve") Object.assign(m, { status: "solved", solvedBy: op.by, solvedCycle: w.cycle });
      if (op.action === "status") m.status = op.status;
    },
  },
  anomaly: {
    validate(w, op) {
      return op.anomaly?.kind ? null : "anomalie incomplète";
    },
    apply(w, op) {
      w.anomalies.push({ id: worldId(w, "an"), cycle: w.cycle, explained: false, ...op.anomaly });
      if (w.anomalies.length > 40) w.anomalies.shift();
    },
  },
  schedule: {
    validate(w, op) {
      return Number.isFinite(op.dueCycle) && op.dueCycle > w.cycle && op.kind ? null : "conséquence différée invalide";
    },
    apply(w, op, ctx) {
      w.scheduled.push({ id: worldId(w, "sc"), dueCycle: op.dueCycle, kind: op.kind, payload: op.payload || {}, cause: ctx.eventIdRef });
    },
  },
  plot: {
    validate(w, op) {
      if (op.action === "create") return op.plot?.id && !w.plots[op.plot.id] ? null : "intrigue invalide";
      return w.plots[op.id] ? null : `intrigue inconnue (${op.id})`;
    },
    apply(w, op) {
      if (op.action === "create") w.plots[op.plot.id] = { state: "active", beats: [], progress: 0, facts: [], createdCycle: w.cycle, lastBeatCycle: w.cycle, ...op.plot };
      else Object.assign(w.plots[op.id], op.set || {});
    },
  },
  parliament: {
    validate(w, op) {
      if (op.seats && op.seats.some((id) => !w.people[id])) return "siège attribué à un inconnu";
      return null;
    },
    apply(w, op) {
      Object.assign(w.parliament, op.set || {});
    },
  },
  article: {
    validate(w, op) {
      return w.media.outlets[op.article?.outlet] ? null : "média inconnu";
    },
    apply(w, op, ctx) {
      w.media.articles.push({ id: worldId(w, "ar"), cycle: w.cycle, eventId: ctx.eventIdRef, ...op.article });
      if (w.media.articles.length > 40) w.media.articles.shift();
    },
  },
  learn: {
    validate(w, op) {
      if (!w.facts[op.fact]) return "fait inconnu";
      return (op.people || []).every((id) => w.people[id]) ? null : "personnage inconnu";
    },
    apply(w, op) {
      for (const id of op.people || []) learn(w, id, op.fact);
      if (op.publicize) publicize(w, op.fact);
    },
  },
};

// ------------------------------------------------------------------ validation & application

export function validateProposal(world, proposal) {
  const errors = [];
  if (proposal.key && world.applied[proposal.key] !== undefined) errors.push(`déjà appliqué (${proposal.key})`);
  const ev = proposal.event;
  if (ev) {
    ev.actors = (ev.actors || []).filter(Boolean);
    ev.causes = (ev.causes || []).filter(Boolean);
    for (const id of ev.actors) if (!world.people[id]) errors.push(`acteur inexistant (${id})`);
    if (ev.room && !world.building.rooms?.[ev.room]) errors.push(`lieu inexistant (${ev.room})`);
    // Une conséquence annoncée doit correspondre à un vrai changement d'état.
    if (ev.importance >= 3 && !(proposal.ops || []).length && !proposal.decision && !proposal.observational) errors.push("conséquence annoncée sans changement de l'état du monde");
    // On ne s'appuie jamais sur un passé inventé : chaque cause doit être un événement enregistré.
    for (const id of ev.causes || []) if (!findEvent(world, id)) errors.push(`cause inexistante (${id})`);
    if (!proposal.allowRepeat) {
      const sig = signature(ev);
      const recent = world.events.filter((e) => world.cycle - e.cycle <= 16 && e.kind === ev.kind);
      if (recent.some((e) => signature(e) === sig)) errors.push("événement trop similaire à un événement récent");
    }
  }
  const shadow = new Map();
  for (const op of proposal.ops || []) {
    const def = OPS[op.op];
    if (!def) {
      errors.push(`opération inconnue (${op.op})`);
      continue;
    }
    const err = def.validate(world, op, shadow, proposal);
    if (err) errors.push(`${op.op} : ${err}`);
  }
  for (const f of proposal.facts || []) f.about = (f.about || []).filter(Boolean);
  for (const f of proposal.facts || []) for (const id of f.about || []) if (!world.people[id] && !world.companies[id] && !world.orgs[id] && !world.building.floors[id]) errors.push(`fait sur un sujet inexistant (${id})`);
  return errors;
}

function signature(ev) {
  return `${ev.kind}|${[...(ev.actors || [])].sort().join(",")}`;
}

// Applique une proposition validée. Retourne { ok, event, errors }.
export function commit(world, proposal, ctx) {
  let errors = validateProposal(world, proposal);
  if (errors.length && proposal.flexible && errors.every((e) => e.startsWith("transfer : fonds insuffisants"))) {
    // Correction automatique : on ramène chaque virement au solde disponible.
    for (const op of proposal.ops) {
      if (op.op !== "transfer") continue;
      op.amount = Math.max(0, Math.min(op.amount, Math.floor(balance(world, op.from))));
    }
    proposal.ops = proposal.ops.filter((op) => op.op !== "transfer" || op.amount > 0);
    errors = validateProposal(world, proposal);
  }
  const log = { id: worldId(world, "pr"), cycle: world.cycle, source: proposal.source || "system", kind: proposal.kind || proposal.event?.kind || "?", key: proposal.key || null };
  if (errors.length) {
    world.proposals.push({ ...log, status: "rejected", errors: errors.slice(0, 4) });
    if (world.proposals.length > 80) world.proposals.shift();
    world.stats.rejected = (world.stats.rejected || 0) + 1;
    return { ok: false, errors };
  }
  const ref = { eventIdRef: null };
  let event = null;
  if (proposal.event) {
    event = recordEvent(world, { ...proposal.event, key: proposal.key || null }, ctx.now);
    ref.eventIdRef = event.id;
  }
  for (const op of proposal.ops || []) OPS[op.op].apply(world, op, { ...ctx, ...ref });
  for (const f of proposal.facts || []) {
    const fact = addFact(world, { ...f, source: event?.id || null });
    if (event) event.facts.push(fact.id);
  }
  if (proposal.key) world.applied[proposal.key] = world.cycle;
  world.proposals.push({ ...log, status: "applied", eventId: event?.id || null });
  if (world.proposals.length > 80) world.proposals.shift();
  world.stats.applied = (world.stats.applied || 0) + 1;
  ctx.onEvent?.(event, proposal);
  return { ok: true, event };
}

// Invariants vérifiés après chaque cycle (sinon le cycle est annulé).
export function checkInvariants(world, expectedTotal) {
  const problems = [];
  for (const p of Object.values(world.people)) {
    if (p.location && world.building.rooms && !world.building.rooms[p.location]) problems.push(`localisation invalide (${p.id} → ${p.location})`);
  }
  const total = totalMoney(world);
  if (total !== expectedTotal) problems.push(`masse monétaire incohérente (${total} ≠ ${expectedTotal})`);
  for (const a of Object.values(world.accounts)) {
    if (!Number.isFinite(a.balance) || Math.round(a.balance) !== a.balance) problems.push(`solde non entier (${a.id})`);
    if (a.balance < 0) problems.push(`solde négatif (${a.id})`);
  }
  for (const org of Object.values(world.orgs)) {
    if (org.status === "active" && !org.members.length) problems.push(`organisation sans membre (${org.id})`);
    if (org.status === "active" && org.leader && !org.members.includes(org.leader)) problems.push(`dirigeant non membre (${org.id})`);
  }
  for (const id of world.parliament.seats) if (!world.people[id]) problems.push(`siège occupé par un inconnu (${id})`);
  return problems;
}
