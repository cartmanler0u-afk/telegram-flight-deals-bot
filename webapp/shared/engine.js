// Moteur du QG : toutes les règles métier (missions, validation, planning, réunions,
// bibliothèque, recrutements). Fonctions pures qui modifient l'état JSON passé en paramètre.
// Partagé tel quel entre le serveur Node et le mode démo du navigateur.

import { ROLES, DEFAULT_AGENTS, TASK_TYPES, PRIORITIES, DEPARTMENTS, DOC_KINDS, HIRE_LOOKS, roleOf } from "./roster.js";

export const STATE_VERSION = 1;

export const LIMITS = {
  agents: 24,
  queuedPerAgent: 8,
  activeTasks: 40,
  finishedTasks: 200,
  documents: 500,
  docContent: 400000,
  events: 300,
  meetings: 60,
  meetingNotes: 300,
  log: 120,
};

export class OfficeError extends Error {}

const FIRST_NAMES = [
  "Alice", "Basile", "Chloé", "Damien", "Elsa", "Félix", "Gaïa", "Inès", "Jules", "Katia",
  "Lina", "Malo", "Nina", "Oscar", "Paul", "Rose", "Sacha", "Théo", "Yanis", "Zoé",
];

const clampStr = (v, max) => String(v ?? "").trim().slice(0, max);

