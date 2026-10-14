# Telegram Flight Deals Bot ✈️

Bot Telegram qui "drop" (poste automatiquement) des bons plans billets d'avion dans un
salon ou canal Telegram, à intervalle régulier.

Il embarque aussi un **QG des agents IA** : une mini app Telegram en 3D (un open space
avec directeur, managers, studio web, bibliothèque, secrétariat et salle de réunion) pour
piloter une équipe d'agents IA. Voir [QG des agents IA](#-qg-des-agents-ia-mini-app-3d).

## Fonctionnement

Le bot combine deux sources de bons plans, toutes les deux optionnelles :

1. **Flux RSS** — vous configurez une ou plusieurs URL de flux RSS de sites de bons
   plans voyage (via `/addfeed`). Le bot les relit périodiquement et poste les
   nouveaux articles dans le salon configuré. C'est la méthode la plus simple :
   aucune clé API n'est nécessaire.
2. **Recherche par route (optionnelle)** — si vous fournissez une clé API
   [Kiwi Tequila](https://tequila.kiwi.com/portal/docs/tequila_api), vous pouvez
   surveiller des routes précises avec un prix plafond (ex: Paris → Bangkok sous
   400€) via `/addroute`.

Un cycle de recherche tourne toutes les `CHECK_INTERVAL_MINUTES` minutes (30 par
défaut) et ne repost jamais deux fois le même bon plan (dédoublonnage par id).

## Prérequis

- Node.js 18 ou supérieur
- Un bot Telegram créé via [@BotFather](https://t.me/BotFather)

## Installation

```bash
npm install
cp .env.example .env
```

Puis éditez `.env` :

### 1. `TELEGRAM_BOT_TOKEN`

1. Ouvrez une conversation avec [@BotFather](https://t.me/BotFather) sur Telegram
2. Envoyez `/newbot` et suivez les instructions (nom, username se terminant par `bot`)
3. BotFather vous donne un token du type `123456789:ABCdefGhIJKlmNoPQRstuVWXyz` — collez-le
   dans `TELEGRAM_BOT_TOKEN`

### 2. `TELEGRAM_CHANNEL_ID` (optionnel)

Vous pouvez laisser ce champ vide et utiliser la commande `/setchannel` une fois le
bot lancé (envoyée dans le salon/groupe/canal cible, avec le bot déjà ajouté dedans
et admin si c'est un canal).

Pour le renseigner directement dans `.env` :
- Pour un groupe/canal, ajoutez le bot au groupe/canal (en administrateur pour un
  canal), puis envoyez un message dans ce salon et consultez
  `https://api.telegram.org/bot<VOTRE_TOKEN>/getUpdates` dans un navigateur : le champ
  `chat.id` apparaît dans la réponse JSON (négatif pour un groupe/canal).

### 3. `ADMIN_USER_IDS`

Liste des identifiants Telegram (séparés par des virgules) autorisés à utiliser les
commandes d'administration. Pour connaître votre ID, parlez à un bot comme
`@userinfobot` sur Telegram. Laissez vide pour désactiver la restriction (déconseillé
si le bot est ajouté à un groupe public).

### 4. `KIWI_API_KEY` (optionnel)

Créez un compte développeur sur [Tequila by Kiwi.com](https://tequila.kiwi.com/) pour
obtenir une clé API gratuite, si vous voulez utiliser la surveillance par route
(`/addroute`) en plus des flux RSS. Sans clé, cette fonctionnalité est simplement
désactivée et le bot fonctionne avec les flux RSS seuls.

### 5. `SUPABASE_URL` / `SUPABASE_SECRET_KEY`

Le bot stocke ses données (salon cible, flux RSS, routes surveillées, historique des
bons plans déjà postés) dans une base PostgreSQL Supabase, obligatoire pour lancer
le bot.

1. Créez un compte gratuit sur [supabase.com](https://supabase.com/) et un nouveau
   projet
2. Dans le tableau de bord du projet : **SQL Editor** → **New query**, collez le
   contenu de [`schema.sql`](./schema.sql) fourni dans ce repo, puis **Run** — cela
   crée les tables nécessaires (`bot_settings`, `feeds`, `routes`, `seen_deals`)
3. Allez dans **Project Settings** → **API** :
   - **Project URL** → à mettre dans `SUPABASE_URL`
   - **service_role secret key** → à mettre dans `SUPABASE_SECRET_KEY` (⚠️ ne
     jamais exposer cette clé publiquement, elle contourne les règles de sécurité
     de la base)

## Lancer le bot

```bash
npm start
```

## Trouver des flux RSS de bons plans voyage

Ce bot ne fournit aucun flux RSS par défaut : à vous de choisir vos sources. Quelques
pistes :

- Cherchez `"nom du site" + rss feed` pour les sites de bons plans voyage que vous
  suivez déjà — beaucoup exposent une URL `/feed` ou `/rss`.
- Pour un site sans flux natif, des générateurs tiers comme
  [RSS.app](https://rss.app/) ou [RSSHub](https://docs.rsshub.app/) permettent de
  créer un flux RSS à partir d'une page web.
- Vérifiez toujours les conditions d'utilisation du site source avant de repartager
  son contenu automatiquement.

Ajoutez ensuite chaque flux avec `/addfeed <url>` directement dans Telegram.

## Commandes disponibles

| Commande | Description | Accès |
|---|---|---|
| `/help` | Liste des commandes | Tous |
| `/setchannel` | Définit le salon courant comme destination des drops | Admin |
| `/addfeed <url>` | Ajoute un flux RSS | Admin |
| `/removefeed <url>` | Retire un flux RSS | Admin |
| `/listfeeds` | Liste les flux configurés | Tous |
| `/addroute <ORIGINE> <DEST> <PRIX_MAX> [devise]` | Surveille une route (nécessite `KIWI_API_KEY`) | Admin |
| `/removeroute <id>` | Retire une route surveillée | Admin |
| `/listroutes` | Liste les routes surveillées | Tous |
| `/testdrop` | Force un cycle de recherche immédiat | Admin |
| `/office` (ou `/qg`) | Ouvre le QG 3D des agents IA (mini app) | Admin |

## 🏢 QG des agents IA (mini app 3D)

Une mini app Telegram en 3D, façon mini-jeu de gestion avec la DA de la série *The Office* :
toute ton entreprise (27 employés IA répartis en 7 pôles) travaille sur un plateau de bureaux,
et chaque pièce est un tableau de bord.

### Les pôles et l'équipe

| Pôle | Équipe | Ce que tu y fais |
|---|---|---|
| 👔 **Direction** | Victor (directeur général), Bertrand (directeur adjoint, process & discipline) | Confier une mission (le directeur choisit le bon pôle), **valider ou faire réviser** les dossiers importants, **brief de direction**, registre des décisions, vue d'ensemble de l'entreprise |
| 🛍️ **Vente** | Sabrina (manager), Inès (Vinted), Tom (photo produit), Moussa (logistique & expéditions), Lucie (SAV) | **Annonce Vinted express** (titre, description, prix, mots-clés), shootings, préparation des colis, réponses aux acheteurs |
| 🔎 **Sourcing & Bons plans** | Karim (manager), Jade (sourceuse), Lucas (dénicheur vols & voyages), Emma (dénicheuse promos & pépites à revendre) | **Lancer une chasse**, fil des **bons plans dénichés** (transformables en mission d'analyse), **veille automatique** sur tes sujets |
| 📱 **Social & Contenu** | Manon (manager), Yanis (Snapchat), Sofia (canaux Telegram), Enzo (montage TikTok), Zoé (rédaction) | Commande de **montage TikTok** (hook, découpage, sous-titres, musique), stories Snap, posts Telegram, textes |
| 🌐 **Studio Web & Tech** | Paul (manager), Léo (architecte web), Max (automatisations & bots) | Sites complets **prévisualisables** et envoyés en `.html` dans Telegram, scripts et bots |
| 💎 **Créateurs** | Chloé (talent manager) | Préparation du futur pôle OFM : feuille de route de lancement, recrutement, planning de contenu — strictement pro (créatrices majeures et consentantes, règles des plateformes, contrats clairs) |
| 🗂️ **Organisation** | Hugo (manager), Clara (accueil & planning), Iris (archives), Noé (greffier), Bruno (comptable), Josiane (entretien), Kylian (stagiaire) | Planning en langage naturel avec **rappels Telegram**, **archives** (recherche, filtres, corbeille), **salle de conférence** (notes → compte rendu + décisions + actions), **calculette de marge** et missions compta |

Le dock en bas de l'écran donne accès à chaque pièce : Direction, Vente, Bons plans, Social,
Web, Créateurs, Archives, Planning, Réunion, **Cuisine**, **Annexe** et Équipes
(organigramme, charge de chacun, **recrutement** dans n'importe quel pôle).

**Cycle d'une mission** : tu la confies (bouton **＋ Mission**, une pièce, ou la fiche d'un
employé) → le directeur (ou le pôle choisi) la route vers la bonne personne → elle la traite
(une à la fois, par priorité) → le livrable est rangé aux archives. Les missions **hautes**
ou **critiques** et les dossiers stratégiques reviennent dans le bureau du directeur pour ta
validation (✅ valider ou ↩️ demander une révision avec un commentaire).

### La vie de bureau

Les employés ont leur vie (côté affichage uniquement, ça ne touche pas aux missions) :
pause café et potins à la fontaine, **commandes Uber Eats** livrées par un coursier, micro-ondes
qui sent le poisson, sieste au bureau, baby-foot, chips coincées dans le distributeur… et des **blagues** façon
*The Office* : corbeille vidée sur un bureau, agrafeuse dans la gelée, écran couvert de
post-its, mots doux sur le tableau blanc de la cuisine. Après une blague, la victime passe
parfois en **interview face caméra** (style documentaire, un caméraman se promène dans les
bureaux). Depuis la **Cuisine** tu peux déclencher un pot surprise, un Uber Eats pour l'équipe,
un exercice incendie, l'élection de l'employé du mois, une réunion improvisée, ou écrire
toi-même sur le tableau blanc.

### Ménage et cache

Josiane, l'agente d'entretien, fait sa **tournée de ménage automatiquement toutes les 8 h**
(ou à la demande depuis l'**Annexe**) : elle vide la corbeille, allège le journal, retire les
vieilles missions annulées, les rendez-vous passés et les bons plans expirés, puis range un
**rapport de ménage** aux archives. Le cache des documents est aussi vidé dans l'app. Les
livrables ne sont jamais supprimés : un document supprimé passe d'abord par la corbeille
(restaurable depuis l'Annexe).

### Bons plans

- Chaque bon plan posté par le bot de vols dans ton canal arrive aussi chez **Lucas**, le
  dénicheur vols & voyages du QG.
- Avec une clé API, les dénicheurs et la sourceuse font de **vraies recherches web** et citent
  leurs sources (désactivable avec `ANTHROPIC_WEB_SEARCH=false`, ou automatiquement si la
  recherche web n'est pas activée sur ton compte Anthropic).
- La **veille automatique** (pièce Bons plans) lance une chasse toutes les N heures sur les
  sujets que tu choisis. Avec l'IA, chaque veille est un appel API avec recherche web : garde
  une fréquence raisonnable (12 h par défaut) pour maîtriser les coûts.

### Avec ou sans IA

- **Sans clé API** : tout fonctionne, les agents produisent leurs livrables à partir de
  modèles intégrés (sites HTML responsives, annonces Vinted, plans de montage, calculs de
  marge, méthodes de veille, rapports, notes de décision, comptes rendus…).
- **Avec `ANTHROPIC_API_KEY`** : chaque agent travaille réellement avec l'IA Claude, avec un
  rôle, une personnalité et des consignes propres (le studio web code des pages complètes,
  Inès rédige des annonces Vinted prêtes à publier, Enzo écrit des plans de montage TikTok,
  la secrétaire transforme tes demandes en rendez-vous structurés, le greffier extrait
  décisions et actions, les dénicheurs cherchent sur le web…). Modèle par défaut : `claude-opus-5-5` (modifiable via `ANTHROPIC_MODEL`, ex.
  `claude-sonnet-5-5` ou `claude-haiku-5-5` pour réduire les coûts ; effort réglable via
  `ANTHROPIC_EFFORT`). Si l'IA échoue, l'agent livre quand même grâce aux modèles.

### Mise en route

1. **Base de données** : ré-exécutez [`schema.sql`](./schema.sql) dans l'éditeur SQL de
   Supabase (il crée la table `office_state`, sans toucher aux autres).
2. **`ADMIN_USER_IDS`** : fortement recommandé. Seuls ces utilisateurs peuvent ouvrir le QG ;
   sans restriction, n'importe qui trouvant le bot aurait son propre QG (et consommerait
   votre clé API).
3. **Déployez** le bot chez un hébergeur qui fournit une adresse **https** publique
   (Railway, Render, Fly.io…). Le bot lance un serveur HTTP sur `PORT` (fourni
   automatiquement par la plupart des hébergeurs, 3000 sinon).
4. **`WEBAPP_URL`** : renseignez cette adresse https (ex.
   `https://mon-bot.up.railway.app`) puis redémarrez. Le bot ajoute alors un bouton
   **🏢 QG** à côté du champ de saisie, et `/office` envoie un bouton pour ouvrir la mini app.
   Aucune configuration BotFather n'est nécessaire.
5. Optionnel : `ANTHROPIC_API_KEY` (clé sur [console.anthropic.com](https://console.anthropic.com/)),
   `ANTHROPIC_WEB_SEARCH=false` pour couper la recherche web des dénicheurs,
   `OFFICE_NOTIFICATIONS=false` pour couper les notifications du QG.

Le QG t'envoie dans Telegram : les **rappels** du planning, les **dossiers à valider**, les
livraisons et les comptes rendus prêts.

Les QG créés avec la première version (7 agents) sont **migrés automatiquement** au premier
chargement : missions, documents et planning sont conservés, et les 20 nouveaux collègues
arrivent dans leurs pôles.

### Tester en local

```bash
npm run office:dev
```

Ouvrez http://localhost:3000 : sans Telegram, le QG démarre en **mode démo** (tout tourne
dans le navigateur, données gardées localement). Ce script n'a besoin ni du token Telegram
ni de Supabase ; avec `ANTHROPIC_API_KEY` dans `.env`, l'API locale utilise l'IA. Pour
l'essayer *dans* Telegram avant de déployer, exposez le port en https avec un tunnel
(`cloudflared tunnel --url http://localhost:3000`, ngrok…) et mettez cette URL dans
`WEBAPP_URL`.

Tests automatisés (moteur, routage des missions, ménage, bons plans, migration, dates,
signature Telegram, API, générateur IA et recherche web) : `npm test`.

Sur un téléphone d'entrée de gamme, la 3D baisse d'elle-même sa qualité (ombres, résolution)
si l'image saccade.

### Architecture

```
webapp/                    Mini app (servie telle quelle, sans étape de build)
  index.html, css/         Interface (HUD, dock des pièces, panneaux, modales)
  js/scene/                3D Three.js : plan de l'étage, mobilier, personnages (rendu
                           instancié), pathfinding A*, vie de bureau (life.js)
  js/ui/                   Tableaux de bord des pièces et des pôles, cuisine, annexe,
                           composants, rendu Markdown sûr
  js/backend.js            API du bot (dans Telegram) ou simulation locale (mode démo)
  shared/                  Moteur métier partagé navigateur/serveur (équipe et pôles, missions,
                           planning, réunions, archives, ménage, bons plans, modèles de livrables)
src/office/                Serveur Express, authentification Telegram, persistance Supabase,
                           agents IA (prompts + appels Claude + recherche web), notifications,
                           pont avec le bot de vols (bridge.js)
src/commands/office.js     Commandes /office et /qg
```

Sécurité : chaque requête de la mini app est authentifiée par la signature `initData` de
Telegram (HMAC avec le token du bot) ; chaque utilisateur a son propre QG ; les sites
générés sont prévisualisés dans une iframe isolée (`sandbox`).

## Déploiement

Le bot tourne en `bot.launch()` (long polling), donc n'importe quel hébergeur
Node.js qui garde un processus actif fonctionne : un VPS avec `pm2`, Railway,
Render, Fly.io, etc. Il sert aussi la mini app du QG sur `PORT` : pour l'ouvrir dans
Telegram, l'hébergeur doit l'exposer en https (voir `WEBAPP_URL`). La persistance (`data/store.json`) doit se trouver sur un
disque qui survit aux redéploiements si vous voulez conserver vos flux, routes et
l'historique de dédoublonnage.

## Licence

ISC
