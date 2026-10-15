// Rapport éditorial « Pendant ton absence ». Ce n'est pas un journal brut : on retient ce qui
// a changé le Bâtiment, on explique POURQUOI (chaînes causales enregistrées) et on sépare
// clairement les faits établis, les rumeurs et les hypothèses.

import { esc, credits, localParts, HOUR } from "./core.js";
import { causalChain } from "./memory.js";
import { accountOf, balance } from "./ops.js";

const POWER_KINDS = new Set(["election", "law_enacted", "law_rejected", "coup", "coup_failed", "promotion", "floor_vote", "ruling", "found_org", "strike", "strike_end"]);
const ECONOMY_KINDS = new Set(["bankruptcy", "rescue", "mint", "loan_default", "comeback", "boss_invest", "startup", "unpaid_wages", "dividends"]);
const LABEL = { fact: "✅ Fait", rumor: "🗣️ Rumeur — non vérifiée", hypothesis: "🔮 Hypothèse" };

// Catégories comptées pour le rapport d'absence (au moment où l'événement se produit).
const MEDIA_KINDS = new Set(["article", "scoop", "smear", "leak", "viral_video", "viral_aftermath", "radio", "interview"]);
const ALLIANCE_KINDS = new Set(["found_org", "join_org", "alliance", "coalition", "pact", "merger"]);
const CRISIS_KINDS = new Set(["bankruptcy", "strike", "coup", "coup_failed", "burnout", "blackout", "meeting_meltdown", "coffee_breakdown", "supply_heist", "packages_vanish", "admin_death", "disappearance", "unpaid_wages", "loan_default", "company_trouble", "evacuation"]);
const LOSS_KINDS = new Set(["bankruptcy", "fines", "supply_heist", "theft", "loan_default", "unpaid_wages", "company_trouble", "scam", "invest_loss"]);

export function eventCategories(event) {
  const tags = event.tags || [];
  const cats = [];
  if (MEDIA_KINDS.has(event.kind) || tags.includes("médias")) cats.push("medias");
  if (ALLIANCE_KINDS.has(event.kind)) cats.push("alliances");
  if (CRISIS_KINDS.has(event.kind) || (event.importance >= 4 && tags.some((t) => ["scandale", "conflit", "dette"].includes(t)))) cats.push("crises");
  if (event.kind === "law_enacted" || event.kind === "law_rejected") cats.push("lois_votees");
  else if (event.kind === "law_proposed") cats.push("lois_proposees");
  if (LOSS_KINDS.has(event.kind) || tags.includes("vol") || tags.includes("dette")) cats.push("pertes");
  return cats;
}

