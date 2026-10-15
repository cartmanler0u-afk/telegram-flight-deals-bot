// Architecture physique du Bâtiment 0 : étages, pièces, accès et objets.
//
// Chaque pièce a un identifiant stable (« f4.tv »), une fonction, une description, des
// accès (toujours le palier de l'étage, parfois d'autres pièces), des objets et des règles.
// Les paliers sont reliés entre eux par l'Ascenseur B (qui a son caractère) et l'escalier.
// Les personnages ont UNE localisation (une pièce) ; se déplacer change réellement cet état.

export const PALIER = "palier";
export const GHOST_FLOOR = "f10";
export const PARLIAMENT_FLOOR = "f6";
export const COURT_FLOOR = "f9";
export const OWNER_FLOOR = "ph";
export const COMPANY_FLOOR = "f11";

// kind : work | meeting | food | social | rest | transit | secret | special | owner
// access : public | staff | members | hidden | ghost | owner
const R = (key, name, kind, desc, extra = {}) => ({ key, name, kind, desc, ...extra });

export const FLOOR_PLAN = [
  {
    id: "ph", level: 13, name: "Dernier étage — Le Bureau du Propriétaire", short: "Propriétaire", kind: "owner", status: "open", onPlan: true,
    blurb: "Le bouton de l'ascenseur indique « 13 ». Tout le monde dit « le dernier ». Personne ne monte sans y être invité.",
    rooms: [
      R("bureau", "Le Bureau du Propriétaire", "owner", "Un fauteuil trop grand, une vue sur toutes les fenêtres du Bâtiment et un bouton rouge dont personne ne connaît la fonction.", { access: "owner" }),
      R("ecrans", "La Salle des Écrans", "owner", "Cent quarante écrans de surveillance, dont trois montrent des pièces qui n'existent pas.", { access: "owner" }),
      R("archives", "Le Coffre des Décisions", "owner", "Chaque décision du propriétaire y est classée. Les mauvaises aussi, dans un tiroir plus profond.", { access: "owner" }),
      R("terrasse", "La Terrasse condamnée", "special", "Interdite depuis « l'incident du parapluie ». Le parapluie est toujours là. Il attend.", { access: "hidden" }),
    ],
  },
  {
    id: "f12", level: 12, name: "Étage 12 — Les Serres & les Serveurs", short: "Serres", kind: "technique", status: "open", onPlan: true,
    blurb: "Moitié jungle, moitié datacenter. Les plantes poussent mieux près des serveurs. Personne ne veut savoir pourquoi.",
    rooms: [
      R("serres", "Les Serres du 12", "work", "Seul fournisseur officiel de plantes vertes réglementaires. Les fougères ont un syndicat."),
      R("serveurs", "La Salle des Serveurs", "work", "Chaud, bruyant, vaguement sacré. Un serveur porte une étiquette « NE PAS REDÉMARRER (il se souvient) »."),
      R("chaufferie", "La Chaufferie", "work", "Le chauffage consomme un étage de trop. C'est noté dans trois rapports que personne n'a lus.", { access: "staff" }),
    ],
  },
  {
    id: "f11", level: 11, name: "Étage 11 — Ton entreprise", short: "Ton QG", kind: "entreprise", status: "open", onPlan: true,
    blurb: "Les bureaux de ton entreprise : le QG 3D de tes agents. Vu des autres étages, c'est « la boîte qui fait des trucs sur Internet ».",
    rooms: [
      R("openspace", "L'Open space du QG", "work", "Tes agents y travaillent sur tes missions. Un post-it « Ne pas toucher à l'agrafeuse » fait office de constitution."),
      R("direction", "Le Bureau du Directeur (QG)", "work", "Victor y prend des décisions importantes, parfois même dans le bon ordre."),
      R("reunion", "La Salle de conférence du QG", "meeting", "Réunions, comptes rendus et un tableau blanc qui n'a jamais été vraiment effacé."),
      R("cuisine", "La Cuisine du QG", "food", "Le micro-ondes a vu des choses. Le chili de Bruno en fait partie."),
      R("repos", "La Salle de repos & des chats", "social", "Les chats du QG y tiennent salon. Un fauteuil leur appartient légalement (selon eux)."),
    ],
  },
  {
    id: "f10", level: 10, name: "Étage 10 — L'Étage fantôme", short: "Fantôme", kind: "anomalie", status: "rumored", onPlan: false,
    blurb: "L'ascenseur passe du 9 au 11. Pourtant, certains jurent y avoir pris un café, encore chaud, servi par personne.",
    rules: { ghost: true },
    rooms: [
      R("couloir", "Le Couloir qui tourne à gauche", "special", "Il tourne à gauche. Toujours. On finit pourtant par revenir au point de départ, par la droite.", { access: "ghost" }),
      R("bureau100", "Le Bureau 10-0", "special", "Un café chaud attend sur le bureau. Le badge sur la chaise porte ton nom. Ou celui de la personne qui entre.", { access: "ghost" }),
      R("lendemain", "Les Archives du Lendemain", "special", "Des dossiers datés de demain. Certains sont déjà en retard.", { access: "ghost" }),
      R("ascenseurs", "La Salle des Ascenseurs à la retraite", "special", "Trois vieilles cabines y jouent aux cartes. L'Ascenseur B y passe ses dimanches.", { access: "ghost" }),
      R("pleine", "La Pièce Vide (mais pleine)", "special", "Il n'y a rien. On s'y sent pourtant observé par au moins quarante chaises.", { access: "ghost" }),
    ],
  },
  {
    id: "f9", level: 9, name: "Étage 9 — Le Tribunal des Couloirs", short: "Tribunal", kind: "justice", status: "open", onPlan: true,
    blurb: "On y juge les contrats, les identités, les distributeurs de café et parfois les ascenseurs.",
    rooms: [
      R("audience", "La Salle d'audience", "meeting", "Le marteau de la juge est en mousse depuis l'appel de 2019. L'autorité, elle, est intacte."),
      R("greffe", "Le Greffe", "work", "Tout y est enregistré en trois exemplaires, dont un perdu par principe."),
      R("enquetes", "Le Bureau des Enquêtes", "work", "Un mur de liège, de la ficelle rouge et une tasse « Meilleur enquêteur (autoproclamé) »."),
      R("scelles", "La Salle des Pièces à conviction", "work", "On y garde les preuves. Et, depuis une erreur d'étiquetage, une plante qui témoigne.", { access: "staff" }),
      R("attente", "La Salle des pas perdus judiciaires", "social", "Avocats, plaignants et accusés y partagent le même distributeur. La tension est palpable, le café aussi."),
    ],
  },
  {
    id: "f8", level: 8, name: "Étage 8 — L'Hôtel des Employés", short: "Hôtel", kind: "logement", status: "open", onPlan: true,
    blurb: "Ici, la journée de travail ne finit jamais vraiment : elle change juste de pyjama.",
    rooms: [
      R("aileA", "Les Chambres — aile A", "rest", "Murs fins, secrets épais. Le couloir sent la lessive et les confidences."),
      R("aileB", "Les Chambres — aile B", "rest", "L'aile « calme ». Le règlement intérieur l'affirme ; les voisins le contestent."),
      R("aileC", "Les Chambres — aile C", "rest", "Réservée aux couche-tard, aux insomniaques et à ceux qui « travaillent sur un projet perso »."),
      R("salon", "Le Salon commun", "social", "Canapés, jeux de société incomplets et un karaoké qui ne connaît que des génériques d'anime."),
      R("cuisine", "La Cuisine partagée", "food", "Le frigo est un champ de bataille de post-it nominatifs."),
      R("buanderie", "La Buanderie", "social", "Lieu officiel des confidences. Les chaussettes orphelines y forment une communauté."),
    ],
  },
  {
    id: "f7", level: 7, name: "Étage 7 — Le Club des Puissants", short: "Club", kind: "elite", status: "open", onPlan: true,
    blurb: "Moquette épaisse, voix basses, fauteuils en cuir qui grincent quand on ment.",
    rooms: [
      R("salon", "Le Salon des Fauteuils en cuir", "social", "On y décide de tout, entre deux anecdotes sur des vacances que personne n'a prises.", { access: "members" }),
      R("diner", "La Salle à manger privée", "food", "Dîners à huis clos. Le menu change selon qui doit être trahi.", { access: "members" }),
      R("fumoir", "Le Fumoir sans fumée", "social", "On n'y fume plus depuis des années. On y fait toujours semblant, par tradition.", { access: "members" }),
      R("cave", "La Cave à jus de raisin", "secret", "Collection de jus de raisin millésimés. Les étiquettes disent « vintage », les factures aussi.", { access: "members" }),
    ],
  },
  {
    id: "f6", level: 6, name: "Étage 6 — Le Parlement Interne", short: "Parlement", kind: "politique", status: "open", onPlan: true,
    blurb: "Cinq sièges, cent opinions, une buvette. Les lois votées ici changent vraiment le Bâtiment.",
    rooms: [
      R("hemicycle", "L'Hémicycle", "meeting", "Cinq sièges officiels, quarante chaises pour le public et un micro qui coupe toujours au mauvais moment."),
      R("commissions", "La Salle des commissions", "meeting", "Réservée chaque nuit par un compte que personne ne connaît."),
      R("buvette", "La Buvette", "food", "Les vraies négociations s'y font, autour d'un croque-monsieur tiède."),
      R("lobby", "Le Couloir des lobbyistes", "social", "Large de quatre mètres et pourtant impossible à traverser sans être sollicité."),
      R("partis", "Le Bureau des partis", "work", "Chaque parti a son casier. Celui du Parti du Bon Sens Pratique déborde."),
    ],
  },
  {
    id: "f5", level: 5, name: "Étage 5 — Les Laboratoires", short: "Labos", kind: "laboratoire", status: "open", onPlan: true,
    blurb: "Recherche appliquée à rien de précis. Les murs vibrent parfois. C'est normal. Probablement.",
    rooms: [
      R("labo", "Le Laboratoire Inappliqué", "work", "Paillasses, fioles et un tableau couvert d'équations qui finissent toutes par « = budget »."),
      R("prototypes", "La Salle des prototypes", "work", "Chaise auto-réservante, parapluie d'intérieur, agrafeuse quantique. Rien n'est homologué."),
      R("ia", "Le Labo d'IA fictive", "work", "Ici vit K.E.V.I.N., une IA de bureau qui répond « ça dépend » à toutes les questions."),
      R("social", "La Salle des expériences sociales", "meeting", "Miroir sans tain, chaises inconfortables et formulaires de consentement en police 6."),
      R("reserve", "La Réserve des produits instables", "secret", "Accès restreint. L'étiquette « NE PAS SECOUER » a été secouée.", { access: "staff" }),
    ],
  },
  {
    id: "f4", level: 4, name: "Étage 4 — Les Médias Internes", short: "Médias", kind: "medias", status: "open", onPlan: true,
    blurb: "La Gazette, la télé, le podcast et la com : ici, tout ce qui arrive devient une histoire. Parfois même vraie.",
    rooms: [
      R("redaction", "La Rédaction de la Gazette", "work", "Bureaux encombrés, café froid et un panneau « Vérifier ses sources » recouvert d'un autre panneau."),
      R("tv", "Le Studio TV — plateau du direct", "work", "Projecteurs, fond vert et un compteur d'audience qui affiche toujours 12."),
      R("podcast", "Le Studio podcast", "work", "Deux micros, trois avis par phrase, une heure quarante d'épisode."),
      R("com", "Le Service communication", "work", "Spécialiste des éléments de langage : « crise » se dit ici « opportunité de narration »."),
      R("influence", "La Salle des influenceurs", "social", "Ring light, fond pastel, et une plante en plastique qui a plus d'abonnés que la Gazette."),
    ],
  },
  {
    id: "f3", level: 3, name: "Étage 3 — La Bourse Interne", short: "Bourse", kind: "commerce", status: "open", onPlan: true,
    blurb: "On y achète des parts, on y vend des promesses, on y perd des chemises. Fictives, heureusement.",
    rooms: [
      R("corbeille", "La Corbeille", "work", "Le parquet de la Bourse : un écran géant, des cris et un traider qui écrit « trader » avec un i."),
      R("banque", "La Banque de la Bourse", "work", "Coffres, taux créatifs et un stylo attaché par une chaîne en or."),
      R("startups", "La Pépinière de start-up", "work", "Baby-foot, poufs, et des business plans qui finissent tous par « et ensuite, la blockchain »."),
      R("negos", "La Salle des négociations", "meeting", "La table est ronde pour que personne ne soit en bout de table. Tout le monde est mécontent."),
      R("biscuiterie", "La Boutique de la Biscuiterie Verticale", "food", "Crackers artisanaux et ambitions industrielles."),
    ],
  },
  {
    id: "f2", level: 2, name: "Étage 2 — La Direction", short: "Direction", kind: "direction", status: "open", onPlan: true,
    blurb: "Réunions interminables, stratégies douteuses et décisions absurdes qui descendent dans tout l'immeuble par gravité.",
    rooms: [
      R("pdg", "Le Bureau du PDG", "work", "Moquette moelleuse, bureau en bois rare et une bibliothèque de livres de management jamais ouverts.", { access: "staff" }),
      R("reunionA", "La Salle de réunion A", "meeting", "La réunion de 9 h y dure jusqu'à 18 h. L'ordre du jour, lui, n'a jamais été lu."),
      R("reunionB", "La Salle de réunion B (sans fenêtre)", "meeting", "On y prend les décisions qu'on ne veut pas voir au grand jour. Littéralement."),
      R("finances", "Le Bureau financier", "work", "Tableurs, calculatrices et une plante grasse nommée « Trésorerie »."),
      R("registre", "Le Registre & le Plan Officiel", "work", "Ce qui y est écrit devient vrai, administrativement. Le reste attend son tampon."),
      R("couloir", "Le Couloir des stratégies", "social", "Les vraies décisions se prennent ici, entre deux portes, à voix basse."),
    ],
  },
  {
    id: "f1", level: 1, name: "Étage 1 — Les Ressources Humaines", short: "RH", kind: "rh", status: "open", onPlan: true,
    blurb: "Recrutements, licenciements, évaluations et entretiens dont on ressort toujours un peu moins sûr de soi.",
    rooms: [
      R("accueil", "L'Accueil RH", "work", "Un distributeur de tickets « Plainte », « Promotion », « Existentiel »."),
      R("entretiens", "La Salle d'entretien", "meeting", "Une chaise confortable pour le recruteur, un tabouret pour le candidat. C'est voulu."),
      R("drh", "Le Bureau de la DRH", "work", "Lumière tamisée, boîte de mouchoirs et un tableau en liège rempli de photos reliées par de la ficelle.", { access: "staff" }),
      R("evaluations", "La Salle des évaluations", "work", "On y note les gens de 1 à 5 étoiles. Personne n'a jamais eu 5. Personne n'a jamais eu 1 non plus, sauf Gérard."),
      R("seminaire", "La Salle de séminaire", "meeting", "Paperboard, feutres secs et un atelier « confiance » programmé chaque mois."),
    ],
  },
  {
    id: "f0", level: 0, name: "Rez-de-chaussée — L'Accueil & le Cirque", short: "Accueil", kind: "accueil", status: "open", onPlan: true,
    blurb: "Le point de départ de toute visite : rumeurs, plaintes, aquarium, pigeon et café. Tout le monde passe par ici.",
    rooms: [
      R("hall", "Le Hall des Pas Perdus", "social", "Le grand hall : l'aquarium de Gustave, le pigeon Roucoulade et deux cents personnes qui font semblant d'attendre quelqu'un."),
      R("reception", "La Réception", "work", "Un comptoir, un registre des visites et une sonnette qu'on n'a pas le droit d'utiliser."),
      R("securite", "Le Poste de sécurité", "work", "Douze écrans, un badge oublié par jour et un agent qui voit des complots partout.", { access: "staff" }),
      R("cafeteria", "La Cafétéria", "food", "Plateaux-repas, rumeurs fraîches et un distributeur de café au tempérament imprévisible."),
      R("ascenseurs", "Les Ascenseurs", "transit", "L'Ascenseur A est en panne depuis toujours. L'Ascenseur B fonctionne, quand il le veut."),
      R("affichage", "Le Tableau d'affichage", "social", "Annonces officielles, petites annonces et notes passives-agressives sur le frigo de l'Hôtel."),
      R("plaintes", "Le Bureau des plaintes", "work", "On y dépose les plaintes. On n'y a jamais vu personne les reprendre."),
    ],
  },
  {
    id: "fm1", level: -1, name: "Sous-sol -1 — La Logistique & les Livraisons", short: "Logistique", kind: "logistique", status: "open", onPlan: true,
    blurb: "Colis, caisses, chariots et objets perdus. Tout ce qui entre dans le Bâtiment passe par ici. Tout n'en ressort pas.",
    rooms: [
      R("quai", "Le Quai de réception", "work", "Les colis arrivent ici. Certains n'ont pas de destinataire. Certains en ont trop."),
      R("entrepot", "L'Entrepôt", "work", "Étagères à perte de vue, chariots élévateurs et un inventaire qui ne tombe jamais juste."),
      R("bureau", "Le Bureau logistique", "work", "Un planning des livraisons couvert de flèches, et une porte dérobée que personne ne remarque.", { access: "staff" }),
      R("objets", "Les Objets trouvés", "work", "Tout ce qui est perdu dans le Bâtiment finit ici. Parfois des gens."),
      R("livreurs", "Le Local des livreurs internes", "social", "Les livreurs internes s'y chronomètrent entre deux étages. Le record tient depuis trois ans."),
      R("marche", "Le Marché noir (fictif)", "secret", "Derrière les palettes : fournitures détournées, tampons rares et café de contrebande.", { access: "hidden" }),
      R("secrete", "La Salle secrète de l'entrepôt", "secret", "Une pièce absente de tous les plans, pleine de colis disparus soigneusement rangés.", { access: "hidden" }),
    ],
  },
  {
    id: "fm2", level: -2, name: "Sous-sol -2 — Le Département des Choses qui ne Devraient pas Exister", short: "Dépt. -2", kind: "anomalie", status: "open", onPlan: true,
    blurb: "Laboratoire expérimental, archives interdites et pièces à la fonction inconnue. L'éclairage clignote en morse. Le message n'est pas rassurant.",
    rooms: [
      R("labo", "Le Laboratoire expérimental -2", "work", "On y teste ce que le Labo du 5 a refusé de tester."),
      R("archives", "Les Archives interdites", "secret", "Des dossiers sur tout le monde. Y compris sur des gens qui ne sont pas encore arrivés.", { access: "staff" }),
      R("anomalies", "La Salle des anomalies", "special", "On y range ce qui ne devrait pas être là. L'inventaire change pendant la nuit."),
      R("inconnue", "La Pièce 2-?", "special", "Personne ne sait à quoi elle sert. Elle a pourtant un planning de réservation complet."),
      R("propheties", "Le Bureau du Préposé aux Prophéties", "work", "Un calendrier où certaines cases sont déjà cochées. Pour la semaine prochaine."),
    ],
  },
];

