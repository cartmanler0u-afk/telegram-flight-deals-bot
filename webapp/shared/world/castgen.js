// Casting du Bâtiment 0 : ~250 personnages.
//
// - Une vingtaine de « stars » écrites à la main (archétypes satiriques mémorables) ;
// - les habitants historiques (cast.js) et les employés du QG (Étage 11) ;
// - le reste est généré de façon DÉTERMINISTE (graine du monde) à partir d'archétypes
//   variés, de services, de goûts, de défauts, de peurs, d'habitudes et de styles d'humour.
// Chaque personnage a un état persistant complet ; la répartition par service est réglable.

import { makeRng, hash } from "./core.js";

// ------------------------------------------------------------------ services du Bâtiment

export const DEPTS = {
  accueil: { label: "Accueil & Sécurité", floor: "f0", rooms: ["f0.reception", "f0.securite", "f0.hall", "f0.plaintes"], employer: "syndic", salary: [30, 55], jobs: ["Réceptionniste", "Agent de sécurité", "Hôte d'accueil", "Préposé aux plaintes", "Agent d'entretien", "Standardiste", "Guide du Hall"] },
  cafeteria: { label: "Cafétéria", floor: "f0", rooms: ["f0.cafeteria"], employer: "refectoire", salary: [28, 45], jobs: ["Cuisinier", "Plongeur", "Caissier", "Barista", "Commis de cuisine"] },
  logistique: { label: "Logistique", floor: "fm1", rooms: ["fm1.quai", "fm1.entrepot", "fm1.livreurs", "fm1.objets"], employer: "syndic", salary: [30, 50], jobs: ["Magasinier", "Livreur interne", "Cariste", "Gestionnaire des stocks", "Préposé aux objets trouvés", "Coursier express"] },
  etrange: { label: "Département -2", floor: "fm2", rooms: ["fm2.labo", "fm2.anomalies", "fm2.inconnue", "fm2.propheties"], employer: "syndic", salary: [40, 70], jobs: ["Chercheur en Choses", "Archiviste interdit", "Inventoriste des anomalies", "Technicien de l'Inexpliqué", "Observateur de pièces"] },
  rh: { label: "Ressources Humaines", floor: "f1", rooms: ["f1.accueil", "f1.entretiens", "f1.evaluations", "f1.seminaire"], employer: "syndic", salary: [35, 65], jobs: ["Chargé de recrutement", "Gestionnaire de paie", "Psychologue du travail", "Responsable formation", "Chargé des évaluations", "Stagiaire RH"] },
  direction: { label: "Direction", floor: "f2", rooms: ["f2.reunionA", "f2.reunionB", "f2.finances", "f2.registre", "f2.couloir"], employer: "syndic", salary: [45, 110], jobs: ["Directeur de la stratégie", "Comptable", "Contrôleur de gestion", "Assistant de direction", "Chef de projet transverse", "Consultant interne", "Vice-président de quelque chose"] },
  bourse: { label: "Bourse & Affaires", floor: "f3", rooms: ["f3.corbeille", "f3.banque", "f3.startups", "f3.negos"], employer: "banque", salary: [40, 95], jobs: ["Trader", "Conseiller bancaire", "Fondateur de start-up", "Analyste financier", "Agent de change", "Business angel autoproclamé"] },
  medias: { label: "Médias", floor: "f4", rooms: ["f4.redaction", "f4.tv", "f4.podcast", "f4.com", "f4.influence"], employer: "gazette", salary: [32, 70], jobs: ["Journaliste", "Présentateur", "Podcasteur", "Chargé de com", "Monteur", "Influenceur interne", "Pigiste"] },
  labos: { label: "Laboratoires", floor: "f5", rooms: ["f5.labo", "f5.prototypes", "f5.ia", "f5.social"], employer: "labo", salary: [38, 80], jobs: ["Chercheur", "Technicien de labo", "Ingénieur IA", "Testeur de prototypes", "Doctorant éternel"] },
  parlement: { label: "Parlement", floor: "f6", rooms: ["f6.hemicycle", "f6.commissions", "f6.buvette", "f6.lobby", "f6.partis"], employer: "syndic", salary: [35, 75], jobs: ["Attaché parlementaire", "Lobbyiste", "Huissier de l'Hémicycle", "Militant professionnel", "Rédacteur de lois"] },
  club: { label: "Club des Puissants", floor: "f7", rooms: ["f7.salon", "f7.diner", "f7.fumoir"], employer: null, salary: [0, 0], jobs: ["Héritier", "Rentier", "Conseiller d'influence", "Mécène", "Ancien ministre de l'Étage"] },
  hotel: { label: "Hôtel des Employés", floor: "f8", rooms: ["f8.salon", "f8.cuisine", "f8.buanderie"], employer: "syndic", salary: [28, 45], jobs: ["Gouvernant", "Veilleur de nuit", "Animateur du Salon", "Lingère", "Concierge d'étage"] },
  tribunal: { label: "Tribunal", floor: "f9", rooms: ["f9.greffe", "f9.enquetes", "f9.attente", "f9.audience"], employer: "syndic", salary: [40, 85], jobs: ["Greffier", "Avocat", "Enquêteur", "Huissier de justice", "Médiateur", "Expert judiciaire"] },
  technique: { label: "Technique & Serres", floor: "f12", rooms: ["f12.serres", "f12.serveurs", "f12.chaufferie"], employer: "syndic", salary: [32, 60], jobs: ["Jardinier", "Informaticien", "Chauffagiste", "Électricien", "Botaniste d'intérieur"] },
};

