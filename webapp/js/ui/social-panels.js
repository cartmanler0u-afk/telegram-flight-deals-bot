// Vie sociale : élection de l'employé du mois (quêtes), RH (relations, stagiaires, potins)
// et salle de repos (chats, ambiance, sport).

import { h, clear, toast, haptic, openModal, confirmDialog, promptDialog, timeAgo } from "./dom.js";
import { section, empty, missionForm, agentRow, avatar, agentOf } from "./components.js";
import { DEPARTMENTS, ROLES, roleOf } from "../../shared/roster.js";
import { RELATION_KINDS, CAT_COATS, HIDING_SPOTS, monthLabel, canHoldCeremony, relationsOf } from "../../shared/social.js";

const KIND_META = {
  mystery: { icon: "🕵️", label: "Enquête" },
  seek: { icon: "🔎", label: "Cache-cache" },
  mediation: { icon: "🤝", label: "Médiation" },
  quiz: { icon: "❓", label: "Quiz" },
  mission: { icon: "💼", label: "Mission" },
};

const stars = (n) => (n > 0 ? "⭐".repeat(Math.min(n, 8)) : "—");

async function act(ctx, type, payload) {
  try {
    const result = await ctx.backend.action(type, payload);
    haptic("success");
    return result;
  } catch (err) {
    toast(err.message, "error");
    return null;
  }
}

function resultCard(result) {
  return h("div", { class: `card quest-result ${result.success ? "ok" : "ko"}` },
    h("strong", {}, result.success ? `Réussi ! ${stars(result.stars)}` : "Raté…"),
    h("p", { style: { margin: "6px 0 0" } }, result.message));
}

// ---------------------------------------------------------------------------
// Fenêtres de quêtes

function mysteryBody(ctx, quest, close) {
  const state = ctx.state();
  const wrap = h("div");
  const render = () => {
    const q = ctx.state().life?.round?.quests.find((x) => x.id === quest.id) || quest;
    const shown = q.clues.slice(0, q.cluesShown || 0);
    clear(wrap,
      h("p", { class: "quest-intro" }, q.intro),
      h("div", { class: "card rule" }, `🧩 ${q.rule}`),
      section("🗣️ Les suspects",
        h("div", { class: "stack" }, q.suspects.map((id) => {
          const a = agentOf(state, id);
          return h("div", { class: "card suspect" },
            h("div", { class: "row" }, avatar(a || { name: "?" }), h("div", { class: "grow" }, h("strong", {}, a?.name || "?"), h("div", { class: "small muted" }, roleOf(a).label))),
            h("blockquote", { class: "statement" }, `« ${q.statements[id]} »`),
            q.status === "open" ? h("button", {
              class: "btn small danger",
              onClick: async () => {
                if (!(await confirmDialog(`Accuser ${a?.name} ? Tu n'as droit qu'à une seule accusation.`, { confirmLabel: "Accuser" }))) return;
                const result = await act(ctx, "quest.solve", { questId: q.id, answer: id });
                if (result) done(result);
              },
            }, "👉 Accuser") : null);
        }))),
      section("🔍 Témoignages",
        shown.length ? h("div", { class: "stack" }, shown.map((c) => {
          const by = agentOf(state, c.by);
          return h("div", { class: "card clue" }, h("div", { class: "row" }, avatar(by || { name: "?" }), h("div", { class: "grow" }, h("strong", {}, by?.name || "Un témoin"), h("div", {}, `« ${c.text} »`))));
        })) : empty("Personne n'a encore témoigné."),
        q.status === "open" && (q.cluesShown || 0) < q.clues.length
          ? h("button", { class: "btn block", style: { marginTop: "8px" }, onClick: async () => { if (await act(ctx, "quest.clue", { questId: q.id })) render(); } }, `🔍 Interroger un témoin (${q.cluesShown || 0}/${q.clues.length})`)
          : null),
    );
  };
  const done = (result) => {
    clear(wrap, h("p", { class: "quest-intro" }, quest.intro), resultCard(result));
    toast(result.success ? "🏆 Affaire résolue !" : "😬 Mauvais suspect…", result.success ? "success" : "info");
    if (result.success) ctx.world()?.celebrate?.();
  };
  render();
  return wrap;
}