// Objets de départ (l'état d'un objet évolue : en panne, volé, vandalisé, assuré, saisi…).
export const START_OBJECTS = [
  { id: "o-cafe", name: "Le distributeur de café du Hall", room: "f0.cafeteria", state: "ok", desc: "Une machine au tempérament imprévisible. Elle accepte les pièces, les badges et parfois les excuses.", gag: "coffee" },
  { id: "o-aquarium", name: "L'aquarium de Gustave", room: "f0.hall", state: "ok", desc: "Un aquarium monumental. Gustave le homard y règne, immobile et jugeant." },
  { id: "o-tableau", name: "Le Tableau d'affichage", room: "f0.affichage", state: "ok", desc: "Les annonces officielles du Bâtiment, et le reste." },
  { id: "o-bouton10", name: "Le bouton « 10 » de l'Ascenseur B", room: "f0.ascenseurs", state: "absent", desc: "Il n'y a pas de bouton 10. Il y a une petite trace ronde, comme si quelqu'un l'avait arraché.", gag: "elevator" },
  { id: "o-photocopieuse", name: "La photocopieuse du Registre", room: "f2.registre", state: "ok", desc: "Elle photocopie, mais en ajoutant parfois une ligne. Toujours la même : « Vu et approuvé »." },
  { id: "o-marteau", name: "Le marteau en mousse de la juge", room: "f9.audience", state: "ok", desc: "Symbole d'une justice douce mais ferme. Surtout douce." },
  { id: "o-kevin", name: "K.E.V.I.N., l'IA de bureau", room: "f5.ia", state: "ok", desc: "Une IA fictive qui répond « ça dépend » à toutes les questions. Elle a demandé un bureau avec fenêtre." },
  { id: "o-karaoke", name: "Le karaoké du Salon commun", room: "f8.salon", state: "ok", desc: "Il ne connaît que des génériques d'anime. Personne ne s'en plaint vraiment." },
  { id: "o-micro", name: "Le micro de l'Hémicycle", room: "f6.hemicycle", state: "ok", desc: "Il coupe toujours au moment où l'orateur dit « et c'est pourquoi »." },
  { id: "o-fournitures", name: "Les caisses de fournitures", room: "fm1.entrepot", state: "ok", desc: "Agrafes, post-it, stylos quatre couleurs. La monnaie réelle du Bâtiment." },
  { id: "o-planning", name: "Le planning de la Pièce 2-?", room: "fm2.inconnue", state: "ok", desc: "Complet pour les trois prochaines semaines. Les réservations sont au nom de personnes du Bâtiment… dont certaines ne le savent pas." },
  { id: "o-parapluie", name: "Le parapluie de la Terrasse", room: "ph.terrasse", state: "ok", desc: "L'objet de l'incident. Il est fermé. Pour l'instant." },
  { id: "o-fauteuil", name: "Le fauteuil des chats", room: "f11.repos", state: "ok", desc: "Propriété légale des chats du QG (selon eux et selon un post-it)." },
];