export function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function uid(state, prefix) {
  state.seq = (state.seq || 0) + 1;
  return `${prefix}_${state.seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function pick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

// ---------------------------------------------------------------------------
// Création / migration de l'état

const WELCOME_MD = `# Bienvenue dans ton QG 🏢

Ton équipe d'agents IA est en place. Voici qui fait quoi :

- **👔 Bureau du Directeur** — Victor reçoit tes missions, les confie au bon agent et te présente les **dossiers importants** à valider. Il rédige aussi le brief de direction.
- **📋 Managers** — Manon (Pôle Production) et Hugo (Pôle Organisation) encadrent les équipes et font des rapports.
- **🌐 Studio Web** — Léo construit des sites complets que tu peux prévisualiser et recevoir dans Telegram.
- **📚 Bibliothèque** — Iris stocke, classe et retrouve tous les documents produits par le QG.
- **📅 Secrétariat** — Clara gère ton planning et t'envoie des rappels.
- **🗒️ Salle de réunion** — Noé prend les notes et rédige les comptes rendus avec les actions à mener.

Astuce : touche une pièce ou un agent pour ouvrir son tableau de bord. Les missions **hautes** ou **critiques** passent toujours par ta validation.`;

export function createInitialState(now = Date.now(), { bossName = "Boss", tzOffset = 0 } = {}) {
  const state = {
    version: STATE_VERSION,
    createdAt: now,
    seq: 0,
    boss: { name: clampStr(bossName, 32) || "Boss" },
    settings: { tzOffset: Number(tzOffset) || 0 },
    agents: [],
    tasks: [],
    documents: [],
    events: [],
    meetings: [],
    decisions: [],
    log: [],
    director: { briefStatus: "idle", lastBriefAt: null, lastBriefDocId: null },
  };

  for (const def of DEFAULT_AGENTS) {
    state.agents.push({
      ...JSON.parse(JSON.stringify(def)),
      dept: def.dept ?? ROLES[def.role].dept,
      builtin: true,
      hiredAt: now,
      stats: { done: 0 },
      managerId: null,
    });
  }
  for (const agent of state.agents) agent.managerId = defaultManagerId(state, agent);

  addDocument(state, { title: "Bienvenue au QG", kind: "note", content: WELCOME_MD, tags: ["guide"], authorId: "director", pinned: true }, now);

  // Premier rendez-vous : un point d'équipe le lendemain à 10h (heure locale)
  const local = new Date(now + state.settings.tzOffset * 60000);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 10, 0) - state.settings.tzOffset * 60000;
  addEvent(state, {
    title: "Point d'équipe hebdo",
    start,
    durationMin: 30,
    isMeeting: true,
    attendees: ["director", "mgr-prod", "mgr-orga"],
    remindMinutes: 15,
  }, now);

  log(state, now, "director", "Le QG ouvre ses portes : toute l'équipe est à son poste !", "🎉");
  return state;
}

// Complète un état ancien/incomplet (robustesse face aux évolutions du format).
export function migrateState(state, now = Date.now()) {
  if (!state || typeof state !== "object" || !Array.isArray(state.agents)) {
    return createInitialState(now);
  }
  state.version = STATE_VERSION;
  state.settings ||= { tzOffset: 0 };
  state.boss ||= { name: "Boss" };
  for (const key of ["tasks", "documents", "events", "meetings", "decisions", "log"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  state.director ||= { briefStatus: "idle", lastBriefAt: null, lastBriefDocId: null };
  for (const agent of state.agents) {
    agent.stats ||= { done: 0 };
    if (agent.managerId === undefined) agent.managerId = defaultManagerId(state, agent);
  }
  return state;
}

// ---------------------------------------------------------------------------
// Lecture

export function findAgent(state, id) {
  return state.agents.find((a) => a.id === id) || null;
}

// Retrouve un agent par id ou par prénom (insensible aux accents/majuscules).
export function resolveAgent(state, ref) {
  if (!ref) return null;
  const byId = findAgent(state, ref);
  if (byId) return byId;
  const n = norm(ref).trim();
  return state.agents.find((a) => norm(a.name) === n) || state.agents.find((a) => n.includes(norm(a.name))) || null;
}

export function findTask(state, id) {
  return state.tasks.find((t) => t.id === id) || null;
}

export function liveMeeting(state) {
  return state.meetings.find((m) => m.status === "live") || null;
}

export function agentLoad(state, agentId) {
  return state.tasks.filter((t) => t.agentId === agentId && (t.status === "queued" || t.status === "working")).length;
}

export function currentTask(state, agentId) {
  return state.tasks.find((t) => t.agentId === agentId && t.status === "working") || null;
}

export function reportsOf(state, managerId) {
  return state.agents.filter((a) => a.managerId === managerId);
}

export function taskProgress(task, now) {
  if (task.status === "done" || task.status === "review") return 1;
  if (task.status !== "working" || !task.startedAt) return 0;
  const ratio = (now - task.startedAt) / (task.durationMs || 20000);
  // Sans résultat, on plafonne à 95 % : l'agent "finalise".
  return Math.max(0, Math.min(task.output ? 1 : 0.95, ratio));
}

export function computeKpis(state, now = Date.now()) {
  const tz = state.settings?.tzOffset || 0;
  const dayStart = (() => {
    const d = new Date(now + tz * 60000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - tz * 60000;
  })();
  const count = (fn) => state.tasks.filter(fn).length;
  const upcoming = state.events.filter((e) => e.start >= now).sort((a, b) => a.start - b.start);
  return {
    queued: count((t) => t.status === "queued"),
    working: count((t) => t.status === "working"),
    review: count((t) => t.status === "review"),
    doneToday: count((t) => t.status === "done" && t.finishedAt >= dayStart),
    doneTotal: count((t) => t.status === "done"),
    critical: count((t) => t.priority === "critique" && ["queued", "working", "review"].includes(t.status)),
    agents: state.agents.length,
    documents: state.documents.length,
    eventsToday: state.events.filter((e) => e.start >= dayStart && e.start < dayStart + 86400000).length,
    nextEvent: upcoming[0] || null,
  };
}

function defaultManagerId(state, agent) {
  if (agent.role === "director") return null;
  if (agent.role === "manager") return state.agents.find((a) => a.role === "director")?.id || null;
  return managerFor(state, agent.dept, agent.id);
}

// Manager du pôle avec le moins de subordonnés.
export function managerFor(state, dept, excludeId = null) {
  const managers = state.agents.filter((a) => a.role === "manager" && a.dept === dept && a.id !== excludeId);
  if (managers.length === 0) return state.agents.find((a) => a.role === "director")?.id || null;
  managers.sort((a, b) => reportsOf(state, a.id).length - reportsOf(state, b.id).length);
  return managers[0].id;
}

// ---------------------------------------------------------------------------
// Routage : le directeur choisit le bon agent selon le contenu de la mission

const ROUTES = [
  { role: "webdev", re: /\b(site|web|landing|page|html|vitrine|portfolio|boutique|e-?commerce|blog|maquette|front|interface)/, why: "c'est un travail de construction web" },
  { role: "secretary", re: /(planning|agenda|\brdv\b|rendez-vous|calendrier|planifi|programm|rappel|creneau|horaire|reserv)/, why: "ça concerne le planning" },
  { role: "scribe", re: /(compte[- ]rendu|prise de notes?|\bnotes?\b|resum|synthese|proces-verbal|\bpv\b|transcri|minutes)/, why: "il faut prendre des notes / synthétiser" },
  { role: "librarian", re: /(rang|class|archiv|stock|inventaire|biblio|document|fichier|retrouv|cherch|\btri|sauvegard|dossier partage)/, why: "ça touche au stockage et aux archives" },
  { role: "writer", re: /(redig|article|\bpost\b|newsletter|texte|slogan|copywriting|linkedin|instagram|e-?mail|script)/, why: "c'est de la rédaction" },
  { role: "director", re: /(decision|strateg|budget|priorit|arbitr|recrut|investi|important|urgent|risque|business plan|objectif)/, why: "c'est un dossier stratégique" },
  { role: "manager", re: /(rapport d'?equipe|charge de travail|\bequipe\b|organisation du pole)/, why: "c'est un sujet d'équipe" },
];

const ROLE_FALLBACK = { writer: "scribe", analyst: "director", manager: "director" };

function leastLoaded(state, role) {
  const candidates = state.agents.filter((a) => a.role === role);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => agentLoad(state, a.id) - agentLoad(state, b.id));
  return candidates[0];
}

export function routeTask(state, text) {
  const n = norm(text);
  for (const route of ROUTES) {
    if (!route.re.test(n)) continue;
    let role = route.role;
    let agent = leastLoaded(state, role);
    while (!agent && ROLE_FALLBACK[role]) {
      role = ROLE_FALLBACK[role];
      agent = leastLoaded(state, role);
    }
    if (agent) return { agentId: agent.id, reason: route.why };
  }
  const generalist = leastLoaded(state, "analyst") || leastLoaded(state, "director");
  return { agentId: generalist?.id || state.agents[0]?.id, reason: "c'est une mission transverse" };
}

// ---------------------------------------------------------------------------
// Journal

export function log(state, now, agentId, text, icon = "•") {
  state.log.push({ id: uid(state, "lg"), at: now, agentId, text: clampStr(text, 300), icon });
  if (state.log.length > LIMITS.log) state.log.splice(0, state.log.length - LIMITS.log);
}

const agentName = (state, id) => findAgent(state, id)?.name || "Quelqu'un";

// ---------------------------------------------------------------------------
// Missions

export function createTask(state, payload, now) {
  const title = clampStr(payload.title, 140);
  if (!title) throw new OfficeError("Donne un titre à la mission.");
  const brief = clampStr(payload.brief, 4000);
  const priority = PRIORITIES[payload.priority] ? payload.priority : "normale";

  let agent = payload.agentId ? findAgent(state, payload.agentId) : null;
  let reason = null;
  if (payload.agentId && !agent) throw new OfficeError("Cet agent n'existe plus.");
  if (!agent) {
    const route = routeTask(state, `${title} ${brief}`);
    agent = findAgent(state, route.agentId);
    reason = route.reason;
  }
  if (!agent) throw new OfficeError("Aucun agent disponible.");

  const active = state.tasks.filter((t) => t.status === "queued" || t.status === "working");
  if (active.length >= LIMITS.activeTasks) throw new OfficeError("Le QG est débordé : attends que des missions se terminent.");
  if (active.filter((t) => t.agentId === agent.id).length >= LIMITS.queuedPerAgent) {
    throw new OfficeError(`${agent.name} a déjà trop de missions sur son bureau.`);
  }

  const type = TASK_TYPES[payload.type] ? payload.type : roleOf(agent).taskType;
  const task = {
    id: uid(state, "tk"),
    title,
    brief,
    type,
    priority,
    agentId: agent.id,
    managerId: agent.managerId || null,
    status: "queued",
    createdAt: now,
    startedAt: null,
    durationMs: null,
    finishedAt: null,
    output: null,
    docId: null,
    needsApproval: type === "decision" || PRIORITIES[priority].rank >= 2 || payload.needsApproval === true,
    revisions: 0,
    feedback: [],
    source: clampStr(payload.source || "boss", 40),
    ai: null,
  };
  state.tasks.push(task);

  if (reason) {
    log(state, now, "director", `${agentName(state, "director")} confie « ${title} » à ${agent.name} : ${reason}.`, "🧭");
  } else {
    log(state, now, agent.id, `${agent.name} reçoit la mission « ${title} ».`, "📥");
  }
  return task;
}

function byPriority(a, b) {
  return PRIORITIES[b.priority].rank - PRIORITIES[a.priority].rank || a.createdAt - b.createdAt;
}

const OUTPUT_KINDS = new Set(Object.keys(DOC_KINDS));

export function attachTaskOutput(state, taskId, output, meta = {}) {
  const task = findTask(state, taskId);
  if (!task || task.status !== "working" || task.output) return false;
  const kind = OUTPUT_KINDS.has(output?.kind) ? output.kind : "report";
  task.output = {
    kind,
    title: clampStr(output?.title || task.title, 140),
    content: String(output?.content || "").slice(0, LIMITS.docContent),
    summary: clampStr(output?.summary, 300),
    events: Array.isArray(output?.events) ? output.events.slice(0, 10) : [],
  };
  task.ai = { used: !!meta.ai, error: meta.error ? clampStr(meta.error, 200) : null, model: meta.model || null };
  return true;
}

function finishTask(state, task, now, notes) {
  const agent = findAgent(state, task.agentId);
  const out = task.output;
  const doc = addDocument(state, {
    title: out.title,
    kind: out.kind,
    content: out.content,
    tags: [TASK_TYPES[task.type]?.label || task.type, agent ? roleOf(agent).label : null].filter(Boolean),
    authorId: task.agentId,
    taskId: task.id,
  }, now);
  task.docId = doc.id;
  task.finishedAt = now;

  for (const ev of out.events || []) {
    try {
      addEvent(state, { ...ev, source: task.id }, now);
    } catch {
      // un évènement invalide proposé par l'agent est ignoré
    }
  }

  if (task.needsApproval) {
    task.status = "review";
    log(state, now, task.agentId, `${agent?.name} a terminé « ${task.title} » : le dossier attend ta validation dans le bureau du directeur.`, "📁");
    notes.push({ kind: "needs_approval", taskId: task.id, text: `📁 Dossier à valider : « ${task.title} » (${agent?.name})` });
  } else {
    task.status = "done";
    if (agent) agent.stats.done += 1;
    const manager = findAgent(state, task.managerId);
    log(state, now, task.agentId, `${agent?.name} a livré « ${task.title} »${manager ? `, validé par ${manager.name}` : ""}. Rangé en bibliothèque.`, "✅");
    notes.push({ kind: "task_done", taskId: task.id, text: `✅ ${agent?.name} a terminé « ${task.title} »` });
  }
}

export function reviewTask(state, { taskId, decision, comment }, now) {
  const task = findTask(state, taskId);
  if (!task || task.status !== "review") throw new OfficeError("Ce dossier n'est plus en attente de validation.");
  const agent = findAgent(state, task.agentId);
  if (decision === "approve") {
    task.status = "done";
    task.approvedAt = now;
    if (agent) agent.stats.done += 1;
    addDecision(state, `Validé : ${task.title}${comment ? ` — ${clampStr(comment, 300)}` : ""}`, now, task.id);
    log(state, now, "director", `Dossier « ${task.title} » validé par ${state.boss.name}.`, "🏅");
    return task;
  }
  const feedback = clampStr(comment, 1000);
  if (!feedback) throw new OfficeError("Explique ce qu'il faut corriger.");
  task.feedback.push({ at: now, text: feedback });
  task.revisions += 1;
  task.status = "queued";
  task.output = null;
  task.startedAt = null;
  task.finishedAt = null;
  task.ai = null;
  log(state, now, task.agentId, `${state.boss.name} demande une révision de « ${task.title} » à ${agent?.name}.`, "↩️");
  return task;
}

export function cancelTask(state, { taskId }, now) {
  const task = findTask(state, taskId);
  if (!task || !["queued", "working"].includes(task.status)) throw new OfficeError("Cette mission ne peut plus être annulée.");
  task.status = "cancelled";
  task.finishedAt = now;
  log(state, now, task.agentId, `Mission « ${task.title} » annulée.`, "🗑️");
  return task;
}

export function addDecision(state, text, now, taskId = null) {
  state.decisions.push({ id: uid(state, "dn"), at: now, text: clampStr(text, 500), taskId });
  if (state.decisions.length > 100) state.decisions.splice(0, state.decisions.length - 100);
}

// ---------------------------------------------------------------------------
// Bibliothèque

export function addDocument(state, payload, now) {
  const title = clampStr(payload.title, 140);
  if (!title) throw new OfficeError("Le document doit avoir un titre.");
  const kind = OUTPUT_KINDS.has(payload.kind) ? payload.kind : "file";
  const content = String(payload.content ?? "").slice(0, LIMITS.docContent);
  const url = clampStr(payload.url, 800);
  if (url && !/^https?:\/\//i.test(url)) throw new OfficeError("Le lien doit commencer par http:// ou https://");
  const tags = (Array.isArray(payload.tags) ? payload.tags : String(payload.tags || "").split(","))
    .map((t) => clampStr(t, 30))
    .filter(Boolean)
    .slice(0, 8);
  const doc = {
    id: uid(state, "dc"),
    title,
    kind: url && kind === "file" ? "link" : kind,
    content,
    url: url || null,
    tags,
    authorId: payload.authorId || "boss",
    taskId: payload.taskId || null,
    pinned: !!payload.pinned,
    createdAt: now,
    size: content.length,
  };
  state.documents.push(doc);
  // Au-delà de la capacité, on retire les plus anciens documents non épinglés.
  while (state.documents.length > LIMITS.documents) {
    const idx = state.documents.findIndex((d) => !d.pinned);
    if (idx === -1) break;
    state.documents.splice(idx, 1);
  }
  return doc;
}

export function updateDocument(state, { docId, title, tags, pinned }) {
  const doc = state.documents.find((d) => d.id === docId);
  if (!doc) throw new OfficeError("Document introuvable.");
  if (title !== undefined) doc.title = clampStr(title, 140) || doc.title;
  if (tags !== undefined) {
    doc.tags = (Array.isArray(tags) ? tags : String(tags).split(",")).map((t) => clampStr(t, 30)).filter(Boolean).slice(0, 8);
  }
  if (pinned !== undefined) doc.pinned = !!pinned;
  return doc;
}

export function deleteDocument(state, { docId }, now) {
  const idx = state.documents.findIndex((d) => d.id === docId);
  if (idx === -1) throw new OfficeError("Document introuvable.");
  const [doc] = state.documents.splice(idx, 1);
  log(state, now, "librarian", `Document « ${doc.title} » retiré de la bibliothèque.`, "🗑️");
  return doc;
}

// ---------------------------------------------------------------------------
// Planning

export function addEvent(state, payload, now) {
  const title = clampStr(payload.title, 140);
  if (!title) throw new OfficeError("Donne un titre au rendez-vous.");
  const start = Number(payload.start);
  if (!Number.isFinite(start) || start <= 0) throw new OfficeError("Date de rendez-vous invalide.");
  const durationMin = Math.max(5, Math.min(12 * 60, Math.round(Number(payload.durationMin) || 60)));
  const attendees = (Array.isArray(payload.attendees) ? payload.attendees : [])
    .map((ref) => resolveAgent(state, ref)?.id)
    .filter((id, i, arr) => id && arr.indexOf(id) === i);
  const remind = payload.remindMinutes === null || payload.remindMinutes === "" ? null : Number(payload.remindMinutes ?? 15);
  const event = {
    id: uid(state, "ev"),
    title,
    start,
    durationMin,
    attendees,
    isMeeting: !!payload.isMeeting,
    notes: clampStr(payload.notes, 1000),
    remindMinutes: Number.isFinite(remind) ? Math.max(0, Math.min(1440, remind)) : null,
    remindedAt: null,
    meetingId: null,
    source: payload.source || "boss",
    createdAt: now,
  };
  state.events.push(event);
  state.events.sort((a, b) => a.start - b.start);
  // On ne garde ni le passé lointain ni un agenda infini.
  const cutoff = now - 30 * 86400000;
  state.events = state.events.filter((e) => e.start + e.durationMin * 60000 >= cutoff).slice(-LIMITS.events);
  log(state, now, "secretary", `${agentName(state, "secretary")} ajoute « ${title} » au planning.`, "📅");
  return event;
}

export function deleteEvent(state, { eventId }, now) {
  const idx = state.events.findIndex((e) => e.id === eventId);
  if (idx === -1) throw new OfficeError("Rendez-vous introuvable.");
  const [ev] = state.events.splice(idx, 1);
  log(state, now, "secretary", `Rendez-vous « ${ev.title} » retiré du planning.`, "🗑️");
  return ev;
}

// ---------------------------------------------------------------------------
// Réunions

export function startMeeting(state, { title, attendees, eventId = null }, now) {
  if (liveMeeting(state)) throw new OfficeError("Une réunion est déjà en cours.");
  const ids = (Array.isArray(attendees) ? attendees : [])
    .map((ref) => resolveAgent(state, ref)?.id)
    .filter(Boolean);
  const scribe = state.agents.find((a) => a.role === "scribe");
  if (scribe) ids.unshift(scribe.id);
  const meeting = {
    id: uid(state, "mt"),
    title: clampStr(title, 140) || "Réunion",
    attendees: ids.filter((id, i) => ids.indexOf(id) === i).slice(0, 9),
    status: "live",
    startedAt: now,
    endedAt: null,
    notes: [],
    summary: null,
    decisions: [],
    actions: [],
    docId: null,
    eventId,
  };
  state.meetings.push(meeting);
  if (state.meetings.length > LIMITS.meetings) state.meetings.splice(0, state.meetings.length - LIMITS.meetings);
  log(state, now, scribe?.id || "director", `Réunion « ${meeting.title} » ouverte en salle de réunion.`, "🗣️");
  return meeting;
}

export function addMeetingNote(state, { meetingId, text }, now) {
  const meeting = state.meetings.find((m) => m.id === meetingId);
  if (!meeting || meeting.status !== "live") throw new OfficeError("Cette réunion n'est plus en cours.");
  const clean = clampStr(text, 1000);
  if (!clean) throw new OfficeError("Note vide.");
  if (meeting.notes.length >= LIMITS.meetingNotes) throw new OfficeError("Trop de notes pour une seule réunion.");
  meeting.notes.push({ id: uid(state, "nt"), at: now, text: clean });
  return meeting;
}

export function endMeeting(state, { meetingId }, now) {
  const meeting = state.meetings.find((m) => m.id === meetingId);
  if (!meeting || meeting.status !== "live") throw new OfficeError("Cette réunion n'est plus en cours.");
  meeting.endedAt = now;
  meeting.status = meeting.notes.length ? "summarizing" : "ended";
  log(state, now, meeting.attendees[0] || "director",
    meeting.notes.length ? `Réunion « ${meeting.title} » terminée : rédaction du compte rendu…` : `Réunion « ${meeting.title} » terminée (aucune note).`,
    "🔔");
  return meeting;
}

export function attachMeetingSummary(state, meetingId, result, now, meta = {}) {
  const meeting = state.meetings.find((m) => m.id === meetingId);
  if (!meeting || meeting.status !== "summarizing") return null;
  meeting.summary = String(result?.summary || "").slice(0, 20000);
  meeting.decisions = (result?.decisions || []).map((d) => clampStr(d, 300)).filter(Boolean).slice(0, 20);
  meeting.actions = (result?.actions || [])
    .map((a) => ({ text: clampStr(a?.text, 300), agentId: resolveAgent(state, a?.assignee)?.id || null, taskId: null }))
    .filter((a) => a.text)
    .slice(0, 20);
  meeting.status = "ended";
  meeting.ai = { used: !!meta.ai, error: meta.error || null };

  const tz = state.settings.tzOffset || 0;
  const when = new Date(meeting.startedAt + tz * 60000).toISOString().slice(0, 16).replace("T", " à ");
  const names = meeting.attendees.map((id) => agentName(state, id)).join(", ");
  const md = [
    `# Compte rendu — ${meeting.title}`,
    `*${when} · Participants : ${state.boss.name}${names ? `, ${names}` : ""}*`,
    "## Synthèse",
    meeting.summary || "_(vide)_",
    meeting.decisions.length ? `## Décisions\n${meeting.decisions.map((d) => `- ${d}`).join("\n")}` : null,
    meeting.actions.length
      ? `## Actions\n${meeting.actions.map((a) => `- [ ] ${a.text}${a.agentId ? ` → **${agentName(state, a.agentId)}**` : ""}`).join("\n")}`
      : null,
    `## Notes brutes\n${meeting.notes.map((n) => `- ${n.text}`).join("\n")}`,
  ].filter(Boolean).join("\n\n");

  const doc = addDocument(state, { title: `CR — ${meeting.title}`, kind: "minutes", content: md, tags: ["réunion"], authorId: meeting.attendees[0] || "scribe" }, now);
  meeting.docId = doc.id;
  for (const d of meeting.decisions) addDecision(state, `${d} (réunion « ${meeting.title} »)`, now);
  log(state, now, meeting.attendees[0] || "director", `Compte rendu de « ${meeting.title} » rangé en bibliothèque (${meeting.actions.length} action(s)).`, "📝");
  return meeting;
}

