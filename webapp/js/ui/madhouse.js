// 🏚️ Bâtiment 0 — THE MADHOUSE : la vue du bâtiment qui entoure ton entreprise.
// Le monde complet n'est pas dans le polling : on le demande au backend à l'ouverture
// (requête « world.view ») puis à chaque changement de cycle.

import { h, clear, toast, haptic, openModal, timeAgo } from "./dom.js";
import { section, empty } from "./components.js";

const TABS = [
  ["news", "📰", "Actus"],
  ["report", "📋", "Rapport"],
  ["people", "👥", "Occupants"],
  ["mysteries", "🔍", "Mystères"],
  ["economy", "💰", "Économie"],
  ["power", "🏛️", "Pouvoir"],
  ["building", "🏢", "Étages"],
];

const PLOT_STATE = { active: "en cours", dormant: "en sommeil", resolved: "dénouée", failed: "échec", forgotten: "oubliée" };
const LAW_STATUS = { proposed: "🗳️ en discussion", enacted: "✅ en vigueur", rejected: "❌ rejetée", annulled: "⚖️ annulée", repealed: "🗑️ abrogée" };
const cr = (n) => `${Math.round(n).toLocaleString("fr-FR")} cr`;

function tag(label, kind = "") {
  return h("span", { class: `mh-tag ${kind}` }, label);
}

function eventCard(e, now) {
  return h("div", { class: `card mh-event imp-${e.importance}${e.rare ? " rare" : ""}` },
    h("div", { class: "row" }, h("strong", { class: "grow" }, `${e.rare ? "✨ " : ""}${e.title}`), h("span", { class: "small muted" }, timeAgo(e.at, now))),
    h("p", { class: "small" }, e.text),
    e.narration ? h("p", { class: "small mh-narration" }, `🖋️ ${e.narration.text}`) : null,
    e.why ? h("p", { class: "small muted" }, `↳ pourquoi : ${e.why}`) : null);
}

async function sheetDialog(ctx, personId) {
  let s;
  try {
    s = await ctx.backend.query("world.person", { id: personId });
  } catch (err) {
    return toast(err.message, "error");
  }
  if (!s) return toast("Personne de ce nom dans le Bâtiment.", "error");
  const line = (label, value) => (value ? h("div", { class: "small" }, h("b", {}, `${label} : `), value) : null);
  openModal({
    title: `${s.kind === "animal" ? "🐾" : "🪪"} ${s.name}`,
    body: h("div", { class: "stack" },
      h("div", { class: "row wrap" }, tag(s.title), tag(s.floor), tag(s.status, s.status === "en poste" ? "" : "warn"), s.legend ? tag("🌟 légende", "gold") : null, s.deputy ? tag("🏛️ député", "") : null),
      line("Employeur", s.employer),
      line("Caractère", s.traits.join(", ")),
      line("Faiblesse", s.weakness),
      line("Compétences", s.skills.map((k) => `${k.label} ${k.value}`).join(" · ")),
      line("Ambition", s.ambition),
      line("Conviction", s.conviction ? `« ${s.conviction} »` : null),
      line("Objectif immédiat", s.goals.short),
      line("Fortune", `${cr(s.wealth)}${s.frozen ? " (compte gelé)" : ""} · réputation ${s.reputation}/100 · influence ${s.influence}/100`),
      line("Parts", s.companies.map((c) => `${c.name} (${c.shares}${c.ceo ? ", PDG" : ""})`).join(", ")),
      line("Organisations", `${s.alliances.map((o) => o.name).join(", ") || "—"}${s.hiddenAffiliations ? " + affiliations non déclarées" : ""}`),
      line("Relations", s.relations.slice(0, 6).map((r) => `${r.name} (${r.label})`).join(", ")),
      s.secretsKept ? line("Secrets", `en garde ${s.secretsKept} (contenu inconnu)`) : null,
      s.beliefs.length ? line("Croit savoir", s.beliefs.slice(-2).map((b) => `« ${b.text} » (${b.verdict})`).join(" ; ")) : null,
      s.memories.length ? h("div", {}, h("b", { class: "small" }, "Souvenirs marquants"), h("ul", { class: "small" }, s.memories.map((m) => h("li", {}, m)))) : null,
      s.career.length ? h("div", {}, h("b", { class: "small" }, "Carrière"), h("ul", { class: "small" }, s.career.map((c) => h("li", {}, c)))) : null),
  });
}