export function roomId(floorId, key) {
  return `${floorId}.${key}`;
}

export function floorOf(roomIdValue) {
  return String(roomIdValue || "").split(".")[0];
}

// Construit la structure persistante (étages + pièces + accès + objets).
export function buildBuilding() {
  const floors = {};
  const rooms = {};
  for (const f of FLOOR_PLAN) {
    const palier = roomId(f.id, PALIER);
    floors[f.id] = {
      id: f.id,
      level: f.level,
      name: f.name,
      short: f.short,
      kind: f.kind,
      status: f.status,
      onPlan: f.onPlan,
      blurb: f.blurb,
      rules: f.rules || {},
      discovered: f.status !== "rumored",
      controller: null,
      anomaly: f.id === GHOST_FLOOR ? 40 : 0,
      history: [],
      rooms: [palier, ...f.rooms.map((r) => roomId(f.id, r.key))],
    };
    rooms[palier] = {
      id: palier,
      floor: f.id,
      name: f.id === "f0" ? "Le Palier du rez-de-chaussée" : `Le Palier — ${f.short}`,
      kind: "transit",
      desc: f.id === GHOST_FLOOR ? "Un palier identique aux autres. Sauf que l'interrupteur est à gauche, et que l'écho répond avant toi." : "Le palier de l'étage : la porte de l'Ascenseur B, l'escalier et un extincteur décoratif.",
      access: f.rules?.ghost ? "ghost" : "public",
      exits: [],
      log: [],
      discovered: f.status !== "rumored",
    };
    for (const r of f.rooms) {
      const id = roomId(f.id, r.key);
      rooms[id] = {
        id,
        floor: f.id,
        name: r.name,
        kind: r.kind,
        desc: r.desc,
        access: r.access || "public",
        exits: [palier],
        log: [],
        discovered: r.access !== "hidden" && f.status !== "rumored",
      };
      rooms[palier].exits.push(id);
    }
  }
  // Quelques passages directs (en plus des paliers).
  link(rooms, "f0.hall", "f0.reception");
  link(rooms, "f0.hall", "f0.cafeteria");
  link(rooms, "f0.hall", "f0.ascenseurs");
  link(rooms, "f0.hall", "f0.affichage");
  link(rooms, "fm1.entrepot", "fm1.marche");
  link(rooms, "fm1.bureau", "fm1.secrete");
  link(rooms, "f7.salon", "f7.cave");
  link(rooms, "f9.audience", "f9.attente");
  const objects = Object.fromEntries(START_OBJECTS.map((o) => [o.id, { ...o, baseline: o.state, history: [] }]));
  return { floors, rooms, objects };
}

