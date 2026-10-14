// Tableaux de bord des pôles : Vente, Sourcing & Bons plans, Social & Contenu, Créateurs, Marketing, Juridique.

import { h, clear, toast, haptic, timeAgo, openLink, shouldInterceptLinks } from "./dom.js";
import { section, empty, taskList, missionForm, docRow, agentRow } from "./components.js";
import { DEPARTMENTS } from "../../shared/roster.js";

const open = (status) => ["queued", "working", "review"].includes(status);

function leastLoaded(state, role) {
  const load = (id) => state.tasks.filter((t) => t.agentId === id && (t.status === "queued" || t.status === "working")).length;
  return state.agents.filter((a) => a.role === role).sort((a, b) => load(a.id) - load(b.id))[0] || null;
}

async function createTask(ctx, payload, success) {
  try {
    await ctx.backend.action("task.create", payload);
    toast(success, "success");
    haptic("success");
    return true;
  } catch (err) {
    toast(err.message, "error");
    return false;
  }
}

// Gabarit commun : équipe, bloc spécifique, mission au pôle, chantiers, livrables.
function deptPanel({ dept, presets, placeholder, extras, deliverableKinds = null }) {
  return {
    subtitle: (state) => {
      const members = state.agents.filter((a) => a.dept === dept);
      const busy = state.tasks.filter((t) => members.some((m) => m.id === t.agentId) && t.status === "working").length;
      return `${members.length} employé(s) · ${busy ? `${busy} au travail` : "tout le monde est dispo"}`;
    },
    mount(body, ctx) {
      const team = h("div");
      const queue = h("div");
      const delivered = h("div");
      const sQueue = section("🛠️ Missions en cours", queue);
      const sDelivered = section("📦 Derniers livrables", delivered);
      const extra = extras ? extras(ctx) : null;
      body.append(
        h("p", { class: "small muted", style: { marginTop: 0 } }, DEPARTMENTS[dept].summary),
        section("👥 L'équipe", team),
        extra?.el || null,
        section("＋ Confier une mission au pôle", missionForm(ctx, { dept, showAgentSelect: true, presets, placeholder })),
        sQueue,
        sDelivered
      );
      return {
        update(state) {
          const members = state.agents.filter((a) => a.dept === dept).sort((a, b) => (b.role === "manager") - (a.role === "manager"));
          clear(team, members.length ? members.map((a) => agentRow(ctx, a)) : empty("Personne dans ce pôle pour l'instant : recrute depuis « Équipes »."));
          const ids = new Set(members.map((a) => a.id));
          const tasks = state.tasks.filter((t) => ids.has(t.agentId) && open(t.status));
          sQueue.setCount(tasks.length);
          clear(queue, taskList(ctx, tasks, "Aucune mission en cours."));
          const docs = state.documents.filter((d) => ids.has(d.authorId) && (!deliverableKinds || deliverableKinds.includes(d.kind))).slice(-8).reverse();
          sDelivered.setCount(docs.length || null);
          clear(delivered, docs.length ? docs.map((d) => docRow(ctx, d)) : empty("Les livrables du pôle apparaîtront ici."));
          extra?.update?.(state);
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// 🛍️ Pôle Vente

function vinteExpress(ctx) {
  const item = h("input", { class: "input", placeholder: "Ex : Sweat Carhartt bordeaux", maxlength: 80 });
  const brand = h("input", { class: "input", placeholder: "Marque", maxlength: 40 });
  const size = h("input", { class: "input", placeholder: "Taille (M, 42…)", maxlength: 12 });
  const condition = h("select", { class: "select" }, ["Neuf avec étiquette", "Neuf sans étiquette", "Très bon état", "Bon état", "Satisfaisant"].map((c) => h("option", { selected: c === "Très bon état" }, c)));
  const bought = h("input", { class: "input", type: "number", min: 0, step: "0.5", placeholder: "Prix d'achat (€)" });
  const notes = h("textarea", { class: "textarea", rows: 2, placeholder: "Détails (défauts, mesures, matière…)" });
  const submit = h("button", { class: "btn primary block", type: "submit" }, "🏷️ Rédiger l'annonce");
  const form = h("form", {
    onSubmit: async (e) => {
      e.preventDefault();
      if (!item.value.trim()) return item.focus();
      submit.disabled = true;
      const seller = leastLoaded(ctx.state(), "vinted");
      const ok = await createTask(ctx, {
        title: `Annonce Vinted — ${item.value.trim()}`,
        brief: [`Article : ${item.value.trim()}`, brand.value && `Marque : ${brand.value}`, size.value && `Taille ${size.value}`, `État : ${condition.value}`, bought.value && `Acheté ${bought.value} €`, notes.value].filter(Boolean).join("\n"),
        type: "listing",
        agentId: seller?.id,
      }, `🏷️ ${seller?.name || "L'équipe vente"} rédige l'annonce`);
      if (ok) item.value = brand.value = size.value = bought.value = notes.value = "";
      submit.disabled = false;
    },
  },
  h("label", { class: "field" }, h("span", {}, "Article"), item),
  h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, "Marque"), brand), h("label", { class: "field" }, h("span", {}, "Taille"), size)),
  h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, "État"), condition), h("label", { class: "field" }, h("span", {}, "Prix d'achat"), bought)),
  h("label", { class: "field" }, h("span", {}, "Notes"), notes),
  submit);
  return { el: section("⚡ Annonce Vinted express", h("div", { class: "card" }, form)) };
}

