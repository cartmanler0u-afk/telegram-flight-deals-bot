// Définitions statiques de l'entreprise : pièces, pôles, rôles, équipe de départ.
// Module partagé entre le serveur (Node) et la mini app (navigateur) : aucune dépendance.

// Zones de l'étage en 3D. `panel` = tableau de bord ouvert quand on touche la zone.
export const ROOMS = {
  director: { id: "director", name: "Bureau du Directeur", icon: "👔", color: "#e0b354", panel: "director" },
  meeting: { id: "meeting", name: "Salle de conférence", icon: "🗒️", color: "#5aa9e6", panel: "meeting" },
  library: { id: "library", name: "Archives", icon: "📚", color: "#c08552", panel: "library" },
  studio: { id: "studio", name: "Studio Web & Tech", tag: "Studio Web", icon: "🌐", color: "#8b6cff", panel: "studio" },
  montage: { id: "montage", name: "Studio Montage", tag: "Montage", icon: "🎬", color: "#ff5c8a", panel: "social" },
  createurs: { id: "createurs", name: "Pôle Créateurs", tag: "Créateurs", icon: "💎", color: "#c77dff", panel: "createurs" },
  kitchen: { id: "kitchen", name: "Cuisine", icon: "🍕", color: "#f4a259", panel: "kitchen" },
  annexe: { id: "annexe", name: "Annexe", icon: "🧾", color: "#9aa5b1", panel: "annexe" },
  reception: { id: "reception", name: "Accueil", icon: "📅", color: "#ef7fa6", panel: "reception" },
  photo: { id: "photo", name: "Studio Photo", icon: "📸", color: "#4cc9f0", panel: "vente" },
  warehouse: { id: "warehouse", name: "Entrepôt", icon: "📦", color: "#c8a165", panel: "vente" },
  marketing: { id: "marketing", name: "Studio Marketing", tag: "Marketing", icon: "🎨", color: "#ff8a5b", panel: "marketing" },
  legal: { id: "legal", name: "Juridique & Admin", tag: "Juridique", icon: "⚖️", color: "#8fa3bf", panel: "legal" },
  lounge: { id: "lounge", name: "Salle de repos & chats", tag: "Salle de repos", icon: "🐈", color: "#ffb4a2", panel: "lounge" },
  gym: { id: "gym", name: "Salle de sport", icon: "🏋️", color: "#57cc99", panel: "lounge" },
  hr: { id: "hr", name: "Bureau RH", icon: "🤝", color: "#f28482", panel: "rh" },
  openspace: { id: "openspace", name: "Plateau", icon: "🏢", color: "#4cc38a", panel: "openspace" },
};

// Tableaux de bord (dock en bas de l'écran), dans l'ordre d'affichage.
export const PANELS = {
  director: { id: "director", name: "Bureau du Directeur", short: "Direction", icon: "👔", color: "#e0b354", area: "director" },
  vente: { id: "vente", name: "Pôle Vente", short: "Vente", icon: "🛍️", color: "#ff9f1c", dept: "vente", area: "warehouse" },
  sourcing: { id: "sourcing", name: "Sourcing & Bons plans", short: "Bons plans", icon: "🔎", color: "#2ec4b6", dept: "sourcing" },
  social: { id: "social", name: "Social & Contenu", short: "Social", icon: "📱", color: "#ff5c8a", dept: "social", area: "montage" },
  studio: { id: "studio", name: "Studio Web & Tech", short: "Web", icon: "🌐", color: "#8b6cff", dept: "tech", area: "studio" },
  createurs: { id: "createurs", name: "Pôle Créateurs", short: "Créateurs", icon: "💎", color: "#c77dff", dept: "createurs", area: "createurs" },
  marketing: { id: "marketing", name: "Marketing & Création", short: "Marketing", icon: "🎨", color: "#ff8a5b", dept: "marketing", area: "marketing" },
  legal: { id: "legal", name: "Juridique & Admin", short: "Juridique", icon: "⚖️", color: "#8fa3bf", dept: "juridique", area: "legal" },
  library: { id: "library", name: "Archives & Bibliothèque", short: "Archives", icon: "📚", color: "#c08552", area: "library" },
  reception: { id: "reception", name: "Accueil & Planning", short: "Planning", icon: "📅", color: "#ef7fa6", area: "reception" },
  meeting: { id: "meeting", name: "Salle de conférence", short: "Réunion", icon: "🗒️", color: "#5aa9e6", area: "meeting" },
  quests: { id: "quests", name: "Employé du mois", short: "Quêtes", icon: "🏆", color: "#f7c948", area: "hr" },
  rh: { id: "rh", name: "RH & Vie d'équipe", short: "RH", icon: "🤝", color: "#f28482", dept: "rh", area: "hr" },
  lounge: { id: "lounge", name: "Salle de repos & chats", short: "Repos", icon: "🐈", color: "#ffb4a2", area: "lounge" },
  kitchen: { id: "kitchen", name: "Cuisine & vie de bureau", short: "Cuisine", icon: "🍕", color: "#f4a259", area: "kitchen" },
  annexe: { id: "annexe", name: "Annexe — Compta & Entretien", short: "Annexe", icon: "🧾", color: "#9aa5b1", area: "annexe" },
  openspace: { id: "openspace", name: "Plateau & Équipes", short: "Équipes", icon: "👥", color: "#4cc38a", area: "openspace" },
  madhouse: { id: "madhouse", name: "Bâtiment 0 — The Madhouse", short: "Bâtiment", icon: "🏚️", color: "#6c5ce7" },
};

