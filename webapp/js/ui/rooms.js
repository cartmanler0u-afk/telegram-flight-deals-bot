// Contenu des panneaux : un tableau de bord par pièce + la fiche de chaque agent.

import { h, clear, toast, haptic, confirmDialog, promptDialog, timeAgo, fmtTime, toLocalInput, fromLocalInput, fmtSize } from "./dom.js";
import { markdown } from "./markdown.js";
import {
  agentOf, avatar, section, empty, taskCard, taskList, missionForm, docRow, openDocument, agentRow, agentStatusLine,
} from "./components.js";
import { DEPARTMENTS, DOC_KINDS, ROLES, roleOf } from "../../shared/roster.js";
import { computeKpis, liveMeeting } from "../../shared/engine.js";
import { dayKey, dayLabel } from "../../shared/dates.js";

const open = (status) => ["queued", "working", "review"].includes(status);

// ---------------------------------------------------------------------------
// 👔 Bureau du Directeur

const director = {
  room: "director",
  subtitle: (state) => {
    const k = computeKpis(state);
    return k.review ? `${k.review} dossier(s) attendent ta validation` : "Arbitrages, priorités et dossiers importants";
  },
  mount(body, ctx) {
    const kpis = h("div", { class: "kpis" });
    const review = h("div");
    const brief = h("div");
    const ongoing = h("div");
    const decisions = h("div");
    const sReview = section("📁 Dossiers à valider", review);
    const sOngoing = section("⚙️ Missions ouvertes", ongoing);
    body.append(
      section("📊 Indicateurs", kpis),
      sReview,
      section("🧭 Brief de direction", brief),
      section("＋ Nouvelle mission", missionForm(ctx, {
        showAgentSelect: true,
        placeholder: "Ex : Lance une landing page pour l'offre de Noël",
        presets: ["Crée un site vitrine pour mon activité", "Fais l'inventaire de la bibliothèque", "Planifie un point client jeudi 15h", "Analyse les priorités de la semaine"],
      })),
      sOngoing,
      section("📜 Registre des décisions", decisions)
    );
    return {
      update(state) {
        const k = computeKpis(state, ctx.now());
        clear(kpis,
          h("div", { class: "kpi" }, h("b", {}, k.working), h("span", {}, "En cours")),
          h("div", { class: `kpi${k.review ? " hot" : ""}` }, h("b", {}, k.review), h("span", {}, "À valider")),
          h("div", { class: "kpi" }, h("b", {}, k.doneToday), h("span", {}, "Livrées auj.")),
          h("div", { class: `kpi${k.critical ? " hot" : ""}` }, h("b", {}, k.critical), h("span", {}, "Critiques")));

        const toReview = state.tasks.filter((t) => t.status === "review");
        sReview.setCount(toReview.length);
        clear(review, taskList(ctx, toReview, "Rien à valider pour l'instant. 👌"));

        const d = state.director || {};
        const last = d.lastBriefDocId && state.documents.find((doc) => doc.id === d.lastBriefDocId);
        clear(brief, h("div", { class: "card" },
          h("p", { class: "small muted", style: { marginTop: 0 } }, "Victor résume la situation : chiffres clés, priorités, dossiers à valider, agenda et sa recommandation du jour."),
          h("div", { class: "row wrap" },
            h("button", {
              class: "btn primary",
              disabled: d.briefStatus === "writing",
              onClick: () => ctx.run("director.brief", {}, "🧭 Le directeur rédige le brief"),
            }, d.briefStatus === "writing" ? h("span", {}, h("span", { class: "spinner" }), " Rédaction…") : "Demander le brief"),
            last ? h("button", { class: "btn", onClick: () => openDocument(ctx, last.id) }, `Dernier brief (${timeAgo(last.createdAt, ctx.now())})`) : null)));

        const ongoingTasks = state.tasks.filter((t) => t.status === "queued" || t.status === "working");
        sOngoing.setCount(ongoingTasks.length);
        clear(ongoing, taskList(ctx, ongoingTasks, "Aucune mission ouverte : confie un nouveau projet à l'équipe !"));

        const list = [...state.decisions].reverse().slice(0, 12);
        clear(decisions, list.length
          ? h("div", { class: "card" }, list.map((dec) => h("div", { class: "log-item" }, h("span", {}, "📌"), h("div", {}, dec.text, h("time", {}, timeAgo(dec.at, ctx.now()))))))
          : empty("Les décisions validées apparaîtront ici."));
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 🌐 Studio Web

const SITE_TYPES = ["Site vitrine", "Landing page", "Portfolio", "Restaurant", "Boutique en ligne", "Blog", "Événement", "Application web (maquette)"];

const studio = {
  room: "studio",
  subtitle: (state) => {
    const devs = state.agents.filter((a) => a.role === "webdev").map((a) => a.name).join(", ");
    return `${devs} construi${devs.includes(",") ? "sent" : "t"} tes sites web`;
  },
  mount(body, ctx) {
    const team = h("div");
    const queue = h("div");
    const gallery = h("div");
    const sQueue = section("🛠️ Chantiers", queue);
    const sGallery = section("🖼️ Galerie des sites", gallery);

    const name = h("input", { class: "input", placeholder: "Ex : Chez Mamie, Studio Zen, Mon Portfolio", maxlength: 60 });
    const type = h("select", { class: "select" }, SITE_TYPES.map((t) => h("option", {}, t)));
    const style = h("input", { class: "input", placeholder: "Ex : moderne, sombre, touches dorées", maxlength: 120 });
    const desc = h("textarea", { class: "textarea", placeholder: "Activité, cible, sections souhaitées, infos de contact…", maxlength: 3000 });
    const prio = h("select", { class: "select" }, h("option", { value: "normale" }, "🔹 Normale"), h("option", { value: "haute" }, "🔶 Haute (validation)"), h("option", { value: "basse" }, "▫️ Basse"));
    const submit = h("button", { class: "btn primary block", type: "submit" }, "🚀 Lancer la construction");
    const form = h("form", {
      onSubmit: async (e) => {
        e.preventDefault();
        if (!name.value.trim()) return name.focus();
        submit.disabled = true;
        const state = ctx.state();
        const devs = state.agents.filter((a) => a.role === "webdev");
        const load = (id) => state.tasks.filter((t) => t.agentId === id && (t.status === "queued" || t.status === "working")).length;
        devs.sort((a, b) => load(a.id) - load(b.id));
        try {
          await ctx.backend.action("task.create", {
            title: `${type.value} — ${name.value.trim()}`,
            brief: [`Type de site : ${type.value}`, `Nom du projet : ${name.value.trim()}`, style.value ? `Style / couleurs : ${style.value}` : null, desc.value ? `\n${desc.value}` : null].filter(Boolean).join("\n"),
            type: "site",
            agentId: devs[0]?.id,
            priority: prio.value,
          });
          toast(`🚀 ${devs[0]?.name || "Le studio"} lance la construction`, "success");
          haptic("success");
          name.value = style.value = desc.value = "";
        } catch (err) {
          toast(err.message, "error");
        } finally {
          submit.disabled = false;
        }
      },
    },
    h("label", { class: "field" }, h("span", {}, "Nom du projet"), name),
    h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, "Type"), type), h("label", { class: "field" }, h("span", {}, "Priorité"), prio)),
    h("label", { class: "field" }, h("span", {}, "Style"), style),
    h("label", { class: "field" }, h("span", {}, "Description"), desc),
    submit);

    body.append(section("👩‍💻 L'équipe du studio", team), section("＋ Commander un site", h("div", { class: "card" }, form)), sQueue, sGallery);
    return {
      update(state) {
        clear(team, state.agents.filter((a) => a.role === "webdev").map((a) => agentRow(ctx, a)));
        const tasks = state.tasks.filter((t) => t.type === "site" && open(t.status));
        sQueue.setCount(tasks.length);
        clear(queue, taskList(ctx, tasks, "Aucun chantier en cours."));
        const sites = state.documents.filter((d) => d.kind === "site").reverse();
        sGallery.setCount(sites.length);
        clear(gallery, sites.length
          ? h("div", { class: "site-grid" }, sites.map((d, i) => h("div", { class: "site-card", onClick: () => openDocument(ctx, d.id) },
            h("div", { class: "site-thumb", style: { background: `linear-gradient(135deg, hsl(${(i * 67 + 250) % 360} 70% 55%), hsl(${(i * 67 + 300) % 360} 70% 45%))` } }, "🌐"),
            h("div", { class: "t ellipsis" }, d.title.replace(/^Site — /, "")),
            h("div", { class: "small muted", style: { padding: "0 10px 8px" } }, timeAgo(d.createdAt, ctx.now())))))
          : empty("Les sites livrés apparaîtront ici, prêts à prévisualiser et à télécharger."));
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 📚 Bibliothèque

const LIB_FILTERS = [["all", "Tout"], ["site", "🌐 Sites"], ["report", "📊 Rapports"], ["minutes", "📝 CR"], ["note", "🗒️ Notes"], ["memo", "📌 Décisions"], ["brief", "🧭 Briefs"], ["content", "✍️ Contenus"], ["file", "📄 Fichiers"], ["link", "🔗 Liens"]];

const library = {
  room: "library",
  subtitle: (state) => `${state.documents.length} document(s) stockés et classés`,
  mount(body, ctx) {
    let filter = "all";
    const stats = h("div", { class: "small muted", style: { marginBottom: "10px" } });
    const search = h("input", { class: "input", type: "search", placeholder: "🔎 Rechercher un document, une étiquette…" });
    const chips = h("div", { class: "chips", style: { margin: "10px 0" } });
    const list = h("div");
    const renderList = () => {
      const state = ctx.state();
      const q = search.value.trim().toLowerCase();
      const docs = state.documents
        .filter((d) => filter === "all" || d.kind === filter)
        .filter((d) => !q || `${d.title} ${d.tags.join(" ")} ${d.excerpt || ""}`.toLowerCase().includes(q))
        .sort((a, b) => (b.pinned - a.pinned) || b.createdAt - a.createdAt);
      clear(list, docs.length ? docs.slice(0, 80).map((d) => docRow(ctx, d)) : empty(q ? "Aucun document ne correspond." : "Rien ici pour l'instant."));
    };
    search.addEventListener("input", renderList);
    const renderChips = () => clear(chips, LIB_FILTERS.map(([id, label]) => h("button", { class: `chip${filter === id ? " on" : ""}`, onClick: () => { filter = id; renderChips(); renderList(); } }, label)));
    renderChips();

    // Ajout manuel
    const title = h("input", { class: "input", placeholder: "Titre", maxlength: 140 });
    const kind = h("select", { class: "select" }, h("option", { value: "note" }, "🗒️ Note"), h("option", { value: "file" }, "📄 Fichier texte"), h("option", { value: "link" }, "🔗 Lien"));
    const url = h("input", { class: "input", type: "url", placeholder: "https://…", hidden: true });
    const content = h("textarea", { class: "textarea", placeholder: "Contenu (Markdown accepté)" });
    const tags = h("input", { class: "input", placeholder: "Étiquettes séparées par des virgules" });
    const file = h("input", { type: "file", accept: ".txt,.md,.csv,.json,.html,.htm,.xml,.log", hidden: true });
    kind.addEventListener("change", () => {
      url.hidden = kind.value !== "link";
    });
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      if (f.size > 900000) return toast("Fichier trop lourd (900 Ko max).", "error");
      content.value = await f.text();
      if (!title.value) title.value = f.name;
      kind.value = "file";
      url.hidden = true;
      if (/\.html?$/i.test(f.name)) tags.value = tags.value || "html";
    });
    const addForm = h("form", {
      onSubmit: async (e) => {
        e.preventDefault();
        if (!title.value.trim()) return title.focus();
        const html = /\.html?$/i.test(title.value) || /^\s*<!doctype html/i.test(content.value);
        await ctx.run("doc.add", { title: title.value, kind: html ? "site" : kind.value, content: content.value, url: kind.value === "link" ? url.value : undefined, tags: tags.value }, "📚 Document rangé");
        title.value = content.value = tags.value = url.value = "";
        file.value = "";
      },
    },
    h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, "Titre"), title), h("label", { class: "field" }, h("span", {}, "Type"), kind)),
    url,
    h("label", { class: "field" }, h("span", {}, "Contenu"), content),
    h("label", { class: "field" }, h("span", {}, "Étiquettes"), tags),
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", onClick: () => file.click() }, "📎 Importer un fichier"),
      h("button", { class: "btn primary grow", type: "submit" }, "Ranger")),
    file);

    const librarianId = () => ctx.state().agents.find((a) => a.role === "librarian")?.id;
    body.append(
      stats,
      search,
      chips,
      list,
      h("div", { style: { height: "14px" } }),
      section("＋ Déposer un document", h("div", { class: "card" }, addForm)),
      section("🙋 Demander à la bibliothécaire", missionForm(ctx, {
        agentId: librarianId(),
        type: "storage",
        placeholder: "Ex : Retrouve tout ce qui concerne le projet Noël",
        presets: ["Fais l'inventaire de la bibliothèque", "Propose un plan de classement", "Repère les doublons et documents à archiver"],
      }))
    );
    return {
      update(state) {
        const size = state.documents.reduce((s, d) => s + (d.size || 0), 0);
        const counts = {};
        for (const d of state.documents) counts[d.kind] = (counts[d.kind] || 0) + 1;
        clear(stats, `${state.documents.length} documents · ${fmtSize(size)} · `, Object.entries(counts).map(([k, n]) => `${DOC_KINDS[k]?.icon || "📄"} ${n} `));
        renderList();
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 📅 Secrétariat & planning

const REMINDERS = [["", "Pas de rappel"], ["5", "5 min avant"], ["15", "15 min avant"], ["30", "30 min avant"], ["60", "1 h avant"], ["1440", "La veille"]];

const reception = {
  room: "reception",
  subtitle: (state) => {
    const k = computeKpis(state);
    return k.nextEvent ? `Prochain : ${k.nextEvent.title} · ${new Date(k.nextEvent.start).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "Agenda, rendez-vous et rappels";
  },
  mount(body, ctx) {
    const quick = h("input", { class: "input", placeholder: "Ex : Réunion client jeudi 15h30 pendant 1h", maxlength: 300 });
    const analyse = h("button", { class: "btn", type: "button" }, "✨ Analyser");
    const fTitle = h("input", { class: "input", placeholder: "Titre du rendez-vous", maxlength: 140 });
    const fStart = h("input", { class: "input", type: "datetime-local" });
    const fDuration = h("select", { class: "select" }, [15, 30, 45, 60, 90, 120, 180].map((m) => h("option", { value: m, selected: m === 60 }, m < 60 ? `${m} min` : `${m / 60} h`.replace(".5", " h 30").replace(" h h", " h"))));
    const fRemind = h("select", { class: "select" }, REMINDERS.map(([v, l]) => h("option", { value: v, selected: v === "15" }, l)));
    let isMeeting = false;
    let attendees = new Set();
    const meetingChip = h("button", { type: "button", class: "chip" }, "🗣️ Réunion interne");
    meetingChip.addEventListener("click", () => {
      isMeeting = !isMeeting;
      meetingChip.classList.toggle("on", isMeeting);
    });
    const people = h("div", { class: "chips" });
    const renderPeople = () => clear(people, ctx.state().agents.map((a) => {
      const chip = h("button", { type: "button", class: `chip${attendees.has(a.id) ? " on" : ""}` }, h("span", { class: "dot", style: { background: a.look?.shirt } }), a.name);
      chip.addEventListener("click", () => {
        attendees.has(a.id) ? attendees.delete(a.id) : attendees.add(a.id);
        chip.classList.toggle("on");
      });
      return chip;
    }));
    const resetForm = () => {
      fTitle.value = "";
      quick.value = "";
      const next = new Date(ctx.now() + 3600000);
      next.setMinutes(0, 0, 0);
      fStart.value = toLocalInput(next.getTime());
      isMeeting = false;
      meetingChip.classList.remove("on");
      attendees = new Set();
      renderPeople();
    };
    analyse.addEventListener("click", async () => {
      if (!quick.value.trim()) return quick.focus();
      analyse.disabled = true;
      try {
        const [proposal] = await ctx.backend.query("parseEvents", { text: quick.value });
        if (!proposal) return toast("Je n'ai pas compris la date, précise-la ci-dessous.", "error");
        fTitle.value = proposal.title;
        fStart.value = toLocalInput(proposal.start);
        const d = [15, 30, 45, 60, 90, 120, 180].reduce((best, m) => (Math.abs(m - proposal.durationMin) < Math.abs(best - proposal.durationMin) ? m : best), 60);
        fDuration.value = String(d);
        isMeeting = !!proposal.isMeeting;
        meetingChip.classList.toggle("on", isMeeting);
        attendees = new Set((proposal.attendees || []).map((n) => ctx.state().agents.find((a) => a.id === n || a.name.toLowerCase() === String(n).toLowerCase())?.id).filter(Boolean));
        renderPeople();
        toast(proposal.confident === false ? "📅 Date approximative : vérifie avant d'ajouter" : "📅 Vérifie et ajoute au planning", "info");
      } catch (err) {
        toast(err.message, "error");
      } finally {
        analyse.disabled = false;
      }
    });
    quick.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        analyse.click();
      }
    });
    const form = h("form", {
      onSubmit: async (e) => {
        e.preventDefault();
        if (!fTitle.value.trim()) return fTitle.focus();
        const start = fromLocalInput(fStart.value);
        if (!start) return fStart.focus();
        await ctx.run("event.add", {
          title: fTitle.value,
          start,
          durationMin: Number(fDuration.value),
          isMeeting,
          attendees: [...attendees],
          remindMinutes: fRemind.value === "" ? null : Number(fRemind.value),
        }, "📅 Ajouté au planning");
        resetForm();
      },
    },
    h("div", { class: "row", style: { marginBottom: "12px" } }, h("div", { class: "grow" }, quick), analyse),
    h("label", { class: "field" }, h("span", {}, "Titre"), fTitle),
    h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, "Début"), fStart), h("label", { class: "field" }, h("span", {}, "Durée"), fDuration)),
    h("label", { class: "field" }, h("span", {}, "Rappel Telegram"), fRemind),
    h("div", { class: "field" }, h("span", {}, "Participants"), h("div", { class: "chips", style: { marginBottom: "6px" } }, meetingChip), people),
    h("p", { class: "small muted", style: { margin: "0 0 10px" } }, "Une réunion interne démarre toute seule à l'heure prévue : les participants rejoignent la salle de réunion."),
    h("button", { class: "btn primary block", type: "submit" }, "Ajouter au planning"));
    resetForm();

    const agenda = h("div");
    const sAgenda = section("🗓️ Agenda (14 jours)", agenda);
    const secretaryId = () => ctx.state().agents.find((a) => a.role === "secretary")?.id;
    body.append(
      section("＋ Nouveau rendez-vous", h("div", { class: "card" }, form)),
      sAgenda,
      section("🙋 Confier une mission à la secrétaire", missionForm(ctx, {
        agentId: secretaryId(),
        type: "planning",
        placeholder: "Ex : Cale 3 créneaux de prospection la semaine prochaine",
        presets: ["Organise ma semaine prochaine", "Planifie un point d'équipe vendredi 11h", "Bloque 2 h de focus demain matin"],
      }))
    );
    return {
      update(state) {
        const now = ctx.now();
        const tz = -new Date().getTimezoneOffset();
        const events = state.events.filter((e) => e.start + e.durationMin * 60000 >= now - 3600000 && e.start < now + 14 * 86400000);
        sAgenda.setCount(events.length);
        if (!events.length) {
          clear(agenda, empty("Agenda libre sur les 14 prochains jours."));
          return;
        }
        const groups = new Map();
        for (const e of events) {
          const key = dayKey(e.start, tz);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(e);
        }
        clear(agenda, [...groups.values()].map((list) => [
          h("div", { class: `day-label${dayKey(list[0].start, tz) === dayKey(now, tz) ? " today" : ""}` }, dayLabel(list[0].start, now, tz)),
          list.map((e) => h("div", { class: "event" },
            h("div", { class: "event-time" }, fmtTime(e.start), h("div", { class: "small muted" }, `${e.durationMin} min`)),
            h("div", { class: "grow" },
              h("div", { style: { fontWeight: 700 } }, e.title),
              h("div", { class: "task-meta" },
                e.isMeeting ? h("span", { class: "pill" }, e.meetingId ? "🗣️ Tenue" : "🗣️ Réunion") : null,
                e.remindMinutes !== null ? h("span", { class: "pill" }, e.remindedAt > 0 ? "⏰ Rappel envoyé" : `⏰ ${e.remindMinutes} min`) : null,
                e.attendees.map((id) => agentOf(state, id)?.name).filter(Boolean).join(", "))),
            h("button", {
              class: "icon-btn",
              "aria-label": "Supprimer",
              onClick: async () => {
                if (await confirmDialog(`Retirer « ${e.title} » du planning ?`)) ctx.run("event.delete", { eventId: e.id }, "Rendez-vous retiré");
              },
            }, "🗑️"))),
        ]));
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 🗒️ Salle de réunion

const meeting = {
  room: "meeting",
  subtitle: (state) => {
    const live = liveMeeting(state);
    return live ? `🔴 En cours : ${live.title}` : "Réunions, prise de notes et comptes rendus";
  },
  mount(body, ctx) {
    // Réunion en cours
    const liveBox = h("div", { class: "section", hidden: true });
    const liveHead = h("div");
    const feed = h("div", { class: "notes-feed" });
    const note = h("textarea", { class: "textarea", rows: 2, placeholder: "Note… (Entrée pour envoyer)", style: { minHeight: "54px" } });
    let liveId = null;
    const sendNote = async () => {
      const text = note.value.trim();
      if (!text || !liveId) return;
      note.value = "";
      await ctx.run("meeting.note", { meetingId: liveId, text });
      feed.scrollTop = feed.scrollHeight;
    };
    note.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendNote();
      }
    });
    const prefixes = h("div", { class: "chips", style: { margin: "8px 0" } }, ["✅ Décision : ", "📌 Action : ", "💡 Idée : ", "⚠️ Risque : "].map((p) => h("button", { class: "chip", type: "button", onClick: () => { note.value = p + note.value; note.focus(); } }, p.trim())));
    liveBox.append(
      h("div", { class: "card" },
        liveHead,
        feed,
        prefixes,
        h("div", { class: "row" }, h("div", { class: "grow" }, note), h("button", { class: "btn primary", onClick: sendNote }, "➤")),
        h("button", {
          class: "btn danger block",
          style: { marginTop: "10px" },
          onClick: async () => {
            if (await confirmDialog("Clore la réunion ? Le greffier rédigera le compte rendu.")) ctx.run("meeting.end", { meetingId: liveId }, "🔔 Réunion close");
          },
        }, "🔔 Clore la réunion")));

    const writing = h("div", { hidden: true });

    // Démarrer une réunion
    const startBox = h("div");
    const mTitle = h("input", { class: "input", placeholder: "Ex : Lancement projet Noël", maxlength: 140 });
    let selected = new Set();
    const people = h("div", { class: "chips" });
    const renderPeople = () => clear(people, ctx.state().agents.filter((a) => a.role !== "scribe").map((a) => {
      const chip = h("button", { type: "button", class: `chip${selected.has(a.id) ? " on" : ""}` }, h("span", { class: "dot", style: { background: a.look?.shirt } }), a.name);
      chip.addEventListener("click", () => {
        selected.has(a.id) ? selected.delete(a.id) : selected.add(a.id);
        chip.classList.toggle("on");
      });
      return chip;
    }));
    renderPeople();
    startBox.append(section("▶️ Démarrer une réunion", h("div", { class: "card" },
      h("label", { class: "field" }, h("span", {}, "Sujet"), mTitle),
      h("div", { class: "field" }, h("span", {}, "Participants (le greffier est toujours là)"), people),
      h("button", {
        class: "btn primary block",
        onClick: async () => {
          await ctx.run("meeting.start", { title: mTitle.value || "Réunion", attendees: [...selected] }, "🗣️ Réunion ouverte");
          mTitle.value = "";
          selected = new Set();
          renderPeople();
        },
      }, "Ouvrir la réunion"))));

    const history = h("div");
    const sHistory = section("📝 Comptes rendus", history);
    const scribeId = () => ctx.state().agents.find((a) => a.role === "scribe")?.id;
    body.append(liveBox, writing, startBox, sHistory, section("🙋 Demander au greffier", missionForm(ctx, {
      agentId: scribeId(),
      type: "notes",
      placeholder: "Ex : Rédige une synthèse de l'appel avec le client",
      presets: ["Prépare l'ordre du jour de la prochaine réunion", "Mets au propre mes notes en vrac"],
    })));

    let lastNotes = 0;
    return {
      update(state) {
        const live = liveMeeting(state);
        liveBox.hidden = !live;
        startBox.hidden = !!live;
        if (live) {
          if (liveId !== live.id) {
            liveId = live.id;
            lastNotes = -1;
          }
          const names = live.attendees.map((id) => agentOf(state, id)).filter(Boolean);
          clear(liveHead,
            h("div", { class: "row", style: { marginBottom: "8px" } },
              h("span", { class: "pill review" }, "● EN DIRECT"),
              h("strong", { class: "grow ellipsis" }, live.title),
              h("span", { class: "small muted", dataset: { since: live.startedAt } }, "")),
            h("div", { class: "chips", style: { marginBottom: "10px" } }, h("span", { class: "chip" }, "👑 Toi"), names.map((a) => h("span", { class: "chip" }, h("span", { class: "dot", style: { background: a.look?.shirt } }), a.name))));
          if (live.notes.length !== lastNotes) {
            lastNotes = live.notes.length;
            clear(feed, live.notes.length
              ? live.notes.map((n) => h("div", { class: "note" }, h("time", {}, fmtTime(n.at)), n.text))
              : h("div", { class: "small muted" }, "Écris les points discutés, décisions et actions : le greffier s'occupe du reste."));
            feed.scrollTop = feed.scrollHeight;
          }
        } else {
          liveId = null;
        }

        const summarizing = state.meetings.find((m) => m.status === "summarizing");
        writing.hidden = !summarizing;
        if (summarizing) clear(writing, h("div", { class: "card section" }, h("span", { class: "spinner" }), ` ${agentOf(state, summarizing.attendees[0])?.name || "Le greffier"} rédige le compte rendu de « ${summarizing.title} »…`));

        const past = state.meetings.filter((m) => m.status === "ended").reverse();
        sHistory.setCount(past.length);
        clear(history, past.length ? past.slice(0, 15).map((m) => meetingCard(ctx, m)) : empty("Les comptes rendus des réunions apparaîtront ici."));
      },
    };
  },
};

function meetingCard(ctx, m) {
  const state = ctx.state();
  const details = h("div", { hidden: true, style: { marginTop: "10px" } },
    m.summary ? h("div", { class: "md", html: markdown(m.summary) }) : h("p", { class: "muted small" }, "Réunion sans notes."),
    m.decisions?.length ? h("div", {}, h("strong", {}, "Décisions"), h("ul", {}, m.decisions.map((d) => h("li", {}, d)))) : null,
    m.actions?.length ? h("div", { class: "stack" }, h("strong", {}, "Actions"), m.actions.map((a, i) => h("div", { class: "row card" },
      h("div", { class: "grow small" }, a.text, a.agentId ? h("span", { class: "muted" }, ` → ${agentOf(state, a.agentId)?.name || "?"}`) : null),
      a.taskId
        ? h("span", { class: "pill done" }, "Mission créée")
        : h("button", { class: "btn small", onClick: () => ctx.run("meeting.actionToTask", { meetingId: m.id, index: i }, "📥 Action transformée en mission") }, "→ Mission")))) : null,
    m.docId ? h("button", { class: "btn small", style: { marginTop: "10px" }, onClick: () => openDocument(ctx, m.docId) }, "📝 Compte rendu complet") : null);
  const card = h("div", { class: "card" },
    h("div", { class: "row", style: { cursor: "pointer" }, onClick: () => { details.hidden = !details.hidden; } },
      h("div", { class: "task-icon" }, "📝"),
      h("div", { class: "grow" }, h("div", { class: "task-title" }, m.title), h("div", { class: "small muted" }, `${timeAgo(m.startedAt, ctx.now())} · ${m.notes.length} note(s) · ${m.actions?.length || 0} action(s)`)),
      h("span", { class: "muted" }, "▾")),
    details);
  return card;
}

// ---------------------------------------------------------------------------
// 🏢 Open space : organigramme, managers, recrutement

const openspace = {
  room: "openspace",
  subtitle: (state) => `${state.agents.length} agents · ${state.agents.filter((a) => a.role === "manager").length} managers`,
  mount(body, ctx) {
    const org = h("div");
    const name = h("input", { class: "input", placeholder: "Prénom (optionnel)", maxlength: 24 });
    const role = h("select", { class: "select" }, Object.entries(ROLES).filter(([, r]) => r.hireable).map(([id, r]) => h("option", { value: id }, `${r.icon} ${r.label}`)));
    const dept = h("select", { class: "select", hidden: true }, Object.values(DEPARTMENTS).map((d) => h("option", { value: d.id }, `${d.icon} ${d.label}`)));
    const skills = h("p", { class: "small muted", style: { margin: "0 0 10px" } });
    const syncRole = () => {
      dept.hidden = role.value !== "manager";
      skills.textContent = ROLES[role.value].skills;
    };
    role.addEventListener("change", syncRole);
    syncRole();
    const hire = h("form", {
      onSubmit: async (e) => {
        e.preventDefault();
        await ctx.run("agent.hire", { name: name.value, role: role.value, dept: dept.value }, "🤝 Nouvelle recrue en route vers son bureau !");
        name.value = "";
      },
    },
    h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, "Prénom"), name), h("label", { class: "field" }, h("span", {}, "Poste"), role)),
    h("label", { class: "field" }, dept),
    skills,
    h("button", { class: "btn primary block", type: "submit" }, "Recruter"));

    body.append(section("🧭 Organigramme", org), section("🤝 Recruter un agent", h("div", { class: "card" }, hire)));
    return {
      update(state) {
        const dir = state.agents.find((a) => a.role === "director");
        const managers = state.agents.filter((a) => a.role === "manager");
        const direct = state.agents.filter((a) => a.managerId === dir?.id && a.role !== "manager");
        const reportBtn = (m) => h("button", {
          class: "btn small",
          onClick: (e) => {
            e.stopPropagation();
            ctx.run("task.create", { title: `Rapport d'équipe — ${DEPARTMENTS[m.dept]?.label || m.name}`, agentId: m.id, type: "report" }, `📋 ${m.name} prépare son rapport`);
          },
        }, "📋 Rapport");
        clear(org,
          dir ? agentRow(ctx, dir) : null,
          h("div", { class: "org-level" },
            managers.map((m) => h("div", { style: { marginBottom: "10px" } },
              agentRow(ctx, m, reportBtn(m)),
              h("div", { class: "small muted", style: { margin: "4px 0 0 4px" } }, `${DEPARTMENTS[m.dept]?.icon || ""} ${DEPARTMENTS[m.dept]?.label || ""}`),
              h("div", { class: "org-level" }, state.agents.filter((a) => a.managerId === m.id).map((a) => agentRow(ctx, a))))),
            direct.map((a) => agentRow(ctx, a))));
      },
    };
  },
};