export function meetingActionToTask(state, { meetingId, index }, now) {
  const meeting = state.meetings.find((m) => m.id === meetingId);
  const action = meeting?.actions?.[index];
  if (!action) throw new OfficeError("Action introuvable.");
  if (action.taskId) throw new OfficeError("Cette action est déjà une mission.");
  const task = createTask(state, {
    title: action.text,
    brief: `Action issue de la réunion « ${meeting.title} ».\n\nSynthèse de la réunion :\n${meeting.summary || ""}`.slice(0, 4000),
    agentId: action.agentId || undefined,
    source: "réunion",
  }, now);
  action.taskId = task.id;
  return task;
}

// ---------------------------------------------------------------------------
// Équipe

export function hireAgent(state, { name, role, dept }, now) {
  const def = ROLES[role];
  if (!def || !def.hireable) throw new OfficeError("Rôle inconnu.");
  if (state.agents.length >= LIMITS.agents) throw new OfficeError("L'open space est plein !");
  const seed = (state.seq || 0) * 7919 + now;
  const agent = {
    id: uid(state, "ag"),
    name: clampStr(name, 24) || pick(FIRST_NAMES, seed),
    role,
    dept: role === "manager" ? (DEPARTMENTS[dept] ? dept : "production") : def.dept,
    look: {
      skin: pick(HIRE_LOOKS.skin, seed),
      hair: pick(HIRE_LOOKS.hair, seed >> 3),
      hairStyle: pick(HIRE_LOOKS.hairStyle, seed >> 5),
      shirt: pick(HIRE_LOOKS.shirt, seed >> 7),
      pants: pick(HIRE_LOOKS.pants, seed >> 9),
    },
    builtin: false,
    hiredAt: now,
    stats: { done: 0 },
    managerId: null,
  };
  state.agents.push(agent);
  agent.managerId = defaultManagerId(state, agent);
  const manager = findAgent(state, agent.managerId);
  log(state, now, agent.id, `Bienvenue à ${agent.name}, ${def.label.toLowerCase()}${manager ? `, rattaché·e à ${manager.name}` : ""} !`, "🤝");
  return agent;
}

