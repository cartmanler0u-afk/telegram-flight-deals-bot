// Briques d'interface réutilisées par les panneaux des pièces.

import { h, clear, toast, haptic, openModal, confirmDialog, promptDialog, openLink, timeAgo, fmtSize } from "./dom.js";
import { markdown } from "./markdown.js";
import { DOC_KINDS, PRIORITIES, ROLES, TASK_TYPES, roleOf } from "../../shared/roster.js";
import { taskProgress } from "../../shared/engine.js";

export const STATUS = {
  queued: "En attente",
  working: "En cours",
  review: "À valider",
  done: "Terminée",
  cancelled: "Annulée",
};

export function agentOf(state, id) {
  return state.agents.find((a) => a.id === id) || null;
}

export function avatar(agent, size = "") {
  const initial = (agent?.name || "?").charAt(0).toUpperCase();
  return h("div", { class: `avatar ${size}`, style: { background: agent?.look?.shirt || "#5a6bd8" } }, initial);
}

export function section(title, ...children) {
  const count = h("span", { class: "count", hidden: true });
  const el = h("div", { class: "section" }, h("h4", { class: "section-title" }, h("span", {}, title), count), ...children);
  el.setCount = (n) => {
    count.hidden = n === null || n === undefined;
    count.textContent = n ?? "";
  };
  return el;
}

export function empty(text) {
  return h("div", { class: "empty" }, text);
}

export function priorityPill(priority) {
  if (!priority || priority === "normale") return null;
  return h("span", { class: `pill prio-${priority}` }, `${PRIORITIES[priority].icon} ${PRIORITIES[priority].label}`);
}

// Carte de mission avec progression en direct et actions contextuelles.
export function taskCard(ctx, task, { compact = false } = {}) {
  const state = ctx.state();
  const agent = agentOf(state, task.agentId);
  const progress = h("div", { class: "progress", hidden: task.status !== "working" }, h("i", { dataset: { progressTask: task.id }, style: { width: `${Math.round(taskProgress(task, ctx.now()) * 100)}%` } }));
  const actions = h("div", { class: "task-actions" });

  if (task.status === "review") {
    if (task.docId) actions.append(h("button", { class: "btn small", onClick: () => openDocument(ctx, task.docId) }, "👀 Voir"));
    actions.append(
      h("button", { class: "btn small success", onClick: () => ctx.run("task.review", { taskId: task.id, decision: "approve" }, "🏅 Dossier validé") }, "✅ Valider"),
      h("button", {
        class: "btn small",
        onClick: async () => {
          const comment = await promptDialog({ title: "Demander une révision", label: `Que doit corriger ${agent?.name || "l'agent"} ?`, placeholder: "Ex : plus court, ton plus chaleureux, ajouter une section prix…", submit: "Renvoyer" });
          if (comment) ctx.run("task.review", { taskId: task.id, decision: "revise", comment }, "↩️ Révision demandée");
        },
      }, "↩️ Révision")
    );
  } else if (task.status === "done" && task.docId) {
    actions.append(h("button", { class: "btn small", onClick: () => openDocument(ctx, task.docId) }, "📄 Livrable"));
  } else if (task.status === "queued" || task.status === "working") {
    if (!compact) {
      actions.append(h("button", {
        class: "btn small ghost",
        onClick: async () => {
          if (await confirmDialog(`Annuler la mission « ${task.title} » ?`)) ctx.run("task.cancel", { taskId: task.id }, "Mission annulée");
        },
      }, "Annuler"));
    }
  }

  return h(
    "div",
    { class: "card task" },
    h("div", { class: "task-icon" }, TASK_TYPES[task.type]?.icon || "💼"),
    h(
      "div",
      { class: "grow" },
      h("div", { class: "task-title" }, task.title),
      h(
        "div",
        { class: "task-meta" },
        h("span", { class: `pill ${task.status}` }, STATUS[task.status] || task.status),
        priorityPill(task.priority),
        agent ? h("span", {}, `→ ${agent.name}`) : null,
        task.revisions ? h("span", { class: "pill" }, `v${task.revisions + 1}`) : null,
        task.ai?.used ? h("span", { class: "pill ai" }, "IA") : null,
        h("span", {}, timeAgo(task.finishedAt || task.startedAt || task.createdAt, ctx.now()))
      ),
      task.status === "working" && !task.output && taskProgress(task, ctx.now()) >= 0.95 ? h("div", { class: "small muted", style: { marginTop: "4px" } }, "Finalisation…") : null,
      progress,
      actions.childElementCount ? actions : null
    )
  );
}