// ---------------------------------------------------------------------------
// ☕ Cafétéria : journal d'activité

const lounge = {
  room: "lounge",
  subtitle: () => "Le journal du QG — tout ce qui se passe, en direct",
  mount(body, ctx) {
    const info = h("div");
    const feed = h("div", { class: "card" });
    body.append(info, section("📰 Activité", feed));
    return {
      update(state) {
        clear(info, ctx.backend.mode === "demo"
          ? h("div", { class: "card section" },
            h("strong", {}, "🎮 Mode démo"),
            h("p", { class: "small muted" }, "Le QG tourne dans ce navigateur avec des livrables générés par modèles. Ouvre-le depuis ton bot Telegram (/office) pour retrouver tes vraies données, les rappels Telegram et — si une clé API est configurée — des agents qui travaillent avec l'IA Claude."),
            h("button", { class: "btn small danger", onClick: async () => { if (await confirmDialog("Remettre la démo à zéro ?")) ctx.backend.reset(); } }, "Réinitialiser la démo"))
          : h("div", { class: "card section" },
            h("strong", {}, ctx.backend.ai?.enabled ? `🤖 Agents propulsés par l'IA (${ctx.backend.ai.model})` : "🧩 Agents en mode modèles"),
            h("p", { class: "small muted", style: { marginBottom: 0 } }, ctx.backend.ai?.enabled
              ? "Chaque mission est réellement traitée par l'IA selon le rôle de l'agent."
              : "Ajoute ANTHROPIC_API_KEY dans la configuration du bot pour que les agents travaillent avec l'IA.")));
        const items = [...state.log].reverse().slice(0, 60);
        clear(feed, items.length ? items.map((l) => h("div", { class: "log-item" }, h("span", {}, l.icon), h("div", { class: "grow" }, l.text, h("time", {}, timeAgo(l.at, ctx.now()))))) : empty("Rien pour l'instant."));
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Fiche d'un agent

export function agentPanel(agentId) {
  return {
    agentId,
    title: (state) => agentOf(state, agentId)?.name || "Agent",
    icon: (state) => ROLES[agentOf(state, agentId)?.role]?.icon || "🙂",
    color: (state) => agentOf(state, agentId)?.look?.shirt,
    subtitle: (state) => {
      const a = agentOf(state, agentId);
      return a ? `${roleOf(a).label}${a.dept ? ` · ${DEPARTMENTS[a.dept]?.label}` : ""}` : "";
    },
    mount(body, ctx) {
      const hero = h("div", { class: "section" });
      const current = h("div");
      const queue = h("div");
      const sQueue = section("⏳ File d'attente", queue);
      const deliverables = h("div");
      const footer = h("div");
      const agent = agentOf(ctx.state(), agentId);
      body.append(
        hero,
        section("⚙️ En ce moment", current),
        sQueue,
        section(`＋ Confier une mission à ${agent?.name || ""}`, missionForm(ctx, { agentId, placeholder: `Que doit faire ${agent?.name || "cet agent"} ?` })),
        section("📦 Derniers livrables", deliverables),
        footer
      );
      return {
        update(state) {
          const a = agentOf(state, agentId);
          if (!a) {
            clear(body, empty("Cet agent ne fait plus partie du QG."));
            return;
          }
          const manager = agentOf(state, a.managerId);
          clear(hero, h("div", { class: "card hero" },
            avatar(a, "lg"),
            h("div", { class: "grow" },
              h("h3", {}, a.name),
              h("p", {}, `${roleOf(a).label}${manager ? ` · rattaché·e à ${manager.name}` : ""}`),
              h("p", {}, `✅ ${a.stats?.done || 0} mission(s) livrée(s)`)),
            h("button", {
              class: "icon-btn",
              "aria-label": "Renommer",
              onClick: async () => {
                const name = await promptDialog({ title: "Renommer l'agent", label: "Nouveau prénom", multiline: false, submit: "Renommer" });
                if (name) ctx.run("agent.rename", { agentId, name }, "🏷️ Renommé");
              },
            }, "✏️")),
          h("p", { class: "small muted", style: { margin: "8px 2px 0" } }, roleOf(a).skills));
          const working = state.tasks.find((t) => t.agentId === agentId && t.status === "working");
          clear(current, working ? taskCard(ctx, working) : h("div", { class: "card small" }, agentStatusLine(ctx, a)));
          const queued = state.tasks.filter((t) => t.agentId === agentId && (t.status === "queued" || t.status === "review"));
          sQueue.setCount(queued.length);
          clear(queue, taskList(ctx, queued, "Aucune mission en attente."));
          const docs = state.documents.filter((d) => d.authorId === agentId).slice(-6).reverse();
          clear(deliverables, docs.length ? docs.map((d) => docRow(ctx, d)) : empty("Pas encore de livrable."));
          clear(footer, a.role === "director" ? null : h("button", {
            class: "btn danger block",
            onClick: async () => {
              if (await confirmDialog(`Se séparer de ${a.name} ? Ses missions seront redistribuées.`)) {
                await ctx.run("agent.fire", { agentId }, `👋 ${a.name} quitte le QG`);
                ctx.close();
              }
            },
          }, `Se séparer de ${a.name}`));
        },
      };
    },
  };
}

export const ROOM_PANELS = { director, studio, library, reception, meeting, openspace, lounge };