function link(rooms, a, b) {
  if (!rooms[a] || !rooms[b]) return;
  if (!rooms[a].exits.includes(b)) rooms[a].exits.push(b);
  if (!rooms[b].exits.includes(a)) rooms[b].exits.push(a);
}

// ------------------------------------------------------------------ règles d'accès

export function isGhostOpen(world) {
  return !!(world.flags?.ghostOpenUntil && world.flags.ghostOpenUntil > world.cycle);
}

// Peut-on entrer dans cette pièce ? Retourne null si oui, sinon la raison.
export function accessDenied(world, person, room, { hour = 12, laws = [] } = {}) {
  if (!room) return "pièce inconnue";
  const floor = world.building.floors[room.floor];
  if (!floor) return "étage inconnu";
  if (person?.id === "boss") return null;
  if (floor.status === "sealed" || floor.status === "closed") return `${floor.name} est ${floor.status === "sealed" ? "scellé" : "fermé"}`;
  if (floor.rules?.ghost && !isGhostOpen(world)) return "l'ascenseur passe du 9 au 11";
  if (room.access === "owner") return "réservé au propriétaire";
  if (room.access === "ghost" && !isGhostOpen(world)) return "cette pièce n'est accessible que lorsque l'Étage fantôme apparaît";
  if (room.access === "hidden" && !room.discovered && !(person?.flags?.knowsRoom || []).includes(room.id)) return "personne ne connaît l'existence de cette pièce";
  if (room.access === "staff" && person && person.floor !== room.floor && !person.flags?.badge) return "accès réservé au personnel de l'étage";
  if (room.access === "members" && person && !person.flags?.club && (person.influence || 0) < 65) return "réservé aux membres du Club";
  if (laws.includes("curfew") && (hour >= 22 || hour < 6) && room.kind !== "rest" && person && (person.skills?.cunning || 0) < 7) return "couvre-feu des couloirs";
  return null;
}

