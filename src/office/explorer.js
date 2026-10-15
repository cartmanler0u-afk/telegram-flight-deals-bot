// Explorateur Telegram du Bâtiment 0 : écrans successifs à boutons inline (on édite le même
// message pour naviguer, sans spammer la conversation). Fonctions pures : (état, route) →
// { text, keyboard }. Tout le texte provient de l'état simulé et passe par esc().
//
// Routes (callback « mx:… », ≤ 64 octets) :
//   menu · b (étages) · f:<étage> · r:<pièce>:<page> · p:<perso> · o:<objet>
//   d:<page> (annuaire) · n:<page> (actus) · i (enquêtes) · e (entreprises)
//   pol (politique) · pl (proposer une loi) · a (anomalies) · h (historique) · c (contrôle) · t (tests)

import { Markup } from "telegraf";
import { esc, credits } from "../../webapp/shared/world/core.js";
import { exploreQuery } from "../../webapp/shared/world/index.js";
import { LAW_CATALOG } from "../../webapp/shared/world/cast.js";
import { TEMPLATES } from "../../webapp/shared/world/events.js";
import { ARC_DEFS } from "../../webapp/shared/world/arcs.js";
import { clip } from "../../webapp/shared/world/report.js";

const MAX = 3900;
const B = (label, data) => Markup.button.callback(label.slice(0, 60), `mx:${data}`.slice(0, 64));
const rows = (buttons, per = 2) => buttons.reduce((acc, b, i) => (i % per ? acc[acc.length - 1].push(b) : acc.push([b]), acc), []);
const back = (label, route) => [B(`⬅️ ${label}`, route)];
const KIND_ICON = { work: "💼", meeting: "🗣️", food: "🍽️", social: "☕", rest: "🛏️", transit: "🛗", special: "🌀", secret: "🕳️", owner: "👑" };
const LAW_STATUS = { proposed: "🗳️", enacted: "✅", rejected: "❌", annulled: "⚖️", repealed: "🗑️" };

function eventLines(events, { dialogue = false, max = 5 } = {}) {
  const out = [];
  for (const e of events.slice(0, max)) {
    out.push(`• ${e.rare ? "✨ " : ""}${e.source === "debug" ? "🧪 " : e.source === "player" ? "👑 " : ""}<b>${esc(e.title)}</b>`);
    if (dialogue) for (const d of (e.dialogue || []).slice(0, 2)) out.push(`   <i>${esc(d.line)}</i>`);
    if (e.narration) out.push(`   🖋️ <i>${esc(e.narration)}</i>`);
  }
  return out;
}

export function mainMenu(state, now) {
  const v = exploreQuery(state, { view: "building" }, now);
  const text = [
    `<b>🏚️ ${esc(v.name)}</b>`,
    `<i>${esc(v.clock)} · ${v.population} habitants (${v.awake} éveillés${v.missing ? `, ${v.missing} disparu(s)` : ""})</i>`,
    `Humeur ${v.mood}/100 · pression de réalité ${v.pressure}/100 · Ascenseur B ${v.elevator}/100${v.ghost.open ? " · 🌀 l'Étage fantôme est ouvert" : ""}`,
    "",
    v.headlines.length ? "<b>⚡ À la une</b>" : "<i>Rien de majeur ces dernières heures. Le Bâtiment rumine.</i>",
    ...eventLines(v.headlines, { max: 3 }),
    v.decisions ? `\n🧾 <b>${v.decisions} décision(s)</b> t'attendent au Centre de contrôle.` : "",
  ].join("\n");
  const keyboard = Markup.inlineKeyboard([
    [B("🏢 Explorer le bâtiment", "b")],
    [B("👥 Annuaire", "d:0"), B("📰 Actualités", "n:0")],
    [B("🔎 Enquêtes", "i"), B("💼 Entreprises", "e")],
    [B("🗳️ Politique", "pol"), B("🌀 Anomalies", "a")],
    [B("📜 Historique", "h"), B("🎛️ Centre de contrôle", "c")],
  ]);
  return { text: clip(text, MAX), keyboard };
}