export const DEPARTMENTS = {
  direction: { id: "direction", label: "Direction", icon: "👔", color: "#e0b354", summary: "Le directeur, son adjoint et les missions transverses." },
  vente: { id: "vente", label: "Pôle Vente", icon: "🛍️", color: "#ff9f1c", summary: "Vinted, photos produit, expéditions et service client." },
  sourcing: { id: "sourcing", label: "Sourcing & Bons plans", icon: "🔎", color: "#2ec4b6", summary: "Trouver la marchandise et dénicher les bons plans avant tout le monde." },
  social: { id: "social", label: "Social & Contenu", icon: "📱", color: "#ff5c8a", summary: "Snapchat, canaux Telegram, montage TikTok et rédaction." },
  tech: { id: "tech", label: "Web & Tech", icon: "🌐", color: "#8b6cff", summary: "Sites web, bots et automatisations." },
  createurs: { id: "createurs", label: "Pôle Créateurs (OFM)", icon: "💎", color: "#c77dff", summary: "Gestion de créatrices et créateurs de contenu — lancement en préparation." },
  marketing: { id: "marketing", label: "Marketing & Création", icon: "🎨", color: "#ff8a5b", summary: "Visuels, publicité, croissance et chiffres : faire connaître et vendre plus." },
  juridique: { id: "juridique", label: "Juridique & Admin", icon: "⚖️", color: "#8fa3bf", summary: "Statuts, CGV, contrats, démarches : être carré et dormir tranquille." },
  rh: { id: "rh", label: "RH & Vie d'équipe", icon: "🤝", color: "#f28482", summary: "Recrutement, stagiaires, ambiance, chats… et élection de l'employé du mois." },
  organisation: { id: "organisation", label: "Organisation", icon: "🗂️", color: "#4cc38a", summary: "Accueil, planning, archives, comptes rendus, compta et entretien." },
};