function seekBody(ctx, quest, close) {
  const spot = HIDING_SPOTS.find((s) => s.id === quest.spotId);
  return h("div", {},
    h("p", { class: "quest-intro" }, quest.intro),
    h("div", { class: "card rule" }, `🧭 Indice : regarde ${quest.hint}. ${quest.item.id === "cat" ? "Le chat fait la sieste et ne bouge plus." : "L'objet brille légèrement."}`),
    h("button", {
      class: "btn primary block",
      onClick: () => {
        close();
        ctx.close();
        const world = ctx.world();
        if (world && spot) {
          const zone = HIDING_SPOTS.filter((s) => s.near === spot.near);
          const x = zone.reduce((a, s) => a + s.x, 0) / zone.length;
          const z = zone.reduce((a, s) => a + s.z, 0) / zone.length;
          world.focusPoint(x + (Math.random() - 0.5) * 6, z + (Math.random() - 0.5) * 3, 18, false);
        }
        toast(`🔎 Cherche ${quest.item.id === "cat" ? quest.item.label : "l'objet"} ${quest.hint} et touche-le !`, "info", 6000);
      },
    }, "🔎 Chercher dans les bureaux"));
}

function mediationBody(ctx, quest) {
  const state = ctx.state();
  const other = agentOf(state, quest.otherId);
  const wrap = h("div");
  clear(wrap,
    h("p", { class: "quest-intro" }, quest.intro),
    h("div", { class: "card row" }, avatar(other || { name: "?" }, "lg"), h("div", { class: "grow" },
      h("strong", {}, other?.name || "?"),
      h("div", { class: "chips", style: { marginTop: "6px" } }, quest.profile.map((t) => h("span", { class: "chip" }, `🧬 ${t}`))))),
    h("div", { class: "card rule" }, `💡 ${quest.rule}`),
    h("div", { class: "stack", style: { marginTop: "10px" } }, quest.options.map((o) => h("button", {
      class: "btn block option",
      onClick: async () => {
        const result = await act(ctx, "quest.solve", { questId: quest.id, answer: o.id });
        if (!result) return;
        clear(wrap, h("p", { class: "quest-intro" }, quest.intro), resultCard(result));
        if (result.success) ctx.world()?.celebrate?.();
      },
    }, o.label))));
  return wrap;
}

function quizBody(ctx, quest) {
  const wrap = h("div");
  const answers = quest.questions.map(() => null);
  const submit = h("button", { class: "btn primary block", disabled: true }, "Valider mes réponses");
  const blocks = quest.questions.map((q, qi) => h("div", { class: "card quiz-q" },
    h("strong", {}, `${qi + 1}. ${q.question}`),
    h("div", { class: "chips", style: { marginTop: "8px" } }, q.options.map((label, oi) => {
      const chip = h("button", {
        class: "chip",
        type: "button",
        onClick: () => {
          answers[qi] = oi;
          for (const c of chip.parentElement.children) c.classList.toggle("on", c === chip);
          submit.disabled = answers.some((a) => a === null);
        },
      }, label);
      return chip;
    }))));
  submit.addEventListener("click", async () => {
    submit.disabled = true;
    const result = await act(ctx, "quest.solve", { questId: quest.id, answer: answers });
    if (!result) {
      submit.disabled = false;
      return;
    }
    clear(wrap, h("p", { class: "quest-intro" }, quest.intro), resultCard(result));
    if (result.success) ctx.world()?.celebrate?.();
  });
  clear(wrap, h("p", { class: "quest-intro" }, quest.intro), h("div", { class: "stack" }, blocks), h("div", { style: { marginTop: "12px" } }, submit));
  return wrap;
}

