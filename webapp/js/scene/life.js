// Vie de bureau : pauses, Uber Eats, blagues entre collègues, ménage, réunions improvisées,
// interviews face caméra… Tout est visuel et propre à cet écran (rien n'est enregistré).

import { SPOTS, MEETING_SEATS, MEETING_STANDING, GATHER, BINS, deskTop } from "./layout.js";

const rand = (list) => list[Math.floor(Math.random() * list.length)];
const chance = (p) => Math.random() < p;

const FOODS = ["🌮 tacos", "🍣 sushis", "🍔 burger", "🍕 pizza", "🥙 kebab", "🥗 poke bowl", "🍜 ramen", "🍗 poulet frit", "🥐 viennoiseries", "🍝 pâtes carbo"];

const WHITEBOARD = [
  "Bertrand = 🤡",
  "QUI A MANGÉ MON YAOURT ?!",
  "Réunion = sieste déguisée",
  "Victor ❤️ Victor",
  "Le café est une drogue (je valide)",
  "Je démissionne. (non)",
  "Bertrand a perdu au baby-foot 3-0",
  "VENDREDI !!!",
  "Ne pas toucher à mon tupperware — Bruno",
  "Kylian, rends la carte bleue de la boîte",
  "Objectif du mois : survivre",
  "Le wifi c'est « Boss2024 » chut",
];

const COOLER_LINES = [
  ["T'as vu la nouvelle annonce d'Inès ? Vendue en 4 minutes.", "Elle est trop forte."],
  ["Il paraît que Victor a encore acheté un trophée pour lui-même.", "Encore ?!"],
  ["Qui a laissé du poisson dans le micro-ondes ?", "…Bruno."],
  ["Le pôle créateurs ouvre bientôt, non ?", "Chloé est à fond dessus."],
  ["Lucas a trouvé un vol pour Bali à 300 €.", "Je pose mes congés."],
  ["Josiane sait tout. TOUT.", "Je sais."],
  ["Le stagiaire a encore cassé la photocopieuse.", "Classique."],
];

const BOSS_SPEECHES = [
  "J'ai réuni tout le monde pour… vous dire que je suis fier de vous.",
  "Annonce importante : j'ai trouvé un nouveau slogan. « On vend, on kiffe. »",
  "Qui veut participer à mon podcast ? Personne ? Super, je note tout le monde.",
  "Petite réunion surprise : l'ambiance, c'est moi.",
  "Je voulais juste qu'on se regarde dans les yeux. Voilà. Retournez bosser.",
];

const QUOTES = {
  prank: [
    "J'ai mis son agrafeuse dans la gelée. Encore. C'est la quatrième fois cette année.",
    "Ce n'est pas une blague, c'est du team building.",
    "Il ne remarquera rien. *regarde la caméra* Il remarque toujours tout.",
  ],
  target: [
    "Les blagues sont un crime contre la productivité. J'ai ouvert une enquête.",
    "Je sais qui c'est. J'ai des preuves. J'ai TOUJOURS des preuves.",
    "J'ai déjà prévenu les ressources humaines. Elles n'ont pas répondu.",
  ],
  boss: [
    "Je ne suis pas un patron. Je suis un ami… qui signe les fiches de paie.",
    "Un bon leader sait quand faire une réunion. Moi je la fais tout le temps, comme ça je ne rate pas le bon moment.",
    "Le mug « Meilleur Boss du Monde », je l'ai acheté moi-même. Mais il dit vrai.",
  ],
  food: [
    "Troisième commande Uber Eats de la journée. Pour équilibrer les comptes.",
    "Manger au bureau, c'est de la productivité. Je mange, donc je produis.",
  ],
  cleaner: [
    "Je vide la corbeille, je nettoie le cache… et je sais TOUT ce qu'il y a dedans.",
    "Un bureau propre, c'est un esprit propre. Sauf celui de Kylian.",
  ],
  lazy: [
    "Je ne dors pas. Je fais de la veille. Les yeux fermés.",
    "Je ne suis pas stagiaire. Je suis entrepreneur en résidence.",
  ],
  party: [
    "Un pot par semaine, c'est le minimum syndical.",
    "J'ai mis la playlist. Personne ne m'a demandé. C'est ça le leadership.",
  ],
  fire: [
    "Il n'y avait pas d'incendie. Mais il aurait pu y en avoir un. Vous me remercierez.",
    "Temps d'évacuation : 41 secondes. Inacceptable. On recommence demain.",
  ],
  work: [
    "Ici, on vend, on source, on monte des vidéos… et on survit aux réunions de Victor.",
    "Mon métier ? Je trouve des pépites. Et je les revends plus cher. C'est beau, non ?",
  ],
  love: [
    "On est juste collègues. *regarde la caméra* …Très bons collègues.",
    "Non, on ne déjeune pas ensemble TOUS les jours. Juste les jours ouvrés.",
    "Josiane a tout deviné avant nous. Josiane devine toujours tout.",
  ],
  crush: [
    "Je lui ai demandé un stylo. J'avais déjà un stylo. J'ai trois stylos.",
    "Quoi ? Non. Je rougis parce qu'il fait chaud. Il fait toujours chaud quand… bref.",
  ],
  hr: [
    "Victor a renommé mon fichier « Gérard_le_rabat-joie.docx ». Je n'ai rien dit.",
    "Ma plante est triste. Moi aussi, un peu. Mais on tient bon, elle et moi.",
    "La boîte à suggestions contient 14 papiers « Virer Gérard ». Tous de la même écriture.",
  ],
  karate: [
    "Ceinture noire. De karaté-bureau, mais ceinture noire quand même.",
    "Un vrai professionnel est toujours prêt. Même pendant la pause café. SURTOUT pendant la pause café.",
  ],
  intern: [
    "Mon tuteur dit que j'apprends vite. Il a dit ça en me retirant l'accès à l'imprimante.",
    "J'ai fait 14 cafés. On m'en avait demandé un. Mais je préfère anticiper.",
    "Le stage, c'est formateur. Par exemple, j'ai appris où ne PAS ranger le chili de Bruno.",
  ],
  cat: [
    "Les chats sont les seuls collègues qui ne font jamais de réunion. Des modèles.",
    "Pixel a plus de followers que notre compte pro. Je ne sais pas comment le vivre.",
  ],
  eotm: [
    "Je voudrais remercier ma maman, mon tuteur… et la machine à café, surtout.",
    "Employé du mois. Je vais l'écrire sur ma tasse. Et sur mon CV. Et sur ma tombe.",
  ],
  gym: [
    "Je fais du sport pour pouvoir manger plus de chili. C'est un cercle vertueux.",
    "Le tapis de course, c'est comme une réunion de Victor : on court, on n'avance pas.",
  ],
};

