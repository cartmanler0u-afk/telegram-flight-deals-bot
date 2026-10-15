// Économie du Bâtiment : salaires, déjeuners, loyers, prêts, dividendes, faillites, émission
// monétaire. Tout passe par des virements validés : personne ne crée d'argent (Charte, R3),
// sauf le Trésor du Syndic lors d'une émission enregistrée.

import { credits } from "./core.js";
import { accountOf, balance } from "./ops.js";

const FOOD = ["refectoire", "biscuiterie"];

export function employerAccount(world, person) {
  if (!person.employer) return null;
  if (person.employer === "syndic") return "treasury";
  return world.companies[person.employer]?.status === "active" ? accountOf("c", person.employer) : null;
}

export function priceIndex(world) {
  return Math.max(1, (world.money.initial + world.money.minted) / world.money.initial);
}

function doneTasks(state) {
  return (state.tasks || []).filter((t) => t.status === "done").length;
}

// ------------------------------------------------------------------ cycle économique

export function economyCycle(cx) {
  const { world } = cx;
  if (cx.hour >= 9 && cx.once("subsidies")) subsidies(cx);
  if (cx.hour >= 9 && cx.once("payroll")) payroll(cx);
  if (cx.hour >= 11 && cx.hour < 16) lunchSales(cx);
  if (cx.hour >= 15 && cx.once("startups")) startupSales(cx);
  if (cx.hour >= 14 && cx.once("phantom")) phantomForward(cx);
  if (cx.hour >= 18 && cx.once("closing")) closing(cx);
  if (cx.hour >= 22 && cx.once("hotelrent")) hotelRent(cx);
  if (cx.hour >= 8 && cx.once("monetary")) monetaryPolicy(cx);
  bossCorpContracts(cx);
  return world;
}

function payroll(cx) {
  const { world } = cx;
  const byEmployer = new Map();
  for (const p of Object.values(world.people)) {
    if (!p.salary || p.status === "admin_dead" || p.status === "missing" || p.status === "fired") continue;
    const from = employerAccount(world, p);
    if (!from) continue;
    if (!byEmployer.has(from)) byEmployer.set(from, []);
    byEmployer.get(from).push(p);
  }
  // L'Employé n°0 est payé comme tout le monde. C'est bien le problème.
  if (!world.flags?.emp0Frozen) cx.commit({ source: "system", kind: "payroll", ops: [{ op: "transfer", from: "treasury", to: "emp0", amount: 60, reason: "Salaire — Employé n°0 (Registre)" }] });

  for (const [from, staff] of byEmployer) {
    const ops = [];
    let left = balance(world, from);
    const unpaid = [];
    for (const p of staff) {
      if (left >= p.salary) {
        ops.push({ op: "transfer", from, to: accountOf("p", p.id), amount: p.salary, reason: "Salaire" });
        left -= p.salary;
      } else unpaid.push(p);
    }
    if (ops.length) cx.commit({ source: "system", kind: "payroll", ops });
    if (unpaid.length) {
      const company = from.startsWith("c:") ? world.companies[from.slice(2)] : null;
      const ceo = company ? world.people[company.ceo] : world.people["r-arlette"];
      cx.commit({
        source: "system",
        kind: "unpaid_wages",
        key: `unpaid:${from}:${cx.dayKey}`,
        ops: ceo ? [{ op: "person", id: ceo.id, reputation: -4 }] : [],
        event: {
          kind: "unpaid_wages",
          title: `Salaires impayés ${company ? `chez ${company.name}` : "au Syndic"}`,
          text: `${unpaid.length} personne(s) n'ont pas été payées aujourd'hui (${unpaid.slice(0, 4).map((p) => p.name).join(", ")}${unpaid.length > 4 ? "…" : ""}). Les caisses ${company ? `de ${company.name}` : "du Trésor"} sont vides.`,
          actors: [ceo?.id, ...unpaid.slice(0, 5).map((p) => p.id)],
          importance: unpaid.length >= 3 ? 4 : 3,
          tags: ["économie", "travail"],
        },
        facts: [{ text: `${company ? company.name : "Le Syndic"} n'a pas pu payer ${unpaid.length} salaire(s).`, about: [ceo?.id].filter(Boolean), public: true }],
      });
    }
  }
}

