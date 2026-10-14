// Générateur "hors-ligne" : produit des livrables crédibles sans IA.
// Utilisé en mode démo et comme secours si l'API Claude échoue.

import { parseFrenchEvent, formatLocal, localIso } from "./dates.js";
import { computeKpis, findAgent, norm, reportsOf, currentTask, agentLoad } from "./engine.js";
import { DOC_KINDS, PRIORITIES, roleOf } from "./roster.js";
import { businessTemplate } from "./business-templates.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const PALETTES = [
  { bg: "#0f172a", fg: "#e2e8f0", accent: "#38bdf8", accent2: "#a78bfa", card: "#1e293b" },
  { bg: "#fffaf3", fg: "#2d2a26", accent: "#e76f51", accent2: "#2a9d8f", card: "#ffffff" },
  { bg: "#0b1d17", fg: "#e7f5ee", accent: "#34d399", accent2: "#fbbf24", card: "#12302a" },
  { bg: "#f5f3ff", fg: "#1e1b4b", accent: "#7c3aed", accent2: "#ec4899", card: "#ffffff" },
  { bg: "#1c1917", fg: "#fafaf9", accent: "#f59e0b", accent2: "#ef4444", card: "#292524" },
];

const SITE_FLAVORS = [
  { re: /(restaurant|resto|cuisine|bistro|cafe|boulang|traiteur|pizz)/, kind: "restaurant", hero: "Une cuisine qui raconte une histoire", features: ["Produits frais & locaux", "Réservation en 1 clic", "Privatisation & événements"], cta: "Réserver une table" },
  { re: /(portfolio|photograph|designer|artiste|illustrat|freelance)/, kind: "portfolio", hero: "Des projets qui ont du caractère", features: ["Direction artistique", "Identité visuelle", "Accompagnement sur mesure"], cta: "Voir mes projets" },
  { re: /(boutique|e-?commerce|shop|vente|produit|marque)/, kind: "shop", hero: "Le produit que vous attendiez", features: ["Livraison 48 h", "Paiement sécurisé", "Retours gratuits 30 jours"], cta: "Découvrir la collection" },
  { re: /(voyage|vol|billet|avion|tourisme|hotel|sejour)/, kind: "travel", hero: "Partez plus loin, payez moins", features: ["Bons plans vérifiés", "Alertes en temps réel", "Destinations coup de cœur"], cta: "Voir les bons plans" },
  { re: /(coach|sport|fitness|yoga|sante|bien-etre|therap)/, kind: "coach", hero: "Votre meilleure version commence ici", features: ["Programmes personnalisés", "Suivi hebdomadaire", "Séance découverte offerte"], cta: "Réserver ma séance" },
  { re: /(agence|startup|saas|logiciel|appli|tech|ia\b|intelligence)/, kind: "saas", hero: "Automatisez ce qui vous ralentit", features: ["Mise en place en 10 minutes", "Intégrations natives", "Support humain 7j/7"], cta: "Essayer gratuitement" },
];

function guessName(task) {
  const text = `${task.title}\n${task.brief}`;
  const field = /nom du projet\s*:\s*(.+)/i.exec(text);
  if (field) return field[1].trim().slice(0, 40);
  const quoted = /[«"“]\s*([^»"”]{2,40}?)\s*[»"”]/.exec(text);
  if (quoted) return quoted[1].trim();
  const pour = /\b(?:pour|de|du)\s+(?:la |le |l'|les )?([A-ZÉÈ][\w'’ -]{1,30})/.exec(text);
  if (pour) return pour[1].trim();
  return task.title.replace(/^(cr[ée]e|fais|construis|fabrique|monte|d[ée]veloppe)\s+(un|une|le|la)?\s*/i, "").slice(0, 40) || "Mon projet";
}

// Description libre du brief (sans les lignes "Champ : valeur" générées par le formulaire du studio).
function briefDescription(task) {
  const lines = String(task.brief || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^(type de site|nom du projet|style \/ couleurs)\s*:/i.test(l));
  return lines.join(" ").slice(0, 280);
}

