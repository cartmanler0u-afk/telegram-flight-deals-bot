// Vie sociale de l'entreprise : relations entre collègues (amitiés, crushs, couples, rivalités),
// potins, anniversaires, chats du bureau, stagiaires et élection de l'employé du mois par des
// quêtes. Fonctions pures sur l'état JSON, partagées entre le serveur et le mode démo.

import { OfficeError, log, findAgent, managerFor } from "./engine.js";
import { DEPARTMENTS, ROLES, TRAIT_LABELS, roleOf } from "./roster.js";

const HOUR = 3600000;
const DAY = 24 * HOUR;

export const LIFE_LIMITS = { stories: 60, cats: 5, hall: 24 };

export const RELATION_KINDS = {
  ami: { label: "Potes", icon: "🤝", color: "#4cc38a" },
  bff: { label: "Meilleurs potes", icon: "💛", color: "#f2c14e" },
  crush: { label: "Crush secret", icon: "😳", color: "#ff8fab" },
  couple: { label: "En couple", icon: "❤️", color: "#ef476f" },
  rival: { label: "Rivalité", icon: "⚡", color: "#f77f00" },
  ex: { label: "Ex", icon: "💔", color: "#9aa3c0" },
};

export const CAT_COATS = {
  tuxedo: { label: "noir et blanc", body: "#24242b", belly: "#f4f4f4" },
  orange: { label: "roux", body: "#e8893a", belly: "#f7d3a6" },
  grey: { label: "gris tigré", body: "#8e95a3", belly: "#d6dae2" },
  cream: { label: "crème", body: "#e9d8b8", belly: "#fff6e6" },
  black: { label: "tout noir", body: "#17171c", belly: "#2a2a31" },
  calico: { label: "écaille de tortue", body: "#7a4a2a", belly: "#f1e3cf" },
};

const START_CATS = [
  { id: "cat-pixel", name: "Pixel", coat: "tuxedo" },
  { id: "cat-mochi", name: "Mochi", coat: "orange" },
  { id: "cat-croquette", name: "Croquette", coat: "grey" },
];

// Cachettes des objets perdus (coordonnées de la scène 3D, en mètres).
export const HIDING_SPOTS = [
  { id: "archives-shelf", near: "du côté des archives", x: -2.4, y: 1.66, z: -13.0 },
  { id: "fridge", near: "dans la cuisine", x: -20.9, y: 1.93, z: 16.45 },
  { id: "rack", near: "dans l'entrepôt", x: 18.6, y: 2.14, z: 16.5 },
  { id: "director-sofa", near: "dans le bureau du directeur", x: -25.25, y: 0.46, z: -10.0 },
  { id: "meeting-table", near: "en salle de conférence", x: -14.0, y: 0.8, z: -12.7 },
  { id: "photo-table", near: "au studio photo", x: 6.5, y: 0.86, z: 13.3 },
  { id: "montage-floor", near: "au studio montage", x: 18.6, y: 0.06, z: -15.6 },
  { id: "createurs-sofa", near: "au pôle créateurs", x: 23.5, y: 0.46, z: -16.25 },
  { id: "reception-counter", near: "à l'accueil", x: -4.4, y: 1.2, z: 14.4 },
  { id: "copier", near: "près de la photocopieuse", x: 21.7, y: 1.08, z: 4.1 },
  { id: "cat-tree", near: "dans la salle de repos", x: 32.0, y: 1.68, z: -6.2 },
  { id: "lounge-corner", near: "dans la salle de repos", x: 33.6, y: 0.06, z: 3.2 },
  { id: "treadmill", near: "à la salle de sport", x: 27.6, y: 0.25, z: 15.75 },
  { id: "suggestion-box", near: "au bureau RH", x: 34.0, y: 1.17, z: 9.9 },
  { id: "legal-cabinet", near: "au service juridique", x: 39.45, y: 1.36, z: -10.4 },
  { id: "marketing-corner", near: "au studio marketing", x: 32.4, y: 0.06, z: -16.2 },
  { id: "safe", near: "à l'annexe", x: -14.6, y: 0.73, z: 9.7 },
  { id: "babyfoot", near: "au baby-foot", x: -20.6, y: 0.97, z: 4.5 },
  { id: "server", near: "près des serveurs des archives", x: -5.55, y: 2.03, z: -10.6 },
];

export const SEEK_ITEMS = [
  { id: "tupperware", emoji: "🥡", label: "son tupperware fétiche" },
  { id: "stapler", emoji: "📎", label: "son agrafeuse porte-bonheur" },
  { id: "headphones", emoji: "🎧", label: "son casque" },
  { id: "keys", emoji: "🔑", label: "les clés de la camionnette" },
  { id: "lens", emoji: "📷", label: "son objectif photo" },
  { id: "plush", emoji: "🧸", label: "sa peluche porte-bonheur" },
  { id: "drive", emoji: "💾", label: "le disque dur de sauvegarde" },
  { id: "badge", emoji: "🪪", label: "son badge" },
];

const PLACES = [
  "à la machine à café", "au baby-foot", "à l'entrepôt", "en salle de conf'", "au studio photo",
  "dans la salle de repos avec les chats", "à la salle de sport", "aux archives", "à la cuisine", "devant la photocopieuse",
];

const INCIDENTS = [
  { icon: "🥛", text: "Le yaourt de {v} a disparu du frigo de la cuisine." },
  { icon: "🍮", text: "L'agrafeuse de {v} a fini dans un bloc de gelée." },
  { icon: "🖊️", text: "Quelqu'un a écrit « {v} = 🤡 » au feutre indélébile sur le tableau blanc." },
  { icon: "🏐", text: "La chaise de {v} a été remplacée par un ballon de yoga." },
  { icon: "🖼️", text: "Le fond d'écran de {v} est devenu une photo de {cat} déguisé en pirate." },
  { icon: "☕", text: "Le mug préféré de {v} a été retrouvé dans la gamelle des chats." },
  { icon: "🟨", text: "L'écran de {v} a été entièrement recouvert de post-its." },
];