export function fireAgent(state, { agentId }, now) {
  const agent = findAgent(state, agentId);
  if (!agent) throw new OfficeError("Agent introuvable.");
  if (agent.role === "director") throw new OfficeError("Le directeur ne peut pas être remercié.");
  if (state.agents.filter((a) => a.role === agent.role).length === 1 && agent.role !== "writer" && agent.role !== "analyst") {
    throw new OfficeError(`${agent.name} est le seul ${roleOf(agent).label.toLowerCase()} du QG : recrute quelqu'un d'autre avant.`);
  }
  if (liveMeeting(state)?.attendees.includes(agent.id)) throw new OfficeError(`${agent.name} est en réunion.`);

  state.agents = state.agents.filter((a) => a.id !== agent.id);
  // Ses subordonnés et ses missions sont redistribués.
  for (const other of state.agents) {
    if (other.managerId === agent.id) other.managerId = defaultManagerId(state, other);
  }
  for (const task of state.tasks) {
    if (task.agentId !== agent.id || !["queued", "working"].includes(task.status)) continue;
    const heir = leastLoaded(state, agent.role) || findAgent(state, agent.managerId) || findAgent(state, "director");
    task.agentId = heir.id;
    task.managerId = heir.managerId;
    task.status = "queued";
    task.output = null;
    task.startedAt = null;
  }
  for (const ev of state.events) ev.attendees = ev.attendees.filter((id) => id !== agent.id);
  log(state, now, "director", `${agent.name} quitte le QG. Ses dossiers ont été redistribués.`, "👋");
  return agent;
}

