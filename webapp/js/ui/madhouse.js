// 🏚️ THE MADHOUSE — Bâtiment 0 : explorateur de la mini app.
// Coupe du bâtiment → étage → pièce → personnage, annuaire paginé, actualités, enquêtes,
// économie, politique, anomalies, historique et Centre de contrôle du propriétaire.
// Le monde complet n'est jamais dans le polling : chaque écran est demandé au backend
// (requête « world.explore ») et rafraîchi quand un nouveau cycle est simulé.

import { h, clear, toast, haptic, openModal, timeAgo } from "./dom.js";
import { section, empty } from "./components.js";

const TABS = [
  ["explore", "🏢", "Explorer"],
  ["directory", "👥", "Annuaire"],
  ["news", "📰", "Actus"],
  ["investigations", "🔎", "Enquêtes"],
  ["companies", "💼", "Entreprises"],
  ["politics", "🗳️", "Politique"],
  ["anomalies", "🌀", "Anomalies"],
  ["history", "📜", "Historique"],
  ["control", "🎛️", "Contrôle"],
];
const KIND_ICON = { work: "💼", meeting: "🗣️", food: "🍽️", social: "☕", rest: "🛏️", transit: "🛗", special: "🌀", secret: "🕳️", owner: "👑" };
const LAW_STATUS = { proposed: "🗳️ en discussion", enacted: "✅ en vigueur", rejected: "❌ rejetée", annulled: "⚖️ annulée", repealed: "🗑️ abrogée" };
const cr = (n) => `${Math.round(n).toLocaleString("fr-FR")} cr`;
const initials = (name) => name.split(/\s+/).filter((w) => /^[A-ZÀ-Ý]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || name[0];
const hue = (id) => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 360, 7);

function tag(label, kind = "") {
  return h("span", { class: `mh-tag ${kind}` }, label);
}

async function act(ctx, type, payload, ok) {
  try {
    const res = await ctx.backend.action(type, payload);
    haptic("success");
    toast(`${ok || ""} ${res?.title || "C'est fait."}`.trim(), "success", 5000);
    return res;
  } catch (err) {
    toast(err.message, "error", 5000);
    return null;
  }
}

function eventCard(e, now, nav) {
  return h("div", { class: `card mh-event imp-${e.importance}${e.rare ? " rare" : ""}${e.source === "debug" ? " debug" : ""}` },
    h("div", { class: "row" }, h("strong", { class: "grow" }, `${e.rare ? "✨ " : ""}${e.source === "player" ? "👑 " : e.source === "debug" ? "🧪 " : ""}${e.title}`), h("span", { class: "small muted" }, timeAgo(e.at, now))),
    e.roomName ? h("button", { class: "mh-link small", onClick: () => nav({ view: "room", id: e.room }) }, `📍 ${e.roomName}`) : null,
    h("p", { class: "small" }, e.text),
    ...(e.dialogue || []).map((d) => h("div", { class: "mh-bubble small" }, h("b", {}, d.who), " ", d.line)),
    e.narration ? h("p", { class: "small mh-narration" }, `🖋️ ${e.narration}`) : null,
    e.why ? h("p", { class: "small muted" }, `↳ pourquoi : ${e.why}`) : null);
}

function pawn(p, onClick) {
  return h("button", { class: `mh-pawn${p.asleep ? " asleep" : ""}${p.star ? " star" : ""}`, onClick, title: `${p.name} — ${p.activity}` },
    h("span", { class: "mh-face", style: { "--h": hue(p.id) } }, p.animal ? "🐾" : initials(p.name)),
    h("span", { class: "mh-pawn-text" }, h("b", {}, `${p.mood} ${p.name}`), h("span", { class: "small muted" }, p.title), h("span", { class: "small" }, p.activity)));
}

// ------------------------------------------------------------------ écrans