// Les ventes du déjeuner suivent la localisation réelle : on paie là où l'on mange.
const FOOD_COMPANY = { "f0.cafeteria": "refectoire", "f3.biscuiterie": "biscuiterie" };

function lunchSales(cx) {
  const { world } = cx;
  if (world.flags?.strike) return;
  const idx = Math.sqrt(priceIndex(world));
  const ops = [];
  for (const p of Object.values(world.people)) {
    const companyId = FOOD_COMPANY[p.location];
    if (!companyId || p.kind === "animal" || p.flags?.ate === cx.dayKey || p.employer === companyId) continue;
    const c = world.companies[companyId];
    if (c?.status !== "active") continue;
    const price = Math.max(1, Math.round(c.price * idx));
    const acct = accountOf("p", p.id);
    p.flags = { ...p.flags, ate: cx.dayKey };
    if (balance(world, acct) - ops.filter((o) => o.from === acct).reduce((s, o) => s + o.amount, 0) < price || world.accounts[acct]?.frozen) continue;
    ops.push({ op: "transfer", from: acct, to: accountOf("c", companyId), amount: price, reason: `Déjeuner (${c.product})` });
  }
  if (ops.length) cx.commit({ source: "system", kind: "lunch", ops });
}

// Le Syndic finance les services qu'il emploie de fait (médias, labos, banque) : un contrat
// couvrant les trois quarts de leur masse salariale. Le reste dépend de leurs recettes.
function subsidies(cx) {
  const { world } = cx;
  const ops = [];
  for (const c of Object.values(world.companies)) {
    if (c.status !== "active" || !["media", "research"].includes(c.kind)) continue;
    const payrollTotal = Object.values(world.people).filter((p) => p.employer === c.id && p.status === "active").reduce((s, p) => s + (p.salary || 0), 0);
    const amount = Math.round(payrollTotal * 0.75);
    if (amount > 0) ops.push({ op: "transfer", from: "treasury", to: accountOf("c", c.id), amount, reason: `Contrat de service du Syndic (${c.name})` });
  }
  if (ops.length) cx.commit({ source: "system", kind: "subsidies", flexible: true, ops });
}

// Loyer des chambres de l'Hôtel : ceux qui ne paient plus finissent à la buanderie.
function hotelRent(cx) {
  const { world } = cx;
  const ops = [];
  const evicted = [];
  for (const p of Object.values(world.people)) {
    if (p.kind === "animal" || !["f8.aileA", "f8.aileB", "f8.aileC"].includes(p.homeRoom) || ["gone", "missing"].includes(p.status)) continue;
    const acct = accountOf("p", p.id);
    if (balance(world, acct) >= 8 && !world.accounts[acct]?.frozen) {
      ops.push({ op: "transfer", from: acct, to: "treasury", amount: 8, reason: "Loyer de la chambre (Hôtel des Employés)" });
      if (p.flags?.rentMissed) p.flags = { ...p.flags, rentMissed: 0 };
    } else {
      p.flags = { ...p.flags, rentMissed: (p.flags?.rentMissed || 0) + 1 };
      if (p.flags.rentMissed >= 3) evicted.push(p);
    }
  }
  if (ops.length) cx.commit({ source: "system", kind: "rent", ops });
  for (const p of evicted.slice(0, 3)) {
    cx.commit({
      source: "system",
      kind: "eviction",
      key: `evict:${p.id}:${cx.dayKey}`,
      ops: [{ op: "person", id: p.id, set: { homeRoom: "f8.buanderie" }, reputation: -3 }],
      event: { kind: "eviction", title: `${p.name} dort désormais à la buanderie`, text: `Trois loyers impayés : la gouvernante a déposé les affaires de ${p.name} entre deux machines à laver. Les chaussettes orphelines l'accueillent chaleureusement.`, actors: [p.id, "s-oreiller"].filter((id) => world.people[id]), room: "f8.buanderie", importance: 3, tags: ["économie", "logement"] },
    });
  }
}

