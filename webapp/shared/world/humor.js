// Humour contextuel du Bâtiment : vannes, références et running gags.
//
// Les vannes ne sont pas tirées au hasard dans le vide : elles sont choisies selon la
// SITUATION (ce qui vient réellement de se passer), remplies avec les éléments du monde
// (personnes, objets, montants, étages) et filtrées par le style d'humour du personnage
// qui parle. Certains adorent les références, d'autres les détestent, d'autres les
// comprennent de travers. Les running gags comptent leurs apparitions et évoluent.
// On s'inspire des MÉCANISMES des sitcoms et de la culture Internet, sans copier de scripts.

import { fill } from "./core.js";

// Références « mécanismes » : elles fonctionnent même sans connaître l'œuvre d'origine.
const REFS = {
  bureaucratie: ["Il faudra remplir le formulaire de demande de formulaire.", "Je vais ouvrir un ticket pour ouvrir un ticket.", "C'est validé, sous réserve de validation."],
  capitalisme: ["Techniquement, c'est un investissement dans le capital émotionnel.", "On appelle ça une perte. Moi j'appelle ça un actif en devenir.", "Le marché a parlé. Il a dit « aïe »."],
  startup: ["On pivote. Encore.", "C'est l'Uber de la photocopie.", "On va disrupter le couloir."],
  geek: ["C'est clairement un boss de fin de niveau.", "Il a raté son jet de sauvegarde en diplomatie.", "On est dans la mauvaise timeline, c'est évident."],
  anime: ["Il vient d'activer son mode berserker du tableur.", "Ça sent l'arc d'entraînement de trois épisodes.", "Il a crié le nom de son attaque avant d'envoyer le mail."],
  sitcom: ["*regard caméra*", "Et c'est là que tout le monde s'est tu.", "Ça, c'est un running gag qui va mal finir."],
  politique: ["On va créer une commission pour étudier la création d'une commission.", "Je ne commente pas, mais je le dis.", "C'est une réforme. Donc personne n'est content."],
  complot: ["Coïncidence ? Je ne crois pas. Je ne crois jamais.", "Regardez qui en profite. Indice : il a un badge doré.", "Tout est relié. Même la photocopieuse."],
  noir: ["Au moins, ça ne peut pas être pire. Ah si.", "On fera un bel hommage dans la Gazette.", "Ça finira au Tribunal ou à la machine à café. Même combat."],
  malaise: ["… Bon. Personne n'a rien vu.", "Il a fait un clin d'œil. Au mauvais moment. À la mauvaise personne.", "Le silence a duré onze secondes. On les a comptées."],
  internet: ["C'est pas un bug, c'est une feature.", "Ratio.", "Ça va finir en mème avant midi."],
  jeuvideo: ["+10 XP en bureaucratie.", "Succès débloqué : « Survivre au lundi ».", "Il a sauvegardé avant la réunion, j'espère."],
  meta: ["Si on était dans une série, ce serait la fin de l'épisode.", "Quelqu'un écrit forcément tout ça quelque part.", "Je sens qu'on en reparlera dans trois jours."],
  existentiel: ["Et si l'ascenseur, c'était nous ?", "On travaille pour payer le café qui nous fait travailler.", "Au fond, qu'est-ce qu'un étage ?"],
};

// Références comprises de travers (mélange de genres, attribution fantaisiste).
const WRONG = [
  "Comme disait le petit sorcier dans le film avec les vaisseaux : « que la photocopie soit avec toi ».",
  "C'est comme dans cette série où le patron est en fait le stagiaire. Ou l'inverse. Bref, c'est culte.",
  "On se croirait dans un épisode d'anime sur les impôts. Il y en a un, je suis sûr.",
  "Comme dans le jeu où on doit sauver la princesse, sauf que la princesse, c'est la trésorerie.",
  "C'est du Black Mirror, mais en version tableur. Ou c'était Succession ? Le truc avec les riches tristes.",
];

const HATER = ["Et pitié, pas de référence à une série.", "Ne me parlez pas de mèmes, je vous en supplie.", "Si quelqu'un dit « c'est très Black Mirror », je démissionne."];