function missionBody(ctx, quest, close) {
  const nominee = agentOf(ctx.state(), quest.nomineeId);
  const pct = Math.round(((quest.progress || 0) / quest.target) * 100);
  return h("div", {},
    h("p", { class: "quest-intro" }, quest.intro),
    h("div", { class: "card" },
      h("div", { class: "row" }, h("strong", { class: "grow" }, "Progression"), h("span", {}, `${quest.progress || 0} / ${quest.target}`)),
      h("div", { class: "progress" }, h("i", { style: { width: `${pct}%` } }))),
    nominee ? section(`＋ Confier une mission à ${nominee.name}`, missionForm(ctx, { agentId: nominee.id, placeholder: `Que doit faire ${nominee.name} ?`, onDone: () => close() })) : null,
    h("p", { class: "small muted" }, "La quête se valide toute seule dès que les missions sont livrées (pense à valider les dossiers importants)."));
}

export function openQuest(ctx, quest) {
  const meta = KIND_META[quest.kind] || KIND_META.mission;
  const nominee = agentOf(ctx.state(), quest.nomineeId);
  let modal;
  const close = () => modal?.close();
  let body;
  if (quest.status !== "open") {
    body = h("div", {}, h("p", { class: "quest-intro" }, quest.intro), resultCard({ success: quest.status === "solved", stars: quest.stars, message: quest.outcome || "" }));
  } else if (quest.kind === "mystery") body = mysteryBody(ctx, quest, close);
  else if (quest.kind === "seek") body = seekBody(ctx, quest, close);
  else if (quest.kind === "mediation") body = mediationBody(ctx, quest);
  else if (quest.kind === "quiz") body = quizBody(ctx, quest);
  else body = missionBody(ctx, quest, close);
  modal = openModal({
    title: `${meta.icon} ${quest.title}`,
    body: h("div", {}, nominee ? h("div", { class: "row small muted", style: { marginBottom: "10px" } }, avatar(nominee), h("span", {}, `Quête de ${nominee.name} · récompense ${stars(quest.reward)}`)) : null, body),
  });
}

// ---------------------------------------------------------------------------
// 🏆 Employé du mois