function pickPalette(task) {
  const text = norm(`${task.title} ${task.brief}`);
  if (/(sombre|dark|noir|nuit|luxe|premium)/.test(text)) return /(dore|or\b|gold)/.test(text) ? PALETTES[4] : PALETTES[0];
  if (/(nature|vert|bio|eco|jardin)/.test(text)) return PALETTES[2];
  if (/(chaleureu|terracotta|cuisine|famil|artisan)/.test(text)) return PALETTES[1];
  if (/(violet|rose|pastel|feminin|creatif)/.test(text)) return PALETTES[3];
  return PALETTES[hash(task.title) % PALETTES.length];
}

function buildSite(task) {
  const text = norm(`${task.title} ${task.brief}`);
  const flavor = SITE_FLAVORS.find((f) => f.re.test(text)) || {
    kind: "vitrine",
    hero: "Bienvenue chez nous",
    features: ["Expertise reconnue", "Réponse sous 24 h", "Clients satisfaits"],
    cta: "Nous contacter",
  };
  const p = pickPalette(task);
  const name = escapeHtml(guessName(task));
  const brief = escapeHtml(briefDescription(task) || "Un savoir-faire unique, une expérience pensée pour vous. Découvrez ce qui nous rend différents.");
  const features = flavor.features
    .map((f, i) => `<article class="card"><span class="num">0${i + 1}</span><h3>${escapeHtml(f)}</h3><p>${escapeHtml(featureText(f))}</p></article>`)
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  :root { --bg:${p.bg}; --fg:${p.fg}; --accent:${p.accent}; --accent2:${p.accent2}; --card:${p.card}; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.6; }
  a { color: inherit; }
  header { position: sticky; top: 0; display: flex; justify-content: space-between; align-items: center; padding: 16px 6vw; background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(8px); z-index: 2; }
  .logo { font-weight: 800; letter-spacing: -0.02em; font-size: 1.2rem; }
  .logo span { color: var(--accent); }
  nav a { margin-left: 20px; text-decoration: none; opacity: .8; font-size: .95rem; }
  .hero { min-height: 78vh; display: grid; place-items: center; text-align: center; padding: 60px 6vw; background: radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent) 25%, transparent), transparent 55%), radial-gradient(circle at 80% 60%, color-mix(in srgb, var(--accent2) 22%, transparent), transparent 50%); }
  .hero h1 { font-size: clamp(2.2rem, 6vw, 4.2rem); line-height: 1.05; letter-spacing: -0.03em; max-width: 14ch; margin: 0 auto 18px; }
  .hero p { max-width: 56ch; margin: 0 auto 28px; opacity: .85; }
  .btn { display: inline-block; padding: 14px 26px; border-radius: 999px; background: var(--accent); color: var(--bg); font-weight: 700; text-decoration: none; transition: transform .2s; }
  .btn:hover { transform: translateY(-2px); }
  section { padding: 80px 6vw; }
  h2 { font-size: clamp(1.6rem, 3.5vw, 2.4rem); margin-bottom: 28px; letter-spacing: -0.02em; }
  .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .card { background: var(--card); border-radius: 18px; padding: 26px; border: 1px solid color-mix(in srgb, var(--fg) 10%, transparent); }
  .num { color: var(--accent); font-weight: 800; font-size: .9rem; }
  .card h3 { margin: 8px 0; }
  .about { display: grid; gap: 32px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); align-items: center; }
  .visual { aspect-ratio: 4/3; border-radius: 24px; background: linear-gradient(135deg, var(--accent), var(--accent2)); }
  form { display: grid; gap: 12px; max-width: 520px; }
  input, textarea { padding: 14px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--fg) 20%, transparent); background: var(--card); color: var(--fg); font: inherit; }
  footer { padding: 30px 6vw; opacity: .6; font-size: .9rem; text-align: center; }
  @media (max-width: 640px) { nav { display: none; } }