export function renameAgent(state, { agentId, name }, now) {
  const agent = findAgent(state, agentId);
  if (!agent) throw new OfficeError("Agent introuvable.");
  const clean = clampStr(name, 24);
  if (!clean) throw new OfficeError("Nom vide.");
  log(state, now, agent.id, `${agent.name} s'appelle désormais ${clean}.`, "🏷️");
  agent.name = clean;
  return agent;
}

// ---------------------------------------------------------------------------
// Direction

export function requestBrief(state, now) {
  if (state.director.briefStatus === "writing") throw new OfficeError("Le brief est déjà en cours de rédaction.");
  state.director.briefStatus = "writing";
  state.director.briefRequestedAt = now;
  log(state, now, "director", `${agentName(state, "director")} rédige le brief de direction…`, "🧭");
  return state.director;
}

export function attachBrief(state, markdown, now) {
  if (state.director.briefStatus !== "writing") return null;
  const tz = state.settings.tzOffset || 0;
  const day = new Date(now + tz * 60000).toISOString().slice(0, 10);
  const doc = addDocument(state, { title: `Brief de direction — ${day}`, kind: "brief", content: String(markdown || "").slice(0, 50000), tags: ["direction"], authorId: "director" }, now);
  state.director.briefStatus = "idle";
  state.director.lastBriefAt = now;
  state.director.lastBriefDocId = doc.id;
  log(state, now, "director", "Le brief de direction est prêt dans la bibliothèque.", "🧭");
  return doc;
}