const quests = {
  subtitle: (state) => {
    const round = state.life?.round;
    if (!round) return "Élection en préparation";
    const done = round.quests.filter((q) => q.status !== "open").length;
    return round.winnerId ? `Élu·e : ${agentOf(state, round.winnerId)?.name || "?"}` : `${monthLabel(round.key)} · ${done}/${round.quests.length} quêtes terminées`;
  },
  mount(body, ctx) {
    const head = h("div");
    const nominees = h("div");
    const list = h("div");
    const hall = h("div");
    const sQuests = section("🗺️ Les quêtes", list);
    body.append(head, section("🎖️ Les nominés", nominees), sQuests, section("🏛️ Mur des champions", hall));
    return {
      update(state) {
        const round = state.life?.round;
        if (!round) {
          clear(head, empty("Il faut au moins 8 employés pour organiser l'élection."));
          clear(nominees);
          clear(list);
          return;
        }
        const done = round.quests.filter((q) => q.status !== "open").length;
        const ready = canHoldCeremony(state, ctx.now());
        const winner = agentOf(state, round.winnerId);
        clear(head, winner
          ? h("div", { class: "card eotm-card" },
            h("div", { class: "row" }, avatar(winner, "lg"), h("div", { class: "grow" },
              h("div", { class: "small muted" }, `Employé du mois · ${monthLabel(round.key)}`),
              h("h3", { style: { margin: "2px 0" } }, `🏆 ${winner.name}`),
              h("div", {}, `${stars(round.stars[winner.id] || 0)} · ${roleOf(winner).label}`))),
            h("button", { class: "btn primary block", style: { marginTop: "12px" }, onClick: async () => { if (await act(ctx, "eotm.next", {})) toast("🏆 Nouvelle édition lancée !", "success"); } }, "🎬 Lancer l'édition suivante"))
          : h("div", { class: "card eotm-card" },
            h("strong", {}, `Édition ${monthLabel(round.key)}${round.edition > 1 ? ` · n°${round.edition}` : ""}`),
            h("p", { class: "small muted", style: { margin: "6px 0 10px" } }, "Résous les quêtes des nominés pour leur faire gagner des étoiles ⭐. Dès que 3 quêtes sont terminées, tu peux lancer la cérémonie : celui ou celle qui a le plus d'étoiles devient l'employé du mois."),
            h("div", { class: "progress" }, h("i", { style: { width: `${Math.round((done / round.quests.length) * 100)}%` } })),
            h("button", {
              class: `btn block ${ready ? "primary" : ""}`,
              style: { marginTop: "12px" },
              disabled: !ready,
              onClick: async () => {
                const result = await act(ctx, "eotm.ceremony", {});
                if (!result) return;
                toast(`🏆 ${result.name} est l'employé du mois !`, "success", 6000);
                ctx.close();
                ctx.world()?.overview();
              },
            }, ready ? "🎤 Lancer la cérémonie" : `🎤 Cérémonie (encore ${Math.max(0, 3 - done)} quête·s)`)));
        const leader = Math.max(...round.nominees.map((id) => round.stars[id] || 0));
        clear(nominees, h("div", { class: "nominees" }, round.nominees.map((id) => {
          const a = agentOf(state, id);
          if (!a) return null;
          const s = round.stars[id] || 0;
          return h("div", { class: `nominee${s && s === leader ? " lead" : ""}`, onClick: () => ctx.openAgent(id) },
            avatar(a, "lg"),
            h("strong", {}, a.name),
            h("span", { class: "small muted" }, roleOf(a).label),
            h("span", { class: "nominee-stars" }, stars(s)));
        })));
        sQuests.setCount(`${done}/${round.quests.length}`);
        const order = { open: 0, solved: 1, failed: 2 };
        clear(list, h("div", { class: "stack" }, [...round.quests].sort((a, b) => order[a.status] - order[b.status]).map((q) => {
          const meta = KIND_META[q.kind];
          const a = agentOf(state, q.nomineeId);
          const status = q.status === "open" ? (q.kind === "mission" ? `${q.progress || 0}/${q.target}` : "À résoudre") : q.status === "solved" ? `Réussie ${stars(q.stars)}` : "Ratée";
          return h("div", { class: `quest ${q.status}`, onClick: () => openQuest(ctx, q) },
            h("div", { class: "quest-icon" }, meta.icon),
            h("div", { class: "grow" },
              h("div", { class: "quest-title" }, q.title),
              h("div", { class: "small muted" }, `${meta.label} · ${a?.name || "?"} · ${stars(q.reward)}`)),
            h("span", { class: `pill ${q.status === "open" ? "working" : q.status === "solved" ? "done" : "cancelled"}` }, status));
        })));
        const entries = state.life?.hall || [];
        clear(hall, entries.length
          ? entries.slice(0, 12).map((e) => h("div", { class: "log-item" }, h("span", {}, "🏆"), h("div", { class: "grow" }, h("strong", {}, e.name), ` — ${monthLabel(e.key)} · ${stars(e.stars)}`)))
          : empty("Aucun champion pour l'instant. Le premier trophée t'attend !"));
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 🤝 RH & Vie d'équipe

const REL_ORDER = ["couple", "crush", "bff", "rival", "ex", "ami"];

function relationRow(state, rel) {
  const a = agentOf(state, rel.a);
  const b = agentOf(state, rel.b);
  if (!a || !b) return null;
  const kind = RELATION_KINDS[rel.kind];
  const from = rel.from ? agentOf(state, rel.from) : null;
  const to = from ? (from.id === a.id ? b : a) : null;
  const text = rel.kind === "crush" && from ? `Rumeur : ${from.name} craque pour ${to.name}` : `${a.name} & ${b.name}`;
  return h("div", { class: "rel-row", style: { "--rel": kind.color } },
    h("div", { class: "rel-avatars" }, avatar(a), avatar(b)),
    h("div", { class: "grow" },
      h("div", { class: "rel-title" }, `${kind.icon} ${text}`),
      rel.note ? h("div", { class: "small muted" }, rel.note) : null),
    h("span", { class: "pill", style: { color: kind.color } }, kind.label));
}

function storyRow(state, st, now) {
  return h("div", { class: "story" },
    h("div", { class: "story-icon" }, st.icon),
    h("div", { class: "grow" },
      h("div", { class: "story-text" }, st.text),
      h("div", { class: "story-meta" }, (st.ids || []).map((id) => agentOf(state, id)).filter(Boolean).map((a) => h("span", { class: "story-who", style: { "--who": a.look?.shirt || "#7c6cff" } }, a.name)), h("time", {}, timeAgo(st.at, now)))));
}

async function hireInternDialog(ctx, intern) {
  const roles = Object.entries(ROLES).filter(([id, r]) => r.hireable && !["intern", "manager"].includes(id));
  const select = h("select", { class: "select" }, Object.values(DEPARTMENTS).map((d) => {
    const opts = roles.filter(([, r]) => r.dept === d.id);
    return opts.length ? h("optgroup", { label: `${d.icon} ${d.label}` }, opts.map(([id, r]) => h("option", { value: id }, `${r.icon} ${r.label}`))) : null;
  }));
  const first = roles.find(([, r]) => r.dept === intern.dept);
  if (first) select.value = first[0];
  const modal = openModal({
    title: `🎓 Embaucher ${intern.name} en CDI`,
    body: h("div", {}, h("p", { class: "muted" }, `Fin du stage pour ${intern.name} ! Choisis son nouveau poste :`), h("label", { class: "field" }, h("span", {}, "Poste"), select)),
    footer: [
      h("button", { class: "btn ghost", onClick: () => modal.close() }, "Plus tard"),
      h("button", { class: "btn primary", onClick: async () => { if (await act(ctx, "intern.hire", { agentId: intern.id, role: select.value })) { toast(`🎓 ${intern.name} signe son CDI !`, "success"); modal.close(); } } }, "Signer le CDI"),
    ],
  });
}

const rh = {
  subtitle: (state) => {
    const rels = Object.values(state.life?.relations || {});
    return `${rels.filter((r) => r.kind === "couple").length} couple(s) · ${rels.filter((r) => r.kind === "rival").length} rivalité(s) · ${state.agents.filter((a) => a.role === "intern").length} stagiaire(s)`;
  },
  mount(body, ctx) {
    const team = h("div");
    const rels = h("div");
    const interns = h("div");
    const gossip = h("div");
    const sRels = section("💞 Relations au bureau", rels);
    body.append(
      section("👥 L'équipe RH", team),
      h("button", { class: "btn block section", onClick: () => ctx.openPanel("quests") }, "🏆 Élection de l'employé du mois ›"),
      sRels,
      section("🧃 Les stagiaires", interns),
      section("🗞️ Potins officiels", gossip),
      section("＋ Confier une mission aux RH", missionForm(ctx, { dept: "rh", showAgentSelect: true, presets: ["Fiche de poste monteur vidéo freelance", "Plan d'intégration d'un stagiaire", "Afterwork de fin de mois"], placeholder: "Ex : Recrute un community manager à mi-temps" })));
    return {
      update(state) {
        clear(team, state.agents.filter((a) => a.dept === "rh").map((a) => agentRow(ctx, a)));
        const all = Object.values(state.life?.relations || {}).filter((r) => agentOf(state, r.a) && agentOf(state, r.b));
        all.sort((x, y) => REL_ORDER.indexOf(x.kind) - REL_ORDER.indexOf(y.kind) || y.since - x.since);
        sRels.setCount(all.length || null);
        const notable = all.filter((r) => r.kind !== "ami");
        const pals = all.filter((r) => r.kind === "ami");
        clear(rels, notable.length || pals.length
          ? h("div", {}, h("div", { class: "stack" }, notable.map((r) => relationRow(state, r))),
            pals.length ? h("details", { class: "card", style: { marginTop: "8px" } }, h("summary", {}, `🤝 ${pals.length} duo(s) de potes`), h("div", { class: "stack", style: { marginTop: "8px" } }, pals.map((r) => relationRow(state, r)))) : null)
          : empty("Rien à signaler. Pour l'instant."));
        const list = state.agents.filter((a) => a.role === "intern");
        clear(interns, list.length ? h("div", { class: "stack" }, list.map((a) => {
          const tutor = agentOf(state, a.managerId);
          const days = Math.max(1, Math.round((ctx.now() - (a.hiredAt || ctx.now())) / 86400000));
          return agentRow(ctx, a, h("button", { class: "btn small success", title: `${DEPARTMENTS[a.dept]?.label || ""} · tuteur : ${tutor?.name || "—"} · ${days} jour(s) de stage`, onClick: (e) => { e.stopPropagation(); hireInternDialog(ctx, a); } }, "🎓 CDI"));
        }), h("p", { class: "small muted" }, "Les stagiaires sont rattachés au manager de leur pôle. Quand l'un d'eux est prêt, signe-lui un CDI !"))
          : empty("Aucun stagiaire en ce moment. Recrute-en depuis « Équipes »."));
        const stories = [...(state.life?.stories || [])].reverse().slice(0, 25);
        clear(gossip, stories.length ? h("div", { class: "stack" }, stories.map((st) => storyRow(state, st, ctx.now()))) : empty("Josiane n'a rien entendu. C'est suspect."));
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 🐈 Salle de repos & chats

function moodLabel(mood) {
  if (mood >= 85) return ["🤩", "Ambiance de folie"];
  if (mood >= 70) return ["😄", "Bonne ambiance"];
  if (mood >= 50) return ["🙂", "Ça va"];
  if (mood >= 30) return ["😐", "Un peu tendu"];
  return ["😫", "Ambiance au ras des pâquerettes"];
}

async function adoptDialog(ctx) {
  const name = h("input", { class: "input", placeholder: "Ex : Biscotte", maxlength: 20 });
  const coat = h("select", { class: "select" }, Object.entries(CAT_COATS).map(([id, c]) => h("option", { value: id }, c.label)));
  const modal = openModal({
    title: "🐈 Adopter un chat",
    body: h("div", {}, h("label", { class: "field" }, h("span", {}, "Nom"), name), h("label", { class: "field" }, h("span", {}, "Pelage"), coat)),
    footer: [h("button", {
      class: "btn primary block",
      onClick: async () => {
        if (!name.value.trim()) return name.focus();
        if (await act(ctx, "cat.adopt", { name: name.value, coat: coat.value })) {
          toast(`🐈 Bienvenue à ${name.value.trim()} !`, "success");
          modal.close();
        }
      },
    }, "Adopter")],
  });
  setTimeout(() => name.focus(), 50);
}

const lounge = {
  subtitle: (state) => `${(state.life?.cats || []).length} chat(s) · ambiance ${state.life?.mood ?? 70}/100`,
  mount(body, ctx) {
    const mood = h("div");
    const cats = h("div");
    const counters = h("div");
    const world = ctx.world();
    const trigger = (kind, ok) => {
      if (!world) return toast("La 3D n'est pas disponible sur cet appareil.", "error");
      haptic("medium");
      if (world.triggerLife(kind)) {
        toast(ok, "success");
        ctx.close();
      } else {
        toast("Tout le monde est occupé, réessaie dans un instant.", "info");
      }
    };
    const actions = h("div", { class: "quick-grid" }, [
      ["🐈", "Pause câlins", "catTime", "🐈 Tout le monde en salle de repos"],
      ["🧘", "Cours de yoga", "gymClass", "🧘 Namasté"],
      ["🥋", "Karaté de Bertrand", "karate", "🥋 Hi-yah !"],
      ["🎮", "Tournoi de console", "gaming", "🎮 Que le meilleur gagne"],
      ["☕", "Tournée du stagiaire", "internCoffee", "☕ Le stagiaire prend les commandes"],
      ["🌶️", "Le chili de Bruno", "chili", "🌶️ Oh non…"],
    ].map(([icon, label, kind, ok]) => h("button", { class: "quick", onClick: () => trigger(kind, ok) }, h("b", {}, icon), h("span", {}, label))));
    body.append(section("🌡️ Ambiance", mood), section("🐈 Les chats du bureau", cats), section("🎬 Activités", actions), section("📊 Compteurs officieux", counters));
    return {
      update(state) {
        const value = state.life?.mood ?? 70;
        const [emo, label] = moodLabel(value);
        clear(mood, h("div", { class: "card" },
          h("div", { class: "row" }, h("span", { style: { fontSize: "28px" } }, emo), h("div", { class: "grow" }, h("strong", {}, label), h("div", { class: "small muted" }, "Les quêtes réussies, les chats nourris et les fêtes font monter l'ambiance. Les incidents… moins.")), h("strong", {}, `${value}/100`)),
          h("div", { class: "progress mood" }, h("i", { style: { width: `${value}%` } }))));
        const list = state.life?.cats || [];
        clear(cats, h("div", { class: "stack" },
          list.map((c) => {
            const coat = CAT_COATS[c.coat] || CAT_COATS.grey;
            const fed = c.fedAt ? `nourri ${timeAgo(c.fedAt, ctx.now())}` : "a faim (dit-il)";
            return h("div", { class: "cat-row" },
              h("div", { class: "cat-face", style: { "--fur": coat.body, "--belly": coat.belly } }, "🐈"),
              h("div", { class: "grow" }, h("strong", {}, c.name), h("div", { class: "small muted" }, `${coat.label} · ${fed} · ${c.pets || 0} câlin(s)`)),
              h("button", { class: "btn small", title: "Nourrir", onClick: async () => { if (await act(ctx, "cat.feed", { catId: c.id })) toast(`🐟 ${c.name} se régale`, "success"); } }, "🐟"),
              h("button", { class: "btn small", title: "Câlin", onClick: async () => { if (await act(ctx, "cat.pet", { catId: c.id })) { toast(`💕 ${c.name} ronronne`, "success"); world?.cats?.cats.get(c.id)?.mesh.say("💕 rrrr", 2500); } } }, "💕"),
              h("button", { class: "btn small ghost", title: "Renommer", onClick: async () => { const name = await promptDialog({ title: `Renommer ${c.name}`, label: "Nouveau nom", multiline: false, submit: "Renommer" }); if (name) act(ctx, "cat.rename", { catId: c.id, name }); } }, "✏️"));
          }),
          list.length < 5 ? h("button", { class: "btn block", onClick: () => adoptDialog(ctx) }, "＋ Adopter un chat") : h("p", { class: "small muted" }, "Cinq chats : le maximum autorisé par Bertrand.")));
        const stories = state.life?.stories || [];
        const monthStart = (() => { const d = new Date(ctx.now()); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); })();
        const incident = Math.max(world?.lastIncidentAt || 0, ...stories.filter((st) => st.kind === "incident").map((st) => st.at), 0);
        const days = incident ? Math.floor((ctx.now() - incident) / 86400000) : "∞";
        const rels = Object.values(state.life?.relations || {});
        clear(counters, h("div", { class: "kpis" },
          h("div", { class: `kpi${days === 0 ? " hot" : ""}` }, h("b", {}, String(days)), h("span", {}, "jours sans incident")),
          h("div", { class: "kpi" }, h("b", {}, String(stories.filter((st) => st.at >= monthStart).length)), h("span", {}, "potins ce mois")),
          h("div", { class: "kpi" }, h("b", {}, String(rels.filter((r) => r.kind === "couple").length)), h("span", {}, "couples")),
          h("div", { class: "kpi" }, h("b", {}, String(ctx.life.entries.filter((e) => e.icon === "🛵").length)), h("span", {}, "Uber Eats (session)"))));
      },
    };
  },
};

export const SOCIAL_PANELS = { quests, rh, lounge };

// Relations affichées dans la fiche d'un employé.
export function relationChips(state, agentId) {
  const rels = relationsOf(state, agentId);
  if (!rels.length) return null;
  return h("div", { class: "chips", style: { marginTop: "8px" } }, rels.sort((a, b) => REL_ORDER.indexOf(a.kind) - REL_ORDER.indexOf(b.kind)).map((r) => {
    const other = agentOf(state, r.other);
    const kind = RELATION_KINDS[r.kind];
    const label = r.kind === "crush" ? (r.from === agentId ? `😳 craque pour ${other?.name}` : `😳 ${other?.name} craque en secret`) : `${kind.icon} ${kind.label} · ${other?.name}`;
    return h("span", { class: "chip", style: { borderColor: kind.color } }, label);
  }));
}