export function floorsScreen(state, now) {
  const v = exploreQuery(state, { view: "building" }, now);
  const text = [`<b>🏢 Explorer ${esc(v.name)}</b>`, `<i>${esc(v.clock)} — choisis un étage. 👥 présents · 🔥 ça bouge · 🔒 inaccessible</i>`, "", ...v.floors.map((f) => `${f.access ? "🔒" : f.hot ? "🔥" : "▫️"} <b>${f.level}</b> · ${esc(f.short)} — ${f.people} 👥${f.rule ? " · 📌" : ""}${f.lastEvent ? `\n     <i>${esc(f.lastEvent.slice(0, 90))}</i>` : ""}`)];
  if (v.ghost.rumor) text.push("", "<i>On parle aussi d'un Étage 10. L'ascenseur passe du 9 au 11.</i>");
  const buttons = v.floors.map((f) => B(`${f.access ? "🔒 " : f.hot ? "🔥 " : ""}${f.level} · ${f.short} (${f.people})`, `f:${f.id}`));
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([...rows(buttons, 2), back("Menu", "menu")]) };
}

export function floorScreen(state, floorId, now) {
  const f = exploreQuery(state, { view: "floor", id: floorId }, now);
  if (!f) return floorsScreen(state, now);
  const text = [
    `<b>${esc(f.name.toUpperCase())}</b>`,
    `<i>${esc(f.blurb)}</i>`,
    "",
    esc(f.summary),
    "",
    "<b>Pièces</b>",
    ...f.rooms.map((r) => `${KIND_ICON[r.kind] || "▫️"} ${esc(r.name)} — ${r.people} 👥${r.locked ? ` 🔒 ${esc(r.locked)}` : ""}${r.offPlan ? " ⚠️ hors Plan" : ""}${r.sample[0] ? `\n     <i>${esc(r.sample[0])}</i>` : ""}`),
  ];
  if (f.events.length) text.push("", "<b>📰 Actualités de l'étage</b>", ...eventLines(f.events, { max: 3 }));
  const buttons = f.rooms.map((r) => B(`${KIND_ICON[r.kind] || ""} ${r.name.replace(/^(Le|La|Les|L') /, "")} (${r.people})`, `r:${r.id}:0`));
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([...rows(buttons, 2), back("Étages", "b"), [B("🏠 Menu", "menu")]]) };
}