async function investigateDialog(ctx, view, mystery) {
  const candidates = view.people.filter((p) => p.kind !== "animal" && ["active", "admin_dead", "double"].includes(p.status)).slice(0, 30);
  const select = h("select", { class: "select" }, candidates.map((p) => h("option", { value: p.id }, `${p.name} — ${p.title}`)));
  const modal = openModal({
    title: `🔍 ${mystery.title}`,
    body: h("div", { class: "stack" }, h("p", { class: "small muted" }, "Tu mandates un enquêteur : il cherchera plus activement. Le mystère ne se résoudra que si les indices et une hypothèse juste sont réunis."), h("label", { class: "field" }, h("span", {}, "Enquêteur"), select)),
    footer: [h("button", {
      class: "btn primary block",
      onClick: async () => {
        try {
          const res = await ctx.backend.action("world.investigate", { mysteryId: mystery.id, personId: select.value });
          haptic("success");
          toast(`🔍 ${res?.title || "Enquêteur mandaté"}`, "success");
          modal.close();
        } catch (err) {
          toast(err.message, "error");
        }
      },
    }, "Mandater")],
  });
}

async function decide(ctx, decisionId, choice) {
  try {
    const res = await ctx.backend.action("world.decide", { decisionId, choice });
    haptic("success");
    toast(`🧾 ${res?.title || "Décision enregistrée"}`, "success", 5000);
  } catch (err) {
    toast(err.message, "error");
  }
}