const vente = deptPanel({
  dept: "vente",
  presets: ["Prépare l'expédition des colis du jour", "Réponds à un acheteur qui demande une remise", "Plan de shooting pour 10 articles", "Stratégie pour écouler le stock dormant"],
  placeholder: "Ex : Booste les ventes Vinted de la semaine",
  extras: vinteExpress,
});

// ---------------------------------------------------------------------------
// 🔎 Sourcing & Bons plans

function dealsBlock(ctx) {
  const feed = h("div");
  const sFeed = section("🔥 Bons plans dénichés", feed);

  const huntTopic = h("input", { class: "input", placeholder: "Ex : sneakers Nike sous 60 €, vols Paris → Bali", maxlength: 200 });
  const huntBtn = h("button", { class: "btn primary", type: "submit" }, "🔎 Chasser");
  const hunt = h("form", {
    class: "row",
    onSubmit: async (e) => {
      e.preventDefault();
      if (!huntTopic.value.trim()) return huntTopic.focus();
      const hunter = leastLoaded(ctx.state(), "dealhunter");
      if (await createTask(ctx, { title: `Chasse aux bons plans : ${huntTopic.value.trim()}`.slice(0, 140), brief: huntTopic.value.trim(), type: "dealhunt", agentId: hunter?.id }, `🔎 ${hunter?.name || "Les dénicheurs"} part en chasse`)) huntTopic.value = "";
    },
  }, h("div", { class: "grow" }, huntTopic), huntBtn);

  const enabled = h("input", { type: "checkbox", id: "watch-enabled" });
  const every = h("select", { class: "select" }, [3, 6, 12, 24, 48].map((n) => h("option", { value: n }, n < 24 ? `Toutes les ${n} h` : n === 24 ? "Tous les jours" : "Tous les 2 jours")));
  const topics = h("textarea", { class: "textarea", rows: 3, placeholder: "Un sujet par ligne : vols pas chers depuis Paris, Nike Dunk < 80 €, consoles reconditionnées…" });
  const status = h("p", { class: "small muted", style: { margin: "6px 0 0" } });
  const watchForm = h("form", {
    onSubmit: async (e) => {
      e.preventDefault();
      try {
        await ctx.backend.action("dealWatch.update", { enabled: enabled.checked, everyHours: Number(every.value), topics: topics.value });
        toast(enabled.checked ? "🔁 Veille automatique activée" : "Veille automatique désactivée", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    },
  },
  h("label", { class: "row", style: { marginBottom: "10px", gap: "8px" } }, enabled, h("span", {}, "Activer la veille automatique des dénicheurs")),
  h("label", { class: "field" }, h("span", {}, "Fréquence"), every),
  h("label", { class: "field" }, h("span", {}, "Sujets à surveiller"), topics),
  h("button", { class: "btn block", type: "submit" }, "Enregistrer la veille"),
  status);

  let loaded = false;
  const el = h("div", {},
    section("🎯 Lancer une chasse", h("div", { class: "card" }, hunt, h("p", { class: "small muted", style: { margin: "8px 0 0" } }, ctx.backend.ai?.enabled ? "Avec l'IA, les dénicheurs cherchent vraiment sur le web et citent leurs sources." : "En mode modèles, les dénicheurs rendent une méthode de veille ; avec une clé API, ils cherchent sur le web."))),
    sFeed,
    section("🔁 Veille automatique", h("div", { class: "card" }, watchForm)));

  return {
    el,
    update(state) {
      const watch = state.settings?.dealWatch || {};
      if (!loaded) {
        enabled.checked = !!watch.enabled;
        every.value = String(watch.everyHours || 12);
        topics.value = watch.topics || "";
        loaded = true;
      }
      status.textContent = watch.enabled ? `Dernière veille : ${watch.lastRunAt ? timeAgo(watch.lastRunAt, ctx.now()) : "pas encore"}. Chaque veille consomme des crédits IA.` : "La veille consomme des crédits IA : active-la seulement sur des sujets utiles.";
      const deals = (state.deals || []).filter((d) => !d.dismissed).slice().reverse();
      sFeed.setCount(deals.length || null);
      clear(feed, deals.length
        ? deals.slice(0, 25).map((d) => h("div", { class: "card" },
          h("div", { class: "row", style: { alignItems: "flex-start" } },
            h("div", { class: "task-icon" }, d.category === "vol" ? "✈️" : "🔥"),
            h("div", { class: "grow" },
              h("div", { class: "task-title" }, d.title),
              d.summary ? h("div", { class: "small muted", style: { marginTop: "3px" } }, d.summary.slice(0, 160)) : null,
              h("div", { class: "task-meta" }, h("span", {}, state.agents.find((a) => a.id === d.hunterId)?.name || "Dénicheur"), h("span", {}, "·"), h("span", {}, d.source || "web"), h("span", {}, "·"), h("span", {}, timeAgo(d.foundAt, ctx.now()))))),
          h("div", { class: "task-actions" },
            d.link ? h("a", { class: "btn small", href: d.link, target: "_blank", rel: "noopener noreferrer", onClick: (e) => { if (shouldInterceptLinks()) { e.preventDefault(); openLink(d.link); } } }, "🔗 Voir") : null,
            h("button", { class: "btn small", onClick: () => ctx.run("deal.toTask", { dealId: d.id }, "🧠 L'équipe analyse le bon plan") }, "🧠 Analyser"),
            h("button", { class: "btn small ghost", onClick: () => ctx.run("deal.dismiss", { dealId: d.id }) }, "Masquer"))))
        : empty(ctx.backend.mode === "telegram" ? "Aucun bon plan pour l'instant : les vols trouvés par le bot arrivent ici automatiquement, et les chasses de Lucas et Emma aussi." : "Aucun bon plan pour l'instant. Lance une chasse ci-dessus."));
    },
  };
}

const sourcing = deptPanel({
  dept: "sourcing",
  presets: ["Trouve des fournisseurs de vêtements vintage en lot", "Quelles marques revendre cet hiver ?", "Compare 3 grossistes de sneakers"],
  placeholder: "Ex : Trouve un lot de vestes de marque à moins de 10 € pièce",
  extras: dealsBlock,
});

// ---------------------------------------------------------------------------
// 📱 Social & Contenu

function socialBlock(ctx) {
  const topic = h("input", { class: "input", placeholder: "Ex : 3 astuces pour vendre plus vite sur Vinted", maxlength: 120 });
  const duration = h("select", { class: "select" }, ["15 secondes", "30 secondes", "60 secondes"].map((d) => h("option", { selected: d === "30 secondes" }, d)));
  const style = h("select", { class: "select" }, ["Tutoriel", "Storytelling", "Humour", "Avant / après", "Coulisses", "Unboxing"].map((s) => h("option", {}, s)));
  const submit = h("button", { class: "btn primary block", type: "submit" }, "🎬 Lancer le montage");
  const form = h("form", {
    onSubmit: async (e) => {
      e.preventDefault();
      if (!topic.value.trim()) return topic.focus();
      submit.disabled = true;
      const editor = leastLoaded(ctx.state(), "tiktok");
      if (await createTask(ctx, { title: `Vidéo TikTok — ${topic.value.trim()}`.slice(0, 140), brief: `Sujet : ${topic.value.trim()}\nDurée : ${duration.value}\nStyle : ${style.value}`, type: "video", agentId: editor?.id }, `🎬 ${editor?.name || "Le monteur"} prépare la vidéo`)) topic.value = "";
      submit.disabled = false;
    },
  },
  h("label", { class: "field" }, h("span", {}, "Sujet"), topic),
  h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, "Durée"), duration), h("label", { class: "field" }, h("span", {}, "Style"), style)),
  submit);

  const quick = (label, role, type, title) => h("button", {
    class: "btn small",
    type: "button",
    onClick: () => {
      const agent = leastLoaded(ctx.state(), role);
      createTask(ctx, { title, type, agentId: agent?.id }, `${label.split(" ")[0]} ${agent?.name || "L'équipe"} s'en occupe`);
    },
  }, label);

  return {
    el: h("div", {},
      section("🎬 Commander une vidéo TikTok", h("div", { class: "card" }, form)),
      section("⚡ Contenus express", h("div", { class: "chips" },
        quick("👻 Stories Snap de la semaine", "snap", "social", "Plan de stories Snapchat pour la semaine"),
        quick("✈️ Posts Telegram du jour", "telegram", "channel", "3 posts pour le canal Telegram aujourd'hui"),
        quick("✍️ Description de boutique", "writer", "content", "Description accrocheuse pour notre boutique"),
        quick("🎬 Idées de vidéos", "tiktok", "video", "10 idées de vidéos TikTok pour la semaine")))),
  };
}