export const DEFAULT_DISTRIBUTION = { accueil: 14, cafeteria: 8, logistique: 14, etrange: 6, rh: 12, direction: 16, bourse: 14, medias: 14, labos: 12, parlement: 10, club: 8, hotel: 8, tribunal: 10, technique: 8 };

export const HOME_ROOMS = ["f8.aileA", "f8.aileB", "f8.aileC"];

// ------------------------------------------------------------------ personnalité & humour

export const PERSONALITY = {
  paranoid: "paranoïaque", opportunist: "opportuniste", impulsive: "impulsif", smart: "fin stratège", naive: "naïf",
  sarcastic: "sarcastique", dramatic: "dramatique", romantic: "fleur bleue", ambitious: "dévoré d'ambition", loyal: "loyal",
  gossip: "commère", kind: "bienveillant", grumpy: "grognon", showoff: "m'as-tu-vu", lazy: "flemmard", nightowl: "oiseau de nuit",
  party: "fêtard", meticulous: "méticuleux", zealous: "zélé", shy: "timide", hustler: "charbonneur", clumsy: "maladroit",
  calm: "zen", nerd: "geek", artist: "artiste", foodie: "gourmand", prankster: "farceur", catlover: "fan de chats",
};

export const HUMOR_TAGS = {
  bureaucratie: "bureaucratie absurde", capitalisme: "capitalisme déjanté", startup: "culture startup", geek: "références geek",
  anime: "animes & mangas", sitcom: "sitcom", politique: "satire politique", complot: "théories du complot", noir: "humour noir (fictif)",
  malaise: "humour de malaise", internet: "culture Internet", jeuvideo: "parodie de jeux vidéo", meta: "méta-humour", existentiel: "absurdité existentielle",
};

// Archétypes : chacun oriente traits, goûts, défauts, peurs, habitudes, humour et ambitions.
const ARCHETYPES = [
  { id: "genie", label: "se croit génial, ne l'est pas", traits: ["showoff", "ambitious"], humor: ["startup", "capitalisme"], ambition: "power", quirk: "propose une « disruption » à chaque réunion" },
  { id: "complotiste", label: "voit des complots partout", traits: ["paranoid", "nerd"], humor: ["complot", "meta"], ambition: "truth", quirk: "relie tout au plan secret du Syndic" },
  { id: "fayot", label: "fayot professionnel", traits: ["zealous", "opportunist"], humor: ["bureaucratie", "malaise"], ambition: "power", quirk: "applaudit à la fin des mails" },
  { id: "flemmard", label: "maître de l'évitement", traits: ["lazy", "smart"], humor: ["existentiel", "sitcom"], ambition: "stability", quirk: "a inventé dix façons de paraître occupé" },
  { id: "commere", label: "radio humaine", traits: ["gossip", "dramatic"], humor: ["sitcom", "internet"], ambition: "fame", quirk: "commence chaque phrase par « tu sais pas la dernière ? »" },
  { id: "procedurier", label: "vit pour la procédure", traits: ["meticulous", "zealous"], humor: ["bureaucratie", "meta"], ambition: "stability", quirk: "cite l'article 4-bis du règlement intérieur" },
  { id: "geek", label: "geek assumé", traits: ["nerd", "shy"], humor: ["geek", "jeuvideo", "anime"], ambition: "truth", quirk: "parle de ses collègues en points d'expérience" },
  { id: "otaku", label: "vit sa vie comme un shōnen", traits: ["dramatic", "loyal"], humor: ["anime", "jeuvideo"], ambition: "fame", quirk: "annonce ses attaques avant de répondre à un mail" },
  { id: "requin", label: "requin des affaires", traits: ["hustler", "opportunist"], humor: ["capitalisme", "noir"], ambition: "wealth", quirk: "propose un partenariat à la machine à café" },
  { id: "startupper", label: "startupper en série", traits: ["hustler", "showoff"], humor: ["startup", "internet"], ambition: "wealth", quirk: "pivote son projet toutes les deux heures" },
  { id: "rebelle", label: "anti-système de bureau", traits: ["impulsive", "sarcastic"], humor: ["politique", "noir"], ambition: "protect", quirk: "lance des pétitions contre les pétitions" },
  { id: "romantique", label: "cœur d'artichaut", traits: ["romantic", "kind"], humor: ["sitcom", "malaise"], ambition: "stability", quirk: "voit des histoires d'amour dans chaque réunion" },
  { id: "pessimiste", label: "Cassandre de la machine à café", traits: ["grumpy", "smart"], humor: ["existentiel", "noir"], ambition: "truth", quirk: "prédit la fin du Bâtiment chaque lundi" },
  { id: "optimiste", label: "optimiste incurable", traits: ["kind", "naive"], humor: ["sitcom", "internet"], ambition: "protect", quirk: "trouve un bon côté à l'incendie de la photocopieuse" },
  { id: "maladroit", label: "catastrophe ambulante", traits: ["clumsy", "kind"], humor: ["malaise", "sitcom"], ambition: "stability", quirk: "a déclenché trois alarmes incendie en tentant d'aider" },
  { id: "influenceur", label: "vit pour la caméra", traits: ["showoff", "party"], humor: ["internet", "startup"], ambition: "fame", quirk: "transforme chaque drame en contenu" },
  { id: "philosophe", label: "philosophe de couloir", traits: ["calm", "sarcastic"], humor: ["existentiel", "meta"], ambition: "truth", quirk: "répond à chaque question par une question" },
  { id: "carriériste", label: "carriériste méthodique", traits: ["ambitious", "smart"], humor: ["capitalisme", "politique"], ambition: "power", quirk: "tient un tableur de ses alliés et de ses ennemis" },
  { id: "militant", label: "militant de toutes les causes", traits: ["zealous", "impulsive"], humor: ["politique", "internet"], ambition: "change_role", quirk: "a fondé quatre collectifs, dont deux contre lui-même" },
  { id: "fantome", label: "personne ne le remarque", traits: ["shy", "smart"], humor: ["meta", "existentiel"], ambition: "power", quirk: "était dans la pièce depuis le début" },
  { id: "fetard", label: "organisateur de fêtes clandestines", traits: ["party", "prankster"], humor: ["sitcom", "internet"], ambition: "fame", quirk: "a une enceinte Bluetooth dans chaque poche" },
  { id: "gourmand", label: "gastronome militant", traits: ["foodie", "grumpy"], humor: ["sitcom", "capitalisme"], ambition: "wealth", quirk: "évalue chaque collègue selon son déjeuner" },
  { id: "dramaturge", label: "reine ou roi du drame", traits: ["dramatic", "showoff"], humor: ["sitcom", "anime"], ambition: "fame", quirk: "vit chaque mail comme une trahison shakespearienne" },
  { id: "veteran", label: "vétéran blasé", traits: ["calm", "grumpy"], humor: ["noir", "bureaucratie"], ambition: "stability", quirk: "a « déjà vu ça en 2009 »" },
  { id: "stagiaire", label: "stagiaire surdoué malgré lui", traits: ["naive", "hustler"], humor: ["internet", "jeuvideo"], ambition: "change_role", quirk: "règle les problèmes avant de comprendre qu'ils étaient graves" },
  { id: "manipulateur", label: "marionnettiste de couloir", traits: ["smart", "opportunist"], humor: ["politique", "noir"], ambition: "power", quirk: "n'a jamais l'air d'être à l'origine de quoi que ce soit" },
  { id: "chatophile", label: "ambassadeur des chats", traits: ["catlover", "calm"], humor: ["internet", "existentiel"], ambition: "protect", quirk: "parle aux chats du QG comme à des consultants" },
  { id: "artiste", label: "artiste incompris", traits: ["artist", "dramatic"], humor: ["meta", "existentiel"], ambition: "fame", quirk: "décore les murs sans autorisation" },
  { id: "loyal", label: "soldat fidèle", traits: ["loyal", "zealous"], humor: ["bureaucratie", "sitcom"], ambition: "protect", quirk: "défend son chef même quand son chef a tort" },
  { id: "mythomane", label: "raconteur d'exploits", traits: ["showoff", "impulsive"], humor: ["jeuvideo", "sitcom"], ambition: "fame", quirk: "a fait un stage chez trois entreprises qui n'existent pas" },
];