function startupSales(cx) {
  const { world, rng } = cx;
  // Produits des start-up : quelques occupants achètent, selon le bouche-à-oreille.
  for (const c of Object.values(world.companies)) {
    if (c.kind !== "startup" || c.status !== "active") continue;
    const buyers = Object.values(world.people).filter((p) => p.kind !== "animal" && p.status === "active" && rng.chance(0.06 * c.demand));
    const list = buyers.filter((p) => balance(world, accountOf("p", p.id)) >= c.price && !world.accounts[accountOf("p", p.id)].frozen).map((p) => ({ op: "transfer", from: accountOf("p", p.id), to: accountOf("c", c.id), amount: c.price, reason: `Achat : ${c.product}` }));
    if (list.length) cx.commit({ source: "system", kind: "sales", ops: list });
  }
}

// Le salaire fantôme repart discrètement vers son vrai bénéficiaire (trace secrète au grand livre).
function phantomForward(cx) {
  const { world } = cx;
  const amount = balance(world, "emp0");
  const target = world.phantom?.beneficiary;
  if (!amount || !target || world.accounts.emp0.frozen) return;
  const to = accountOf("p", target);
  if (!world.accounts[to]) return;
  cx.commit({ source: "system", kind: "phantom", ops: [{ op: "transfer", from: "emp0", to, amount, reason: "Retrait — dossier n°0", secret: true }] });
}

function closing(cx) {
  const { world, rng } = cx;
  // Loyers et charges payés au Trésor.
  for (const c of Object.values(world.companies)) {
    if (c.status !== "active" || !c.dailyCost) continue;
    const acct = accountOf("c", c.id);
    const due = c.dailyCost;
    const paid = Math.min(due, balance(world, acct));
    if (paid > 0) cx.commit({ source: "system", kind: "rent", ops: [{ op: "transfer", from: acct, to: "treasury", amount: paid, reason: "Loyer et charges d'étage" }] });
    if (paid < due) c.missedRent = (c.missedRent || 0) + 1;
    else c.missedRent = 0;
    if (c.missedRent >= 3) bankrupt(cx, c);
  }

  // Le Laboratoire vend parfois un brevet (et fait monter la pression de réalité).
  const labo = world.companies.labo;
  if (labo?.status === "active" && rng.chance(0.15)) {
    const amount = rng.int(400, 900);
    const buyer = rng.pick(Object.values(world.companies).filter((c) => c.status === "active" && c.id !== "labo" && balance(world, accountOf("c", c.id)) > amount * 2));
    const from = buyer ? accountOf("c", buyer.id) : "treasury";
    const patent = rng.pick(["l'eau qui mouille moins", "la chaise auto-réservante", "le silence en tube", "l'escalier qui descend dans les deux sens", "la photocopie de photocopie sans perte", "le formulaire qui se remplit tout seul (parfois)"]);
    cx.commit({
      source: "system",
      kind: "patent",
      ops: [{ op: "transfer", from, to: accountOf("c", "labo"), amount, reason: `Brevet : ${patent}` }, { op: "building", pressure: 4 }],
      event: { kind: "patent", title: `Le Laboratoire vend le brevet de « ${patent} »`, text: `${buyer ? buyer.name : "Le Trésor du Syndic"} achète le brevet pour ${credits(amount)}. Les murs du 7e ont vibré pendant la démonstration.`, actors: ["r-edith", buyer?.ceo].filter((id) => world.people[id]), importance: 2, tags: ["économie", "laboratoire"] },
    });
  }

  // La Gazette survit grâce aux publicités de ses amis.
  const gazette = world.companies.gazette;
  if (gazette?.status === "active") {
    const ads = Object.values(world.companies).filter((c) => c.status === "active" && c.id !== "gazette" && ["bank", "food", "plants", "startup"].includes(c.kind) && balance(world, accountOf("c", c.id)) > 400 && rng.chance(c.id === "banque" ? 0.9 : 0.25));
    if (ads.length) cx.commit({ source: "system", kind: "ads", ops: ads.map((c) => ({ op: "transfer", from: accountOf("c", c.id), to: accountOf("c", "gazette"), amount: c.id === "banque" ? 90 : 30, reason: "Encart publicitaire" })) });
  }

  bankFees(cx);
  loans(cx);
  if (cx.weekday === 5) dividends(cx);
  pricing(cx);
}