function buildingScreen(v, nav) {
  return [
    h("div", { class: "card mh-hero" },
      h("div", { class: "row wrap" }, h("strong", { class: "grow" }, v.name), tag(v.clock, "info")),
      h("div", { class: "small muted" }, `${v.population} habitants · ${v.awake} éveillés${v.missing ? ` · ${v.missing} disparu(s)` : ""} · humeur ${v.mood}/100 · pression ${v.pressure}/100 · Ascenseur B ${v.elevator}/100`),
      v.ghost.open ? h("div", { class: "small mh-ghost-note" }, "🌀 L'Étage fantôme est ouvert cette nuit.") : null),
    h("div", { class: "mh-building" },
      h("div", { class: "mh-roof" }, "▲ ▲ ▲"),
      ...v.floors.map((f) => h("button", { class: `mh-floor-bar ${f.kind}${f.access ? " locked" : ""}${f.hot ? " hot" : ""}`, onClick: () => nav({ view: "floor", id: f.id }) },
        h("span", { class: "mh-level" }, String(f.level)),
        h("span", { class: "grow mh-floor-name" }, h("b", {}, f.short), h("span", { class: "small muted" }, f.lastEvent || f.blurb)),
        h("span", { class: "mh-dots" }, ...Array.from({ length: Math.min(10, Math.ceil(f.people / 3)) }, () => h("i"))),
        h("span", { class: "small" }, `${f.people} 👥`),
        f.access ? h("span", {}, "🔒") : f.hot ? h("span", {}, "🔥") : f.rule ? h("span", {}, "📌") : null)),
      v.ghost.rumor ? h("div", { class: "mh-floor-bar ghost-rumor small" }, "❔ On parle d'un Étage 10. L'ascenseur passe du 9 au 11.") : null,
      h("div", { class: "mh-ground" })),
    v.headlines.length ? section("⚡ À la une", h("div", { class: "stack" }, v.headlines.map((e) => eventCard(e, Date.now(), nav)))) : null,
  ];
}

function floorScreen(f, nav) {
  return [
    h("div", { class: "card mh-hero" }, h("strong", {}, f.name), h("p", { class: "small muted" }, f.blurb), h("p", { class: "small" }, f.summary), f.rule ? tag(`📌 ${f.rule}`, "warn") : null),
    h("div", { class: "mh-rooms" }, f.rooms.map((r) => h("button", { class: `mh-room ${r.kind}${r.people ? "" : " empty"}`, onClick: () => nav({ view: "room", id: r.id }) },
      h("div", { class: "row" }, h("span", { class: "mh-room-icon" }, KIND_ICON[r.kind] || "▫️"), h("b", { class: "grow" }, r.name), h("span", { class: "small" }, `${r.people} 👥`)),
      r.sample[0] ? h("div", { class: "small" }, r.sample[0]) : h("div", { class: "small muted" }, "personne"),
      r.lastEvent ? h("div", { class: "small muted" }, `🎬 ${r.lastEvent.title}`) : null,
      r.locked ? tag(`🔒 ${r.locked}`) : null,
      r.offPlan ? tag("hors Plan", "warn") : null))),
    f.events.length ? section("📰 Actualités de l'étage", h("div", { class: "stack" }, f.events.slice(0, 5).map((e) => eventCard(e, Date.now(), nav)))) : null,
  ];
}

function roomScreen(r, nav, ctx, refresh) {
  const pager = r.pages > 1 ? h("div", { class: "row" }, h("button", { class: "btn small", disabled: r.page === 0, onClick: () => nav({ view: "room", id: r.id, page: r.page - 1 }, true) }, "◀️"), h("span", { class: "small grow center" }, `page ${r.page + 1}/${r.pages}`), h("button", { class: "btn small", disabled: r.page >= r.pages - 1, onClick: () => nav({ view: "room", id: r.id, page: r.page + 1 }, true) }, "▶️")) : null;
  return [
    h("div", { class: `card mh-hero room ${r.kind}` },
      h("div", { class: "row wrap" }, h("strong", { class: "grow" }, `${KIND_ICON[r.kind] || ""} ${r.name}`), tag(r.floor.short), r.offPlan ? tag("hors Plan", "warn") : null),
      h("p", { class: "small" }, r.desc),
      r.rule ? tag(`📌 ${r.rule}`, "warn") : null,
      h("div", { class: "row wrap" },
        h("button", { class: "btn small", onClick: refresh }, "👀 Observer"),
        ["social", "food", "meeting"].includes(r.kind) ? h("button", { class: "btn small", onClick: async () => { if (await act(ctx, "world.organize", { roomId: r.id, kind: "fete" }, "🎉")) refresh(); } }, "🎉 Organiser une fête ici") : null)),
    section(`👥 Présents (${r.total})`, r.empty ? h("div", {}, empty("Personne ici pour l'instant."), r.suggestions.length ? h("div", { class: "row wrap" }, h("span", { class: "small muted" }, "Ça bouge plutôt ici :"), ...r.suggestions.map((s) => h("button", { class: "chip", onClick: () => nav({ view: "room", id: s.id }) }, `${s.name} (${s.people})`))) : null) : h("div", { class: "mh-pawns" }, r.present.map((p) => pawn(p, () => nav({ view: "person", id: p.id }))))),
    pager,
    r.events.length ? section("🎬 Ce qui s'est passé ici", h("div", { class: "stack" }, r.events.slice(0, 5).map((e) => eventCard(e, Date.now(), nav)))) : r.older.length ? section("🗂️ Archives de la pièce", h("div", { class: "stack" }, r.older.map((l) => h("div", { class: "small" }, `• ${l.title}`)))) : null,
    r.objects.length ? section("🔍 Objets", h("div", { class: "stack" }, r.objects.map((o) => h("button", { class: "card mh-object", onClick: () => objectModal(o) }, h("div", { class: "row" }, h("b", { class: "grow" }, o.name), tag(o.state)), h("div", { class: "small muted" }, o.desc))))) : null,
    r.leads.length ? section("🧵 Pistes", h("div", { class: "row wrap" }, r.leads.map((l) => h("button", { class: "chip", onClick: () => nav({ view: "investigations" }) }, `🧵 ${l.title}`)))) : null,
    r.exits.length ? section("🚪 Sorties", h("div", { class: "row wrap" }, r.exits.map((x) => h("button", { class: "chip", onClick: () => nav({ view: x.id.endsWith(".palier") ? "floor" : "room", id: x.id.endsWith(".palier") ? r.floor.id : x.id }) }, x.name)))) : null,
  ];
}