export function roomScreen(state, roomId, page, now) {
  const r = exploreQuery(state, { view: "room", id: roomId, page }, now);
  if (!r) return floorsScreen(state, now);
  const text = [
    `<b>${KIND_ICON[r.kind] || ""} ${esc(r.name)}</b> <i>(${esc(r.floor.short)})</i>`,
    `<i>${esc(r.desc)}</i>`,
    r.rule ? `📌 Règle de l'étage : ${esc(r.rule)}` : "",
    r.offPlan ? "⚠️ Cette pièce n'existe pas au Plan Officiel." : "",
    "",
    r.empty ? "Personne ici pour l'instant." : `<b>👥 Présents (${r.total})</b>${r.pages > 1 ? ` — page ${r.page + 1}/${r.pages}` : ""}`,
    ...r.present.map((p) => `${p.mood} <b>${esc(p.name)}</b> <i>(${esc(p.title)})</i> — ${esc(p.activity)}`),
  ];
  if (r.empty && r.suggestions.length) text.push(`<i>Ça bouge plutôt ici : ${r.suggestions.map((s) => `${esc(s.name)} (${s.people})`).join(", ")}.</i>`);
  if (r.events.length) text.push("", "<b>🎬 Ce qui s'est passé ici</b>", ...eventLines(r.events, { dialogue: true, max: 3 }));
  else if (r.older.length) text.push("", "<b>🗂️ Archives de la pièce</b>", ...r.older.slice(0, 3).map((l) => `• ${esc(l.title)}`));
  if (r.objects.length) text.push("", "<b>🔍 Objets</b>", ...r.objects.map((o) => `• ${esc(o.name)} — <i>${esc(o.state)}</i>`));
  if (r.leads.length) text.push("", "<b>🧵 Pistes</b>", ...r.leads.map((l) => `• ${esc(l.title)}`));
  const people = r.present.map((p) => B(`${p.mood} ${p.name}`, `p:${p.id}`));
  const nav = [];
  if (r.page > 0) nav.push(B("◀️", `r:${r.id}:${r.page - 1}`));
  nav.push(B("👀 Observer", `r:${r.id}:${r.page}`));
  if (r.page < r.pages - 1) nav.push(B("▶️", `r:${r.id}:${r.page + 1}`));
  const extra = [...r.objects.slice(0, 4).map((o) => B(`🔍 ${o.name}`, `o:${o.id}`)), ...(r.leads.length ? [B("🧵 Suivre la piste", "i")] : []), ...(["social", "food", "meeting"].includes(r.kind) ? [B("🎉 Organiser une fête ici", `og:${r.id}`)] : [])];
  const exits = r.exits.filter((x) => !x.id.endsWith(".palier")).slice(0, 4).map((x) => B(`🚪 ${x.name.replace(/^(Le|La|Les|L') /, "")}`, `r:${x.id}:0`));
  return { text: clip(text.filter((l) => l !== "").join("\n"), MAX), keyboard: Markup.inlineKeyboard([...rows(people, 2), nav, ...rows(extra, 2), ...rows(exits, 2), back(`Étage ${r.floor.short}`, `f:${r.floor.id}`)]) };
}

export function personScreen(state, id, now) {
  const p = exploreQuery(state, { view: "person", id }, now);
  if (!p) return { text: "Personne de ce nom dans le Bâtiment (ou alors, pas officiellement).", keyboard: Markup.inlineKeyboard([back("Annuaire", "d:0")]) };
  const text = [
    `<b>${p.kind === "animal" ? "🐾" : "🪪"} ${esc(p.name)}</b>${p.age ? `, ${p.age} ans` : ""}${p.legend ? " 🌟" : ""}${p.deputy ? " 🏛️" : ""}${p.followed ? " ⭐ suivi" : ""}`,
    `${esc(p.title)} · ${esc(p.dept || "")} · ${esc(p.status)}`,
    `📍 ${p.location ? `${esc(p.location.name)} (${esc(p.location.floor)})` : "?"} — <i>${esc(p.activity)}</i>`,
    `${p.mood.emoji} humeur ${p.mood.value}/100${p.needs ? ` · énergie ${p.needs.energy} · faim ${p.needs.hunger} · stress ${p.needs.stress}` : ""}`,
    `💰 ${credits(p.wealth)} · réputation ${p.reputation} · influence ${p.influence}`,
    "",
    `<b>Personnalité</b> : ${esc(p.personality.join(", "))}${p.quirk ? `\n<i>« ${esc(p.quirk)} »</i>` : ""}`,
    `Aime : ${esc(p.likes.join(", "))} · Défauts : ${esc(p.flaws.join(", "))} · Peurs : ${esc(p.fears.join(", "))}`,
    `Habitudes : ${esc(p.habits.join(", ") || "aucune connue")} · Humour : ${esc(p.humor.styles.join(", "))} (${esc(p.humor.refs)})`,
    `🎯 ${esc(p.goals.short)} · 🧭 ${esc(p.goals.long)}`,
  ];
  if (p.relationsDetail.length) text.push("", "<b>❤️ Relations</b>", ...p.relationsDetail.slice(0, 6).map((r) => `• ${esc(r.name)} — ${esc(r.describe)}${r.note ? ` <i>(${esc(r.note.slice(0, 60))})</i>` : ""}`));
  if (p.opinions.length) text.push("", "<b>🗣️ Ce qu'il/elle pense des rumeurs</b>", ...p.opinions.slice(-3).map((o) => `• ${o.stance === "croit" ? "y croit" : o.stance === "doute" ? "doute" : "compte s'en servir"} : <i>${esc(o.text.slice(0, 100))}</i>`));
  if (p.secretsKept) text.push(`🤐 Garde ${p.secretsKept} secret(s) — contenu inconnu`);
  if (p.recent.length) text.push("", "<b>🕘 Dernières actions</b>", ...p.recent.slice(0, 5).map((t) => `• ${esc(t)}`));
  if (p.career.length) text.push("", "<b>📈 Carrière</b>", ...p.career.slice(-3).map((t) => `• ${esc(t)}`));
  const buttons = [
    ...(p.location ? [B("📍 Aller dans sa pièce", `r:${p.location.id}:0`)] : []),
    p.followed ? B("☆ Ne plus suivre", `uf:${p.id}`) : B("⭐ Suivre", `fo:${p.id}`),
    ...(p.kind !== "animal" ? [B("🎖️ Promouvoir", `pr:${p.id}`)] : []),
  ];
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([...rows(buttons, 2), back("Annuaire", "d:0"), [B("🏠 Menu", "menu")]]) };
}

