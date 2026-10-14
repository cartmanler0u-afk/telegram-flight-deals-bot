// Scène 3D du QG : rendu, caméra, sélection, et mise en scène de l'état des agents.

import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { NavGrid } from "./nav.js";
import { buildOffice, MONITOR_IDLE, MONITOR_ON } from "./props.js";
import { Person } from "./people.js";
import { AREAS, BOUNDS, MEETING_SEATS, SPOTS, assignDesks } from "./layout.js";
import { ROOMS, ROLES, TASK_TYPES, roleOf } from "../../shared/roster.js";
import { taskProgress, liveMeeting, computeKpis } from "../../shared/engine.js";

const BOSS_LOOK = { skin: "#f0c9a8", hair: "#3b2a20", hairStyle: "short", shirt: "#f4f4fa", pants: "#1f2a44" };
const COFFEE_LINES = ["☕ Petite pause", "On reprend dans 5 min", "Qui a fini le café ?", "Brainstorm improvisé 💡", "Ça avance bien !", "🍪 Un cookie ?"];
const ROOM_ORDER = ["director", "studio", "library", "reception", "meeting", "openspace", "lounge"];

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function sideSpot(home) {
  // Point debout à côté d'un poste, tourné vers la personne assise.
  const fx = Math.sin(home.facing);
  const fz = Math.cos(home.facing);
  const rx = fz;
  const rz = -fx;
  return { x: home.x + rx * 0.75 - fx * 0.2, z: home.z + rz * 0.75 - fz * 0.2, facing: Math.atan2(-rx, -rz), standing: true };
}

class Actor {
  constructor(world, agent, person) {
    this.world = world;
    this.agentId = agent.id;
    this.person = person;
    this.home = null;
    this.trip = [];
    this.goal = null;
    this.arrivedAt = 0;
    this.meetingSeat = null;
    this.working = false;
  }

  desired() {
    if (this.trip.length) return { spot: this.trip[0].spot, activity: this.trip[0].activity || "idle", trip: this.trip[0] };
    if (this.meetingSeat) return { spot: this.meetingSeat, activity: "talk" };
    return { spot: this.home, activity: this.working ? "work" : "idle" };
  }

  update(nowMs) {
    const d = this.desired();
    if (!d.spot) return;
    if (this.goal !== d.spot) {
      this.goal = d.spot;
      this.arrivedAt = 0;
      const p = this.person.root.position;
      const path = this.world.nav.findPath([p.x, p.z], [d.spot.x, d.spot.z]);
      this.person.activity = "idle";
      this.person.walk(path, d.spot, () => {
        this.arrivedAt = performance.now();
      });
      if (d.trip?.onStart) d.trip.onStart();
      return;
    }
    if (this.person.moving) return;
    if (!this.arrivedAt) this.arrivedAt = performance.now();
    this.person.activity = d.activity;
    if (d.trip) {
      if (!d.trip.started) {
        d.trip.started = true;
        d.trip.onArrive?.();
      }
      if (performance.now() - this.arrivedAt > (d.trip.dwell || 2000)) {
        this.trip.shift();
        d.trip.onDone?.();
      }
    }
  }
}

export class World {
  constructor(container, { now, onSelectRoom, onSelectAgent }) {
    this.container = container;
    this.now = now;
    this.onSelectRoom = onSelectRoom;
    this.onSelectAgent = onSelectAgent;
    this.actors = new Map();
    this.prev = null;
    this.state = null;
    this.selected = null;
    this.tween = null;
    this.lastCoffee = performance.now();
    this.clock = new THREE.Clock();
  }

  init() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const labels = new CSS2DRenderer();
    labels.domElement.className = "label-layer";
    Object.assign(labels.domElement.style, { position: "absolute", top: "0", left: "0" });
    this.container.appendChild(labels.domElement);
    this.labels = labels;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0e1120");
    scene.fog = new THREE.Fog("#0e1120", 70, 140);
    this.scene = scene;

    this.hemi = new THREE.HemisphereLight("#e3ecff", "#4b3f36", 1.15);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight("#fff3df", 2.2);
    sun.position.set(14, 28, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 20, bottom: -20, near: 1, far: 80 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    this.sun = sun;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 220);
    const controls = new MapControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 7;
    controls.maxDistance = 120;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.25;
    controls.zoomToCursor = true;
    this.controls = controls;

