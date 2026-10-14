// Livrables "hors IA" des métiers de l'entreprise (vente, sourcing, social, tech, créateurs…).
// Ils restent utiles tels quels : structures, checklists et calculs à partir du brief.

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function numbersIn(text) {
  return [...String(text || "").matchAll(/(\d+(?:[.,]\d+)?)\s*(?:€|eur|euros?)/gi)].map((m) => Number(m[1].replace(",", ".")));
}

function feedback(task) {
  if (!task.feedback?.length) return "";
  return `\n\n## Corrections intégrées (v${task.revisions + 1})\n${task.feedback.map((f) => `- ${f.text}`).join("\n")}`;
}

function subject(task) {
  return task.title.replace(/^(cr[ée]e|fais|r[ée]dige|pr[ée]pare|trouve|monte|lance|calcule|planifie|organise)\s+(moi\s+)?(?:(une|un|les|le|la|des|mon|ma|mes)\s+)?/i, "") || task.title;
}

function listing(task) {
  const text = `${task.title} ${task.brief}`;
  const brand = /\b(nike|adidas|zara|ralph lauren|lacoste|carhartt|the north face|levi'?s|stone island|jordan|new balance|sezane|asics|puma|tommy hilfiger|vans)\b/i.exec(text)?.[1];
  const size = /\btaille\s*([a-z0-9]{1,4})\b/i.exec(text)?.[1]?.toUpperCase();
  const state = /(neuf avec étiquette|neuf|très bon état|tres bon etat|bon état|bon etat|satisfaisant)/i.exec(text)?.[1] || "Très bon état";
  const [bought] = numbersIn(text);
  const price = bought ? Math.max(5, Math.round(bought * 2.2)) : null;
  const item = cap(subject(task).replace(/^annonces?( vinted)?( pour| de)?\s+(?:(une|un|le|la|les|des)\s+)?/i, "")) || "Article";
  const brandLabel = brand && !new RegExp(brand, "i").test(item) ? cap(brand) : null;
  return `# Annonce Vinted — ${item}

**Titre** : ${[brandLabel, item, size ? `T.${size}` : null, cap(state)].filter(Boolean).join(" · ").slice(0, 60)}

**Description**
✨ ${item}${brandLabel ? ` ${brandLabel}` : ""} — ${state.toLowerCase()}, porté avec soin.
📏 Taille : ${size || "à préciser"} (voir mesures en photo)
🧵 Matière et détails : à compléter (étiquette en photo)
📦 Envoi rapide sous 24 h, emballage soigné
💬 Offres raisonnables acceptées, réduction si achat groupé

**Prix** : ${price ? `${price} € conseillé, plancher ${Math.round(price * 0.8)} € (acheté ${bought} €)` : "à fixer en comparant 5 annonces vendues similaires (filtre « Vendu »)"}

**Mots-clés** : ${[brand, item.split(" ")[0], "vintage", "streetwear", "tendance"].filter(Boolean).map((k) => `#${k.toLowerCase().replace(/\s+/g, "")}`).join(" ")}

## Stratégie de vente
1. Publier entre 18 h et 21 h (pic de trafic), idéalement dimanche soir.
2. 5 photos minimum : face, dos, étiquette, détail matière, porté.
3. Après 3 jours sans vente : remonter l'annonce ou baisser de 5 %.
4. Répondre aux messages en moins d'1 h : ça booste la visibilité.
5. Proposer un lot aux personnes qui ont mis l'article en favori.${feedback(task)}`;
}

function shooting(task) {
  return `# Plan de shooting — ${cap(subject(task))}

## Matériel
- Fond uni clair (drap blanc ou mur) ou parquet clair pour un rendu chaleureux
- Lumière du jour près d'une fenêtre, jamais de flash direct
- Téléphone stable (pile de livres ou trépied), objectif nettoyé

## Liste des photos (dans l'ordre de l'annonce)
1. Vue de face, article bien à plat ou sur cintre
2. Vue de dos
3. Étiquette marque + taille
4. Détail matière / logo en gros plan
5. Défauts éventuels (honnêteté = moins de litiges)
6. Porté ou mis en scène (ambiance)

## Retouche
- Luminosité +10, contraste +5, pas de filtre qui change les couleurs
- Recadrage carré pour la première photo
- Même style sur toutes les annonces : la vitrine doit être cohérente${feedback(task)}`;
}

function logistics(task) {
  return `# Process d'expédition — ${cap(subject(task))}

## Checklist colis
- [ ] Vérifier l'article (propre, plié, défauts photographiés)
- [ ] Emballage : sachet + carton ou enveloppe matelassée selon fragilité
- [ ] Petit mot de remerciement (meilleures notes)
- [ ] Imprimer le bordereau généré par la plateforme et le coller bien à plat
- [ ] Déposer en point relais avant l'heure limite, garder la preuve de dépôt
- [ ] Prendre en photo le colis fermé + étiquette (preuve en cas de litige)

## Choix du transporteur
| Cas | Recommandation |
|---|---|
| Vêtement léger | Point relais (le moins cher) |
| Objet fragile ou de valeur | Envoi suivi avec assurance |
| Client pressé | Livraison à domicile |

_Tarifs : se référer à la grille à jour de chaque transporteur._

## Suivi
- Vérifier chaque matin les colis « en transit » depuis plus de 5 jours
- Relancer le transporteur au-delà de 7 jours, prévenir l'acheteur avant qu'il ne s'inquiète${feedback(task)}`;
}

function support(task) {
  return `# Service client — ${cap(subject(task))}

## Message : retard de livraison
> Bonjour ! Votre colis a bien été déposé le [date], voici le suivi : [lien]. Le transporteur a un peu de retard en ce moment, je surveille et je reviens vers vous si besoin. Merci pour votre patience 🙏

## Message : article non conforme
> Bonjour, je suis désolé que l'article ne vous convienne pas. Pouvez-vous m'envoyer une photo du problème ? Je vous propose une solution rapide (retour ou geste commercial) dès réception.

## Message : demande de réduction
> Merci pour votre intérêt ! Je peux vous le laisser à [prix] — et si vous prenez un deuxième article, je fais -15 % sur le lot 😉

## Règles d'or
- Répondre en moins d'1 h, toujours poli, jamais sur la défensive
- Garder les preuves (photos, dépôt) avant tout litige
- Un client satisfait = une bonne note = plus de ventes${feedback(task)}`;
}

function sourcing(task) {
  return `# Sourcing — ${cap(subject(task))}

## Pistes à explorer
1. **Friperies au kilo & vide-dressings** : pièces de marque sous-évaluées
2. **Lots sur les plateformes** : acheter en lot, revendre à la pièce
3. **Déstockage / fins de séries** : magasins qui ferment, outlets
4. **Grossistes** : uniquement avec échantillon avant toute commande
5. **Ventes privées & soldes** : stock neuf à prix cassé

## Grille de décision (à remplir pour chaque lot)
| Critère | Seuil |
|---|---|
| Prix d'achat unitaire | ≤ 40 % du prix de revente constaté |
| Délai de revente estimé | < 3 semaines |
| Demande (annonces vendues récemment) | ≥ 5 ventes similaires |
| Risque (contrefaçon, état) | faible, authenticité vérifiable |

## Calcul de marge
Marge = prix de vente − prix d'achat − frais (port, emballage, commission éventuelle).
Objectif : marge nette ≥ 15 € ou ≥ 50 % par article.${feedback(task)}`;
}

function dealhunt(task, agent) {
  return `# Veille bons plans — ${cap(subject(task))}

*Par ${agent?.name || "l'équipe"}${agent?.specialty ? `, spécialité ${agent.specialty}` : ""}*

> Mode modèles : pas d'accès au web. Avec une clé API Claude, le dénicheur fait une vraie recherche en ligne et liste les offres trouvées avec leurs liens.

## Sujets surveillés
${String(task.brief || task.title).split(/\n|,/).map((t) => t.trim()).filter(Boolean).map((t) => `- ${t}`).join("\n")}

## Méthode
1. **Alertes** : créer une alerte de recherche enregistrée sur chaque plateforme (mots-clés + prix max)
2. **Erreurs de prix** : surveiller les baisses brutales (> 50 %) et agir vite
3. **Vols** : dates flexibles, aéroports alternatifs, alertes de prix ; le bot de vols du QG poste automatiquement ce qu'il trouve
4. **Revente** : comparer chaque bon plan au prix des annonces *vendues* avant d'acheter
5. **Vérification** : vendeur fiable, avis, frais cachés, conditions de retour

## Critères d'un vrai bon plan
- ≥ 30 % sous le prix habituel constaté
- Revente possible avec ≥ 15 € de marge, ou intérêt clair pour notre audience
- Offre vérifiée (lien officiel, stock réel)${feedback(task)}`;
}

function snap(task) {
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const ideas = ["coulisses du QG", "nouvel arrivage en avant-première", "sondage : vous préférez A ou B ?", "avant / après d'un article", "FAQ express en 3 snaps", "drop du week-end avec compte à rebours", "best-of de la semaine"];
  return `# Snapchat — ${cap(subject(task))}

## Plan de stories sur 7 jours
| Jour | Idée | Format |
|---|---|---|
${days.map((d, i) => `| ${d} | ${ideas[i]} | ${i % 2 ? "3 snaps vidéo" : "photo + sticker sondage"} |`).join("\n")}

## Script type (story de 3 snaps)
1. **Accroche** (texte gros) : « Personne ne s'attendait à ça 👀 »
2. **Contenu** : montrer le produit / la coulisse en 5 secondes
3. **Action** : « Réponds "MOI" pour le recevoir en premier »

## Croissance
- Poster 1 Spotlight par jour (vidéo verticale, son tendance)
- Répondre à chaque réponse de story : l'algorithme adore
- Partager le lien du canal Telegram en story une fois par semaine${feedback(task)}`;
}

function channel(task) {
  return `# Canal Telegram — ${cap(subject(task))}

## Post 1 — Annonce
🔥 **DROP CE SOIR 20H** 🔥
Nouvel arrivage, quantités limitées. Activez les notifications 🔔 pour ne rien rater.

## Post 2 — Bon plan
💸 Bon plan repéré par l'équipe : [produit] à [prix] au lieu de [prix barré]
👉 [lien]
⏳ Valable jusqu'à [date] — premiers arrivés, premiers servis.

## Post 3 — Engagement
📊 Sondage : vous voulez quoi pour le prochain drop ?
A) Sneakers  B) Vintage  C) Accessoires

## Organisation
- 2 à 3 posts par jour max, à heures fixes (12 h, 18 h, 21 h)
- Messages épinglés : règles du canal + comment commander
- Le bot de vols du QG peut poster automatiquement dans un canal dédié aux voyages${feedback(task)}`;
}

function video(task) {
  const topic = cap(subject(task).replace(/^(une\s+)?(vid[ée]o|tiktok)\s*(tiktok)?\s*(pour|sur)?\s*/i, "")) || "notre activité";
  return `# Script TikTok — ${topic}

**Format** : 9:16, 25 à 35 secondes, sous-titres incrustés, son tendance

## Hook (0-3 s)
« Tu revends sur Vinted ? Arrête de faire cette erreur 👇 » (texte à l'écran + voix)

## Découpage
| Temps | Plan | Texte à l'écran | Son / voix |
|---|---|---|---|
| 0-3 s | Gros plan visage ou produit, mouvement rapide | Hook | Voix + son tendance |
| 3-8 s | Montrer le problème | « Ce que tout le monde fait » | Voix |
| 8-18 s | La solution en 3 étapes (1 plan par étape) | 1️⃣ 2️⃣ 3️⃣ | Voix rythmée |
| 18-25 s | Résultat / avant-après | « Résultat : … » | Montée du son |
| 25-30 s | Appel à l'action | « Abonne-toi pour la partie 2 » | Voix |

## Montage
- Coupes toutes les 1 à 2 secondes, zooms légers sur les moments clés
- Sous-titres centrés, 2 lignes max, mots-clés en couleur
- Musique : son tendance à -15 dB sous la voix

## Publication
- Légende courte + question pour les commentaires
- Hashtags : #vinted #revente #astuce #${topic.split(" ")[0].toLowerCase()}
- Publier entre 18 h et 22 h, répondre aux commentaires dans la première heure${feedback(task)}`;
}

function finance(task) {
  const nums = numbersIn(`${task.title} ${task.brief}`);
  let calc = "";
  if (nums.length >= 2) {
    const [buy, sell, fees = 0] = nums;
    const margin = sell - buy - fees;
    calc = `\n## Calcul sur tes chiffres\n| Prix d'achat | Prix de vente | Frais | Marge nette | Taux de marge |\n|---|---|---|---|---|\n| ${buy} € | ${sell} € | ${fees} € | **${margin.toFixed(2)} €** | ${sell ? ((margin / sell) * 100).toFixed(0) : 0} % |\n`;
  }
  return `# Finance — ${cap(subject(task))}
${calc}
## Tableau de suivi à tenir chaque semaine
| Semaine | Ventes | Chiffre d'affaires | Coût des articles | Frais | Marge nette |
|---|---|---|---|---|---|
| S1 | | | | | |
| S2 | | | | | |

## Formules
- **Marge nette** = prix de vente − prix d'achat − frais (port, emballage, commissions)
- **Taux de marge** = marge nette ÷ prix de vente
- **Rotation du stock** = articles vendus ÷ articles en stock (objectif > 50 % par mois)

## Conseils du comptable
- Séparer compte perso et compte pro dès maintenant
- Garder toutes les preuves d'achat (factures, captures)
- Surveiller les seuils de déclaration et de micro-entreprise : vérifier les règles en vigueur sur les sites officiels${feedback(task)}`;
}

function automation(task) {
  return `# Automatisation — ${cap(subject(task))}

## Plan
1. Définir le déclencheur (horaire, nouveau message, nouvelle vente…)
2. Définir l'action (poster dans un canal, envoyer un récap, mettre à jour un tableau)
3. Tester sur un canal privé avant la mise en production
4. Ajouter des logs et une alerte en cas d'erreur

## Exemple : bot Telegram qui poste un message planifié (Node.js)
\`\`\`js
import { Telegraf } from "telegraf";
import cron from "node-cron";

const bot = new Telegraf(process.env.BOT_TOKEN);
const CHANNEL = process.env.CHANNEL_ID; // ex : -1001234567890

cron.schedule("0 18 * * *", async () => {
  await bot.telegram.sendMessage(CHANNEL, "🔥 Nouveau drop ce soir à 20h !");
});

bot.launch();
\`\`\`

## Installation
- \`npm install telegraf node-cron\`
- Créer le bot avec @BotFather, l'ajouter admin du canal
- Héberger sur le même serveur que le QG${feedback(task)}`;
}

function processDoc(task) {
  return `# Procédure — ${cap(subject(task))}

*Rédigée par la direction adjointe. À respecter. Sans exception. Merci.*

## Objectif
Faire la même chose de la même façon à chaque fois, sans oubli.

## Étapes
1. Préparer : rassembler les infos et le matériel nécessaires
2. Exécuter : suivre la checklist ci-dessous dans l'ordre
3. Contrôler : un deuxième regard sur tout ce qui part chez un client
4. Archiver : déposer le livrable dans les archives avec les bonnes étiquettes

## Checklist
- [ ] Brief clair (quoi, pour qui, pour quand)
- [ ] Responsable désigné
- [ ] Délai noté au planning
- [ ] Contrôle qualité fait
- [ ] Archivé

## Indicateurs
- Délai moyen de traitement
- Nombre de retours / corrections
- Satisfaction client${feedback(task)}`;
}

function talent(task) {
  return `# Pôle Créateurs — ${cap(subject(task))}

*Préparation du lancement (activité de gestion de créatrices et créateurs de contenu).*

## Étapes de lancement
1. **Cadre légal** : statut adapté, contrats clairs (rémunération, durée, résiliation), conseils d'un professionnel du droit
2. **Conformité** : créatrices et créateurs majeurs, vérifiés, consentants ; respect strict des règles de chaque plateforme
3. **Recrutement** : profils motivés, présence déjà engagée sur les réseaux grand public
4. **Outils** : planning de contenu partagé, suivi des revenus, reporting mensuel transparent
5. **Marketing** : croissance sur les réseaux grand public (TikTok, Snapchat, Instagram) avec des contenus adaptés à chaque plateforme

## Planning type (par créatrice / créateur)
| Jour | Action |
|---|---|
| Lundi | Planning de la semaine validé ensemble |
| Mercredi | Point performance |
| Vendredi | Préparation des publications du week-end |

## Indicateurs
- Croissance de l'audience, taux d'engagement, revenus mensuels, satisfaction des créateurs${feedback(task)}`;
}

function intern(task, agent) {
  return `# ${cap(subject(task))}

*Par ${agent?.name || "le stagiaire"}, stagiaire (motivé·e à 200 %)*

## Ce que j'ai fait
- J'ai lu le brief deux fois (la deuxième fois avec un café ☕)
- J'ai listé les idées principales ci-dessous

## Idées
${String(task.brief || task.title).split(/[\n.;]+/).map((s) => s.trim()).filter((s) => s.length > 3).slice(0, 5).map((s) => `- ${cap(s)}`).join("\n") || "- Clarifier l'objectif avec un manager\n- Faire une première version rapide\n- Demander un retour"}

## Prochaine étape
Je montre ça à un manager avant d'aller plus loin. Promis.${feedback(task)}`;
}

// Retourne null si le type n'est pas géré ici.
export function businessTemplate(task, agent) {
  switch (task.type) {
    case "listing": return { kind: "listing", title: `Annonce — ${cap(subject(task).replace(/^annonces?( vinted)?( pour| de)?\s+(?:(une|un|le|la|les|des)\s+)?/i, ""))}`.slice(0, 140), content: listing(task) };
    case "shooting": return { kind: "report", title: `Shooting — ${cap(subject(task))}`.slice(0, 140), content: shooting(task) };
    case "logistics": return { kind: "report", title: task.title, content: logistics(task) };
    case "support": return { kind: "content", title: task.title, content: support(task) };
    case "sourcing": return { kind: "report", title: task.title, content: sourcing(task) };
    case "dealhunt": return { kind: "deals", title: task.title, content: dealhunt(task, agent) };
    case "social": return { kind: "content", title: task.title, content: snap(task) };
    case "channel": return { kind: "content", title: task.title, content: channel(task) };
    case "video": return { kind: "video", title: `TikTok — ${cap(subject(task))}`.slice(0, 140), content: video(task) };
    case "finance": return { kind: "finance", title: task.title, content: finance(task) };
    case "automation": return { kind: "code", title: task.title, content: automation(task) };
    case "process": return { kind: "report", title: `Procédure — ${cap(subject(task))}`.slice(0, 140), content: processDoc(task) };
    case "talent": return { kind: "report", title: task.title, content: talent(task) };
    case "general": return agent?.role === "intern" ? { kind: "report", title: task.title, content: intern(task, agent) } : null;
    default: return null;
  }
}