// Vannes par situation. {a} = acteur principal, {b} = autre personne, {x} = objet/montant/lieu.
const QUIPS = {
  argument: [
    ["{a} : « Je ne crie pas, je mets de l'emphase sur mes arguments. »", ["malaise", "sitcom"]],
    ["{b} : « On en reparlera à la prochaine réunion. Que je ne programmerai pas. »", ["bureaucratie"]],
    ["{a} : « C'est une attaque personnelle. — {b} : C'était une remarque sur ton tableur. — {a} : Mon tableur, c'est moi. »", ["anime", "sitcom"]],
    ["{b} : « Très bien. Je le note dans mon carnet. Le rouge. »", ["noir", "complot"]],
  ],
  reconcile: [
    ["{a} : « On a dit des choses. Surtout toi. Mais on a dit des choses. »", ["sitcom"]],
    ["{b} : « Je te pardonne. J'ai quand même gardé les captures d'écran. »", ["internet", "noir"]],
  ],
  romance: [
    ["{a} : « Tu veux… partager un plateau-repas ? Pour l'économie d'échelle. »", ["malaise", "capitalisme"]],
    ["{b} : « Je crois qu'on vient de vivre un moment. Ou une fuite de gaz. »", ["existentiel", "sitcom"]],
    ["{a} : « Statistiquement, on se croise trop souvent devant la machine à café pour que ce soit un hasard. »", ["geek", "complot"]],
  ],
  awkward: [
    ["{b} : « Ah. Merci. C'est… gentil. Je dois aller arroser une plante qui n'est pas à moi. »", ["malaise"]],
    ["{a} : « Je voulais dire ça professionnellement. Très professionnellement. Je pars. »", ["malaise", "sitcom"]],
  ],
  rumor: [
    ["{a} : « Je ne dis rien, mais je le dis. »", ["politique", "sitcom"]],
    ["{b} : « Source ? — {a} : Le couloir. — {b} : Ah, alors c'est vrai. »", ["internet", "complot"]],
    ["{a} : « Ça reste entre nous et les trois cents personnes du Bâtiment. »", ["noir", "malaise"]],
  ],
  lunch_theft: [
    ["{a} : « Mon taboulé avait mon nom dessus. En capitales. Souligné. »", ["malaise", "sitcom"]],
    ["{b} : « Il n'y avait pas de nom. Il y avait une intention. »", ["existentiel"]],
    ["{a} : « Je ne porte pas plainte. Je porte un deuil. »", ["noir"]],
  ],
  meeting: [
    ["{a} : « Je propose qu'on fasse un point pour définir le périmètre du point. »", ["bureaucratie"]],
    ["{b} : « Cette réunion aurait pu être un mail. Ce mail aurait pu ne pas exister. »", ["existentiel", "internet"]],
    ["{a} : « On est alignés ? — {b} : On est alignés sur le fait de ne pas être alignés. »", ["startup", "politique"]],
  ],
  excuse: [
    ["{a} : « Je n'étais pas en retard, j'étais en avance sur la réunion de demain. »", ["meta", "existentiel"]],
    ["{a} : « L'Ascenseur B m'a gardé en otage. Il demandait une rançon en compliments. »", ["sitcom", "complot"]],
    ["{a} : « Je travaillais en mode asynchrone. Très asynchrone. »", ["startup"]],
  ],
  money_loss: [
    ["{a} : « Ce n'est pas une perte, c'est une dépense non sollicitée. »", ["capitalisme", "bureaucratie"]],
    ["{b} : « Les {x} n'ont pas disparu. Ils sont simplement ailleurs. Avec quelqu'un. »", ["complot", "noir"]],
  ],
  promotion: [
    ["{b} : « Félicitations. Je l'apprends en même temps que la plante. »", ["malaise", "sitcom"]],
    ["{a} : « Un grand pouvoir implique un plus grand badge. »", ["geek", "capitalisme"]],
  ],
  firing: [
    ["{a} : « Je ne suis pas viré, je suis libéré de mes engagements contractuels. »", ["startup", "existentiel"]],
    ["{b} : « Il reviendra. Personne ne quitte vraiment le Bâtiment. »", ["noir", "meta"]],
  ],
  law: [
    ["{a} : « Cette loi est absurde. Je vais donc la respecter scrupuleusement. »", ["bureaucratie", "politique"]],
    ["{b} : « Et l'amende, on la paie en crédits ou en dignité ? »", ["capitalisme", "noir"]],
  ],
  anomaly: [
    ["{a} : « J'ai vu un truc. Je ne sais pas quoi. Je refuse de savoir quoi. »", ["existentiel", "malaise"]],
    ["{b} : « Ce n'est pas une anomalie, c'est une fonctionnalité non documentée. »", ["internet", "geek"]],
    ["{a} : « Si je disparais, dites à ma plante que je l'aimais. »", ["noir", "sitcom"]],
  ],
  party: [
    ["{a} : « Ce n'est pas une fête, c'est un séminaire d'alignement festif. »", ["startup", "bureaucratie"]],
    ["{b} : « Qui a mis des génériques d'anime au karaoké ? — {a} : … Personne. »", ["anime", "malaise"]],
  ],
  scandal: [
    ["{a} : « Je n'ai aucun souvenir de ce que je n'ai pas fait. »", ["politique", "noir"]],
    ["{b} : « Pas de commentaire. Mais je souris très fort. »", ["sitcom", "politique"]],
  ],
  trial: [
    ["{a} : « Objection ! — La juge : Sur quelle base ? — {a} : Elle m'est venue comme ça. »", ["sitcom", "bureaucratie"]],
    ["{b} : « Votre Honneur, la plante témoin est formelle. »", ["existentiel", "malaise"]],
  ],
  competition: [
    ["{a} : « Ce n'est pas une compétition. Mais on va gagner. »", ["anime", "sitcom"]],
    ["{b} : « Le trophée est en carton. Mais c'est NOTRE carton. »", ["capitalisme", "jeuvideo"]],
  ],
  changemind: [
    ["{a} : « J'ai changé d'avis. J'ai toujours pensé ça, d'ailleurs. »", ["politique", "meta"]],
  ],
  contradiction: [
    ["{a} : « Hier tu as dit l'inverse. — {b} : Hier, c'était une autre personne. J'ai beaucoup grandi depuis. »", ["existentiel", "politique"]],
  ],
  elevator: [
    ["{a} : « L'Ascenseur B m'a encore refusé. Je pense qu'il m'en veut pour 2019. »", ["complot", "sitcom"]],
    ["{a} : « Douze étages à pied. Je sens chaque décision de ma vie. »", ["existentiel"]],
  ],
  portrait: [
    ["{a} : « Bonne nouvelle : le portrait est un actif immobilisé. Mauvaise nouvelle : il vaut plus que l'entreprise. »", ["capitalisme", "noir"]],
    ["{b} : « Il nous regarde. Le portrait. Il nous regarde travailler. »", ["complot", "malaise"]],
  ],
  pigeon: [
    ["{a} : « Je ne vote pas pour un pigeon. Je vote pour une idée. L'idée est un pigeon. »", ["politique", "existentiel"]],
    ["{b} : « Il roucoule pendant les minutes de silence. C'est un message. »", ["complot", "politique"]],
  ],
  coffee: [
    ["{a} : « Le distributeur m'a rendu la monnaie en boutons de chemise. »", ["sitcom", "existentiel"]],
    ["{b} : « Sans café, le Bâtiment s'arrête. C'est une infrastructure critique. »", ["capitalisme", "bureaucratie"]],
  ],
  generic: [
    ["{a} : « Je ne sais pas ce qui se passe, mais je suis contre. »", ["politique", "malaise"]],
    ["{b} : « Je vais faire comme si c'était prévu. »", ["meta", "sitcom"]],
    ["{a} : « On ne m'avait pas dit qu'il y aurait des conséquences. »", ["noir", "existentiel"]],
  ],
};