export function taskList(ctx, tasks, emptyText, opts) {
  if (!tasks.length) return empty(emptyText);
  return h("div", { class: "stack" }, tasks.map((t) => taskCard(ctx, t, opts)));
}

// Formulaire "confier une mission".
export function missionForm(ctx, { agentId = null, type = null, showAgentSelect = false, placeholder = "Décris la mission…", submitLabel = "Confier la mission", presets = [], onDone } = {}) {
  const title = h("input", { class: "input", placeholder, maxlength: 140 });
  const brief = h("textarea", { class: "textarea", placeholder: "Détails, contexte, contraintes (optionnel)", maxlength: 4000, rows: 3 });
  const priority = h("select", { class: "select" }, Object.entries(PRIORITIES).map(([id, p]) => h("option", { value: id, selected: id === "normale" }, `${p.icon} ${p.label}`)));
  const agentSelect = showAgentSelect
    ? h("select", { class: "select" }, h("option", { value: "" }, "🧭 Le directeur choisit"), ctx.state().agents.map((a) => h("option", { value: a.id }, `${ROLES[a.role]?.icon || ""} ${a.name} — ${roleOf(a).label}`)))
    : null;
  const submit = h("button", { class: "btn primary block", type: "submit" }, submitLabel);

  const form = h(
    "form",
    {
      onSubmit: async (e) => {
        e.preventDefault();
        if (!title.value.trim()) {
          title.focus();
          return;
        }
        submit.disabled = true;
        try {
          const result = await ctx.backend.action("task.create", {
            title: title.value,
            brief: brief.value,
            priority: priority.value,
            agentId: agentSelect?.value || agentId || undefined,
            type: type || undefined,
          });
          const task = ctx.state().tasks.find((t) => t.id === result?.id);
          const who = task ? agentOf(ctx.state(), task.agentId)?.name : null;
          toast(who ? `📥 Mission confiée à ${who}` : "📥 Mission confiée", "success");
          haptic("success");
          title.value = "";
          brief.value = "";
          priority.value = "normale";
          onDone?.(task);
        } catch (err) {
          toast(err.message, "error");
        } finally {
          submit.disabled = false;
        }
      },
    },
    presets.length
      ? h("div", { class: "chips", style: { marginBottom: "10px" } }, presets.map((p) => h("button", { type: "button", class: "chip", onClick: () => { title.value = p; title.focus(); } }, p)))
      : null,
    h("label", { class: "field" }, h("span", {}, "Mission"), title),
    h("label", { class: "field" }, h("span", {}, "Brief"), brief),
    h("div", { class: agentSelect ? "grid2" : "" },
      h("label", { class: "field" }, h("span", {}, "Priorité"), priority),
      agentSelect ? h("label", { class: "field" }, h("span", {}, "Agent"), agentSelect) : null),
    h("p", { class: "small muted", style: { margin: "0 0 10px" } }, "Les missions hautes ou critiques reviennent dans le bureau du directeur pour ta validation."),
    submit
  );
  return form;
}

// ------------------------------------------------------------------ documents

export function docRow(ctx, doc) {
  const author = agentOf(ctx.state(), doc.authorId);
  return h(
    "div",
    { class: "doc", onClick: () => openDocument(ctx, doc.id) },
    h("div", { class: "doc-icon" }, DOC_KINDS[doc.kind]?.icon || "📄"),
    h(
      "div",
      { class: "grow" },
      h("div", { class: "doc-title ellipsis" }, doc.pinned ? "📌 " : "", doc.title),
      h("div", { class: "doc-excerpt ellipsis" }, doc.excerpt || doc.url || DOC_KINDS[doc.kind]?.label || ""),
      h("div", { class: "task-meta" },
        h("span", {}, author ? author.name : "Toi"),
        h("span", {}, "·"),
        h("span", {}, timeAgo(doc.createdAt, ctx.now())),
        doc.tags.slice(0, 3).map((t) => h("span", { class: "pill" }, `#${t}`)))
    )
  );
}

