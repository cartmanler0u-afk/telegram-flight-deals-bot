// Ascenseur B : on change d'étage dans la vue 3D. Le QG est l'Étage 11 ; les autres étages
// du Bâtiment 0 sont construits à partir de l'état réel du monde et rafraîchis à chaque cycle.

import { h, clear, haptic, toast, openModal } from "./dom.js";

const QG_FLOOR = "f11";
const REFRESH_MS = 30000;

// Répliques d'ambiance de l'ascenseur selon son humeur réelle (texte d'interface, pas un événement).
const LINES = {
  good: ["Étage {n}, {short}. Bonne visite !", "Ding ! {short}. Tout le monde descend.", "Je vous dépose au {n}. Je vous aime bien, vous."],
  meh: ["{short}. Je ne dis rien. Je n'en pense pas moins.", "Étage {n}. Vous auriez pu prendre l'escalier."],
  bad: ["… {short}. Ne me remerciez pas.", "Étage {n}. Je boude, mais je reste professionnel."],
};

export function createElevator({ backend, getWorld, onOpenRoute }) {
  let current = QG_FLOOR;
  let floors = [];
  let lastCycle = null;
  let lastFetch = 0;
  let busy = false;
  let banner = null;

  // Bouton de l'ascenseur dans le HUD.
  const chip = h("button", { class: "hud-chip", id: "chip-elevator", title: "Ascenseur B : visiter les étages du Bâtiment" }, "🛗 ", h("b", {}, "11"));
  chip.addEventListener("click", () => openPicker());
  document.querySelector("#hud .hud-right")?.prepend(chip);

  const fx = h("div", { id: "elevator-fx", "aria-hidden": "true" }, h("div", { class: "door left" }), h("div", { class: "door right" }), h("div", { class: "elevator-fx-text" }));
  document.body.append(fx);

  banner = h("div", { id: "floor-banner", hidden: true });
  document.body.append(banner);

  const query = (payload) => backend.query("world.explore", payload);
  const levelOf = (id) => floors.find((f) => f.id === id)?.level ?? (id === QG_FLOOR ? 11 : "?");

  async function loadFloors() {
    try {
      const v = await query({ view: "building" });
      floors = v.floors;
    } catch {
      // la liste sera rechargée à la prochaine ouverture
    }
    return floors;
  }

  function renderChip() {
    chip.querySelector("b").textContent = String(levelOf(current));
    chip.classList.toggle("on", current !== QG_FLOOR);
  }

  function renderBanner(data) {
    if (current === QG_FLOOR || !data) {
      banner.hidden = true;
      return;
    }
    const idx = floors.findIndex((f) => f.id === current);
    const up = idx > 0 ? floors[idx - 1] : null;
    const down = idx >= 0 && idx < floors.length - 1 ? floors[idx + 1] : null;
    const people = data.people.length;
    clear(banner,
      h("button", { class: "fb-btn", disabled: !up, title: up ? `Monter : ${up.short}` : "", onClick: () => up && goTo(up.id) }, "▲"),
      h("button", { class: "fb-main", title: "Ouvrir la fiche de l'étage", onClick: () => onOpenRoute?.({ view: "floor", id: current }) },
        h("span", { class: "fb-level" }, String(data.level)),
        h("span", { class: "fb-text" }, h("b", {}, data.short), h("span", { class: "fb-sub" }, `${people} 👥 · ${data.clock}${data.access ? ` · 🔒 ${data.access}` : ""}`))),
      h("button", { class: "fb-btn", disabled: !down, title: down ? `Descendre : ${down.short}` : "", onClick: () => down && goTo(down.id) }, "▼"),
      h("button", { class: "fb-btn fb-home", title: "Retour à ton QG (Étage 11)", onClick: () => goTo(QG_FLOOR) }, "🏢 QG"));
    banner.hidden = false;
  }

  function line(data) {
    const pool = data.elevator >= 60 ? LINES.good : data.elevator >= 35 ? LINES.meh : LINES.bad;
    return pool[Math.floor(Math.random() * pool.length)].replace("{n}", data.level).replace("{short}", data.short);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function doors(text, during) {
    fx.querySelector(".elevator-fx-text").textContent = text;
    fx.classList.add("closing");
    await wait(380);
    try {
      await during();
    } finally {
      await wait(260);
      fx.classList.remove("closing");
    }
  }

  // Va à un étage (et, si demandé, centre la vue sur une pièce ou une personne).
  async function goTo(floorId, { room = null, person = null, sheet = false, transition = true } = {}) {
    const world = getWorld();
    if (!world || busy) return;
    if (!floors.length) await loadFloors();
    if (floorId === QG_FLOOR) {
      if (current === QG_FLOOR) return;
      busy = true;
      try {
        await doors("Étage 11 — Ton QG", async () => world.leaveFloor());
      } finally {
        busy = false;
      }
      current = QG_FLOOR;
      renderChip();
      renderBanner(null);
      window.dispatchEvent(new Event("qg:overlay"));
      return;
    }
    const same = current === floorId && world.inFloor;
    busy = true;
    try {
      const data = await query({ view: "floor3d", id: floorId });
      if (!data) throw new Error("Étage introuvable.");
      lastCycle = data.cycle;
      lastFetch = Date.now();
      if (same) world.updateFloor(data);
      else if (transition) await doors(`Étage ${data.level} — ${data.short}\n« ${line(data)} »`, async () => world.enterFloor(data));
      else world.enterFloor(data);
      current = floorId;
      renderChip();
      renderBanner(data);
      if (!same) haptic("medium");
      if (person) world.focusFloorPerson(person, sheet);
      else if (room) world.focusFloorRoom(room, sheet);
    } catch (err) {
      toast(err.message || "L'Ascenseur B refuse de bouger.", "error");
    } finally {
      busy = false;
      window.dispatchEvent(new Event("qg:overlay"));
    }
  }

  async function refresh() {
    const world = getWorld();
    if (!world?.inFloor || busy || current === QG_FLOOR) return;
    try {
      const data = await query({ view: "floor3d", id: current });
      if (!data || !world.inFloor || world.floor?.id !== data.id) return;
      lastCycle = data.cycle;
      lastFetch = Date.now();
      world.updateFloor(data);
      renderBanner(data);
    } catch {
      // nouvel essai au prochain cycle
    }
  }

  async function openPicker() {
    haptic("light");
    await loadFloors();
    const list = h("div", { class: "elevator-keypad" },
      ...floors.map((f) => h("button", {
        class: `elevator-key${f.id === current ? " on" : ""}${f.access ? " locked" : ""}`,
        onClick: () => {
          modal.close();
          goTo(f.id);
        },
      }, h("span", { class: "ek-level" }, String(f.level)), h("span", { class: "ek-name" }, f.id === QG_FLOOR ? `${f.short} (ton QG)` : f.short), h("span", { class: "ek-count" }, f.access ? "🔒" : `${f.people} 👥`))));
    const modal = openModal({
      title: "🛗 Ascenseur B",
      body: h("div", {}, h("p", { class: "small muted" }, "Choisis un étage : tu y verras chaque habitant là où il est vraiment, en ce moment."), list),
    });
  }

  window.addEventListener("madhouse:view", (e) => {
    // Le panneau Bâtiment a ouvert un étage, une pièce ou une fiche : la 3D suit.
    const { floor, room, person } = e.detail || {};
    if (!floor) return;
    const world = getWorld();
    if (!world) return;
    if (floor === QG_FLOOR) {
      if (current !== QG_FLOOR) goTo(QG_FLOOR);
      return;
    }
    goTo(floor, { room, person, sheet: true, transition: current !== floor });
  });

  setInterval(() => {
    if (Date.now() - lastFetch > REFRESH_MS) refresh();
  }, 5000);

  return {
    goTo,
    get current() {
      return current;
    },
    get inFloor() {
      return current !== QG_FLOOR;
    },
    // Nouvel état du QG : si le Bâtiment a avancé d'un cycle, l'étage visité est rechargé.
    onState(state) {
      const cycle = state.madhouse?.cycle;
      if (cycle !== undefined && lastCycle !== null && cycle !== lastCycle) refresh();
    },
    leave() {
      if (current === QG_FLOOR) return;
      getWorld()?.leaveFloor();
      current = QG_FLOOR;
      renderChip();
      renderBanner(null);
    },
  };
}