// Running gags : ils reviennent, comptent leurs apparitions et finissent par avoir des conséquences.
export const GAGS = {
  coffee: { label: "Le distributeur de café", stages: ["Le distributeur fait encore des siennes.", "Le distributeur récidive : c'est la {n}e fois.", "Une pétition circule pour la « libération du café ».", "Le distributeur a désormais son propre dossier au Tribunal."] },
  elevator: { label: "L'Ascenseur B", stages: ["L'Ascenseur B refuse quelqu'un.", "L'Ascenseur B semble avoir des préférences.", "Une liste officieuse de ses « favoris » circule.", "Des députés parlent d'accorder la personnalité juridique à l'Ascenseur B."] },
  portrait: { label: "Le portrait du PDG", stages: ["On parle du portrait.", "Le portrait revient dans toutes les conversations.", "Le portrait est devenu un symbole politique.", "Le portrait a désormais un avocat."] },
  pigeon: { label: "Roucoulade", stages: ["Le pigeon du Hall fait parler de lui.", "Le pigeon a des soutiens.", "Le pigeon a un programme (supposé).", "Le pigeon est une force politique."] },
  photocopieuse: { label: "La photocopieuse « Vu et approuvé »", stages: ["La photocopieuse ajoute « Vu et approuvé ».", "Un document « approuvé » par la photocopieuse a été appliqué.", "Le Registre hésite à reconnaître la photocopieuse."] },
  kevin: { label: "K.E.V.I.N. répond « ça dépend »", stages: ["K.E.V.I.N. a répondu « ça dépend ».", "K.E.V.I.N. répond « ça dépend » à une question de vie ou de mort.", "K.E.V.I.N. a été consulté par la Direction. Réponse : « ça dépend »."] },
  meetings: { label: "La réunion qui ne finit jamais", stages: ["Une réunion déborde.", "La réunion de 9 h est toujours en cours.", "La réunion a désormais son propre café attitré."] },
};

