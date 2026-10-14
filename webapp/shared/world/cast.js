// Univers de THE MADHOUSE — Bâtiment 0 : étages, Charte, habitants, entreprises internes,
// organisations, catalogue des lois et mystères de départ. Tout est fictif.

export const BUILDING_NAME = "THE MADHOUSE — Bâtiment 0";
export const CURRENCY = "cr";

// La Charte des Murs : règles fondamentales, vérifiées par le moteur.
export const CHARTER = [
  { id: "R1", text: "Le Bâtiment est tout ce qui existe. Les fenêtres donnent sur d'autres fenêtres du Bâtiment." },
  { id: "R2", text: "Ce qui est inscrit au Registre existe administrativement. Ce qui n'y est pas n'a aucune existence légale, même si on peut lui serrer la main." },
  { id: "R3", text: "Tout Crédit naît au Trésor du Syndic puis circule. Personne ne crée de Crédits dans son tiroir." },
  { id: "R4", text: "Une loi du Parlement s'applique au cycle suivant son adoption, et seulement aux étages inscrits au Plan Officiel." },
  { id: "R5", text: "Les souvenirs sont personnels, les archives sont publiques, les rumeurs sont gratuites." },
  { id: "R6", text: "L'Ascenseur B choisit la destination finale. On peut discuter avec lui, pas le contredire." },
];

// Étages. onPlan : inscrit au Plan Officiel. status : open | closed | sealed | contested | rumored.
export const FLOORS = [
  { id: "roof", level: 14, name: "La Terrasse", kind: "interdit", status: "sealed", onPlan: true, blurb: "Accès interdit depuis « l'incident du parapluie ». Personne ne se souvient de l'incident." },
  { id: "f13", level: 13, name: "Étage 13", kind: "anomalie", status: "rumored", onPlan: false, blurb: "N'existe pas au Plan Officiel. L'Ascenseur B s'y arrête parfois quand même." },
  { id: "f12", level: 12, name: "Les Serres du 12", kind: "commerce", status: "open", onPlan: true, blurb: "Jungle d'intérieur et seul fournisseur officiel de plantes du Bâtiment." },
  { id: "f11", level: 11, name: "Salle des Serveurs", kind: "technique", status: "open", onPlan: true, blurb: "Chaud, bruyant, vaguement sacré." },
  { id: "f10", level: 10, name: "Syndic Général", kind: "administration", status: "open", onPlan: true, blurb: "Direction du Bâtiment et Trésor. Les tampons y ont plus de pouvoir que les gens." },
  { id: "f9", level: 9, name: "Le Registre", kind: "archives", status: "open", onPlan: true, blurb: "Archives centrales et Plan Officiel. Ce qui y est écrit devient vrai, administrativement." },
  { id: "f8", level: 8, name: "Les Dortoirs", kind: "logement", status: "open", onPlan: true, blurb: "Logements des occupants. Les murs sont fins, les secrets aussi." },
  { id: "f7", level: 7, name: "Laboratoire Inappliqué", kind: "laboratoire", status: "open", onPlan: true, blurb: "Recherche appliquée à rien de précis. Fuites de réalité occasionnelles." },
  { id: "f6", level: 6, name: "La Rédaction", kind: "médias", status: "open", onPlan: true, blurb: "La Gazette de l'Ascenseur et Radio Cage d'Escalier partagent une machine à café et aucune déontologie commune." },
  { id: "f5", level: 5, name: "Tribunal des Couloirs", kind: "justice", status: "open", onPlan: true, blurb: "On y juge les contrats, les identités et parfois les ascenseurs." },
  { id: "f4", level: 4, name: "L'Hémicycle", kind: "politique", status: "open", onPlan: true, blurb: "Parlement du Bâtiment : cinq sièges, cent opinions." },
  { id: "f3", level: 3, name: "Le Marché Intérieur", kind: "commerce", status: "open", onPlan: true, blurb: "Échoppes, échanges de parts et Biscuiterie Verticale." },
  { id: "f2", level: 2, name: "Le Réfectoire", kind: "restauration", status: "open", onPlan: true, blurb: "Cantine du Bâtiment. Le fromage y est une affaire d'État." },
  { id: "f1", level: 1, name: "Étage 1 — ton entreprise", kind: "entreprise", status: "open", onPlan: true, blurb: "Les bureaux de ton entreprise et de ses employés (le QG 3D)." },
  { id: "f0", level: 0, name: "Hall des Pas Perdus", kind: "accueil", status: "open", onPlan: true, blurb: "Réception, aquarium de Gustave et boîte aux lettres que personne n'ouvre." },
  { id: "fm1", level: -1, name: "Banque du Sous-Sol", kind: "finance", status: "open", onPlan: true, blurb: "Coffres, chaufferie et taux d'intérêt créatifs." },
  { id: "fm2", level: -2, name: "Objets Trouvés", kind: "dépôt", status: "open", onPlan: true, blurb: "Tout ce qui a été perdu dans le Bâtiment finit ici. Parfois des gens." },
];