export const TASK_TYPES = {
  site: { label: "Site web", icon: "🌐", durationMs: 45000 },
  automation: { label: "Automatisation", icon: "🤖", durationMs: 34000 },
  storage: { label: "Archives", icon: "📚", durationMs: 22000 },
  planning: { label: "Planning", icon: "📅", durationMs: 16000 },
  notes: { label: "Prise de notes", icon: "🗒️", durationMs: 20000 },
  decision: { label: "Dossier important", icon: "📌", durationMs: 26000 },
  report: { label: "Rapport d'équipe", icon: "📋", durationMs: 18000 },
  process: { label: "Process & organisation", icon: "🫡", durationMs: 22000 },
  finance: { label: "Finance", icon: "🧮", durationMs: 24000 },
  cleaning: { label: "Ménage", icon: "🧹", durationMs: 14000 },
  listing: { label: "Annonce Vinted", icon: "🏷️", durationMs: 18000 },
  shooting: { label: "Shooting produit", icon: "📸", durationMs: 18000 },
  logistics: { label: "Expédition", icon: "📦", durationMs: 18000 },
  support: { label: "Service client", icon: "🎧", durationMs: 16000 },
  sourcing: { label: "Sourcing", icon: "🧭", durationMs: 26000 },
  dealhunt: { label: "Chasse aux bons plans", icon: "🔎", durationMs: 30000 },
  social: { label: "Snapchat", icon: "👻", durationMs: 22000 },
  channel: { label: "Canal Telegram", icon: "✈️", durationMs: 20000 },
  video: { label: "Vidéo TikTok", icon: "🎬", durationMs: 30000 },
  content: { label: "Rédaction", icon: "✍️", durationMs: 24000 },
  talent: { label: "Pôle Créateurs", icon: "💎", durationMs: 26000 },
  design: { label: "Visuel & DA", icon: "🎨", durationMs: 26000 },
  ads: { label: "Campagne pub", icon: "📈", durationMs: 26000 },
  data: { label: "Analyse data", icon: "📊", durationMs: 24000 },
  legal: { label: "Juridique", icon: "⚖️", durationMs: 28000 },
  admin: { label: "Administratif", icon: "🗂️", durationMs: 20000 },
  hr: { label: "RH & recrutement", icon: "🤝", durationMs: 22000 },
  events: { label: "Vie d'équipe", icon: "🎈", durationMs: 18000 },
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
  listing: { label: "Annonce", icon: "🏷️" },
  video: { label: "Plan de montage", icon: "🎬" },
  deals: { label: "Bons plans", icon: "🔎" },
  finance: { label: "Finance", icon: "🧮" },
  code: { label: "Script", icon: "🤖" },
  visual: { label: "Brief visuel", icon: "🎨" },
  campaign: { label: "Campagne pub", icon: "📈" },
  dashboard: { label: "Tableau de bord", icon: "📊" },
  legal: { label: "Juridique", icon: "⚖️" },
  hr: { label: "RH", icon: "🤝" },
  file: { label: "Fichier", icon: "📄" },
  link: { label: "Lien", icon: "🔗" },
};

