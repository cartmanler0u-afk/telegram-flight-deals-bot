// Interface Telegram du Bâtiment 0 (THE MADHOUSE) : commandes de lecture, boutons
// d'arbitrage et notifications. Tout le texte vient de l'état simulé et passe par esc()
// (parse_mode HTML) : un nom ou un titre généré n'est jamais interprété comme du balisage.
// Aucune commande ne modifie le monde directement : elles passent par les actions
// « world.* » du moteur, validées comme n'importe quelle proposition.

import { Markup } from "telegraf";
import { esc, credits } from "../../webapp/shared/world/core.js";
import { worldView, personSheet, buildReport } from "../../webapp/shared/world/index.js";
import { clip } from "../../webapp/shared/world/report.js";

const MAX = 3900;
const HTML = { parse_mode: "HTML", link_preview_options: { is_disabled: true } };

const STATUS_ICON = { open: "🟢", closed: "⛔", sealed: "🔒", contested: "⚖️", rumored: "❔" };
const PLOT_STATE = { active: "en cours", dormant: "en sommeil", resolved: "dénouée", failed: "échec", forgotten: "oubliée" };
const LAW_STATUS = { proposed: "🗳️ en discussion", enacted: "✅ en vigueur", rejected: "❌ rejetée", annulled: "⚖️ annulée", repealed: "🗑️ abrogée" };