// Habitants du Bâtiment (hors employés de ton entreprise, qui sont repris du QG).
// ambition : power | wealth | fame | truth | stability | protect | change_role
export const RESIDENTS = [
  { id: "r-marcel", name: "Marcel Pivert", title: "Concierge", floor: "f0", employer: "syndic", traits: ["gossip", "kind"], ambition: { kind: "stability" }, skills: { negotiation: 8, investigation: 6, charisma: 6, cunning: 4 }, weakness: "ne sait pas garder un secret plus de deux étages", salary: 45, wealth: 380 },
  { id: "r-gustave", name: "Gustave", kind: "animal", species: "homard", title: "Homard de l'aquarium du Hall", floor: "f0", traits: ["calm"], ambition: { kind: "power" }, skills: { negotiation: 1, investigation: 2, charisma: 9, cunning: 3 }, weakness: "ne sort pas de son aquarium", salary: 0, wealth: 0 },
  { id: "r-arlette", name: "Arlette Tampon", title: "Syndic Générale", floor: "f10", employer: "syndic", traits: ["zealous", "meticulous"], ambition: { kind: "power" }, skills: { negotiation: 6, investigation: 4, charisma: 5, cunning: 8 }, weakness: "ne peut rien faire sans formulaire", salary: 110, wealth: 1600 },
  { id: "r-prune", name: "Prune Delarue", title: "Réceptionniste du Syndic", floor: "f10", employer: "syndic", traits: ["shy", "hustler"], ambition: { kind: "change_role" }, skills: { negotiation: 7, investigation: 5, charisma: 4, cunning: 6 }, weakness: "personne ne l'écoute (pour l'instant)", salary: 35, wealth: 120 },
  { id: "r-hermine", name: "Hermine Statut", title: "Juge du Tribunal des Couloirs", floor: "f5", employer: "syndic", traits: ["meticulous", "calm"], ambition: { kind: "stability" }, skills: { negotiation: 5, investigation: 7, charisma: 6, cunning: 5 }, weakness: "vénère la procédure plus que la justice", salary: 95, wealth: 1400 },
  { id: "r-felix", name: "Félix Morin", title: "Journaliste à la Gazette de l'Ascenseur", floor: "f6", employer: "gazette", traits: ["nightowl", "hustler"], ambition: { kind: "truth" }, skills: { negotiation: 5, investigation: 8, charisma: 6, cunning: 5 }, weakness: "publie avant de vérifier", salary: 55, wealth: 300 },
  { id: "r-nadia", name: "Nadia Brûlot", title: "Animatrice de Radio Cage d'Escalier", floor: "f6", employer: "gazette", traits: ["party", "prankster"], ambition: { kind: "fame" }, skills: { negotiation: 4, investigation: 4, charisma: 9, cunning: 6 }, weakness: "préfère une bonne blague à un fait vérifié", salary: 50, wealth: 260 },
  { id: "r-edith", name: "Édith Vasseur", title: "Directrice du Laboratoire Inappliqué", floor: "f7", employer: "labo", traits: ["nerd", "nightowl"], ambition: { kind: "truth" }, skills: { negotiation: 4, investigation: 9, charisma: 3, cunning: 5 }, weakness: "lance les expériences avant de lire le protocole", salary: 80, wealth: 520 },
  { id: "r-octave", name: "Octave Lingot", title: "Banquier du Sous-Sol", floor: "fm1", employer: "banque", traits: ["hustler", "meticulous"], ambition: { kind: "wealth" }, skills: { negotiation: 8, investigation: 5, charisma: 5, cunning: 9 }, weakness: "ne peut pas résister à un taux d'intérêt", salary: 90, wealth: 2600 },
  { id: "r-gaspard", name: "Gaspard Fromentin", title: "Gérant du Réfectoire", floor: "f2", employer: "refectoire", traits: ["foodie", "grumpy"], ambition: { kind: "wealth" }, skills: { negotiation: 6, investigation: 3, charisma: 5, cunning: 7 }, weakness: "le fromage avant tout", salary: 70, wealth: 900 },
  { id: "r-leonie", name: "Léonie Craquelin", title: "PDG de la Biscuiterie Verticale", floor: "f3", employer: "biscuiterie", traits: ["hustler", "showoff"], ambition: { kind: "power" }, skills: { negotiation: 7, investigation: 4, charisma: 7, cunning: 7 }, weakness: "veut tout, tout de suite", salary: 75, wealth: 1100 },
  { id: "r-ambroise", name: "Ambroise Folio", title: "Gardien du Registre", floor: "f9", employer: "syndic", traits: ["meticulous", "shy"], ambition: { kind: "truth", theory: "Le Bâtiment a été construit à l'envers et le Plan Officiel le cache." }, skills: { negotiation: 3, investigation: 8, charisma: 3, cunning: 4 }, weakness: "voit des complots dans les notes de bas de page", salary: 50, wealth: 420 },
  { id: "r-remi", name: "Rémi Pallier", title: "Député", floor: "f4", employer: "syndic", traits: ["showoff", "hustler"], ambition: { kind: "power" }, skills: { negotiation: 7, investigation: 3, charisma: 8, cunning: 7 }, weakness: "dit oui à tout le monde", salary: 85, wealth: 1300 },
  { id: "r-colette", name: "Colette Brisquet", title: "Syndicaliste des étages inférieurs", floor: "fm2", employer: "syndic", traits: ["kind", "zealous"], ambition: { kind: "protect" }, skills: { negotiation: 8, investigation: 5, charisma: 7, cunning: 4 }, weakness: "ne fait jamais confiance à un banquier", salary: 40, wealth: 210 },
  { id: "r-hector", name: "Hector Vasque", title: "Plombier du Bâtiment", floor: "fm1", employer: "syndic", traits: ["clumsy", "gossip"], ambition: { kind: "truth", theory: "L'Étage 13 existe et le Syndic le cache." }, skills: { negotiation: 3, investigation: 6, charisma: 4, cunning: 3 }, weakness: "raconte à tout le monde qu'il a vu l'Étage 13", salary: 40, wealth: 160 },
  { id: "r-augustin", name: "Augustin Verdier", title: "Jardinier en chef des Serres du 12", floor: "f12", employer: "serres", traits: ["calm", "artist"], ambition: { kind: "wealth" }, skills: { negotiation: 5, investigation: 3, charisma: 5, cunning: 4 }, weakness: "parle aux plantes plus qu'aux gens", salary: 45, wealth: 340 },
];