const RENDER = {
  news(view, ctx) {
    const list = view.events.filter((e) => e.importance >= 2).slice(0, 30);
    return [
      view.decisions.length ? section("🧾 Décisions qui t'attendent", h("div", { class: "stack" }, view.decisions.map((d) => h("div", { class: "card row wrap" }, h("strong", { class: "grow" }, d.title), h("button", { class: "btn small primary", onClick: () => decide(ctx, d.id, "yes") }, "✅ Oui"), h("button", { class: "btn small", onClick: () => decide(ctx, d.id, "no") }, "❌ Non"))))) : null,
      section("📰 Fil du Bâtiment", list.length ? h("div", { class: "stack" }, list.map((e) => eventCard(e, ctx.now()))) : empty("Le Bâtiment s'éveille…")),
      view.media.length ? section("🗞️ Médias (peuvent se tromper)", h("div", { class: "stack" }, view.media.slice(0, 6).map((a) => h("div", { class: "card" }, h("div", { class: "row wrap" }, tag(a.outlet), a.satire ? tag("satire", "warn") : null, a.denied ? tag("démenti par le Tribunal", "bad") : null), h("strong", {}, a.title), h("p", { class: "small" }, a.text))))) : null,
    ];
  },
  report(view, ctx, extra) {
    const r = extra.report;
    if (!r) return [empty("Chargement du rapport…")];
    const LABEL = { rumor: ["Rumeur — non vérifiée", "warn"], hypothesis: ["Hypothèse", "info"] };
    return [
      h("div", { class: "card" }, h("strong", {}, `${r.title} — ${r.span}`), h("p", { class: "small muted" }, r.weather)),
      ...r.sections.map((s) => section(`${s.icon} ${s.title}`, h("div", { class: "stack" }, s.items.map((item) => h("div", { class: "card" },
        LABEL[item.label] ? tag(...LABEL[item.label]) : null,
        h("strong", {}, `${item.rare ? "✨ " : ""}${item.text}`),
        item.detail ? h("p", { class: "small" }, item.detail) : null,
        item.why ? h("p", { class: "small muted" }, `↳ pourquoi : ${item.why}`) : null,
        item.decisionId ? h("div", { class: "row" }, h("button", { class: "btn small primary", onClick: () => decide(ctx, item.decisionId, "yes") }, "✅ Oui"), h("button", { class: "btn small", onClick: () => decide(ctx, item.decisionId, "no") }, "❌ Non")) : null))))),
      r.sections.length ? null : empty("Rien de notable depuis ta dernière visite. Le Bâtiment fait semblant de dormir."),
      h("button", { class: "btn block", onClick: async () => { await ctx.backend.action("world.seen", {}); toast("📋 Rapport marqué comme lu", "success"); extra.reload(); } }, "Marquer comme lu"),
    ];
  },
  people(view, ctx) {
    return [section(`👥 ${view.people.length} occupants (par influence)`, h("div", { class: "stack" }, view.people.map((p) => h("button", { class: "card row mh-person", onClick: () => sheetDialog(ctx, p.id) },
      h("span", { class: "mh-avatar" }, p.kind === "animal" ? "🐾" : p.legend ? "🌟" : p.deputy ? "🏛️" : "🪪"),
      h("div", { class: "grow" }, h("strong", {}, p.name), h("div", { class: "small muted" }, `${p.title} · ${p.floorName}${p.status !== "active" ? ` · ${p.status}` : ""}`)),
      h("div", { class: "small right" }, h("b", {}, `${p.influence}`), h("div", { class: "muted" }, cr(p.wealth)))))))];
  },
  mysteries(view, ctx) {
    return [
      ...view.mysteries.map((m) => h("div", { class: `card mh-mystery ${m.status}` },
        h("div", { class: "row wrap" }, h("strong", { class: "grow" }, m.title), tag({ open: "ouvert", solved: "résolu", cold: "classé" }[m.status] || m.status, m.status === "open" ? "info" : m.status === "solved" ? "good" : "")),
        h("p", { class: "small muted" }, m.question),
        h("div", { class: "small" }, `Indices : ${m.cluesFound}/${m.cluesTotal} · enquêteurs : ${m.investigators.map((i) => i.name).join(", ") || "personne"}${m.focus ? ` · mandaté : ${m.focus}` : ""}`),
        m.publicClues.length ? h("ul", { class: "small" }, m.publicClues.map((c) => h("li", {}, `🧩 ${c}`))) : null,
        m.hypotheses.length ? h("ul", { class: "small" }, m.hypotheses.map((hy) => h("li", {}, `🔮 ${hy.by} : « ${hy.text} » (${hy.verdict})`))) : null,
        m.solution ? h("p", { class: "small" }, `✅ ${m.solution.text} — résolu par ${m.solution.by}`) : null,
        m.status === "open" ? h("button", { class: "btn small", onClick: () => investigateDialog(ctx, view, m) }, "🔍 Mandater un enquêteur") : null)),
      section("🗣️ Rumeurs & hypothèses (non vérifiées)", view.rumors.length || view.hypotheses.length ? h("div", { class: "stack" }, [...view.rumors.map((r) => h("div", { class: "card small" }, tag("rumeur", "warn"), " ", r.text)), ...view.hypotheses.map((x) => h("div", { class: "card small" }, tag("hypothèse", "info"), " ", x.text))]) : empty("Rien ne circule. C'est presque inquiétant.")),
      section("🌀 Registre des anomalies", view.anomalies.length ? h("div", { class: "stack" }, view.anomalies.map((a) => h("div", { class: "card small" }, h("b", {}, a.kind), a.scope ? ` · portée : ${a.scope}` : "", a.effects.length ? ` · ${a.effects.join(", ")}` : ""))) : empty("Aucune anomalie constatée. Pour l'instant.")),
    ];
  },
  economy(view) {
    const e = view.economy;
    return [
      h("p", { class: "small muted" }, `${e.currency} — aucune transaction réelle n'est jamais effectuée.`),
      h("div", { class: "kpis mh-kpis" }, h("div", { class: "kpi" }, h("b", {}, cr(e.total)), h("span", {}, "masse monétaire")), h("div", { class: "kpi" }, h("b", {}, cr(e.treasury)), h("span", {}, "Trésor du Syndic")), h("div", { class: "kpi" }, h("b", {}, String(e.priceIndex)), h("span", {}, "indice des prix"))),
      section("📊 Indicateurs (absurdes mais calculés)", h("div", { class: "stack" }, e.indicators.map((i) => h("div", { class: "row small" }, h("span", { class: "grow" }, i.label), h("b", {}, i.value))))),
      section("🏭 Entreprises", h("div", { class: "stack" }, e.companies.map((c) => h("div", { class: "card" }, h("div", { class: "row" }, h("strong", { class: "grow" }, `${c.status === "active" ? "🟢" : "💀"} ${c.name}`), h("b", {}, cr(c.cash))), h("div", { class: "small muted" }, `PDG ${c.ceo} · ${c.floor} · part ${cr(c.sharePrice)} · actionnaires : ${c.holders.map((x) => `${x.name} (${x.n})`).join(", ")}`))))),
      e.loans.length ? section("🏦 Prêts en cours", h("div", { class: "stack" }, e.loans.map((l) => h("div", { class: "small" }, `${l.borrower} doit ${cr(l.balance)} à ${l.lender} — ${l.status}`)))) : null,
      section("📒 Grand livre public", h("div", { class: "stack" }, e.ledger.map((t) => h("div", { class: "small row" }, h("span", { class: "grow" }, `${t.from} → ${t.to} · ${t.reason}`), h("b", {}, cr(t.amount)))))),
    ];
  },
  power(view) {
    return [
      section("🏛️ Hémicycle", h("div", { class: "card small" }, `Sièges : ${view.parliament.seats.join(", ")}`, h("br"), `Présidence : ${view.parliament.speaker} · prochaines élections dans ${Math.max(0, Math.round(view.parliament.cyclesToElection / 48))} jour(s)`)),
      section("🤝 Organisations", h("div", { class: "stack" }, view.orgs.filter((o) => o.status === "active").map((o) => h("div", { class: "card" }, h("strong", {}, o.name), h("div", { class: "small muted" }, `${o.kind} · dirigé par ${o.leader} · ${o.members.length} membre(s) · réputation ${o.reputation}`), h("p", { class: "small" }, o.goal || ""))))),
      section("📜 Lois", view.laws.length ? h("div", { class: "stack" }, view.laws.slice().reverse().map((l) => h("div", { class: "card small" }, h("b", {}, `${LAW_STATUS[l.status] || l.status} — ${l.title}`), h("div", {}, l.rule), l.votes ? h("div", { class: "muted" }, `${l.votes.for} pour · ${l.votes.against} contre · ${l.votes.absent} absent(s) · portée par ${l.sponsor}`) : null))) : empty("Aucune loi votée pour l'instant.")),
      section("⚖️ Tribunal des Couloirs", view.cases.length ? h("div", { class: "stack" }, view.cases.map((c) => h("div", { class: "card small" }, h("b", {}, c.title), h("div", { class: "muted" }, c.status === "filed" ? "audience à venir" : c.reasoning || c.ruling || "jugé")))) : empty("Aucune affaire.")),
      section("🧵 Intrigues", view.plots.length ? h("div", { class: "stack" }, view.plots.map((p) => h("div", { class: "card small" }, h("div", { class: "row" }, h("b", { class: "grow" }, p.title), tag(PLOT_STATE[p.state] || p.state)), h("div", { class: "muted" }, `${p.cast.slice(0, 5).join(", ")} · enjeu : ${p.goals || "?"}`), h("ul", {}, p.beats.slice(-3).map((b) => h("li", {}, b))), p.resolution ? h("div", {}, `✅ ${p.resolution}`) : null))) : empty("Aucune intrigue visible. Le Bâtiment prépare quelque chose.")),
    ];
  },
  building(view) {
    return [
      section("🏢 Plan (officiel + observations)", h("div", { class: "stack" }, [
        ...view.floors.map((f) => h("div", { class: `card mh-floor ${f.status}` }, h("div", { class: "row" }, h("b", { class: "mh-level" }, String(f.level)), h("strong", { class: "grow" }, f.name), f.onPlan ? null : tag("hors Plan", "warn"), f.anomaly ? tag(`🌀 ${f.anomaly}`, "info") : null, tag(`${f.occupants} occ.`)), h("p", { class: "small muted" }, f.note || f.blurb))),
        ...view.rumoredFloors.map((f) => h("div", { class: "card mh-floor rumored small" }, `❔ ${f.name} — une rumeur ne crée pas un étage.`)),
      ])),
      section("📜 Charte des Murs", h("div", { class: "stack" }, view.charter.map((r) => h("div", { class: "small" }, h("b", {}, `${r.id} `), r.text)))),
      section("📚 Chronique", view.chronicle.length ? h("div", { class: "stack" }, view.chronicle.slice(0, 7).map((d) => h("div", { class: "small" }, h("b", {}, d.day), h("ul", {}, d.lines.slice(0, 5).map((l) => h("li", {}, l.text)))))) : empty("Les archives se remplissent avec le temps.")),
      h("p", { class: "small muted" }, `Cycle ${view.cycle} · ${view.stats.applied} changements validés · ${view.stats.rejected} propositions rejetées par le validateur · ${view.stats.rollbacks} cycle(s) annulé(s) · IA narrative ${view.stats.ai.enabled ? `active (${view.stats.ai.calls}/${view.stats.ai.dailyCalls} aujourd'hui)` : "désactivée"}`),
    ];
  },
};

const madhouse = {
  subtitle: (state) => {
    const b = state.madhouse;
    return b ? `Cycle ${b.cycle} · humeur ${b.mood}/100 · pression ${b.pressure}/100${b.decisions ? ` · ${b.decisions} décision(s)` : ""}` : "";
  },
  mount(body, ctx) {
    let tab = "news";
    let view = null;
    let report = null;
    let loadedCycle = -1;
    let loading = false;
    const tabs = h("div", { class: "chips mh-tabs" });
    const content = h("div", { class: "mh-content" });
    body.append(h("p", { class: "small muted" }, "Ton entreprise occupe l'Étage 1 d'un bâtiment qui vit sans toi. Tu observes, tu arbitres ; tu ne réécris pas son histoire."), tabs, content);

    const render = () => {
      clear(tabs, ...TABS.map(([id, icon, label]) => h("button", { class: `chip${tab === id ? " on" : ""}`, onClick: () => { tab = id; haptic("light"); if (id === "report") loadReport(); render(); } }, `${icon} ${label}`)));
      if (!view) return clear(content, empty("Le Bâtiment se dévoile…"));
      clear(content, ...RENDER[tab](view, ctx, { report, reload: () => load(true) }).filter(Boolean));
    };
    const loadReport = async () => {
      try {
        report = await ctx.backend.query("world.report", {});
      } catch (err) {
        toast(err.message, "error");
      }
      render();
    };
    const load = async (force = false) => {
      const cycle = ctx.state().madhouse?.cycle ?? 0;
      if (loading || (!force && cycle === loadedCycle && view)) return;
      loading = true;
      try {
        view = await ctx.backend.query("world.view", {});
        loadedCycle = cycle;
        if (tab === "report") report = await ctx.backend.query("world.report", {});
      } catch (err) {
        toast(err.message, "error");
      } finally {
        loading = false;
      }
      render();
    };
    render();
    load(true);
    return {
      update(state) {
        // Rechargement à chaque nouveau cycle ou nouvelle décision.
        const b = state.madhouse;
        if (b && (b.cycle !== loadedCycle || (view && b.decisions !== view.decisions.length))) load(true);
      },
    };
  },
};

export const MADHOUSE_PANELS = { madhouse };
