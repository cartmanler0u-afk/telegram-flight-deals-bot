// Livrables "hors IA" des métiers de l'entreprise (vente, sourcing, social, tech, créateurs…).
// Ils restent utiles tels quels : structures, checklists et calculs à partir du brief.

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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

function design(task, agent) {
  const what = cap(subject(task));
  const text = norm(`${task.title} ${task.brief}`);
  const format = /miniature|thumbnail|youtube/.test(text) ? "1280 × 720 px (16:9)"
    : /story|tiktok|reel|snap/.test(text) ? "1080 × 1920 px (9:16)"
    : /banniere|banner|header/.test(text) ? "1500 × 500 px"
    : /logo/.test(text) ? "carré 1000 × 1000 px + version horizontale 1600 × 600 px"
    : "1080 × 1350 px (4:5, idéal pour les réseaux)";
  return `# Brief visuel — ${what}

*Par ${agent?.name || "le studio marketing"}*

| Élément | Choix |
|---|---|
| Format | ${format} |
| Style | Moderne, contrasté, lisible sur téléphone |
| Palette | #111827 (fond) · #FF8A5B (accent) · #F7C948 (highlight) · #FFFFFF (texte) |
| Typos | Titre : *Bebas Neue* ou *Archivo Black* · Texte : *Inter* |

## Composition
1. Accroche en 3 à 5 mots, en gros, dans le tiers haut.
2. Sujet principal au centre (produit, visage ou objet), détouré avec une ombre douce.
3. Élément de preuve en bas : prix barré, « nouveau », note ⭐, ou logo.
4. Marge de sécurité de 8 % sur les bords (les interfaces mangent les coins).

## Variantes à produire
- A : fond sombre + accent orange
- B : fond clair + accent noir
- C : version animée (3 s, zoom léger) pour les stories

## Prompt pour un générateur d'images (en anglais)
> ${what}, clean modern social media visual, bold typography space at the top, vibrant orange accent (#FF8A5B), soft studio lighting, high contrast, minimal background, 4k, no text

## Checklist avant publication
- [ ] Lisible en vignette (test : réduire l'image à 20 %)
- [ ] Aucun logo ni visuel protégé sans autorisation
- [ ] Exports : PNG (qualité) + JPG (léger)${feedback(task)}`;
}

function ads(task) {
  const [budget] = numbersIn(`${task.title} ${task.brief}`);
  const total = budget || 50;
  const daily = Math.max(5, Math.round(total / 7));
  return `# Plan de campagne — ${cap(subject(task))}

## Objectif
Ventes (ou messages) au meilleur coût par acquisition, test sur 7 jours.

## Budget
- Total : **${total} €** · environ **${daily} €/jour** pendant 7 jours
- Répartition : 70 % sur la meilleure audience, 30 % en test

## Structure
| Campagne | Ensemble de publicités | Audience | Budget |
|---|---|---|---|
| Conversions | Large (18-34 ans, France) | Intérêts mode / bons plans | ${Math.round(daily * 0.5)} €/j |
| Conversions | Similaire acheteurs | 1 % des clients | ${Math.round(daily * 0.3)} €/j |
| Conversions | Retargeting | Visiteurs 30 jours | ${Math.max(1, daily - Math.round(daily * 0.5) - Math.round(daily * 0.3))} €/j |

## 3 accroches à tester
1. « Tu payes encore plein pot ? »
2. « Les pépites que personne n'a vues (encore) »
3. « Ce que j'aurais aimé savoir avant d'acheter »

## Règles de décision
- CTR < 1 % après 1 000 impressions : changer le visuel
- CPA > marge par vente : couper l'ensemble de publicités
- ROAS > 2 pendant 3 jours : augmenter le budget de 20 %

## Suivi quotidien
Dépense · impressions · CTR · coût par clic · ventes · ROAS (à noter dans le tableau de bord de Rose).${feedback(task)}`;
}