// Chemin entre deux pièces : pièce → palier → (ascenseur/escalier) → palier → pièce.
export function route(world, from, to) {
  const a = world.building.rooms[from];
  const b = world.building.rooms[to];
  if (!a || !b) return null;
  if (from === to) return [from];
  if (a.exits.includes(to)) return [from, to];
  const pa = roomId(a.floor, PALIER);
  const pb = roomId(b.floor, PALIER);
  const path = [from];
  if (from !== pa) path.push(pa);
  if (pa !== pb) path.push(pb);
  if (to !== pb) path.push(to);
  return path;
}

// Nombre d'étages traversés (pour l'Ascenseur B et l'escalier).
export function floorDistance(world, from, to) {
  const fa = world.building.floors[floorOf(from)];
  const fb = world.building.floors[floorOf(to)];
  return fa && fb ? Math.abs(fa.level - fb.level) : 0;
}

export function roomsOfFloor(world, floorId) {
  return (world.building.floors[floorId]?.rooms || []).map((id) => world.building.rooms[id]).filter(Boolean);
}

export function sortedFloors(world) {
  return Object.values(world.building.floors).sort((a, b) => b.level - a.level);
}

// Journal d'une pièce : derniers événements (survit à la compaction du journal global).
export function logInRoom(world, roomIdValue, event) {
  const room = world.building.rooms?.[roomIdValue];
  if (!room) return;
  room.log.push({ id: event.id, cycle: event.cycle, at: event.at, title: event.title, importance: event.importance, public: event.public });
  if (room.log.length > 12) room.log.shift();
}