</style>
</head>
<body>
  <header>
    <div class="logo">${name}<span>.</span></div>
    <nav><a href="#services">Services</a><a href="#apropos">À propos</a><a href="#contact">Contact</a></nav>
  </header>
  <main>
    <section class="hero">
      <div>
        <h1>${escapeHtml(flavor.hero)}</h1>
        <p>${brief}</p>
        <a class="btn" href="#contact">${escapeHtml(flavor.cta)}</a>
      </div>
    </section>
    <section id="services">
      <h2>Ce que nous proposons</h2>
      <div class="grid">
        ${features}
      </div>
    </section>
    <section id="apropos" class="about">
      <div>
        <h2>À propos</h2>
        <p>${name} accompagne ses clients avec exigence et simplicité. Chaque détail compte : nous construisons une expérience claire, rapide et agréable, du premier contact jusqu'au résultat.</p>
      </div>
      <div class="visual" role="img" aria-label="Illustration"></div>
    </section>
    <section id="contact">
      <h2>Parlons de votre projet</h2>
      <form onsubmit="event.preventDefault(); this.querySelector('button').textContent='Message envoyé ✓';">
        <input required placeholder="Votre nom">
        <input required type="email" placeholder="Votre e-mail">
        <textarea rows="4" placeholder="Votre message"></textarea>
        <button class="btn" type="submit">Envoyer</button>
      </form>
    </section>
  </main>
  <footer>© ${new Date().getFullYear()} ${name} — Site conçu par le Studio Web du QG</footer>
</body>
</html>`;
}

function featureText(feature) {
  return `${feature} : une attention particulière portée à la qualité, avec un accompagnement clair à chaque étape.`;
}

function bulletsFromBrief(brief, fallback) {
  const parts = String(brief || "")
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, 5);
  return (parts.length ? parts : fallback).map((s) => `- ${s.charAt(0).toUpperCase()}${s.slice(1)}`).join("\n");
}

function feedbackSection(task) {
  if (!task.feedback?.length) return "";
  return `\n\n## Corrections intégrées (v${task.revisions + 1})\n${task.feedback.map((f) => `- ${f.text}`).join("\n")}`;
}

function libraryReport(state, task) {
  const docs = state.documents;
  const byKind = {};
  for (const d of docs) (byKind[d.kind] ||= []).push(d);
  const tags = {};
  for (const d of docs) for (const t of d.tags) tags[t] = (tags[t] || 0) + 1;
  const query = norm(task.brief || task.title).split(/\W+/).filter((w) => w.length > 3);
  const hits = docs.filter((d) => query.some((w) => norm(`${d.title} ${d.tags.join(" ")}`).includes(w))).slice(0, 8);
  const untagged = docs.filter((d) => d.tags.length === 0);

  return `# ${task.title}

## Inventaire de la bibliothèque
${Object.entries(byKind).map(([k, list]) => `- ${DOC_KINDS[k]?.icon || "📄"} **${DOC_KINDS[k]?.label || k}** : ${list.length}`).join("\n") || "- Bibliothèque vide pour l'instant."}

**Total : ${docs.length} document(s).**

## Étiquettes les plus utilisées
${Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => `- #${t} (${n})`).join("\n") || "- Aucune étiquette."}

## Documents liés à la demande
${hits.map((d) => `- ${DOC_KINDS[d.kind]?.icon || "📄"} ${d.title}`).join("\n") || "- Aucun document ne correspond directement à la demande."}

## Recommandations de rangement
- ${untagged.length ? `${untagged.length} document(s) sans étiquette : à classer en priorité.` : "Tous les documents sont étiquetés. 👌"}
- Épingler les documents de référence (guides, chartes, contrats) pour les retrouver en un coup d'œil.
- Faire un inventaire mensuel pour archiver ce qui n'est plus utile.${feedbackSection(task)}`;
}

function teamReport(state, task) {
  const manager = findAgent(state, task.agentId);
  const team = manager ? reportsOf(state, manager.id) : [];
  const lines = team.map((a) => {
    const cur = currentTask(state, a.id);
    return `- **${a.name}** (${roleOf(a).label}) — ${cur ? `sur « ${cur.title} »` : "disponible"} · ${agentLoad(state, a.id)} mission(s) en cours/attente · ${a.stats.done} livrée(s)`;
  });
  const loads = team.map((a) => agentLoad(state, a.id));
  const max = Math.max(0, ...loads);
  return `# ${task.title}

## Mon équipe (${team.length} personne(s))
${lines.join("\n") || "- Aucun agent rattaché pour le moment."}

## Analyse
- Charge maximale : ${max} mission(s) pour un agent.
- ${max >= 4 ? "⚠️ Un agent est surchargé : envisager un recrutement ou une répartition différente." : "La charge est soutenable."}
- Missions livrées par l'équipe : ${team.reduce((s, a) => s + a.stats.done, 0)}.

## Prochaines étapes
${bulletsFromBrief(task.brief, ["Point individuel rapide avec chacun", "Prioriser les missions critiques", "Partager les livrables en bibliothèque"])}${feedbackSection(task)}`;
}