function objectModal(o) {
  openModal({ title: `🔍 ${o.name}`, body: h("div", { class: "stack" }, tag(o.state), h("p", { class: "small" }, o.desc), ...(o.history || []).map((t) => h("div", { class: "small muted" }, `• ${t}`))) });
}

function personScreen(p, nav, ctx, refresh) {
  const line = (label, value) => (value ? h("div", { class: "small" }, h("b", {}, `${label} : `), value) : null);
  return [
    h("div", { class: "card mh-hero" },
      h("div", { class: "row" }, h("span", { class: "mh-face big", style: { "--h": hue(p.id) } }, p.kind === "animal" ? "🐾" : initials(p.name)), h("div", { class: "grow" }, h("strong", {}, `${p.name}${p.age ? `, ${p.age} ans` : ""}`), h("div", { class: "small muted" }, `${p.title} · ${p.dept || ""}`)), h("span", { style: { fontSize: "24px" } }, p.mood.emoji)),
      h("div", { class: "row wrap" }, tag(p.status), p.legend ? tag("🌟 légende", "gold") : null, p.deputy ? tag("🏛️ député") : null, p.star ? tag("⭐ personnage clé", "info") : null, p.followed ? tag("suivi", "good") : null),
      p.location ? h("button", { class: "mh-link", onClick: () => nav({ view: "room", id: p.location.id }) }, `📍 ${p.location.name} (${p.location.floor}) — ${p.activity}`) : h("div", { class: "small" }, p.activity),
      h("div", { class: "row wrap" },
        h("button", { class: "btn small", onClick: async () => { if (await act(ctx, p.followed ? "world.unfollow" : "world.follow", { personId: p.id })) refresh(); } }, p.followed ? "☆ Ne plus suivre" : "⭐ Suivre"),
        p.kind !== "animal" ? h("button", { class: "btn small", onClick: async () => { if (await act(ctx, "world.promote", { personId: p.id }, "🎖️")) refresh(); } }, "🎖️ Promouvoir") : null)),
    section("🧠 Personnalité", h("div", { class: "stack" },
      line("Caractère", p.personality.join(", ")),
      p.quirk ? h("div", { class: "small mh-narration" }, `« ${p.quirk} »`) : null,
      line("Aime", p.likes.join(", ")),
      line("Défauts", p.flaws.join(", ")),
      line("Peurs", p.fears.join(", ")),
      line("Habitudes", p.habits.join(", ")),
      line("Humour", `${p.humor.styles.join(", ")} — ${p.humor.refs}`),
      line("Compétences", p.skills.map((k) => `${k.label} ${k.value}`).join(" · ")))),
    section("🎯 Objectifs & état", h("div", { class: "stack" },
      line("Court terme", p.goals.short),
      line("Long terme", p.goals.long),
      line("Ambition", p.ambition),
      p.conviction ? line("Conviction", `« ${p.conviction} »`) : null,
      p.needs ? line("Besoins", `énergie ${p.needs.energy} · faim ${p.needs.hunger} · vie sociale ${p.needs.social} · stress ${p.needs.stress}`) : null,
      line("Ressources", `${cr(p.wealth)}${p.frozen ? " (compte gelé)" : ""} · réputation ${p.reputation}/100 · influence ${p.influence}/100`),
      p.secretsKept ? line("Secrets", `en garde ${p.secretsKept} (contenu inconnu)`) : null)),
    p.relationsDetail.length ? section("❤️ Relations", h("div", { class: "stack" }, p.relationsDetail.map((r) => h("button", { class: "mh-link small", onClick: () => nav({ view: "person", id: r.id }) }, `${r.name} — ${r.describe}${r.note ? ` (${r.note})` : ""}`)))) : null,
    p.opinions.length ? section("🗣️ Rumeurs", h("div", { class: "stack" }, p.opinions.map((o) => h("div", { class: "small" }, tag(o.stance === "croit" ? "y croit" : o.stance === "doute" ? "doute" : "veut s'en servir", o.stance === "croit" ? "warn" : "info"), ` ${o.text}`)))) : null,
    p.recent.length ? section("🕘 Dernières actions", h("div", { class: "stack" }, p.recent.map((t) => h("div", { class: "small" }, `• ${t}`)))) : null,
    p.career.length ? section("📈 Carrière", h("div", { class: "stack" }, p.career.map((t) => h("div", { class: "small" }, `• ${t}`)))) : null,
  ];
}

