// Définitions statiques du QG : pièces, rôles des agents, équipe de départ.
// Module partagé entre le serveur (Node) et la mini app (navigateur) : aucune dépendance.

export const ROOMS = {
  director: { id: "director", name: "Bureau du Directeur", short: "Direction", icon: "👔", color: "#e0b354" },
  meeting: { id: "meeting", name: "Salle de réunion", short: "Réunion", icon: "🗒️", color: "#5aa9e6" },
  library: { id: "library", name: "Bibliothèque", short: "Biblio", icon: "📚", color: "#c08552" },
  reception: { id: "reception", name: "Secrétariat", short: "Planning", icon: "📅", color: "#ef7fa6" },
  studio: { id: "studio", name: "Studio Web", short: "Studio", icon: "🌐", color: "#8b6cff" },
  openspace: { id: "openspace", name: "Open space", short: "Équipes", icon: "🏢", color: "#4cc38a" },
  lounge: { id: "lounge", name: "Cafétéria", short: "Journal", icon: "☕", color: "#d39461" },
};

export const DEPARTMENTS = {
  production: { id: "production", label: "Pôle Production", icon: "🛠️" },
  organisation: { id: "organisation", label: "Pôle Organisation", icon: "🗂️" },
};

export const TASK_TYPES = {
  site: { label: "Site web", icon: "🌐", durationMs: 45000 },
  storage: { label: "Rangement & archives", icon: "📚", durationMs: 22000 },
  planning: { label: "Planning", icon: "📅", durationMs: 16000 },
  notes: { label: "Prise de notes", icon: "🗒️", durationMs: 20000 },
  decision: { label: "Dossier important", icon: "📌", durationMs: 26000 },
  report: { label: "Rapport d'équipe", icon: "📋", durationMs: 18000 },
  content: { label: "Rédaction", icon: "✍️", durationMs: 24000 },
  general: { label: "Mission", icon: "🧠", durationMs: 22000 },
};

export const PRIORITIES = {
  basse: { label: "Basse", rank: 0, icon: "▫️" },
  normale: { label: "Normale", rank: 1, icon: "🔹" },
  haute: { label: "Haute", rank: 2, icon: "🔶" },
  critique: { label: "Critique", rank: 3, icon: "🔴" },
};

export const DOC_KINDS = {
  site: { label: "Site web", icon: "🌐" },
  report: { label: "Rapport", icon: "📊" },
  note: { label: "Note", icon: "🗒️" },
  minutes: { label: "Compte rendu", icon: "📝" },
  memo: { label: "Note de décision", icon: "📌" },
  brief: { label: "Brief direction", icon: "🧭" },
  content: { label: "Contenu", icon: "✍️" },
  file: { label: "Fichier", icon: "📄" },
  link: { label: "Lien", icon: "🔗" },
};

// Chaque rôle : pièce d'attache, type de mission par défaut, pôle, tenue (pour le rendu 3D).
export const ROLES = {
  director: {
    label: "Directeur général",
    room: "director",
    taskType: "decision",
    dept: null,
    icon: "👔",
    hireable: false,
    accessory: "tie",
    skills: "Arbitre, priorise et prépare les décisions importantes. Rédige le brief de direction.",
  },
  manager: {
    label: "Manager",
    room: "openspace",
    taskType: "report",
    dept: null,
    icon: "📋",
    hireable: true,
    accessory: "clipboard",
    skills: "Encadre son pôle, répartit la charge et fait des rapports d'équipe.",
  },
  webdev: {
    label: "Architecte web",
    room: "studio",
    taskType: "site",
    dept: "production",
    icon: "🌐",
    hireable: true,
    accessory: "headphones",
    skills: "Conçoit et code des sites complets (landing page, vitrine, portfolio…).",
  },
  librarian: {
    label: "Bibliothécaire",
    room: "library",
    taskType: "storage",
    dept: "organisation",
    icon: "📚",
    hireable: true,
    accessory: "glasses",
    skills: "Range, classe, retrouve et fait l'inventaire de tous les documents stockés.",
  },
  secretary: {
    label: "Secrétaire de direction",
    room: "reception",
    taskType: "planning",
    dept: "organisation",
    icon: "📅",
    hireable: true,
    accessory: "headset",
    skills: "Tient l'agenda, planifie les rendez-vous et envoie les rappels.",
  },
  scribe: {
    label: "Greffier (prise de notes)",
    room: "meeting",
    taskType: "notes",
    dept: "organisation",
    icon: "🗒️",
    hireable: true,
    accessory: "notepad",
    skills: "Prend les notes en réunion, rédige comptes rendus et synthèses.",
  },
  writer: {
    label: "Rédacteur·rice",
    room: "openspace",
    taskType: "content",
    dept: "production",
    icon: "✍️",
    hireable: true,
    accessory: "pen",
    skills: "Écrit articles, posts, newsletters et textes de sites.",
  },
  analyst: {
    label: "Chargé·e de mission",
    room: "openspace",
    taskType: "general",
    dept: "production",
    icon: "🧠",
    hireable: true,
    accessory: "none",
    skills: "Polyvalent : recherches, analyses, plans d'action.",
  },
};

export const DEFAULT_AGENTS = [
  {
    id: "director",
    name: "Victor",
    role: "director",
    look: { skin: "#e8b796", hair: "#3b3b3b", hairStyle: "short", shirt: "#23263a", pants: "#1a1b26" },
  },
  {
    id: "mgr-prod",
    name: "Manon",
    role: "manager",
    dept: "production",
    look: { skin: "#f1c6a5", hair: "#7a3e1d", hairStyle: "bun", shirt: "#2f8f6b", pants: "#2b2f3a" },
  },
  {
    id: "mgr-orga",
    name: "Hugo",
    role: "manager",
    dept: "organisation",
    look: { skin: "#c68d6a", hair: "#1f1a17", hairStyle: "short", shirt: "#3d6fb6", pants: "#2b2f3a" },
  },
  {
    id: "webdev",
    name: "Léo",
    role: "webdev",
    look: { skin: "#f0c9a8", hair: "#e0b04a", hairStyle: "spiky", shirt: "#7353e8", pants: "#33364a" },
  },
  {
    id: "librarian",
    name: "Iris",
    role: "librarian",
    look: { skin: "#a8735a", hair: "#2a1a12", hairStyle: "long", shirt: "#b8743f", pants: "#3a3229" },
  },
  {
    id: "secretary",
    name: "Clara",
    role: "secretary",
    look: { skin: "#f3d0b5", hair: "#b5452f", hairStyle: "long", shirt: "#e46b97", pants: "#2e2a3a" },
  },
  {
    id: "scribe",
    name: "Noé",
    role: "scribe",
    look: { skin: "#d9a882", hair: "#5a4632", hairStyle: "curly", shirt: "#3aa0d8", pants: "#30343f" },
  },
];

export const HIRE_LOOKS = {
  skin: ["#f3d0b5", "#e8b796", "#d9a882", "#c68d6a", "#a8735a", "#7d513b"],
  hair: ["#1f1a17", "#3b2a20", "#7a3e1d", "#b5452f", "#e0b04a", "#9aa0a6", "#2d3e8f"],
  hairStyle: ["short", "long", "bun", "curly", "spiky", "bald"],
  shirt: ["#ef8354", "#4cc38a", "#5aa9e6", "#f2c14e", "#9b5de5", "#f15bb5", "#00bbf9", "#e76f51"],
  pants: ["#2b2f3a", "#33364a", "#3a3229", "#1d3557", "#30343f"],
};

export function roleOf(agent) {
  return ROLES[agent?.role] || ROLES.analyst;
}