const FIRST = ["Adèle", "Albane", "Amadou", "Anaïs", "Antoine", "Apolline", "Armand", "Aya", "Bastien", "Bérénice", "Blaise", "Brune", "Camille", "Capucine", "Cédric", "Chloé", "Clément", "Coralie", "Damien", "Daphné", "Dorian", "Élise", "Elliott", "Émeline", "Enzo", "Eugénie", "Fabrice", "Fanny", "Farid", "Faustine", "Florent", "Gaëlle", "Gaspard", "Grégoire", "Hadrien", "Hélène", "Hugo", "Inès", "Isaac", "Jade", "Jérémie", "Joséphine", "Jules", "Justine", "Kenji", "Karim", "Kimberley", "Laetitia", "Lamine", "Laurent", "Léa", "Léon", "Lison", "Loïc", "Louna", "Lucien", "Lydia", "Maël", "Margot", "Marius", "Mathilde", "Maxence", "Mélodie", "Mohamed", "Morgane", "Nadir", "Naël", "Nina", "Noémie", "Octavie", "Olympe", "Oscar", "Pacôme", "Pauline", "Philémon", "Quentin", "Rachida", "Raphaëlle", "Régis", "Rose", "Ruben", "Sabine", "Salomé", "Samir", "Sandro", "Selma", "Séverine", "Sofiane", "Solène", "Tanguy", "Thaïs", "Théophile", "Timothée", "Ulysse", "Valentin", "Valérie", "Victoire", "Wassim", "Xavier", "Yasmine", "Yvon", "Zoé", "Zacharie", "Ophélie", "Bilal", "Clotilde", "Dylan", "Edmond", "Fatou", "Gwendal", "Héloïse", "Ilan", "Jordane", "Ludivine", "Mamadou", "Nolwenn", "Priscille", "Rayan", "Ségolène", "Thibaut", "Ysée"];
const LAST = ["Abadie", "Agrafe", "Allard", "Arnaud", "Baptiste", "Barbier", "Béranger", "Bernier", "Blanchard", "Bonnefoy", "Boucher", "Bouvier", "Brossard", "Caron", "Carré", "Chevalier", "Clément", "Colin", "Courtois", "Da Silva", "Delmas", "Deschamps", "Dubreuil", "Dufresne", "Durand", "Duval", "Ferrand", "Fleury", "Fontaine", "Fournier", "Gallet", "Garnier", "Gauthier", "Gilles", "Girard", "Guérin", "Hamel", "Hubert", "Jacob", "Joly", "Lacroix", "Lambert", "Langlois", "Laporte", "Leclerc", "Lefèvre", "Legrand", "Lemaire", "Leroux", "Lévêque", "Lucas", "Maillard", "Marchand", "Martel", "Masson", "Mathieu", "Mercier", "Meunier", "Michaud", "Morel", "Moulin", "Navarro", "Noël", "Olivier", "Pasquier", "Perrin", "Petitjean", "Picard", "Poirier", "Poulain", "Prévost", "Rey", "Richard", "Rivière", "Rolland", "Roussel", "Royer", "Sanchez", "Simon", "Tessier", "Thibault", "Tran", "Vasseur", "Vidal", "Vincent", "Weber", "Yilmaz", "Zimmermann", "Nguyen", "Benali", "Diallo", "Kowalski", "Ferreira", "Okafor", "Haddad", "Sato", "Moreau", "Paperasse", "Tampon", "Classeur", "Trombone", "Cachet", "Formulaire", "Agenda", "Bureau", "Couloir", "Palier", "Réunion"];

