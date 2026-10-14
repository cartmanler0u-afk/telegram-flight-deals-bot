// Point d'entrée de la mini app « QG des agents IA ».

import { createBackend } from "./backend.js";
import { Panels } from "./ui/panels.js";
import { h, tg, toast, haptic, openModal, closeTopModal, hasModal } from "./ui/dom.js";
import { missionForm, openDocument, avatar } from "./ui/components.js";
import { PANELS, roleOf } from "../shared/roster.js";
import { computeKpis, liveMeeting } from "../shared/engine.js";

const DOCK = ["overview", ...Object.keys(PANELS)];
const ONBOARDED_KEY = "qg-onboarded-v2";

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
  const life = createLifeStore();
  const panels = new Panels({
    backend,
    life,
    getWorld: () => world,
    onOpen: (panel) => {
      if (panel.kind === "panel") world?.focusPanel(panel.id, true);
      else world?.focusAgent(panel.id, true);
      renderDock();
      syncBackButton();
    },
    onClose: () => {
      world?.clearSelection();
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
      onLife: (entry) => life.push(entry),
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
    if (location.hostname === "localhost") window.__qgWorld = world; // diagnostic en développement local
    if (tg?.onEvent) tg.onEvent("viewportChanged", () => world.resize());
  } catch (err) {
    console.error(err);
    world = null;
    toast("La 3D n'est pas disponible sur cet appareil : le QG fonctionne en mode tableau de bord.", "error", 6000);
  }

  // ---- HUD
  const hudTitle = document.getElementById("hud-title");
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
    const badges = { director: k.review, meeting: live ? "●" : 0, sourcing: deals, annexe: (state.trash || []).length ? "🗑️" : 0 };
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
    if (panels.isOpen || hasModal()) tg.BackButton.show();
    else tg.BackButton.hide();
  }
  if (tg?.BackButton && tg.isVersionAtLeast?.("6.1")) {
    tg.BackButton.onClick(() => {
      if (!closeTopModal()) panels.close();
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
  }

  let prev = null;
  backend.subscribe((state) => {
    world?.sync(state);
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
        h("p", {}, "27 employés IA t'attendent dans les bureaux, organisés en pôles :"),
        h("ul", {},
          h("li", {}, h("strong", {}, "👔 Direction"), " — confie tes missions, valide les dossiers importants."),
          h("li", {}, h("strong", {}, "🛍️ Vente"), " — annonces Vinted, photos, expéditions, SAV."),
          h("li", {}, h("strong", {}, "🔎 Bons plans"), " — sourcing et dénicheurs de bons plans."),
          h("li", {}, h("strong", {}, "📱 Social"), " — Snapchat, Telegram, montage TikTok, rédaction."),
          h("li", {}, h("strong", {}, "🌐 Web & Tech"), " — sites, bots et automatisations."),
          h("li", {}, h("strong", {}, "💎 Créateurs"), " — le pôle OFM en préparation."),
          h("li", {}, h("strong", {}, "🍕 Cuisine"), " — la vie de bureau : potins, pots, Uber Eats, blagues…")),
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