const social = deptPanel({
  dept: "social",
  presets: ["Calendrier de contenu du mois", "Script de story pour le drop de samedi", "Post Telegram pour annoncer les nouveautés"],
  placeholder: "Ex : Prépare le lancement de notre compte TikTok",
  extras: socialBlock,
});

// ---------------------------------------------------------------------------
// 💎 Pôle Créateurs (OFM, en préparation)

const LAUNCH_STEPS = [
  ["Cadre légal et contrats", "Statut, contrats clairs (rémunération, durée, résiliation), conseil juridique."],
  ["Charte de conformité", "Personnes majeures, vérifiées et consentantes ; règles des plateformes respectées."],
  ["Offre et tarifs de l'agence", "Ce que l'agence apporte, commission, reporting."],
  ["Recrutement des premiers profils", "Critères, process d'entretien, période d'essai."],
  ["Planning de contenu et outils", "Calendrier partagé, suivi des revenus, tableau de bord mensuel."],
  ["Marketing grand public", "Croissance sur TikTok, Snapchat, Instagram avec du contenu adapté."],
];

function createursBlock(ctx) {
  const list = h("div");
  return {
    el: h("div", {},
      h("div", { class: "card section", style: { borderColor: "#c77dff" } },
        h("strong", {}, "🚧 Ouverture prochaine"),
        h("p", { class: "small muted", style: { marginBottom: 0 } }, "Chloé prépare le terrain. Touche une étape pour la lui confier : le livrable arrive aux archives et la case se coche.")),
      section("🗺️ Feuille de route du lancement", list)),
    update(state) {
      const talent = state.agents.find((a) => a.role === "talent");
      clear(list, LAUNCH_STEPS.map(([title, detail]) => {
        const task = [...state.tasks].reverse().find((t) => t.title === `Lancement — ${title}`);
        const done = task?.status === "done";
        return h("div", { class: "agent-row", onClick: () => {
          if (task && ["queued", "working", "review"].includes(task.status)) return toast("Déjà en cours 👌");
          createTask(ctx, { title: `Lancement — ${title}`, brief: detail, type: "talent", agentId: talent?.id }, `💎 ${talent?.name || "Le pôle"} s'en occupe`);
        } },
        h("div", { class: "task-icon" }, done ? "✅" : task ? "⏳" : "⬜"),
        h("div", { class: "grow" }, h("div", { style: { fontWeight: 700, fontSize: "14px" } }, title), h("div", { class: "small muted" }, detail)));
      }));
    },
  };
}