function directoryScreen(d, nav, state) {
  const search = h("input", { class: "input", placeholder: "Chercher un nom ou un métier…", value: state.q || "" });
  search.addEventListener("keydown", (e) => { if (e.key === "Enter") nav({ view: "directory", q: search.value, page: 0 }, true); });
  return [
    h("div", { class: "row" }, search, h("button", { class: "btn small", onClick: () => nav({ view: "directory", q: search.value, page: 0 }, true) }, "🔎")),
    h("div", { class: "small muted" }, `${d.total} personne(s) · page ${d.page + 1}/${d.pages}`),
    h("div", { class: "stack" }, d.items.map((p) => h("button", { class: "card row mh-person", onClick: () => nav({ view: "person", id: p.id }) },
      h("span", { class: "mh-face", style: { "--h": hue(p.id) } }, p.animal ? "🐾" : initials(p.name)),
      h("div", { class: "grow" }, h("strong", {}, `${p.mood} ${p.name}${p.star ? " ⭐" : ""}`), h("div", { class: "small muted" }, `${p.title} · 📍 ${p.where} (${p.floor})`)),
      h("span", { class: "small" }, `${p.influence}`)))),
    h("div", { class: "row" }, h("button", { class: "btn small", disabled: d.page === 0, onClick: () => nav({ view: "directory", q: state.q, page: d.page - 1 }, true) }, "◀️ Précédent"), h("span", { class: "grow" }), h("button", { class: "btn small", disabled: d.page >= d.pages - 1, onClick: () => nav({ view: "directory", q: state.q, page: d.page + 1 }, true) }, "Suivant ▶️")),
  ];
}

// Rapport d'absence chiffré (statistiques du moteur), en tête des actus tant qu'il n'est pas lu.
function absenceCard(report, ctx, refresh) {
  if (!report?.absence || !report.stats) return null;
  return h("div", { class: "card mh-absence" },
    h("b", {}, `📊 ${report.title}`),
    h("div", { class: "small muted" }, report.span),
    h("ul", { class: "small" }, report.stats.lines.map((l) => h("li", {}, l))),
    ...report.stats.honest.map((l) => h("div", { class: "small muted" }, `⚠️ ${l}`)),
    h("div", { class: "row" }, h("span", { class: "grow" }), h("button", { class: "btn small", onClick: async () => { if (await act(ctx, "world.seen", {}, "📭")) refresh(); } }, "✔️ Marquer comme lu")));
}

function newsScreen(n, nav, report = null, ctx = null, refresh = () => {}) {
  return [
    n.page === 0 ? absenceCard(report, ctx, refresh) : null,
    h("div", { class: "stack" }, n.items.map((e) => eventCard(e, Date.now(), nav))),
    n.items.length ? null : empty("Rien de notable pour l'instant."),
    h("div", { class: "row" }, h("button", { class: "btn small", disabled: n.page === 0, onClick: () => nav({ view: "news", page: n.page - 1 }, true) }, "◀️ Plus récent"), h("span", { class: "grow" }), h("button", { class: "btn small", disabled: n.page >= n.pages - 1, onClick: () => nav({ view: "news", page: n.page + 1 }, true) }, "Plus ancien ▶️")),
    n.media.length && n.page === 0 ? section("🗞️ La Gazette & la Radio (peuvent se tromper)", h("div", { class: "stack" }, n.media.map((a) => h("div", { class: "card small" }, tag(a.outlet), a.satire ? tag("satire", "warn") : null, h("b", {}, ` ${a.title}`), h("p", {}, a.text))))) : null,
  ];
}