// ---------------------------------------------------------------------------
// Point d'entrée unique des actions (utilisé par l'API et le mode démo)

export function applyAction(state, type, payload = {}, now = Date.now()) {
  switch (type) {
    case "task.create": return createTask(state, payload, now);
    case "task.cancel": return cancelTask(state, payload, now);
    case "task.review": return reviewTask(state, payload, now);
    case "doc.add": return addDocument(state, { ...payload, authorId: "boss" }, now);
    case "doc.update": return updateDocument(state, payload);
    case "doc.delete": return deleteDocument(state, payload, now);
    case "event.add": return addEvent(state, payload, now);
    case "event.delete": return deleteEvent(state, payload, now);
    case "meeting.start": return startMeeting(state, payload, now);
    case "meeting.note": return addMeetingNote(state, payload, now);
    case "meeting.end": return endMeeting(state, payload, now);
    case "meeting.actionToTask": return meetingActionToTask(state, payload, now);
    case "agent.hire": return hireAgent(state, payload, now);
    case "agent.fire": return fireAgent(state, payload, now);
    case "agent.rename": return renameAgent(state, payload, now);
    case "director.brief": return requestBrief(state, now);
    case "settings.update": {
      if (payload.bossName !== undefined) state.boss.name = clampStr(payload.bossName, 32) || state.boss.name;
      if (payload.tzOffset !== undefined && Number.isFinite(Number(payload.tzOffset))) {
        state.settings.tzOffset = Math.max(-840, Math.min(840, Math.round(Number(payload.tzOffset))));
      }
      return state.settings;
    }
    default:
      throw new OfficeError(`Action inconnue : ${type}`);
  }
}