const createurs = deptPanel({
  dept: "createurs",
  presets: ["Benchmark des agences existantes", "Plan marketing grand public du pôle", "Process de recrutement des créatrices"],
  placeholder: "Ex : Prépare la présentation du pôle aux futures créatrices",
  extras: createursBlock,
});

// ---------------------------------------------------------------------------
// 🎨 Marketing & Création

function quickGrid(ctx, items) {
  return h("div", { class: "quick-grid" }, items.map(([icon, label, role, type, title]) => h("button", {
    class: "quick",
    onClick: () => {
      const agent = leastLoaded(ctx.state(), role);
      createTask(ctx, { title, type, agentId: agent?.id }, `${icon} ${agent?.name || "Le pôle"} s'y met`);
    },
  }, h("b", {}, icon), h("span", {}, label))));
}

function marketingBlock(ctx) {
  return {
    el: section("⚡ Commandes express", quickGrid(ctx, [
      ["🎨", "Miniatures TikTok", "designer", "design", "Pack de 3 miniatures TikTok pour nos prochaines vidéos"],
      ["🏷️", "Logo de la boutique", "designer", "design", "Logo et mini-charte graphique de la boutique"],
      ["📈", "Campagne pub 50 €", "growth", "ads", "Campagne pub TikTok/Meta à 50 € pour booster les ventes"],
      ["📊", "Tableau de bord", "data", "data", "Tableau de bord des ventes et des réseaux du mois"],
    ])),
  };
}