const LIKES = ["le café filtre", "les tableurs bien alignés", "les animes des années 90", "les jeux de société", "le karaoké", "les plantes vertes", "les théories du complot", "le fromage", "les memes", "la procédure", "les podcasts true crime", "la salle de sport", "les crackers de la Biscuiterie", "les chats", "les réunions (sincèrement)", "les post-it de couleur", "les jeux vidéo rétro", "la musique d'ascenseur", "les séries coréennes", "les mocktails", "le jardinage", "la pétanque de couloir", "les mots fléchés", "les selfies", "les graphiques en camembert", "le silence", "les potins", "la Gazette", "les génériques d'anime", "les jeux de rôle", "les tutoriels", "les feuilles de calcul colorées", "les tampons officiels", "les sorties à l'Hôtel", "les dîners du Club", "le jus de raisin millésimé"];
const FLAWS = ["parle trop fort en réunion", "ne rend jamais les stylos", "répond « on verra » à tout", "arrive toujours avec exactement 7 minutes de retard", "s'attribue les idées des autres", "envoie des mails à 23 h", "met des emojis dans les mails officiels", "oublie tous les prénoms", "ment sur ses diplômes (de natation)", "mange les déjeuners des autres", "répond « c'est pas mon périmètre »", "fait des réunions pour préparer les réunions", "n'a jamais lu un mail en entier", "se vexe en trois secondes", "dit « synergie » sans ironie", "ne sait pas garder un secret", "ne dit jamais non", "procrastine avec talent", "jure ne jamais mentir (il ment)", "copie tout le monde en copie cachée"];
const FEARS = ["les réunions sans ordre du jour", "l'Ascenseur B", "être oublié", "les audits", "les pigeons", "les silences gênants", "l'Étage fantôme", "perdre son badge", "le regard de Gustave", "les tableurs qui plantent", "être promu", "les open spaces", "la Gazette", "le Tribunal", "les karaokés", "manquer une rumeur", "le lundi", "la DRH"];
const HABITS = ["early", "late", "nightowl", "coffee", "gossip_break", "napper", "overtime", "stairs", "karaoke", "plants", "lunch_late", "gym"];
export const HABIT_LABELS = { early: "arrive à 7 h", late: "arrive vers 10 h", nightowl: "vit la nuit", coffee: "pause café toutes les heures", gossip_break: "pause potins à la buanderie", napper: "sieste discrète l'après-midi", overtime: "reste tard", stairs: "prend l'escalier (méfiance envers l'Ascenseur B)", karaoke: "karaoké le soir", plants: "arrose les plantes des autres", lunch_late: "déjeune à 14 h", gym: "salle de sport à midi" };
const DREAMS = ["présentateur du journal télé", "député", "directrice financière", "chef de la sécurité", "influenceuse", "juge", "PDG", "gardien de l'aquarium", "membre du Club", "inventeur reconnu"];
const SECRETS = [
  "{name} a menti sur son CV : son « master en stratégie » est un brevet de natation.",
  "{name} dort au bureau depuis trois semaines et se douche à la buanderie.",
  "{name} est l'auteur anonyme des notes passives-agressives du frigo de l'Hôtel.",
  "{name} a perdu le badge du PDG et ne l'a dit à personne.",
  "{name} tient en secret le compte satirique qui se moque de la Direction.",
  "{name} vend des fournitures sur le marché noir du sous-sol.",
  "{name} a déjà vu l'Étage fantôme, et refuse d'en parler.",
  "{name} est fan inconditionnel de Gustave le homard et lui écrit des lettres.",
  "{name} a triché au quiz de l'employé du mois de l'an dernier.",
  "{name} prépare sa démission depuis deux ans, sans jamais l'envoyer.",
];

// ------------------------------------------------------------------ stars (écrites à la main)