// Frais de tenue de compte : la Banque du Sous-Sol vit des grosses trésoreries
// (1 % au-delà de 2 000 cr) et prélève 2 cr aux particuliers aisés. L'argent circule, rien n'est créé.
function bankFees(cx) {
  const { world } = cx;
  if (world.companies.banque?.status !== "active") return;
  const bank = accountOf("c", "banque");
  const ops = [];
  for (const c of Object.values(world.companies)) {
    if (c.status !== "active" || ["banque", "bosscorp"].includes(c.id)) continue;
    const cash = balance(world, accountOf("c", c.id));
    if (cash > 2000) ops.push({ op: "transfer", from: accountOf("c", c.id), to: bank, amount: Math.floor((cash - 2000) / 100) + 5, reason: "Frais de tenue de compte" });
  }
  for (const p of Object.values(world.people)) {
    const acct = accountOf("p", p.id);
    if (balance(world, acct) > 500 && !world.accounts[acct].frozen) ops.push({ op: "transfer", from: acct, to: bank, amount: 2, reason: "Frais de tenue de compte" });
  }
  if (ops.length) cx.commit({ source: "system", kind: "bank_fees", flexible: true, ops });
}

function loans(cx) {
  const { world } = cx;
  for (const loan of Object.values(world.loans)) {
    if (loan.status !== "active") continue;
    const interest = Math.max(1, Math.round((loan.balance * loan.rate) / 100));
    const installment = Math.min(loan.balance + interest, Math.max(20, Math.round(loan.principal / 10)));
    const available = balance(world, loan.borrower);
    if (available >= installment && !world.accounts[loan.borrower].frozen) {
      const remaining = loan.balance + interest - installment;
      cx.commit({
        source: "system",
        kind: "repayment",
        ops: [{ op: "transfer", from: loan.borrower, to: loan.lender, amount: installment, reason: `Remboursement du prêt ${loan.id}` }, { op: "loan", id: loan.id, set: { balance: Math.max(0, remaining), status: remaining <= 0 ? "repaid" : "active" } }],
        event: remaining <= 0 ? { kind: "loan_repaid", title: `Prêt remboursé : ${ownerName(world, loan.borrower)} ne doit plus rien`, text: `${ownerName(world, loan.borrower)} solde sa dette envers ${ownerName(world, loan.lender)}.`, actors: [ownerPerson(world, loan.borrower), ownerPerson(world, loan.lender)], causes: loan.eventId ? [loan.eventId] : [], importance: 2, tags: ["économie"] } : undefined,
      });
    } else {
      cx.commit({ source: "system", kind: "interest", ops: [{ op: "loan", id: loan.id, set: { balance: loan.balance + interest, missed: (loan.missed || 0) + 1 } }] });
      if (cx.cycle >= loan.dueCycle || (loan.missed || 0) + 1 >= 4) {
        const borrower = ownerPerson(world, loan.borrower);
        const lender = ownerPerson(world, loan.lender);
        cx.commit({
          source: "system",
          kind: "loan_default",
          key: `default:${loan.id}`,
          ops: [{ op: "loan", id: loan.id, set: { status: "defaulted" } }, ...(borrower ? [{ op: "person", id: borrower, reputation: -8 }] : [])],
          event: {
            kind: "loan_default",
            title: `Défaut de paiement : ${ownerName(world, loan.borrower)} ne rembourse plus ${ownerName(world, loan.lender)}`,
            text: `Il reste ${credits(loan.balance + interest)} à rembourser. ${ownerName(world, loan.lender)} menace de saisir le Tribunal des Couloirs.`,
            actors: [borrower, lender],
            causes: loan.eventId ? [loan.eventId] : [],
            importance: 4,
            tags: ["économie", "dette"],
          },
          facts: [{ text: `${ownerName(world, loan.borrower)} est en défaut de paiement envers ${ownerName(world, loan.lender)}.`, about: [borrower, lender].filter(Boolean), public: true }],
        });
      }
    }
  }
}

