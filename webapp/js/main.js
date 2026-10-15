// Point d'entrée de la mini app « QG des agents IA ».

import { createBackend } from "./backend.js";
import { Panels } from "./ui/panels.js";
import { h, tg, toast, haptic, openModal, closeTopModal, hasModal } from "./ui/dom.js";
import { missionForm, openDocument, avatar } from "./ui/components.js";
import { PANELS, roleOf } from "../shared/roster.js";
import { computeKpis, liveMeeting } from "../shared/engine.js";
import { HIDING_SPOTS } from "../shared/social.js";
import { createElevator } from "./ui/elevator.js";
import { openMadhouseAt } from "./ui/madhouse.js";

// Le code est chargé : l'écran de chargement de index.html cesse de surveiller.
window.__qgStarted = true;

const DOCK = ["overview", ...Object.keys(PANELS)];
const ONBOARDED_KEY = "qg-onboarded-v3";

const STORY_LABELS = {
  couple: "Potin ❤️", crush: "Rumeur", breakup: "Potin", dispute: "Potin", reconcile: "Potin", ami: "Potin", bff: "Potin", rival: "Clash", peace: "Potin",
  incident: "Flash info", intern: "Stagiaires", cat: "Les chats", victor: "Direction", birthday: "Anniversaire", round: "Employé du mois", quest: "Employé du mois",
  ceremony: "Employé du mois", cdi: "RH", hire: "RH", leave: "RH",
};

// Bandeau d'actualités façon chaîne d'info : un message à la fois, propre et lisible.
function createTicker(onOpen) {
  const el = document.getElementById("ticker");
  const queue = [];
  let busy = false;
  let lastMinor = 0;
  const next = () => {
    if (busy || !queue.length) return;
    const item = queue.shift();
    busy = true;
    el.replaceChildren(
      h("span", { class: "tk-icon" }, item.icon || "🗞️"),
      h("div", { class: "grow" }, h("div", { class: "tk-label" }, item.label || "Vie de bureau"), h("div", { class: "tk-text" }, item.text)));
    el.classList.add("show");
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => {
        busy = false;
        next();
      }, 450);
    }, item.ms || 6500);
  };
  el.addEventListener("click", () => onOpen?.());
  return {
    push(item, { minor = false } = {}) {
      if (minor) {
        if (queue.length || busy || performance.now() - lastMinor < 25000) return;
        lastMinor = performance.now();
      }
      queue.push(item);
      if (queue.length > 4) queue.shift();
      next();
    },
  };
}

// Potins et interviews de la session (vie de bureau, non enregistrés).
function createLifeStore() {
  const listeners = new Set();
  const store = {
    entries: [],
    interviews: [],
    push(entry) {
      store.entries.push(entry);
      if (store.entries.length > 80) store.entries.shift();
      listeners.forEach((fn) => fn());
    },
    interview(item) {
      store.interviews.push(item);
      if (store.interviews.length > 20) store.interviews.shift();
      listeners.forEach((fn) => fn());
    },
    subscribe(fn) {
      listeners.add(fn);
    },
  };
  return store;
}

// Carton "interview" façon documentaire, en bas de l'écran.
function showInterview({ agent, quote }) {
  const root = document.getElementById("interview");
  root.replaceChildren(
    h("div", { class: "interview-card" },
      h("div", { class: "interview-rec" }, "● REC"),
      avatar(agent, "lg"),
      h("div", { class: "grow" },
        h("div", { class: "interview-quote" }, `« ${quote} »`),
        h("div", { class: "interview-lower" }, h("strong", {}, agent.name), h("span", {}, roleOf(agent).label))))
  );
  root.classList.add("show");
  clearTimeout(showInterview.timer);
  showInterview.timer = setTimeout(() => root.classList.remove("show"), 7000);
  root.onclick = () => root.classList.remove("show");
}

function setupTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    if (tg.isVersionAtLeast?.("6.1")) {
      tg.setHeaderColor("#0e1120");
      tg.setBackgroundColor("#0e1120");
    }
    if (tg.isVersionAtLeast?.("7.7")) tg.disableVerticalSwipes();
  } catch (err) {
    console.warn("Telegram WebApp :", err);
  }
}

function splash(text, error = false) {
  const el = document.getElementById("splash");
  document.getElementById("splash-text").textContent = text;
  if (error) {
    el.querySelector(".splash-bar").hidden = true;
    el.querySelector(".splash-card").append(h("button", { class: "btn primary", onClick: () => location.reload() }, "Réessayer"));
  }
}

function hideSplash() {
  const el = document.getElementById("splash");
  el.classList.add("hide");
  setTimeout(() => el.remove(), 600);
}

async function boot() {
  setupTelegram();
  let backend;
  try {
    backend = await createBackend();
  } catch (err) {
    splash(err.message || "Impossible de joindre le QG.", true);
    return;
  }

  // ---- Scène 3D (facultative : l'interface reste utilisable sans WebGL)
  let world = null;
  let elevator = null;
  const life = createLifeStore();
  const ticker = createTicker(() => panels.openPanel("rh"));
  const panels = new Panels({
    backend,
    life,
    getWorld: () => world,
    onOpen: (panel) => {
      // Le panneau Bâtiment accompagne la visite des étages ; tout autre panneau ramène au QG.
      const madhouse = panel.kind === "panel" && panel.id === "madhouse";
      if (world?.inFloor && !madhouse) elevator?.leave();
      elevator?.onSheet(true);
      if (!world?.inFloor) {
        if (panel.kind === "panel") world?.focusPanel(panel.id, true);
        else world?.focusAgent(panel.id, true);
      }
      renderDock();
      syncBackButton();
    },
    onClose: () => {
      world?.clearSelection();
      elevator?.onSheet(false);
      renderDock();
      syncBackButton();
    },
  });
  try {
    const { World } = await import("./scene/world.js");
    world = new World(document.getElementById("stage"), {
      now: () => backend.now(),
      onSelectPanel: (id) => panels.openPanel(id),
      onSelectAgent: (id) => panels.openAgent(id),
      onLife: (entry) => {
        life.push(entry);
        ticker.push({ icon: entry.icon, label: "Vie de bureau", text: entry.text }, { minor: true });
      },
      onCat: async (catId) => {
        const state = backend.state;
        const quest = (state.life?.round?.quests || []).find((q) => q.kind === "seek" && q.status === "open" && q.item?.catId === catId);
        if (quest) return solveSeek(quest.id, quest.spotId);
        const cat = world?.cats?.cats.get(catId);
        cat?.mesh.say(["💕 rrrrr", "Miaou 😺", "😼 (te juge)", "💕"][Math.floor(Math.random() * 4)], 2500);
        haptic("light");
        try {
          await backend.action("cat.pet", { catId });
        } catch {
          // câlin non compté, pas grave
        }
      },
      onQuestFound: (questId, spotId) => solveSeek(questId, spotId),
      // Étages du Bâtiment 0 : une pièce ou un habitant touché ouvre sa fiche.
      onFloorRoom: (roomId) => {
        haptic("light");
        openMadhouseAt(panels, { view: "room", id: roomId });
        world?.focusFloorRoom(roomId, true);
      },
      onFloorPerson: (personId) => {
        haptic("light");
        openMadhouseAt(panels, { view: "person", id: personId });
        world?.focusFloorPerson(personId, true);
      },
      onInterview: (item) => {
        life.interview(item);
        if (!document.body.classList.contains("sheet-open") || window.innerWidth >= 900) showInterview(item);
      },
    });
    try {
      world.documentary = localStorage.getItem("qg-documentary") !== "0";
    } catch {
      // préférence par défaut
    }
    world.init();
    if (location.hostname === "localhost") {
      // diagnostic en développement local
      window.__qgWorld = world;
      window.__qgBackend = backend;
    }
    if (tg?.onEvent) tg.onEvent("viewportChanged", () => world.resize());
  } catch (err) {
    console.error(err);
    world = null;
    toast("La 3D n'est pas disponible sur cet appareil : le QG fonctionne en mode tableau de bord.", "error", 6000);
  }

  async function solveSeek(questId, spotId) {
    try {
      const result = await backend.action("quest.solve", { questId, answer: spotId });
      haptic("success");
      const spot = HIDING_SPOTS.find((s) => s.id === spotId);
      if (spot) world?.confetti(spot.x, spot.z);
      toast(`🏆 ${result?.message || "Trouvé !"}`, "quest", 6000);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // ---- Ascenseur B : visite des autres étages en 3D
  if (world) {
    document.body.classList.add("has-3d");
    elevator = createElevator({
      backend,
      getWorld: () => world,
      onOpenRoute: (route) => openMadhouseAt(panels, route),
    });
  }

  // ---- HUD
  const hudTitle = document.getElementById("hud-title");
  const chipQuests = document.getElementById("chip-quests");
  chipQuests.addEventListener("click", () => panels.openPanel("quests"));
  const hudMode = document.getElementById("hud-mode");
  const clock = document.getElementById("hud-clock");
  const chipWorking = document.getElementById("chip-working");
  const chipReview = document.getElementById("chip-review");
  chipWorking.addEventListener("click", () => panels.openPanel("openspace"));
  chipReview.addEventListener("click", () => panels.openPanel("director"));
  if (backend.mode === "demo") {
    hudMode.textContent = "Mode démo";
    hudMode.className = "badge demo";
  } else if (backend.ai?.enabled) {
    hudMode.textContent = "IA active";
    hudMode.className = "badge ai";
  } else {
    hudMode.textContent = "Connecté";
    hudMode.className = "badge";
  }
  hudMode.addEventListener("click", () => panels.openPanel("kitchen"));
  life.subscribe(() => {
    if (panels.current?.id === "kitchen") panels.refresh();
  });
  const tickClock = () => {
    clock.textContent = new Date(backend.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };
  tickClock();
  setInterval(tickClock, 10000);

  // ---- Dock
  const dock = document.getElementById("dock");
  let dockActive = null;
  function renderDock() {
    const state = backend.state;
    const k = computeKpis(state, backend.now());
    const live = liveMeeting(state);
    const deals = (state.deals || []).filter((d) => !d.dismissed && backend.now() - d.foundAt < 86400000).length;
    const round = state.life?.round;
    const openQuests = round && !round.winnerId ? round.quests.filter((q) => q.status === "open").length : 0;
    const badges = { director: k.review, meeting: live ? "●" : 0, sourcing: deals, annexe: (state.trash || []).length ? "🗑️" : 0, quests: openQuests, madhouse: state.madhouse?.decisions || (state.madhouse?.unread ? "●" : 0) };
    dock.replaceChildren(...DOCK.map((id) => {
      const room = id === "overview" ? { icon: "🗺️", short: "Vue", color: "#7c6cff" } : PANELS[id];
      const active = id === "overview" ? !panels.isOpen : panels.current?.kind === "panel" && panels.current.id === id;
      return h("button", {
        class: `dock-btn${active ? " active" : ""}`,
        style: { "--room": room.color },
        onClick: () => {
          haptic("light");
          if (id === "overview") {
            panels.close();
            world?.overview();
          } else {
            panels.openPanel(id);
          }
        },
      }, h("span", { class: "emo" }, room.icon), room.short, badges[id] ? h("span", { class: "count" }, badges[id]) : null);
    }));
    // Sur mobile le dock défile : on ramène la pièce ouverte dans le champ quand elle change.
    const activeBtn = dock.querySelector(".dock-btn.active");
    const activeKey = panels.current?.key || "overview";
    if (activeBtn && activeKey !== dockActive) activeBtn.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    dockActive = activeKey;
  }

  // ---- Nouvelle mission rapide
  document.getElementById("fab").addEventListener("click", () => {
    haptic("medium");
    const modal = openModal({
      title: "＋ Nouvelle mission",
      body: missionForm(panels.ctx, {
        showAgentSelect: true,
        placeholder: "Ex : Crée une landing page pour mon coaching",
        presets: ["Crée un site vitrine", "Rédige un post LinkedIn", "Planifie un rdv demain 10h", "Fais l'inventaire des documents"],
        onDone: () => modal.close(),
      }),
    });
  });

  // ---- Bouton retour Telegram
  function syncBackButton() {
    if (!tg?.BackButton || !tg.isVersionAtLeast?.("6.1")) return;
    if (panels.isOpen || hasModal() || elevator?.inFloor) tg.BackButton.show();
    else tg.BackButton.hide();
  }
  if (tg?.BackButton && tg.isVersionAtLeast?.("6.1")) {
    tg.BackButton.onClick(() => {
      if (closeTopModal()) return syncBackButton();
      if (panels.isOpen) panels.close();
      else if (elevator?.inFloor) elevator.goTo("f11");
      syncBackButton();
    });
  }
  window.addEventListener("qg:overlay", syncBackButton);
  window.addEventListener("qg:auth-error", (e) => toast(`🔒 ${e.detail}`, "error", 8000));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !closeTopModal()) panels.close();
  });

  // ---- Notifications dans l'app (différences entre deux états)
  function notifyChanges(prev, state) {
    const before = new Map(prev.tasks.map((t) => [t.id, t]));
    const name = (id) => state.agents.find((a) => a.id === id)?.name || "Un agent";
    for (const t of state.tasks) {
      const old = before.get(t.id);
      if (!old || old.status === t.status) continue;
      if (t.status === "review") {
        toast(`📁 « ${t.title} » attend ta validation`, "info", 5000);
        haptic("warning");
      } else if (t.status === "done" && old.status === "working") {
        toast(`✅ ${name(t.agentId)} a livré « ${t.title} »`, "success");
      }
    }
    for (const e of state.events) {
      const old = prev.events.find((p) => p.id === e.id);
      if (old && !(old.remindedAt > 0) && e.remindedAt > 0) {
        toast(`⏰ Rappel : « ${e.title} » à ${new Date(e.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, "info", 6000);
        haptic("warning");
      }
    }
    const wasLive = liveMeeting(prev);
    const live = liveMeeting(state);
    if (live && !wasLive && live.eventId) toast(`🗣️ La réunion « ${live.title} » commence`, "info", 5000);
    for (const m of state.meetings) {
      const old = prev.meetings.find((p) => p.id === m.id);
      if (old?.status === "summarizing" && m.status === "ended") toast(`📝 Compte rendu de « ${m.title} » prêt`, "success");
    }
    if (state.director?.lastBriefDocId && state.director.lastBriefDocId !== prev.director?.lastBriefDocId) {
      toast("🧭 Le brief de direction est prêt", "success");
      openDocument(panels.ctx, state.director.lastBriefDocId);
    }
    const newDeals = (state.deals || []).filter((d) => !(prev.deals || []).some((p) => p.id === d.id));
    if (newDeals.length) toast(newDeals.length === 1 ? `🔎 Bon plan déniché : ${newDeals[0].title}` : `🔎 ${newDeals.length} nouveaux bons plans dénichés`, "success", 5000);
    const seenStories = new Set((prev.life?.stories || []).map((st) => st.id));
    for (const st of state.life?.stories || []) {
      if (seenStories.has(st.id)) continue;
      ticker.push({ icon: st.icon, label: STORY_LABELS[st.kind] || "Potin", text: st.text });
      if (st.kind === "round") toast("🏆 Nouvelle élection de l'employé du mois : 3 nominés t'attendent !", "quest", 6000);
    }
    const oldRound = prev.life?.round;
    const newRound = state.life?.round;
    if (newRound && oldRound?.id === newRound.id) {
      for (const q of newRound.quests) {
        const before = oldRound.quests.find((o) => o.id === q.id);
        if (q.kind === "mission" && before?.status === "open" && q.status === "solved") toast(`⭐ Quête réussie : ${q.title}`, "quest", 5000);
      }
    }
    if (state.housekeeping?.lastAt && state.housekeeping.lastAt !== prev.housekeeping?.lastAt) {
      // Le ménage vide aussi le cache local des documents.
      backend.clearCache?.();
      toast("🧹 Ménage terminé : corbeille vidée, cache nettoyé ✨", "success");
    }
  }

  function updateHud(state) {
    const k = computeKpis(state, backend.now());
    hudTitle.textContent = `🏢 ${state.settings?.companyName || `QG de ${state.boss?.name || "Boss"}`}`;
    chipWorking.querySelector("b").textContent = k.working;
    chipReview.hidden = !k.review;
    chipReview.querySelector("b").textContent = k.review;
    const round = state.life?.round;
    const open = round && !round.winnerId ? round.quests.filter((q) => q.status === "open").length : 0;
    chipQuests.hidden = !round;
    chipQuests.querySelector("b").textContent = round?.winnerId ? "✓" : open;
  }

  let prev = null;
  backend.subscribe((state) => {
    world?.sync(state);
    elevator?.onState(state);
    panels.update(state);
    updateHud(state);
    renderDock();
    if (prev) notifyChanges(prev, state);
    prev = state;
  });

  const state = backend.state;
  world?.sync(state);
  updateHud(state);
  renderDock();
  prev = state;
  backend.start();
  splash("Toute l'équipe est à son poste !");
  setTimeout(hideSplash, 350);

  // ---- Premier lancement
  let onboarded = false;
  try {
    onboarded = !!localStorage.getItem(ONBOARDED_KEY);
  } catch {
    // stockage indisponible
  }
  if (!onboarded) {
    const modal = openModal({
      title: "👋 Bienvenue dans ton entreprise",
      body: h("div", { class: "md" },
        h("p", {}, `${backend.state.agents.length} employés IA (dont 4 stagiaires) et 3 chats t'attendent :`),
        h("ul", {},
          h("li", {}, h("strong", {}, "👔 Direction"), " — confie tes missions, valide les dossiers importants."),
          h("li", {}, h("strong", {}, "🛍️ Vente · 🔎 Bons plans · 📱 Social"), " — Vinted, sourcing, dénicheurs, Snap, Telegram, TikTok."),
          h("li", {}, h("strong", {}, "🌐 Web · 🎨 Marketing · ⚖️ Juridique"), " — sites, bots, visuels, pub, data, CGV, démarches."),
          h("li", {}, h("strong", {}, "💎 Créateurs"), " — le pôle OFM en préparation (strictement pro)."),
          h("li", {}, h("strong", {}, "🏆 Employé du mois"), " — résous des petites quêtes (enquêtes, objets perdus, quiz, médiations) pour élire le champion."),
          h("li", {}, h("strong", {}, "🤝 RH · 🐈 Salle de repos"), " — relations, potins, stagiaires à embaucher, chats à câliner.")),
        h("p", { class: "muted" }, "Glisse pour te déplacer, pince pour zoomer, touche une pièce, une pancarte ou un employé pour ouvrir son tableau de bord. Et ne laisse jamais ton agrafeuse sans surveillance."),
        backend.mode === "demo" ? h("p", { class: "muted" }, "🎮 Tu es en mode démo : les données restent dans ce navigateur.") : null),
      footer: [h("button", { class: "btn primary block", onClick: () => modal.close() }, "C'est parti !")],
      onClose: () => {
        try {
          localStorage.setItem(ONBOARDED_KEY, "1");
        } catch {
          // ignoré
        }
      },
    });
  }
}

boot();