const marketing = deptPanel({
  dept: "marketing",
  presets: ["Charte graphique de la marque", "Plan d'acquisition sur 30 jours", "Analyse des stats TikTok du mois"],
  placeholder: "Ex : Bannière pour le canal Telegram",
  extras: marketingBlock,
});

// ---------------------------------------------------------------------------
// ⚖️ Juridique & Admin

function legalBlock(ctx) {
  return {
    el: h("div", {},
      h("div", { class: "card section", style: { borderColor: "#8fa3bf" } },
        h("strong", {}, "⚖️ Bon à savoir"),
        h("p", { class: "small muted", style: { marginBottom: 0 } }, "Sandrine prépare des modèles et des analyses solides, mais ce n'est pas un avis d'avocat : fais valider les points sensibles par un professionnel. Avec une clé API, elle vérifie les règles en vigueur sur le web.")),
      section("⚡ Documents express", quickGrid(ctx, [
        ["📜", "CGV boutique", "lawyer", "legal", "Conditions générales de vente pour ma boutique en ligne"],
        ["🔏", "Mentions légales", "lawyer", "legal", "Mentions légales et politique de confidentialité RGPD du site"],
        ["🤝", "Contrat freelance", "lawyer", "legal", "Modèle de contrat de prestation pour un freelance (monteur vidéo)"],
        ["🗂️", "Démarches du mois", "admin", "admin", "Checklist des démarches administratives et échéances du mois"],
      ]))),
  };
}

const legal = deptPanel({
  dept: "juridique",
  presets: ["Seuils micro-entreprise et TVA", "Contrat de collaboration créatrice (modèle)", "Que faire en cas de litige Vinted ?"],
  placeholder: "Ex : Ai-je le droit de revendre des articles neufs ?",
  extras: legalBlock,
});

export const DEPT_PANELS = { vente, sourcing, social, createurs, marketing, legal };