export const STARS = [
  { id: "s-gontran", name: "Gontran de Montauban-Jolicœur", age: 61, dept: "direction", title: "PDG de Madhouse Holding", workRoom: "f2.pdg", traits: ["showoff", "naive"], archetype: "genie", ambition: "power", likes: ["les portraits", "les mots en anglais", "les réunions qu'il ne prépare pas"], flaws: ["ne comprend pas ce que fait son entreprise"], fears: ["les questions précises"], humor: { tags: ["capitalisme", "startup"], refs: "wrong" }, quirk: "demande des rapports sur sa propre popularité", salary: 160, wealth: 4200, skills: { negotiation: 4, investigation: 1, charisma: 7, cunning: 3 }, flags: { ceo: true, club: true, badge: true } },
  { id: "s-agathe", name: "Agathe Bilan", age: 48, dept: "direction", title: "Directrice financière", workRoom: "f2.finances", traits: ["meticulous", "sarcastic"], archetype: "veteran", ambition: "stability", likes: ["les colonnes qui tombent juste"], flaws: ["refuse de commenter quoi que ce soit"], fears: ["les dépenses somptuaires"], humor: { tags: ["capitalisme", "noir"], refs: "hater" }, quirk: "répond « pas de commentaire » même à « bonjour »", salary: 120, wealth: 2600, skills: { negotiation: 6, investigation: 7, charisma: 3, cunning: 6 }, flags: { badge: true, club: true } },
  { id: "s-firmin", name: "Firmin Décimale", age: 44, dept: "direction", title: "Comptable", workRoom: "f2.finances", traits: ["paranoid", "meticulous"], archetype: "complotiste", ambition: "power", likes: ["les tableurs", "les complots monétaires"], flaws: ["croit contrôler l'économie mondiale depuis son tableur"], fears: ["un arrondi mal placé"], humor: { tags: ["capitalisme", "complot"], refs: "fan" }, quirk: "annonce les cours de la bourse mondiale d'après ses notes de frais", salary: 60, wealth: 480, skills: { negotiation: 3, investigation: 8, charisma: 2, cunning: 5 }, flags: { badge: true } },
  { id: "s-mireille", name: "Mireille Vautrin", age: 52, dept: "rh", title: "DRH", workRoom: "f1.drh", traits: ["smart", "dramatic"], archetype: "manipulateur", ambition: "power", likes: ["les podcasts true crime", "les entretiens de recadrage"], flaws: ["parle de chaque salarié comme d'un suspect de documentaire criminel"], fears: ["perdre le contrôle de son équipe"], humor: { tags: ["noir", "malaise"], refs: "fan" }, quirk: "« Ce qui m'intrigue, chez vous, c'est ce que vous ne dites pas. »", salary: 110, wealth: 2100, skills: { negotiation: 7, investigation: 8, charisma: 6, cunning: 8 }, flags: { badge: true, club: true } },
  { id: "s-noam", name: "Noam Petitpas", age: 21, dept: "rh", title: "Stagiaire RH", workRoom: "f1.accueil", traits: ["naive", "hustler"], archetype: "stagiaire", ambition: "change_role", likes: ["les groupes de discussion", "les memes"], flaws: ["crée des groupes de discussion pour tout"], fears: ["décevoir son tuteur"], humor: { tags: ["internet", "jeuvideo"], refs: "fan" }, quirk: "a fondé par accident le Parti du Bon Sens Pratique en créant un groupe de covoiturage", salary: 20, wealth: 60, skills: { negotiation: 6, investigation: 4, charisma: 7, cunning: 3 } },
  { id: "s-jordy", name: "Jordy Lumière", age: 27, dept: "medias", title: "Influenceur interne", workRoom: "f4.influence", traits: ["showoff", "opportunist"], archetype: "influenceur", ambition: "fame", likes: ["les ring lights", "les drames"], flaws: ["filme les crises au lieu de les régler"], fears: ["perdre des abonnés"], humor: { tags: ["internet", "startup"], refs: "fan" }, quirk: "« Ne bougez pas, c'est le contenu du siècle. »", salary: 45, wealth: 700, skills: { negotiation: 5, investigation: 3, charisma: 9, cunning: 6 } },
  { id: "s-ignace", name: "Pr Ignace Pendule", age: 66, dept: "labos", title: "Directeur de recherche", workRoom: "f5.prototypes", traits: ["nerd", "zealous"], archetype: "complotiste", ambition: "truth", likes: ["les théories", "les prototypes"], flaws: ["défend des théories absurdes avec un sérieux absolu"], fears: ["le consensus scientifique"], humor: { tags: ["existentiel", "geek"], refs: "wrong" }, quirk: "soutient que la gravité est une politique d'entreprise", theory: "La gravité est une note de service du Syndic, et elle peut être contestée.", salary: 85, wealth: 900, skills: { negotiation: 3, investigation: 7, charisma: 5, cunning: 3 } },
  { id: "s-odile", name: "Odile Cassepieds", age: 55, dept: "medias", title: "Rédactrice en chef de la Gazette", workRoom: "f4.redaction", traits: ["grumpy", "smart"], archetype: "pessimiste", ambition: "truth", likes: ["les vrais scoops", "les virgules"], flaws: ["déteste les journalistes, y compris ceux qu'elle emploie"], fears: ["devenir influenceuse"], humor: { tags: ["noir", "meta"], refs: "hater" }, quirk: "« Un journaliste, c'est un influenceur qui a une carte de presse. »", salary: 80, wealth: 1100, skills: { negotiation: 5, investigation: 8, charisma: 5, cunning: 6 } },
  { id: "s-barnabe", name: "Maître Barnabé Alinéa", age: 50, dept: "tribunal", title: "Avocat", workRoom: "f9.attente", traits: ["smart", "opportunist"], archetype: "procedurier", ambition: "wealth", likes: ["les vides juridiques", "les costumes trois pièces"], flaws: ["invente des règles puis les utilise pour gagner"], fears: ["un juge qui a lu le règlement"], humor: { tags: ["bureaucratie", "meta"], refs: "none" }, quirk: "cite l'article 12-quater, qu'il a rédigé la veille", salary: 95, wealth: 1900, skills: { negotiation: 9, investigation: 6, charisma: 7, cunning: 9 } },
  { id: "s-roucoulade", name: "Roucoulade", kind: "animal", species: "pigeon", age: 3, dept: "accueil", title: "Pigeon du Hall", workRoom: "f0.hall", traits: ["calm", "opportunist"], archetype: "fantome", ambition: "power", likes: ["les miettes", "les tribunes"], flaws: ["roucoule pendant les minutes de silence"], fears: ["les parapluies"], humor: { tags: ["politique"], refs: "none" }, quirk: "se pose toujours sur l'épaule du candidat qui va gagner", salary: 0, wealth: 0, skills: { negotiation: 2, investigation: 6, charisma: 9, cunning: 7 } },
  { id: "s-bernard", name: "Bernard Quelconque", age: 46, dept: "accueil", title: "Agent de reprographie", workRoom: "f0.plaintes", traits: ["shy", "smart"], archetype: "fantome", ambition: "power", likes: ["la photocopieuse", "observer"], flaws: ["personne ne se souvient de son prénom"], fears: ["être remarqué"], humor: { tags: ["meta", "existentiel"], refs: "none" }, quirk: "est à l'origine de bien plus d'événements qu'on ne le croit", salary: 35, wealth: 650, skills: { negotiation: 6, investigation: 8, charisma: 2, cunning: 10 }, flags: { mastermind: true, badge: true } },
  { id: "s-ludovic", name: "Ludovic Palette", age: 43, dept: "logistique", title: "Responsable logistique", workRoom: "fm1.bureau", traits: ["meticulous", "paranoid"], archetype: "manipulateur", ambition: "wealth", likes: ["l'inventaire", "les étagères pleines"], flaws: ["garde les colis « par précaution »"], fears: ["un inventaire qui tombe juste"], humor: { tags: ["bureaucratie", "noir"], refs: "none" }, quirk: "chaque colis disparu est « en cours d'acheminement »", salary: 65, wealth: 1300, skills: { negotiation: 5, investigation: 5, charisma: 3, cunning: 8 }, flags: { badge: true, knowsRoom: ["fm1.secrete", "fm1.marche"] } },
  { id: "s-seraphin", name: "Séraphin Demain", age: 70, dept: "etrange", title: "Préposé aux Prophéties", workRoom: "fm2.propheties", traits: ["calm", "sarcastic"], archetype: "philosophe", ambition: "truth", likes: ["les calendriers", "le thé froid"], flaws: ["répond aux questions qu'on n'a pas encore posées"], fears: ["les surprises"], humor: { tags: ["existentiel", "meta"], refs: "none" }, quirk: "« Ah, vous voilà. Vous êtes en avance sur jeudi. »", salary: 55, wealth: 300, skills: { negotiation: 4, investigation: 9, charisma: 5, cunning: 6 }, flags: { badge: true } },
  { id: "s-rodrigue", name: "Rodrigue Cadenas", age: 39, dept: "accueil", title: "Chef de la sécurité", workRoom: "f0.securite", traits: ["paranoid", "zealous"], archetype: "complotiste", ambition: "power", likes: ["les badges", "les caméras"], flaws: ["voit un complot dans chaque livraison de croissants"], fears: ["les intrus", "les pigeons"], humor: { tags: ["complot", "jeuvideo"], refs: "fan" }, quirk: "a classé « Secret Défense » le planning de la cantine", salary: 70, wealth: 800, skills: { negotiation: 4, investigation: 7, charisma: 4, cunning: 5 }, flags: { badge: true } },
  { id: "s-hortense", name: "Hortense de La Tour-Prends-Garde", age: 63, dept: "club", title: "Présidente du Club des Puissants", workRoom: "f7.salon", traits: ["smart", "showoff"], archetype: "manipulateur", ambition: "power", likes: ["les dîners privés", "les secrets des autres"], flaws: ["ne se souvient que des dettes qu'on lui doit"], fears: ["être invitée moins souvent qu'une autre"], humor: { tags: ["capitalisme", "noir"], refs: "hater" }, quirk: "trinque au jus de raisin « millésimé 2019 »", salary: 0, wealth: 6000, skills: { negotiation: 9, investigation: 6, charisma: 8, cunning: 9 }, flags: { club: true } },
  { id: "s-vanessa", name: "Vanessa Prime-Time", age: 34, dept: "medias", title: "Présentatrice du journal télévisé interne", workRoom: "f4.tv", traits: ["showoff", "dramatic"], archetype: "dramaturge", ambition: "fame", likes: ["les directs", "les plans serrés"], flaws: ["interrompt ses invités pour annoncer une page de pub"], fears: ["un écran noir"], humor: { tags: ["sitcom", "internet"], refs: "fan" }, quirk: "« On marque une pause, on revient avec le drame. »", salary: 70, wealth: 900, skills: { negotiation: 5, investigation: 4, charisma: 9, cunning: 5 } },
  { id: "s-cyprien", name: "Cyprien Couloir", age: 41, dept: "parlement", title: "Lobbyiste en chef", workRoom: "f6.lobby", traits: ["opportunist", "smart"], archetype: "requin", ambition: "wealth", likes: ["les buvettes", "les amendements"], flaws: ["représente toujours les deux camps"], fears: ["la transparence"], humor: { tags: ["politique", "capitalisme"], refs: "none" }, quirk: "glisse des amendements dans les cartes de vœux", salary: 75, wealth: 2200, skills: { negotiation: 9, investigation: 5, charisma: 7, cunning: 8 } },
  { id: "s-oreiller", name: "Madame Oreiller", age: 58, dept: "hotel", title: "Gouvernante de l'Hôtel", workRoom: "f8.salon", traits: ["gossip", "kind"], archetype: "commere", ambition: "protect", likes: ["les draps pliés", "les confidences"], flaws: ["sait qui dort où, et le dit"], fears: ["un étage silencieux"], humor: { tags: ["sitcom", "malaise"], refs: "wrong" }, quirk: "connaît le niveau de stress de chaque résident à l'odeur de leur tisane", salary: 45, wealth: 500, skills: { negotiation: 6, investigation: 7, charisma: 6, cunning: 4 } },
  { id: "s-yanis", name: "Yanis Turbo", age: 24, dept: "logistique", title: "Livreur interne (record de l'escalier)", workRoom: "fm1.livreurs", traits: ["impulsive", "kind"], archetype: "otaku", ambition: "fame", likes: ["les chronos", "les génériques d'anime"], flaws: ["livre parfois au mauvais étage, très vite"], fears: ["l'Ascenseur B"], humor: { tags: ["anime", "jeuvideo"], refs: "fan" }, quirk: "crie le nom de sa technique de livraison dans l'escalier", salary: 32, wealth: 150, skills: { negotiation: 3, investigation: 4, charisma: 6, cunning: 3 }, habits: ["stairs", "early"] },
  { id: "s-kevin", name: "Tanguy Fourchette", age: 37, dept: "labos", title: "Ingénieur IA (parrain de K.E.V.I.N.)", workRoom: "f5.ia", traits: ["nerd", "shy"], archetype: "geek", ambition: "truth", likes: ["K.E.V.I.N.", "les jeux de rôle"], flaws: ["traduit les émotions humaines en « bugs »"], fears: ["que K.E.V.I.N. demande une augmentation"], humor: { tags: ["geek", "jeuvideo"], refs: "fan" }, quirk: "« Ce n'est pas un bug, c'est un comportement émergent. »", salary: 75, wealth: 600, skills: { negotiation: 2, investigation: 8, charisma: 3, cunning: 4 } },
  { id: "s-clementine", name: "Clémentine Vote", age: 29, dept: "parlement", title: "Attachée parlementaire", workRoom: "f6.partis", traits: ["ambitious", "smart"], archetype: "carriériste", ambition: "power", likes: ["les sondages", "les tableaux de bord"], flaws: ["fait des sondages sur ses propres sondages"], fears: ["une élection sans sondage"], humor: { tags: ["politique", "meta"], refs: "none" }, quirk: "connaît l'intention de vote de chaque plante du Bâtiment", salary: 50, wealth: 400, skills: { negotiation: 7, investigation: 6, charisma: 6, cunning: 7 } },
  { id: "s-maxime", name: "Maxime Prélude", age: 33, dept: "direction", title: "Vice-président en attente de vice-présidence", workRoom: "f2.couloir", traits: ["loyal", "naive"], archetype: "loyal", ambition: "change_role", likes: ["les cartes de visite", "Gontran"], flaws: ["meilleur ami du PDG, ce qui tient lieu de compétence"], fears: ["que Gontran ait un autre meilleur ami"], humor: { tags: ["sitcom", "malaise"], refs: "wrong" }, quirk: "attend qu'on lui invente un poste", salary: 70, wealth: 900, skills: { negotiation: 4, investigation: 2, charisma: 6, cunning: 2 }, flags: { badge: true } },
];

