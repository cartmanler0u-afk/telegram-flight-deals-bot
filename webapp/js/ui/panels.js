// Panneau latéral / bottom sheet : affiche le tableau de bord d'une pièce ou d'un agent.

import { clear, toast, haptic } from "./dom.js";
import { BASE_PANELS, agentPanel } from "./rooms.js";
import { DEPT_PANELS } from "./departments.js";
import { LIFE_PANELS } from "./office-life.js";
import { PANELS } from "../../shared/roster.js";

const ALL_PANELS = { ...BASE_PANELS, ...DEPT_PANELS, ...LIFE_PANELS };
import { taskProgress } from "../../shared/engine.js";

export class Panels {
  constructor({ backend, life, getWorld, onOpen, onClose }) {
    this.backend = backend;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.sheet = document.getElementById("sheet");
    this.body = document.getElementById("sheet-body");
    this.titleEl = document.getElementById("sheet-title");
    this.subtitleEl = document.getElementById("sheet-subtitle");
    this.iconEl = document.getElementById("sheet-icon");
    this.current = null;
    document.getElementById("sheet-close").addEventListener("click", () => this.close());
    this.installSwipe();

    this.ctx = {
      backend,
      state: () => backend.state,
      now: () => backend.now(),
      run: async (type, payload, success) => {
        try {
          const result = await backend.action(type, payload);
          if (success) toast(success, "success");
          haptic("light");
          return result;
        } catch (err) {
          toast(err.message, "error");
          return null;
        }
      },
      openAgent: (id) => this.openAgent(id),
      openPanel: (id) => this.openPanel(id),
      close: () => this.close(),
      world: () => getWorld?.() || null,
      life,
    };

    // Barres de progression et minuteurs en direct
    setInterval(() => this.tick(), 500);
  }

  get isOpen() {
    return !!this.current;
  }

  openPanel(panelId) {
    const def = ALL_PANELS[panelId];
    const meta = PANELS[panelId];
    if (!def || !meta) return;
    this.show({ key: `panel:${panelId}`, kind: "panel", id: panelId, def, title: () => meta.name, icon: () => meta.icon, color: () => meta.color, subtitle: def.subtitle });
  }

  refresh() {
    if (this.current) this.update(this.backend.state);
  }

  openAgent(agentId) {
    const def = agentPanel(agentId);
    this.show({ key: `agent:${agentId}`, kind: "agent", id: agentId, def, title: def.title, icon: def.icon, color: def.color, subtitle: def.subtitle });
  }

  show(panel) {
    if (this.current?.key === panel.key) {
      this.onOpen?.(panel);
      return;
    }
    this.current = panel;
    const state = this.backend.state;
    this.sheet.style.setProperty("--room", panel.color(state) || "#7c6cff");
    this.titleEl.textContent = panel.title(state);
    this.iconEl.textContent = panel.icon(state);
    this.subtitleEl.textContent = panel.subtitle?.(state) || "";
    clear(this.body);
    this.body.scrollTop = 0;
    panel.view = panel.def.mount(this.body, this.ctx);
    panel.view.update(state);
    this.sheet.classList.add("open");
    this.sheet.setAttribute("aria-hidden", "false");
    document.body.classList.add("sheet-open");
    haptic("light");
    this.onOpen?.(panel);
  }

  close() {
    if (!this.current) return;
    const closed = this.current;
    this.current = null;
    this.sheet.classList.remove("open");
    this.sheet.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sheet-open");
    this.onClose?.(closed);
  }

  update(state) {
    const panel = this.current;
    if (!panel) return;
    this.titleEl.textContent = panel.title(state);
    this.subtitleEl.textContent = panel.subtitle?.(state) || "";
    // On évite de reconstruire pendant une saisie : seuls les blocs dynamiques sont redessinés.
    const scroll = this.body.scrollTop;
    panel.view.update(state);
    this.body.scrollTop = scroll;
  }

  tick() {
    if (!this.current) return;
    const state = this.backend.state;
    const now = this.backend.now();
    for (const el of this.body.querySelectorAll("[data-progress-task]")) {
      const task = state.tasks.find((t) => t.id === el.dataset.progressTask);
      if (task) el.style.width = `${Math.round(taskProgress(task, now) * 100)}%`;
    }
    for (const el of this.body.querySelectorAll("[data-since]")) {
      const s = Math.max(0, Math.floor((now - Number(el.dataset.since)) / 1000));
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }
  }

  // Glisser la poignée vers le bas ferme le panneau (mobile).
  installSwipe() {
    const grip = document.getElementById("sheet-grip");
    const head = this.sheet.querySelector(".sheet-head");
    let startY = null;
    const down = (e) => {
      startY = e.clientY;
      this.sheet.style.transition = "none";
    };
    const move = (e) => {
      if (startY === null) return;
      const dy = Math.max(0, e.clientY - startY);
      this.sheet.style.transform = `translateY(${dy}px)`;
    };
    const up = (e) => {
      if (startY === null) return;
      const dy = e.clientY - startY;
      startY = null;
      this.sheet.style.transition = "";
      this.sheet.style.transform = "";
      if (dy > 90) this.close();
      else if (dy < -60) this.sheet.classList.add("tall");
    };
    for (const el of [grip, head]) {
      el.addEventListener("pointerdown", (e) => {
        if (window.innerWidth >= 900 || e.target.closest("button")) return;
        el.setPointerCapture(e.pointerId);
        down(e);
      });
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    }
  }
}