// Profils « Bâtiment » des métiers de ton entreprise (QG) : ambition et compétences par défaut.
export const ROLE_PROFILES = {
  director: { ambition: "power", skills: { negotiation: 6, investigation: 2, charisma: 8, cunning: 4 } },
  deputy: { ambition: "power", skills: { negotiation: 4, investigation: 6, charisma: 3, cunning: 6 } },
  manager: { ambition: "power", skills: { negotiation: 6, investigation: 4, charisma: 6, cunning: 5 } },
  vinted: { ambition: "wealth", skills: { negotiation: 8, investigation: 4, charisma: 6, cunning: 6 } },
  sourcer: { ambition: "wealth", skills: { negotiation: 7, investigation: 6, charisma: 4, cunning: 6 } },
  dealhunter: { ambition: "wealth", skills: { negotiation: 5, investigation: 7, charisma: 4, cunning: 6 } },
  accountant: { ambition: "stability", skills: { negotiation: 4, investigation: 7, charisma: 3, cunning: 5 } },
  lawyer: { ambition: "truth", skills: { negotiation: 8, investigation: 7, charisma: 5, cunning: 7 } },
  hr: { ambition: "protect", skills: { negotiation: 6, investigation: 5, charisma: 3, cunning: 3 } },
  intern: { ambition: "change_role", skills: { negotiation: 3, investigation: 4, charisma: 5, cunning: 3 } },
  cleaner: { ambition: "stability", skills: { negotiation: 4, investigation: 8, charisma: 5, cunning: 5 } },
  scribe: { ambition: "truth", skills: { negotiation: 2, investigation: 7, charisma: 2, cunning: 3 } },
  growth: { ambition: "wealth", skills: { negotiation: 6, investigation: 4, charisma: 6, cunning: 7 } },
  data: { ambition: "truth", skills: { negotiation: 3, investigation: 8, charisma: 3, cunning: 4 } },
  talent: { ambition: "fame", skills: { negotiation: 7, investigation: 3, charisma: 7, cunning: 5 } },
  tiktok: { ambition: "fame", skills: { negotiation: 3, investigation: 3, charisma: 7, cunning: 4 } },
  snap: { ambition: "fame", skills: { negotiation: 3, investigation: 3, charisma: 7, cunning: 4 } },
  happiness: { ambition: "protect", skills: { negotiation: 5, investigation: 3, charisma: 7, cunning: 2 } },
};
export const DEFAULT_PROFILE = { ambition: "stability", skills: { negotiation: 4, investigation: 4, charisma: 4, cunning: 4 } };