export function objectScreen(state, id, now) {
  const o = exploreQuery(state, { view: "object", id }, now);
  if (!o) return mainMenu(state, now);
  const text = [`<b>🔍 ${esc(o.name)}</b>`, `État : <b>${esc(o.state)}</b> · ${esc(o.room || "")}`, `<i>${esc(o.desc)}</i>`, ...(o.history.length ? ["", "<b>Historique</b>", ...o.history.map((h) => `• ${esc(h)}`)] : [])];
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([back("Retour à la pièce", `r:${o.roomId}:0`)]) };
}

export function directoryScreen(state, page, now) {
  const d = exploreQuery(state, { view: "directory", page }, now);
  const text = [`<b>👥 Annuaire du Bâtiment</b> — ${d.total} personnes · page ${d.page + 1}/${d.pages}`, "<i>Classé par influence. Touche un nom pour ouvrir sa fiche.</i>", "", ...d.items.map((p) => `${p.mood} <b>${esc(p.name)}</b>${p.star ? " ⭐" : ""} — ${esc(p.title)} · 📍 ${esc(p.where)} (${esc(p.floor)})`)];
  const nav = [...(d.page > 0 ? [B("◀️ Précédent", `d:${d.page - 1}`)] : []), ...(d.page < d.pages - 1 ? [B("Suivant ▶️", `d:${d.page + 1}`)] : [])];
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([...rows(d.items.map((p) => B(p.name, `p:${p.id}`)), 2), nav, back("Menu", "menu")]) };
}

export function newsScreen(state, page, now) {
  const n = exploreQuery(state, { view: "news", page }, now);
  const text = [`<b>📰 Actualités internes</b> — page ${n.page + 1}/${n.pages}`, "", ...eventLines(n.items, { dialogue: true, max: 8 })];
  if (!n.items.length) text.push("Rien de notable pour l'instant.");
  if (page === 0 && n.media.length) text.push("", "<b>🗞️ La Gazette & la Radio</b> <i>(peuvent se tromper)</i>", ...n.media.slice(0, 3).map((a) => `• ${esc(a.outlet)} — ${esc(a.title)}${a.satire ? " <i>(satire)</i>" : ""}`));
  const nav = [...(n.page > 0 ? [B("◀️ Plus récent", `n:${n.page - 1}`)] : []), ...(n.page < n.pages - 1 ? [B("Plus ancien ▶️", `n:${n.page + 1}`)] : [])];
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([nav, back("Menu", "menu")].filter((r) => r.length)) };
}