const GYM_LINES = ["Encore 5 minutes… 🥵", "Qui a mis Céline Dion sur l'enceinte ?", "No pain, no gain 💪", "Je fais ça pour les photos de l'été."];
const RIVAL_LINES = [
  ["C'est MON tour à la photocopieuse.", "J'étais là AVANT toi."],
  ["Tu as encore piqué mon agrafeuse ?", "Prouve-le."],
  ["Belle présentation… pour un stagiaire.", "Je ne suis PAS stagiaire."],
];
const COUPLE_LINES = [["Tu viens prendre un café ? ☕", "Avec toi, toujours ❤️"], ["J'ai gardé le dernier cookie pour toi 🍪", "C'est pour ça que je t'aime"], ["On déjeune ensemble ?", "Comme tous les jours 😌"]];
const CRUSH_LINES = ["Euh… salut ! T'aurais un stylo ? 😳", "J'ai fait trop de café, tu en veux ? (j'en ai fait exprès)", "Jolie… jolie présentation. Ce matin. Voilà. 😳"];

export class LifeDirector {
  constructor(world) {
    this.world = world;
    this.nextAt = performance.now() + 5000;
    this.lastInterviewAt = 0;
    this.busy = new Set();
    this.timers = new Set();
  }

  // ------------------------------------------------------------------ outils

  later(ms, fn) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  name(id) {
    return this.world.state?.agents.find((a) => a.id === id)?.name || "Quelqu'un";
  }

  agent(id) {
    return this.world.state?.agents.find((a) => a.id === id) || null;
  }

  has(actor, trait) {
    return (this.agent(actor.agentId)?.traits || []).includes(trait);
  }

  available({ includeWorking = true, exclude = [] } = {}) {
    return [...this.world.actors.values()].filter((a) =>
      !a.trip.length && !a.meetingSeat && !a.person.moving && !this.busy.has(a.agentId) && !exclude.includes(a.agentId) && (includeWorking || !a.working));
  }

  pick(candidates, trait) {
    const fans = trait ? candidates.filter((a) => this.has(a, trait)) : [];
    return fans.length && chance(0.75) ? rand(fans) : rand(candidates);
  }

  hold(actor, ms) {
    this.busy.add(actor.agentId);
    this.later(ms, () => this.busy.delete(actor.agentId));
  }

  log(icon, text, agentId = null) {
    this.world.onLife?.({ at: Date.now(), icon, text, agentId });
  }

  interview(agentId, kind, delay = 2500) {
    if (!this.world.documentary) return;
    if (performance.now() - this.lastInterviewAt < 25000) return;
    this.lastInterviewAt = performance.now();
    const agent = this.agent(agentId);
    if (!agent) return;
    const pool = QUOTES[kind] || QUOTES.work;
    this.later(delay, () => this.world.onInterview?.({ agent, quote: rand(pool) }));
  }

  film(x, z) {
    const cam = this.world.npcs.get("cameraman");
    if (!cam || cam.trip.length) return;
    const angle = Math.random() * Math.PI * 2;
    const spot = { x: x + Math.cos(angle) * 2.2, z: z + Math.sin(angle) * 2.2, standing: true };
    spot.facing = Math.atan2(x - spot.x, z - spot.z);
    cam.trip.push({ spot, activity: "film", dwell: 9000 }, { spot: cam.home, activity: "idle", dwell: 100 });
  }

  // ------------------------------------------------------------------ horloge

