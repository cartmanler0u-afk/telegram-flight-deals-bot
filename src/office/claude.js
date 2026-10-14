// Générateur IA : chaque agent du QG travaille via l'API Claude.
// Même interface que le générateur hors-ligne (webapp/shared/templates.js).

import Anthropic from "@anthropic-ai/sdk";
import { computeKpis, findAgent, reportsOf, agentLoad, currentTask } from "../../webapp/shared/engine.js";
import { PRIORITIES, DOC_KINDS, TASK_TYPES, roleOf } from "../../webapp/shared/roster.js";
import { formatLocal, localIso, parseLocalIso } from "../../webapp/shared/dates.js";
import { systemPromptFor, SCRIBE_MEETING_PROMPT, DIRECTOR_BRIEF_PROMPT, PARSE_EVENTS_PROMPT, WEB_SEARCH_ROLES } from "./prompts.js";

// Modèles qui acceptent le repli serveur automatique en cas de refus (fallbacks: "default").
const SERVER_FALLBACK_MODELS = /^claude-(opus-5|fable-5|sonnet-5-5)/;

const EVENTS_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          start_local: { type: "string" },
          duration_min: { type: "integer" },
          is_meeting: { type: "boolean" },
          attendees: { type: "array", items: { type: "string" } },
        },
        required: ["title", "start_local", "duration_min", "is_meeting", "attendees"],
        additionalProperties: false,
      },
    },
  },
  required: ["message", "events"],
  additionalProperties: false,
};

const MEETING_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, assignee: { type: "string" } },
        required: ["text", "assignee"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "decisions", "actions"],
  additionalProperties: false,
};