function investigationsScreen(v, nav, ctx, refresh, rumorsFull) {
  return [
    section("🔍 Mystères", h("div", { class: "stack" }, v.mysteries.map((m) => h("div", { class: `card mh-mystery ${m.status}` },
      h("div", { class: "row wrap" }, h("strong", { class: "grow" }, m.title), tag({ open: "ouvert", solved: "résolu", cold: "classé" }[m.status] || m.status, m.status === "open" ? "info" : m.status === "solved" ? "good" : "")),
      h("p", { class: "small muted" }, m.question),
      h("div", { class: "small" }, `Indices : ${m.cluesFound}/${m.cluesTotal} · enquêteurs : ${m.investigators.map((i) => i.name).join(", ") || "personne"}`),
      ...m.publicClues.map((c) => h("div", { class: "small" }, `🧩 ${c}`)),
      ...m.hypotheses.slice(-2).map((x) => h("div", { class: "small" }, `🔮 ${x.by} : « ${x.text} » (${x.verdict})`)),
      m.solution ? h("div", { class: "small" }, `✅ ${m.solution.text} — ${m.solution.by}`) : null)))),
    section("🧵 Affaires", v.arcs.length ? h("div", { class: "stack" }, v.arcs.map((a) => h("div", { class: "card small" }, h("div", { class: "row" }, h("b", { class: "grow" }, a.title), tag({ active: "en cours", resolved: "dénouée", failed: "échec", dormant: "en sommeil" }[a.state] || a.state)), h("div", { class: "muted" }, a.cast.join(", ")), ...a.steps.map((s) => h("div", {}, `↳ ${s}`))))) : empty("Aucune affaire pour l'instant.")),
    section("🗣️ Rumeurs publiques (non vérifiées)", rumorsFull.length ? h("div", { class: "stack" }, rumorsFull.map((f) => h("div", { class: "card small row" }, h("span", { class: "grow" }, f.text), f.investigation ? tag(f.investigation.verdict ? `jugée ${f.investigation.verdict}` : "enquête en cours", "info") : h("button", { class: "btn small", onClick: async () => { if (await act(ctx, "world.investigateRumor", { factId: f.id }, "🕵️")) refresh(); } }, "🕵️ Vérifier")))) : empty("Rien ne circule. C'est presque inquiétant.")),
    v.gags.length ? section("🔁 Running gags", h("div", { class: "row wrap" }, v.gags.map((g) => tag(`${g.label} ×${g.count}`)))) : null,
  ];
}

function companiesScreen(e, ctx, refresh) {
  return [
    h("p", { class: "small muted" }, `${e.currency} — aucune transaction réelle n'est jamais effectuée.`),
    h("div", { class: "kpis mh-kpis" }, h("div", { class: "kpi" }, h("b", {}, cr(e.total)), h("span", {}, "masse monétaire")), h("div", { class: "kpi" }, h("b", {}, cr(e.treasury)), h("span", {}, "Trésor")), h("div", { class: "kpi" }, h("b", {}, String(e.priceIndex)), h("span", {}, "indice des prix"))),
    section("📊 Indicateurs (absurdes mais calculés)", h("div", { class: "stack" }, e.indicators.map((i) => h("div", { class: "row small" }, h("span", { class: "grow" }, i.label), h("b", {}, i.value))))),
    section("🏭 Entreprises", h("div", { class: "stack" }, e.companies.map((c) => h("div", { class: "card" }, h("div", { class: "row" }, h("strong", { class: "grow" }, `${c.status === "active" ? "🟢" : "💀"} ${c.name}`), h("b", {}, cr(c.cash))), h("div", { class: "small muted" }, `PDG ${c.ceo} · ${c.floor} · part ${cr(c.sharePrice)}`), c.status === "active" && c.id !== "bosscorp" ? h("button", { class: "btn small", onClick: async () => { if (await act(ctx, "world.fund", { companyId: c.id, amount: 500 }, "💸")) refresh(); } }, "💸 Financer (500 cr)") : null)))),
    e.loans.length ? section("🏦 Prêts", h("div", { class: "stack" }, e.loans.map((l) => h("div", { class: "small" }, `${l.borrower} doit ${cr(l.balance)} à ${l.lender} — ${l.status}`)))) : null,
  ];
}