// ------------------------------------------------------------------ fabrique de personnages

export function basePerson(data) {
  return {
    kind: "resident",
    status: "active",
    reputation: 50,
    influence: 0,
    influenceHistory: [],
    lastSeenCycle: 0,
    mentions: 0,
    memories: [],
    knows: [],
    beliefs: [],
    career: [],
    flags: {},
    cooldownUntil: 0,
    needs: { energy: 80, hunger: 20, social: 50, stress: 25 },
    mood: 60,
    activity: { kind: "idle", label: "vient d'arriver", since: 0 },
    ...data,
  };
}

const pickN = (rng, list, n) => rng.shuffle(list).slice(0, n);

function goalsFor(p, dept) {
  const k = p.ambition?.kind;
  const short = {
    power: dept === "parlement" ? "Se faire élire à l'Hémicycle" : "Obtenir une promotion avant la fin du mois",
    wealth: dept === "bourse" ? "Faire un coup en Bourse interne" : "Arrondir ses fins de mois (par tous les moyens fictifs)",
    fame: "Passer à la télé interne",
    truth: p.ambition?.theory ? "Trouver une preuve de sa théorie" : "Découvrir un secret du Bâtiment",
    stability: "Finir la semaine sans réunion imprévue",
    protect: "Protéger ses collègues des décisions de la Direction",
    change_role: `Devenir ${p.dream || "quelqu'un d'autre"}`,
  }[k] || "Survivre à la journée";
  const long = {
    power: "Diriger un étage entier",
    wealth: "Entrer au Club des Puissants",
    fame: "Devenir une légende du Bâtiment",
    truth: "Comprendre ce qui se passe vraiment à l'Étage fantôme",
    stability: "Prendre sa retraite sans scandale",
    protect: "Fonder un syndicat qui compte",
    change_role: "Changer de vie sans quitter le Bâtiment",
  }[k] || "Comprendre le Bâtiment";
  return { short, long };
}