function extractHtml(text) {
  const fenced = /```(?:html)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/<!doctype html|<html/i);
  return (start >= 0 ? body.slice(start) : body).trim();
}

function teamContext(state) {
  return state.agents
    .map((a) => `- ${a.name} — ${roleOf(a).label}${a.managerId ? ` (manager : ${findAgent(state, a.managerId)?.name || "?"})` : ""}`)
    .join("\n");
}

function libraryContext(state) {
  return state.documents
    .slice(-80)
    .map((d) => `- [${DOC_KINDS[d.kind]?.label || d.kind}] ${d.title}${d.tags.length ? ` #${d.tags.join(" #")}` : ""} — ${new Date(d.createdAt).toISOString().slice(0, 10)}${d.content && d.kind !== "site" ? ` — « ${d.content.replace(/\s+/g, " ").slice(0, 160)} »` : ""}`)
    .join("\n") || "(bibliothèque vide)";
}

function agendaContext(state, now) {
  const tz = state.settings.tzOffset || 0;
  return state.events
    .filter((e) => e.start >= now - 3600000)
    .slice(0, 25)
    .map((e) => `- ${formatLocal(e.start, tz)} (${e.durationMin} min) — ${e.title}${e.isMeeting ? " [réunion]" : ""}`)
    .join("\n") || "(agenda vide)";
}

function officeContext(state, now) {
  const k = computeKpis(state, now);
  const open = state.tasks
    .filter((t) => ["queued", "working", "review"].includes(t.status))
    .map((t) => `- [${t.status}] ${PRIORITIES[t.priority]?.label} — ${t.title} → ${findAgent(state, t.agentId)?.name || "?"}`)
    .join("\n");
  return `Indicateurs : ${k.working} en cours, ${k.queued} en attente, ${k.review} à valider, ${k.doneToday} livrées aujourd'hui, ${k.documents} documents.
Missions ouvertes :
${open || "(aucune)"}`;
}

function teamReportContext(state, manager) {
  return reportsOf(state, manager.id)
    .map((a) => {
      const cur = currentTask(state, a.id);
      return `- ${a.name} (${roleOf(a).label}) : ${cur ? `travaille sur « ${cur.title} »` : "disponible"}, ${agentLoad(state, a.id)} mission(s) ouvertes, ${a.stats.done} livrée(s)`;
    })
    .join("\n") || "(aucun agent rattaché)";
}

const KIND_BY_TYPE = {
  decision: "memo", notes: "note", content: "content", listing: "listing", video: "video", dealhunt: "deals",
  finance: "finance", automation: "code", social: "content", channel: "content", support: "content",
  design: "visual", ads: "campaign", data: "dashboard", legal: "legal", admin: "legal", hr: "hr", events: "note",
};

const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 5 };
const MAX_CONTINUATIONS = 3;

// Sources consultées par la recherche web (pour les citer en fin de livrable).
function webSources(content) {
  const seen = new Map();
  for (const block of content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const r of block.content) if (r.url && !seen.has(r.url)) seen.set(r.url, r.title || r.url);
  }
  return [...seen.entries()].slice(0, 8);
}

export function createClaudeGenerator({ apiKey, model, effort = "medium", webSearch = true, client = new Anthropic({ apiKey }) }) {
  const useServerFallback = SERVER_FALLBACK_MODELS.test(model);
  let webSearchAvailable = webSearch;

  async function call(params) {
    // Streaming : évite les délais d'attente HTTP sur les longues réponses (sites complets).
    const stream = useServerFallback
      ? client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : client.messages.stream(params);
    return stream.finalMessage();
  }

  async function ask({ system, user, maxTokens = 16000, schema = null, effortLevel = effort, search = false }) {
    const tools = search && webSearchAvailable ? [WEB_SEARCH_TOOL] : null;
    const params = {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: effortLevel, ...(schema ? { format: { type: "json_schema", schema } } : {}) },
      ...(tools ? { tools } : {}),
    };

    let message;
    try {
      message = await call(params);
    } catch (err) {
      // Recherche web non activée sur le compte : on retente sans, et on ne la propose plus.
      if (tools && err instanceof Anthropic.BadRequestError) {
        webSearchAvailable = false;
        delete params.tools;
        message = await call(params);
      } else {
        throw err;
      }
    }
    // Les outils serveur peuvent mettre le tour en pause : on le relance tel quel.
    const content = [...message.content];
    for (let i = 0; message.stop_reason === "pause_turn" && i < MAX_CONTINUATIONS; i++) {
      params.messages = [{ role: "user", content: user }, { role: "assistant", content: message.content }];
      message = await call(params);
      content.push(...message.content);
    }

    if (message.stop_reason === "refusal") {
      throw new Error("l'IA a décliné cette demande");
    }
    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    if (schema) {
      if (message.stop_reason === "max_tokens") throw new Error("réponse structurée tronquée");
      return JSON.parse(text);
    }
    return { text, truncated: message.stop_reason === "max_tokens", sources: webSources(content) };
  }

  return {
    name: "claude",
    ai: true,
    model,

    async runTask({ task, agent, state, now }) {
      const tz = state.settings.tzOffset || 0;
      const boss = state.boss.name;
      const system = systemPromptFor(agent, boss, state.settings.companyName);
      const parts = [
        `Mission : ${task.title}`,
        `Priorité : ${PRIORITIES[task.priority]?.label || task.priority}`,
        task.brief ? `Brief :\n${task.brief}` : null,
        task.feedback?.length ? `Corrections demandées par ${boss} sur la version précédente (à intégrer impérativement) :\n${task.feedback.map((f) => `- ${f.text}`).join("\n")}` : null,
      ];
      if (agent.role === "librarian") parts.push(`Inventaire de la bibliothèque :\n${libraryContext(state)}`);
      if (agent.role === "manager") parts.push(`Ton équipe :\n${teamReportContext(state, agent)}`);
      if (agent.role === "director" || agent.role === "deputy") parts.push(`Situation de l'entreprise :\n${officeContext(state, now)}\n\nÉquipe :\n${teamContext(state)}`);
      if (agent.role === "dealhunter" || agent.role === "sourcer") {
        const recent = (state.deals || []).slice(-15).map((d) => `- ${d.title}`).join("\n");
        parts.push(`Date du jour : ${localIso(now, tz).slice(0, 10)}.${recent ? `\nBons plans déjà repérés (ne pas les répéter) :\n${recent}` : ""}`);
      } else if (WEB_SEARCH_ROLES.has(agent.role)) {
        parts.push(`Date du jour : ${localIso(now, tz).slice(0, 10)}.`);
      }

      if (task.type === "planning") {
        const answer = await ask({
          system,
          user: `${parts.filter(Boolean).join("\n\n")}\n\nDate et heure actuelles (fuseau de ${boss}) : ${localIso(now, tz)}\n\nAgenda existant :\n${agendaContext(state, now)}\n\nAgents du QG :\n${teamContext(state)}`,
          schema: EVENTS_SCHEMA,
          maxTokens: 4000,
        });
        const events = answer.events
          .map((e) => ({
            title: e.title,
            start: parseLocalIso(e.start_local, tz),
            durationMin: e.duration_min,
            isMeeting: e.is_meeting,
            attendees: e.attendees,
            remindMinutes: 15,
          }))
          .filter((e) => e.start);
        const recap = events.map((e) => `- 📅 **${e.title}** — ${formatLocal(e.start, tz)} (${e.durationMin} min)`).join("\n");
        return {
          kind: "note",
          title: `Planning — ${task.title}`,
          content: `${answer.message}\n\n${recap || "_Aucun rendez-vous créé._"}`,
          events,
        };
      }

      if (task.type === "site") {
        const { text, truncated } = await ask({
          system,
          user: parts.filter(Boolean).join("\n\n"),
          maxTokens: 32000,
        });
        const html = extractHtml(text);
        const title = /<title>([^<]{1,100})<\/title>/i.exec(html)?.[1]?.trim() || task.title;
        return {
          kind: "site",
          title: `Site — ${title}`,
          content: html,
          summary: truncated ? "Page longue : la fin a pu être tronquée." : "Page HTML prête à publier.",
        };
      }

      const search = WEB_SEARCH_ROLES.has(agent.role);
      const { text, truncated, sources } = await ask({ system, user: parts.filter(Boolean).join("\n\n"), search, maxTokens: search ? 12000 : 16000 });
      const kind = KIND_BY_TYPE[task.type] || "report";
      let content = truncated ? `${text}\n\n_(livrable tronqué : relance une version plus courte si besoin)_` : text;
      if (sources.length) content += `\n\n## Sources consultées\n${sources.map(([url, title]) => `- [${title.replace(/[[\]]/g, "")}](${url})`).join("\n")}`;
      return {
        kind,
        title: kind === "memo" ? `Décision — ${task.title}` : task.title,
        content,
        summary: sources.length ? `${sources.length} source(s) web consultée(s)` : "",
      };
    },

    async summarizeMeeting({ meeting, state }) {
      const participants = meeting.attendees.map((id) => findAgent(state, id)?.name).filter(Boolean);
      const answer = await ask({
        system: SCRIBE_MEETING_PROMPT(state.boss.name),
        user: `Réunion : ${meeting.title}\nParticipants : ${[state.boss.name, ...participants].join(", ")}\n\nNotes brutes :\n${meeting.notes.map((n) => `- ${n.text}`).join("\n")}`,
        schema: MEETING_SCHEMA,
        maxTokens: 6000,
      });
      return {
        summary: answer.summary,
        decisions: answer.decisions,
        actions: answer.actions.map((a) => ({ text: a.text, assignee: a.assignee || null })),
      };
    },

    async directorBrief({ state, now }) {
      const tz = state.settings.tzOffset || 0;
      const review = state.tasks.filter((t) => t.status === "review").map((t) => `- ${t.title} (${findAgent(state, t.agentId)?.name})`).join("\n");
      const recentDone = state.tasks
        .filter((t) => t.status === "done")
        .slice(-8)
        .map((t) => `- ${TASK_TYPES[t.type]?.label} : ${t.title} (${findAgent(state, t.agentId)?.name})`)
        .join("\n");
      const { text } = await ask({
        system: DIRECTOR_BRIEF_PROMPT(state.boss.name),
        user: `Nous sommes le ${formatLocal(now, tz)}.\n\n${officeContext(state, now)}\n\nDossiers à valider :\n${review || "(aucun)"}\n\nDernières livraisons :\n${recentDone || "(aucune)"}\n\nAgenda :\n${agendaContext(state, now)}\n\nÉquipe :\n${teamContext(state)}`,
        maxTokens: 6000,
      });
      return text;
    },

    async parseEvents({ text, now, tzOffset, state }) {
      const answer = await ask({
        system: PARSE_EVENTS_PROMPT,
        user: `Date et heure actuelles : ${localIso(now, tzOffset)}\nAgents du QG : ${state.agents.map((a) => a.name).join(", ")}\n\nDemande : ${text}`,
        schema: EVENTS_SCHEMA,
        maxTokens: 2000,
        effortLevel: "low",
      });
      return answer.events
        .map((e) => {
          const start = parseLocalIso(e.start_local, tzOffset);
          return start && {
            title: e.title,
            start,
            localStart: localIso(start, tzOffset),
            durationMin: e.duration_min,
            isMeeting: e.is_meeting,
            attendees: e.attendees,
            confident: true,
          };
        })
        .filter(Boolean);
    },
  };
}

export function describeAi(config) {
  return config.anthropicApiKey ? { enabled: true, model: config.anthropicModel } : { enabled: false, model: null };
}

