// Cuisine (vie de bureau, potins, interviews, journal) et Annexe (compta, ménage, corbeille).

import { h, clear, toast, haptic, confirmDialog, timeAgo } from "./dom.js";
import { section, empty, missionForm, agentRow, avatar } from "./components.js";
import { DOC_KINDS, roleOf } from "../../shared/roster.js";

// ---------------------------------------------------------------------------
// 🍕 Cuisine & vie de bureau

const kitchen = {
  subtitle: () => "Potins, pauses, blagues et pots d'équipe",
  mount(body, ctx) {
    const world = ctx.world();
    const trigger = (kind, ok) => {
      if (kind === "quests") return ctx.openPanel("quests");
      if (!world) return toast("La 3D n'est pas disponible sur cet appareil.", "error");
      haptic("medium");
      if (world.triggerLife(kind)) {
        toast(ok, "success");
        ctx.close();
      } else {
        toast("Tout le monde est occupé, réessaie dans un instant.", "info");
      }
    };
    const actions = h("div", { class: "kpis", style: { gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" } },
      [
        ["🎂", "Pot surprise", "party", "🎂 Tout le monde en salle de conf' !"],
        ["🛵", "Uber Eats pour l'équipe", "teamLunch", "🛵 Commande passée, le livreur arrive"],
        ["🚨", "Exercice incendie", "fireDrill", "🚨 Évacuation !"],
        ["🏆", "Employé du mois", "quests", ""],
        ["📣", "Réunion improvisée", "meeting", "📣 Victor convoque tout le monde"],
        ["🧹", "Tournée de ménage", "clean", "🧹 Josiane passe le balai"],
      ].map(([icon, label, kind, ok]) => h("button", { class: "kpi", style: { cursor: "pointer" }, onClick: () => trigger(kind, ok) }, h("b", {}, icon), h("span", {}, label))));

    const board = h("input", { class: "input", placeholder: "Écris un mot sur le tableau blanc…", maxlength: 60 });
    const boardForm = h("form", {
      class: "row",
      onSubmit: (e) => {
        e.preventDefault();
        if (!world || !board.value.trim()) return;
        world.writeWhiteboard(board.value.trim(), ctx.state().boss?.name || "Le boss");
        ctx.life.push({ at: Date.now(), icon: "🖊️", text: `${ctx.state().boss?.name || "Le boss"} a écrit « ${board.value.trim()} » sur le tableau blanc.` });
        board.value = "";
        toast("🖊️ C'est écrit en gros dans la cuisine", "success");
      },
    }, h("div", { class: "grow" }, board), h("button", { class: "btn", type: "submit" }, "Écrire"), h("button", { class: "btn ghost", type: "button", onClick: () => world?.eraseWhiteboard() }, "Effacer"));

    const doc = h("input", { type: "checkbox", id: "documentary", checked: world?.documentary !== false });
    doc.addEventListener("change", () => {
      if (world) world.documentary = doc.checked;
      try {
        localStorage.setItem("qg-documentary", doc.checked ? "1" : "0");
      } catch {
        // préférence non mémorisée
      }
    });

    const gossip = h("div");
    const interviews = h("div");
    const sInterviews = section("🎤 Interviews face caméra", interviews);
    const journal = h("div", { class: "card" });
    const info = h("div");
    body.append(
      section("🎬 Mettre de l'ambiance", actions, world ? null : h("p", { class: "small muted" }, "Ces animations nécessitent la 3D.")),
      section("🖊️ Tableau blanc de la cuisine", h("div", { class: "card" }, boardForm)),
      h("label", { class: "row card section", style: { gap: "10px" } }, doc, h("span", {}, "📹 Interviews face caméra façon documentaire")),
      section("🗞️ Potins du bureau", gossip),
      sInterviews,
      section("📰 Journal de l'entreprise", journal),
      info
    );
    return {
      update(state) {
        const items = [...ctx.life.entries, ...(state.life?.stories || [])].sort((a, b) => b.at - a.at).slice(0, 30);
        clear(gossip, items.length
          ? h("div", { class: "stack" }, items.map((l) => h("div", { class: "story" }, h("div", { class: "story-icon" }, l.icon), h("div", { class: "grow" }, h("div", { class: "story-text" }, l.text), h("div", { class: "story-meta" }, h("time", {}, timeAgo(l.at, ctx.now())))))))
          : empty("Rien à signaler… pour l'instant. Reste un peu, ça va bouger."));
        const quotes = [...ctx.life.interviews].reverse().slice(0, 8);
        sInterviews.setCount(quotes.length || null);
        clear(interviews, quotes.length
          ? quotes.map((q) => h("div", { class: "card row", style: { alignItems: "flex-start" } },
            avatar(q.agent),
            h("div", { class: "grow" }, h("div", { style: { fontStyle: "italic", lineHeight: 1.45 } }, `« ${q.quote} »`), h("div", { class: "small muted", style: { marginTop: "4px" } }, `${q.agent.name}, ${roleOf(q.agent).label.toLowerCase()}`))))
          : empty("Les employés passent parfois devant la caméra après une blague ou une réunion improvisée."));
        const log = [...state.log].reverse().slice(0, 40);
        clear(journal, log.length ? log.map((l) => h("div", { class: "log-item" }, h("span", {}, l.icon), h("div", { class: "grow" }, l.text, h("time", {}, timeAgo(l.at, ctx.now()))))) : empty("Rien pour l'instant."));
        clear(info, ctx.backend.mode === "demo"
          ? h("div", { class: "card section" },
            h("strong", {}, "🎮 Mode démo"),
            h("p", { class: "small muted" }, "L'entreprise tourne dans ce navigateur avec des livrables générés par modèles. Ouvre-la depuis ton bot Telegram (/office) pour tes vraies données, les rappels Telegram et, avec une clé API, des agents qui travaillent avec l'IA Claude."),
            h("button", { class: "btn small danger", onClick: async () => { if (await confirmDialog("Remettre la démo à zéro ?")) ctx.backend.reset(); } }, "Réinitialiser la démo"))
          : h("div", { class: "card section" },
            h("strong", {}, ctx.backend.ai?.enabled ? `🤖 Agents propulsés par l'IA (${ctx.backend.ai.model})` : "🧩 Agents en mode modèles"),
            h("p", { class: "small muted", style: { marginBottom: 0 } }, ctx.backend.ai?.enabled ? "Chaque mission est réellement traitée par l'IA selon le métier de l'employé." : "Ajoute ANTHROPIC_API_KEY dans la configuration du bot pour que les employés travaillent avec l'IA.")));
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 🧾 Annexe : compta, ménage, corbeille

function marginCalculator() {
  const buy = h("input", { class: "input", type: "number", min: 0, step: "0.5", placeholder: "Achat €" });
  const sell = h("input", { class: "input", type: "number", min: 0, step: "0.5", placeholder: "Vente €" });
  const fees = h("input", { class: "input", type: "number", min: 0, step: "0.5", placeholder: "Frais €" });
  const result = h("div", { class: "kpis", style: { gridTemplateColumns: "1fr 1fr", marginTop: "10px" } });
  const compute = () => {
    const b = Number(buy.value) || 0;
    const s = Number(sell.value) || 0;
    const f = Number(fees.value) || 0;
    const margin = s - b - f;
    clear(result,
      h("div", { class: `kpi${margin < 0 ? " hot" : ""}` }, h("b", {}, `${margin.toFixed(2)} €`), h("span", {}, "Marge nette")),
      h("div", { class: "kpi" }, h("b", {}, s ? `${Math.round((margin / s) * 100)} %` : "—"), h("span", {}, "Taux de marge")));
  };
  for (const input of [buy, sell, fees]) input.addEventListener("input", compute);
  compute();
  return h("div", { class: "card" }, h("div", { class: "grid2", style: { gridTemplateColumns: "1fr 1fr 1fr" } }, buy, sell, fees), result);
}

const annexe = {
  subtitle: (state) => `Compta avec ${state.agents.find((a) => a.role === "accountant")?.name || "le comptable"} · ménage par ${state.agents.find((a) => a.role === "cleaner")?.name || "l'entretien"}`,
  mount(body, ctx) {
    const team = h("div");
    const cleaning = h("div");
    const trash = h("div");
    const sTrash = section("🗑️ Corbeille", trash);
    const accountant = ctx.state().agents.find((a) => a.role === "accountant");
    body.append(
      section("👥 L'annexe", team),
      section("🧮 Calculette de marge", marginCalculator()),
      section(`＋ Demander à ${accountant?.name || "la compta"}`, missionForm(ctx, {
        agentId: accountant?.id,
        type: "finance",
        placeholder: "Ex : Calcule ma marge du mois (achats 320 €, ventes 910 €)",
        presets: ["Tableau de suivi des ventes du mois", "Budget pour lancer le pôle créateurs", "Combien je dois vendre pour me payer 1 500 € ?"],
      })),
      section("🧹 Ménage & cache", cleaning),
      sTrash
    );
    return {
      update(state) {
        clear(team, state.agents.filter((a) => ["accountant", "cleaner"].includes(a.role) || a.role === "intern").map((a) => agentRow(ctx, a)));
        const hk = state.housekeeping || {};
        const working = state.tasks.find((t) => t.type === "cleaning" && ["queued", "working"].includes(t.status));
        const r = hk.lastReport;
        clear(cleaning, h("div", { class: "card" },
          h("p", { style: { marginTop: 0 } }, `Dernier ménage : ${hk.lastAt ? timeAgo(hk.lastAt, ctx.now()) : "jamais"}${hk.runs ? ` · ${hk.runs} passage(s)` : ""}. Le ménage automatique passe toutes les 8 h.`),
          r ? h("p", { class: "small muted" }, `Dernière fois : ${r.log} entrées de journal archivées, ${r.trash} document(s) de la corbeille, ${r.tasks} vieille(s) mission(s), ${r.events} rendez-vous passés, ${r.deals} bon(s) plan(s) expiré(s).`) : null,
          h("p", { class: "small muted" }, "Le ménage vide aussi le cache des documents sur ton téléphone. Les livrables des archives ne sont jamais supprimés."),
          h("button", { class: "btn primary block", disabled: !!working, onClick: () => ctx.run("office.clean", {}, "🧹 Josiane attaque le grand ménage") }, working ? "🧹 Ménage en cours…" : "🧹 Faire le ménage maintenant")));
        const items = [...(state.trash || [])].reverse();
        sTrash.setCount(items.length || null);
        clear(trash, items.length
          ? h("div", {},
            items.map((d) => h("div", { class: "doc" },
              h("div", { class: "doc-icon" }, DOC_KINDS[d.kind]?.icon || "📄"),
              h("div", { class: "grow" }, h("div", { class: "doc-title ellipsis" }, d.title), h("div", { class: "doc-excerpt" }, `Supprimé ${timeAgo(d.deletedAt, ctx.now())}`)),
              h("button", { class: "btn small", onClick: () => ctx.run("doc.restore", { docId: d.id }, "♻️ Document restauré") }, "Restaurer"))),
            h("button", { class: "btn danger block", style: { marginTop: "10px" }, onClick: async () => { if (await confirmDialog("Vider définitivement la corbeille ?")) ctx.run("trash.empty", {}, "🧹 Corbeille vidée"); } }, "Vider la corbeille"))
          : empty("La corbeille est vide. Josiane approuve."));
      },
    };
  },
};

export const LIFE_PANELS = { kitchen, annexe };