function dividends(cx) {
  const { world } = cx;
  for (const c of Object.values(world.companies)) {
    if (c.status !== "active" || c.kind === "bank") continue;
    const acct = accountOf("c", c.id);
    const reserve = (c.dailyCost || 100) * 10;
    const excess = balance(world, acct) - reserve;
    if (excess < 300) continue;
    const pot = Math.floor(excess * 0.3);
    const total = Object.values(c.shares).reduce((s, n) => s + n, 0) || 1;
    const ops = [];
    for (const [holder, n] of Object.entries(c.shares)) {
      const amount = Math.floor((pot * n) / total);
      const to = holder === "boss" ? "boss" : holder === "syndic" ? "treasury" : accountOf("p", holder);
      if (amount > 0 && world.accounts[to]) ops.push({ op: "transfer", from: acct, to, amount, reason: `Dividendes ${c.name}` });
    }
    if (ops.length) cx.commit({ source: "system", kind: "dividends", ops });
  }
}

// Les dirigeants ajustent leurs prix selon la concurrence et l'inflation.
function pricing(cx) {
  const { world } = cx;
  const [a, b] = FOOD.map((id) => world.companies[id]);
  if (!a || !b || a.status !== "active" || b.status !== "active") return;
  const cashA = balance(world, accountOf("c", "refectoire"));
  const cashB = balance(world, accountOf("c", "biscuiterie"));
  if (cashA < a.dailyCost * 2 && a.price > 6) a.price -= 1;
  else if (cashA > a.dailyCost * 12 && a.price < 20) a.price += 1;
  if (cashB < b.dailyCost * 2 && b.price > 5) b.price -= 1;
  else if (cashB > b.dailyCost * 12 && b.price < 18) b.price += 1;
}

export function bankrupt(cx, company) {
  const { world } = cx;
  if (company.status !== "active" || company.id === "bosscorp") return null;
  const acct = accountOf("c", company.id);
  const staff = Object.values(world.people).filter((p) => p.employer === company.id);
  const creditors = Object.values(world.loans).filter((l) => l.borrower === acct && l.status !== "repaid");
  const ops = [{ op: "company", id: company.id, action: "set", set: { status: "bankrupt" } }];
  for (const p of staff) ops.push({ op: "person", id: p.id, set: { employer: null, salary: 0 }, career: `Sans emploi après la faillite de ${company.name}` });
  const cash = balance(world, acct);
  if (cash > 0 && creditors[0]) ops.push({ op: "transfer", from: acct, to: creditors[0].lender, amount: cash, reason: `Liquidation de ${company.name}` });
  for (const l of creditors) ops.push({ op: "loan", id: l.id, set: { status: "defaulted" } });
  return cx.commit({
    source: "system",
    kind: "bankruptcy",
    key: `bankrupt:${company.id}`,
    ops,
    event: {
      kind: "bankruptcy",
      title: `Faillite : ${company.name} ferme ses portes`,
      text: `Trois jours sans pouvoir payer son loyer : ${company.name} est liquidée. ${staff.length} personne(s) perdent leur emploi${creditors.length ? ` et ${ownerName(world, creditors[0].lender)} récupère ce qui reste` : ""}.`,
      actors: [company.ceo, ...staff.map((p) => p.id)].slice(0, 6),
      causes: cx.recent((e) => e.actors.includes(company.ceo) && ["loan_default", "unpaid_wages"].includes(e.kind), 96).map((e) => e.id).slice(-2),
      importance: 4,
      tags: ["économie", "faillite"],
    },
    facts: [{ text: `${company.name} a fait faillite.`, about: [company.ceo], public: true }],
  });
}