// Entreprises internes. dailyCost : charges fixes ; product : ce qu'elles vendent aux occupants.
export const COMPANIES = [
  { id: "bosscorp", name: "Ton entreprise", floor: "f1", ceo: "director", product: "services", price: 0, cash: 6000, dailyCost: 150, kind: "services", sharesTo: { boss: 100 } },
  { id: "refectoire", name: "Réfectoire SA", floor: "f2", ceo: "r-gaspard", product: "plateau-repas", price: 12, cash: 2400, dailyCost: 220, kind: "food", sharesTo: { "r-gaspard": 55, "r-octave": 25, "r-arlette": 20 } },
  { id: "biscuiterie", name: "Biscuiterie Verticale", floor: "f3", ceo: "r-leonie", product: "crackers", price: 9, cash: 1800, dailyCost: 160, kind: "food", sharesTo: { "r-leonie": 70, "r-remi": 30 } },
  { id: "labo", name: "Laboratoire Inappliqué", floor: "f7", ceo: "r-edith", product: "brevets", price: 0, cash: 1500, dailyCost: 260, kind: "research", sharesTo: { "r-edith": 60, syndic: 40 } },
  { id: "gazette", name: "La Gazette de l'Ascenseur", floor: "f6", ceo: "r-felix", product: "journaux", price: 3, cash: 900, dailyCost: 120, kind: "media", sharesTo: { "r-octave": 60, "r-felix": 40 } },
  { id: "banque", name: "Banque du Sous-Sol", floor: "fm1", ceo: "r-octave", product: "crédits", price: 0, cash: 12000, dailyCost: 120, kind: "bank", sharesTo: { "r-octave": 80, syndic: 20 } },
  { id: "serres", name: "Les Serres du 12", floor: "f12", ceo: "r-augustin", product: "plantes", price: 25, cash: 700, dailyCost: 90, kind: "plants", sharesTo: { "r-augustin": 100 } },
];

