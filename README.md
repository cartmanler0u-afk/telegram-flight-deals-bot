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

Une mini app Telegram en 3D, façon mini-jeu de gestion : ton équipe d'agents IA travaille
dans un open space, et chaque pièce est un tableau de bord.

| Pièce | Agent(s) | Ce que tu y fais |
|---|---|---|
| 👔 **Bureau du Directeur** | Victor, directeur général | Confier une mission (il choisit le bon agent), **valider ou faire réviser** les dossiers importants, demander le **brief de direction**, registre des décisions |
| 📋 **Managers** (open space) | Manon (Pôle Production), Hugo (Pôle Organisation) | Organigramme, charge de chaque agent, rapports d'équipe, **recrutement** de nouveaux agents et managers |
| 🌐 **Studio Web** | Léo, architecte web | Commander un site (vitrine, landing, portfolio, restaurant…), **prévisualiser** le site livré, le recevoir en fichier `.html` dans Telegram |
| 📚 **Bibliothèque** | Iris, bibliothécaire | Tout ce qui est produit y est **stocké et classé** : recherche, filtres, étiquettes, épingles, dépôt de notes / liens / fichiers texte, inventaire |
| 📅 **Secrétariat** | Clara, secrétaire | Planning en **langage naturel** (« réunion client jeudi 15h30 »), agenda sur 14 jours, **rappels envoyés dans Telegram** |
| 🗒️ **Salle de réunion** | Noé, greffier | Réunion en direct avec prise de notes ; à la clôture, **compte rendu** + décisions + actions transformables en missions en un clic |
| ☕ **Cafétéria** | — | Journal d'activité du QG en temps réel |

Dans la 3D, les agents vivent leur journée : ils travaillent à leur poste (écrans allumés,
barre de progression au-dessus de la tête), le manager vient briefer l'agent quand une
mission arrive, l'agent va déposer son livrable à la bibliothèque puis présente les dossiers
importants au directeur, tout le monde rejoint la salle quand une réunion commence, et on
croise des collègues en pause café. Les écrans muraux affichent l'état réel du QG (KPI du
directeur, tableau kanban, agenda de l'accueil, minuteur de réunion, chantier du studio).

**Cycle d'une mission** : tu la confies (bouton **＋ Mission**, bureau du directeur ou fiche
d'un agent) → le directeur la route vers l'agent compétent → l'agent la traite (une à la
fois, par priorité) → le livrable est rangé en bibliothèque. Les missions **hautes** ou
**critiques** et les dossiers stratégiques reviennent dans le bureau du directeur pour ta
validation (✅ valider ou ↩️ demander une révision avec un commentaire).

### Avec ou sans IA

- **Sans clé API** : tout fonctionne, les agents produisent leurs livrables à partir de
  modèles intégrés (sites HTML responsives, rapports, notes de décision, comptes rendus…).
- **Avec `ANTHROPIC_API_KEY`** : chaque agent travaille réellement avec l'IA Claude, avec un
  rôle et des consignes propres (le studio web code des pages complètes, la secrétaire
  transforme tes demandes en rendez-vous structurés, le greffier extrait décisions et
  actions…). Modèle par défaut : `claude-opus-5-5` (modifiable via `ANTHROPIC_MODEL`, ex.
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
   `OFFICE_NOTIFICATIONS=false` pour couper les notifications du QG.

Le QG t'envoie dans Telegram : les **rappels** du planning, les **dossiers à valider**, les
livraisons et les comptes rendus prêts.

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

Tests automatisés (moteur, dates, signature Telegram, API, générateur IA) : `npm test`.

### Architecture

```
webapp/                    Mini app (servie telle quelle, sans étape de build)
  index.html, css/         Interface (HUD, dock des pièces, panneaux, modales)
  js/scene/                3D Three.js : plan de l'étage, mobilier, personnages, pathfinding A*
  js/ui/                   Tableaux de bord de chaque pièce, composants, rendu Markdown sûr
  js/backend.js            API du bot (dans Telegram) ou simulation locale (mode démo)
  shared/                  Moteur métier partagé navigateur/serveur (missions, planning,
                           réunions, bibliothèque, recrutements, modèles de livrables)
src/office/                Serveur Express, authentification Telegram, persistance Supabase,
                           agents IA (prompts + appels Claude), notifications
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