export function investigationsScreen(state, now) {
  const v = exploreQuery(state, { view: "investigations" }, now);
  const world = state.world;
  const text = ["<b>🔎 Enquêtes</b>", "", "<b>Mystères</b>", ...v.mysteries.map((m) => `• ${m.status === "open" ? "🔓" : m.status === "solved" ? "✅" : "🗄️"} ${esc(m.title)} — indices ${m.cluesFound}/${m.cluesTotal}${m.solution ? `\n   ✅ ${esc(m.solution.text)}` : ""}`)];
  if (v.arcs.length) text.push("", "<b>🧵 Affaires en cours</b>", ...v.arcs.slice(0, 6).map((a) => `• ${a.state === "active" ? "🔥" : a.state === "resolved" ? "✅" : a.state === "dormant" ? "💤" : "❌"} ${esc(a.title)}${a.steps.length ? `\n   <i>dernier épisode : ${esc(a.steps.at(-1))}</i>` : ""}`));
  if (v.rumors.length) text.push("", "<b>🗣️ Rumeurs publiques (non vérifiées)</b>", ...v.rumors.slice(0, 5).map((r) => `• ${esc(r)}`));
  if (v.gags.length) text.push("", `<b>🔁 Running gags</b> : ${v.gags.map((g) => `${esc(g.label)} ×${g.count}`).join(" · ")}`);
  const rumorButtons = Object.values(world.facts).filter((f) => f.public && f.status === "rumor" && !f.investigation).slice(-3).map((f) => B(`🕵️ Vérifier : ${f.text.slice(0, 40)}`, `ir:${f.id}`));
  const mysteryButtons = v.mysteries.filter((m) => m.status === "open").slice(0, 4).map((m) => Markup.button.callback(`🔍 ${m.title}`.slice(0, 60), `mh:mys:${m.id}`));
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([...rows(mysteryButtons, 2), ...rumorButtons.map((b) => [b]), back("Menu", "menu")]) };
}

export function companiesScreen(state, now) {
  const e = exploreQuery(state, { view: "companies" }, now);
  const text = ["<b>💼 Bourse & entreprises</b>", `<i>${esc(e.currency)} — aucune transaction réelle.</i>`, `Masse monétaire ${credits(e.total)} · Trésor ${credits(e.treasury)} · indice des prix ${e.priceIndex}`, ...e.indicators.map((i) => `📊 ${esc(i.label)} : ${esc(i.value)}`), "", ...e.companies.slice(0, 14).map((c) => `${c.status === "active" ? "🟢" : "💀"} <b>${esc(c.name)}</b> — ${credits(c.cash)} · part ${credits(c.sharePrice)} · PDG ${esc(c.ceo)}`)];
  const fund = e.companies.filter((c) => c.status === "active" && c.id !== "bosscorp").slice(0, 6).map((c) => B(`💸 Financer ${c.name} (500)`, `fd:${c.id}`));
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([...rows(fund, 2), back("Menu", "menu")]) };
}

export function politicsScreen(state, now) {
  const v = exploreQuery(state, { view: "politics" }, now);
  const text = ["<b>🗳️ Politique interne</b>", `Hémicycle : ${esc(v.parliament.seats.join(", "))} · présidence : ${esc(v.parliament.speaker)} · élections dans ${Math.round(v.parliament.cyclesToElection / 48)} j`, "", "<b>Organisations</b>", ...v.orgs.slice(0, 8).map((o) => `• ${esc(o.name)} (${esc(o.kind)}) — ${o.members} membres, dirigé par ${esc(o.leader)}`), "", "<b>Lois</b>", ...v.laws.slice(0, 6).map((l) => `${LAW_STATUS[l.status] || "•"} ${esc(l.title)} — ${esc(l.text)}`)];
  if (v.cases.length) text.push("", "<b>⚖️ Tribunal</b>", ...v.cases.slice(0, 4).map((c) => `• ${esc(c.title)} — ${c.status === "filed" ? "audience à venir" : esc((c.reasoning || "jugé").slice(0, 80))}`));
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([[B("📜 Souffler une loi à un député", "pl")], back("Menu", "menu")]) };
}