// ---------------------------------------------------------------------------
// Horloge du QG : démarre/termine les missions, rappels, réunions planifiées.

export function advance(state, now = Date.now()) {
  const notes = [];
  let changed = false;

  for (const task of state.tasks) {
    if (task.status === "working" && task.output && now - task.startedAt >= task.durationMs) {
      finishTask(state, task, now, notes);
      changed = true;
    }
  }

  for (const agent of state.agents) {
    if (currentTask(state, agent.id)) continue;
    const next = state.tasks.filter((t) => t.agentId === agent.id && t.status === "queued").sort(byPriority)[0];
    if (!next) continue;
    next.status = "working";
    next.startedAt = now;
    next.durationMs = TASK_TYPES[next.type]?.durationMs || 20000;
    log(state, now, agent.id, `${agent.name} attaque « ${next.title} ».`, TASK_TYPES[next.type]?.icon || "💼");
    changed = true;
  }

  for (const ev of state.events) {
    if (ev.remindMinutes === null || ev.remindedAt) continue;
    if (now >= ev.start + 5 * 60000) {
      ev.remindedAt = -1; // trop tard pour rappeler
      changed = true;
    } else if (now >= ev.start - ev.remindMinutes * 60000) {
      ev.remindedAt = now;
      notes.push({ kind: "reminder", eventId: ev.id, text: `⏰ Rappel : « ${ev.title} »` });
      changed = true;
    }
  }

  for (const ev of state.events) {
    if (!ev.isMeeting || ev.meetingId) continue;
    if (now >= ev.start && now < ev.start + ev.durationMin * 60000 && !liveMeeting(state)) {
      const meeting = startMeeting(state, { title: ev.title, attendees: ev.attendees, eventId: ev.id }, now);
      ev.meetingId = meeting.id;
      notes.push({ kind: "meeting_started", meetingId: meeting.id, text: `🗣️ La réunion « ${ev.title} » commence en salle de réunion.` });
      changed = true;
    }
  }

  const live = liveMeeting(state);
  if (live?.eventId) {
    const ev = state.events.find((e) => e.id === live.eventId);
    if (ev && now > ev.start + (ev.durationMin + 10) * 60000) {
      endMeeting(state, { meetingId: live.id }, now);
      changed = true;
    }
  }

  // Historique borné
  const finished = state.tasks.filter((t) => ["done", "cancelled"].includes(t.status));
  if (finished.length > LIMITS.finishedTasks) {
    const drop = new Set(finished.sort((a, b) => a.finishedAt - b.finishedAt).slice(0, finished.length - LIMITS.finishedTasks).map((t) => t.id));
    state.tasks = state.tasks.filter((t) => !drop.has(t.id));
    changed = true;
  }

  return { notes, changed };
}

// Travaux à confier au générateur (IA ou modèles) : déduits de l'état, donc
// automatiquement relancés après un redémarrage du serveur.
export function pendingJobs(state) {
  const jobs = [];
  for (const t of state.tasks) if (t.status === "working" && !t.output) jobs.push({ kind: "task", id: t.id });
  for (const m of state.meetings) if (m.status === "summarizing") jobs.push({ kind: "meeting", id: m.id });
  if (state.director.briefStatus === "writing") jobs.push({ kind: "brief", id: "brief" });
  return jobs;
}

// Vue allégée envoyée au client : sans le contenu lourd des documents (sites HTML…),
// récupéré à la demande quand on ouvre un document.
export function toClientState(state) {
  return {
    ...state,
    documents: state.documents.map(({ content, ...doc }) => ({
      ...doc,
      excerpt: doc.kind === "site" ? "" : String(content || "").replace(/[#*_>`-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
    })),
    tasks: state.tasks.map((t) => (t.output ? { ...t, output: { kind: t.output.kind, title: t.output.title, summary: t.output.summary } } : t)),
  };
}

export function getDocument(state, docId) {
  const doc = state.documents.find((d) => d.id === docId);
  if (!doc) throw new OfficeError("Document introuvable.");
  return doc;
}