function decisionMemo(state, task) {
  const k = computeKpis(state);
  return `# Note de décision — ${task.title}

**Priorité :** ${PRIORITIES[task.priority]?.label || task.priority}

## Contexte
${task.brief || "Demande transmise par la direction."}

## Options étudiées
1. **Agir maintenant** — impact rapide, mobilise l'équipe à court terme.
2. **Planifier** — intégrer le sujet au prochain point d'équipe et lancer un pilote.
3. **Reporter** — pas de coût immédiat, mais risque de perdre l'avantage.

## Analyse
- Charge actuelle du QG : ${k.working} mission(s) en cours, ${k.queued} en attente.
- ${k.critical ? `${k.critical} dossier(s) critique(s) déjà ouverts : attention à la dispersion.` : "Aucun autre dossier critique ouvert : la fenêtre est favorable."}

## Recommandation
➡️ **Option ${k.critical > 1 ? "2 — planifier" : "1 — agir maintenant"}**, avec un point d'étape sous une semaine.${feedbackSection(task)}

_À valider par ${state.boss.name}._`;
}

function genericDoc(state, task, agent) {
  const role = roleOf(agent);
  const heading = task.type === "notes" ? "Notes" : task.type === "content" ? "Proposition de texte" : "Livrable";
  const body = task.type === "content"
    ? `## Accroche\n**${task.title}** — l'essentiel, sans détour.\n\n## Texte\n${task.brief || task.title} : voici une proposition claire et engageante, pensée pour être lue en moins d'une minute. Elle met en avant le bénéfice principal, rassure avec un élément concret et termine par un appel à l'action simple.\n\n## Appel à l'action\n👉 Passez à l'action dès aujourd'hui.`
    : `## Points clés\n${bulletsFromBrief(task.brief, ["Clarifier l'objectif", "Lister les contraintes", "Identifier les personnes concernées"])}\n\n## Plan d'action\n1. Cadrer le besoin et le résultat attendu\n2. Produire une première version\n3. Relire, ajuster et ranger en bibliothèque`;
  return `# ${heading} — ${task.title}

*Par ${agent?.name || "l'équipe"}, ${role.label.toLowerCase()}*

${body}${feedbackSection(task)}`;
}

export function templateSummarize(meeting, state) {
  const lines = meeting.notes.map((n) => n.text);
  const actionRe = /(^\s*(?:todo|à faire|a faire|action|->|→|- \[ \])|\b(?:doit|devra|faut|envoyer|préparer|preparer|faire|contacter|relancer|rédiger|rediger|planifier)\b)/i;
  const decisionRe = /\b(d[ée]cid|valid|on part sur|ok pour|accord|retenu|adopt)/i;
  const decisions = lines.filter((l) => decisionRe.test(l));
  const actions = lines
    .filter((l) => actionRe.test(l) && !decisionRe.test(l))
    .map((l) => {
      const assignee = state.agents.find((a) => norm(l).includes(norm(a.name)));
      return { text: l.replace(/^\s*(?:todo|à faire|a faire|action)\s*[:-]?\s*|^\s*(?:->|→|- \[ \])\s*/i, ""), assignee: assignee?.id || null };
    });
  const others = lines.filter((l) => !decisions.includes(l) && !actions.some((a) => l.endsWith(a.text)));
  const summary = [
    `La réunion « ${meeting.title} » a réuni ${meeting.attendees.length + 1} participant(s) et produit ${lines.length} note(s).`,
    others.length ? `Points abordés :\n${others.slice(0, 8).map((l) => `- ${l}`).join("\n")}` : null,
  ].filter(Boolean).join("\n\n");
  return { summary, decisions, actions };
}

