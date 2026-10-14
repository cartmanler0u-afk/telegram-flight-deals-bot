// Point d'entrée de la mini app « QG des agents IA ».

import { createBackend } from "./backend.js";
import { Panels } from "./ui/panels.js";
import { h, tg, toast, haptic, openModal, closeTopModal, hasModal } from "./ui/dom.js";
import { missionForm, openDocument } from "./ui/components.js";
import { ROOMS } from "../shared/roster.js";
import { computeKpis, liveMeeting } from "../shared/engine.js";

const DOCK = ["overview", "director", "studio", "library", "reception", "meeting", "openspace", "lounge"];
const ONBOARDED_KEY = "qg-onboarded-v1";

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
  const panels = new Panels({
    backend,
    onOpen: (panel) => {
      if (panel.kind === "room") world?.focusRoom(panel.id, true);
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
      onSelectRoom: (id) => (id === "openspace" || ROOMS[id] ? panels.openRoom(id) : null),
      onSelectAgent: (id) => panels.openAgent(id),
    });
    world.init();
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
  chipWorking.addEventListener("click", () => panels.openRoom("openspace"));
  chipReview.addEventListener("click", () => panels.openRoom("director"));
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
  hudMode.addEventListener("click", () => panels.openRoom("lounge"));
  const tickClock = () => {
    clock.textContent = new Date(backend.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };
  tickClock();
  setInterval(tickClock, 10000);

  // ---- Dock
  const dock = document.getElementById("dock");
  function renderDock() {
    const state = backend.state;
    const k = computeKpis(state, backend.now());
    const live = liveMeeting(state);
    const badges = { director: k.review, meeting: live ? "●" : 0 };
    dock.replaceChildren(...DOCK.map((id) => {
      const room = id === "overview" ? { icon: "🗺️", short: "Vue", color: "#7c6cff" } : ROOMS[id];
      const active = id === "overview" ? !panels.isOpen : panels.current?.kind === "room" && panels.current.id === id;
      return h("button", {
        class: `dock-btn${active ? " active" : ""}`,
        style: { "--room": room.color },
        onClick: () => {
          haptic("light");
          if (id === "overview") {
            panels.close();
            world?.overview();
          } else {
            panels.openRoom(id);
          }
        },
      }, h("span", { class: "emo" }, room.icon), room.short, badges[id] ? h("span", { class: "count" }, badges[id]) : null);
    }));
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
  }

  function updateHud(state) {
    const k = computeKpis(state, backend.now());
    hudTitle.textContent = `🏢 QG de ${state.boss?.name || "Boss"}`;
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
      title: "👋 Bienvenue dans ton QG",
      body: h("div", { class: "md" },
        h("p", {}, "Ton équipe d'agents IA travaille dans cet open space en 3D :"),
        h("ul", {},
          h("li", {}, h("strong", {}, "👔 Direction"), " — confie tes missions, valide les dossiers importants, demande le brief."),
          h("li", {}, h("strong", {}, "🌐 Studio Web"), " — commande des sites complets, prévisualise-les."),
          h("li", {}, h("strong", {}, "📚 Bibliothèque"), " — tous les livrables et documents sont stockés ici."),
          h("li", {}, h("strong", {}, "📅 Secrétariat"), " — planning en langage naturel et rappels."),
          h("li", {}, h("strong", {}, "🗒️ Réunion"), " — prends des notes, le greffier rédige le compte rendu."),
          h("li", {}, h("strong", {}, "🏢 Équipes"), " — organigramme, managers et recrutements.")),
        h("p", { class: "muted" }, "Glisse pour te déplacer, pince pour zoomer, touche une pièce ou un agent pour ouvrir son tableau de bord."),
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