    this.nav = new NavGrid();
    this.office = buildOffice(scene, this.nav);

    this.buildRoomTags();
    this.selectRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.04, 8, 40),
      new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.9 })
    );
    this.selectRing.rotation.x = Math.PI / 2;
    this.selectRing.visible = false;
    scene.add(this.selectRing);

    this.boss = new Person({ id: "boss", look: BOSS_LOOK, isBoss: true, onClick: () => this.onSelectRoom?.("director") });
    this.boss.setName("Toi");
    this.boss.place(SPOTS.entrance);
    this.boss.pose = "stand";
    scene.add(this.boss.root);

    this.installPicking();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    new ResizeObserver(() => this.resize()).observe(this.container);
    this.applyDaylight();
    setInterval(() => this.applyDaylight(), 60000);
    setInterval(() => this.drawScreens(), 1000);
    this.overview(false);
    renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------------ caméra

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get portrait() {
    return this.camera.aspect < 0.9;
  }

  viewFor(target, distance, sheet) {
    // Vue depuis le sud en paysage, depuis l'est en portrait (l'étage tient mieux dans l'écran).
    const polar = this.portrait ? 0.62 : 0.86;
    const az = this.portrait ? Math.PI / 2 : 0;
    const dir = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
    const t = target.clone();
    if (sheet) {
      if (window.innerWidth >= 900) {
        // panneau à droite : on décale la pièce vers la gauche de l'écran
        const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
        t.addScaledVector(right, distance * 0.22);
      } else {
        // panneau en bas : la pièce remonte dans le haut de l'écran
        const towardCam = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
        t.addScaledVector(towardCam, distance * 0.42);
      }
    }
    return { target: t, position: t.clone().addScaledVector(dir, distance) };
  }

  flyTo(view, animate = true) {
    if (!animate) {
      this.controls.target.copy(view.target);
      this.camera.position.copy(view.position);
      this.controls.update();
      return;
    }
    this.tween = {
      t0: performance.now(),
      dur: 900,
      fromTarget: this.controls.target.clone(),
      fromPos: this.camera.position.clone(),
      toTarget: view.target,
      toPos: view.position,
    };
  }

  overview(animate = true) {
    // Cherche la distance minimale pour que tout l'étage (murs compris) tienne entre le HUD et le dock.
    const target = new THREE.Vector3(this.portrait ? 0.6 : 0, 0, this.portrait ? 0.5 : 1);
    const corners = [];
    for (const [x, z] of [[BOUNDS.minX, BOUNDS.minZ], [BOUNDS.maxX, BOUNDS.minZ], [BOUNDS.maxX, BOUNDS.maxZ], [BOUNDS.minX, BOUNDS.maxZ]]) {
      corners.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 2.7, z));
    }
    const cam = this.camera.clone();
    const fits = (dist) => {
      const view = this.viewFor(target, dist, false);
      cam.position.copy(view.position);
      cam.lookAt(view.target);
      cam.updateMatrixWorld();
      return corners.every((p) => {
        const v = p.clone().project(cam);
        return v.z < 1 && Math.abs(v.x) < 0.97 && v.y > -0.8 && v.y < 0.86;
      });
    };
    let lo = 12;
    let hi = 140;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    this.flyTo(this.viewFor(target, hi, false), animate);
  }

  focusRoom(roomId, sheet = true) {
    const area = AREAS[roomId];
    if (!area) return;
    const dist = roomId === "openspace" ? 22 : 15;
    this.flyTo(this.viewFor(new THREE.Vector3(area.focus[0], 0, area.focus[1]), dist, sheet));
    this.walkBoss(area.visit);
    this.highlightRoom(roomId);
  }

  focusAgent(agentId, sheet = true) {
    const actor = this.actors.get(agentId);
    if (!actor) return;
    const p = actor.person.root.position;
    this.flyTo(this.viewFor(new THREE.Vector3(p.x, 0, p.z), 11, sheet));
    this.selected = agentId;
    this.highlightRoom(null);
  }

  clearSelection() {
    this.selected = null;
    this.highlightRoom(null);
  }

  // ---------------------------------------------------------------- sélection

  buildRoomTags() {
    this.roomTags = {};
    for (const id of ROOM_ORDER) {
      const room = ROOMS[id];
      const area = AREAS[id];
      const el = document.createElement("div");
      el.className = "room-tag";
      el.style.setProperty("--room", room.color);
      el.innerHTML = `<span>${room.icon}</span><span>${room.name}</span><span class="count" hidden></span>`;
      el.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        this.onSelectRoom?.(id);
      });
      const obj = new CSS2DObject(el);
      obj.position.set(area.label[0], id === "openspace" ? 2.2 : 3.1, area.label[1]);
      this.scene.add(obj);
      this.roomTags[id] = el;
    }
  }

  highlightRoom(roomId) {
    for (const [id, el] of Object.entries(this.roomTags)) el.style.transform = id === roomId ? "scale(1.12)" : "";
  }

  setRoomBadge(roomId, count) {
    const badge = this.roomTags[roomId]?.querySelector(".count");
    if (!badge) return;
    badge.hidden = !count;
    badge.textContent = count;
  }

  installPicking() {
    const el = this.renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    el.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    });
    el.addEventListener("pointerup", (e) => {
      if (!down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved > 8 || !quick) return;
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, this.camera);

      const hitboxes = [...this.actors.values()].map((a) => a.person.hitbox);
      const agentHit = raycaster.intersectObjects(hitboxes, false)[0];
      if (agentHit) {
        this.onSelectAgent?.(agentHit.object.userData.agentId);
        return;
      }
      const targets = [...Object.values(this.office.rooms), this.office.base];
      const hit = raycaster.intersectObjects(targets, true)[0];
      if (!hit) return;
      let obj = hit.object;
      while (obj && obj.userData.roomId === undefined && !obj.userData.walk) obj = obj.parent;
      if (obj?.userData.roomId) {
        this.onSelectRoom?.(obj.userData.roomId);
      } else {
        this.walkBoss({ x: hit.point.x, z: hit.point.z });
      }
    });
  }

  walkBoss(spot) {
    const p = this.boss.root.position;
    const target = { x: spot.x, z: spot.z, standing: true };
    this.boss.walk(this.nav.findPath([p.x, p.z], [spot.x, spot.z]), target, () => {
      this.boss.activity = "idle";
    });
  }

  // ------------------------------------------------------------ synchronisation

  sync(state) {
    const prev = this.prev;
    this.state = state;
    this.boss.setName(state.boss?.name ? `${state.boss.name} (toi)` : "Toi");

    // Agents : création / suppression / poste attribué
    const ordered = [...state.agents].sort((a, b) => (b.builtin === true) - (a.builtin === true) || a.hiredAt - b.hiredAt);
    const homes = assignDesks(ordered);
    const ids = new Set(state.agents.map((a) => a.id));
    for (const [id, actor] of this.actors) {
      if (!ids.has(id)) {
        actor.person.dispose();
        this.actors.delete(id);
      }
    }
    for (const agent of state.agents) {
      let actor = this.actors.get(agent.id);
      if (!actor) {
        const person = new Person({
          id: agent.id,
          look: agent.look || {},
          accessory: roleOf(agent).accessory,
          onClick: (id) => this.onSelectAgent?.(id),
        });
        actor = new Actor(this, agent, person);
        this.actors.set(agent.id, actor);
        this.scene.add(person.root);
        const home = homes.get(agent.id);
        if (prev) {
          person.place({ ...SPOTS.entrance, standing: true });
          actor.trip.push({ spot: { ...SPOTS.entrance, standing: true }, activity: "wave", dwell: 1200, onArrive: () => person.say("Bonjour tout le monde ! 👋") });
        } else {
          person.place(home);
        }
      }
      actor.home = homes.get(agent.id);
      actor.person.setName(agent.name);
    }

    // Réunion en cours : les participants rejoignent la salle
    const meeting = liveMeeting(state);
    const attendees = meeting ? meeting.attendees : [];
    for (const actor of this.actors.values()) {
      const idx = attendees.indexOf(actor.agentId);
      actor.meetingSeat = idx >= 0 ? MEETING_SEATS[idx % MEETING_SEATS.length] : null;
    }
    if (meeting && prev && !liveMeeting(prev)) {
      for (const id of attendees) this.actors.get(id)?.person.say("🗣️ J'arrive en réunion !", 2500);
    }

    // Missions : qui travaille, et petites scènes de vie sur les changements de statut
    const working = new Set(state.tasks.filter((t) => t.status === "working").map((t) => t.agentId));
    for (const actor of this.actors.values()) actor.working = working.has(actor.agentId);

    if (prev) this.reactToChanges(prev, state);
    this.prev = state;
    this.updateTags();
    this.updateMonitors();
    this.drawScreens();
  }

  reactToChanges(prev, state) {
    const before = new Map(prev.tasks.map((t) => [t.id, t]));
    for (const task of state.tasks) {
      const old = before.get(task.id);
      const actor = this.actors.get(task.agentId);
      if (!actor) continue;
      if (!old) {
        actor.person.say(`📥 ${task.title.slice(0, 40)}`, 3000);
        const manager = this.actors.get(task.managerId);
        if (manager && manager !== actor && !manager.meetingSeat && !manager.trip.length && actor.home) {
          manager.trip.push({
            spot: sideSpot(actor.home),
            activity: "talk",
            dwell: 2600,
            onArrive: () => manager.person.say("Nouvelle mission pour toi 👇", 2400),
          });
        }
        continue;
      }
      if (old.status === task.status) continue;
      if (old.status === "working" && (task.status === "done" || task.status === "review")) {
        actor.trip.push({
          spot: SPOTS.libraryDrop,
          activity: "drop",
          dwell: 1800,
          onArrive: () => actor.person.say("📦 Livré à la bibliothèque", 2200),
        });
        if (task.status === "review" && actor.agentId !== "director") {
          actor.trip.push({
            spot: { ...SPOTS.directorVisit },
            activity: "talk",
            dwell: 2400,
            onArrive: () => {
              actor.person.say("📁 Dossier à valider", 2200);
              this.actors.get("director")?.person.say("Je le présente au boss 👌", 2600);
            },
          });
        }
      } else if (old.status === "review" && task.status === "done") {
        this.actors.get("director")?.person.say("🏅 Validé !", 2500);
      } else if (old.status === "review" && task.status === "queued") {
        actor.person.say("↩️ Je corrige ça", 2500);
      } else if (task.status === "working" && old.status === "queued") {
        actor.person.say("💪 Je m'y mets", 1800);
      }
    }
    if (state.events.length > prev.events.length) this.actors.get("secretary")?.person.say("📅 C'est noté au planning", 2600);
    const manualDocs = state.documents.filter((d) => d.authorId === "boss").length;
    if (manualDocs > prev.documents.filter((d) => d.authorId === "boss").length) {
      this.actors.get("librarian")?.person.say("📚 Rangé et étiqueté", 2600);
    }
    if (state.director?.briefStatus === "writing" && prev.director?.briefStatus !== "writing") {
      this.actors.get("director")?.person.say("🧭 Je rédige le brief…", 3000);
    }
    const summarizing = state.meetings.find((m) => m.status === "summarizing");
    if (summarizing && !prev.meetings.find((m) => m.id === summarizing.id && m.status === "summarizing")) {
      this.actors.get(summarizing.attendees[0])?.person.say("📝 Je rédige le compte rendu", 3000);
    }
  }

  updateTags() {
    const state = this.state;
    if (!state) return;
    const now = this.now();
    const meeting = liveMeeting(state);
    for (const actor of this.actors.values()) {
      const task = state.tasks.find((t) => t.agentId === actor.agentId && t.status === "working");
      let emoji = "";
      let progress = null;
      if (meeting?.attendees.includes(actor.agentId)) emoji = "🗣️";
      else if (task) {
        emoji = TASK_TYPES[task.type]?.icon || "💼";
        progress = taskProgress(task, now);
      } else if (actor.trip[0]?.activity === "coffee") emoji = "☕";
      const agent = state.agents.find((a) => a.id === actor.agentId);
      if (!emoji && agent) emoji = ROLES[agent.role]?.icon || "";
      actor.person.setStatus({ emoji, progress, compact: this.compactTags });
    }
    const k = computeKpis(state, now);
    this.setRoomBadge("director", k.review);
    this.setRoomBadge("meeting", meeting ? "●" : 0);
  }

  updateMonitors() {
    const lit = new Set();
    for (const actor of this.actors.values()) {
      if (actor.working && actor.home) lit.add(actor.home.id);
    }
    for (const [id, screens] of this.office.monitors) {
      for (const m of screens) m.color.copy(lit.has(id) ? MONITOR_ON : MONITOR_IDLE);
    }
  }

  // ---------------------------------------------------------------- écrans

  drawScreens() {
    const state = this.state;
    if (!state) return;
    const now = this.now();
    const s = this.office.screens;
    const k = computeKpis(state, now);
    const fmtTime = (ms) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const font = (size, weight = 700) => `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const ellipsis = (ctx, text, max) => {
      let t = text;
      while (ctx.measureText(t).width > max && t.length > 1) t = t.slice(0, -2);
      return t === text ? t : `${t}…`;
    };

    s.director.draw((ctx, W, H) => {
      ctx.fillStyle = "#101426";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e0b354";
      ctx.font = font(30, 800);
      ctx.fillText("TABLEAU DE BORD", 28, 50);
      const tiles = [["En cours", k.working, "#4cc38a"], ["À valider", k.review, k.review ? "#ef5d6c" : "#9aa3c0"], ["Livrées auj.", k.doneToday, "#5aa9e6"], ["Documents", k.documents, "#c08552"]];
      const tw = (W - 28 * 2 - 18 * 3) / 4;
      tiles.forEach(([label, value, color], i) => {
        const x = 28 + i * (tw + 18);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x, 80, tw, H - 110);
        ctx.fillStyle = color;
        ctx.font = font(76, 800);
        ctx.fillText(String(value), x + 18, 175);
        ctx.fillStyle = "#c9cfe6";
        ctx.font = font(22, 700);
        ctx.fillText(label, x + 18, 220);
      });
    });

    const meeting = liveMeeting(state);
    s.meeting.draw((ctx, W, H) => {
      ctx.fillStyle = meeting ? "#1a1030" : "#0f1a2b";
      ctx.fillRect(0, 0, W, H);
      if (meeting) {
        const elapsed = Math.max(0, Math.floor((now - meeting.startedAt) / 1000));
        ctx.fillStyle = "#ef5d6c";
        ctx.beginPath();
        ctx.arc(46, 52, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = font(30, 800);
        ctx.fillText("RÉUNION EN COURS", 72, 63);
        ctx.font = font(42, 800);
        ctx.fillText(ellipsis(ctx, meeting.title, W - 60), 30, 150);
        ctx.fillStyle = "#9aa3c0";
        ctx.font = font(30, 700);
        ctx.fillText(`${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")} · ${meeting.notes.length} note(s) · ${meeting.attendees.length + 1} participants`, 30, 210);
      } else {
        const next = state.events.find((e) => e.isMeeting && e.start > now);
        ctx.fillStyle = "#5aa9e6";
        ctx.font = font(34, 800);
        ctx.fillText("SALLE DISPONIBLE", 30, 70);
        ctx.fillStyle = "#c9cfe6";
        ctx.font = font(28, 600);
        ctx.fillText(next ? ellipsis(ctx, `Prochaine : ${next.title}`, W - 60) : "Aucune réunion planifiée", 30, 150);
        if (next) ctx.fillText(new Date(next.start).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" }), 30, 200);
      }
    });

    s.calendar.draw((ctx, W, H) => {
      ctx.fillStyle = "#fdf6fa";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ef7fa6";
      ctx.fillRect(0, 0, W, 70);
      ctx.fillStyle = "#fff";
      ctx.font = font(32, 800);
      ctx.fillText(new Date(now).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(), 24, 47);
      const upcoming = state.events.filter((e) => e.start + e.durationMin * 60000 >= now).slice(0, 4);
      ctx.font = font(26, 700);
      if (!upcoming.length) {
        ctx.fillStyle = "#8a7f88";
        ctx.fillText("Agenda libre ✨", 24, 140);
      }
      upcoming.forEach((e, i) => {
        const y = 118 + i * 52;
        ctx.fillStyle = "#b2456e";
        ctx.fillText(fmtTime(e.start), 24, y);
        ctx.fillStyle = "#2c2430";
        ctx.fillText(ellipsis(ctx, e.title, W - 140), 120, y);
      });
    });

    const secretary = state.agents.find((a) => a.role === "secretary");
    s.counter.draw((ctx, W, H) => {
      ctx.fillStyle = "#ef7fa6";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = font(44, 800);
      ctx.fillText(`ACCUEIL · ${secretary?.name || ""}`.toUpperCase(), 22, 86);
    });

    s.kanban.draw((ctx, W, H) => {
      ctx.fillStyle = "#f7f8fb";
      ctx.fillRect(0, 0, W, H);
      const cols = [
        ["À FAIRE", "queued", "#ffe08a"],
        ["EN COURS", "working", "#b6f0d0"],
        ["À VALIDER", "review", "#ffc9a8"],
        ["TERMINÉ", "done", "#c9e3ff"],
      ];
      const cw = W / 4;
      cols.forEach(([label, status, color], i) => {
        const x = i * cw;
        const tasks = state.tasks.filter((t) => t.status === status);
        const list = status === "done" ? tasks.slice(-3).reverse() : tasks.slice(0, 3);
        ctx.fillStyle = "#2c3142";
        ctx.font = font(22, 800);
        ctx.fillText(`${label} (${tasks.length})`, x + 14, 36);
        list.forEach((t, j) => {
          const y = 56 + j * 78;
          ctx.fillStyle = color;
          ctx.fillRect(x + 12, y, cw - 24, 66);
          ctx.fillStyle = "#2c3142";
          ctx.font = font(17, 700);
          ctx.fillText(ellipsis(ctx, t.title, cw - 44), x + 22, y + 28);
          ctx.font = font(15, 600);
          ctx.fillText(state.agents.find((a) => a.id === t.agentId)?.name || "", x + 22, y + 52);
        });
        if (i) {
          ctx.fillStyle = "#dfe2ea";
          ctx.fillRect(x, 10, 2, H - 20);
        }
      });
    });

    const siteTask = state.tasks.find((t) => t.type === "site" && t.status === "working");
    s.studio.draw((ctx, W, H) => {
      ctx.fillStyle = "#14102b";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#8b6cff";
      ctx.font = font(30, 800);
      ctx.fillText("STUDIO WEB", 30, 56);
      ctx.fillStyle = "#fff";
      ctx.font = font(34, 800);
      if (siteTask) {
        const p = taskProgress(siteTask, now);
        ctx.fillText(ellipsis(ctx, siteTask.title, W - 60), 30, 140);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(30, 180, W - 60, 26);
        ctx.fillStyle = "#4cc38a";
        ctx.fillRect(30, 180, (W - 60) * p, 26);
        ctx.fillStyle = "#c9cfe6";
        ctx.font = font(26, 700);
        ctx.fillText(`Construction… ${Math.round(p * 100)} %`, 30, 250);
      } else {
        const sites = state.documents.filter((d) => d.kind === "site").length;
        ctx.fillText("Prêt pour un nouveau site 🚀", 30, 140);
        ctx.fillStyle = "#c9cfe6";
        ctx.font = font(26, 700);
        ctx.fillText(`${sites} site(s) livré(s)`, 30, 200);
      }
    });

    s.library.draw((ctx, W, H) => {
      ctx.fillStyle = "#2a1c12";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f2d3a5";
      ctx.font = font(34, 800);
      ctx.fillText("📚 BIBLIOTHÈQUE", 22, 62);
      ctx.fillStyle = "#fff";
      ctx.font = font(64, 800);
      ctx.fillText(String(state.documents.length), 22, 160);
      ctx.font = font(24, 700);
      ctx.fillStyle = "#d9c2a0";
      ctx.fillText("documents rangés", 22, 200);
      const last = state.documents.at(-1);
      if (last) ctx.fillText(ellipsis(ctx, `Dernier : ${last.title}`, W - 44), 22, 250);
    });

    s.logo.draw((ctx, W, H) => {
      ctx.translate(W / 2, H / 2);
      ctx.fillStyle = "rgba(124,108,255,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, W * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = font(120, 900);
      ctx.fillText("QG", 0, 30);
      ctx.font = font(34, 800);
      ctx.fillText((state.boss?.name || "").toUpperCase().slice(0, 16), 0, 95);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    });
  }

  // ------------------------------------------------------------ jour / nuit

  applyDaylight() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const day = h < 6 || h > 21 ? 0 : h < 8 ? (h - 6) / 2 : h > 19 ? (21 - h) / 2 : 1;
    this.hemi.intensity = 0.55 + 0.65 * day;
    this.sun.intensity = 0.5 + 1.8 * day;
    this.sun.color.set(day > 0.5 ? "#fff3df" : "#9fb3ff");
    const win = this.office.windowMat;
    win.emissive.set(day > 0.3 ? "#8fcfff" : "#1e2a5a");
    win.color.set(day > 0.3 ? "#a9d8ff" : "#1a2347");
    win.emissiveIntensity = 0.4 + 0.6 * day;
  }

  // ------------------------------------------------------------ boucle

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const nowMs = performance.now();

    if (this.tween) {
      const k = Math.min(1, (nowMs - this.tween.t0) / this.tween.dur);
      const e = ease(k);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e);
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e);
      if (k >= 1) this.tween = null;
    }
    const target = this.controls.target;
    const clampedX = THREE.MathUtils.clamp(target.x, BOUNDS.minX, BOUNDS.maxX);
    const clampedZ = THREE.MathUtils.clamp(target.z, BOUNDS.minZ, BOUNDS.maxZ + 4);
    if (clampedX !== target.x || clampedZ !== target.z || target.y !== 0) {
      const shift = new THREE.Vector3(clampedX - target.x, -target.y, clampedZ - target.z);
      target.add(shift);
      this.camera.position.add(shift);
    }
    this.controls.update();
    const compact = this.camera.position.distanceTo(this.controls.target) > 36;
    if (compact !== this.compactTags) {
      this.compactTags = compact;
      this.updateTags();
      this.boss.setStatus({ compact });
    }

    // Pauses café spontanées
    if (nowMs - this.lastCoffee > 14000 && this.state) {
      this.lastCoffee = nowMs;
      const busySpots = new Set([...this.actors.values()].flatMap((a) => a.trip.map((tr) => tr.spot)));
      const onBreak = [...this.actors.values()].filter((a) => a.trip.some((tr) => tr.activity === "coffee")).length;
      const idle = [...this.actors.values()].filter((a) => !a.working && !a.meetingSeat && !a.trip.length && a.agentId !== "director");
      const spot = SPOTS.coffee.find((s) => !busySpots.has(s));
      if (onBreak < 2 && idle.length && spot && Math.random() < 0.7) {
        const actor = idle[Math.floor(Math.random() * idle.length)];
        actor.trip.push({
          spot: { ...spot, standing: true },
          activity: "coffee",
          dwell: 7000 + Math.random() * 6000,
          onArrive: () => actor.person.say(COFFEE_LINES[Math.floor(Math.random() * COFFEE_LINES.length)], 2600),
        });
      }
    }

    for (const actor of this.actors.values()) {
      actor.update(nowMs);
      actor.person.update(dt, t);
    }
    this.boss.update(dt, t);

    if (this.selected && this.actors.has(this.selected)) {
      const p = this.actors.get(this.selected).person.root.position;
      this.selectRing.position.set(p.x, 0.04, p.z);
      this.selectRing.visible = true;
      this.selectRing.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    } else {
      this.selectRing.visible = false;
    }

    if (Math.floor(t * 3) !== this.lastLedTick) {
      this.lastLedTick = Math.floor(t * 3);
      for (const led of this.office.leds) if (Math.random() < 0.3) led.color.set(Math.random() < 0.5 ? "#4cc38a" : Math.random() < 0.5 ? "#5aa9e6" : "#1d3a2c");
      this.updateTags();
    }

    for (const wall of this.office.outerWalls) {
      wall.group.visible = this.camera.position.clone().sub(wall.point).dot(wall.normal) > 0;
    }

    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}
