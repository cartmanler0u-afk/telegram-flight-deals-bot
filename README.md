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
   crée les tables nécessaires (`bot_settings`, `feeds`, `routes`, `seen_deals`,
   `office_state` pour le QG et `madhouse_world` pour le Bâtiment 0)
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
| `/building` (ou `/batiment`) | Bâtiment 0 : vue d'ensemble + menu à boutons | Admin |
| `/report` | Rapport « Pendant ton absence » (+ boutons de décision) | Admin |
| `/news` `/floors` `/agents` `/agent <nom>` | Actualités, étages, occupants, fiche d'un personnage | Admin |
| `/organizations` `/economy` `/laws` `/plots` | Organisations, économie, lois & tribunal, intrigues | Admin |
| `/mysteries` `/investigate` `/rumors` `/anomalies` `/history` | Mystères (mandater un enquêteur), rumeurs, anomalies, chronique | Admin |
| `/madhouse_config` | Réglages : cycle, pause, notifications, IA narrative | Admin |

## 🏢 QG des agents IA (mini app 3D)

Une mini app Telegram en 3D, façon mini-jeu de gestion avec la DA de la série *The Office* :
toute ton entreprise (38 employés IA dont 4 stagiaires, répartis en 10 pôles, et 3 chats)
travaille sur un plateau de bureaux avec une aile Est, et chaque pièce est un tableau de bord.

### Les pôles et l'équipe