export function templateBrief(state, now = Date.now()) {
  const k = computeKpis(state, now);
  const tz = state.settings.tzOffset || 0;
  const review = state.tasks.filter((t) => t.status === "review");
  const open = state.tasks.filter((t) => ["queued", "working"].includes(t.status)).sort((a, b) => PRIORITIES[b.priority].rank - PRIORITIES[a.priority].rank);
  const upcoming = state.events.filter((e) => e.start >= now).slice(0, 5);
  return `# Brief de direction

## En un coup d'œil
- ⚙️ ${k.working} mission(s) en cours, ${k.queued} en attente
- 📁 ${k.review} dossier(s) à valider
- ✅ ${k.doneToday} livrée(s) aujourd'hui (${k.doneTotal} au total)
- 📚 ${k.documents} document(s) en bibliothèque

## Priorités
${open.slice(0, 5).map((t) => `- ${PRIORITIES[t.priority].icon} **${t.title}** → ${findAgent(state, t.agentId)?.name || "?"}`).join("\n") || "- Aucune mission ouverte : c'est le moment de lancer de nouveaux chantiers."}

## À valider
${review.map((t) => `- 📁 ${t.title}`).join("\n") || "- Rien en attente. 👍"}

## Agenda
${upcoming.map((e) => `- ${formatLocal(e.start, tz)} — ${e.title}`).join("\n") || "- Agenda libre."}

## Recommandation du directeur
${k.review ? "Commence par valider les dossiers en attente : ils bloquent la suite." : k.critical ? "Concentre l'équipe sur les dossiers critiques avant d'en ouvrir de nouveaux." : "L'équipe a de la capacité : confie-lui un nouveau projet ambitieux."}`;
}

// Interface commune aux générateurs : runTask / summarizeMeeting / directorBrief / parseEvents
export function createTemplateGenerator({ latencyMs = 600 } = {}) {
  return {
    name: "templates",
    ai: false,
    async runTask({ task, agent, state, now }) {
      await wait(latencyMs);
      const tz = state.settings.tzOffset || 0;
      switch (task.type) {
        case "site":
          return { kind: "site", title: `Site — ${guessName(task)}`, content: buildSite(task), summary: "Page HTML responsive prête à publier." };
        case "storage":
          return { kind: "report", title: task.title, content: libraryReport(state, task) };
        case "report":
          return { kind: "report", title: task.title, content: teamReport(state, task) };
        case "decision":
          return { kind: "memo", title: `Décision — ${task.title}`, content: decisionMemo(state, task) };
        case "planning": {
          const parsed = parseFrenchEvent(`${task.title} ${task.brief}`, { now, tzOffset: tz });
          const ev = { title: parsed.title, start: parsed.start, durationMin: parsed.durationMin, isMeeting: parsed.isMeeting, attendees: [], remindMinutes: 15 };
          return {
            kind: "note",
            title: `Planning — ${task.title}`,
            content: `# ${task.title}\n\n📅 Ajouté au planning : **${parsed.title}** le **${formatLocal(parsed.start, tz)}** (${parsed.durationMin} min).\n\n${parsed.found ? "" : "_Aucune date précise trouvée : j'ai proposé le premier créneau disponible. Modifie-le si besoin._\n\n"}Rappel programmé 15 minutes avant.`,
            events: [ev],
          };
        }
        case "notes":
        case "content":
        case "general":
        default: {
          const business = businessTemplate(task, agent);
          if (business) return business;
          return { kind: task.type === "notes" ? "note" : task.type === "content" ? "content" : "report", title: task.title, content: genericDoc(state, task, agent) };
        }
      }
    },
    async summarizeMeeting({ meeting, state }) {
      await wait(latencyMs);
      return templateSummarize(meeting, state);
    },
    async directorBrief({ state, now }) {
      await wait(latencyMs);
      return templateBrief(state, now);
    },
    async parseEvents({ text, now, tzOffset, state }) {
      const parsed = parseFrenchEvent(text, { now, tzOffset });
      const mentioned = (state?.agents || []).filter((a) => new RegExp(`\\b${norm(a.name)}\\b`).test(norm(text))).map((a) => a.id);
      return [{
        title: parsed.title,
        start: parsed.start,
        localStart: localIso(parsed.start, tzOffset),
        durationMin: parsed.durationMin,
        isMeeting: parsed.isMeeting,
        attendees: mentioned,
        confident: parsed.found,
      }];
    },
  };
}