  tick(now) {
    if (!this.world.state || now < this.nextAt) return;
    this.nextAt = now + 6000 + Math.random() * 6000;
    const inLife = [...this.world.actors.values()].filter((a) => a.trip.length).length;
    if (inLife >= 6) return;
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    const lunch = hour >= 11.5 && hour <= 14;
    const friday = new Date().getDay() === 5;
    const mess = this.world.messCount() + (this.world.whiteboardText ? 1 : 0);
    const events = [
      ["coffee", 5],
      ["cooler", 3],
      ["uber", lunch ? 6 : 1.5],
      ["microwave", lunch ? 1.5 : 0.5],
      ["prankBoard", 1.6],
      ["prankTrash", 1.2],
      ["prankJelly", 0.9],
      ["prankPostit", 1.2],
      ["clean", mess ? 3 + mess : 0.8],
      ["bossMeeting", 0.7],
      ["dance", friday ? 2.5 : 0.8],
      ["phone", 2.5],
      ["printer", 1.2],
      ["nap", hour > 14 && hour < 17 ? 1.8 : 0.6],
      ["babyfoot", 1.4],
      ["vending", 1],
      ["couple", 2.2],
      ["crush", 1.4],
      ["bff", 1.6],
      ["rivals", 1.2],
      ["victorHR", 0.8],
      ["suggestion", 0.6],
      ["internCoffee", 1.3],
      ["internLost", 0.8],
      ["chili", 0.35],
      ["karate", 0.8],
      ["gym", 1.6],
      ["gaming", 1],
      ["lounge", 1.4],
      ["petCat", 2.2],
      ["feedCats", hour > 11 && hour < 13 ? 2 : 0.4],
      ["campaign", 0.8],
    ];
    const total = events.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [id, w] of events) {
      r -= w;
      if (r <= 0) {
        this.run(id);
        return;
      }
    }
  }

  run(id) {
    const fn = this[`ev_${id}`];
    if (fn) return fn.call(this);
    return false;
  }

  // ------------------------------------------------------------------ évènements spontanés

  ev_coffee() {
    const actor = this.pick(this.available(), "lazy");
    if (!actor) return false;
    const spot = rand(SPOTS.coffee);
    actor.trip.push({ spot, activity: "coffee", dwell: 7000 + Math.random() * 5000, onArrive: () => actor.person.say(rand(["☕ Petite pause", "Café n°4 de la journée", "Ça avance bien !", "🍪 Quelqu'un veut un cookie ?"]), 2600) });
    return true;
  }

  ev_cooler() {
    const pool = this.available();
    const a = this.pick(pool, "gossip");
    const b = a && this.pick(pool.filter((x) => x !== a));
    if (!a || !b) return false;
    const [l1, l2] = rand(COOLER_LINES);
    a.trip.push({ spot: SPOTS.coffee[2], activity: "talk", dwell: 9000, onArrive: () => this.later(600, () => a.person.say(l1, 3500)) });
    b.trip.push({ spot: SPOTS.coffee[3], activity: "talk", dwell: 9000, onArrive: () => this.later(3800, () => b.person.say(l2, 3000)) });
    this.log("💬", `${this.name(a.agentId)} et ${this.name(b.agentId)} papotent à la fontaine à eau.`, a.agentId);
    this.film(20, 4.7);
    return true;
  }

  ev_uber(target = null) {
    const actor = target || this.pick(this.available(), "foodie");
    if (!actor || !actor.home) return false;
    const food = rand(FOODS);
    const name = this.name(actor.agentId);
    this.hold(actor, 45000);
    actor.trip.push({ spot: actor.home, activity: "phone", dwell: 3000, onArrive: () => actor.person.say(`🛵 Commande Uber Eats : ${food}`, 3000) });
    this.log("🛵", `${name} a commandé ${food} sur Uber Eats.`, actor.agentId);
    this.later(14000 + Math.random() * 8000, () => this.deliver([actor], food));
    if (this.has(actor, "foodie")) this.interview(actor.agentId, "food", 30000);
    return true;
  }

  deliver(customers, food) {
    const courier = this.world.npcs.get("courier");
    if (!courier) return;
    courier.person.root.visible = true;
    courier.person.place({ ...SPOTS.entranceOut });
    const names = customers.map((c) => this.name(c.agentId));
    courier.trip.push({
      spot: SPOTS.courier,
      activity: "idle",
      dwell: 900000,
      onArrive: () => {
        courier.person.say(customers.length > 1 ? `🛵 Livraison pour toute l'équipe !` : `🛵 Commande pour ${names[0]} !`, 3500);
        this.world.actors.get("secretary")?.person.say("Livraison à l'accueil ! 📦", 2500);
        customers.forEach((c, i) => {
          this.busy.delete(c.agentId);
          c.trip.length = 0;
          c.trip.push(
            { spot: { ...SPOTS.pickup, x: SPOTS.pickup.x + (i % 3) * 0.6, z: SPOTS.pickup.z - Math.floor(i / 3) * 0.7 }, activity: "talk", dwell: 1500 },
            {
              spot: SPOTS.eat[i % SPOTS.eat.length],
              activity: "eat",
              dwell: 13000 + Math.random() * 5000,
              onArrive: () => i < 3 && c.person.say(rand(["Miam 😋", "Enfin !!", "C'est froid… mais c'est bon", `Trop bon ce ${food.split(" ").slice(1).join(" ")}`]), 2500),
            }
          );
        });
        this.later(2500 + customers.length * 500, () => {
          courier.trip.length = 0;
          courier.trip.push({ spot: SPOTS.entranceOut, activity: "idle", dwell: 500, onArrive: () => courier.person.say("Bon appétit !", 1500), onDone: () => (courier.person.root.visible = false) });
        });
      },
    });
    this.film(-3.5, 13);
  }

  ev_microwave() {
    const actor = this.pick(this.available(), "foodie");
    if (!actor) return false;
    actor.trip.push({
      spot: SPOTS.microwave,
      activity: "idle",
      dwell: 8000,
      onArrive: () => {
        actor.person.say("🐟 Je fais réchauffer mon poisson", 3000);
        this.later(3500, () => {
          const nearby = this.available().filter((a) => a !== actor).slice(0, 2);
          nearby.forEach((n, i) => this.later(i * 1200, () => n.person.say(rand(["QUI fait chauffer du poisson ?!", "Ça sent jusqu'ici 🤢", "Ouvrez une fenêtre !!"]), 2600)));
        });
      },
    });
    this.log("🐟", `${this.name(actor.agentId)} réchauffe du poisson au micro-ondes. L'open space est en deuil.`, actor.agentId);
    return true;
  }

  prankster() {
    return this.pick(this.available(), "prankster");
  }

  victim(prank) {
    const candidates = [...this.world.actors.values()].filter((a) => a !== prank && a.home && !a.home.standing && a.agentId !== "director");
    const targets = candidates.filter((a) => this.has(a, "target"));
    return targets.length && chance(0.65) ? targets[0] : rand(candidates);
  }

  ev_prankBoard() {
    const actor = this.prankster();
    if (!actor) return false;
    const text = rand(WHITEBOARD);
    this.hold(actor, 20000);
    actor.trip.push({
      spot: SPOTS.whiteboard,
      activity: "write",
      dwell: 4500,
      onArrive: () => actor.person.say("✍️ Hé hé…", 2000),
      onDone: () => {
        this.world.writeWhiteboard(text, this.name(actor.agentId));
        actor.person.say("😏", 1800);
      },
    });
    this.log("🖊️", `Quelqu'un a écrit « ${text} » sur le tableau blanc de la cuisine.`, actor.agentId);
    this.film(-24.5, 14.6);
    if (this.has(actor, "prankster")) this.interview(actor.agentId, "prank", 9000);
    return true;
  }

  deskPrank(kind, emoji, line, logText) {
    const actor = this.prankster();
    const target = actor && this.victim(actor);
    if (!actor || !target || this.world.hasMess(target.home.id)) return false;
    const top = deskTop(target.home);
    const spot = { x: target.home.x + top.fz * 0.75, z: target.home.z - top.fx * 0.75, standing: true };
    spot.facing = Math.atan2(top.x - spot.x, top.z - spot.z);
    this.hold(actor, 25000);
    if (kind === "trash") {
      const bin = BINS.reduce((best, b) => (Math.hypot(b.x - actor.person.root.position.x, b.z - actor.person.root.position.z) < Math.hypot(best.x - actor.person.root.position.x, best.z - actor.person.root.position.z) ? b : best), BINS[0]);
      actor.trip.push({ spot: { x: bin.x - 0.55, z: bin.z, facing: Math.PI / 2, standing: true }, activity: "drop", dwell: 1200 });
    }
    actor.trip.push({
      spot,
      activity: "drop",
      dwell: 2200,
      onDone: () => {
        this.world.addMess(target.home.id, kind);
        actor.person.say(emoji, 1500);
        const victimName = this.name(target.agentId);
        this.log(emoji, logText.replace("{v}", victimName), actor.agentId);
        // Réaction quand la victime est (ou revient) à son bureau
        this.later(4000, () => {
          target.person.say(line, 3200);
          if (!target.trip.length && !target.meetingSeat) target.trip.push({ spot: { ...target.home, standing: true }, activity: "shock", dwell: 2600 });
          if (this.has(target, "target")) this.interview(target.agentId, "target", 4000);
        });
      },
    });
    this.film(top.x, top.z);
    return true;
  }

  ev_prankTrash() {
    return this.deskPrank("trash", "🗑️", "QUI A VIDÉ LA POUBELLE SUR MON BUREAU ?!", "Quelqu'un a vidé une corbeille sur le bureau de {v}.");
  }

  ev_prankJelly() {
    return this.deskPrank("jelly", "🍮", "Mon agrafeuse… DANS LA GELÉE. ENCORE.", "L'agrafeuse de {v} a fini dans la gelée.");
  }

  ev_prankPostit() {
    return this.deskPrank("postit", "🟨", "Pourquoi mon écran est couvert de post-its ?!", "L'écran de {v} est recouvert de post-its.");
  }

  ev_clean(force = false) {
    const cleaner = [...this.world.actors.values()].find((a) => this.agent(a.agentId)?.role === "cleaner" && !a.trip.length && !a.meetingSeat);
    if (!cleaner) return false;
    const stops = [];
    for (const seatId of this.world.messyDesks().slice(0, 4)) {
      const seat = this.world.seatById(seatId);
      if (!seat) continue;
      const top = deskTop(seat);
      stops.push({ spot: { x: seat.x - top.fz * 0.75, z: seat.z + top.fx * 0.75, standing: true, facing: Math.atan2(top.x - (seat.x - top.fz * 0.75), top.z - (seat.z + top.fx * 0.75)) }, onDone: () => this.world.clearMess(seatId) });
    }
    if (this.world.whiteboardText) stops.push({ spot: SPOTS.whiteboard, onDone: () => this.world.eraseWhiteboard() });
    for (const [key, m] of this.world.floorMess) stops.push({ spot: { x: m.x - 0.8, z: m.z + 0.3, standing: true, facing: Math.PI / 2 }, onDone: () => this.world.clearFloorMess(key) });
    if (!stops.length && !force) {
      const randomSeats = [...this.world.actors.values()].filter((a) => a.home && !a.home.standing).slice(0, 30);
      for (let i = 0; i < 2 && randomSeats.length; i++) {
        const seat = rand(randomSeats).home;
        const top = deskTop(seat);
        stops.push({ spot: { x: seat.x - top.fz * 0.75, z: seat.z + top.fx * 0.75, standing: true, facing: 0 } });
      }
    }
    if (!stops.length) return false;
    stops.forEach((s, i) => cleaner.trip.push({
      spot: s.spot,
      activity: "clean",
      dwell: 3200,
      onArrive: () => i === 0 && cleaner.person.say(rand(["🧹 Allez, on nettoie tout ça", "Encore un bureau en bazar…", "Je nettoie le cache, je nettoie les bureaux…"]), 2600),
      onDone: s.onDone,
    }));
    cleaner.trip.push({ spot: cleaner.home, activity: "idle", dwell: 300, onArrive: () => cleaner.person.say("Et voilà, tout propre ✨", 2200) });
    this.log("🧹", `${this.name(cleaner.agentId)} fait sa tournée de ménage.`, cleaner.agentId);
    if (chance(0.4)) this.interview(cleaner.agentId, "cleaner", 6000);
    return true;
  }

  ev_bossMeeting() {
    const boss = this.world.actors.get("director");
    if (!boss || boss.trip.length || boss.meetingSeat || this.world.state.meetings.some((m) => m.status === "live")) return false;
    const crowd = this.available({ exclude: ["director"] }).slice(0, 6);
    if (crowd.length < 3) return false;
    boss.person.say("TOUT LE MONDE EN SALLE DE CONF' !", 3000);
    this.hold(boss, 35000);
    boss.trip.push({ spot: MEETING_SEATS[0], activity: "talk", dwell: 16000, onArrive: () => this.later(2500, () => boss.person.say(rand(BOSS_SPEECHES), 6000)) });
    crowd.forEach((a, i) => {
      this.hold(a, 35000);
      this.later(800 + i * 300, () => a.trip.push({ spot: MEETING_SEATS[(i + 1) % MEETING_SEATS.length], activity: "talk", dwell: 15000, onDone: () => i === 0 && a.person.say(rand(["…c'était tout ?", "J'ai perdu 15 minutes de ma vie", "Il est sérieux là ?"]), 2600) }));
    });
    this.log("📣", `${this.name("director")} a convoqué une réunion improvisée (pour rien).`, "director");
    this.film(-11.5, -13);
    this.interview("director", "boss", 20000);
    return true;
  }

  ev_dance() {
    const actor = this.pick(this.available(), "party");
    if (!actor || !actor.home) return false;
    const standing = { ...actor.home, standing: true };
    actor.trip.push({ spot: standing, activity: "dance", dwell: 7000, onArrive: () => actor.person.say("🎵 C'est ma chanson !!", 2500) });
    this.log("🕺", `${this.name(actor.agentId)} danse à son bureau.`, actor.agentId);
    if (chance(0.4)) this.interview(actor.agentId, "party", 7000);
    return true;
  }

  ev_phone() {
    const actor = this.pick(this.available().filter((a) => a.home && !a.home.standing), "hustler");
    if (!actor) return false;
    const role = this.agent(actor.agentId)?.role;
    const line = {
      vinted: "Oui l'article est toujours dispo ! 📦",
      support: "Je comprends tout à fait, madame…",
      sourcer: "Vous me faites combien pour le lot complet ?",
      dealhunter: "Attends, le vol est à combien ?!",
      talent: "On cale un rendez-vous pour en parler ?",
      logistics: "Le colis est parti ce matin, promis.",
    }[role] || rand(["Allô ? Oui c'est moi.", "Je te rappelle, je suis en réunion (non).", "Ouais ouais, on fait ça."]);
    actor.trip.push({ spot: actor.home, activity: "phone", dwell: 6000, onArrive: () => actor.person.say(`📞 ${line}`, 3500) });
    return true;
  }

  ev_printer() {
    const actor = this.pick(this.available(), "lazy");
    if (!actor) return false;
    actor.trip.push({
      spot: SPOTS.copier,
      activity: "kick",
      dwell: 5000,
      onArrive: () => actor.person.say(rand(["BOURRAGE PAPIER ?! ENCORE ?!", "Elle me déteste, cette machine.", "Allez… allez… ALLEZ."]), 3000),
    });
    this.log("🖨️", `${this.name(actor.agentId)} se bat contre la photocopieuse.`, actor.agentId);
    this.film(21.8, 4.1);
    return true;
  }

  ev_nap() {
    const actor = this.pick(this.available().filter((a) => a.home && !a.home.standing), "lazy");
    if (!actor) return false;
    actor.trip.push({ spot: actor.home, activity: "sleep", dwell: 9000, onArrive: () => actor.person.say("💤", 6000) });
    if (this.has(actor, "lazy")) this.interview(actor.agentId, "lazy", 6000);
    return true;
  }

  ev_babyfoot() {
    const pool = this.available();
    const a = rand(pool);
    const b = a && rand(pool.filter((x) => x !== a));
    if (!a || !b) return false;
    a.trip.push({ spot: SPOTS.babyfoot[0], activity: "babyfoot", dwell: 11000, onArrive: () => a.person.say("Prépare-toi à perdre 😤", 2500) });
    b.trip.push({ spot: SPOTS.babyfoot[1], activity: "babyfoot", dwell: 11000, onDone: () => b.person.say(rand(["GAAAMELLE !", "Revanche demain.", "Tu triches !!"]), 2500) });
    this.log("⚽", `Partie de baby-foot : ${this.name(a.agentId)} contre ${this.name(b.agentId)}.`, a.agentId);
    this.film(-21, 4.5);
    return true;
  }

  ev_vending() {
    const actor = rand(this.available());
    if (!actor) return false;
    actor.trip.push({ spot: SPOTS.vending, activity: "kick", dwell: 4000, onArrive: () => actor.person.say("Mon paquet de chips est COINCÉ 😩", 2800) });
    return true;
  }

  // ------------------------------------------------------------------ évènements déclenchés par le patron

  party(heroId = null) {
    const all = this.available({ exclude: [] });
    if (all.length < 3) return false;
    const hero = (typeof heroId === "string" && this.world.actors.get(heroId)) || rand(all);
    if (!all.includes(hero)) all.unshift(hero);
    const heroName = this.name(hero.agentId);
    this.world.showCake(true);
    const spots = [...MEETING_STANDING, ...MEETING_SEATS];
    all.slice(0, spots.length).forEach((a, i) => {
      this.hold(a, 30000);
      a.trip.push({
        spot: { ...spots[i], standing: true },
        activity: "clap",
        dwell: 16000 + Math.random() * 3000,
        onArrive: () => i < 4 && a.person.say(a === hero ? "Oh vous êtes fous 🥹" : rand([`Joyeux anniversaire ${heroName} ! 🎂`, "🎉🎉🎉", "Il reste du gâteau ?"]), 3000),
      });
    });
    this.later(24000, () => this.world.showCake(false));
    this.log("🎂", `Pot surprise en salle de conf' pour l'anniversaire de ${heroName} !`, hero.agentId);
    this.film(-11.5, -13);
    this.interview(this.pick(all, "party").agentId, "party", 12000);
    return true;
  }

  fireDrill() {
    const chief = this.world.actors.get("deputy") || this.world.actors.get("director");
    chief?.person.say("🚨 EXERCICE INCENDIE !!! TOUT LE MONDE DEHORS !!!", 4000);
    const everyone = [...this.world.actors.values()].filter((a) => !a.meetingSeat);
    everyone.forEach((a, i) => {
      a.trip.length = 0;
      this.hold(a, 30000);
      a.person.speed = a.person.baseSpeed * 1.9;
      a.trip.push({
        spot: GATHER[i % GATHER.length],
        activity: "idle",
        dwell: 12000,
        onArrive: () => i % 5 === 1 && a.person.say(rand(["C'est encore Bertrand ?", "J'avais pas sauvegardé !!", "Il fait froid…"]), 2500),
        onDone: () => (a.person.speed = a.person.baseSpeed),
      });
    });
    this.log("🚨", "Exercice incendie surprise ! Tout le monde a évacué le plateau.", chief?.agentId);
    this.film(0, 12);
    if (chief) this.interview(chief.agentId, "fire", 14000);
    return true;
  }

  teamLunch() {
    const crowd = this.available().slice(0, 8);
    if (!crowd.length) return false;
    const food = rand(FOODS);
    crowd.forEach((a) => this.hold(a, 60000));
    this.world.actors.get("director")?.person.say(`🛵 C'est moi qui régale : ${food} pour tout le monde !`, 3500);
    this.log("🛵", `Le patron offre ${food} à l'équipe (${crowd.length} commandes Uber Eats).`, "director");
    this.later(9000, () => this.deliver(crowd, food));
    return true;
  }

  dundies() {
    const champion = this.world.state.life?.hall?.[0]?.agentId;
    if (champion && this.world.actors.has(champion)) return this.ceremony(champion);
    const agents = this.world.state.agents;
    const best = [...agents].sort((a, b) => (b.stats?.done || 0) - (a.stats?.done || 0))[0];
    if (!best) return false;
    const winner = this.world.actors.get(best.id);
    this.world.giveTrophy(best.id);
    winner?.person.say("🏆 Je… je voudrais remercier ma mère…", 4000);
    this.available().slice(0, 10).forEach((a, i) => this.later(i * 150, () => {
      a.trip.push({ spot: { ...a.home, standing: true }, activity: "clap", dwell: 4000 });
    }));
    this.log("🏆", `${best.name} est élu·e employé·e du mois (${best.stats?.done || 0} missions livrées) !`, best.id);
    this.interview(best.id, "work", 5000);
    return true;
  }

  // ------------------------------------------------------------------ v3 : relations & running gags

  relations(kinds) {
    return Object.values(this.world.state?.life?.relations || {}).filter((r) => kinds.includes(r.kind));
  }

  pair(kinds) {
    const free = new Set(this.available().map((a) => a.agentId));
    const rels = this.relations(kinds).filter((r) => free.has(r.a) && free.has(r.b));
    const rel = rels.length ? rand(rels) : null;
    if (!rel) return null;
    return { rel, a: this.world.actors.get(rel.from && rel.from === rel.b ? rel.b : rel.a), b: this.world.actors.get(rel.from && rel.from === rel.b ? rel.a : rel.b) };
  }

  ev_couple(forced = null) {
    const p = forced || this.pair(["couple"]);
    if (!p?.a || !p?.b) return false;
    const [l1, l2] = rand(COUPLE_LINES);
    const spots = rand([[SPOTS.coffee[0], SPOTS.coffee[1]], [SPOTS.lounge.sofa[0], SPOTS.lounge.sofa[1]], [SPOTS.coffee[2], SPOTS.coffee[3]]]);
    this.hold(p.a, 30000);
    this.hold(p.b, 30000);
    p.a.trip.push({ spot: { ...spots[0], facing: spots[0].facing }, activity: spots[0].standing ? "talk" : "relax", dwell: 14000, onArrive: () => this.later(500, () => p.a.person.say(l1, 3000)) });
    p.b.trip.push({ spot: spots[1], activity: spots[1].standing ? "hug" : "relax", dwell: 14000, onArrive: () => this.later(3600, () => p.b.person.say(l2, 3000)) });
    const witness = this.available().find((x) => x !== p.a && x !== p.b);
    if (witness && chance(0.5)) this.later(9000, () => witness.person.say(rand(["Ils sont trop mignons 🥹", "Bon, on travaille ici 🙄", "Trouvez-vous une salle de réunion…"]), 2600, 0));
    this.log("❤️", `${this.name(p.a.agentId)} et ${this.name(p.b.agentId)} prennent leur pause ensemble (encore).`, p.a.agentId);
    if (chance(0.5)) this.interview(rand([p.a, p.b]).agentId, "love", 16000);
    return true;
  }

  ev_crush(forced = null) {
    const p = forced || this.pair(["crush"]);
    if (!p?.a || !p?.b || !p.b.home || p.b.home.standing) return false;
    this.hold(p.a, 20000);
    const fx = Math.sin(p.b.home.facing);
    const fz = Math.cos(p.b.home.facing);
    const spot = { x: p.b.home.x + fz * 0.8, z: p.b.home.z - fx * 0.8, standing: true, facing: Math.atan2(-fz, fx) };
    p.a.trip.push({
      spot,
      activity: "talk",
      dwell: 6000,
      onArrive: () => {
        p.a.person.say(rand(CRUSH_LINES), 3200);
        this.later(3400, () => p.b.person.say(rand(["Bien sûr ! 😊", "Oh, merci, c'est gentil !", "…Ça va, toi ?"]), 2600));
      },
    });
    this.log("😳", `${this.name(p.a.agentId)} a trouvé une excuse pour passer au bureau de ${this.name(p.b.agentId)}.`, p.a.agentId);
    this.film(p.b.home.x, p.b.home.z);
    this.interview(p.a.agentId, "crush", 9000);
    return true;
  }

  ev_bff() {
    const p = this.pair(["bff", "ami"]);
    if (!p?.a || !p?.b) return false;
    if (chance(0.5)) {
      p.a.trip.push({ spot: SPOTS.babyfoot[0], activity: "babyfoot", dwell: 11000, onArrive: () => p.a.person.say("Revanche ! 😤", 2200, 0) });
      p.b.trip.push({ spot: SPOTS.babyfoot[1], activity: "babyfoot", dwell: 11000, onDone: () => p.b.person.say("GAMELLE ! 🙌", 2200, 0) });
      this.log("⚽", `Baby-foot entre potes : ${this.name(p.a.agentId)} contre ${this.name(p.b.agentId)}.`, p.a.agentId);
    } else {
      p.a.trip.push({ spot: SPOTS.lounge.sofa[3], activity: "game", dwell: 15000, onArrive: () => p.a.person.say("Une petite partie ? 🎮", 2400, 0) });
      p.b.trip.push({ spot: SPOTS.lounge.sofa[4], activity: "game", dwell: 15000, onDone: () => p.b.person.say(rand(["GG !", "Tu triches !!", "Encore une !"]), 2400, 0) });
      this.log("🎮", `${this.name(p.a.agentId)} et ${this.name(p.b.agentId)} jouent à la console en salle de repos.`, p.a.agentId);
    }
    return true;
  }

  ev_rivals() {
    const p = this.pair(["rival", "ex"]);
    if (!p?.a || !p?.b) return false;
    const [l1, l2] = rand(RIVAL_LINES);
    this.hold(p.a, 20000);
    this.hold(p.b, 20000);
    p.a.trip.push({ spot: SPOTS.copier, activity: "talk", dwell: 8000, onArrive: () => this.later(400, () => p.a.person.say(l1, 3000)) });
    p.b.trip.push({ spot: { x: SPOTS.copier.x - 0.9, z: SPOTS.copier.z + 0.6, facing: 2.2, standing: true }, activity: "talk", dwell: 8000, onArrive: () => this.later(3500, () => p.b.person.say(l2, 3000)) });
    this.log("⚡", `${this.name(p.a.agentId)} et ${this.name(p.b.agentId)} se disputent la photocopieuse.`, p.a.agentId);
    this.film(SPOTS.copier.x, SPOTS.copier.z);
    return true;
  }

  ev_victorHR() {
    const victor = this.world.actors.get("director");
    const hr = [...this.world.actors.values()].find((a) => this.agent(a.agentId)?.role === "hr");
    if (!victor || !hr || victor.trip.length || victor.meetingSeat) return false;
    this.hold(victor, 25000);
    victor.trip.push({
      spot: SPOTS.hrVisit,
      activity: "talk",
      dwell: 7000,
      onArrive: () => {
        victor.person.say(rand([`${this.name(hr.agentId)}. Pourquoi tu es comme ça ?`, "Je passais juste vérifier que tu étais toujours là. Dommage.", "Si un jour tu démissionnes, je serai le premier à fêter ça. Professionnellement."]), 3500);
        this.later(3800, () => hr.person.say("…Bonjour Victor.", 2500));
      },
    });
    this.log("👔", `${this.name("director")} est passé au bureau RH pour embêter ${this.name(hr.agentId)}.`, "director");
    this.film(SPOTS.hrVisit.x, SPOTS.hrVisit.z);
    this.interview(hr.agentId, "hr", 12000);
    return true;
  }

  ev_suggestion() {
    const actor = rand(this.available());
    if (!actor) return false;
    const victor = actor.agentId === "director";
    actor.trip.push({ spot: SPOTS.suggestionBox, activity: "drop", dwell: 2500, onArrive: () => actor.person.say(victor ? "Suggestion : virer Gérard. Encore. 📝" : rand(["Suggestion : plus de chats 🐈", "Suggestion : un 2e micro-ondes", "Suggestion : interdire le poisson au micro-ondes"]), 3000, 0) });
    return true;
  }

  ev_internCoffee(force = false) {
    const interns = this.available().filter((a) => this.agent(a.agentId)?.role === "intern");
    const intern = rand(interns);
    if (!intern) return false;
    const clients = this.available().filter((a) => a !== intern && a.home && !a.home.standing).slice(0, 3);
    this.hold(intern, 60000);
    intern.trip.push({ spot: rand(SPOTS.coffee), activity: "coffee", dwell: 4000, onArrive: () => intern.person.say(force ? "Tournée de cafés pour tout le monde ! ☕" : "Je fais une tournée de cafés ☕", 2500) });
    clients.forEach((c) => {
      const fx = Math.sin(c.home.facing);
      const fz = Math.cos(c.home.facing);
      intern.trip.push({
        spot: { x: c.home.x + fz * 0.75, z: c.home.z - fx * 0.75, standing: true, facing: Math.atan2(-fz, fx) },
        activity: "drop",
        dwell: 1800,
        onArrive: () => this.later(600, () => c.person.say(rand(["Merci ! …j'avais demandé un latte 😐", "Il est froid.", "Oh, c'est gentil 🥹", "C'est du décaf ?!"]), 2400, 0)),
      });
    });
    this.log("☕", `${this.name(intern.agentId)}, stagiaire, fait la tournée des cafés (personne n'a la bonne commande).`, intern.agentId);
    if (chance(0.5)) this.interview(intern.agentId, "intern", 20000);
    return true;
  }

  ev_internLost() {
    const intern = rand(this.available().filter((a) => this.agent(a.agentId)?.role === "intern"));
    if (!intern) return false;
    const spot = rand([SPOTS.gym.weights, SPOTS.libraryDrop, SPOTS.lounge.tv, SPOTS.hrVisit, SPOTS.directorVisit]);
    intern.trip.push({ spot, activity: "phone", dwell: 5000, onArrive: () => intern.person.say(rand(["C'est où la salle de conf' ? 🙃", "Je crois que je suis perdu…", "Quelqu'un a vu mon tuteur ?"]), 2800, 0) });
    return true;
  }

  ev_chili(force = false) {
    const bruno = [...this.world.actors.values()].find((a) => this.agent(a.agentId)?.role === "accountant");
    if (!bruno || (!force && (bruno.trip.length || bruno.meetingSeat))) return false;
    bruno.trip.length = 0;
    this.hold(bruno, 40000);
    bruno.trip.push(
      { spot: SPOTS.microwave, activity: "idle", dwell: 4000, onArrive: () => bruno.person.say("Mon chili maison 🌶️ (recette secrète)", 2600) },
      {
        spot: { x: -16.6, z: 7.6, facing: 0.4, standing: true },
        activity: "shock",
        dwell: 6000,
        onArrive: () => {
          bruno.person.say("NOOON ! MON CHILI !!! 😭", 3500, 2);
          this.world.spillChili(-16.4, 8.2);
          this.world.lastIncidentAt = Date.now();
          const near = this.available().filter((a) => a !== bruno).slice(0, 2);
          near.forEach((n, i) => this.later(1500 + i * 1200, () => n.person.say(rand(["Encore ?!", "Le compteur repart à zéro…", "Ça sent bon pourtant"]), 2400, 0)));
        },
      },
      { spot: SPOTS.closet, activity: "idle", dwell: 1500, onArrive: () => bruno.person.say("Je vais chercher la serpillière…", 2200, 0) },
    );
    this.log("🌶️", `${this.name(bruno.agentId)} a renversé son chili sur la moquette. Le panneau « jours sans incident » repart à zéro.`, bruno.agentId);
    this.film(-16.4, 8.2);
    this.interview(bruno.agentId, "food", 14000);
    this.later(20000, () => this.ev_clean(true));
    return true;
  }

  ev_karate(force = false) {
    const sensei = this.world.actors.get("deputy") || this.pick(this.available(), "zealous");
    if (!sensei || (!force && (sensei.trip.length || sensei.meetingSeat))) return false;
    this.hold(sensei, 30000);
    sensei.trip.push({ spot: SPOTS.gym.dojo, activity: "karate", dwell: 14000, onArrive: () => sensei.person.say("HI-YAH ! 🥋", 2200) });
    const watcher = this.available().find((a) => a !== sensei);
    if (watcher) this.later(5000, () => watcher.trip.push({ spot: { x: SPOTS.gym.dojo.x - 1.7, z: SPOTS.gym.dojo.z + 0.8, facing: 1.2, standing: true }, activity: "idle", dwell: 6000, onArrive: () => watcher.person.say("…Il fait ça tous les midis ?", 2500, 0) }));
    this.log("🥋", `${this.name(sensei.agentId)} s'entraîne au karaté dans la salle de sport. Personne ne lui a demandé.`, sensei.agentId);
    this.film(SPOTS.gym.dojo.x, SPOTS.gym.dojo.z);
    this.interview(sensei.agentId, "karate", 9000);
    return true;
  }

  ev_gym(actor = null) {
    actor ||= this.pick(this.available(), chance(0.5) ? "calm" : "party");
    if (!actor) return false;
    const traits = this.agent(actor.agentId)?.traits || [];
    const [spot, activity] = traits.includes("calm") ? [rand(SPOTS.gym.yoga), "yoga"] : rand([[rand(SPOTS.gym.treadmill), "run"], [SPOTS.gym.bag, "punch"], [SPOTS.gym.weights, "lift"]]);
    actor.trip.push({ spot, activity, dwell: 14000, onArrive: () => actor.person.say(rand(GYM_LINES), 2400, 0) });
    if (chance(0.2)) this.interview(actor.agentId, "gym", 9000);
    return true;
  }

  gymClass() {
    const crowd = this.available().slice(0, 3);
    if (!crowd.length) return false;
    const coach = crowd[0];
    coach.person.say("Cours de yoga dans 1 minute ! 🧘", 2600);
    crowd.forEach((a, i) => {
      this.hold(a, 30000);
      a.trip.push({ spot: SPOTS.gym.yoga[i % 3], activity: "yoga", dwell: 18000 });
    });
    this.log("🧘", `Cours de yoga improvisé à la salle de sport (${crowd.length} participants).`, coach.agentId);
    this.film(31.4, 14.6);
    return true;
  }

  ev_gaming() {
    const pool = this.available();
    const a = this.pick(pool, "nerd");
    const b = a && this.pick(pool.filter((x) => x !== a), "nerd");
    if (!a || !b) return false;
    a.trip.push({ spot: SPOTS.lounge.sofa[3], activity: "game", dwell: 16000, onArrive: () => a.person.say("Juste une partie, promis 🎮", 2400, 0) });
    b.trip.push({ spot: SPOTS.lounge.sofa[4], activity: "game", dwell: 16000, onDone: () => b.person.say(rand(["GG !", "Lag !! C'est le wifi !", "Revanche à midi."]), 2400, 0) });
    this.log("🎮", `${this.name(a.agentId)} et ${this.name(b.agentId)} « testent la console » de la salle de repos.`, a.agentId);
    return true;
  }

  ev_lounge() {
    const actor = this.pick(this.available(), "lazy");
    if (!actor) return false;
    const spot = rand([...SPOTS.lounge.sofa.slice(0, 3), ...SPOTS.lounge.beanbag]);
    actor.trip.push({ spot, activity: "relax", dwell: 15000, onArrive: () => actor.person.say(rand(["Pause bien méritée 😌", "Je réfléchis. Les yeux fermés.", "Cinq minutes. Promis."]), 2400, 0) });
    return true;
  }

  ev_petCat() {
    const actor = this.pick(this.available(), "catlover");
    if (!actor || !this.world.cats) return false;
    const cat = this.world.cats.petBy(actor);
    if (!cat) return false;
    if (this.has(actor, "catlover") && chance(0.4)) this.interview(actor.agentId, "cat", 8000);
    return true;
  }

  catTime() {
    const crowd = this.available().slice(0, 4);
    if (!crowd.length || !this.world.cats) return false;
    let n = 0;
    for (const a of crowd) if (this.world.cats.petBy(a)) n += 1;
    if (!n) return false;
    this.log("🐈", `Pause câlins générale en salle de repos (${n} collègues, 0 productivité).`);
    this.film(35.5, -1.5);
    return true;
  }

  ev_feedCats() {
    const feeder = [...this.world.actors.values()].find((a) => this.agent(a.agentId)?.role === "happiness" && !a.trip.length && !a.meetingSeat);
    if (!feeder || !this.world.cats) return false;
    feeder.trip.push({
      spot: SPOTS.lounge.bowls,
      activity: "drop",
      dwell: 3500,
      onArrive: () => {
        feeder.person.say("À table les chats ! 🐟", 2600);
        let i = 0;
        for (const cat of this.world.cats.cats.values()) {
          if (this.world.cats.isHidden(cat.id)) continue;
          this.world.cats.go(cat, { x: 37.6 + (i % 3) * 0.45, z: 3.0, facing: 0 }, { pose: "sit", speed: 2.2, dwell: 9000 });
          i += 1;
        }
      },
    });
    this.log("🐟", `${this.name(feeder.agentId)} nourrit les chats. Ils font semblant de ne pas avoir mangé depuis trois jours.`, feeder.agentId);
    return true;
  }

  ev_campaign() {
    const round = this.world.state?.life?.round;
    if (!round || round.winnerId) return false;
    const nominee = this.world.actors.get(rand(round.nominees));
    if (!nominee || nominee.trip.length || nominee.meetingSeat) return false;
    nominee.trip.push({ spot: SPOTS.eotm, activity: "talk", dwell: 6000, onArrive: () => nominee.person.say(rand(["Je mérite ce titre, non ? 🏆", "Employé du mois… ça sonne bien avec mon prénom.", "J'ai déjà préparé mon discours."]), 3000) });
    return true;
  }

  // Réactions visuelles aux potins du moteur (relations, anniversaires, incidents…).
  onStory(story) {
    const [a, b] = (story.ids || []).map((id) => this.world.actors.get(id));
    switch (story.kind) {
      case "birthday":
        this.later(3000, () => this.party(story.ids[0]));
        break;
      case "couple":
      case "reconcile":
        if (a && b) this.ev_couple({ a, b });
        break;
      case "crush":
        a?.person.say("😳", 2500, 0);
        break;
      case "breakup":
        a?.person.say("…", 2500, 0);
        b?.person.say("Ça va. Tout va bien. 🙂", 2600, 0);
        break;
      case "rival":
      case "dispute":
        a?.person.say("Hmpf. 😤", 2400, 0);
        b?.person.say("Pfff…", 2400, 0);
        break;
      case "peace":
        if (a && b) {
          a.person.say("Paix ? 🤝", 2400);
          b.person.say("Paix. 🕊️", 2400);
        }
        break;
      case "incident":
        if (story.gag === "chili") this.ev_chili(true);
        else if (story.gag === "printer") this.ev_printer();
        else this.world.lastIncidentAt = Date.now();
        break;
      case "intern":
        a?.person.say("Oups… 😅", 2400, 0);
        break;
      case "victor":
        this.ev_victorHR();
        break;
      case "round":
        (story.ids || []).forEach((id, i) => this.later(1000 + i * 1500, () => this.world.actors.get(id)?.person.say(rand(["Je suis nominé·e ?! 😱", "Enfin la reconnaissance !", "Qui a voté pour moi ?"]), 3000)));
        break;
      case "quest":
        a?.person.say("⭐ Merci patron !", 2600, 2);
        break;
      case "cdi":
        if (a) a.trip.push({ spot: { ...a.home, standing: true }, activity: "dance", dwell: 7000, onArrive: () => a.person.say("CDI !!! 🎉", 3000, 2) });
        break;
      default:
    }
  }

  // Cérémonie de l'employé du mois devant le totem de l'entrée.
  ceremony(winnerId) {
    const winner = this.world.actors.get(winnerId);
    if (!winner) return false;
    const stage = { x: SPOTS.eotm.x, z: SPOTS.eotm.z - 0.2, facing: 0, standing: true };
    const hurry = (a) => {
      a.person.speed = a.person.baseSpeed * 1.8;
    };
    const calm = (a) => {
      a.person.speed = a.person.baseSpeed;
    };
    winner.trip.length = 0;
    this.hold(winner, 45000);
    hurry(winner);
    winner.trip.push({
      spot: stage,
      activity: "wave",
      dwell: 16000,
      onArrive: () => {
        calm(winner);
        this.world.confetti(stage.x, stage.z + 1);
        this.later(1200, () => winner.person.say(rand(QUOTES.eotm), 5500, 2));
      },
    });
    const crowd = this.available({ exclude: [winnerId] }).slice(0, 14);
    crowd.forEach((a, i) => {
      this.hold(a, 40000);
      hurry(a);
      const row = Math.floor(i / 7);
      const col = (i % 7) - 3;
      a.trip.push({
        spot: { x: stage.x + col * 0.85, z: stage.z + 1.2 + row * 0.85, facing: Math.PI, standing: true },
        activity: "clap",
        dwell: 16000,
        onArrive: () => {
          calm(a);
          if (i < 3) a.person.say(rand(["Bravo !! 👏", "Discours ! Discours !", "C'était truqué (non)"]), 2600, 0);
        },
      });
    });
    this.world.giveTrophy(winnerId);
    this.log("🏆", `Cérémonie : ${this.name(winnerId)} reçoit le trophée d'employé du mois devant toute l'équipe !`, winnerId);
    this.film(stage.x, stage.z + 1.5);
    this.interview(winnerId, "eotm", 14000);
    return true;
  }

  dispose() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
