// Scène 3D de l'entreprise : rendu, caméra, sélection, mise en scène de l'état des agents
// et de la vie de bureau.

import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { NavGrid } from "./nav.js";
import { buildOffice } from "./props.js";
import { Person, mat } from "./people.js";
import { LifeDirector } from "./life.js";
import { Crowd } from "./crowd.js";
import { CatHerd } from "./cats.js";
import { FloorScene } from "./floors.js";
import { AREAS, BOUNDS, MEETING_SEATS, SPOTS, ROOM_DESKS, PODS, DEPT_PODS, INTERN_POD, EOTM_TOTEM, assignDesks, deptAnchor, deskTop } from "./layout.js";
import { ROOMS, PANELS, DEPARTMENTS, ROLES, TASK_TYPES, roleOf } from "../../shared/roster.js";
import { taskProgress, liveMeeting, computeKpis } from "../../shared/engine.js";
import { HIDING_SPOTS, monthLabel } from "../../shared/social.js";

const BOSS_LOOK = { skin: "#f0c9a8", hair: "#3b2a20", hairStyle: "short", shirt: "#f4f4fa", pants: "#1f2a44" };
const COURIER_LOOK = { skin: "#c68d6a", hair: "#1f1a17", hairStyle: "short", shirt: "#06c167", pants: "#111111" };
const CAMERAMAN_LOOK = { skin: "#e8b796", hair: "#5a4632", hairStyle: "short", shirt: "#3a3a3a", pants: "#2b2f3a" };
const DEPT_SIGNS = { direction: "director", vente: "vente", sourcing: "sourcing", social: "social", organisation: "openspace" };
const IS_TOUCH = matchMedia("(pointer: coarse)").matches;
const CENTER_X = (BOUNDS.minX + BOUNDS.maxX) / 2;
const TRIP_EMOJI = { coffee: "☕", eat: "🍔", sleep: "💤", babyfoot: "⚽", dance: "🕺", run: "🏃", yoga: "🧘", karate: "🥋", pet: "🐈", game: "🎮", hug: "🤗", punch: "🥊", relax: "🛋️", lift: "🏋️" };

// Îlot → pôle (pour ouvrir le bon tableau de bord quand on touche un îlot).
const POD_DEPT = new Map();
for (const dept of ["vente", "sourcing", "social", "direction", "organisation", "tech", "createurs"]) {
  for (const index of DEPT_PODS[dept] || []) if (!POD_DEPT.has(index)) POD_DEPT.set(index, dept);
}
const DEPT_PANEL = { direction: "director", vente: "vente", sourcing: "sourcing", social: "social", organisation: "openspace", tech: "studio", createurs: "createurs" };