export function gag(world, id, subject = null) {
  const def = GAGS[id];
  if (!def) return null;
  world.gags ||= {};
  const g = (world.gags[id] ||= { id, count: 0, lastCycle: null, subjects: [] });
  g.count += 1;
  g.lastCycle = world.cycle;
  if (subject && !g.subjects.includes(subject)) g.subjects = [...g.subjects, subject].slice(-6);
  const stage = Math.min(def.stages.length - 1, Math.floor((g.count - 1) / 2));
  g.stage = stage;
  return fill(def.stages[stage], { n: g.count });
}

const nameOf = (world, id) => world.people[id]?.name || id;
const firstName = (world, id) => {
  const p = world.people[id];
  if (!p) return id;
  return p.first || p.name.split(" ")[0];
};

// Une réplique contextuelle pour `speaker` dans `situation`, ou null si ce n'est pas son
// genre d'humour / pas le bon moment (le rythme comique reste naturel).
export function quip(world, rng, speakerId, situation, { a = speakerId, b = null, x = "" } = {}, { force = false } = {}) {
  const speaker = world.people[speakerId];
  if (!speaker || speaker.kind === "animal") return null;
  const humor = speaker.humor || { tags: [], refs: "none", rate: 0.3 };
  if (!force && !rng.chance(humor.rate ?? 0.3)) return null;
  const pool = QUIPS[situation] || QUIPS.generic;
  const matching = pool.filter(([, tags]) => tags.some((t) => humor.tags?.includes(t)));
  const [template] = rng.pick(matching.length ? matching : pool);
  let line = fill(template, { a: firstName(world, a), b: b ? firstName(world, b) : "quelqu'un", x });
  // Le locuteur réel remplace {a} quand la réplique commence par son prénom : on garde le texte tel quel.
  if (rng.chance(0.3)) {
    if (humor.refs === "fan") line += ` ${rng.pick(REFS[rng.pick(humor.tags?.length ? humor.tags : ["sitcom"])] || REFS.sitcom)}`;
    else if (humor.refs === "wrong") line += ` ${rng.pick(WRONG)}`;
    else if (humor.refs === "hater") line += ` ${rng.pick(HATER)}`;
  }
  return line;
}

// Réactions de témoins à un événement : 0 à 2 répliques, selon leur humour.
export function reactions(world, rng, situation, { actors = [], witnesses = [], x = "" }, max = 2) {
  const lines = [];
  const [a, b] = actors;
  const candidates = rng.shuffle([...new Set([...actors, ...witnesses])]).filter((id) => world.people[id]?.kind !== "animal");
  for (const id of candidates) {
    if (lines.length >= max) break;
    const line = quip(world, rng, id, situation, { a: id === b ? b : a || id, b: id === b ? a : b, x });
    if (line) lines.push({ who: id, line });
  }
  return lines;
}

export function speakerName(world, id) {
  return nameOf(world, id);
}