function time(view, at) {
  return new Date(at + (view.tzOffset || 0) * 60000).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export const MENU = Markup.inlineKeyboard([
  [Markup.button.callback("📰 Actus", "mh:news"), Markup.button.callback("📋 Rapport", "mh:report"), Markup.button.callback("🏢 Étages", "mh:floors")],
  [Markup.button.callback("👥 Occupants", "mh:agents"), Markup.button.callback("🏛️ Organisations", "mh:orgs"), Markup.button.callback("💰 Économie", "mh:economy")],
  [Markup.button.callback("🔍 Mystères", "mh:mysteries"), Markup.button.callback("🗣️ Rumeurs", "mh:rumors"), Markup.button.callback("🌀 Anomalies", "mh:anomalies")],
  [Markup.button.callback("📜 Lois & Tribunal", "mh:laws"), Markup.button.callback("🧵 Intrigues", "mh:plots"), Markup.button.callback("📚 Histoire", "mh:history")],
]);

// ------------------------------------------------------------------ rendus (fonctions pures)

export function renderBuilding(v) {
  const lines = [
    `<b>🏢 ${esc(v.name)}</b>`,
    `<i>Cycle ${v.cycle} · un cycle = ${v.cycleMinutes} min${v.paused ? " · ⏸️ simulation en pause" : ""}</i>`,
    `Humeur générale : ${v.mood}/100 · Pression de réalité : ${v.pressure}/100 · ${esc(v.elevator.name)} : ${v.elevator.mood}/100`,
    `${v.people.length} occupants · ${v.floors.length} étages connus${v.rumoredFloors.length ? ` · ${v.rumoredFloors.length} étage(s) dont on parle sans preuve` : ""}`,
    "",
    "<b>⚡ Dernières nouvelles</b>",
    ...v.events.filter((e) => e.importance >= 3).slice(0, 5).map((e) => `• ${e.rare ? "✨ " : ""}${esc(e.title)}`),
  ];
  if (v.decisions.length) lines.push("", `<b>🧾 ${v.decisions.length} décision(s) t'attendent</b> — /report`);
  lines.push("", "<i>Le Bâtiment vit sans toi. Tu observes, tu arbitres ; tu ne réécris pas son histoire.</i>");
  return clip(lines.join("\n"), MAX);
}

export function renderFloors(v) {
  const lines = ["<b>🏢 Plan du Bâtiment</b> <i>(Plan Officiel + observations)</i>"];
  for (const f of v.floors) {
    lines.push(`${STATUS_ICON[f.status] || "•"} <b>${f.level}</b> — ${esc(f.name)}${f.onPlan ? "" : " <i>(absent du Plan Officiel)</i>"}${f.anomaly ? ` 🌀 anomalie ${f.anomaly}` : ""} · ${f.occupants} occ.`);
    if (f.note) lines.push(`   <i>${esc(f.note)}</i>`);
  }
  for (const f of v.rumoredFloors) lines.push(`❔ — ${esc(f.name)} <i>(une rumeur ne crée pas un étage)</i>`);
  return clip(lines.join("\n"), MAX);
}

export function renderAgents(v, { limit = 25 } = {}) {
  const lines = ["<b>👥 Occupants</b> <i>(par influence)</i>"];
  for (const p of v.people.slice(0, limit)) {
    const badges = `${p.legend ? "🌟" : ""}${p.deputy ? "🏛️" : ""}${p.kind === "animal" ? "🐾" : ""}${p.status !== "active" ? ` <i>(${esc(p.status)})</i>` : ""}`;
    lines.push(`• <b>${esc(p.name)}</b> ${badges} — ${esc(p.title)} · ${esc(p.floorName)} · infl. ${p.influence} · ${credits(p.wealth)}`);
  }
  if (v.people.length > limit) lines.push(`<i>… et ${v.people.length - limit} autres. /agent &lt;nom&gt; pour une fiche.</i>`);
  return clip(lines.join("\n"), MAX);
}

export function renderSheet(s) {
  if (!s) return "Personne de ce nom dans le Bâtiment (ou alors, pas officiellement).";
  const lines = [
    `<b>${esc(s.name)}</b>${s.legend ? " 🌟 légende" : ""}${s.deputy ? " 🏛️ député" : ""}`,
    `${esc(s.title)} · ${esc(s.floor)} · employeur : ${esc(s.employer)}`,
    `État : ${esc(s.status)}${s.doubleOf ? ` (double de ${esc(s.doubleOf)})` : ""}`,
    `Caractère : ${esc(s.traits.join(", ") || "indéchiffrable")}${s.weakness ? ` · faiblesse : ${esc(s.weakness)}` : ""}`,
    `Compétences : ${s.skills.map((k) => `${esc(k.label)} ${k.value}`).join(" · ")}`,
    `Ambition : ${esc(s.ambition)}${s.conviction ? ` · conviction : « ${esc(s.conviction)} »` : ""}`,
    `🎯 Court terme : ${esc(s.goals.short)}`,
    `🧭 ${esc(s.goals.long)}`,
    `💰 ${credits(s.wealth)}${s.frozen ? " (compte gelé)" : ""} · réputation ${s.reputation}/100 · influence ${s.influence}/100`,
  ];
  if (s.companies.length) lines.push(`📈 Parts : ${s.companies.map((c) => `${esc(c.name)} (${c.shares}${c.ceo ? ", PDG" : ""})`).join(", ")}`);
  if (s.alliances.length || s.hiddenAffiliations) lines.push(`🤝 Organisations : ${esc(s.alliances.map((o) => `${o.name}${o.leader ? " (dirigeant)" : ""}`).join(", ") || "—")}${s.hiddenAffiliations ? " <i>+ affiliations non déclarées</i>" : ""}`);
  if (s.relations.length) lines.push(`❤️ Relations : ${s.relations.slice(0, 6).map((r) => `${esc(r.name)} (${esc(r.label)})`).join(", ")}`);
  if (s.secretsKept) lines.push(`🤐 Garde ${s.secretsKept} secret(s) — contenu inconnu`);
  if (s.beliefs.length) lines.push(`🔮 Croit savoir : ${s.beliefs.slice(-2).map((b) => `« ${esc(b.text)} » (${esc(b.verdict)})`).join(" ; ")}`);
  if (s.commitments.length) lines.push(`🤞 Promesses : ${esc(s.commitments.join(" ; "))}`);
  if (s.memories.length) lines.push("", "<b>Souvenirs marquants</b>", ...s.memories.map((m) => `• ${esc(m)}`));
  if (s.career.length) lines.push("", "<b>Carrière</b>", ...s.career.map((c) => `• ${esc(c)}`));
  return clip(lines.join("\n"), MAX);
}

export function renderNews(v) {
  const lines = ["<b>📰 Actualités du Bâtiment</b>"];
  for (const e of v.events.filter((x) => x.importance >= 2).slice(0, 12)) {
    lines.push(`• <i>${esc(time(v, e.at))}</i> ${e.rare ? "✨ " : ""}<b>${esc(e.title)}</b>`);
    if (e.importance >= 3) lines.push(`   ${esc(e.text.slice(0, 220))}`);
  }
  if (v.media.length) {
    lines.push("", "<b>🗞️ À la une</b> <i>(les médias peuvent se tromper)</i>");
    for (const a of v.media.slice(0, 4)) lines.push(`• ${esc(a.outlet)} — ${esc(a.title)}${a.satire ? " <i>(satire)</i>" : ""}${a.denied ? " <b>[démenti par le Tribunal]</b>" : ""}`);
  }
  return clip(lines.join("\n"), MAX);
}

export function renderOrgs(v) {
  const lines = ["<b>🏛️ Organisations</b>", `Hémicycle : ${esc(v.parliament.seats.join(", "))} · présidence : ${esc(v.parliament.speaker)} · élections dans ${Math.round(v.parliament.cyclesToElection / 48)} j`];
  for (const o of v.orgs.filter((x) => x.status === "active")) {
    lines.push("", `<b>${esc(o.name)}</b> <i>(${esc(o.kind)})</i> — dirigé par ${esc(o.leader)}`, `${o.members.length} membre(s) · réputation ${o.reputation} · caisse ${credits(o.treasury)}`, `<i>${esc(o.goal || "")}</i>`);
  }
  return clip(lines.join("\n"), MAX);
}

export function renderEconomy(v) {
  const e = v.economy;
  const lines = [
    "<b>💰 Économie du Bâtiment</b>",
    `<i>${esc(e.currency)} — aucune transaction réelle.</i>`,
    `Masse monétaire : ${credits(e.total)} (dont ${credits(e.minted)} émis par le Syndic) · indice des prix ${e.priceIndex}`,
    `Trésor du Syndic : ${credits(e.treasury)}`,
    ...e.indicators.map((i) => `📊 ${esc(i.label)} : ${esc(i.value)}`),
    "",
    "<b>Entreprises</b>",
    ...e.companies.map((c) => `${c.status === "active" ? "🟢" : "💀"} ${esc(c.name)} — PDG ${esc(c.ceo)} · caisse ${credits(c.cash)} · part ${credits(c.sharePrice)}`),
  ];
  if (e.loans.length) lines.push("", "<b>Prêts</b>", ...e.loans.slice(0, 6).map((l) => `• ${esc(l.borrower)} doit ${credits(l.balance)} à ${esc(l.lender)} (${esc(l.status)})`));
  lines.push("", "<b>Grandes fortunes</b>", ...e.fortunes.slice(0, 5).map((f, i) => `${i + 1}. ${esc(f.name)} — ${credits(f.wealth)}`));
  return clip(lines.join("\n"), MAX);
}

export function renderMysteries(v) {
  const lines = ["<b>🔍 Département des Mystères</b>"];
  for (const m of v.mysteries) {
    const state = { open: "ouvert", solved: "résolu", cold: "classé sans suite" }[m.status] || m.status;
    lines.push("", `<b>${esc(m.title)}</b> — ${state}`, `<i>${esc(m.question)}</i>`, `Indices : ${m.cluesFound}/${m.cluesTotal} trouvés${m.publicClues.length ? ` (${m.publicClues.length} publics)` : ""} · enquêteurs : ${esc(m.investigators.map((i) => i.name).join(", ") || "personne")}${m.focus ? ` · mandaté : ${esc(m.focus)}` : ""}`);
    for (const c of m.publicClues.slice(-2)) lines.push(`🧩 ${esc(c)}`);
    for (const h of m.hypotheses.slice(-2)) lines.push(`🔮 <i>Hypothèse (${esc(h.verdict)})</i> — ${esc(h.by)} : « ${esc(h.text)} »`);
    if (m.solution) lines.push(`✅ ${esc(m.solution.text)} — résolu par ${esc(m.solution.by)}`);
  }
  lines.push("", "<i>Tu peux mandater un enquêteur ; le mystère ne se résout que si les preuves suivent.</i>");
  return clip(lines.join("\n"), MAX);
}

export function renderRumors(v) {
  const lines = ["<b>🗣️ Ce qui se murmure</b> <i>(rien de tout ceci n'est vérifié)</i>"];
  for (const r of v.rumors) lines.push(`• <i>[Rumeur]</i> ${esc(r.text)}`);
  for (const h of v.hypotheses) lines.push(`• <i>[Hypothèse]</i> ${esc(h.text)}`);
  if (!v.rumors.length && !v.hypotheses.length) lines.push("Rien. C'est presque inquiétant.");
  if (v.facts.length) lines.push("", "<b>✅ Faits établis récents</b>", ...v.facts.slice(0, 5).map((f) => `• ${esc(f.text)}`));
  return clip(lines.join("\n"), MAX);
}

export function renderAnomalies(v) {
  const lines = ["<b>🌀 Registre des anomalies</b> <i>(portée et effets enregistrés ; le passé n'est jamais réécrit)</i>"];
  for (const a of v.anomalies) lines.push(`• cycle ${a.cycle} — <b>${esc(a.kind)}</b>${a.scope ? ` · portée : ${esc(a.scope)}` : ""}${a.effects.length ? ` · ${esc(a.effects.join(", "))}` : ""}${a.explained ? " · expliquée" : ""}`);
  if (!v.anomalies.length) lines.push("Aucune anomalie constatée. Pour l'instant.");
  return clip(lines.join("\n"), MAX);
}

export function renderLaws(v) {
  const lines = ["<b>📜 Lois du Bâtiment</b>", ...v.charter.map((r) => `<i>${esc(r.id)} — ${esc(r.text)}</i>`), ""];
  for (const l of v.laws.slice(-10).reverse()) lines.push(`${LAW_STATUS[l.status] || esc(l.status)} <b>${esc(l.title)}</b> — ${esc(l.rule)}${l.votes ? ` (${l.votes.for} pour, ${l.votes.against} contre)` : ""} · portée par ${esc(l.sponsor)}`);
  if (v.cases.length) {
    lines.push("", "<b>⚖️ Tribunal des Couloirs</b>");
    for (const c of v.cases.slice(0, 6)) lines.push(`• ${esc(c.title)} — ${c.status === "filed" ? "audience à venir" : esc(c.reasoning || c.ruling || "jugé")}`);
  }
  return clip(lines.join("\n"), MAX);
}

export function renderPlots(v) {
  const lines = ["<b>🧵 Intrigues du Bâtiment</b>"];
  for (const p of v.plots) {
    lines.push("", `<b>${esc(p.title)}</b> — ${PLOT_STATE[p.state] || esc(p.state)}${p.revived ? ` (réveillée ×${p.revived})` : ""}`, `Acteurs : ${esc(p.cast.slice(0, 5).join(", "))} · enjeu : ${esc(p.goals || "?")}`);
    for (const b of p.beats.slice(-3)) lines.push(`  ↳ ${esc(b)}`);
    if (p.resolution) lines.push(`  ✅ ${esc(p.resolution)}`);
  }
  if (!v.plots.length) lines.push("Aucune intrigue visible. Le Bâtiment prépare quelque chose.");
  return clip(lines.join("\n"), MAX);
}

export function renderHistory(v) {
  const lines = ["<b>📚 Chronique du Bâtiment</b> <i>(archives immuables)</i>"];
  for (const day of v.chronicle.slice(0, 7)) {
    lines.push("", `<b>${esc(day.day)}</b>`, ...day.lines.slice(0, 5).map((l) => `• ${esc(l.text)}`));
  }
  const major = v.events.filter((e) => e.importance >= 4).slice(0, 8);
  if (major.length) lines.push("", "<b>Récemment</b>", ...major.map((e) => `• ${esc(e.title)}${e.why ? `\n   <i>↳ ${esc(e.why)}</i>` : ""}`));
  return clip(lines.join("\n"), MAX);
}

export function decisionButtons(decisions) {
  if (!decisions.length) return null;
  return Markup.inlineKeyboard(decisions.slice(0, 4).map((d) => [Markup.button.callback(`✅ ${d.title.slice(0, 28)}`, `mh:dec:${d.id}:yes`), Markup.button.callback("❌ Refuser", `mh:dec:${d.id}:no`)]));
}

// Notifications du Bâtiment (déjà filtrées par la politique anti-spam du moteur).
export function renderNote(note, state) {
  const view = state.world;
  if (note.kind === "world_report") return { text: note.report.html, extra: decisionButtons(view.decisions.filter((d) => d.status === "open")) };
  if (note.kind === "world_alert") {
    const lines = ["<b>🏢 Bâtiment 0</b>"];
    for (const i of note.items) lines.push(`${i.decisionId ? "🧾" : i.rare ? "✨" : "⚡"} <b>${esc(i.title)}</b>${i.text ? `\n${esc(i.text.slice(0, 280))}` : ""}`);
    lines.push("", "<i>/building pour tout voir · /report pour le récapitulatif</i>");
    const decisions = note.items.map((i) => i.decisionId && view.decisions.find((d) => d.id === i.decisionId && d.status === "open")).filter(Boolean);
    return { text: clip(lines.join("\n"), MAX), extra: decisionButtons(decisions) };
  }
  return null;
}

// ------------------------------------------------------------------ recherche

function norm(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function findPerson(world, query) {
  const q = norm(query);
  if (!q) return null;
  const people = Object.values(world.people);
  return people.find((p) => norm(p.id) === q || norm(p.name) === q) || people.find((p) => norm(p.name).startsWith(q)) || people.find((p) => norm(p.name).includes(q)) || null;
}

function findMystery(world, query) {
  const q = norm(query);
  const list = Object.values(world.mysteries).filter((m) => m.status === "open");
  return list.find((m) => m.id === query) || list.find((m) => norm(m.title).includes(q)) || null;
}

// ------------------------------------------------------------------ enregistrement des commandes

const VIEWS = {
  news: renderNews,
  floors: renderFloors,
  agents: renderAgents,
  orgs: renderOrgs,
  economy: renderEconomy,
  mysteries: renderMysteries,
  rumors: renderRumors,
  anomalies: renderAnomalies,
  laws: renderLaws,
  plots: renderPlots,
  history: renderHistory,
};

export function registerBuilding(bot, { service, isAdmin, aiCap = 0 }) {
  const officeOf = async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("⛔ Le Bâtiment est réservé aux administrateurs du bot.");
      return null;
    }
    return service.get(String(ctx.from.id), { bossName: ctx.from.first_name });
  };
  const view = (office) => worldView(office.runtime.state.world, office.runtime.state);
  const args = (ctx) => (ctx.message?.text || "").split(/\s+/).slice(1).join(" ").trim();

  bot.command(["building", "batiment", "madhouse"], async (ctx) => {
    const office = await officeOf(ctx);
    if (office) await ctx.reply(renderBuilding(view(office)), { ...HTML, ...MENU });
  });

  const simple = { news: "news", floors: "floors", agents: "agents", organizations: "orgs", economy: "economy", rumors: "rumors", anomalies: "anomalies", history: "history", laws: "laws", plots: "plots", mysteries: "mysteries" };
  for (const [command, key] of Object.entries(simple)) {
    bot.command(command, async (ctx) => {
      const office = await officeOf(ctx);
      if (office) await ctx.reply(VIEWS[key](view(office)), HTML);
    });
  }

  bot.command("agent", async (ctx) => {
    const office = await officeOf(ctx);
    if (!office) return;
    const world = office.runtime.state.world;
    const person = findPerson(world, args(ctx));
    if (!person) return ctx.reply("Usage : /agent &lt;nom&gt; (ex. /agent Arlette)", HTML);
    await ctx.reply(renderSheet(personSheet(world, office.runtime.state, person.id)), HTML);
  });

  const sendReport = async (ctx, office) => {
    const state = office.runtime.state;
    const report = buildReport(state.world, { since: state.world.report.lastSeenAt, until: Date.now() });
    await ctx.reply(report.html, { ...HTML, ...(decisionButtons(state.world.decisions.filter((d) => d.status === "open")) || {}) });
    office.runtime.dispatch("world.seen", {});
  };
  bot.command("report", async (ctx) => {
    const office = await officeOf(ctx);
    if (office) await sendReport(ctx, office);
  });

  bot.command("investigate", async (ctx) => {
    const office = await officeOf(ctx);
    if (!office) return;
    const world = office.runtime.state.world;
    const text = args(ctx);
    if (!text) {
      const open = Object.values(world.mysteries).filter((m) => m.status === "open");
      if (!open.length) return ctx.reply("Aucun mystère ouvert. Le Bâtiment se tait… pour l'instant.");
      return ctx.reply("<b>🔍 Quel mystère veux-tu faire avancer ?</b>", { ...HTML, ...Markup.inlineKeyboard(open.slice(0, 6).map((m) => [Markup.button.callback(m.title.slice(0, 40), `mh:mys:${m.id}`)])) });
    }
    // /investigate <mystère> | <personne>
    const [mq, pq] = text.split("|").map((s) => s.trim());
    const m = findMystery(world, mq);
    const p = pq ? findPerson(world, pq) : null;
    if (!m) return ctx.reply("Mystère introuvable. /investigate sans argument pour la liste.");
    if (!p) return ctx.reply(...mysteryPicker(world, m));
    try {
      const res = office.runtime.dispatch("world.investigate", { mysteryId: m.id, personId: p.id });
      await ctx.reply(`🔍 ${esc(res.public.title)}`, HTML);
    } catch (err) {
      await ctx.reply(`⚠️ ${esc(err.message)}`, HTML);
    }
  });

  // Réglages techniques : administrateurs uniquement, et jamais au-delà du plafond fixé par
  // l'opérateur (WORLD_AI_DAILY_CALLS) — un personnage « PDG » n'y a évidemment pas accès.
  bot.command("madhouse_config", async (ctx) => {
    const office = await officeOf(ctx);
    if (!office) return;
    const [key, a, b] = args(ctx).split(/\s+/);
    const payload = {};
    if (key === "cycle") payload.cycleMinutes = a;
    else if (key === "pause") payload.paused = true;
    else if (key === "resume") payload.paused = false;
    else if (key === "ai") payload.aiEnabled = a === "on";
    else if (key === "ai_calls") payload.dailyCalls = Math.min(Number(a), aiCap);
    else if (key === "notif") payload.maxPerDay = a;
    else if (key === "importance") payload.minImportance = a;
    else if (key === "quiet") Object.assign(payload, { quietStart: a, quietEnd: b });
    else if (key === "report") Object.assign(payload, { reportHour: a, dailyReport: b !== "off" });
    try {
      const res = Object.keys(payload).length ? office.runtime.dispatch("world.config", payload).public : { config: office.runtime.state.world.config };
      const c = res.config;
      await ctx.reply(
        [
          "<b>⚙️ Réglages du Bâtiment</b>",
          `Cycle : ${c.cycleMinutes} min · rattrapage max ${c.maxCatchUp} cycles · ${c.paused ? "⏸️ en pause" : "▶️ en marche"}`,
          `IA narrative : ${c.ai.enabled && c.ai.available ? "activée" : "désactivée"} · ${c.ai.dailyCalls} appel(s)/jour max (plafond opérateur : ${aiCap})`,
          `Notifications : importance ≥ ${c.notify.minImportance}, ${c.notify.maxPerDay}/jour max, ${c.notify.minGapMinutes} min d'écart, silence ${c.notify.quietStart}h–${c.notify.quietEnd}h · rapport quotidien ${c.notify.dailyReport ? `à ${c.notify.reportHour}h` : "désactivé"}`,
          "",
          "<i>/madhouse_config cycle 30 · pause · resume · ai on|off · ai_calls 5 · notif 2 · importance 4 · quiet 23 8 · report 9 on|off</i>",
        ].join("\n"),
        HTML
      );
    } catch (err) {
      await ctx.reply(`⚠️ ${esc(err.message)}`, HTML);
    }
  });

  bot.action(/^mh:(\w+)(?::([\w-]+))?(?::([\w-]+))?$/, async (ctx) => {
    const office = await officeOf(ctx);
    if (!office) return ctx.answerCbQuery();
    const [, kind, a, b] = ctx.match;
    const world = office.runtime.state.world;
    try {
      if (VIEWS[kind]) {
        await ctx.answerCbQuery();
        return ctx.reply(VIEWS[kind](view(office)), HTML);
      }
      if (kind === "report") {
        await ctx.answerCbQuery();
        return sendReport(ctx, office);
      }
      if (kind === "agent") {
        await ctx.answerCbQuery();
        return ctx.reply(renderSheet(personSheet(world, office.runtime.state, a)), HTML);
      }
      if (kind === "dec") {
        const res = office.runtime.dispatch("world.decide", { decisionId: a, choice: b });
        await ctx.answerCbQuery("Décision enregistrée");
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        return ctx.reply(`🧾 ${esc(res.public.title)}`, HTML);
      }
      if (kind === "mys") {
        await ctx.answerCbQuery();
        const m = world.mysteries[a];
        return m ? ctx.reply(...mysteryPicker(world, m)) : null;
      }
      if (kind === "inv") {
        const res = office.runtime.dispatch("world.investigate", { mysteryId: a, personId: b });
        await ctx.answerCbQuery("Enquêteur mandaté");
        return ctx.reply(`🔍 ${esc(res.public.title)}`, HTML);
      }
      return ctx.answerCbQuery();
    } catch (err) {
      return ctx.answerCbQuery(String(err.message || "Action impossible").slice(0, 190), { show_alert: true });
    }
  });
}

function mysteryPicker(world, m) {
  const candidates = Object.values(world.people)
    .filter((p) => p.kind !== "animal" && ["active", "admin_dead", "double"].includes(p.status))
    .sort((x, y) => (y.skills.investigation || 0) - (x.skills.investigation || 0))
    .slice(0, 6);
  return [
    `<b>🔍 ${esc(m.title)}</b>\n<i>${esc(m.question)}</i>\nQui mandates-tu ? (meilleures chances de trouver des indices, aucune garantie)`,
    { ...HTML, ...Markup.inlineKeyboard(candidates.map((p) => [Markup.button.callback(`${p.name} (enquête ${p.skills.investigation})`.slice(0, 60), `mh:inv:${m.id}:${p.id}`)])) },
  ];
}