function dataDoc(task) {
  const what = cap(subject(task));
  return `# ${/^tableau/i.test(what) ? what : `Tableau de bord — ${what}`}

## Indicateurs clés
| Indicateur | Formule | Objectif |
|---|---|---|
| Chiffre d'affaires | Σ prix de vente | +10 %/mois |
| Marge nette | CA − achats − frais − pub | > 35 % du CA |
| Taux de vente | articles vendus ÷ articles en ligne | > 30 %/mois |
| Délai moyen de vente | moyenne (date vente − date mise en ligne) | < 10 jours |
| Coût d'acquisition | dépenses pub ÷ ventes issues de la pub | < marge par vente |

## Modèle Google Sheets
Colonnes : \`Date | Article | Plateforme | Prix d'achat | Prix de vente | Frais | Pub | Marge\`
- Marge (H2) : \`=E2-D2-F2-G2\`
- Taux de marge : \`=SI(E2>0;H2/E2;"")\`
- Total du mois : \`=SOMME.SI.ENS(H:H;A:A;">="&DATE(2026;10;1))\`

## Lecture
1. Repérer les 20 % d'articles qui font 80 % de la marge : en racheter.
2. Tout article en ligne depuis plus de 21 jours : baisser de 10 % ou relancer.
3. Comparer les plateformes : garder celles où le délai de vente est le plus court.${feedback(task)}`;
}

function legal(task) {
  const text = norm(`${task.title} ${task.brief}`);
  const kind = /cgv|conditions generales/.test(text) ? "cgv" : /mentions/.test(text) ? "mentions" : /contrat/.test(text) ? "contrat" : /rgpd|confidentialite/.test(text) ? "rgpd" : "general";
  const body = {
    cgv: `## Article 1 — Objet
Les présentes conditions générales de vente régissent les ventes réalisées par [Nom / marque] auprès de clients consommateurs.

## Article 2 — Prix
Les prix sont indiqués en euros, toutes taxes comprises (ou « TVA non applicable, art. 293 B du CGI » en franchise en base).

## Article 3 — Commande et paiement
La commande est ferme après paiement. Moyens acceptés : [à compléter].

## Article 4 — Livraison
Expédition sous [X] jours ouvrés. Transporteurs : [à compléter]. Le risque est transféré au client à la livraison.

## Article 5 — Droit de rétractation
14 jours à compter de la réception (articles L221-18 et suivants du Code de la consommation). Frais de retour : [à la charge du client / offerts].

## Article 6 — Garanties
Garantie légale de conformité et garantie des vices cachés.

## Article 7 — Médiation et litiges
Coordonnées du médiateur de la consommation : [à compléter]. Droit applicable : droit français.`,
    mentions: `## Éditeur du site
[Nom, prénom ou raison sociale] — [statut, ex. micro-entreprise] — SIRET [à compléter] — adresse [à compléter] — e-mail [à compléter]

## Directeur de la publication
[Nom]

## Hébergeur
[Nom de l'hébergeur, adresse, téléphone]

## Propriété intellectuelle
Les contenus du site sont protégés ; toute reproduction sans autorisation est interdite.

## Données personnelles
Voir la politique de confidentialité (RGPD).`,
    contrat: `## Parties
Entre [Entreprise], ci-après « le Client », et [Prestataire], ci-après « le Prestataire ».

## Article 1 — Mission
Description précise des prestations, livrables et délais.

## Article 2 — Rémunération
Montant, modalités de facturation et de paiement (délai légal : 30 jours sauf accord).

## Article 3 — Propriété intellectuelle
Cession des droits sur les livrables : supports, territoires, durée (une cession doit être écrite et précise).

## Article 4 — Confidentialité
Engagement réciproque pendant le contrat et [2] ans après.

## Article 5 — Durée et résiliation
Durée, préavis et motifs de résiliation anticipée.

## Article 6 — Litiges
Recherche d'une solution amiable, puis tribunal compétent.`,
    rgpd: `## Données collectées
Nom, e-mail, adresse de livraison, historique de commandes.

## Finalités et bases légales
Exécution des commandes (contrat), prospection (consentement), obligations comptables (obligation légale).

## Durées de conservation
Clients : 3 ans après le dernier achat · Factures : 10 ans.

## Droits des personnes
Accès, rectification, effacement, opposition, portabilité : contact [e-mail]. Réclamation possible auprès de la CNIL.

## Sous-traitants
Hébergeur, prestataire de paiement, transporteurs.`,
    general: `## Situation
Résumé de la question et des faits connus.

## Ce que dit la règle (en bref)
- Point 1
- Point 2

## Ce que je recommande
1. Action immédiate
2. Document à préparer
3. Échéance à noter`,
  }[kind];
  return `# ${cap(subject(task))}

${body}

## Points à faire valider par un professionnel
- Adapter les champs entre crochets à ta situation exacte.
- Vérifier les règles et seuils en vigueur (service-public.fr, URSSAF, CNIL) : ils évoluent.
- Ce document est un modèle de travail, pas un avis d'avocat.${feedback(task)}`;
}