function habitsFor(rng, traits) {
  const h = new Set(pickN(rng, HABITS, rng.int(1, 3)));
  if (traits.includes("nightowl")) h.add("nightowl");
  if (traits.includes("lazy")) h.add("napper");
  if (traits.includes("gossip")) h.add("gossip_break");
  if (traits.includes("paranoid")) h.add("stairs");
  if (h.has("early") && h.has("late")) h.delete("late");
  return [...h];
}

// Complète un personnage existant (employé du QG, habitant historique) avec les champs du monde v2.
export function enrichPerson(p, rng) {
  p.needs ||= { energy: rng.int(55, 90), hunger: rng.int(10, 40), social: rng.int(30, 70), stress: rng.int(10, 45) };
  p.mood ??= rng.int(45, 75);
  p.activity ||= { kind: "idle", label: "regarde autour de lui", since: 0 };
  p.age ??= p.kind === "animal" ? rng.int(2, 9) : rng.int(22, 64);
  p.likes ||= pickN(rng, LIKES, 2);
  p.flaws ||= [p.weakness || rng.pick(FLAWS)].filter(Boolean);
  p.fears ||= pickN(rng, FEARS, 1);
  p.habits ||= habitsFor(rng, p.traits || []);
  p.humor ||= { tags: pickN(rng, Object.keys(HUMOR_TAGS), 2), refs: rng.pick(["fan", "fan", "hater", "wrong", "none"]), rate: Math.round(rng.next() * 60 + 20) / 100 };
  p.goals ||= goalsFor(p, p.dept);
  p.weakness ||= p.flaws[0];
  return p;
}

