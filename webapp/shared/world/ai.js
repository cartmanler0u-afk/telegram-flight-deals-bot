// IA narrative du Bâtiment, hybride et budgétée.
//
// La simulation est entièrement déterministe ; l'IA n'intervient que pour habiller les
// moments à forte valeur narrative (événements rares ou majeurs) d'un court récit.
// Garde-fous :
//  - budget quotidien d'appels (réglable, jamais au-delà du plafond de l'opérateur) ;
//  - un seul travail en attente à la fois, aucune boucle ;
//  - la réponse est une DONNÉE NON FIABLE : nettoyée, bornée, stockée à part
//    (event.narration). Elle ne crée ni fait, ni transaction, ni règle, ne déclenche
//    aucune action et n'est jamais réinjectée comme instruction ;
//  - en cas d'erreur ou sans IA, le Bâtiment continue exactement pareil.

import { clampText, localParts } from "./core.js";

const MAX_LOG = 20;

function budget(world, now) {
  const { dayKey } = localParts(world, now);
  if (world.ai.day !== dayKey) Object.assign(world.ai, { day: dayKey, calls: 0 });
  return world.config.ai.dailyCalls - world.ai.calls;
}

export function aiActive(world) {
  return !!(world.config.ai.available && world.config.ai.enabled && world.config.ai.dailyCalls > 0);
}

// Choisit (au plus) un événement à raconter. L'appel est réservé dans le budget dès la
// mise en file : deux travaux parallèles ne peuvent pas dépasser le plafond.
export function queueAiJobs(world, now) {
  world.jobs ||= [];
  if (!aiActive(world)) return false;
  if (world.jobs.some((j) => j.status === "pending")) return false;
  if (budget(world, now) <= 0) return false;
  const candidate = [...world.events]
    .reverse()
    .find((e) => e.public && (e.rare || e.importance >= 5) && !e.narration && !e.aiQueued && now - e.at < 6 * 3600000);
  if (!candidate) return false;
  candidate.aiQueued = true;
  world.ai.calls += 1;
  world.jobs.push({ id: `wj${world.cycle.toString(36)}_${candidate.id}`, kind: "narrate", eventId: candidate.id, status: "pending", createdAt: now });
  if (world.jobs.length > 20) world.jobs.splice(0, world.jobs.length - 20);
  return true;
}

export function pendingWorldJobs(world) {
  return (world?.jobs || []).filter((j) => j.status === "pending").map((j) => ({ kind: "world", id: j.id }));
}

// Paquet envoyé au générateur : uniquement des faits publics déjà enregistrés.
export function worldJobPacket(world, jobId) {
  const job = world.jobs.find((j) => j.id === jobId);
  const event = job && world.events.find((e) => e.id === job.eventId);
  if (!event) return null;
  const causes = event.causes.map((id) => world.events.find((e) => e.id === id)).filter(Boolean).map((e) => e.title);
  return {
    building: world.name,
    event: { title: event.title, text: event.text, tags: event.tags, rare: event.rare },
    causes,
    cast: event.actors.map((id) => world.people[id]).filter(Boolean).map((p) => ({ name: p.name, title: p.title, traits: p.traits.slice(0, 3) })),
    mood: world.mood,
  };
}

// Nettoie une sortie IA : texte brut court, sans balisage ni caractères de contrôle.
export function sanitizeNarration(text) {
  if (typeof text !== "string") return null;
  const clean = text
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length >= 20 ? clampText(clean, 600) : null;
}

export function attachWorldNarration(state, jobId, result, meta = {}, now = Date.now()) {
  const world = state.world;
  const job = world?.jobs?.find((j) => j.id === jobId);
  if (!job || job.status !== "pending") return false;
  const event = world.events.find((e) => e.id === job.eventId);
  const text = sanitizeNarration(result?.narration);
  job.status = text && event ? "done" : meta.error ? "failed" : "skipped";
  job.finishedAt = now;
  if (text && event) event.narration = { text, ai: !!meta.ai, model: meta.model || null };
  if (result?.usage) {
    world.ai.tokensIn += result.usage.input_tokens || 0;
    world.ai.tokensOut += result.usage.output_tokens || 0;
  }
  if (!meta.ai) world.ai.skipped += 1;
  world.ai.log ||= [];
  world.ai.log.push({ at: now, eventId: job.eventId, status: job.status, in: result?.usage?.input_tokens || 0, out: result?.usage?.output_tokens || 0, error: meta.error ? String(meta.error).slice(0, 120) : null });
  if (world.ai.log.length > MAX_LOG) world.ai.log.splice(0, world.ai.log.length - MAX_LOG);
  return true;
}