export function lawCatalogScreen(state) {
  const laws = state.world.laws;
  const options = Object.entries(LAW_CATALOG).filter(([code]) => !Object.values(laws).some((l) => l.code === code && ["proposed", "enacted"].includes(l.status)));
  const text = ["<b>📜 Souffler une loi</b>", "<i>Coût : 200 cr de « conseil législatif » à un député. Le vote reste libre : rien n'est garanti.</i>", "", ...options.map(([, d]) => `• <b>${esc(d.title)}</b> — ${esc(d.text)}`)];
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([...options.map(([code, d]) => [B(d.title, `plc:${code}`)]), back("Politique", "pol")]) };
}

export function anomaliesScreen(state, now) {
  const v = exploreQuery(state, { view: "anomalies" }, now);
  const text = ["<b>🌀 Anomalies</b>", `Pression de réalité : ${v.pressure}/100 · Étage fantôme : ${v.ghost.open ? "OUVERT" : v.ghost.discovered ? "connu, fermé" : "rumeur"}`, v.missing.length ? `Disparu(s) : ${esc(v.missing.join(", "))}` : "", "", ...eventLines(v.events, { max: 5 }), ...(v.records.length ? ["", "<b>Registre</b>", ...v.records.slice(0, 6).map((a) => `• cycle ${a.cycle} — ${esc(a.kind)}${a.effects.length ? ` : ${esc(a.effects.join(", "))}` : ""}`)] : [])];
  if (!v.events.length && !v.records.length) text.push("Aucune anomalie constatée. Pour l'instant.");
  return { text: clip(text.filter((l) => l !== "").join("\n"), MAX), keyboard: Markup.inlineKeyboard([[B("🛗 Aller voir l'Étage fantôme", "f:f10"), B("🕳️ Le sous-sol -2", "f:fm2")], back("Menu", "menu")]) };
}

export function historyScreen(state, now) {
  const v = exploreQuery(state, { view: "history" }, now);
  const text = ["<b>📜 Historique</b> <i>(archives immuables)</i>", "", ...eventLines(v.major, { max: 6 })];
  for (const day of v.chronicle.slice(0, 4)) text.push("", `<b>${esc(day.day)}</b>`, ...day.lines.slice(0, 4).map((l) => `• ${esc(l.text)}`));
  if (v.gaps.length) text.push("", `<i>⏸️ Temps non simulé (serveur arrêté trop longtemps) : ${v.gaps.length} période(s), ${v.gaps.reduce((s, g) => s + g.cycles, 0)} cycles.</i>`);
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([back("Menu", "menu")]) };
}