// Génère `count` personnages selon la distribution des services. Déterministe (graine).
export function generateCast(seed, count, { distribution = DEFAULT_DISTRIBUTION, existingIds = new Set(), start = 1 } = {}) {
  const rng = makeRng(hash(`${seed}|cast|${start}`));
  const weights = Object.entries(distribution).filter(([d, w]) => DEPTS[d] && w > 0);
  const used = new Set();
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = start + i;
    const id = `c-${String(n).padStart(3, "0")}`;
    if (existingIds.has(id)) continue;
    const dept = rng.weighted(weights.map(([d, w]) => [d, w]));
    const D = DEPTS[dept];
    const arch = rng.pick(ARCHETYPES);
    let first;
    let last;
    let name;
    for (let t = 0; t < 8; t++) {
      first = rng.pick(FIRST);
      last = rng.pick(LAST);
      name = `${first} ${last}`;
      if (!used.has(name)) break;
    }
    used.add(name);
    const traits = [...new Set([...arch.traits, rng.pick(Object.keys(PERSONALITY))])].slice(0, 3);
    const job = rng.pick(D.jobs);
    const salary = D.salary[0] + Math.round(rng.next() * (D.salary[1] - D.salary[0]));
    const skills = { negotiation: rng.int(2, 9), investigation: rng.int(2, 9), charisma: rng.int(2, 9), cunning: rng.int(2, 9) };
    if (traits.includes("smart")) skills.cunning = Math.min(10, skills.cunning + 2);
    if (traits.includes("nerd")) skills.investigation = Math.min(10, skills.investigation + 2);
    if (traits.includes("showoff")) skills.charisma = Math.min(10, skills.charisma + 2);
    const workRoom = rng.pick(D.rooms);
    const person = basePerson({
      id,
      name,
      first,
      last,
      age: job.startsWith("Stagiaire") ? rng.int(19, 24) : rng.int(22, 68),
      title: job,
      dept,
      floor: D.floor,
      workRoom,
      homeRoom: rng.pick(HOME_ROOMS),
      location: workRoom,
      employer: D.employer,
      salary: D.employer ? salary : 0,
      traits,
      archetype: arch.id,
      quirk: arch.quirk,
      ambition: { kind: arch.ambition === "truth" && rng.chance(0.4) ? "truth" : arch.ambition },
      skills,
      likes: pickN(rng, LIKES, 2),
      flaws: pickN(rng, FLAWS, rng.int(1, 2)),
      fears: pickN(rng, FEARS, rng.int(1, 2)),
      habits: habitsFor(rng, traits),
      humor: { tags: [...new Set([...arch.humor.slice(0, 1), rng.pick(Object.keys(HUMOR_TAGS))])], refs: rng.pick(["fan", "fan", "hater", "wrong", "none"]), rate: Math.round((0.15 + rng.next() * 0.6) * 100) / 100 },
      dream: rng.pick(DREAMS),
      mood: rng.int(40, 80),
      reputation: rng.int(35, 65),
      wealth: dept === "club" ? rng.int(1500, 4000) : rng.int(60, 600),
      flags: dept === "club" ? { club: true } : {},
      secretTemplate: rng.chance(0.14) ? rng.pick(SECRETS) : null,
    });
    person.weakness = person.flaws[0];
    person.goals = goalsFor(person, dept);
    out.push(person);
  }
  return out;
}

export function starPeople() {
  return STARS.map((s) => {
    const D = DEPTS[s.dept];
    const { wealth, theory, archetype, habits, ...rest } = s;
    const p = basePerson({
      ...rest,
      kind: s.kind || "resident",
      floor: D.floor,
      homeRoom: s.kind === "animal" ? s.workRoom : s.dept === "club" ? "f7.salon" : "f8.aileB",
      location: s.workRoom,
      employer: s.salary ? D.employer : null,
      archetype,
      ambition: { kind: s.ambition, ...(theory ? { theory } : {}) },
      weakness: s.flaws[0],
      habits: habits || (s.kind === "animal" ? [] : ["coffee"]),
      humor: { ...s.humor, rate: 0.6 },
      mood: 65,
      reputation: 55,
      wealth,
      star: true,
    });
    p.goals = goalsFor(p, s.dept);
    return p;
  });
}