// Produits absurdes des start-up fondées par les occupants.
export const STARTUP_PRODUCTS = [
  "parapluies d'intérieur", "abonnement au silence", "plans de l'Étage 13 (non garantis)", "eau d'ascenseur en bouteille",
  "assurance contre les réunions", "coaching de sieste", "tampons administratifs parfumés", "location de chaises qui ne grincent pas",
  "cartes de vœux pour plantes", "consulting en rumeurs", "NFT de couloirs", "escaliers premium",
];

// Organisations de départ.
export const ORGS = [
  { id: "o-ascension", name: "Parti de l'Ascension", kind: "party", leader: "r-remi", members: ["r-remi", "r-arlette", "r-octave"], goal: "Les meilleurs étages pour ceux qui montent.", stance: { order: 1, upper: 1 } },
  { id: "o-union", name: "Union des Étages Inférieurs", kind: "union", leader: "r-colette", members: ["r-colette", "r-marcel", "r-hector", "logistics", "cleaner"], goal: "Des salaires dignes et un ascenseur pour tout le monde.", stance: { order: -1, upper: -1 } },
  { id: "o-cercle", name: "Le Cercle du Plan Originel", kind: "secret", leader: "r-ambroise", members: ["r-ambroise", "r-hector", "scribe"], goal: "Retrouver la Charte originelle et prouver ce que cache le Plan.", stance: { order: -1, upper: 0 }, secret: true },
];

// Catalogue des lois : chaque code correspond à une règle réellement appliquée par la simulation.
export const LAW_CATALOG = {
  meeting_form: { title: "Loi du Formulaire R-12", text: "Toute assemblée d'organisation doit être justifiée par le formulaire R-12 (10 cr versés au Trésor).", sponsors: ["order"], appeal: "union" },
  elevator_filter: { title: "Loi sur la Dignité Verticale", text: "L'Ascenseur B refuse les occupants dont la réputation est inférieure à 30.", sponsors: ["order", "upper"], appeal: "union" },
  fired_vote: { title: "Loi du Dernier Mot", text: "Les licenciés et les morts administratifs conservent leur droit de vote.", sponsors: ["lower"], appeal: "order" },
  forbidden_word: { title: "Loi Anti-Synergie", text: "Le mot « synergie » est interdit dans le Bâtiment. Amende : 15 cr.", sponsors: ["order"], appeal: "any" },
  plant_declaration: { title: "Loi sur le Patrimoine Végétal", text: "Tout dirigeant doit déclarer et posséder au moins une plante des Serres du 12, sous peine d'amende.", sponsors: ["upper"], appeal: "any" },
  nap_tax: { title: "Taxe sur la Sieste", text: "Chaque sieste constatée est taxée 5 cr au profit du Trésor.", sponsors: ["order"], appeal: "lower" },
  cheese_ban: { title: "Loi de Prohibition Fromagère", text: "La vente de fromage est interdite au Réfectoire.", sponsors: ["upper"], appeal: "refectoire" },
  animal_personhood: { title: "Loi sur la Personnalité Animale", text: "Les animaux du Bâtiment sont des personnes : ils votent, possèdent un compte et peuvent se présenter.", sponsors: ["lower"], appeal: "order" },
  curfew: { title: "Couvre-feu des Couloirs", text: "Aucune activité dans les couloirs entre 22 h et 6 h. Les enquêtes nocturnes sont illégales.", sponsors: ["order"], appeal: "truth" },
  registry_audit: { title: "Loi d'Audit du Registre", text: "Le Registre est audité ligne par ligne pendant trois jours.", sponsors: ["lower", "truth"], appeal: "order" },
};