const QUARRELS = ["du dernier croissant", "du chargeur emprunté", "du thermostat", "de la playlist du vendredi", "du post-it jaune", "de la place près de la fenêtre", "du tupperware pas rendu"];

// Réconciliations proposées selon le caractère de la personne fâchée.
const PEACE_OFFERS = {
  foodie: "Lui offrir un resto (Uber Eats compris) 🍕",
  party: "Organiser un afterwork rien que pour eux 🎉",
  nerd: "Une soirée jeux vidéo en réseau 🎮",
  kind: "Une lettre d'excuses sincère, écrite à la main 💌",
  gossip: "Un café pour vider son sac (et raconter des potins) ☕",
  lazy: "Une sieste réparatrice dans la salle de repos 😴",
  hustler: "Un défi : le premier qui vend trois articles a gagné 🏁",
  artist: "Un atelier dessin en duo 🎨",
  calm: "Une séance de yoga à la salle de sport 🧘",
  meticulous: "Un tableau Excel qui répartit les torts au centime près 📊",
  shy: "Une médiation discrète avec Gérard, des RH 🤝",
  catlover: "Un moment câlins avec les chats du bureau 🐈",
  traveler: "Un week-end bon plan trouvé par Lucas 🧳",
  prankster: "Les laisser préparer une blague… ensemble 😈",
  zealous: "Un règlement intérieur signé par les deux 📜",
  grumpy: "Le laisser râler dix minutes sans l'interrompre 😤",
  nightowl: "Un café serré à 23 h, comme ils aiment ☕",
  hipster: "Un café de spécialité dans un bocal en verre 🫙",
  clumsy: "Lui offrir un mug incassable 🛡️",
  party2: "Une partie de baby-foot en double ⚽",
};

const STORY_ICONS = { ami: "🤝", bff: "💛", crush: "😳", couple: "❤️", dispute: "🥶", breakup: "💔", reconcile: "💞", rival: "⚡", peace: "🕊️" };

// ---------------------------------------------------------------------------
// Aléatoire déterministe (reproductible côté serveur comme dans les tests)