export function controlScreen(state, now, { dev = false } = {}) {
  const c = exploreQuery(state, { view: "control" }, now);
  const s = c.stats;
  const text = [
    "<b>🎛️ Centre de contrôle — Bureau du Propriétaire</b>",
    `<i>${esc(c.clock)} · cycle ${c.cycle}</i>`,
    `👥 ${s.population} habitants (${s.awake} éveillés, ${s.missing} disparus) · 🔗 ${s.relations} relations · 🧠 ${s.facts} faits`,
    `24 h : ${s.events24h} événements · ${s.interactions24h} rencontres · ${s.relations24h} relations changées · ${s.rumors24h} rumeurs · ${s.rare24h} rares`,
    `Validateur : ${s.applied} changements appliqués, ${s.rejected} rejetés, ${s.rollbacks} cycle(s) annulé(s)${s.skippedCycles ? `, ${s.skippedCycles} cycle(s) non simulés (absence trop longue)` : ""}`,
    `💰 Trésor ${credits(c.finances.treasury)} · ton compte ${credits(c.finances.owner)} · ton entreprise ${credits(c.finances.company)}`,
  ];
  if (c.conflicts.length) text.push("", "<b>⚔️ Conflits</b>", ...c.conflicts.slice(0, 4).map((x) => `• ${esc(x.a)} vs ${esc(x.b)}${x.note ? ` — <i>${esc(x.note.slice(0, 60))}</i>` : ""}`));
  if (c.arcs.length) text.push("", "<b>🧵 Affaires actives</b>", ...c.arcs.map((a) => `• ${esc(a.title)} (étape ${a.stage})`));
  if (c.secrets.length) text.push("", "<b>🤐 Secrets découverts</b>", ...c.secrets.slice(0, 3).map((t) => `• ${esc(t.slice(0, 110))}`));
  if (c.follows.length) text.push("", "<b>⭐ Personnes suivies</b>", ...c.follows.map((f) => `• ${esc(f.name)} — ${esc(f.where || "?")}, ${esc(f.activity || "")}`));
  if (c.ownerActions.length) text.push("", "<b>👑 Tes interventions</b>", ...c.ownerActions.slice(0, 4).map((a) => `• ${esc(a.summary)}`));
  const open = state.world.decisions.filter((d) => d.status === "open").slice(0, 3);
  if (open.length) text.push("", "<b>🧾 Décisions</b>", ...open.map((d) => `• ${esc(d.title)}`));
  const decisionRows = open.map((d) => [Markup.button.callback(`✅ ${d.title.slice(0, 28)}`, `mh:dec:${d.id}:yes`), Markup.button.callback("❌", `mh:dec:${d.id}:no`)]);
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([...decisionRows, [B("📋 Rapport d'absence", "rep"), B("🏢 Bureau (dernier étage)", "f:ph")], ...(dev ? [[B("🧪 Mode test du chaos", "t")]] : []), back("Menu", "menu")]) };
}

export function testScreen(state, result = null) {
  const text = ["<b>🧪 Mode test du chaos</b> <i>(administrateurs, développement)</i>", "Simule du temps, déclenche un événement ou un arc, vérifie la cohérence.", ...(result ? ["", result] : [])];
  const templates = TEMPLATES.slice(0, 12).map((t) => B(`⚡ ${t.id}`, `te:${t.id}`));
  const arcs = Object.keys(ARC_DEFS).map((k) => B(`🧵 ${k}`, `ta:${k}`));
  return { text: clip(text.join("\n"), MAX), keyboard: Markup.inlineKeyboard([[B("⏱️ 1 cycle", "tc:1"), B("⏱️ 1 heure", "tc:2"), B("⏱️ 1 jour", "tc:48")], [B("✔️ Vérifier la cohérence", "tk")], ...rows(templates, 3), ...rows(arcs, 4), back("Centre de contrôle", "c")]) };
}

// Routeur d'affichage (lecture seule).
export function screenFor(state, route, now, { dev = false } = {}) {
  const [name, a, b] = String(route || "menu").split(":");
  switch (name) {
    case "b": return floorsScreen(state, now);
    case "f": return floorScreen(state, a, now);
    case "r": return roomScreen(state, a, Number(b) || 0, now);
    case "p": return personScreen(state, a, now);
    case "o": return objectScreen(state, a, now);
    case "d": return directoryScreen(state, Number(a) || 0, now);
    case "n": return newsScreen(state, Number(a) || 0, now);
    case "i": return investigationsScreen(state, now);
    case "e": return companiesScreen(state, now);
    case "pol": return politicsScreen(state, now);
    case "pl": return lawCatalogScreen(state);
    case "a": return anomaliesScreen(state, now);
    case "h": return historyScreen(state, now);
    case "c": return controlScreen(state, now, { dev });
    case "t": return dev ? testScreen(state) : controlScreen(state, now, { dev });
    default: return mainMenu(state, now);
  }
}