function when(world, at) {
  const { hour, minute, dayKey } = localParts(world, at);
  const day = new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${day} ${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`;
}

// « Pourquoi ? » : la chaîne de causes enregistrée, de la plus ancienne à l'événement.
export function whyLine(world, event) {
  const chain = causalChain(world, event.id, 4);
  if (chain.length < 2) return null;
  return chain.slice(0, -1).map((e) => e.title).join(" → ");
}

// « RAPPORT D'ABSENCE — 8 HEURES » : uniquement des chiffres enregistrés (statistiques horaires du
// moteur, journal), et une mention honnête du temps qui n'a pas été simulé.
export function absenceSummary(world, { since, until = Date.now() }) {
  const hours = Math.max(0, (until - since) / HOUR);
  // Statistiques horaires : un créneau compte s'il a enregistré de l'activité pendant l'absence.
  const buckets = (world.metrics || []).filter((b) => (b.last ?? b.at) > since && b.at <= until);
  const sum = (key) => buckets.reduce((n, b) => n + (b[key] || 0), 0);
  const cycles = sum("cycles");
  const rareByFloor = {};
  for (const b of buckets) for (const [k, v] of Object.entries(b)) if (k.startsWith("rare_")) rareByFloor[k.slice(5)] = (rareByFloor[k.slice(5)] || 0) + v;
  // Cibles des médias : personnes citées par les médias (hors journalistes), d'après le journal.
  const targets = {};
  for (const e of world.events) {
    if (!(e.at > since && e.at <= until) || !e.public || !eventCategories(e).includes("medias")) continue;
    for (const id of e.actors || []) {
      const p = world.people[id];
      if (p && p.dept !== "medias" && p.kind !== "animal") targets[id] = (targets[id] || 0) + 1;
    }
  }
  const gaps = (world.gaps || []).filter((g) => g.to > since && g.from < until);
  const skippedMs = gaps.reduce((n, g) => n + Math.max(0, Math.min(g.to, until) - Math.max(g.from, since)), 0);
  const step = world.config.cycleMinutes * 60000;
  const behindMs = Math.max(0, until - world.lastCycleAt - step);
  const oldest = world.metrics?.[0]?.at ?? until;
  return {
    hours,
    cycles,
    simulatedHours: (cycles * world.config.cycleMinutes) / 60,
    counts: {
      events: sum("events"),
      rare: sum("rare"),
      relations: sum("relations"),
      met: sum("met"),
      rumors: sum("rumors") + sum("rumors_spread"),
      alliances: sum("cat_alliances"),
      crises: sum("cat_crises"),
      lawsVoted: sum("cat_lois_votees"),
      lawsProposed: sum("cat_lois_proposees"),
      losses: sum("cat_pertes"),
      moneyLost: sum("money_lost"),
      arguments: sum("arguments"),
      romances: sum("romances"),
      moves: sum("moves"),
    },
    rareByFloor: Object.entries(rareByFloor).map(([floor, n]) => ({ floor, name: world.building.floors[floor]?.short || floor, n })).sort((a, b) => b.n - a.n),
    mediaTargets: Object.entries(targets).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ id, name: world.people[id].name, n })),
    skippedHours: skippedMs / HOUR,
    behindHours: behindMs / HOUR,
    partial: oldest > since + HOUR,
  };
}

function hoursLabel(h) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} MINUTES`;
  const n = Math.round(h);
  return n >= 48 ? `${Math.round(h / 24)} JOURS` : `${n} HEURE${n > 1 ? "S" : ""}`;
}

function absenceLines(a) {
  const c = a.counts;
  const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
  const lines = [];
  lines.push(`${plural(a.cycles, "cycle simulé", "cycles simulés")} (${Math.round(a.simulatedHours * 10) / 10} h de vie du Bâtiment)`);
  lines.push(`${plural(c.events, "événement")}${c.rare ? `, dont ${plural(c.rare, "rare")}` : ""}${a.rareByFloor.length ? ` (${a.rareByFloor.map((f) => `${f.name} : ${f.n}`).join(", ")})` : ""}`);
  lines.push(`${plural(c.relations, "relation a changé de nature", "relations ont changé de nature")} (amitiés, rivalités…) · ${plural(c.met, "nouvelle connaissance", "nouvelles connaissances")}`);
  lines.push(`${plural(c.arguments, "dispute")} · ${plural(c.romances, "idylle")}`);
  lines.push(`${plural(c.rumors, "rumeur nouvelle ou propagée", "rumeurs nouvelles ou propagées")} · ${plural(c.alliances, "alliance ou adhésion", "alliances ou adhésions")}`);
  lines.push(`${plural(c.crises, "crise")} · ${plural(c.lawsVoted, "loi votée ou rejetée", "lois votées ou rejetées")}${c.lawsProposed ? ` · ${plural(c.lawsProposed, "loi proposée", "lois proposées")}` : ""}`);
  if (c.losses) lines.push(`${plural(c.losses, "perte d'argent", "pertes d'argent")}${c.moneyLost ? ` : ${credits(c.moneyLost)} au total` : ""}`);
  if (a.mediaTargets.length) lines.push(`Cibles des médias : ${a.mediaTargets.map((t) => `${t.name}${t.n > 1 ? ` (×${t.n})` : ""}`).join(", ")}`);
  const honest = [];
  if (a.skippedHours >= 0.5) honest.push(`${Math.round(a.skippedHours)} h n'ont PAS été simulées (serveur arrêté au-delà de la limite de rattrapage) : rien n'y est inventé`);
  if (a.behindHours >= 0.5) honest.push(`rattrapage en cours : ${Math.round(a.behindHours * 10) / 10} h restent à simuler`);
  if (a.partial) honest.push("statistiques détaillées conservées 8 jours : le début de la période n'est pas compté");
  honest.push("chiffres issus des statistiques horaires du moteur (à l'heure près)");
  return { lines, honest };
}

export function buildReport(world, { since = 0, until = Date.now(), max = 6 } = {}) {
  const events = world.events.filter((e) => e.public && e.at > since && e.at <= until);
  const notableEvents = events.filter((e) => e.importance >= 3);
  const sections = [];

  // 1. Faits majeurs, avec leur chaîne causale.
  const major = [...notableEvents].filter((e) => !POWER_KINDS.has(e.kind) && !ECONOMY_KINDS.has(e.kind) && !["clue", "hypothesis", "plot_end", "plot_merge"].includes(e.kind)).sort((a, b) => b.importance - a.importance || b.at - a.at).slice(0, max);
  if (major.length) sections.push({ icon: "⚡", title: "Ce qui s'est passé", items: major.map((e) => ({ label: "fact", text: e.title, detail: e.text, why: whyLine(world, e), at: e.at, rare: e.rare })) });

  // 2. Pouvoir : élections, lois, coups, verdicts.
  const power = notableEvents.filter((e) => POWER_KINDS.has(e.kind)).slice(-max);
  if (power.length) sections.push({ icon: "👑", title: "Pouvoir et institutions", items: power.map((e) => ({ label: "fact", text: e.title, detail: e.text, why: whyLine(world, e), at: e.at })) });

  // 3. Économie.
  const eco = notableEvents.filter((e) => ECONOMY_KINDS.has(e.kind)).slice(-max);
  if (eco.length) sections.push({ icon: "💰", title: "Économie", items: eco.map((e) => ({ label: "fact", text: e.title, detail: e.text, why: whyLine(world, e), at: e.at })) });

  // 4. Intrigues : en cours, réveillées, résolues.
  const plots = Object.values(world.plots).filter((p) => p.beats.some((id) => events.some((e) => e.id === id)) || (p.resolution && world.events.find((e) => e.key === `plotend:${p.id}`)?.at > since));
  if (plots.length) {
    sections.push({
      icon: "🧵",
      title: "Intrigues",
      items: plots.slice(0, max).map((p) => ({ label: "fact", text: `${p.title} — ${{ active: "en cours", dormant: "en sommeil", resolved: "dénouée", failed: "échec", merged: "fusionnée", forgotten: "oubliée" }[p.state] || p.state}`, detail: p.resolution?.text || `${p.beats.length} épisode(s). Enjeu : ${p.goals || "?"}. Conflit : ${p.conflict || "?"}.` })),
    });
  }

  // 5. Ascensions et chutes (influence).
  const moves = [];
  for (const p of Object.values(world.people)) {
    const hist = p.influenceHistory || [];
    if (hist.length < 2) continue;
    const sinceDay = localParts(world, since).dayKey;
    const base = hist.find((h) => h.day >= sinceDay) || hist[0];
    const delta = (hist.at(-1).value || 0) - (base.value || 0);
    if (Math.abs(delta) >= 5) moves.push({ p, delta });
  }
  moves.sort((a, b) => b.delta - a.delta);
  const risers = moves.filter((m) => m.delta > 0).slice(0, 3);
  const fallers = moves.filter((m) => m.delta < 0).slice(-3).reverse();
  if (risers.length || fallers.length) {
    sections.push({ icon: "📈", title: "Ascensions et chutes", items: [...risers.map((m) => ({ label: "fact", text: `▲ ${m.p.name} (+${m.delta} d'influence)`, detail: m.p.title })), ...fallers.map((m) => ({ label: "fact", text: `▼ ${m.p.name} (${m.delta} d'influence)`, detail: m.p.title }))] });
  }

  // 6. Mystères : indices publics, hypothèses (jamais présentées comme des faits).
  const mysteryItems = [];
  for (const e of events.filter((x) => x.kind === "clue")) mysteryItems.push({ label: "fact", text: e.title, detail: e.text, at: e.at });
  for (const e of events.filter((x) => x.kind === "hypothesis")) mysteryItems.push({ label: "hypothesis", text: e.title, detail: e.text, at: e.at });
  for (const e of events.filter((x) => x.kind === "mystery_solved")) mysteryItems.push({ label: "fact", text: e.title, detail: e.text, why: whyLine(world, e), at: e.at });
  if (mysteryItems.length) sections.push({ icon: "🔍", title: "Mystères", items: mysteryItems.slice(-max) });

  // 7. Rumeurs en circulation (véracité inconnue du lecteur).
  const rumors = Object.values(world.facts).filter((f) => f.public && ["rumor", "hypothesis"].includes(f.status) && !f.mystery && world.events.some((e) => e.id === f.source && e.at > since));
  const looseRumors = Object.values(world.facts).filter((f) => f.public && f.status === "rumor" && f.cycle >= cycleAt(world, since));
  const rumorList = [...new Map([...rumors, ...looseRumors].map((f) => [f.id, f])).values()].slice(-4);
  if (rumorList.length) sections.push({ icon: "🗣️", title: "Rumeurs", items: rumorList.map((f) => ({ label: f.status === "hypothesis" ? "hypothesis" : "rumor", text: f.text })) });

  // 8. Décisions qui t'attendent.
  const open = world.decisions.filter((d) => d.status === "open");
  if (open.length) sections.push({ icon: "🧾", title: "Décisions qui t'attendent", items: open.map((d) => ({ label: "fact", text: d.title, decisionId: d.id })) });

  for (const s of sections) s.items = dedupe(s.items);
  const rare = events.filter((e) => e.rare);
  const notable = notableEvents.length + open.length;
  const head = {
    title: since ? "Pendant ton absence" : "État du Bâtiment",
    span: since ? `${when(world, since)} → ${when(world, until)}` : when(world, until),
    counts: { events: events.length, notable: notableEvents.length, rare: rare.length, rejected: world.proposals.filter((p) => p.status === "rejected" && p.cycle >= cycleAt(world, since)).length },
    weather: weather(world),
  };
  const absence = since && until - since >= HOUR ? absenceSummary(world, { since, until }) : null;
  if (absence) head.title = `RAPPORT D'ABSENCE — ${hoursLabel(absence.hours)}`;
  const report = { ...head, notable, sections, absence, stats: absence ? absenceLines(absence) : null };
  report.html = toHtml(world, report);
  report.text = toText(report);
  return report;
}

// Les répétitions (« Salaires impayés » trois jours de suite) sont regroupées : ×3.
function dedupe(items) {
  const out = [];
  for (const item of items) {
    const same = out.find((x) => x.text === item.text && x.label === item.label);
    if (same) same.times = (same.times || 1) + 1;
    else out.push({ ...item });
  }
  for (const x of out) if (x.times > 1) x.text = `${x.text} (×${x.times})`;
  return out;
}

function cycleAt(world, at) {
  const step = world.config.cycleMinutes * 60000;
  return world.cycle - Math.max(0, Math.floor((world.lastCycleAt - at) / step));
}

function weather(world) {
  const mood = world.mood >= 70 ? "☀️ euphorique" : world.mood >= 50 ? "🌤️ correct" : world.mood >= 35 ? "🌧️ tendu" : "⛈️ explosif";
  const pressure = world.building.pressure >= 70 ? "la réalité se fissure" : world.building.pressure >= 45 ? "des choses bougent dans les murs" : "le Bâtiment se tient tranquille";
  const elevator = world.building.elevator.mood >= 60 ? "l'Ascenseur B est de bonne humeur" : world.building.elevator.mood >= 35 ? "l'Ascenseur B boude" : "l'Ascenseur B refuse des passagers";
  return `Humeur ${mood} · ${pressure} · ${elevator} · Trésor du Syndic : ${credits(balance(world, "treasury"))} · ton entreprise : ${credits(balance(world, accountOf("c", "bosscorp")))}`;
}

function toHtml(world, r) {
  const lines = [`<b>🏢 ${esc(world.name)} — ${esc(r.title)}</b>`, `<i>${esc(r.span)}</i>`, esc(r.weather)];
  if (r.absence) {
    const { lines: stats, honest } = absenceLines(r.absence);
    lines.push("", "<b>📊 En chiffres</b>", ...stats.map((l) => `• ${esc(l)}`), ...honest.map((l) => `<i>⚠️ ${esc(l)}</i>`));
  }
  if (!r.sections.length) lines.push("", "Rien de notable. Le Bâtiment fait semblant de dormir.");
  for (const s of r.sections) {
    lines.push("", `<b>${s.icon} ${esc(s.title)}</b>`);
    for (const item of s.items) {
      const tag = item.label === "fact" ? "" : `<i>[${esc(LABEL[item.label])}]</i> `;
      lines.push(`• ${tag}${item.rare ? "✨ " : ""}${esc(item.text)}`);
      if (item.why) lines.push(`   <i>↳ pourquoi : ${esc(item.why)}</i>`);
    }
  }
  lines.push("", `<i>${r.counts.events} événement(s) publics, ${r.counts.rare} rare(s). Validateur : ${r.counts.rejected} proposition(s) rejetée(s).</i>`);
  return clip(lines.join("\n"), 3900);
}

function toText(r) {
  const lines = [`🏢 ${r.title} (${r.span})`, r.weather];
  if (r.absence) {
    const { lines: stats, honest } = absenceLines(r.absence);
    lines.push("", "📊 En chiffres", ...stats.map((l) => `• ${l}`), ...honest.map((l) => `⚠️ ${l}`));
  }
  for (const s of r.sections) {
    lines.push("", `${s.icon} ${s.title}`);
    for (const item of s.items) {
      lines.push(`• ${item.label === "fact" ? "" : `[${LABEL[item.label]}] `}${item.text}`);
      if (item.why) lines.push(`   ↳ pourquoi : ${item.why}`);
    }
  }
  return clip(lines.join("\n"), 3900);
}

// Coupe proprement (sans casser une balise HTML) pour respecter la limite Telegram.
export function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastBreak = cut.lastIndexOf("\n");
  return `${cut.slice(0, lastBreak > 0 ? lastBreak : max)}\n…`;
}