| Pôle | Équipe | Ce que tu y fais |
|---|---|---|
| 👔 **Direction** | Victor (directeur général), Bertrand (directeur adjoint, process & discipline) | Confier une mission (le directeur choisit le bon pôle), **valider ou faire réviser** les dossiers importants, **brief de direction**, registre des décisions, vue d'ensemble de l'entreprise |
| 🛍️ **Vente** | Sabrina (manager), Inès (Vinted), Tom (photo produit), Moussa (logistique & expéditions), Lucie (SAV) | **Annonce Vinted express** (titre, description, prix, mots-clés), shootings, préparation des colis, réponses aux acheteurs |
| 🔎 **Sourcing & Bons plans** | Karim (manager), Jade (sourceuse), Lucas (dénicheur vols & voyages), Emma (dénicheuse promos & pépites à revendre) | **Lancer une chasse**, fil des **bons plans dénichés** (transformables en mission d'analyse), **veille automatique** sur tes sujets |
| 📱 **Social & Contenu** | Manon (manager), Yanis (Snapchat), Sofia (canaux Telegram), Enzo (montage TikTok), Zoé (rédaction) | Commande de **montage TikTok** (hook, découpage, sous-titres, musique), stories Snap, posts Telegram, textes |
| 🌐 **Studio Web & Tech** | Paul (manager), Léo (architecte web), Max (automatisations & bots) | Sites complets **prévisualisables** et envoyés en `.html` dans Telegram, scripts et bots |
| 💎 **Créateurs** | Chloé (talent manager) | Préparation du futur pôle OFM : feuille de route de lancement, recrutement, planning de contenu — strictement pro (créatrices majeures et consentantes, règles des plateformes, contrats clairs) |
| 🎨 **Marketing & Création** | Margaux (manager), Nina (graphiste & DA), Malik (growth & pub), Rose (data) | **Briefs visuels** (miniatures, logos, bannières, avec prompt pour générateur d'images), **campagnes pub** Meta/TikTok/Snap (budget, ciblage, accroches, seuils de décision), **tableaux de bord** de ventes et de réseaux |
| ⚖️ **Juridique & Admin** | Sandrine (juriste), Gilles (assistant administratif) | CGV, mentions légales, RGPD, contrats (freelances, créatrices), démarches URSSAF / impôts / banque — toujours avec les « points à faire valider par un professionnel » ; recherche web avec une clé API |
| 🤝 **RH & Vie d'équipe** | Gérard (RH, souffre-douleur de Victor), Amandine (Chief Happiness Officer, responsable des chats) | Fiches de poste, recrutement de freelances, intégration ; **relations entre collègues**, **potins officiels**, **stagiaires à embaucher en CDI** |
| 🗂️ **Organisation** | Hugo (manager), Clara (accueil & planning), Iris (archives), Noé (greffier), Bruno (comptable), Josiane (entretien) | Planning en langage naturel avec **rappels Telegram**, **archives** (recherche, filtres, corbeille), **salle de conférence** (notes → compte rendu + décisions + actions), **calculette de marge** et missions compta |
| 🧃 **Stagiaires** | Kylian (organisation), Lina (vente), Théo (social), Sacha (tech) | Ils partagent le coin des stagiaires, ont le manager de leur pôle comme tuteur… et peuvent décrocher un CDI |

Le dock en bas de l'écran donne accès à chaque pièce : Direction, Vente, Bons plans, Social,
Web, Créateurs, Marketing, Juridique, Archives, Planning, Réunion, **Quêtes**, **RH**,
**Repos**, **Cuisine**, **Annexe** et Équipes (organigramme, charge de chacun, **recrutement**
dans n'importe quel pôle, y compris des stagiaires).

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
un exercice incendie, une réunion improvisée, ou écrire toi-même sur le tableau blanc ; depuis
la **Salle de repos** : pause câlins avec les chats, cours de yoga, karaté de Bertrand, tournoi
de console, tournée de cafés du stagiaire… ou le chili de Bruno.

### Relations, potins et running gags

L'entreprise a une vraie vie sociale, enregistrée avec ton QG (elle continue même quand
l'app est fermée) :

- **Relations** : amitiés, meilleurs potes, crushs secrets, couples (toujours entre collègues
  sans lien hiérarchique, jamais avec le patron ni les stagiaires), rivalités et ex. Elles
  évoluent toutes seules au fil des jours et se voient dans les bureaux (pauses en amoureux,
  excuses bidon pour passer au bureau de son crush, disputes à la photocopieuse…).
- **Potins officiels** toutes les quelques heures, **anniversaires** de chaque employé (gâteau
  en salle de conf'), et un **bandeau d'actualités** façon chaîne d'info en bas de l'écran.
- **Running gags** : Victor qui harcèle Gérard des RH (et remplit la boîte à suggestions de
  « Virer Gérard »), le chili de Bruno renversé sur la moquette, le panneau « jours sans
  incident » toujours à zéro, le karaté de Bertrand à la salle de sport, le stagiaire et sa
  tournée de cafés (personne n'a la bonne commande), Pixel qui dort sur les claviers…
- **Les chats** (Pixel, Mochi, Croquette) vivent dans la salle de repos : siestes sur les
  claviers, la photocopieuse ou le bureau du directeur, poursuite des collègues, mendicité au
  frigo. Touche un chat pour lui faire un câlin ; depuis la salle de repos tu peux les nourrir,
  les renommer ou en adopter jusqu'à cinq.
- Les bulles de dialogue sont limitées et empilées pour rester lisibles, et les notifications
  identiques sont regroupées.

### Employé du mois : les quêtes

Chaque mois, trois employés sont nominés (Victor s'auto-nomine, refusé par les RH). Chaque
nominé a deux quêtes, à résoudre depuis le dock **🏆 Quêtes** :

- 🕵️ **Enquête** : un nominé est accusé d'une blague ; lis les alibis, interroge les témoins,
  et démasque le seul suspect qui ment (une seule accusation possible).
- 🔎 **Cache-cache** : un objet (ou un chat !) a disparu ; un indice donne la zone, il faut le
  trouver dans les bureaux en 3D et le toucher.
- 🤝 **Médiation** : deux collègues sont fâchés ; choisis la réconciliation qui colle au
  caractère de la personne vexée.
- ❓ **Quiz du vendredi** : trois questions sur ton entreprise (qui dirige qui, quel pôle,
  quel métier).
- 💼 **Mission** : confie de vraies missions au nominé ; la quête se valide quand elles sont
  livrées.

Chaque quête réussie rapporte des ⭐ au nominé. Dès trois quêtes terminées, lance la
**cérémonie** : toute l'équipe se réunit devant le totem de l'entrée, confettis, discours,
trophée sur le bureau du gagnant, badge 🏆 au-dessus de sa tête et entrée au **mur des
champions** du bureau RH. Au changement de mois, la cérémonie a lieu automatiquement et une
nouvelle élection démarre (tu peux aussi relancer une édition juste après une cérémonie).

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

Les QG créés avec une version précédente sont **migrés automatiquement** au premier
chargement : missions, documents et planning sont conservés, et les nouveaux collègues (aile
Est, stagiaires, chats) arrivent dans leurs pôles.

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

Tests automatisés (moteur, routage des missions, ménage, bons plans, migrations, vie sociale,
quêtes et cérémonie, chats, stagiaires, dates, signature Telegram, API, générateur IA et
recherche web) : `npm test`.

Sur un téléphone d'entrée de gamme, la 3D baisse d'elle-même sa qualité (ombres, résolution)
si l'image saccade.

### Architecture

```
webapp/                    Mini app (servie telle quelle, sans étape de build)
  index.html, css/         Interface (HUD, dock des pièces, panneaux, modales)
  js/scene/                3D Three.js : plan de l'étage, mobilier, personnages (rendu
                           instancié), chats (cats.js), pathfinding A*, vie de bureau (life.js)
  js/ui/                   Tableaux de bord des pièces et des pôles, cuisine, annexe,
                           composants, rendu Markdown sûr
  js/backend.js            API du bot (dans Telegram) ou simulation locale (mode démo)
  shared/                  Moteur métier partagé navigateur/serveur (équipe et pôles, missions,
                           planning, réunions, archives, ménage, bons plans, modèles de livrables,
                           vie sociale et quêtes de l'employé du mois dans social.js)
src/office/                Serveur Express, authentification Telegram, persistance Supabase,
                           agents IA (prompts + appels Claude + recherche web), notifications,
                           pont avec le bot de vols (bridge.js)
src/commands/office.js     Commandes /office et /qg
```

Sécurité : chaque requête de la mini app est authentifiée par la signature `initData` de
Telegram (HMAC avec le token du bot) ; chaque utilisateur a son propre QG ; les sites
générés sont prévisualisés dans une iframe isolée (`sandbox`).

## 🏚️ THE MADHOUSE — le Bâtiment 0

Ton entreprise (le QG 3D) occupe l'**Étage 11** d'un immeuble fictif, absurde et persistant
qui vit **sans toi** et se **visite** depuis Telegram ou la mini app : 16 niveaux, 98 pièces,
~250 habitants qui se déplacent réellement de pièce en pièce, travaillent, mangent, dorment,
se disputent, se lient, complotent et font circuler des rumeurs. Tout est simulé, rien n'est
réel : **aucune transaction financière réelle, aucune publication, aucune action extérieure**.

### L'immeuble

| Niveau | Étage | Exemples de pièces |
| --- | --- | --- |
| 13 | Bureau du Propriétaire (toi) | Bureau, Salle des Écrans, Coffre des Décisions |
| 12 | Serres & Serveurs | serres, salle des serveurs, chaufferie |
| 11 | Ton entreprise | open space, direction, cuisine, salle de repos des chats |
| 10 | **Étage fantôme** | absent du Plan Officiel ; ouvert seulement certains soirs, avec ses propres règles |
| 9 | Tribunal des Couloirs | audience, greffe, enquêtes, scellés |
| 8 | Hôtel des Employés | ailes A/B/C (on y dort), salon, cuisine, buanderie |
| 7 | Club des Puissants | salon, dîner, fumoir (réservé aux membres) |
| 6 | Parlement Interne | Hémicycle, commissions, buvette, lobby |
| 5 | Laboratoires | labo, prototypes, IA, réserve |
| 4 | Médias Internes | Gazette, télé, podcast, com, influence |
| 3 | Bourse Interne | corbeille, banque, start-up, biscuiterie |
| 2 | Direction | réunions A/B, finances, Registre |
| 1 | Ressources Humaines | entretiens, évaluations, séminaire |
| 0 | Accueil & Cirque | Hall (aquarium de Gustave, pigeon Roucoulade), cafétéria, plaintes |
| -1 | Logistique | quai, entrepôt, objets trouvés, marché noir |
| -2 | Département des choses qui ne devraient pas exister | archives interdites, pièce inconnue |

Chaque pièce a un identifiant, une description, une fonction, des accès (public, personnel,
membres, propriétaire, caché, fantôme), des sorties, des objets et un journal de ce qui s'y
est passé. Les présents d'une pièce sont **calculés à partir de la vraie position** de chacun.

### Les habitants

22 personnages écrits à la main (la concierge, la Syndic, le juge, le banquier, le homard
Gustave…), tes employés et tes chats, et un **générateur déterministe** qui complète jusqu'à
la population choisie (250 par défaut, répartie par service — configurable). Chacun a :
identité, âge, métier, service, étage de travail et chambre, personnalité (traits, goûts,
défauts, peurs, ambitions, habitudes, compétences), humour (14 styles : bureaucratie absurde,
culture startup, sitcom, complot, méta…), ressources (crédits, réputation, influence),
objectifs court/long terme, secrets, souvenirs, croyances, besoins (énergie, faim, vie sociale,
stress) et humeur, relations **asymétriques** (A peut détester B qui l'adore), historique de
carrière.

### La vie autonome

- **Emplois du temps** : travail en semaine, pauses, déjeuner, soirée, week-end, sommeil
  (couche-tard, lève-tôt). Les déplacements passent par l'Ascenseur B (qui a son caractère)
  ou l'escalier ; les accès, couvre-feux et lois s'appliquent.
- **Interactions de proximité** : seuls les gens **dans la même pièce** se parlent, se
  disputent, se confient un secret, se transmettent une rumeur (crue, mise en doute ou
  exploitée). Une information privée ne devient publique que si elle se propage vraiment.
- **Événements probabilistes** : 29 modèles (14 courants, 8 rares, 3 très rares,
  4 légendaires) avec préconditions, heures, temps de recharge et probabilité réglable (chaos,
  multiplicateurs de rareté).
- **Journées légendaires** (environ une par mois de simulation, chacune change vraiment le
  Bâtiment pendant des heures, puis se termine par un événement de fin) :
  - **La grève de l'Ascenseur B** : escalier seulement, personne ne monte plus de trois
    étages à pied ; les habitants des étages lointains restent coincés.
  - **La Fête du Bâtiment** (vendredi ou samedi soir, si l'ambiance est bonne) : jusqu'à
    120 habitants descendent au Hall ; liens créés, buffet payé par le Syndic.
  - **La panne générale** : les bureaux se vident vers les lieux éclairés, tout le monde
    passe à la lampe de poche, le distributeur de café tombe en panne (pour longtemps).
  - **Le Jour du Lendemain** : l'Étage fantôme ouvre en plein jour ; un curieux en rapporte un
    dossier daté de demain (une hypothèse, jamais présentée comme un fait), et ceux qui y
    traînent à la fermeture disparaissent. 8 **arcs systémiques** sur plusieurs jours (la caisse noire, le portrait qui
  disparaît, le syndicat des pigeons, les colis volatilisés, le séminaire de cohésion, la
  machine à café, la photo compromettante, le vice-président de quelque chose) avec étapes,
  indices, conséquences et dénouements.
- Économie virtuelle (salaires, loyers, prêts, faillites, start-up), Parlement (lois qui
  changent vraiment la simulation), Tribunal, Médias (articles exacts, biaisés ou faux),
  mystères à la vérité tirée au sort, anomalies, et le **Chaos Director** qui relie des
  éléments existants en intrigues persistantes.
- **Humour contextuel** : running gags (l'Ascenseur B, Gustave, le pigeon, la machine à café,
  Kevin du 3e…), répliques choisies selon le style d'humour du personnage et la situation —
  des mécanismes, pas des scripts recopiés.

### Explorer

- **Telegram** : `/building` ouvre le menu principal (Explorer, Annuaire, Actualités,
  Enquêtes, Entreprises, Politique, Anomalies, Historique, Centre de contrôle). On navigue
  étage → pièce → personnage dans **un seul message** édité, avec retour et pagination.
  Raccourcis : `/explore`, `/agents`, `/agent <nom>`, `/news`, `/investigate`, `/economy`,
  `/organizations`, `/anomalies`, `/history`, `/control`, `/report`.
- **Mini app** : bouton **Bâtiment** du dock → coupe de l'immeuble, plans d'étage, pièces avec
  leurs présents, fiches complètes, annuaire filtrable, actualités, enquêtes, entreprises,
  politique, anomalies, historique et Centre de contrôle.
- Aucun écran n'invente rien : tout est construit à partir de l'état réel du monde.

### Visiter les étages en 3D (Ascenseur B)

Dans la mini app, le bouton **🛗** du HUD ouvre l'Ascenseur B : chaque étage du Bâtiment se
visite en 3D, comme le QG (qui reste l'Étage 11).

- **Le plan est généré à partir des vraies pièces** de l'étage (palier et ascenseurs à l'ouest,
  couloir central, une porte par pièce) et chaque pièce est meublée selon sa fonction : bureaux,
  Hémicycle en gradins, salle d'audience avec l'estrade du juge, Cafétéria, Bourse et son
  bandeau de cours, labos et leurs fioles, studio TV « ON AIR », serres, salle des serveurs,
  entrepôt, Hôtel « capsule » (près de 100 couchettes par aile), aquarium de Gustave, bureau
  du Propriétaire et son bouton rouge, cubes flottants du Département -2 et de l'Étage fantôme…
- **Chaque habitant est là où il est vraiment**, en train de faire ce qu'il fait vraiment
  (travail, réunion, repas, sieste, file d'attente…). Le juge siège sur l'estrade, le personnel
  derrière son comptoir. Les dormeurs de l'Hôtel sont dessinés en instances : des centaines
  de silhouettes pour trois appels de rendu.
- **Ça bouge pour de vrai** : à chaque nouveau cycle, ceux qui changent de pièce marchent
  jusqu'à leur nouvelle place, ceux qui quittent l'étage prennent l'ascenseur, ceux qui
  arrivent en sortent. Entre deux cycles, seuls de petits déplacements dans la même pièce
  animent la scène (jamais un changement de pièce que le moteur n'a pas décidé).
- **Bulles** : les répliques réellement prononcées sur l'étage dans les 3 dernières heures
  du Bâtiment, sinon une pensée tirée de l'activité réelle (« 💭 mélange deux liquides pour
  voir »). L'éclairage suit l'heure du Bâtiment (fenêtres allumées la nuit).
- **Journées légendaires en 3D** : noir presque complet pendant la panne, palier « Ascenseur B
  EN GRÈVE », danse et boule à facettes pendant la Fête du Bâtiment.
- **🎥 Suivre en 3D** (fiche d'un habitant) : la caméra garde la personne au centre ; quand la
  simulation l'emmène ailleurs, on la regarde rejoindre l'ascenseur, on monte avec elle et on
  la voit sortir de la cabine à son nouvel étage. Le bandeau indique en continu ce qu'elle fait
  et où.
- **Navigation** : ▲ ▼ pour changer d'étage, 🏢 QG pour revenir. Toucher une pièce ou un
  habitant ouvre sa fiche dans le panneau Bâtiment, et inversement : ouvrir un étage, une pièce
  ou une fiche dans le panneau emmène la caméra au bon endroit. Les étages fermés (Étage
  fantôme hors de ses nuits) montrent leur palier et se perdent dans le brouillard.

### Ce que tu peux faire (propriétaire)

Suivre un personnage, organiser une fête ou un séminaire dans une pièce (les invités y vont
vraiment), proposer une loi au Parlement, lancer un défi entre deux services, financer une
entreprise, promouvoir quelqu'un, faire enquêter sur une rumeur, orienter une enquête,
trancher les décisions qui t'attendent (Oui/Non). Toutes ces interventions sont **séparées**
des événements naturels (source « boss », journal du propriétaire) et passent par le même
validateur : tu arbitres, tu ne réécris pas l'histoire.

### Rapport d'absence

`/report` (et chaque matin à 9 h s'il s'est passé quelque chose) : **« RAPPORT D'ABSENCE —
8 HEURES »** avec des chiffres issus des statistiques horaires du moteur (cycles simulés,
événements dont rares par étage, relations changées, rumeurs, alliances, crises, lois, pertes
d'argent, cibles des médias), puis les faits majeurs avec leur **chaîne causale**, le pouvoir,
l'économie, les intrigues, les ascensions et chutes, les mystères et les rumeurs (toujours
étiquetées). Si le serveur était arrêté plus longtemps que la limite de rattrapage, le rapport
le dit : **ce temps n'est pas simulé, rien n'y est inventé**. Le même rapport s'affiche en tête
des Actus de la mini app.

### Réglages (`/madhouse_config`, administrateurs)

```
/madhouse_config                       affiche les réglages
/madhouse_config population 300        population cible (les nouveaux arrivent par petits groupes)
/madhouse_config chaos 70              0 = calme plat, 100 = chaos total
/madhouse_config events 6              événements max par cycle
/madhouse_config rare 2                multiplicateur des événements rares / très rares / légendaires
/madhouse_config legendary 0.5         multiplicateur des seules journées légendaires
/madhouse_config speed 2               vitesse du temps simulé
/madhouse_config dialogue riche        niveau de détail des dialogues
/madhouse_config cycle 30 · pause · resume · ai on|off · ai_calls 5
/madhouse_config notif 2 · importance 4 · quiet 23 8 · report 9 on|off
```

Les mêmes curseurs existent dans le Centre de contrôle de la mini app.

### Mode test du chaos (développement uniquement)

Avec `WORLD_DEV_TOOLS=true`, les administrateurs voient dans le Centre de contrôle : simuler
1 cycle / 1 heure / 1 journée, déclencher un événement ou un arc précis, vérifier la
cohérence, et **rejouer** une journée avec une graine dans un bac à sable (sans toucher au
monde). Sans cette variable (défaut), ces outils sont refusés côté serveur, même si on les
appelle directement.

### Architecture et garanties

```
webapp/shared/world/
  index.js     orchestrateur : cycles de 30 min, rattrapage borné, annulation d'un cycle si un
               invariant casse, statistiques horaires, actions du joueur (world.*)
  building.js  étages, pièces, accès, objets ;  castgen.js  ~250 personnages (déterministe)
  life.js      besoins, emplois du temps, déplacements, interactions de proximité
  events.js    événements probabilistes ;  arcs.js  arcs de plusieurs jours ;  humor.js  humour
  ops.js       noyau transactionnel : propositions d'opérations atomiques, validateur,
               dédoublonnage, invariants (masse monétaire, soldes, positions, organisations)
  memory.js    événements immuables + causes, faits (confirmé / secret / rumeur / hypothèse),
               connaissance par personnage, propagation, chronique compactée
  explore.js   vues de l'explorateur (sans secrets) ;  report.js  rapport d'absence
  economy.js · politics.js · agents.js · media.js · wtf.js · director.js · ai.js
webapp/js/scene/
  floorplan.js plan d'un étage (pièces, portes, murs, chemins), sans three.js
  floorkit.js  mobilier procédural par type de pièce et places (assises, lits, foule)
  floors.js    scène 3D d'un étage : habitants réels, dormeurs instanciés, animaux, bulles
webapp/js/ui/elevator.js   Ascenseur B : choix de l'étage, bandeau, transition, synchro panneau
src/office/explorer.js     écrans Telegram de l'explorateur
src/office/building.js     commandes et boutons Telegram du Bâtiment
webapp/js/ui/madhouse.js   explorateur de la mini app
```

- **Persistance** : le monde vit dans sa propre table **`madhouse_world`** (voir
  [`schema.sql`](./schema.sql)), séparée du QG (`office_state`, sauvegardé souvent et
  désormais léger). Le monde n'est réécrit que lorsqu'il change (au plus toutes les 15 s,
  et toujours à l'arrêt). **Migration** : exécuter la dernière version de `schema.sql` ; au
  premier démarrage, le monde déjà présent dans `office_state` est repris puis déplacé
  automatiquement. Sans la table, le bot continue avec l'ancien stockage (et le signale).
- **Pas de double simulation** : un **bail** (`lease_holder`, `lease_until`) garantit qu'une
  seule instance du bot simule un monde donné ; une seconde instance garde le Bâtiment
  visitable en lecture seule et reprend la main si le bail se libère. Une **garde monotone**
  (`cycle`) empêche d'écraser un monde plus avancé par un plus ancien.
- **Temps** : le Bâtiment suit le temps réel ; après un redémarrage, les cycles manqués sont
  rattrapés (24 max par passage, 3 jours max) et le reste est consigné comme non simulé.
- **Déterminisme** : le hasard d'un cycle dépend de la graine du monde et du numéro de cycle ;
  rejouer un cycle après un crash donne exactement le même résultat (pas de double effet).
- **Validation** : toute modification passe par une proposition validée (fonds suffisants,
  personnages et lieux existants, accès autorisés, causes réellement enregistrées, champs
  autorisés, pas de doublon) ; un rejet est journalisé, jamais appliqué en silence. Après
  chaque cycle, les invariants sont vérifiés et le cycle est annulé s'ils cassent.
- **Connaissance** : un personnage ne sait que ce qu'il a appris ; le joueur ne voit ni la
  vérité des mystères, ni la véracité des rumeurs, ni les secrets non révélés, ni les
  virements occultes. Le monde complet n'est jamais envoyé dans le polling de la mini app.
- **IA hybride** : la simulation est entièrement déterministe et fonctionne sans IA. Avec une
  clé Claude, seuls les moments rares ou majeurs reçoivent un court récit, dans la limite de
  `WORLD_AI_DAILY_CALLS` appels par jour. Le texte généré est traité comme une donnée non
  fiable : nettoyé, borné, affiché à part, sans aucun effet sur le monde.
- **Sécurité** : réglages et outils réservés aux administrateurs (`ADMIN_USER_IDS`) ; un
  personnage « PDG » n'a accès à aucun réglage, secret ou permission ; tout le texte est
  échappé avant envoi à Telegram.

Variables d'environnement : `WORLD_NOTIFICATIONS` (défaut `true`), `WORLD_AI` (défaut `true`,
nécessite `ANTHROPIC_API_KEY`), `WORLD_AI_DAILY_CALLS` (défaut `6`, 0 pour couper),
`WORLD_DEV_TOOLS` (défaut `false` : mode test du chaos).

### Tests

`npm test` couvre notamment : déplacement réel et contrôle d'accès, action du propriétaire
qui modifie le monde, relations asymétriques, information privée jamais publique d'elle-même,
probabilité des événements rares, aucune double application (même instant, même ordre,
chargement concurrent), parcours bâtiment → étage → pièce → personnage (vues et écrans
Telegram), permissions du mode test, rapport d'absence chiffré, persistance séparée et
redémarrage, bail entre deux instances, migration d'une vraie sauvegarde v1, et pour la 3D :
plan cohérent de chaque étage (pas de chevauchement, une porte par pièce, chemins), occupants
affichés = occupants réels (aucune pièce cachée, aucune réplique inventée), et assez de places
pour que chaque habitant soit visible sur deux jours simulés ; journées légendaires (rareté,
effets réels, fin), et mémoire bornée (affaires closes, croyances orphelines élaguées).

## Déploiement

Le bot tourne en `bot.launch()` (long polling), donc n'importe quel hébergeur
Node.js qui garde un processus actif fonctionne : un VPS avec `pm2`, Railway,
Render, Fly.io, etc. Il sert aussi la mini app du QG sur `PORT` : pour l'ouvrir dans
Telegram, l'hébergeur doit l'exposer en https (voir `WEBAPP_URL`). La persistance (`data/store.json`) doit se trouver sur un
disque qui survit aux redéploiements si vous voulez conserver vos flux, routes et
l'historique de dédoublonnage.

## Licence

ISC