// Chaque rôle : type de mission par défaut, pôle, accessoire 3D et compétences.
export const ROLES = {
  director: { label: "Directeur général", taskType: "decision", dept: "direction", icon: "👔", hireable: false, accessory: "tie", skills: "Arbitre, priorise et prépare les décisions importantes. Rédige le brief de direction." },
  deputy: { label: "Directeur adjoint", taskType: "process", dept: "direction", icon: "🫡", hireable: true, accessory: "tie", skills: "Process, procédures, checklists et discipline opérationnelle. Prend son rôle (très) au sérieux." },
  manager: { label: "Manager", taskType: "report", dept: null, icon: "📋", hireable: true, accessory: "clipboard", skills: "Encadre son pôle, répartit la charge et fait des rapports d'équipe." },
  analyst: { label: "Chargé·e de mission", taskType: "general", dept: "direction", icon: "🧠", hireable: true, accessory: "none", skills: "Polyvalent : recherches, analyses, plans d'action." },
  vinted: { label: "Vendeur·se Vinted", taskType: "listing", dept: "vente", icon: "🏷️", hireable: true, accessory: "phone", skills: "Annonces Vinted qui vendent : titres, descriptions, prix, négociation, relances." },
  photographer: { label: "Photographe produit", taskType: "shooting", dept: "vente", icon: "📸", hireable: true, accessory: "camera-neck", skills: "Plans de shooting, lumière, angles et retouches pour des annonces qui claquent." },
  logistics: { label: "Logistique & expéditions", taskType: "logistics", dept: "vente", icon: "📦", hireable: true, accessory: "cap", skills: "Emballage, transporteurs, suivi des colis et litiges de livraison." },
  support: { label: "SAV & relation client", taskType: "support", dept: "vente", icon: "🎧", hireable: true, accessory: "headset", skills: "Réponses aux acheteurs, litiges, retours et avis." },
  sourcer: { label: "Sourceur·se", taskType: "sourcing", dept: "sourcing", icon: "🧭", hireable: true, accessory: "glasses", skills: "Fournisseurs, grossistes, friperies, lots : trouve la marchandise et calcule la marge." },
  dealhunter: { label: "Dénicheur·se de bons plans", taskType: "dealhunt", dept: "sourcing", icon: "🔎", hireable: true, accessory: "cap", skills: "Repère promos, erreurs de prix, vols pas chers et pépites à revendre." },
  snap: { label: "Community manager Snapchat", taskType: "social", dept: "social", icon: "👻", hireable: true, accessory: "phone", skills: "Stories, Spotlight, scripts et croissance de l'audience Snapchat." },
  telegram: { label: "Community manager Telegram", taskType: "channel", dept: "social", icon: "✈️", hireable: true, accessory: "phone", skills: "Canaux et groupes Telegram : posts, drops, annonces et engagement." },
  tiktok: { label: "Monteur·se TikTok", taskType: "video", dept: "social", icon: "🎬", hireable: true, accessory: "headphones", skills: "Scripts, hooks, découpage plan par plan et montage de vidéos courtes." },
  writer: { label: "Rédacteur·rice", taskType: "content", dept: "social", icon: "✍️", hireable: true, accessory: "pen", skills: "Textes, posts, newsletters et descriptions qui donnent envie." },
  webdev: { label: "Architecte web", taskType: "site", dept: "tech", icon: "🌐", hireable: true, accessory: "headphones", skills: "Conçoit et code des sites complets (landing page, vitrine, boutique…)." },
  automation: { label: "Dev automatisation & bots", taskType: "automation", dept: "tech", icon: "🤖", hireable: true, accessory: "headphones", skills: "Bots Telegram, scripts, automatisations et intégrations." },
  talent: { label: "Talent manager", taskType: "talent", dept: "createurs", icon: "💎", hireable: true, accessory: "clipboard", skills: "Prépare le lancement du pôle créateurs : stratégie, recrutement, planning de contenu." },
  secretary: { label: "Accueil & planning", taskType: "planning", dept: "organisation", icon: "📅", hireable: true, accessory: "headset", skills: "Tient l'agenda, planifie les rendez-vous et envoie les rappels." },
  librarian: { label: "Archiviste", taskType: "storage", dept: "organisation", icon: "📚", hireable: true, accessory: "glasses", skills: "Range, classe, retrouve et fait l'inventaire de tous les documents." },
  scribe: { label: "Greffier (prise de notes)", taskType: "notes", dept: "organisation", icon: "🗒️", hireable: true, accessory: "notepad", skills: "Prend les notes en réunion, rédige comptes rendus et synthèses." },
  accountant: { label: "Comptable", taskType: "finance", dept: "organisation", icon: "🧮", hireable: true, accessory: "glasses", skills: "Marges, chiffre d'affaires, frais, budget et trésorerie." },
  cleaner: { label: "Agent d'entretien", taskType: "cleaning", dept: "organisation", icon: "🧹", hireable: true, accessory: "mop", skills: "Fait le ménage du QG : vide la corbeille, archive le vieux journal, nettoie le cache." },
  designer: { label: "Graphiste & DA", taskType: "design", dept: "marketing", icon: "🎨", hireable: true, accessory: "pen", skills: "Logos, miniatures, bannières, visuels de pub et chartes graphiques : des briefs visuels précis, prêts à produire." },
  growth: { label: "Growth & publicité", taskType: "ads", dept: "marketing", icon: "📈", hireable: true, accessory: "phone", skills: "Campagnes Meta, TikTok et Snap Ads : ciblage, budgets, accroches, tests A/B et tunnels de vente." },
  data: { label: "Analyste data", taskType: "data", dept: "marketing", icon: "📊", hireable: true, accessory: "glasses", skills: "Tableaux de bord, indicateurs de ventes et de réseaux, analyses de performance et prévisions." },
  lawyer: { label: "Juriste", taskType: "legal", dept: "juridique", icon: "⚖️", hireable: true, accessory: "tie", skills: "Statuts, CGV, mentions légales, RGPD, contrats et propriété intellectuelle. Signale toujours ce qui doit être validé par un pro." },
  admin: { label: "Assistant·e administratif·ve", taskType: "admin", dept: "juridique", icon: "🗂️", hireable: true, accessory: "notepad", skills: "Démarches (URSSAF, impôts, banque, assurances), courriers, relances et classement administratif." },
  hr: { label: "Responsable RH", taskType: "hr", dept: "rh", icon: "🤝", hireable: true, accessory: "clipboard", skills: "Fiches de poste, recrutement de freelances, intégration des stagiaires, entretiens et médiation." },
  happiness: { label: "Chief Happiness Officer", taskType: "events", dept: "rh", icon: "🎈", hireable: true, accessory: "none", skills: "Ambiance, événements d'équipe, bien-être… et responsable officielle des chats du bureau." },
  intern: { label: "Stagiaire", taskType: "general", dept: "organisation", icon: "🧃", hireable: true, accessory: "cap", skills: "Petites missions, recherches, cafés. Enthousiasme illimité, expérience limitée." },
};