function politicsScreen(v, ctx, refresh, catalog) {
  const select = h("select", { class: "select" }, catalog.map(([code, d]) => h("option", { value: code }, d.title)));
  return [
    section("🏛️ Hémicycle", h("div", { class: "card small" }, `Sièges : ${v.parliament.seats.join(", ")}`, h("br"), `Présidence : ${v.parliament.speaker} · élections dans ${Math.round(v.parliament.cyclesToElection / 48)} jour(s)`)),
    section("📜 Souffler une loi (200 cr à un député, vote libre)", h("div", { class: "row" }, select, h("button", { class: "btn small primary", onClick: async () => { if (await act(ctx, "world.proposeLaw", { code: select.value }, "📜")) refresh(); } }, "Déposer"))),
    section("🤝 Organisations", h("div", { class: "stack" }, v.orgs.map((o) => h("div", { class: "card small" }, h("b", {}, o.name), ` (${o.kind}) — ${o.members} membres, dirigé par ${o.leader}`, h("div", { class: "muted" }, o.goal || ""))))),
    section("⚖️ Lois", h("div", { class: "stack" }, v.laws.map((l) => h("div", { class: "card small" }, h("b", {}, `${LAW_STATUS[l.status] || l.status} — ${l.title}`), h("div", {}, l.text), l.votes ? h("div", { class: "muted" }, `${l.votes.for} pour · ${l.votes.against} contre · ${l.votes.absent} absent(s) · ${l.sponsor}`) : null)))),
    v.cases.length ? section("👩‍⚖️ Tribunal", h("div", { class: "stack" }, v.cases.map((c) => h("div", { class: "small" }, `• ${c.title} — ${c.status === "filed" ? "audience à venir" : c.reasoning || "jugé"}`)))) : null,
  ];
}

function anomaliesScreen(v, nav) {
  return [
    h("div", { class: "card small" }, `Pression de réalité : ${v.pressure}/100 · Étage fantôme : ${v.ghost.open ? "OUVERT" : v.ghost.discovered ? "connu, fermé" : "rumeur"}${v.missing.length ? ` · disparu(s) : ${v.missing.join(", ")}` : ""}`),
    h("div", { class: "row wrap" }, h("button", { class: "chip", onClick: () => nav({ view: "floor", id: "f10" }) }, "🛗 Étage fantôme"), h("button", { class: "chip", onClick: () => nav({ view: "floor", id: "fm2" }) }, "🕳️ Département -2")),
    v.events.length ? h("div", { class: "stack" }, v.events.map((e) => eventCard(e, Date.now(), nav))) : empty("Aucune anomalie constatée. Pour l'instant."),
  ];
}

function historyScreen(v, nav) {
  return [
    v.gaps.length ? h("div", { class: "card small" }, `⏸️ Temps non simulé (serveur arrêté trop longtemps) : ${v.gaps.length} période(s).`) : null,
    v.major.length ? section("🏛️ Grands moments", h("div", { class: "stack" }, v.major.map((e) => eventCard(e, Date.now(), nav)))) : null,
    section("📚 Chronique", v.chronicle.length ? h("div", { class: "stack" }, v.chronicle.map((d) => h("div", { class: "small" }, h("b", {}, d.day), h("ul", {}, d.lines.slice(0, 6).map((l) => h("li", {}, l.text)))))) : empty("Les archives se remplissent avec le temps.")),
  ];
}

