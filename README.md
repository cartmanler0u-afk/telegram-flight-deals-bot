# Telegram Flight Deals Bot ✈️

Bot Telegram qui "drop" (poste automatiquement) des bons plans billets d'avion dans un
salon ou canal Telegram, à intervalle régulier.

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

## Déploiement

Le bot tourne en `bot.launch()` (long polling), donc n'importe quel hébergeur
Node.js qui garde un processus actif fonctionne : un VPS avec `pm2`, Railway,
Render, Fly.io, etc. La persistance (`data/store.json`) doit se trouver sur un
disque qui survit aux redéploiements si vous voulez conserver vos flux, routes et
l'historique de dédoublonnage.

## Licence

ISC