// Petits objets perdus des quêtes « cache-cache ».
function questItemMesh(kind) {
  const g = new THREE.Group();
  const add = (geo, color, x = 0, y = 0, z = 0, extra = {}) => {
    const m = new THREE.Mesh(geo, mat(color, extra));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  switch (kind) {
    case "tupperware":
      add(new THREE.BoxGeometry(0.22, 0.09, 0.16), "#e8f4ff", 0, 0.045, 0, { transparent: true, opacity: 0.8 });
      add(new THREE.BoxGeometry(0.23, 0.02, 0.17), "#3a86ff", 0, 0.1, 0);
      add(new THREE.BoxGeometry(0.16, 0.04, 0.1), "#c1121f", 0, 0.04, 0);
      break;
    case "stapler":
      add(new THREE.BoxGeometry(0.18, 0.03, 0.05), "#2b2b2b", 0, 0.015, 0);
      add(new THREE.BoxGeometry(0.17, 0.035, 0.045), "#e63946", 0.005, 0.05, 0).rotation.z = 0.12;
      break;
    case "headphones": {
      const band = add(new THREE.TorusGeometry(0.09, 0.015, 6, 16, Math.PI), "#ff4d8d", 0, 0.06, 0);
      band.rotation.y = Math.PI / 2;
      for (const sz of [-0.09, 0.09]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12), "#ff4d8d", 0, 0.06, sz).rotation.x = Math.PI / 2;
      break;
    }
    case "keys":
      add(new THREE.TorusGeometry(0.04, 0.008, 6, 14), "#c9a227", 0, 0.01, 0, { metalness: 0.7, roughness: 0.3 }).rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.09, 0.01, 0.025), "#adb5bd", 0.07, 0.01, 0, { metalness: 0.7, roughness: 0.3 });
      add(new THREE.BoxGeometry(0.08, 0.01, 0.02), "#c9a227", 0.05, 0.012, 0.04, { metalness: 0.7, roughness: 0.3 }).rotation.y = 0.6;
      break;
    case "lens":
      add(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 14), "#1b1b1b", 0, 0.05, 0);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 14), "#4cc9f0", 0, 0.105, 0, { metalness: 0.6, roughness: 0.1 });
      break;
    case "plush":
      add(new THREE.SphereGeometry(0.07, 12, 10), "#a0703f", 0, 0.07, 0);
      add(new THREE.SphereGeometry(0.05, 12, 10), "#a0703f", 0, 0.16, 0.01);
      for (const sx of [-0.04, 0.04]) add(new THREE.SphereGeometry(0.02, 8, 6), "#7f5539", sx, 0.205, 0);
      break;
    case "drive":
      add(new THREE.BoxGeometry(0.13, 0.03, 0.09), "#212529", 0, 0.015, 0);
      add(new THREE.BoxGeometry(0.015, 0.01, 0.015), "#4cc38a", 0.05, 0.034, 0.03);
      break;
    default:
      add(new THREE.BoxGeometry(0.08, 0.005, 0.11), "#ffffff", 0, 0.005, 0);
      add(new THREE.BoxGeometry(0.06, 0.006, 0.04), "#5aa9e6", 0, 0.008, -0.02);
      add(new THREE.TorusGeometry(0.06, 0.006, 4, 16), "#e63946", 0, 0.004, 0.09).rotation.x = Math.PI / 2;
  }
  return g;
}

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
  constructor(world, id, person) {
    this.world = world;
    this.agentId = id;
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

  update() {
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
      d.trip?.onStart?.();
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
  constructor(container, { now, onSelectPanel, onSelectAgent, onLife, onInterview, onCat, onQuestFound, onFloorRoom, onFloorPerson }) {
    this.container = container;
    this.onFloorRoom = onFloorRoom;
    this.onFloorPerson = onFloorPerson;
    this.floor = null; // étage du Bâtiment 0 affiché à la place du QG (null = le QG)
    this.now = now;
    this.onSelectPanel = onSelectPanel;
    this.onSelectAgent = onSelectAgent;
    this.onLife = onLife;
    this.onInterview = onInterview;
    this.onCat = onCat;
    this.onQuestFound = onQuestFound;
    this.questItems = new Map();
    this.floorMess = new Map();
    this.confettiFx = null;
    this.lastIncidentAt = 0;
    this.actors = new Map();
    this.npcs = new Map();
    this.mess = new Map();
    this.trophies = new Map();
    this.whiteboardText = null;
    this.documentary = true;
    this.prev = null;
    this.state = null;
    this.selected = null;
    this.tween = null;
    this.clock = new THREE.Clock();
    this.lastFrame = 0;
    this.perf = { frames: 0, since: 0, level: 0 };
    this.seats = new Map();
    for (const list of Object.values(ROOM_DESKS)) for (const seat of list) this.seats.set(seat.id, seat);
    for (const pod of PODS) for (const seat of pod.seats) this.seats.set(seat.id, seat);
  }

  init() {
    const renderer = new THREE.WebGLRenderer({ antialias: !IS_TOUCH || devicePixelRatio < 2, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.6 : 1.75));
    try {
      this.perf.level = Number(localStorage.getItem("qg-quality-level")) || 0;
    } catch {
      // niveau par défaut
    }
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
    scene.fog = new THREE.Fog("#0e1120", 90, 180);
    this.scene = scene;

    // Néons de bureau : lumière froide et uniforme, comme dans la série.
    this.hemi = new THREE.HemisphereLight("#eef3ff", "#5b5146", 1.25);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight("#fff6e6", 2.0);
    sun.position.set(CENTER_X + 16, 34, 20);
    sun.target.position.set(CENTER_X, 0, 0);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(IS_TOUCH ? 2048 : 2560, IS_TOUCH ? 2048 : 2560);
    Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 24, bottom: -24, near: 1, far: 110 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    this.sun = sun;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 260);
    const controls = new MapControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 6;
    controls.maxDistance = 140;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.25;
    controls.zoomToCursor = true;
    this.controls = controls;

    this.nav = new NavGrid();
    this.office = buildOffice(scene, this.nav);
    for (let level = 1; level <= this.perf.level; level++) this.applyQuality(level);
    // Le décor ne bouge pas et les personnages ont des ombres "blob" : la carte d'ombres est calculée une fois.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    this.messRoot = new THREE.Group();
    scene.add(this.messRoot);
    this.crowd = new Crowd(scene);

    this.buildTags();
    this.selectRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 40), new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.9 }));
    this.selectRing.rotation.x = Math.PI / 2;
    this.selectRing.visible = false;
    scene.add(this.selectRing);

    this.boss = new Person({ id: "boss", look: BOSS_LOOK, isBoss: true, onClick: () => this.onSelectPanel?.("director") });
    this.boss.setName("Toi");
    this.boss.place(SPOTS.entrance);
    scene.add(this.boss.root);
    this.crowd.add(this.boss.root);

    this.spawnNpc("courier", COURIER_LOOK, "delivery-bag", "Livreur", { ...SPOTS.entranceOut }, false);
    this.spawnNpc("cameraman", CAMERAMAN_LOOK, "tv-camera", "Équipe de tournage", { x: 24.6, z: 7.9, facing: Math.PI, standing: true }, true);
    this.life = new LifeDirector(this);
    this.cats = new CatHerd(this);
    this.installBubbles();
    this.drawStaticScreens();

    this.installPicking();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    new ResizeObserver(() => this.resize()).observe(this.container);
    this.applyDaylight();
    setInterval(() => this.applyDaylight(), 60000);
    setInterval(() => this.drawScreens(), 1000);
    this.drawWhiteboard();
    this.overview(false);
    renderer.setAnimationLoop((t) => this.frame(t));
  }

  spawnNpc(id, look, accessory, label, home, visible) {
    const person = new Person({ id: `npc:${id}`, look, accessory });
    person.setName(label);
    person.setStatus({ emoji: id === "courier" ? "🛵" : "🎥" });
    person.place(home);
    person.root.visible = visible;
    this.scene.add(person.root);
    this.crowd.add(person.root);
    const actor = new Actor(this, `npc:${id}`, person);
    actor.home = home;
    this.npcs.set(id, actor);
    return actor;
  }

  // ------------------------------------------------------------------ caméra

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.floorLabels?.setSize(w, h);
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
        const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
        t.addScaledVector(right, distance * 0.22);
      } else {
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
    this.tween = { t0: performance.now(), dur: 900, fromTarget: this.controls.target.clone(), fromPos: this.camera.position.clone(), toTarget: view.target, toPos: view.position };
  }

  // Emprise de ce qui est affiché : le QG, ou l'étage du Bâtiment visité.
  get activeBounds() {
    return this.floor ? this.floor.bounds : BOUNDS;
  }

  overview(animate = true) {
    // Distance minimale pour que tout l'étage (murs compris) tienne entre le HUD et le dock.
    const B = this.activeBounds;
    const cx = (B.minX + B.maxX) / 2;
    const cz = this.floor ? (B.minZ + B.maxZ) / 2 : 0;
    const target = new THREE.Vector3(cx + (this.portrait ? 0.6 : 0), 0, cz + (this.portrait ? 0.5 : 1));
    const corners = [];
    for (const [x, z] of [[B.minX, B.minZ], [B.maxX, B.minZ], [B.maxX, B.maxZ], [B.minX, B.maxZ]]) {
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
    let hi = 200;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    this.flyTo(this.viewFor(target, hi, false), animate);
  }

  focusPoint(x, z, dist, sheet, visit = null) {
    this.flyTo(this.viewFor(new THREE.Vector3(x, 0, z), dist, sheet));
    if (visit) this.walkBoss(visit);
  }

  focusPanel(panelId, sheet = true) {
    const panel = PANELS[panelId];
    if (!panel) return;
    this.selected = null;
    if (panelId === "openspace") {
      this.focusPoint(0, 0, 30, sheet, { x: AREAS.openspace.visit[0], z: AREAS.openspace.visit[1] });
    } else if (panelId === "quests") {
      this.focusPoint(EOTM_TOTEM.x + 2, EOTM_TOTEM.z, 14, sheet, { x: EOTM_TOTEM.x + 1.8, z: EOTM_TOTEM.z + 2.2 });
    } else if (panel.dept && (panelId === "sourcing" || panelId === "vente")) {
      const a = deptAnchor(panel.dept);
      this.focusPoint(a.x, a.z, 17, sheet, { x: a.x, z: a.z + 2.6 });
    } else if (panel.area && AREAS[panel.area]) {
      const area = AREAS[panel.area];
      this.focusPoint(area.focus[0], area.focus[1], 15, sheet, { x: area.visit[0], z: area.visit[1] });
    }
    this.highlight(panelId);
  }

  focusAgent(agentId, sheet = true) {
    const actor = this.actors.get(agentId);
    if (!actor) return;
    const p = actor.person.root.position;
    this.flyTo(this.viewFor(new THREE.Vector3(p.x, 0, p.z), 11, sheet));
    this.selected = agentId;
    this.highlight(null);
  }

  clearSelection() {
    this.selected = null;
    this.highlight(null);
    this.floor?.select(null);
  }

  // ---------------------------------------------------------------- étages du Bâtiment 0

  get inFloor() {
    return !!this.floor;
  }

  // Affiche un étage (données réelles du monde) à la place du QG, avec le même rendu et la même caméra.
  enterFloor(data, { arriving = null } = {}) {
    if (this.floor?.id === data.id) {
      this.floor.apply(data);
      return;
    }
    const savedView = this.floor ? this.savedView : { target: this.controls.target.clone(), position: this.camera.position.clone() };
    this.disposeFloor();
    this.savedView = savedView;
    this.floor = new FloorScene(data, { onSelectRoom: (id) => this.onFloorRoom?.(id), onSelectPerson: (id) => this.onFloorPerson?.(id), arriving });
    if (!this.floorLabels) {
      this.floorLabels = new CSS2DRenderer();
      this.floorLabels.domElement.className = "label-layer floor-labels";
      Object.assign(this.floorLabels.domElement.style, { position: "absolute", top: "0", left: "0" });
      this.container.appendChild(this.floorLabels.domElement);
      this.floorLabels.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    }
    this.floorLabels.domElement.style.display = "";
    this.labels.domElement.style.display = "none";
    this.selected = null;
    this.tween = null;
    this.renderer.shadowMap.needsUpdate = true;
    this.overview(false);
  }

  updateFloor(data) {
    if (this.floor?.id === data.id) this.floor.apply(data);
  }

  leaveFloor() {
    if (!this.floor) return;
    this.disposeFloor();
    this.labels.domElement.style.display = "";
    if (this.floorLabels) this.floorLabels.domElement.style.display = "none";
    this.tween = null;
    if (this.savedView) this.flyTo(this.savedView, false);
    else this.overview(false);
    this.savedView = null;
  }

  disposeFloor() {
    this.floor?.dispose();
    this.floor = null;
    this.followShift = null;
  }

  focusFloorRoom(roomId, sheet = true) {
    const c = this.floor?.roomCenter(roomId);
    if (!c) return;
    this.floor.select(null);
    this.flyTo(this.viewFor(c, 15, sheet));
  }

  // Caméra de suivi : elle garde la personne au centre (zoom et rotation restent libres).
  followPerson(id, sheet = false) {
    this.followId = id;
    this.followSheet(sheet);
  }

  followSheet(sheet) {
    const p = this.followId && this.floor?.positionOf(this.followId);
    if (!p) return;
    const base = new THREE.Vector3(p.x, 0, p.z);
    const view = this.viewFor(base, 10, sheet);
    this.followShift = view.target.clone().sub(base);
    this.floor.select(this.followId);
    this.flyTo(view);
  }

  stopFollow() {
    this.followId = null;
    this.followShift = null;
  }

  focusFloorPerson(id, sheet = true) {
    const p = this.floor?.positionOf(id);
    if (!p) return false;
    this.floor.select(id);
    this.flyTo(this.viewFor(new THREE.Vector3(p.x, 0, p.z), 9, sheet));
    return true;
  }

  // ---------------------------------------------------------------- étiquettes et sélection

  buildTags() {
    this.roomTags = {};
    const tag = (html, color, position, onClick, className = "room-tag") => {
      const el = document.createElement("div");
      el.className = className;
      el.style.setProperty("--room", color);
      el.innerHTML = html;
      el.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        onClick();
      });
      const obj = new CSS2DObject(el);
      obj.position.copy(position);
      this.scene.add(obj);
      return el;
    };
    for (const [id, room] of Object.entries(ROOMS)) {
      const area = AREAS[id];
      if (!area?.label) continue;
      this.roomTags[id] = tag(
        `<span>${room.icon}</span><span>${room.tag || room.name}</span><span class="count" hidden></span>`,
        room.color,
        new THREE.Vector3(area.label[0], 3.1, area.label[1]),
        () => this.onSelectPanel?.(room.panel)
      );
      this.roomTags[id].dataset.panel = room.panel;
    }
    for (const [dept, panel] of Object.entries(DEPT_SIGNS)) {
      const anchor = deptAnchor(dept);
      const d = DEPARTMENTS[dept];
      if (!anchor) continue;
      const el = tag(`<span>${d.icon}</span><span>${d.label}</span>`, d.color, new THREE.Vector3(anchor.x, 2.55, anchor.z), () => this.onSelectPanel?.(panel), "room-tag dept-tag");
      el.dataset.panel = panel;
      this.roomTags[`dept:${dept}`] = el;
    }
    const pod = PODS[INTERN_POD];
    const interns = tag(`<span>🧃</span><span>Stagiaires</span>`, "#06d6a0", new THREE.Vector3(pod.x, 2.55, pod.z), () => this.onSelectPanel?.("rh"), "room-tag dept-tag");
    interns.dataset.panel = "rh";
    this.roomTags["dept:interns"] = interns;
    const eotm = tag(`<span>🏆</span><span>Employé du mois</span>`, "#f7c948", new THREE.Vector3(EOTM_TOTEM.x, 3.05, EOTM_TOTEM.z - 0.1), () => this.onSelectPanel?.("quests"), "room-tag dept-tag eotm-tag");
    eotm.dataset.panel = "quests";
    this.roomTags["eotm"] = eotm;
  }

  highlight(panelId) {
    for (const el of Object.values(this.roomTags)) el.classList.toggle("active", !!panelId && el.dataset.panel === panelId);
  }

  setBadge(roomId, count) {
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
      if (this.floor) {
        const hit = this.floor.pick(raycaster);
        if (hit?.type === "person") this.onFloorPerson?.(hit.id);
        else if (hit?.type === "room") this.onFloorRoom?.(hit.id);
        return;
      }
      // Objets perdus des quêtes, puis chats, puis employés.
      const itemHit = raycaster.intersectObjects([...this.questItems.values()].map((i) => i.hit), false)[0];
      if (itemHit) {
        this.onQuestFound?.(itemHit.object.userData.questId, itemHit.object.userData.spotId);
        return;
      }
      const catId = this.cats?.pick(raycaster);
      if (catId) {
        this.onCat?.(catId);
        return;
      }
      const hitboxes = [...this.actors.values()].map((a) => a.person.hitbox);
      const agentHit = raycaster.intersectObjects(hitboxes, false)[0];
      if (agentHit) {
        this.onSelectAgent?.(agentHit.object.userData.agentId);
        return;
      }
      // Projection sur le sol puis lecture du plan : rapide, même avec un décor fusionné.
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), point)) return;
      const inRect = ([x0, z0, x1, z1]) => point.x >= x0 && point.x <= x1 && point.z >= z0 && point.z <= z1;
      const roomId = Object.keys(AREAS).find((id) => id !== "openspace" && inRect(AREAS[id].rect));
      if (roomId && ROOMS[roomId]) {
        this.onSelectPanel?.(ROOMS[roomId].panel);
        return;
      }
      const pod = PODS.find((p) => Math.abs(point.x - p.x) < 1.7 && Math.abs(point.z - p.z) < 1.7);
      if (pod?.index === INTERN_POD) {
        this.onSelectPanel?.("rh");
        return;
      }
      if (pod && POD_DEPT.has(pod.index)) {
        this.onSelectPanel?.(DEPT_PANEL[POD_DEPT.get(pod.index)]);
        return;
      }
      this.walkBoss({ x: THREE.MathUtils.clamp(point.x, BOUNDS.minX + 0.5, BOUNDS.maxX - 0.5), z: THREE.MathUtils.clamp(point.z, BOUNDS.minZ + 0.5, BOUNDS.maxZ - 0.5) });
    });
  }

  walkBoss(spot) {
    const p = this.boss.root.position;
    this.boss.walk(this.nav.findPath([p.x, p.z], [spot.x, spot.z]), { x: spot.x, z: spot.z, standing: true }, () => {
      this.boss.activity = "idle";
    });
  }

  // ------------------------------------------------------------ désordre, tableau blanc, gâteau

  seatById(id) {
    return this.seats.get(id) || null;
  }

  hasMess(seatId) {
    return this.mess.has(seatId);
  }

  messCount() {
    return this.mess.size;
  }

  messyDesks() {
    return [...this.mess.keys()];
  }

  addMess(seatId, kind) {
    const seat = this.seatById(seatId);
    if (!seat || this.mess.has(seatId)) return;
    const top = deskTop(seat);
    const g = new THREE.Group();
    g.position.set(top.x, 0.78, top.z);
    g.rotation.y = seat.facing;
    if (kind === "trash") {
      const paper = mat("#f4f1e8");
      for (let i = 0; i < 9; i++) {
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + Math.random() * 0.03, 0), paper);
        ball.position.set((Math.random() - 0.5) * 1.1, 0.04, (Math.random() - 0.5) * 0.5);
        g.add(ball);
      }
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), mat("#c1121f"));
      can.position.set(0.3, 0.05, -0.1);
      can.rotation.z = Math.PI / 2;
      g.add(can);
    } else if (kind === "jelly") {
      const jelly = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.2), new THREE.MeshStandardMaterial({ color: "#ffd60a", transparent: true, opacity: 0.6, roughness: 0.15 }));
      jelly.position.set(-0.4, 0.08, -0.05);
      g.add(jelly);
      const stapler = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), mat("#1b1b1b"));
      stapler.position.set(-0.4, 0.08, -0.05);
      g.add(stapler);
    } else if (kind === "postit") {
      const colors = ["#ffe066", "#ff8fab", "#8ecae6", "#b9fbc0"];
      for (let i = 0; i < 12; i++) {
        const note = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshStandardMaterial({ color: colors[i % 4], side: THREE.DoubleSide }));
        note.position.set(-0.26 + (i % 4) * 0.17 + (Math.random() - 0.5) * 0.02, 0.22 + Math.floor(i / 4) * 0.11, 0.155);
        note.rotation.set(0, Math.PI, (Math.random() - 0.5) * 0.4);
        g.add(note);
      }
    }
    this.messRoot.add(g);
    this.mess.set(seatId, g);
  }

  clearMess(seatId) {
    const g = this.mess.get(seatId);
    if (!g) return;
    g.removeFromParent();
    g.traverse((o) => o.geometry?.dispose());
    this.mess.delete(seatId);
  }

  spillChili(x, z) {
    this.clearFloorMess("chili");
    const g = new THREE.Group();
    g.position.set(x, 0.015, z);
    const sauce = mat("#7a2e12", { roughness: 0.35 });
    for (let i = 0; i < 6; i++) {
      const blob = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.2, 14), sauce);
      blob.rotation.x = -Math.PI / 2;
      blob.position.set((Math.random() - 0.5) * 0.9, i * 0.001, (Math.random() - 0.5) * 0.7);
      g.add(blob);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.18, 14), mat("#495057", { metalness: 0.5 }));
    pot.rotation.z = Math.PI / 2;
    pot.position.set(0.45, 0.09, 0.1);
    g.add(pot);
    this.messRoot.add(g);
    this.floorMess.set("chili", { group: g, x, z });
  }

  clearFloorMess(key) {
    const m = this.floorMess.get(key);
    if (!m) return;
    m.group.removeFromParent();
    m.group.traverse((o) => o.geometry?.dispose());
    this.floorMess.delete(key);
  }

  celebrate() {
    const t = this.controls.target;
    this.confetti(t.x, t.z);
  }

  confetti(x, z) {
    if (this.confettiFx) this.confettiFx.mesh.removeFromParent();
    const count = 90;
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.08, 0.05), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), count);
    const colors = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#9b5de5", "#ffffff"];
    const color = new THREE.Color();
    const items = [];
    for (let i = 0; i < count; i++) {
      mesh.setColorAt(i, color.set(colors[i % colors.length]));
      items.push({
        p: new THREE.Vector3(x + (Math.random() - 0.5) * 4, 2.6 + Math.random() * 1.2, z + (Math.random() - 0.5) * 3),
        v: new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.5 - Math.random() * 0.5, (Math.random() - 0.5) * 0.4),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
        s: 2 + Math.random() * 4,
      });
    }
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.confettiFx = { mesh, items, until: performance.now() + 7000 };
  }

  updateConfetti(dt) {
    const fx = this.confettiFx;
    if (!fx) return;
    if (performance.now() > fx.until) {
      fx.mesh.removeFromParent();
      fx.mesh.geometry.dispose();
      this.confettiFx = null;
      return;
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    fx.items.forEach((it, i) => {
      if (it.p.y > 0.02) {
        it.p.addScaledVector(it.v, dt);
        it.r.x += it.s * dt;
        it.r.y += it.s * 0.7 * dt;
      }
      m4.compose(it.p, q.setFromEuler(it.r), one);
      fx.mesh.setMatrixAt(i, m4);
    });
    fx.mesh.instanceMatrix.needsUpdate = true;
  }

  writeWhiteboard(text, author) {
    this.whiteboardText = { text, author };
    this.drawWhiteboard();
  }

  eraseWhiteboard() {
    this.whiteboardText = null;
    this.drawWhiteboard();
  }

  drawWhiteboard() {
    const board = this.office.screens.whiteboard;
    const wb = this.whiteboardText;
    board.draw((ctx, W, H) => {
      ctx.fillStyle = "#fbfbf7";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#c9c9c9";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
      ctx.fillStyle = "#9aa0a6";
      ctx.font = "600 22px system-ui, sans-serif";
      ctx.fillText("CUISINE — merci de laver vos tasses", 20, 36);
      if (!wb) return;
      ctx.save();
      ctx.translate(W / 2, H / 2 + 20);
      ctx.rotate(-0.04);
      ctx.fillStyle = ["#d00000", "#0057b7", "#1b7f3b"][wb.text.length % 3];
      ctx.textAlign = "center";
      let size = 64;
      ctx.font = `700 ${size}px "Permanent Marker", "Comic Sans MS", cursive`;
      while (ctx.measureText(wb.text).width > W - 60 && size > 26) {
        size -= 4;
        ctx.font = `700 ${size}px "Permanent Marker", "Comic Sans MS", cursive`;
      }
      ctx.fillText(wb.text, 0, 0);
      ctx.restore();
    });
  }

  showCake(visible) {
    if (this.office.screens.cake) this.office.screens.cake.visible = visible;
  }

  giveTrophy(agentId) {
    for (const g of this.trophies.values()) g.removeFromParent();
    this.trophies.clear();
    const seat = this.actors.get(agentId)?.home;
    if (!seat || seat.standing) return;
    const top = deskTop(seat);
    const g = new THREE.Group();
    const gold = mat("#f7c948", { metalness: 0.7, roughness: 0.25, emissive: "#5c4400", emissiveIntensity: 0.4 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.12, 12), gold);
    cup.position.y = 0.16;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 6), gold);
    stem.position.y = 0.06;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), mat("#3a2219"));
    g.add(cup, stem, base);
    g.position.set(top.x - top.fz * 0.5, 0.78, top.z + top.fx * 0.5);
    this.messRoot.add(g);
    this.trophies.set(agentId, g);
  }

  triggerLife(kind) {
    const map = {
      party: "party", fireDrill: "fireDrill", teamLunch: "teamLunch", dundies: "dundies", clean: "ev_clean", prank: "ev_prankBoard", meeting: "ev_bossMeeting",
      catTime: "catTime", gymClass: "gymClass", karate: "ev_karate", gaming: "ev_gaming", chili: "ev_chili", internCoffee: "ev_internCoffee",
    };
    const fn = this.life?.[map[kind]];
    return fn ? fn.call(this.life, true) !== false : false;
  }

  // ------------------------------------------------------------ synchronisation avec l'état

  sync(state) {
    const prev = this.prev;
    this.state = state;
    this.boss.setName(state.boss?.name ? `${state.boss.name} (toi)` : "Toi");

    const ordered = [...state.agents].sort((a, b) => (b.builtin === true) - (a.builtin === true) || a.hiredAt - b.hiredAt);
    const homes = assignDesks(ordered);
    const ids = new Set(state.agents.map((a) => a.id));
    for (const [id, actor] of this.actors) {
      if (!ids.has(id)) {
        this.crowd.remove(actor.person.root);
        actor.person.dispose();
        this.actors.delete(id);
      }
    }
    for (const agent of state.agents) {
      let actor = this.actors.get(agent.id);
      if (!actor) {
        const person = new Person({ id: agent.id, look: agent.look || {}, accessory: roleOf(agent).accessory, onClick: (id) => this.onSelectAgent?.(id) });
        actor = new Actor(this, agent.id, person);
        this.actors.set(agent.id, actor);
        this.scene.add(person.root);
        this.crowd.add(person.root);
        const home = homes.get(agent.id);
        if (prev) {
          person.place({ ...SPOTS.entrance });
          actor.trip.push({ spot: { ...SPOTS.entrance }, activity: "wave", dwell: 1400, onArrive: () => person.say("Bonjour tout le monde ! 👋") });
        } else {
          person.place(home);
        }
      }
      actor.home = homes.get(agent.id);
      actor.person.setName(agent.name);
    }

    const meeting = liveMeeting(state);
    const attendees = meeting ? meeting.attendees : [];
    for (const actor of this.actors.values()) {
      const idx = attendees.indexOf(actor.agentId);
      actor.meetingSeat = idx >= 0 ? MEETING_SEATS[idx % MEETING_SEATS.length] : null;
    }
    if (meeting && prev && !liveMeeting(prev)) {
      for (const id of attendees) this.actors.get(id)?.person.say("🗣️ J'arrive en réunion !", 2500);
    }

    const working = new Set(state.tasks.filter((t) => t.status === "working").map((t) => t.agentId));
    for (const actor of this.actors.values()) actor.working = working.has(actor.agentId);

    this.cats.sync(state.life?.cats || []);
    this.cats.syncQuests(state);
    this.syncQuestItems(state);
    if (prev) this.reactToChanges(prev, state);
    this.prev = state;
    this.updateTags();
    this.updateMonitors();
    this.drawScreens();
  }

  // ------------------------------------------------------------ objets perdus (quêtes)

  syncQuestItems(state) {
    const open = (state.life?.round?.quests || []).filter((q) => q.kind === "seek" && q.status === "open" && q.item?.id !== "cat");
    const keep = new Set(open.map((q) => q.id));
    for (const [id, item] of this.questItems) {
      if (keep.has(id)) continue;
      item.group.removeFromParent();
      this.questItems.delete(id);
    }
    for (const quest of open) {
      if (this.questItems.has(quest.id)) continue;
      const spot = HIDING_SPOTS.find((s) => s.id === quest.spotId);
      if (!spot) continue;
      const group = new THREE.Group();
      group.position.set(spot.x, spot.y, spot.z);
      group.add(questItemMesh(quest.item.id));
      const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), new THREE.MeshBasicMaterial({ color: "#fff3b0", toneMapped: false }));
      sparkle.position.y = 0.22;
      group.add(sparkle);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.08;
      hit.userData = { questId: quest.id, spotId: spot.id };
      group.add(hit);
      this.scene.add(group);
      this.questItems.set(quest.id, { group, hit, sparkle, base: spot.y });
    }
  }

  // ------------------------------------------------------------ bulles de dialogue propres

  installBubbles() {
    const limit = () => (this.container.clientWidth < 700 ? 3 : 5);
    Person.gate = (person, prio) => {
      if (prio >= 2) return true;
      if (prio === 0 && this.compactTags) return false;
      const talking = [...this.actors.values(), ...this.npcs.values()].map((a) => a.person).filter((p) => p !== person && p.talking);
      if (talking.length < limit()) return true;
      const weakest = talking.sort((a, b) => a.bubblePrio - b.bubblePrio || a.bubbleSince - b.bubbleSince)[0];
      if (weakest.bubblePrio >= prio && prio < 1) return false;
      weakest.hideBubble();
      return true;
    };
    setInterval(() => this.layoutBubbles(), 180);
  }

  // Empile les bulles qui se chevauchent au lieu de les superposer.
  layoutBubbles() {
    const bubbles = [...this.labels.domElement.querySelectorAll(".tag-bubble:not([hidden])")];
    if (bubbles.length < 2) {
      for (const b of bubbles) b.style.removeProperty("--lift");
      return;
    }
    const boxes = bubbles.map((el) => {
      const lift = Number.parseFloat(el.style.getPropertyValue("--lift")) || 0;
      const r = el.getBoundingClientRect();
      return { el, left: r.left, right: r.right, top: r.top - lift, bottom: r.bottom - lift, lift: 0 };
    }).sort((a, b) => b.bottom - a.bottom);
    const placed = [];
    for (const box of boxes) {
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find((o) => box.left < o.right && box.right > o.left && box.top + box.lift < o.bottom + o.lift && box.bottom + box.lift > o.top + o.lift);
        if (!hit) break;
        box.lift = hit.top + hit.lift - box.bottom - 4;
      }
      placed.push(box);
      if (box.lift) box.el.style.setProperty("--lift", `${Math.round(box.lift)}px`);
      else box.el.style.removeProperty("--lift");
    }
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
        if (manager && manager !== actor && !manager.meetingSeat && !manager.trip.length && actor.home && !actor.home.standing) {
          manager.trip.push({ spot: sideSpot(actor.home), activity: "talk", dwell: 2600, onArrive: () => manager.person.say("Nouvelle mission pour toi 👇", 2400) });
        }
        continue;
      }
      if (old.status === task.status) continue;
      if (old.status === "working" && (task.status === "done" || task.status === "review")) {
        if (task.type === "cleaning") {
          actor.person.say("🧹 Ménage terminé, cache vidé ✨", 3000);
          continue;
        }
        actor.trip.push({ spot: SPOTS.libraryDrop, activity: "drop", dwell: 1800, onArrive: () => actor.person.say("📦 Livré aux archives", 2200) });
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
        actor.person.say(task.type === "cleaning" ? "🧹 C'est parti pour le grand ménage" : "💪 Je m'y mets", 1800);
        if (task.type === "cleaning") this.life?.ev_clean(true);
      }
    }
    if (state.events.length > prev.events.length) this.actors.get("secretary")?.person.say("📅 C'est noté au planning", 2600);
    const manualDocs = state.documents.filter((d) => d.authorId === "boss").length;
    if (manualDocs > prev.documents.filter((d) => d.authorId === "boss").length) this.actors.get("librarian")?.person.say("📚 Rangé et étiqueté", 2600);
    if (state.director?.briefStatus === "writing" && prev.director?.briefStatus !== "writing") this.actors.get("director")?.person.say("🧭 Je rédige le brief…", 3000);
    const summarizing = state.meetings.find((m) => m.status === "summarizing");
    if (summarizing && !prev.meetings.find((m) => m.id === summarizing.id && m.status === "summarizing")) {
      this.actors.get(summarizing.attendees[0])?.person.say("📝 Je rédige le compte rendu", 3000);
    }
    const seen = new Set((prev.life?.stories || []).map((s) => s.id));
    for (const story of state.life?.stories || []) if (!seen.has(story.id)) this.life?.onStory(story);
    const oldRound = prev.life?.round;
    const round = state.life?.round;
    if (round?.winnerId && oldRound?.id === round.id && !oldRound.winnerId) this.life?.ceremony(round.winnerId);
    const newDeals = (state.deals || []).length - (prev.deals || []).length;
    if (newDeals > 0) {
      const deal = state.deals.at(-1);
      this.actors.get(deal?.hunterId)?.person.say(`🔎 Bon plan déniché : ${deal.title.slice(0, 34)}`, 3500);
    }
  }

  updateTags() {
    const state = this.state;
    if (!state) return;
    const now = this.now();
    const meeting = liveMeeting(state);
    const champion = state.life?.hall?.[0]?.agentId;
    for (const actor of this.actors.values()) {
      const task = state.tasks.find((t) => t.agentId === actor.agentId && t.status === "working");
      let emoji = "";
      let progress = null;
      const tripActivity = actor.trip[0]?.activity;
      if (meeting?.attendees.includes(actor.agentId)) emoji = "🗣️";
      else if (TRIP_EMOJI[tripActivity]) emoji = TRIP_EMOJI[tripActivity];
      else if (task) {
        emoji = TASK_TYPES[task.type]?.icon || "💼";
        progress = taskProgress(task, now);
      }
      const agent = state.agents.find((a) => a.id === actor.agentId);
      if (!emoji && agent) emoji = ROLES[agent.role]?.icon || "";
      actor.person.setStatus({ emoji, progress, compact: this.compactTags });
      actor.person.setBadge(champion === actor.agentId ? "🏆" : "");
    }
    const k = computeKpis(state, now);
    this.setBadge("director", k.review);
    this.setBadge("meeting", meeting ? "●" : 0);
    this.setBadge("library", (state.trash || []).length ? "🗑️" : 0);
  }

  updateMonitors() {
    const lit = new Set();
    for (const actor of this.actors.values()) if (actor.working && actor.home) lit.add(actor.home.id);
    this.office.monitors.set(lit);
  }

  // ---------------------------------------------------------------- écrans muraux

  // Écrans au contenu fixe (dessinés une seule fois).
  drawStaticScreens() {
    const s = this.office.screens;
    s.moodboard?.draw((ctx, W, H) => {
      ctx.fillStyle = "#c69c6d";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      const colors = ["#ff8a5b", "#f7c948", "#06d6a0", "#118ab2", "#ef476f", "#8338ec"];
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(24 + i * 46, 24, 40, 40);
      });
      const notes = [["#fff3b0", "HOOK EN 3 S"], ["#ffc8dd", "UGC > PUB"], ["#bde0fe", "FOND UNI"], ["#caffbf", "TEST A/B"]];
      notes.forEach(([c, t], i) => {
        ctx.save();
        ctx.translate(40 + i * 140, 120 + (i % 2) * 40);
        ctx.rotate((i % 2 ? 1 : -1) * 0.06);
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 120, 100);
        ctx.fillStyle = "#333";
        ctx.font = "700 18px system-ui, sans-serif";
        ctx.fillText(t, 10, 56);
        ctx.restore();
      });
      ctx.fillStyle = "#fff";
      ctx.fillRect(W - 170, 30, 140, 120);
      ctx.fillStyle = "#ffb4a2";
      ctx.fillRect(W - 160, 40, 120, 80);
      ctx.fillStyle = "#333";
      ctx.font = "700 16px system-ui, sans-serif";
      ctx.fillText("MOODBOARD", W - 155, 140);
    });
    s.interns?.draw((ctx, W, H) => {
      ctx.fillStyle = "#fffdf5";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#06d6a0";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.fillStyle = "#1b1f33";
      ctx.font = "800 34px system-ui, sans-serif";
      ctx.fillText("🧃 STAGIAIRES", 18, 50);
      ctx.font = "600 18px system-ui, sans-serif";
      ctx.fillText("Merci de ne pas les nourrir après 18 h", 20, 84);
    });
  }

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
      ctx.fillText((state.settings?.companyName || "TABLEAU DE BORD").toUpperCase().slice(0, 28), 28, 50);
      const tiles = [["En cours", k.working, "#4cc38a"], ["À valider", k.review, k.review ? "#ef5d6c" : "#9aa3c0"], ["Livrées auj.", k.doneToday, "#5aa9e6"], ["Bons plans", (state.deals || []).length, "#2ec4b6"]];
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
    s.meeting.draw((ctx, W) => {
      ctx.fillStyle = meeting ? "#1a1030" : "#0f1a2b";
      ctx.fillRect(0, 0, W, 9999);
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
      ctx.font = font(30, 800);
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
      const cols = [["À FAIRE", "queued", "#ffe08a"], ["EN COURS", "working", "#b6f0d0"], ["À VALIDER", "review", "#ffc9a8"], ["TERMINÉ", "done", "#c9e3ff"]];
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

    const progressScreen = (screen, title, color, type, idleText, doneText) => {
      const task = state.tasks.find((t) => t.type === type && t.status === "working");
      screen.draw((ctx, W, H) => {
        ctx.fillStyle = "#14102b";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = color;
        ctx.font = font(Math.round(H * 0.11), 800);
        ctx.fillText(title, 24, H * 0.18);
        ctx.fillStyle = "#fff";
        ctx.font = font(Math.round(H * 0.12), 800);
        if (task) {
          const p = taskProgress(task, now);
          ctx.fillText(ellipsis(ctx, task.title, W - 48), 24, H * 0.46);
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(24, H * 0.6, W - 48, H * 0.08);
          ctx.fillStyle = "#4cc38a";
          ctx.fillRect(24, H * 0.6, (W - 48) * p, H * 0.08);
          ctx.fillStyle = "#c9cfe6";
          ctx.font = font(Math.round(H * 0.09), 700);
          ctx.fillText(`${Math.round(p * 100)} %`, 24, H * 0.85);
        } else {
          ctx.fillText(idleText, 24, H * 0.46);
          ctx.fillStyle = "#c9cfe6";
          ctx.font = font(Math.round(H * 0.09), 700);
          ctx.fillText(doneText, 24, H * 0.72);
        }
      });
    };
    progressScreen(s.studio, "STUDIO WEB & TECH", "#8b6cff", "site", "Prêt pour un nouveau site 🚀", `${state.documents.filter((d) => d.kind === "site").length} site(s) livré(s)`);
    progressScreen(s.montage, "MONTAGE", "#ff5c8a", "video", "Prêt à monter 🎬", `${state.documents.filter((d) => d.kind === "video").length} vidéo(s)`);

    s.createurs.draw((ctx, W, H) => {
      ctx.fillStyle = "#1d0f2b";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#c77dff";
      ctx.font = font(34, 800);
      ctx.fillText("💎 PÔLE CRÉATEURS", 24, 56);
      ctx.fillStyle = "#fff";
      ctx.font = font(40, 800);
      ctx.fillText("OUVERTURE PROCHAINE", 24, 130);
      ctx.fillStyle = "#d8c4ee";
      ctx.font = font(22, 700);
      const done = state.tasks.filter((t) => t.type === "talent" && t.status === "done").length;
      ctx.fillText(`${done} étape(s) de préparation bouclée(s)`, 24, 190);
      ctx.fillStyle = "#f2c14e";
      for (let x = 0; x < W; x += 60) {
        ctx.save();
        ctx.translate(x, H - 18);
        ctx.rotate(-0.5);
        ctx.fillRect(0, 0, 30, 60);
        ctx.restore();
      }
    });

    const shipping = state.tasks.filter((t) => t.type === "logistics" && ["queued", "working"].includes(t.status)).length;
    s.warehouse.draw((ctx, W, H) => {
      ctx.fillStyle = "#2b2116";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f2c14e";
      ctx.font = font(48, 800);
      ctx.fillText(`📦 EXPÉDITIONS · ${shipping} en cours`, 20, H * 0.68);
    });

    s.library.draw((ctx, W) => {
      ctx.fillStyle = "#2a1c12";
      ctx.fillRect(0, 0, W, 9999);
      ctx.fillStyle = "#f2d3a5";
      ctx.font = font(34, 800);
      ctx.fillText("📚 ARCHIVES", 22, 62);
      ctx.fillStyle = "#fff";
      ctx.font = font(64, 800);
      ctx.fillText(String(state.documents.length), 22, 160);
      ctx.font = font(24, 700);
      ctx.fillStyle = "#d9c2a0";
      ctx.fillText("documents rangés", 22, 200);
      const last = state.documents.at(-1);
      if (last) ctx.fillText(ellipsis(ctx, `Dernier : ${last.title}`, W - 44), 22, 250);
    });

    const font2 = font;
    const wrap = (ctx, text, x, y, maxW, lineH, maxLines = 3) => {
      const words = String(text).split(/\s+/);
      let line = "";
      let lines = 0;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(lines === maxLines - 1 ? `${line}…` : line, x, y + lines * lineH);
          lines += 1;
          line = w;
          if (lines >= maxLines) return;
        } else line = test;
      }
      if (line) ctx.fillText(line, x, y + lines * lineH);
    };
    const life = state.life || {};
    const stories = life.stories || [];

    // Télé de la salle de repos : la chaîne d'info interne
    s.lounge?.draw((ctx, W, H) => {
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, W, H);
      const story = stories.at(-1 - (Math.floor(now / 12000) % Math.max(1, Math.min(4, stories.length))));
      ctx.fillStyle = "#d00000";
      ctx.fillRect(0, H - 70, W, 70);
      ctx.fillStyle = "#fff";
      ctx.font = font2(22, 900);
      ctx.fillText("FLASH INFO · QG TV", 14, H - 42);
      ctx.font = font2(16, 700);
      ctx.fillText(new Date(now).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), W - 64, H - 42);
      ctx.fillStyle = "#ffd166";
      ctx.font = font2(56, 900);
      ctx.fillText(story?.icon || "📺", 16, 74);
      ctx.fillStyle = "#fff";
      ctx.font = font2(22, 800);
      wrap(ctx, story?.text || "Rien à signaler. Les chats dorment.", 90, 44, W - 104, 28, 4);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = font2(15, 700);
      ctx.fillText("EN DIRECT DE LA MACHINE À CAFÉ", 14, H - 14);
    });
    s.arcade?.draw((ctx, W, H) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffd60a";
      ctx.font = font2(22, 900);
      ctx.fillText("PAC-CAT", 22, 34);
      const x = (now / 40) % (W + 40) - 20;
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.arc(x, 80, 14, 0.4, Math.PI * 2 - 0.4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      for (let d = 0; d < W; d += 22) if (d > x + 10) ctx.fillRect(d, 78, 4, 4);
      ctx.font = font2(12, 700);
      ctx.fillText("HI-SCORE BERTRAND", 18, 112);
    });

    // Studio marketing : performance pub
    const adsDone = state.tasks.filter((t) => t.type === "ads" && t.status === "done").length;
    const designs = state.documents.filter((d) => d.kind === "visual").length;
    s.ads?.draw((ctx, W, H) => {
      ctx.fillStyle = "#1a1325";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ff8a5b";
      ctx.font = font2(26, 900);
      ctx.fillText("📈 MARKETING", 18, 40);
      ctx.fillStyle = "#fff";
      ctx.font = font2(20, 700);
      ctx.fillText(`${adsDone} campagne(s) · ${designs} visuel(s)`, 18, 74);
      ctx.strokeStyle = "#06d6a0";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = 18 + (i / 12) * (W - 36);
        const y = H - 30 - (Math.sin(i * 0.9 + 1) * 0.3 + i / 14) * (H - 130);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = "#c9cfe6";
      ctx.font = font2(15, 700);
      ctx.fillText("ROAS cible : ×2", 18, H - 10);
    });

    // Juridique : échéances
    const legalDocs = state.documents.filter((d) => d.kind === "legal").length;
    const next = state.events.filter((e) => e.start > now).sort((a, b) => a.start - b.start)[0];
    s.legal?.draw((ctx, W, H) => {
      ctx.fillStyle = "#101826";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#8fa3bf";
      ctx.font = font2(26, 900);
      ctx.fillText("⚖️ ÉCHÉANCES", 18, 40);
      ctx.fillStyle = "#fff";
      ctx.font = font2(20, 700);
      ctx.fillText(`${legalDocs} document(s) juridiques & admin`, 18, 80);
      ctx.fillStyle = "#c9cfe6";
      ctx.font = font2(18, 600);
      ctx.fillText(next ? ellipsis(ctx, `Prochain : ${next.title}`, W - 36) : "Déclaration URSSAF : à vérifier", 18, 120);
      ctx.fillText("Rien ne se signe sans relire. — Sandrine", 18, H - 20);
    });

    // Bureau RH : mur des champions
    const hall = life.hall || [];
    const champion = hall[0];
    const nameOf = (id) => state.agents.find((a) => a.id === id);
    s.hrWall?.draw((ctx, W, H) => {
      ctx.fillStyle = "#2b1b1e";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f7c948";
      ctx.font = font2(28, 900);
      ctx.fillText("🏆 MUR DES CHAMPIONS", 18, 42);
      ctx.font = font2(20, 700);
      if (!hall.length) {
        ctx.fillStyle = "#f6e7cb";
        ctx.fillText("Premier employé du mois : à élire !", 18, 96);
      }
      hall.slice(0, 5).forEach((h, i) => {
        ctx.fillStyle = i ? "#f6e7cb" : "#ffd166";
        ctx.fillText(`${monthLabel(h.key)} — ${h.name} ${"⭐".repeat(Math.min(5, h.stars || 0))}`, 18, 90 + i * 34);
      });
    });

    // Totem « Employé du mois »
    const round = life.round;
    s.eotm?.draw((ctx, W, H) => {
      ctx.fillStyle = "#1b1407";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#f7c948";
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 6, W - 12, H - 12);
      ctx.fillStyle = "#f7c948";
      ctx.textAlign = "center";
      ctx.font = font2(30, 900);
      ctx.fillText("EMPLOYÉ", W / 2, 52);
      ctx.fillText("DU MOIS", W / 2, 86);
      const hero = champion ? nameOf(champion.agentId) : null;
      if (hero) {
        ctx.fillStyle = hero.look?.shirt || "#7c6cff";
        ctx.beginPath();
        ctx.arc(W / 2, 200, 82, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = font2(90, 900);
        ctx.fillText(hero.name[0], W / 2, 232);
        ctx.fillStyle = "#fff";
        ctx.font = font2(38, 900);
        ctx.fillText(hero.name, W / 2, 330);
        ctx.fillStyle = "#f6e7cb";
        ctx.font = font2(22, 700);
        ctx.fillText(monthLabel(champion.key), W / 2, 366);
        ctx.fillText("⭐".repeat(Math.min(6, champion.stars || 0)) || "⭐", W / 2, 402);
      } else {
        ctx.fillStyle = "#f6e7cb";
        ctx.font = font2(24, 800);
        ctx.fillText("ÉLECTION EN COURS", W / 2, 150);
        ctx.font = font2(26, 800);
        (round?.nominees || []).slice(0, 3).forEach((id, i) => {
          const a = nameOf(id);
          ctx.fillStyle = a?.look?.shirt || "#fff";
          ctx.fillText(`${a?.name || "?"} · ${"⭐".repeat(round.stars[id] || 0) || "—"}`, W / 2, 210 + i * 56);
        });
      }
      ctx.textAlign = "left";
    });

    // Panneau « jours sans incident » (spoiler : 0)
    const lastIncident = Math.max(this.lastIncidentAt || 0, ...stories.filter((st) => st.kind === "incident").map((st) => st.at), 0);
    const days = lastIncident ? Math.floor((now - lastIncident) / 86400000) : Math.floor((now - (state.createdAt || now)) / 86400000);
    s.incident?.draw((ctx, W, H) => {
      ctx.fillStyle = "#fffdf5";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#1b7f3b";
      ctx.fillRect(0, 0, W, 44);
      ctx.fillStyle = "#fff";
      ctx.font = font2(22, 900);
      ctx.fillText("CE BUREAU EST SANS INCIDENT DEPUIS", 14, 30);
      ctx.fillStyle = days ? "#1b7f3b" : "#d00000";
      ctx.font = font2(110, 900);
      ctx.fillText(String(days), 22, 168);
      ctx.fillStyle = "#1b1f33";
      ctx.font = font2(40, 900);
      ctx.fillText(days > 1 ? "JOURS" : "JOUR", 170, 132);
      ctx.font = font2(18, 700);
      ctx.fillStyle = "#6b7280";
      ctx.fillText(days ? "Continuez comme ça !" : "Bruno, on sait que c'est toi.", 172, 166);
    });

    s.logo.draw((ctx, W, H) => {
      ctx.translate(W / 2, H / 2);
      ctx.fillStyle = "rgba(30,41,59,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, W * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      const name = (state.settings?.companyName || "QG").toUpperCase();
      let size = 70;
      ctx.font = font(size, 900);
      while (ctx.measureText(name).width > W * 0.72 && size > 26) {
        size -= 4;
        ctx.font = font(size, 900);
      }
      ctx.fillText(name, 0, 18);
      ctx.font = font(26, 700);
      ctx.fillText("SIÈGE SOCIAL", 0, 70);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    });
  }

  // ------------------------------------------------------------ jour / nuit

  applyDaylight() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const day = h < 6 || h > 21 ? 0 : h < 8 ? (h - 6) / 2 : h > 19 ? (21 - h) / 2 : 1;
    this.hemi.intensity = 0.75 + 0.55 * day;
    this.sun.intensity = 0.5 + 1.6 * day;
    this.sun.color.set(day > 0.5 ? "#fff6e6" : "#9fb3ff");
    const win = this.office.windowMat;
    win.emissive.set(day > 0.3 ? "#8fcfff" : "#1e2a5a");
    win.color.set(day > 0.3 ? "#a9d8ff" : "#1a2347");
    win.emissiveIntensity = 0.4 + 0.6 * day;
  }

  // ------------------------------------------------------------ qualité adaptative

  // Baisse progressivement la qualité si l'appareil n'arrive pas à suivre (mémorisé).
  applyQuality(level) {
    if (level === 1) this.renderer.setPixelRatio(1);
    if (level === 2) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
      });
    }
    if (level === 3) this.renderer.setPixelRatio(0.75);
    this.resize();
  }

  watchPerformance(time) {
    const perf = this.perf;
    if (perf.level >= 3 || document.hidden) {
      perf.since = time;
      perf.frames = 0;
      return;
    }
    if (!perf.since) perf.since = time;
    perf.frames += 1;
    const elapsed = time - perf.since;
    if (elapsed < 4000) return;
    const fps = (perf.frames * 1000) / elapsed;
    perf.since = time;
    perf.frames = 0;
    if (fps < 22) {
      perf.level += 1;
      this.applyQuality(perf.level);
      try {
        localStorage.setItem("qg-quality-level", String(perf.level));
      } catch {
        // non mémorisé
      }
    }
  }

  // ------------------------------------------------------------ boucle

  frame(time) {
    // Sur mobile, ~40 images/s suffisent et préservent la batterie.
    if (IS_TOUCH && time - this.lastFrame < 24) return;
    this.lastFrame = time;
    this.watchPerformance(time);
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
    const B = this.activeBounds;
    const clampedX = THREE.MathUtils.clamp(target.x, B.minX, B.maxX);
    const clampedZ = THREE.MathUtils.clamp(target.z, B.minZ, B.maxZ + 4);
    if (clampedX !== target.x || clampedZ !== target.z || target.y !== 0) {
      const shift = new THREE.Vector3(clampedX - target.x, -target.y, clampedZ - target.z);
      target.add(shift);
      this.camera.position.add(shift);
    }
    if (this.floor && this.followId && !this.tween) {
      const pos = this.floor.positionOf(this.followId);
      if (pos) {
        const offset = this.camera.position.clone().sub(this.controls.target);
        const desired = new THREE.Vector3(pos.x, 0, pos.z).add(this.followShift || new THREE.Vector3());
        this.controls.target.lerp(desired, Math.min(1, dt * 3));
        this.camera.position.copy(this.controls.target).add(offset);
      }
    }
    this.controls.update();
    if (this.floor) {
      // Étage du Bâtiment : le QG est en pause visuelle, seul l'étage visité est animé et rendu.
      this.floor.tick(dt, t, this.camera, this.controls);
      const farFloor = this.camera.position.distanceTo(this.controls.target) > 30 && this.container.clientWidth < 700;
      if (farFloor !== this.farFloorTags) {
        this.farFloorTags = farFloor;
        this.floorLabels.domElement.classList.toggle("far", farFloor);
      }
      this.renderer.render(this.floor.scene, this.camera);
      this.floorLabels.render(this.floor.scene, this.camera);
      return;
    }
    const compact = this.camera.position.distanceTo(this.controls.target) > 34;
    if (compact !== this.compactTags) {
      this.compactTags = compact;
      this.updateTags();
      this.boss.setStatus({ compact });
      for (const npc of this.npcs.values()) npc.person.setStatus({ emoji: npc.person.tagEl.querySelector(".emo").textContent, compact });
      this.cats?.setCompact(compact);
    }
    // Vue d'ensemble sur petit écran : on masque les panneaux de pôles pour que les pièces restent lisibles.
    const far = compact && this.container.clientWidth < 700;
    if (far !== this.farTags) {
      this.farTags = far;
      this.labels.domElement.classList.toggle("far", far);
    }

    this.life?.tick(nowMs);
    this.cats?.tick(nowMs);
    this.cats?.update(dt);
    this.updateConfetti(dt);
    for (const item of this.questItems.values()) {
      item.group.position.y = item.base + Math.abs(Math.sin(t * 2.2)) * 0.05;
      item.group.rotation.y = t * 0.8;
      item.sparkle.scale.setScalar(0.6 + Math.abs(Math.sin(t * 4)) * 0.8);
    }
    for (const actor of this.actors.values()) {
      actor.update();
      actor.person.update(dt, t);
    }
    for (const npc of this.npcs.values()) {
      npc.update();
      if (npc.person.root.visible) npc.person.update(dt, t);
    }
    this.boss.update(dt, t);
    this.scene.updateMatrixWorld();
    this.crowd.update();

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