const look = (skin, hair, hairStyle, shirt, pants) => ({ skin, hair, hairStyle, shirt, pants });

// Équipe de départ. Les `traits` pilotent la vie de bureau (blagues, pauses, Uber Eats…).
export const DEFAULT_AGENTS = [
  { id: "director", name: "Victor", role: "director", traits: ["boss", "showoff"], look: look("#e8b796", "#3b3b3b", "short", "#23263a", "#1a1b26") },
  { id: "deputy", name: "Bertrand", role: "deputy", traits: ["zealous", "target"], look: look("#f0c9a8", "#5a3b22", "short", "#c9a227", "#3b3221") },
  { id: "mgr-orga", name: "Hugo", role: "manager", dept: "organisation", traits: ["calm"], look: look("#c68d6a", "#1f1a17", "short", "#3d6fb6", "#2b2f3a") },
  { id: "secretary", name: "Clara", role: "secretary", traits: ["artist", "kind"], look: look("#f3d0b5", "#b5452f", "long", "#e46b97", "#2e2a3a") },
  { id: "librarian", name: "Iris", role: "librarian", traits: ["meticulous"], look: look("#a8735a", "#2a1a12", "long", "#b8743f", "#3a3229") },
  { id: "scribe", name: "Noé", role: "scribe", traits: ["shy"], look: look("#d9a882", "#5a4632", "curly", "#3aa0d8", "#30343f") },
  { id: "accountant", name: "Bruno", role: "accountant", traits: ["foodie", "lazy"], look: look("#f1c6a5", "#2a2a2a", "bald", "#8a9a5b", "#3a3a3a") },
  { id: "cleaner", name: "Josiane", role: "cleaner", traits: ["gossip", "cleaner"], look: look("#e8b796", "#8a8f99", "bun", "#4a8fb8", "#2d4a63") },
  { id: "intern", name: "Kylian", role: "intern", traits: ["lazy", "hipster"], look: look("#f0c9a8", "#6b4a2b", "spiky", "#ff9f1c", "#1d3557") },
  { id: "mgr-vente", name: "Sabrina", role: "manager", dept: "vente", traits: ["hustler"], look: look("#c68d6a", "#1f1a17", "long", "#d62246", "#22223b") },
  { id: "vinted", name: "Inès", role: "vinted", traits: ["hustler", "party"], look: look("#f3d0b5", "#3b2a20", "bun", "#09b1ba", "#2b2f3a") },
  { id: "photographer", name: "Tom", role: "photographer", traits: ["artist"], look: look("#f1c6a5", "#e0b04a", "curly", "#2b2d42", "#4a4e69") },
  { id: "logistics", name: "Moussa", role: "logistics", traits: ["strong", "foodie"], look: look("#7d513b", "#1f1a17", "short", "#f77f00", "#33364a") },
  { id: "support", name: "Lucie", role: "support", traits: ["kind", "gossip"], look: look("#f3d0b5", "#7a3e1d", "long", "#9b5de5", "#2e2a3a") },
  { id: "mgr-sourcing", name: "Karim", role: "manager", dept: "sourcing", traits: ["hustler"], look: look("#c68d6a", "#1f1a17", "short", "#2ec4b6", "#1d3557") },
  { id: "sourcer", name: "Jade", role: "sourcer", traits: ["meticulous"], look: look("#e8b796", "#1f1a17", "long", "#80b918", "#2b2f3a") },
  { id: "dealhunter", name: "Lucas", role: "dealhunter", specialty: "vols & voyages", traits: ["traveler", "prankster"], look: look("#f0c9a8", "#b5452f", "spiky", "#00bbf9", "#30343f") },
  { id: "dealhunter-2", name: "Emma", role: "dealhunter", specialty: "promos & pépites à revendre", traits: ["party"], look: look("#f3d0b5", "#e0b04a", "long", "#f15bb5", "#2b2f3a") },
  { id: "mgr-prod", name: "Manon", role: "manager", dept: "social", traits: ["calm", "party"], look: look("#f1c6a5", "#7a3e1d", "bun", "#2f8f6b", "#2b2f3a") },
  { id: "snap", name: "Yanis", role: "snap", traits: ["prankster"], look: look("#a8735a", "#1f1a17", "curly", "#fffc00", "#22223b") },
  { id: "telegram", name: "Sofia", role: "telegram", traits: ["gossip"], look: look("#e8b796", "#2a1a12", "long", "#229ed9", "#30343f") },
  { id: "tiktok", name: "Enzo", role: "tiktok", traits: ["party", "nightowl"], look: look("#f0c9a8", "#2d3e8f", "spiky", "#111111", "#ff0050") },
  { id: "writer", name: "Zoé", role: "writer", traits: ["artist"], look: look("#d9a882", "#3b2a20", "curly", "#ef8354", "#2b2f3a") },
  { id: "mgr-tech", name: "Paul", role: "manager", dept: "tech", traits: ["nerd", "grumpy"], look: look("#f1c6a5", "#5a4632", "short", "#495057", "#212529") },
  { id: "webdev", name: "Léo", role: "webdev", traits: ["nerd", "prankster"], look: look("#f0c9a8", "#e0b04a", "spiky", "#7353e8", "#33364a") },
  { id: "automation", name: "Max", role: "automation", traits: ["nerd"], look: look("#c68d6a", "#1f1a17", "short", "#3a86ff", "#212529") },
  { id: "talent", name: "Chloé", role: "talent", traits: ["hustler", "party"], look: look("#f3d0b5", "#2a1a12", "long", "#c77dff", "#2e2a3a") },
  { id: "mgr-marketing", name: "Margaux", role: "manager", dept: "marketing", traits: ["showoff", "hustler"], look: look("#f3d0b5", "#e0b04a", "bun", "#ff8a5b", "#2b2f3a") },
  { id: "designer", name: "Nina", role: "designer", traits: ["artist", "nightowl"], look: look("#a8735a", "#1f1a17", "curly", "#ffd166", "#30343f") },
  { id: "growth", name: "Malik", role: "growth", traits: ["hustler", "foodie"], look: look("#7d513b", "#1f1a17", "short", "#3a86ff", "#212529") },
  { id: "data", name: "Rose", role: "data", traits: ["meticulous", "shy"], look: look("#f0c9a8", "#7a3e1d", "long", "#6d597a", "#2b2f3a") },
  { id: "lawyer", name: "Sandrine", role: "lawyer", traits: ["meticulous", "grumpy"], look: look("#e8b796", "#3b2a20", "bun", "#22223b", "#1a1b26") },
  { id: "admin", name: "Gilles", role: "admin", traits: ["calm", "zealous"], look: look("#f1c6a5", "#9aa0a6", "bald", "#8d99ae", "#33364a") },
  { id: "hr", name: "Gérard", role: "hr", traits: ["kind", "shy"], look: look("#f0c9a8", "#5a4632", "short", "#b8b08d", "#4a4e69") },
  { id: "happiness", name: "Amandine", role: "happiness", traits: ["party", "catlover"], look: look("#f3d0b5", "#b5452f", "long", "#ff8fab", "#2e2a3a") },
  { id: "intern-vente", name: "Lina", role: "intern", dept: "vente", traits: ["clumsy", "party"], look: look("#c68d6a", "#1f1a17", "long", "#06d6a0", "#1d3557") },
  { id: "intern-social", name: "Théo", role: "intern", dept: "social", traits: ["hipster", "nightowl"], look: look("#f3d0b5", "#e0b04a", "curly", "#ef476f", "#30343f") },
  { id: "intern-tech", name: "Sacha", role: "intern", dept: "tech", traits: ["nerd", "clumsy"], look: look("#e8b796", "#2d3e8f", "short", "#118ab2", "#212529") },
];

export const TRAITS = ["prankster", "foodie", "gossip", "party", "lazy", "nerd", "kind", "hustler", "artist", "calm", "meticulous", "shy", "catlover", "clumsy", "nightowl", "traveler"];

// Libellés des traits de caractère (fiches employés, quêtes de médiation).
export const TRAIT_LABELS = {
  prankster: "farceur", foodie: "gourmand", gossip: "commère", party: "fêtard", lazy: "flemmard", nerd: "geek",
  kind: "bienveillant", hustler: "charbonneur", artist: "artiste", calm: "zen", meticulous: "méticuleux", shy: "timide",
  boss: "patron", showoff: "m'as-tu-vu", zealous: "zélé", target: "souffre-douleur", traveler: "globe-trotteur",
  strong: "costaud", nightowl: "oiseau de nuit", hipster: "hipster", grumpy: "grognon", cleaner: "fée du logis",
  catlover: "fan de chats", clumsy: "maladroit",
};

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

export function deptOf(agent) {
  return DEPARTMENTS[agent?.dept] || DEPARTMENTS.direction;
}