function admin(task) {
  return `# Démarche — ${cap(subject(task))}

## Étapes
1. **Rassembler les pièces** : identité, SIRET, relevés de la période, justificatifs.
2. **Se connecter au bon portail** : autoentrepreneur.urssaf.fr, impots.gouv.fr ou l'espace de l'organisme concerné.
3. **Remplir et vérifier** : montants, période, coordonnées bancaires.
4. **Valider et télécharger l'accusé de réception** (à ranger aux archives).
5. **Programmer le paiement** et noter la prochaine échéance au planning.

## Modèle de mail
> Bonjour,
> Je me permets de vous contacter au sujet de [objet]. Vous trouverez ci-joint [documents].
> Pourriez-vous me confirmer [demande] ?
> Bien cordialement,
> [Nom] — [SIRET]

## Échéances à surveiller
- [ ] Déclaration de chiffre d'affaires (mensuelle ou trimestrielle)
- [ ] Assurance et banque : renouvellements
- [ ] Factures fournisseurs à relancer

_Montants et dates exacts : toujours vérifier sur les sites officiels._${feedback(task)}`;
}

function hrDoc(task, agent) {
  const role = cap(subject(task).replace(/^(fiche de poste|annonce)\s+(pour\s+)?(un|une)?\s*/i, "")) || "Nouveau poste";
  return `# ${cap(subject(task))}

*Par ${agent?.name || "les RH"}*

## Le poste : ${role}
- **Missions** : 3 à 5 missions concrètes, avec des exemples réels de l'entreprise
- **Profil** : compétences indispensables vs « bonus »
- **Conditions** : freelance / stage / CDD, rythme, télétravail, rémunération (fourchette affichée = plus de candidatures)

## Annonce prête à publier
> On recrute ! 🚀 Notre petite équipe cherche un·e ${role.toLowerCase()} pour [mission phare].
> Tu aimes [compétence clé] et tu veux de l'autonomie ? Écris-nous avec 3 exemples de ton travail.

## Grille d'entretien (sur 5)
| Critère | Question | Note |
|---|---|---|
| Compétence | « Montre-moi ton meilleur projet et ce que tu changerais » | /5 |
| Autonomie | « Raconte une galère et comment tu l'as réglée » | /5 |
| Fiabilité | Test pratique court et rémunéré si long | /5 |
| Esprit d'équipe | « Comment tu réagis à une critique ? » | /5 |

## Intégration (première semaine)
J1 accès et outils · J2 binôme avec un collègue · J3 première mission simple · J5 point d'étonnement.

_Critères de sélection non discriminatoires, conformes au droit du travail._${feedback(task)}`;
}

function events(task, agent) {
  return `# ${cap(subject(task))} 🎈

*Organisé par ${agent?.name || "la team ambiance"}*

## Le plan
| Heure | Quoi |
|---|---|
| 17:30 | Rendez-vous en salle de repos (les chats sont invités) |
| 17:45 | Jeu brise-glace : « deux vérités, un mensonge » |
| 18:15 | Apéro + quiz sur l'entreprise |
| 19:00 | Remise d'un prix totalement inutile (et donc indispensable) |

## Budget
- Boissons et snacks : 40 €
- Déco : 10 €
- Prix : 10 €

## Liste de courses
Chips, softs, une boisson sans alcool sympa, gobelets, une enceinte, des croquettes premium pour Pixel, Mochi et Croquette.

## Règles d'or
Inclusif, sans pression, et on ne parle pas boulot après 18 h.${feedback(task)}`;
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
    case "design": return { kind: "visual", title: `Brief visuel — ${cap(subject(task))}`.slice(0, 140), content: design(task, agent) };
    case "ads": return { kind: "campaign", title: task.title, content: ads(task) };
    case "data": return { kind: "dashboard", title: task.title, content: dataDoc(task) };
    case "legal": return { kind: "legal", title: task.title, content: legal(task) };
    case "admin": return { kind: "legal", title: task.title, content: admin(task) };
    case "hr": return { kind: "hr", title: task.title, content: hrDoc(task, agent) };
    case "events": return { kind: "note", title: task.title, content: events(task, agent) };
    case "general": return agent?.role === "intern" ? { kind: "report", title: task.title, content: intern(task, agent) } : null;
    default: return null;
  }
}