export async function openDocument(ctx, docId) {
  let doc;
  try {
    doc = await ctx.backend.getDocument(docId);
  } catch (err) {
    toast(err.message, "error");
    return;
  }
  const isSite = doc.kind === "site";
  let body;
  if (isSite) {
    body = h("iframe", { sandbox: "allow-scripts allow-forms", title: doc.title, referrerpolicy: "no-referrer" });
    body.srcdoc = doc.content || "";
  } else {
    body = h("div", {},
      doc.url ? h("div", { class: "card", style: { marginBottom: "12px" } }, h("div", { class: "small muted" }, "Lien"), h("a", { href: doc.url, onClick: (e) => { e.preventDefault(); openLink(doc.url); } }, doc.url)) : null,
      h("div", { class: "md", html: markdown(doc.content || (doc.url ? "" : "_(document vide)_")) }));
    body.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (a && /^https?:/.test(a.getAttribute("href"))) {
        e.preventDefault();
        openLink(a.getAttribute("href"));
      }
    });
  }

  const sendLabel = ctx.backend.mode === "telegram" ? "📤 Recevoir dans Telegram" : "⬇️ Télécharger";
  const modal = openModal({
    title: `${DOC_KINDS[doc.kind]?.icon || "📄"} ${doc.title}`,
    body,
    full: isSite,
    footer: [
      h("button", {
        class: "btn primary",
        onClick: async (e) => {
          const button = e.currentTarget;
          button.disabled = true;
          try {
            const how = await ctx.backend.sendDocument(doc.id);
            toast(how === "telegram" ? "📤 Envoyé dans ta conversation avec le bot" : "⬇️ Téléchargement lancé", "success");
          } catch (err) {
            toast(err.message, "error");
          } finally {
            button.disabled = false;
          }
        },
      }, sendLabel),
      h("button", {
        class: "btn",
        onClick: () => ctx.run("doc.update", { docId: doc.id, pinned: !doc.pinned }, doc.pinned ? "Désépinglé" : "📌 Épinglé").then(() => modal.close()),
      }, doc.pinned ? "Désépingler" : "📌 Épingler"),
      h("button", {
        class: "btn danger",
        onClick: async () => {
          if (!(await confirmDialog(`Supprimer « ${doc.title} » de la bibliothèque ?`))) return;
          await ctx.run("doc.delete", { docId: doc.id }, "🗑️ Document supprimé");
          modal.close();
        },
      }, "🗑️"),
      h("span", { class: "small muted", style: { alignSelf: "center", marginLeft: "auto" } }, fmtSize(doc.size || (doc.content || "").length)),
    ],
  });
}

export function agentStatusLine(ctx, agent) {
  const state = ctx.state();
  const meeting = state.meetings.find((m) => m.status === "live" && m.attendees.includes(agent.id));
  const task = state.tasks.find((t) => t.agentId === agent.id && t.status === "working");
  const queued = state.tasks.filter((t) => t.agentId === agent.id && t.status === "queued").length;
  if (meeting) return `🗣️ En réunion : ${meeting.title}`;
  if (task) return `${TASK_TYPES[task.type]?.icon || "💼"} ${task.title}${queued ? ` (+${queued} en attente)` : ""}`;
  return queued ? `⏳ ${queued} mission(s) en attente` : "✨ Disponible";
}

export function agentRow(ctx, agent, extra = null) {
  return h(
    "div",
    { class: "agent-row", onClick: () => ctx.openAgent(agent.id) },
    avatar(agent),
    h("div", { class: "grow" },
      h("div", { style: { fontWeight: 800, fontSize: "14px" } }, agent.name, h("span", { class: "muted small", style: { fontWeight: 600 } }, ` · ${roleOf(agent).label}`)),
      h("div", { class: "small muted ellipsis" }, agentStatusLine(ctx, agent))),
    extra
  );
}

export function rerender(container, ...children) {
  return clear(container, ...children);
}