function controlScreen(c, nav, ctx, refresh, devTools) {
  const s = c.stats;
  const slider = (label, key, min, max, value, step = 1) => {
    const input = h("input", { type: "range", min, max, step, value });
    const out = h("b", {}, String(value));
    input.addEventListener("input", () => { out.textContent = input.value; });
    input.addEventListener("change", async () => { if (await act(ctx, "world.config", { [key]: input.value }, "⚙️")) refresh(); });
    return h("label", { class: "field" }, h("span", {}, label, " ", out), input);
  };
  return [
    h("div", { class: "card mh-hero" }, h("strong", {}, "🎛️ Bureau du Propriétaire"), h("div", { class: "small muted" }, `${c.clock} · cycle ${c.cycle}`)),
    h("div", { class: "kpis mh-kpis" }, h("div", { class: "kpi" }, h("b", {}, String(s.population)), h("span", {}, "habitants")), h("div", { class: "kpi" }, h("b", {}, String(s.events24h)), h("span", {}, "événements 24 h")), h("div", { class: "kpi" }, h("b", {}, String(s.interactions24h)), h("span", {}, "rencontres 24 h"))),
    h("div", { class: "small muted" }, `${s.relations24h} relations changées · ${s.rumors24h} rumeurs · ${s.rare24h} rares · validateur : ${s.applied} appliqués / ${s.rejected} rejetés / ${s.rollbacks} annulés${s.skippedCycles ? ` · ${s.skippedCycles} cycles non simulés` : ""}`),
    section("💰 Finances", h("div", { class: "small" }, `Trésor ${cr(c.finances.treasury)} · ton compte ${cr(c.finances.owner)} · ton entreprise ${cr(c.finances.company)} · émis ${cr(c.finances.minted)}`)),
    c.decisions.some((d) => d.status === "open") ? section("🧾 Décisions", h("div", { class: "stack" }, c.decisions.filter((d) => d.status === "open").map((d) => h("div", { class: "card row wrap" }, h("strong", { class: "grow" }, d.title), h("button", { class: "btn small primary", onClick: async () => { if (await act(ctx, "world.decide", { decisionId: d.id, choice: "yes" }, "🧾")) refresh(); } }, "✅ Oui"), h("button", { class: "btn small", onClick: async () => { if (await act(ctx, "world.decide", { decisionId: d.id, choice: "no" }, "🧾")) refresh(); } }, "❌ Non"))))) : null,
    c.conflicts.length ? section("⚔️ Conflits", h("div", { class: "stack" }, c.conflicts.map((x) => h("div", { class: "small" }, `• ${x.a} vs ${x.b}${x.note ? ` — ${x.note}` : ""}`)))) : null,
    c.arcs.length ? section("🧵 Affaires actives", h("div", { class: "row wrap" }, c.arcs.map((a) => tag(`${a.title} (étape ${a.stage})`, "info")))) : null,
    c.secrets.length ? section("🤐 Secrets découverts", h("div", { class: "stack" }, c.secrets.map((t) => h("div", { class: "small" }, `• ${t}`)))) : null,
    c.follows.length ? section("⭐ Personnes suivies", h("div", { class: "stack" }, c.follows.map((f) => h("button", { class: "mh-link small", onClick: () => nav({ view: "person", id: f.id }) }, `${f.name} — ${f.where || "?"}, ${f.activity || ""}${f.last ? ` · ${f.last}` : ""}`)))) : null,
    c.ownerActions.length ? section("👑 Tes interventions", h("div", { class: "stack" }, c.ownerActions.map((a) => h("div", { class: "small" }, `• ${a.summary}`)))) : null,
    section("⚙️ Réglages de la simulation", h("div", { class: "stack" },
      slider("Niveau de chaos", "chaos", 0, 100, c.config.chaos),
      slider("Événements max par cycle", "maxEventsPerCycle", 0, 20, c.config.maxEventsPerCycle),
      slider("Fréquence des événements rares (×)", "rarity_rare", 0, 5, c.config.rarity.rare, 0.25),
      slider("Fréquence des événements très rares (×)", "rarity_very_rare", 0, 5, c.config.rarity.very_rare, 0.25),
      slider("Population cible", "population", 50, 400, c.config.population, 10),
      slider("Vitesse du temps simulé (×)", "timeScale", 0.25, 24, c.config.timeScale, 0.25),
      h("div", { class: "small muted" }, `IA narrative : ${c.config.ai.enabled && c.config.ai.available ? `activée (${c.ai.calls}/${c.config.ai.dailyCalls} appels aujourd'hui)` : "désactivée"} · dialogues : ${c.config.dialogue}`))),
    devTools ? section("🧪 Mode test du chaos", debugPanel(ctx, refresh)) : null,
  ];
}

function debugPanel(ctx, refresh) {
  const out = h("div", { class: "small mh-debug" });
  const run = async (type, payload) => {
    try {
      const res = await ctx.backend.action(type, payload);
      clear(out, h("pre", {}, JSON.stringify(res, null, 1).slice(0, 4000)));
      refresh();
    } catch (err) {
      clear(out, h("div", { class: "mh-tag bad" }, err.message));
    }
  };
  const tpl = h("input", { class: "input", placeholder: "modèle (ex : viral_video, ghost_floor_opens)" });
  const arc = h("input", { class: "input", placeholder: "arc (caisse, portrait, pigeons, colis, seminaire, cafe, photo, vp)" });
  return h("div", { class: "stack" },
    h("div", { class: "row wrap" }, h("button", { class: "btn small", onClick: () => run("world.debug.cycles", { n: 1 }) }, "⏱️ 1 cycle"), h("button", { class: "btn small", onClick: () => run("world.debug.cycles", { n: 2 }) }, "⏱️ 1 heure"), h("button", { class: "btn small", onClick: () => run("world.debug.cycles", { n: 48 }) }, "⏱️ 1 journée"), h("button", { class: "btn small", onClick: () => run("world.debug.check", {}) }, "✔️ Cohérence"), h("button", { class: "btn small", onClick: () => run("world.debug.replay", { seed: 42, cycles: 48 }) }, "🎲 Rejouer (graine 42)")),
    h("div", { class: "row" }, tpl, h("button", { class: "btn small", onClick: () => run("world.debug.event", { template: tpl.value.trim() }) }, "⚡ Déclencher")),
    h("div", { class: "row" }, arc, h("button", { class: "btn small", onClick: () => run("world.debug.arc", { kind: arc.value.trim() }) }, "🧵 Démarrer")),
    out);
}

// ------------------------------------------------------------------ panneau

const madhouse = {
  subtitle: (state) => {
    const b = state.madhouse;
    return b ? `Cycle ${b.cycle} · humeur ${b.mood}/100 · pression ${b.pressure}/100${b.decisions ? ` · ${b.decisions} décision(s)` : ""}` : "";
  },
  mount(body, ctx) {
    let tab = "explore";
    let route = { view: "building" };
    const stack = [];
    let loadedCycle = -1;
    let seq = 0;
    const tabs = h("div", { class: "chips mh-tabs" });
    const crumbs = h("div", { class: "mh-crumbs small" });
    const content = h("div", { class: "mh-content" });
    body.append(tabs, crumbs, content);

    const query = (payload) => ctx.backend.query("world.explore", payload);
    const nav = (next, replace = false) => {
      if (!replace) stack.push(route);
      route = next;
      haptic("light");
      load();
    };
    const goBack = () => {
      route = stack.pop() || { view: tab === "explore" ? "building" : tab };
      load();
    };
    const renderTabs = () => clear(tabs, ...TABS.map(([id, icon, label]) => h("button", { class: `chip${tab === id ? " on" : ""}`, onClick: () => { tab = id; stack.length = 0; route = { view: id === "explore" ? "building" : id }; load(); } }, `${icon} ${label}`)));
    const renderCrumbs = (data) => {
      const parts = [];
      if (stack.length) parts.push(h("button", { class: "chip", onClick: goBack }, "⬅️ Retour"));
      if (route.view === "floor" && data) parts.push(h("span", {}, `🏢 › ${data.short}`));
      if (route.view === "room" && data) parts.push(h("button", { class: "mh-link", onClick: () => nav({ view: "floor", id: data.floor.id }) }, `🏢 › ${data.floor.short}`), h("span", {}, ` › ${data.name}`));
      if (route.view === "person" && data) parts.push(h("span", {}, `👤 ${data.name}`));
      clear(crumbs, ...parts);
    };

    async function load() {
      renderTabs();
      const mine = ++seq;
      let data;
      try {
        data = await query(route);
      } catch (err) {
        if (mine === seq) clear(content, empty(err.message));
        return;
      }
      if (mine !== seq) return;
      loadedCycle = ctx.state().madhouse?.cycle ?? loadedCycle;
      renderCrumbs(data);
      const refresh = () => load();
      let nodes;
      switch (route.view) {
        case "building": nodes = buildingScreen(data, nav); break;
        case "floor": nodes = data ? floorScreen(data, nav) : [empty("Étage introuvable.")]; break;
        case "room": nodes = data ? roomScreen(data, nav, ctx, refresh) : [empty("Pièce introuvable (ou pas encore découverte).")]; break;
        case "person": nodes = data ? personScreen(data, nav, ctx, refresh) : [empty("Personne introuvable.")]; break;
        case "directory": nodes = directoryScreen(data, nav, route); break;
        case "news": {
          const report = data.page === 0 ? await query({ view: "report" }).catch(() => null) : null;
          if (mine !== seq) return;
          nodes = newsScreen(data, nav, report, ctx, refresh);
          break;
        }
        case "investigations": {
          const rumorsFull = data.rumorsFull || [];
          nodes = investigationsScreen(data, nav, ctx, refresh, rumorsFull);
          break;
        }
        case "companies": nodes = companiesScreen(data, ctx, refresh); break;
        case "politics": nodes = politicsScreen(data, ctx, refresh, data.catalog || []); break;
        case "anomalies": nodes = anomaliesScreen(data, nav); break;
        case "history": nodes = historyScreen(data, nav); break;
        case "control": nodes = controlScreen(data, nav, ctx, refresh, !!ctx.backend.devTools); break;
        default: nodes = [empty("Écran inconnu.")];
      }
      clear(content, ...nodes.filter(Boolean));
    }
    load();
    return {
      update(state) {
        // Nouveau cycle simulé : l'écran courant est rafraîchi (sans perdre la navigation).
        const cycle = state.madhouse?.cycle;
        if (cycle !== undefined && cycle !== loadedCycle) load();
      },
    };
  },
};

export const MADHOUSE_PANELS = { madhouse };