function monetaryPolicy(cx) {
  const { world } = cx;
  if (balance(world, "treasury") >= 30000) return;
  const amount = 40000;
  cx.commit({
    source: "system",
    kind: "mint",
    key: `mint:${cx.dayKey}`,
    allowRepeat: true,
    ops: [{ op: "mint", to: "treasury", amount, reason: "Émission hebdomadaire du Syndic" }, { op: "building", mood: -1 }],
    event: { kind: "mint", title: `Le Syndic imprime ${credits(amount)}`, text: `Le Trésor était presque vide. Arlette Tampon a signé l'émission de nouveaux Crédits. L'indice du plateau-repas passe à ${priceIndex(world).toFixed(2)} (avant émission).`, actors: ["r-arlette"].filter((id) => world.people[id]), importance: 3, tags: ["économie", "inflation"] },
  });
}

// Contrats de services : le Syndic paie ton entreprise pour son travail (missions livrées dans le QG).
function bossCorpContracts(cx) {
  const { world, state } = cx;
  const done = doneTasks(state);
  const seen = world.flags?.tasksSeen ?? done;
  world.flags = { ...world.flags, tasksSeen: done };
  const fresh = Math.max(0, done - seen);
  const ops = [];
  if (cx.hour >= 9 && cx.once("bosscontract")) {
    const posts = Object.values(world.people).filter((p) => p.employer === "bosscorp" && p.status === "active").length;
    ops.push({ op: "transfer", from: "treasury", to: accountOf("c", "bosscorp"), amount: 250 + 45 * posts, reason: `Contrat de services du Syndic (${posts} postes)` });
  }
  if (fresh) ops.push({ op: "transfer", from: "treasury", to: accountOf("c", "bosscorp"), amount: 30 * fresh, reason: `${fresh} mission(s) livrée(s) par ton entreprise` });
  if (ops.length) cx.commit({ source: "system", kind: "contract", flexible: true, ops });
}

export function ownerPerson(world, accountId) {
  if (!accountId) return null;
  if (accountId.startsWith("p:")) return accountId.slice(2);
  if (accountId.startsWith("c:")) return world.companies[accountId.slice(2)]?.ceo || null;
  if (accountId.startsWith("o:")) return world.orgs[accountId.slice(2)]?.leader || null;
  if (accountId === "treasury") return world.people["r-arlette"] ? "r-arlette" : null;
  return null;
}

export function ownerName(world, accountId) {
  if (accountId === "treasury") return "le Trésor du Syndic";
  if (accountId === "boss") return "toi (le patron)";
  if (accountId === "emp0") return "l'Employé n°0";
  if (accountId.startsWith("p:")) return world.people[accountId.slice(2)]?.name || "quelqu'un";
  if (accountId.startsWith("c:")) return world.companies[accountId.slice(2)]?.name || "une entreprise";
  if (accountId.startsWith("o:")) return world.orgs[accountId.slice(2)]?.name || "une organisation";
  return accountId;
}

// Valeur d'une part : trésorerie + rentabilité estimée.
export function sharePrice(world, company) {
  const cash = balance(world, accountOf("c", company.id));
  const value = Math.max(100, cash + (company.reputation - 30) * 40);
  return Math.max(1, Math.round(value / (company.totalShares || 100)));
}