function rng(state) {
  const life = state.life;
  let t = (life.rng = (life.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pickR = (state, list) => list[Math.floor(rng(state) * list.length)];
function shuffleR(state, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const lid = (state, prefix) => `${prefix}_${(state.life.seq = (state.life.seq || 0) + 1).toString(36)}`;
const fill = (text, map) => text.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? "");
const clampStr = (v, max) => String(v ?? "").trim().slice(0, max);

function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function localDate(state, now) {
  const d = new Date(now + (state.settings?.tzOffset || 0) * 60000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dayKey: d.toISOString().slice(0, 10) };
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function monthKey(state, now) {
  const { y, m } = localDate(state, now);
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function monthLabel(key) {
  const [y, m] = String(key).split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

// Anniversaire déterministe de chaque employé (jour/mois).
export function birthdayOf(agent) {
  const h = hash(agent.id);
  const month = h % 12;
  const day = 1 + ((h >>> 8) % 28);
  return { month, day, label: `${day} ${MONTHS[month]}` };
}

// ---------------------------------------------------------------------------
// Relations

const relKey = (a, b) => [a, b].sort().join("|");

export function relationOf(state, a, b) {
  return state.life?.relations?.[relKey(a, b)] || null;
}

export function relationsOf(state, agentId) {
  return Object.values(state.life?.relations || {})
    .filter((r) => r.a === agentId || r.b === agentId)
    .filter((r) => findAgent(state, r.a) && findAgent(state, r.b))
    .map((r) => ({ ...r, other: r.a === agentId ? r.b : r.a }));
}

function setRelation(state, a, b, kind, now, { score, note, from } = {}) {
  const key = relKey(a, b);
  const prev = state.life.relations[key];
  state.life.relations[key] = {
    a: [a, b].sort()[0],
    b: [a, b].sort()[1],
    kind,
    score: score ?? prev?.score ?? 0,
    since: prev?.kind === kind ? prev.since : now,
    note: note ?? (prev?.kind === kind ? prev.note : ""),
    from: from ?? null,
  };
  return state.life.relations[key];
}

const START_RELATIONS = [
  ["webdev", "deputy", "rival", -45, "La guerre des agrafeuses dure depuis le premier jour."],
  ["photographer", "vinted", "crush", 35, "Tom trouve toujours une excuse pour passer au pôle Vente.", "photographer"],
  ["cleaner", "support", "bff", 85, "Le duo officiel des potins."],
  ["accountant", "logistics", "ami", 55, "Unis par l'amour du chili maison."],
  ["director", "hr", "rival", -60, "Victor ne supporte pas Gérard. Personne ne sait pourquoi."],
  ["tiktok", "snap", "bff", 80, "Le duo infernal du pôle Social."],
  ["webdev", "automation", "ami", 60, "Le binôme de choc du studio."],
  ["scribe", "secretary", "crush", 30, "Noé n'a jamais osé engager la conversation.", "scribe"],
  ["mgr-vente", "mgr-sourcing", "rival", -25, "Compétition amicale (non) entre pôles."],
  ["deputy", "intern", "rival", -35, "Bertrand surveille le stagiaire de très près."],
  ["dealhunter-2", "talent", "ami", 55, "Inséparables les soirs d'afterwork."],
  ["designer", "writer", "ami", 60, "Les deux artistes de la boîte."],
  ["happiness", "cleaner", "ami", 50, "Le duo qui nourrit les chats en cachette."],
  ["intern-social", "tiktok", "ami", 45, "Théo veut devenir Enzo quand il sera grand."],
  ["growth", "data", "ami", 40, "L'un dépense, l'autre compte."],
];

// ---------------------------------------------------------------------------
// Initialisation / migration

export function initLife(state, now) {
  if (state.life && state.life.version === 1) return state.life;
  state.life = {
    version: 1,
    rng: hash(`${state.createdAt || now}|${state.boss?.name || ""}`) || 1,
    seq: 0,
    relations: {},
    stories: [],
    nextStoryAt: now + 40 * 60000,
    lastDay: null,
    cats: START_CATS.map((c) => ({ ...c, adoptedAt: now, fedAt: 0, pets: 0 })),
    round: null,
    hall: [],
    mood: 70,
    ...(state.life && typeof state.life === "object" ? state.life : {}),
  };
  const fresh = !state.life.stories.length;
  for (const [a, b, kind, score, note, from] of START_RELATIONS) {
    if (findAgent(state, a) && findAgent(state, b) && !relationOf(state, a, b)) setRelation(state, a, b, kind, now, { score, note, from });
  }
  if (fresh) {
    // Quelques potins de départ pour planter le décor.
    for (const [a, b, kind] of START_RELATIONS.slice(0, 5)) {
      const rel = relationOf(state, a, b);
      if (rel) addStory(state, now, { icon: RELATION_KINDS[kind].icon, kind, ids: [a, b], text: `${nameOf(state, a)} & ${nameOf(state, b)} — ${rel.note}` });
    }
    state.life.nextStoryAt = now + 12 * 60000;
  }
  if (!state.life.round) startRound(state, now);
  return state.life;
}

export function addStory(state, now, { icon = "🗞️", text, ids = [], kind = "potin" }) {
  const story = { id: lid(state, "st"), at: now, icon, text: clampStr(text, 280), ids: ids.filter(Boolean), kind };
  state.life.stories.push(story);
  if (state.life.stories.length > LIFE_LIMITS.stories) state.life.stories.splice(0, state.life.stories.length - LIFE_LIMITS.stories);
  return story;
}

function changeMood(state, delta) {
  state.life.mood = Math.max(0, Math.min(100, Math.round((state.life.mood ?? 70) + delta)));
}

// ---------------------------------------------------------------------------
// Potins : la vie suit son cours toute seule

const nameOf = (state, id) => findAgent(state, id)?.name || "Quelqu'un";
const isIntern = (agent) => agent?.role === "intern";

function inCouple(state, id) {
  return relationsOf(state, id).some((r) => r.kind === "couple");
}

// Pas de romance entre un manager et son équipe, ni avec le patron ou les stagiaires.
function romanceOk(state, a, b) {
  if (!a || !b || a.id === b.id) return false;
  if ([a, b].some((x) => x.role === "director" || isIntern(x))) return false;
  if (a.managerId === b.id || b.managerId === a.id) return false;
  if (inCouple(state, a.id) || inCouple(state, b.id)) return false;
  const rel = relationOf(state, a.id, b.id);
  return !rel || ["ami", "bff"].includes(rel.kind);
}

const BEATS = {
  friends(state, now) {
    const agents = state.agents;
    const a = pickR(state, agents);
    const pool = agents.filter((b) => b.id !== a.id && (b.dept === a.dept || (b.traits || []).some((t) => (a.traits || []).includes(t))));
    const b = pool.length ? pickR(state, pool) : null;
    if (!b) return null;
    const rel = relationOf(state, a.id, b.id);
    if (rel && !["ami"].includes(rel.kind)) return null;
    if (rel?.kind === "ami") {
      setRelation(state, a.id, b.id, "bff", now, { score: 85, note: "Ils ont un check secret." });
      return { icon: STORY_ICONS.bff, kind: "bff", ids: [a.id, b.id], text: `${a.name} et ${b.name} ont désormais un check secret. Meilleurs potes confirmés 💛` };
    }
    setRelation(state, a.id, b.id, "ami", now, { score: 50 });
    const text = pickR(state, [
      `${a.name} et ${b.name} ont déjeuné ensemble trois jours de suite. C'est officiel : ce sont des potes.`,
      `${a.name} a prêté son chargeur à ${b.name}. Le début d'une belle amitié.`,
      `${a.name} et ${b.name} se sont découvert une haine commune des réunions du lundi. Amitié instantanée.`,
    ]);
    return { icon: STORY_ICONS.ami, kind: "ami", ids: [a.id, b.id], text };
  },

  crush(state, now) {
    const singles = state.agents.filter((x) => !isIntern(x) && x.role !== "director" && !inCouple(state, x.id));
    const a = singles.length ? pickR(state, singles) : null;
    const b = a ? pickR(state, singles.filter((x) => romanceOk(state, a, x))) : null;
    if (!a || !b || relationsOf(state, a.id).some((r) => r.kind === "crush")) return null;
    setRelation(state, a.id, b.id, "crush", now, { score: 30, from: a.id, note: `${a.name} rougit dès que ${b.name} passe.` });
    const source = state.agents.find((x) => x.role === "cleaner" && ![a.id, b.id].includes(x.id))?.name || "une source sûre";
    return { icon: STORY_ICONS.crush, kind: "crush", ids: [a.id, b.id], text: `Potin : ${a.name} rougit à chaque fois que ${b.name} passe devant son bureau 😳 (source : ${source})` };
  },

  couple(state, now) {
    const crushes = Object.values(state.life.relations).filter((r) => r.kind === "crush" && now - r.since > 6 * HOUR);
    const rel = crushes.length ? pickR(state, crushes) : null;
    if (!rel) return null;
    const a = findAgent(state, rel.a);
    const b = findAgent(state, rel.b);
    if (!a || !b || inCouple(state, a.id) || inCouple(state, b.id)) return null;
    setRelation(state, a.id, b.id, "couple", now, { score: 90, note: "Le couple star de la machine à café." });
    changeMood(state, 3);
    const insider = state.agents.find((x) => x.role === "cleaner" && ![a.id, b.id].includes(x.id))?.name || "la machine à café";
    return { icon: STORY_ICONS.couple, kind: "couple", ids: [a.id, b.id], text: `C'est officiel : ${a.name} et ${b.name} sont en couple ❤️ (${insider} était au courant avant tout le monde).` };
  },

  dispute(state, now) {
    const couples = Object.values(state.life.relations).filter((r) => r.kind === "couple" && now - r.since > 12 * HOUR);
    const rel = couples.length ? pickR(state, couples) : null;
    if (!rel) return null;
    const a = findAgent(state, rel.a);
    const b = findAgent(state, rel.b);
    if (!a || !b) return null;
    changeMood(state, -2);
    if (rng(state) < 0.3) {
      setRelation(state, a.id, b.id, "ex", now, { score: -10, note: "Séparation « à l'amiable »." });
      return { icon: STORY_ICONS.breakup, kind: "breakup", ids: [a.id, b.id], text: `${a.name} et ${b.name} se séparent… mais restent très pros. Ambiance glaciale à la machine à café.` };
    }
    const topic = pickR(state, QUARRELS);
    return { icon: STORY_ICONS.dispute, kind: "dispute", ids: [a.id, b.id], text: `Froid polaire entre ${a.name} et ${b.name} : l'histoire ${topic}. Ça va se tasser (on espère).` };
  },

  rivalry(state, now) {
    const pranksters = state.agents.filter((x) => (x.traits || []).some((t) => ["prankster", "hustler", "zealous", "grumpy"].includes(t)));
    const a = pranksters.length ? pickR(state, pranksters) : null;
    const b = a ? pickR(state, state.agents.filter((x) => x.id !== a.id && x.role !== "director")) : null;
    if (!a || !b || relationOf(state, a.id, b.id)) return null;
    setRelation(state, a.id, b.id, "rival", now, { score: -30, note: "Ça a commencé pour une histoire de place de parking." });
    return { icon: STORY_ICONS.rival, kind: "rival", ids: [a.id, b.id], text: pickR(state, [
      `${a.name} accuse ${b.name} de lui avoir volé sa place de parking. (Il n'y a pas de parking.)`,
      `${a.name} et ${b.name} se disputent le dernier fauteuil de la salle de repos. La guerre est déclarée.`,
      `${a.name} a battu ${b.name} au baby-foot 10-0. ${b.name} réclame une revanche, et un avocat.`,
    ]) };
  },

  peace(state, now) {
    const rivals = Object.values(state.life.relations).filter((r) => r.kind === "rival" && now - r.since > DAY && !(r.a === "director" || r.b === "director"));
    const rel = rivals.length ? pickR(state, rivals) : null;
    if (!rel) return null;
    const a = findAgent(state, rel.a);
    const b = findAgent(state, rel.b);
    if (!a || !b) return null;
    setRelation(state, a.id, b.id, "ami", now, { score: 40, note: "Paix signée autour d'un baby-foot." });
    changeMood(state, 2);
    return { icon: STORY_ICONS.peace, kind: "peace", ids: [a.id, b.id], text: `${a.name} et ${b.name} ont enterré la hache de guerre après une partie de baby-foot épique 🕊️` };
  },

  incident(state) {
    const bruno = state.agents.find((x) => x.role === "accountant");
    const someone = pickR(state, state.agents);
    const cat = pickR(state, state.life.cats.length ? state.life.cats : [{ name: "le chat" }]);
    changeMood(state, -2);
    const options = [
      bruno && { text: `${bruno.name} a renversé son chili maison sur la moquette. Le compteur « jours sans incident » repart à zéro.`, ids: [bruno.id], gag: "chili" },
      { text: `La photocopieuse a avalé le rapport de ${someone.name}. Elle refuse de le rendre.`, ids: [someone.id], gag: "printer" },
      { text: `Le micro-ondes a pris feu (un peu). Bertrand a déclenché l'alarme (beaucoup).`, ids: ["deputy"], gag: "fire" },
      { text: `${cat.name} a fait tomber un mug plein sur le clavier de ${someone.name}.`, ids: [someone.id], gag: "mug" },
    ].filter(Boolean);
    const o = pickR(state, options);
    return { icon: "🚧", kind: "incident", ids: o.ids, text: o.text, gag: o.gag };
  },

  intern(state) {
    const interns = state.agents.filter(isIntern);
    if (!interns.length) return null;
    const a = pickR(state, interns);
    return { icon: "🧃", kind: "intern", ids: [a.id], text: pickR(state, [
      `${a.name} a répondu « Merci à tous ! » à un mail envoyé à toute l'entreprise. 38 fois.`,
      `${a.name} a réorganisé l'entrepôt par couleur. Moussa ne retrouve plus rien.`,
      `${a.name} a confondu la broyeuse et la photocopieuse. Les archives sont en deuil.`,
      `${a.name} a fait un TikTok en salle de conf'. 2 millions de vues. Victor veut en être.`,
      `${a.name} a préparé 14 cafés pour l'équipe. Personne n'avait commandé ça.`,
      `${a.name} s'est perdu en cherchant les toilettes et a découvert un placard secret.`,
    ]) };
  },

  cat(state) {
    if (!state.life.cats.length) return null;
    const cat = pickR(state, state.life.cats);
    const a = pickR(state, state.agents);
    return { icon: "🐈", kind: "cat", ids: [a.id], cat: cat.id, text: pickR(state, [
      `${cat.name} a dormi sur le clavier de ${a.name} : trois heures de travail en « jjjjjjjjjjjjj ».`,
      `${cat.name} a été élu délégué du personnel à l'unanimité (moins une voix : Bertrand).`,
      `${cat.name} s'est installé dans un carton de l'entrepôt et refuse d'en sortir.`,
      `${cat.name} a volé le jambon du sandwich de ${a.name}. Aucun remords.`,
      `${cat.name} a assisté à toute la réunion de direction. Il a été plus utile que Victor.`,
    ]) };
  },

  victor(state) {
    const victor = findAgent(state, "director");
    if (!victor) return null;
    const hr = state.agents.find((x) => x.role === "hr");
    return { icon: "👔", kind: "victor", ids: [victor.id, hr?.id].filter(Boolean), text: pickR(state, [
      hr ? `${victor.name} a glissé 14 papiers « Virer ${hr.name} » dans la boîte à suggestions.` : `${victor.name} a créé une boîte à suggestions. Elle ne contient que ses propres idées.`,
      `${victor.name} a organisé une réunion pour parler des réunions.`,
      `${victor.name} a renommé son mug « collègue de l'année ».`,
      `${victor.name} a fait une keynote de 40 minutes pour annoncer… le nouveau papier toilette.`,
    ]) };
  },
};

const BEAT_WEIGHTS = [["friends", 3], ["crush", 1.1], ["couple", 1], ["dispute", 0.7], ["rivalry", 0.9], ["peace", 0.8], ["incident", 1.3], ["intern", 1.2], ["cat", 1.5], ["victor", 0.8]];

export function lifeBeat(state, now) {
  initLife(state, now);
  const total = BEAT_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  for (let attempt = 0; attempt < 6; attempt++) {
    let r = rng(state) * total;
    let id = BEAT_WEIGHTS[0][0];
    for (const [beat, w] of BEAT_WEIGHTS) {
      r -= w;
      if (r <= 0) {
        id = beat;
        break;
      }
    }
    const result = state.agents.length > 1 ? BEATS[id](state, now) : null;
    if (result) {
      const { gag, cat, ...story } = result;
      const added = addStory(state, now, story);
      if (gag) added.gag = gag;
      if (cat) added.cat = cat;
      return added;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Chats du bureau

export function adoptCat(state, { name, coat }, now) {
  initLife(state, now);
  if (state.life.cats.length >= LIFE_LIMITS.cats) throw new OfficeError("Cinq chats, c'est le maximum autorisé par Bertrand (et par le règlement).");
  const clean = clampStr(name, 20);
  if (!clean) throw new OfficeError("Donne un nom au chat.");
  const cat = { id: lid(state, "cat"), name: clean, coat: CAT_COATS[coat] ? coat : pickR(state, Object.keys(CAT_COATS)), adoptedAt: now, fedAt: 0, pets: 0 };
  state.life.cats.push(cat);
  changeMood(state, 6);
  addStory(state, now, { icon: "🐈", kind: "cat", text: `Bienvenue à ${cat.name}, ${CAT_COATS[cat.coat].label}, adopté par l'entreprise ! Amandine a déjà acheté 4 coussins.`, ids: [] }).cat = cat.id;
  return cat;
}

function findCat(state, catId) {
  const cat = state.life?.cats.find((c) => c.id === catId);
  if (!cat) throw new OfficeError("Ce chat a disparu (il est sûrement dans un carton).");
  return cat;
}

export function renameCat(state, { catId, name }) {
  const cat = findCat(state, catId);
  const clean = clampStr(name, 20);
  if (!clean) throw new OfficeError("Nom vide.");
  cat.name = clean;
  return cat;
}

export function feedCat(state, { catId }, now) {
  const cat = findCat(state, catId);
  if (now - (cat.fedAt || 0) < 2 * HOUR) throw new OfficeError(`${cat.name} a déjà mangé. Il fait semblant d'avoir faim, ne te laisse pas avoir.`);
  cat.fedAt = now;
  changeMood(state, 2);
  return cat;
}

export function petCat(state, { catId }, now) {
  const cat = findCat(state, catId);
  cat.pets = (cat.pets || 0) + 1;
  cat.lastPetAt = now;
  return cat;
}

// ---------------------------------------------------------------------------
// Stagiaires : fin de stage et embauche

export function hireIntern(state, { agentId, role }, now) {
  const agent = findAgent(state, agentId);
  if (!agent || agent.role !== "intern") throw new OfficeError("Ce n'est pas un stagiaire.");
  const def = ROLES[role];
  if (!def || !def.hireable || ["intern", "manager"].includes(role)) throw new OfficeError("Choisis un vrai poste pour ce CDI.");
  agent.role = role;
  agent.dept = def.dept || agent.dept;
  agent.formerIntern = true;
  agent.cdiAt = now;
  agent.managerId = managerFor(state, agent.dept, agent.id);
  initLife(state, now);
  changeMood(state, 5);
  addStory(state, now, { icon: "🎓", kind: "cdi", ids: [agent.id], text: `${agent.name} décroche un CDI de ${def.label.toLowerCase()} ! Fin du stage, début de la gloire (et des tickets resto).` });
  log(state, now, agent.id, `${agent.name} passe de stagiaire à ${def.label.toLowerCase()} 🎓`, "🎓");
  return agent;
}

// ---------------------------------------------------------------------------
// Employé du mois : 3 nominés, des quêtes, une cérémonie

function eligible(state) {
  return state.agents.filter((a) => a.role !== "director");
}

function questBase(state, now, kind, nominee, extra) {
  return { id: lid(state, "q"), kind, nomineeId: nominee.id, createdAt: now, status: "open", resolvedAt: null, outcome: null, stars: 0, ...extra };
}

function mysteryQuest(state, now, nominee) {
  const others = shuffleR(state, eligible(state).filter((a) => a.id !== nominee.id));
  if (others.length < 6) return null;
  const [victim, x, y, z, w, w2] = others;
  const cleaner = state.agents.find((a) => a.role === "cleaner" && ![victim.id, x.id, y.id, z.id, w.id, nominee.id].includes(a.id));
  const witness2 = cleaner || w2;
  const places = shuffleR(state, PLACES);
  const [placeX, placeY, placeZ] = places;
  const incident = pickR(state, INCIDENTS);
  const cat = state.life.cats[0]?.name || "Pixel";
  const suspects = shuffleR(state, [x.id, y.id, z.id]);
  return questBase(state, now, "mystery", nominee, {
    title: `L'affaire ${incident.icon} — innocenter ${nominee.name}`,
    intro: `${fill(incident.text, { v: victim.name, cat })} Tout le monde accuse ${nominee.name}, qui jure n'y être pour rien. Interroge les témoins et démasque le vrai coupable.`,
    rule: "Une seule personne ment : c'est le coupable.",
    reward: 2,
    victimId: victim.id,
    suspects,
    statements: {
      [y.id]: `J'étais ${placeY} avec ${w.name}.`,
      [x.id]: `J'étais ${placeX} avec ${z.name} !`,
      [z.id]: `Moi ? J'étais ${placeZ}, sans personne avec moi.`,
    },
    clues: [
      { by: w.id, text: `Je confirme : ${y.name} était bien avec moi ${placeY}.` },
      { by: witness2.id, text: `J'ai vu ${z.name} ${placeZ} à ce moment-là, sans personne autour.` },
    ],
    cluesShown: 0,
    secret: { culpritId: x.id },
  });
}

function seekQuest(state, now, nominee) {
  const spot = pickR(state, HIDING_SPOTS);
  const witness = pickR(state, eligible(state).filter((a) => a.id !== nominee.id));
  const useCat = state.life.cats.length && rng(state) < 0.3;
  if (useCat) {
    const cat = pickR(state, state.life.cats);
    return questBase(state, now, "seek", nominee, {
      title: `Où est passé ${cat.name} ?`,
      intro: `${cat.name}, le chat du bureau, n'est pas venu réclamer ses croquettes et ${nominee.name} s'inquiète. ${witness?.name || "Quelqu'un"} a un indice : regarde ${spot.near}. Trouve-le dans les bureaux et touche-le.`,
      reward: 1,
      item: { id: "cat", emoji: "🐈", label: cat.name, catId: cat.id },
      spotId: spot.id,
      hint: spot.near,
    });
  }
  const item = pickR(state, SEEK_ITEMS);
  return questBase(state, now, "seek", nominee, {
    title: `${item.emoji} L'objet perdu de ${nominee.name}`,
    intro: `${nominee.name} a perdu ${item.label} juste avant un rendez-vous important. ${witness?.name || "Quelqu'un"} a un indice : regarde ${spot.near}. Trouve l'objet dans les bureaux et touche-le.`,
    reward: 1,
    item,
    spotId: spot.id,
    hint: spot.near,
  });
}

function mediationQuest(state, now, nominee) {
  const candidates = eligible(state).filter((a) => a.id !== nominee.id && (a.traits || []).some((t) => PEACE_OFFERS[t]));
  if (!candidates.length) return null;
  const other = pickR(state, candidates);
  const good = pickR(state, (other.traits || []).filter((t) => PEACE_OFFERS[t]));
  const wrong = shuffleR(state, Object.keys(PEACE_OFFERS).filter((t) => !(other.traits || []).includes(t))).slice(0, 2);
  const options = shuffleR(state, [good, ...wrong]).map((t) => ({ id: t, label: PEACE_OFFERS[t] }));
  const topic = pickR(state, QUARRELS);
  const prevKind = relationOf(state, nominee.id, other.id)?.kind || null;
  return questBase(state, now, "mediation", nominee, {
    prevKind,
    title: `Réconcilier ${nominee.name} et ${other.name}`,
    intro: `${nominee.name} et ${other.name} ne se parlent plus depuis l'affaire ${topic}. Pour se racheter, ${nominee.name} te demande conseil : qu'est-ce qui ferait plaisir à ${other.name} ?`,
    rule: `Indice : regarde le caractère de ${other.name}.`,
    reward: 1,
    otherId: other.id,
    profile: (other.traits || []).map((t) => TRAIT_LABELS[t] || t),
    options,
    secret: { answer: good },
  });
}

// La brouille devient réelle (sauf pour un couple : simple querelle d'amoureux).
function startQuarrel(state, now, quest) {
  if (quest.kind !== "mediation" || quest.prevKind === "couple") return;
  setRelation(state, quest.nomineeId, quest.otherId, "rival", now, { score: -20, note: "Brouille en cours de médiation." });
}

function quizQuestions(state) {
  const pool = shuffleR(state, eligible(state).filter((a) => a.role !== "manager"));
  const questions = [];
  const managers = state.agents.filter((a) => a.role === "manager" || a.role === "director");
  for (const agent of pool) {
    if (questions.length >= 3) break;
    const kind = ["manager", "dept", "role"][questions.length];
    let right;
    let wrongs;
    let question;
    if (kind === "manager") {
      const boss = findAgent(state, agent.managerId);
      if (!boss) continue;
      right = boss.name;
      wrongs = shuffleR(state, managers.filter((m) => m.id !== boss.id)).slice(0, 2).map((m) => m.name);
      question = `Qui est le ou la responsable de ${agent.name} ?`;
    } else if (kind === "dept") {
      right = DEPARTMENTS[agent.dept]?.label;
      wrongs = shuffleR(state, Object.values(DEPARTMENTS).filter((d) => d.id !== agent.dept)).slice(0, 2).map((d) => d.label);
      question = `Dans quel pôle travaille ${agent.name} ?`;
    } else {
      right = roleOf(agent).label;
      const other = [...new Set(state.agents.filter((a) => a.role !== agent.role).map((a) => roleOf(a).label))];
      wrongs = shuffleR(state, other).slice(0, 2);
      question = `Quel est le métier de ${agent.name} ?`;
    }
    if (!right || wrongs.length < 2) continue;
    const options = shuffleR(state, [right, ...wrongs]);
    questions.push({ question, options, answer: options.indexOf(right) });
  }
  return questions;
}

function quizQuest(state, now, nominee) {
  const questions = quizQuestions(state);
  if (questions.length < 3) return null;
  return questBase(state, now, "quiz", nominee, {
    title: `Le quiz du vendredi de ${nominee.name}`,
    intro: `${nominee.name} anime le quiz du vendredi sur l'entreprise. Si tu connais bien ton équipe, ${nominee.name} gagne des étoiles (2 bonnes réponses : ⭐, 3 : ⭐⭐).`,
    reward: 2,
    questions: questions.map(({ question, options }) => ({ question, options })),
    secret: { answers: questions.map((q) => q.answer) },
  });
}

function missionQuest(state, now, nominee) {
  const target = isIntern(nominee) ? 1 : 2;
  const type = roleOf(nominee).taskType;
  return questBase(state, now, "mission", nominee, {
    title: `${nominee.name} veut briller`,
    intro: `Pour prouver sa valeur, ${nominee.name} veut livrer ${target} mission${target > 1 ? "s" : ""} avant la cérémonie. Confie-lui du travail (${roleOf(nominee).label}) !`,
    reward: 2,
    target,
    taskType: type,
    progress: 0,
  });
}

export function startRound(state, now, { edition = null } = {}) {
  const pool = eligible(state);
  const key = monthKey(state, now);
  const previous = state.life.round;
  const sameMonth = previous?.key === key;
  if (pool.length < 7) {
    state.life.round = null;
    return null;
  }
  // Nominés : le plus productif, quelqu'un d'un autre pôle et un outsider (stagiaire de préférence).
  const byDone = shuffleR(state, pool).sort((a, b) => (b.stats?.done || 0) - (a.stats?.done || 0));
  const first = byDone[0];
  const second = pickR(state, pool.filter((a) => a.id !== first.id && a.dept !== first.dept)) || byDone[1];
  const outsiders = pool.filter((a) => ![first.id, second.id].includes(a.id) && (isIntern(a) || (a.stats?.done || 0) === 0));
  const third = outsiders.length ? pickR(state, outsiders) : byDone.find((a) => ![first.id, second.id].includes(a.id));
  const nominees = [first, second, third].filter(Boolean);

  const puzzles = shuffleR(state, ["mystery", "seek", rng(state) < 0.5 ? "mediation" : "quiz"]);
  const makers = { mystery: mysteryQuest, seek: seekQuest, mediation: mediationQuest, quiz: quizQuest };
  const quests = [];
  nominees.forEach((nominee, i) => {
    const puzzle = makers[puzzles[i]](state, now, nominee) || seekQuest(state, now, nominee);
    startQuarrel(state, now, puzzle);
    quests.push(puzzle, missionQuest(state, now, nominee));
  });

  const round = {
    id: lid(state, "rd"),
    key,
    edition: edition ?? (sameMonth ? (previous.edition || 1) + 1 : 1),
    startedAt: now,
    nominees: nominees.map((a) => a.id),
    stars: Object.fromEntries(nominees.map((a) => [a.id, 0])),
    quests,
    ceremonyAt: null,
    winnerId: null,
  };
  state.life.round = round;
  const victor = findAgent(state, "director");
  addStory(state, now, {
    icon: "🏆",
    kind: "round",
    ids: round.nominees,
    text: `Élection de l'employé du mois (${monthLabel(key)}${round.edition > 1 ? `, édition ${round.edition}` : ""}) : ${nominees.map((a) => a.name).join(", ")} sont nominés.${victor ? ` ${victor.name} s'est auto-nominé ; candidature refusée par les RH.` : ""}`,
  });
  return round;
}

function findQuest(state, questId) {
  const quest = state.life?.round?.quests.find((q) => q.id === questId);
  if (!quest) throw new OfficeError("Quête introuvable.");
  if (quest.status !== "open") throw new OfficeError("Cette quête est déjà terminée.");
  if (state.life.round.winnerId) throw new OfficeError("La cérémonie a déjà eu lieu.");
  return quest;
}

function resolve(state, quest, now, { success, stars = success ? quest.reward : 0, message }) {
  quest.status = success ? "solved" : "failed";
  quest.resolvedAt = now;
  quest.stars = stars;
  quest.outcome = message;
  const round = state.life.round;
  round.stars[quest.nomineeId] = (round.stars[quest.nomineeId] || 0) + stars;
  changeMood(state, success ? 4 : -1);
  const nominee = findAgent(state, quest.nomineeId);
  addStory(state, now, {
    icon: success ? "⭐" : "😬",
    kind: "quest",
    ids: [quest.nomineeId],
    text: success ? `Quête réussie : « ${quest.title} ». ${nominee?.name || "Le nominé"} gagne ${"⭐".repeat(stars) || "0 étoile"}.` : `Quête ratée : « ${quest.title} ». ${nominee?.name || "Le nominé"} fait la moue.`,
  });
  return { success, stars, message, quest, public: { success, stars, message } };
}

// Le patron révèle l'indice suivant d'une enquête.
export function revealClue(state, { questId }) {
  const quest = findQuest(state, questId);
  if (quest.kind !== "mystery") throw new OfficeError("Pas d'indice pour cette quête.");
  quest.cluesShown = Math.min(quest.clues.length, (quest.cluesShown || 0) + 1);
  const clue = quest.clues[quest.cluesShown - 1];
  return { ...clue, public: clue };
}

export function solveQuest(state, { questId, answer }, now) {
  const quest = findQuest(state, questId);
  const name = (id) => nameOf(state, id);
  switch (quest.kind) {
    case "mystery": {
      if (!quest.suspects.includes(answer)) throw new OfficeError("Choisis l'un des suspects.");
      const culprit = quest.secret.culpritId;
      const ok = answer === culprit;
      if (ok) {
        const rel = relationOf(state, culprit, quest.victimId);
        if (!rel) setRelation(state, culprit, quest.victimId, "rival", now, { score: -20, note: "Depuis « l'affaire »." });
      }
      return resolve(state, quest, now, {
        success: ok,
        message: ok
          ? `Bien joué ! ${name(culprit)} avoue tout (et promet de ne plus recommencer, en croisant les doigts dans le dos). ${name(quest.nomineeId)} est innocenté.`
          : `C'était ${name(culprit)} ! Ses déclarations ne tenaient pas debout. ${name(answer)} est vexé·e pour la semaine.`,
      });
    }
    case "seek": {
      if (answer !== quest.spotId) throw new OfficeError("Ce n'est pas ici… continue de chercher !");
      return resolve(state, quest, now, { success: true, message: quest.item.id === "cat" ? `Tu as retrouvé ${quest.item.label} ! Il ronronnait tranquillement ${quest.hint}.` : `Trouvé ! ${name(quest.nomineeId)} te remercie mille fois.` });
    }
    case "mediation": {
      const option = quest.options.find((o) => o.id === answer);
      if (!option) throw new OfficeError("Choisis une proposition.");
      const ok = answer === quest.secret.answer;
      if (ok) setRelation(state, quest.nomineeId, quest.otherId, ["couple", "bff"].includes(quest.prevKind) ? quest.prevKind : "ami", now, { score: 60, note: "Réconciliés grâce au patron." });
      return resolve(state, quest, now, {
        success: ok,
        message: ok
          ? `Parfait : ${name(quest.otherId)} adore l'idée. Ils sont à nouveau potes !`
          : `Bof… ${name(quest.otherId)} n'a pas été convaincu·e. Il fallait penser à : ${PEACE_OFFERS[quest.secret.answer]}`,
      });
    }
    case "quiz": {
      const answers = Array.isArray(answer) ? answer.map(Number) : [];
      if (answers.length !== quest.questions.length) throw new OfficeError("Réponds à toutes les questions.");
      const good = answers.filter((a, i) => a === quest.secret.answers[i]).length;
      const stars = good >= 3 ? 2 : good === 2 ? 1 : 0;
      quest.correct = good;
      return resolve(state, quest, now, {
        success: stars > 0,
        stars,
        message: `${good}/3 bonnes réponses. ${good === 3 ? "Tu connais ton équipe par cœur !" : good === 2 ? "Pas mal du tout." : "Il va falloir passer plus de temps à la machine à café."}`,
      });
    }
    case "mission": {
      if ((quest.progress || 0) < quest.target) throw new OfficeError(`Encore ${quest.target - (quest.progress || 0)} mission(s) à livrer par ${name(quest.nomineeId)}.`);
      return resolve(state, quest, now, { success: true, message: `${name(quest.nomineeId)} a tout livré. Respect.` });
    }
    default:
      throw new OfficeError("Quête inconnue.");
  }
}

export function canHoldCeremony(state, now) {
  const round = state.life?.round;
  if (!round || round.winnerId) return false;
  const resolved = round.quests.filter((q) => q.status !== "open").length;
  return resolved >= 3 || monthKey(state, now) !== round.key;
}

export function holdCeremony(state, now, { auto = false } = {}) {
  const round = state.life?.round;
  if (!round) throw new OfficeError("Aucune élection en cours.");
  if (round.winnerId) throw new OfficeError("La cérémonie a déjà eu lieu.");
  if (!auto && !canHoldCeremony(state, now)) throw new OfficeError("Termine au moins 3 quêtes avant la cérémonie.");
  const nominees = round.nominees.map((id) => findAgent(state, id)).filter(Boolean);
  if (!nominees.length) throw new OfficeError("Plus aucun nominé n'est dans l'entreprise.");
  nominees.sort((a, b) => (round.stars[b.id] || 0) - (round.stars[a.id] || 0) || (b.stats?.done || 0) - (a.stats?.done || 0));
  const winner = nominees[0];
  round.winnerId = winner.id;
  round.ceremonyAt = now;
  winner.stats.eotm = (winner.stats.eotm || 0) + 1;
  state.life.hall.unshift({ key: round.key, edition: round.edition, agentId: winner.id, name: winner.name, stars: round.stars[winner.id] || 0, at: now });
  if (state.life.hall.length > LIFE_LIMITS.hall) state.life.hall.length = LIFE_LIMITS.hall;
  changeMood(state, 10);
  addStory(state, now, {
    icon: "🏆",
    kind: "ceremony",
    ids: [winner.id],
    text: `${winner.name} remporte le titre d'employé du mois (${monthLabel(round.key)}) avec ${round.stars[winner.id] || 0} ⭐ ! Discours en larmes, Victor pleure aussi.`,
  });
  log(state, now, winner.id, `🏆 ${winner.name} est élu·e employé·e du mois !`, "🏆");
  const result = { winnerId: winner.id, name: winner.name, stars: round.stars[winner.id] || 0 };
  return { ...result, public: result };
}

export function nextRound(state, now) {
  const round = state.life?.round;
  if (round && !round.winnerId) throw new OfficeError("L'élection en cours n'est pas terminée.");
  const created = startRound(state, now);
  if (!created) throw new OfficeError("Il faut au moins 8 employés pour organiser l'élection.");
  return created;
}

export function eotmOf(state) {
  return state.life?.hall?.[0] || null;
}

// ---------------------------------------------------------------------------
// Horloge de la vie sociale (appelée par advance)

export function advanceLife(state, now) {
  let changed = false;
  if (!state.life || state.life.version !== 1) {
    initLife(state, now);
    changed = true;
  }
  const life = state.life;

  // Missions des nominés : progression et validation automatiques.
  const round = life.round;
  if (round && !round.winnerId) {
    for (const quest of round.quests) {
      if (quest.kind !== "mission" || quest.status !== "open") continue;
      const done = state.tasks.filter((t) => t.agentId === quest.nomineeId && t.status === "done" && (t.finishedAt || 0) >= quest.createdAt).length;
      if (done !== quest.progress) {
        quest.progress = Math.min(done, quest.target);
        changed = true;
      }
      if (quest.progress >= quest.target) {
        solveQuest(state, { questId: quest.id }, now);
        changed = true;
      }
    }
  }

  // Changement de mois : cérémonie automatique puis nouvelle élection.
  if (round && round.key !== monthKey(state, now)) {
    if (!round.winnerId && Object.values(round.stars).some((s) => s > 0)) {
      try {
        holdCeremony(state, now, { auto: true });
      } catch {
        // plus de nominé disponible : on passe à la suite
      }
    }
    startRound(state, now);
    changed = true;
  } else if (!round && eligible(state).length >= 7) {
    startRound(state, now);
    changed = true;
  }

  // Anniversaires (une fois par jour, heure locale du patron).
  const today = localDate(state, now);
  if (life.lastDay !== today.dayKey) {
    life.lastDay = today.dayKey;
    for (const agent of state.agents) {
      const b = birthdayOf(agent);
      if (b.month === today.m && b.day === today.d) {
        changeMood(state, 3);
        addStory(state, now, { icon: "🎂", kind: "birthday", ids: [agent.id], text: `C'est l'anniversaire de ${agent.name} aujourd'hui ! Gâteau en salle de conf' à 16 h (Bruno a déjà goûté).` });
      }
    }
    changed = true;
  }

  // Potins réguliers.
  if (now >= (life.nextStoryAt || 0)) {
    lifeBeat(state, now);
    life.nextStoryAt = now + (2 + rng(state) * 3) * HOUR;
    changed = true;
  }
  return changed;
}

// Vue client : on masque les solutions des quêtes.
export function lifeForClient(life) {
  if (!life) return life;
  const round = life.round
    ? { ...life.round, quests: life.round.quests.map(({ secret, ...q }) => (q.status === "open" ? q : { ...q, solution: secret })) }
    : null;
  return { ...life, round };
}