// Mystères de départ : la vérité est tirée au sort à la création du monde puis gardée secrète.
export const MYSTERY_SEEDS = [
  {
    id: "m-floor13",
    title: "L'Étage 13",
    question: "Pourquoi l'Ascenseur B s'arrête-t-il à un étage absent du Plan Officiel ?",
    truths: [
      { id: "sealed", text: "L'Étage 13 est un vrai étage, scellé et effacé du Plan par le Syndic après un incident ancien.", suspect: "r-arlette" },
      { id: "mirror", text: "L'Étage 13 est un étage-miroir né d'une fuite de réalité du Laboratoire Inappliqué.", suspect: "r-edith" },
    ],
    required: 6,
  },
  {
    id: "m-employee0",
    title: "L'Employé n°0",
    question: "Qui touche le salaire de l'Employé n°0, inscrit au Registre mais que personne n'a jamais vu ?",
    truths: [
      { id: "arlette", text: "Le salaire de l'Employé n°0 est détourné vers le compte d'Arlette Tampon.", beneficiary: "r-arlette" },
      { id: "marcel", text: "L'Employé n°0 est l'ancienne identité administrative de Marcel Pivert, qui touche encore ce salaire.", beneficiary: "r-marcel" },
      { id: "gustave", text: "L'Employé n°0 est Gustave le homard, inscrit par erreur : son salaire finance l'aquarium.", beneficiary: "r-gustave" },
    ],
    required: 7,
  },
  {
    id: "m-nightroom",
    title: "La salle réservée la nuit",
    question: "Qui réserve la salle des commissions de l'Hémicycle chaque nuit, sous un compte inconnu ?",
    truths: [
      { id: "cercle", text: "Le Cercle du Plan Originel s'y réunit en secret.", suspect: "r-ambroise" },
      { id: "loans", text: "Octave Lingot y négocie des prêts secrets avec le Syndic.", suspect: "r-octave" },
      { id: "cats", text: "Les chats du Bâtiment y dorment : la réservation est faite par un compte oublié de l'Étage 1.", suspect: "cat-pixel" },
    ],
    required: 5,
  },
];

// Relations de départ entre occupants (et avec quelques employés de l'Étage 1).
export const START_RELATIONS = [
  ["r-gaspard", "r-leonie", "rival", -50, "Le Réfectoire contre la Biscuiterie : la guerre du déjeuner."],
  ["r-octave", "r-colette", "rival", -40, "Colette ne fait jamais confiance à un banquier. Octave non plus, d'ailleurs."],
  ["r-prune", "r-arlette", "rival", -20, "Prune rêve du fauteuil d'Arlette, qui le sait."],
  ["r-marcel", "r-hector", "bff", 75, "Les deux langues les plus rapides du sous-sol."],
  ["r-felix", "r-nadia", "ami", 40, "Même machine à café, déontologies opposées."],
  ["r-remi", "r-leonie", "ami", 45, "Déjeuners d'affaires réguliers. Personne ne sait qui paie."],
  ["r-edith", "r-octave", "ami", 30, "La Banque finance le Labo. Le Labo ne pose pas de questions."],
  ["r-hermine", "r-arlette", "ami", 35, "Elles se tutoient en dehors des audiences."],
  ["r-ambroise", "r-hector", "ami", 50, "Le club (officieux) des chercheurs de l'Étage 13."],
  ["r-marcel", "cleaner", "ami", 55, "Ménage et conciergerie : le vrai pouvoir du Bâtiment."],
  ["r-colette", "logistics", "ami", 40, "Camarades de l'Union depuis la grève des chariots."],
  ["r-gaspard", "accountant", "ami", 35, "Le chili de l'Étage 1 et le fromage du 2 : une alliance gastronomique."],
];
