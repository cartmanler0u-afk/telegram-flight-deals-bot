// Étages du Bâtiment 0 en 3D. Chaque étage est construit à partir de l'état réel du monde
// (vue world.explore « floor3d ») : ses pièces, leur mobilier, et chaque occupant là où il se
// trouve vraiment, en train de faire ce qu'il fait vraiment. Entre deux cycles, ceux qui
// changent de pièce marchent jusqu'à leur nouvelle place ; ceux qui quittent l'étage
// prennent l'ascenseur. Les bulles rejouent les répliques réellement prononcées sur l'étage.

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { Person, mat } from "./people.js";
import { Crowd } from "./crowd.js";
import { mergeStatic } from "./props.js";
import { computeFloorPlan, walkPath } from "./floorplan.js";
import { furnish } from "./floorkit.js";

export const KIND_ICON = { work: "💼", meeting: "🗣️", food: "🍽️", social: "☕", rest: "🛏️", transit: "🛗", special: "🌀", secret: "🕳️", owner: "👑" };
const ACT_ICON = { sleep: "💤", work: "💼", meeting: "🗣️", food: "🍽️", social: "☕", rest: "🛋️", transit: "🛗", special: "🌀", idle: "", animal: "" };
const WALL_IN = 1.25;
const WALL_OUT = 2.7;

// Ambiance de chaque étage (sol, murs, couleur d'accent).
const PALETTES = {
  owner: { floor: "#3a3f58", corridor: "#2b2f45", wall: "#5a6078", accent: "#e0b354", bg: "#0b0d18" },
  technique: { floor: "#8e9a8b", corridor: "#7c8579", wall: "#c9d1c4", accent: "#4cc38a", bg: "#0e1418" },
  anomalie: { floor: "#2a2140", corridor: "#1f1830", wall: "#3d3160", accent: "#9b7bff", bg: "#0b0714" },
  justice: { floor: "#7a5a40", corridor: "#5b4330", wall: "#ded0b8", accent: "#b08d57", bg: "#0e0c12" },
  logement: { floor: "#cdb9a0", corridor: "#b9a184", wall: "#efe3d0", accent: "#c76b5b", bg: "#0f0e16" },
  elite: { floor: "#5a1f2b", corridor: "#3f1620", wall: "#e8dcc8", accent: "#e0b354", bg: "#0e0a10" },
  politique: { floor: "#33508f", corridor: "#263d6e", wall: "#e6e0d2", accent: "#c0392b", bg: "#0b0f1c" },
  laboratoire: { floor: "#dfe5ec", corridor: "#c8d0da", wall: "#f4f6f8", accent: "#4cc38a", bg: "#0d1218" },
  medias: { floor: "#3a3f4d", corridor: "#2b2f3a", wall: "#d8d2c8", accent: "#e0533d", bg: "#100c10" },
  commerce: { floor: "#3a6b55", corridor: "#2f5d4a", wall: "#e2dccd", accent: "#d9a93f", bg: "#0b120f" },
  direction: { floor: "#8d96a8", corridor: "#7a8396", wall: "#e6dccb", accent: "#4a5060", bg: "#0e1120" },
  rh: { floor: "#c9b8d6", corridor: "#b5a2c4", wall: "#f1e9f2", accent: "#e57aa5", bg: "#120e18" },
  accueil: { floor: "#d9cfbf", corridor: "#c8bba6", wall: "#efe7da", accent: "#7a1f2b", bg: "#0e1120" },
  logistique: { floor: "#8d8a83", corridor: "#7b7870", wall: "#b9b4aa", accent: "#f2c14e", bg: "#0d0d0f" },
  entreprise: { floor: "#9fb0c0", corridor: "#8a9bab", wall: "#e6dccb", accent: "#7c6cff", bg: "#0e1120" },
};
const ROOM_FLOOR = { food: "#d8dde6", rest: "#c9b79c", transit: "#bdb6aa", special: "#2e2448", secret: "#5c5852", owner: "#34384f" };

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Apparence stable d'un habitant (dérivée de son identifiant, de son âge et de son service).
const SKINS = ["#f1c9a5", "#e8b796", "#d29f7a", "#c68d6a", "#a8714f", "#8d5a3b", "#6b4430"];
const HAIRS = ["#1f1a17", "#3b2a20", "#5a4632", "#8a5a35", "#b07a45", "#d9b26f", "#7a2e1f", "#2a2a2a"];
const STYLES = ["short", "long", "bun", "curly", "spiky", "short", "long", "bald"];
const PANTS = ["#1f2a44", "#2b2f3a", "#3a3a3a", "#5a4632", "#283a5a", "#4a4f5a"];
const DEPT_SHIRTS = {
  accueil: ["#3f6fd8", "#5b8def", "#2c4a8a"], cafeteria: ["#f4f4f6", "#e8e2d0"], logistique: ["#f2a541", "#8d6e4c", "#c47d2c"],
  etrange: ["#6b4fa8", "#3b2f5c", "#9b7bff"], rh: ["#e57aa5", "#f0a6c3", "#c45b8a"], direction: ["#2b2f3a", "#4a5060", "#1f2a44"],
  bourse: ["#1f6b4a", "#2e8b57", "#f4f4f6"], medias: ["#e0533d", "#f07a5a", "#2b2f3a"], labos: ["#f4f4f6", "#cfe8ff", "#e9e6df"],
  parlement: ["#2c4a8a", "#c0392b", "#f4f4f6"], club: ["#5a1f2b", "#2b1f3a", "#1b1b22"], hotel: ["#8a6a4a", "#b08d6a", "#c76b5b"],
  tribunal: ["#1b1b22", "#3a2a4a", "#2b2f3a"], technique: ["#2f7d48", "#4a8a3a", "#5a6b3a"], qg: ["#7c6cff", "#5aa9e6", "#4cc38a", "#f2a541"],
};
const DEPT_ACCESSORY = { medias: "notepad", tribunal: "tie", direction: "tie", bourse: "phone", club: "tie", rh: "clipboard", labos: "glasses", logistique: "cap", etrange: "glasses", parlement: "tie", technique: "cap" };

export function lookFor(p) {
  const r = rngFrom(hashStr(p.id));
  const pick = (list) => list[Math.floor(r() * list.length)];
  const old = (p.age || 35) >= 58;
  const shirts = DEPT_SHIRTS[p.dept] || ["#5a6bd8", "#8d96a8", "#c0392b", "#2f7d48", "#e0b354"];
  const look = {
    skin: pick(SKINS),
    hair: old && r() < 0.7 ? pick(["#c9c3b8", "#e6e1d8", "#9a958c"]) : pick(HAIRS),
    hairStyle: old && r() < 0.3 ? "bald" : pick(STYLES),
    shirt: pick(shirts),
    pants: pick(PANTS),
  };
  const accessory = r() < 0.55 ? DEPT_ACCESSORY[p.dept] || (r() < 0.3 ? "glasses" : "none") : r() < 0.25 ? "glasses" : "none";
  return { look, accessory };
}

// Activité de l'avatar selon ce que fait vraiment la personne et la place qu'elle occupe.
function avatarActivity(act, spot, p = {}) {
  if (spot.kind === "bed") return "sleep";
  if (p.party && act !== "sleep") return spot.kind === "seat" ? "talk" : "dance";
  if (spot.kind === "seat") {
    if (act === "sleep") return "sleep";
    if (act === "work") return spot.act === "talk" ? "talk" : "work";
    if (act === "meeting") return "talk";
    if (act === "food") return "eat";
    if (act === "social") return spot.act === "talk" ? "talk" : spot.act === "phone" ? "phone" : "relax";
    if (act === "rest") return "relax";
    if (act === "transit") return "phone";
    return "idle";
  }
  if (spot.act === "film" || spot.act === "coffee" || spot.act === "write") return spot.act;
  if (act === "work") return spot.staff ? "talk" : "write";
  if (act === "social" || act === "meeting") return "talk";
  if (act === "transit") return "phone";
  if (act === "special") return "shock";
  return "idle";
}

// Ordre de préférence des places selon l'activité réelle.
// (« crowd » : places de foule entre les meubles, en dernier recours.)
const PREFS = {
  sleep: ["bed", "seat", "crowd"],
  work: ["seat:work", "stand:work", "seat", "stand", "crowd"],
  meeting: ["seat:talk", "seat", "stand", "crowd"],
  food: ["seat:eat", "seat", "stand", "crowd"],
  social: ["seat:relax", "seat:talk", "stand", "seat", "crowd"],
  rest: ["seat", "bed", "stand", "crowd"],
  transit: ["stand:elevator", "stand", "seat", "crowd"],
  special: ["stand", "seat", "crowd"],
  idle: ["stand", "seat", "crowd"],
};
const SPOT_FLAGS = new Set(["elevator", "judge", "staff", "speaker"]);

function matches(spot, pref) {
  if (pref === "crowd") return !!spot.overflow;
  const [kind, flag] = pref.split(":");
  if (spot.kind !== kind || spot.overflow) return false;
  if (!flag) return true;
  if (SPOT_FLAGS.has(flag)) return !!spot[flag];
  return spot.act === flag;
}

// ------------------------------------------------------------------ animaux

function lobster() {
  const g = new THREE.Group();
  const red = mat("#d64b2a", { roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 10), red);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  for (const sx of [-1, 1]) {
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), red);
    claw.scale.set(1, 0.6, 1.5);
    claw.position.set(sx * 0.13, 0, 0.24);
    g.add(claw);
    g.userData[`claw${sx}`] = claw;
  }
  return g;
}

function pigeon() {
  const g = new THREE.Group();
  const grey = mat("#8a8f9a");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), grey);
  body.scale.set(0.9, 0.85, 1.25);
  body.position.y = 0.16;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat("#5d6b7a"));
  head.position.set(0, 0.3, 0.12);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), mat("#e0b354"));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.29, 0.21);
  g.add(beak);
  g.userData.head = head;
  return g;
}

function cat(color = "#c96b5b") {
  const g = new THREE.Group();
  const fur = mat(color);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 4, 10), fur);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.16;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), fur);
  head.position.set(0, 0.26, 0.2);
  g.add(head);
  g.userData.head = head;
  return g;
}

// ------------------------------------------------------------------ scène d'un étage

export class FloorScene {
  constructor(data, { onSelectRoom, onSelectPerson, arriving = null } = {}) {
    this.arrivingId = arriving; // la personne suivie sort de l'ascenseur avec la caméra
    this.onSelectRoom = onSelectRoom;
    this.onSelectPerson = onSelectPerson;
    this.scene = new THREE.Scene();
    this.avatars = new Map(); // id -> { person, data, room, spot, leaving }
    this.animals = new Map();
    this.roomSpots = new Map();
    this.roomTags = new Map();
    this.dynamics = [];
    this.outerWalls = [];
    this.owned = []; // géométries propres à cet étage (libérées en le quittant)
    this.lastSaid = new Map();
    this.nextAmbient = 0;
    this.nextBubble = 0;
    this.nextLabels = 0;
    this.selected = null;
    this.crowd = new Crowd(this.scene);
    this.build(data);
    this.apply(data, { initial: true });
  }

  get id() {
    return this.data?.id;
  }

  own(geometry) {
    this.owned.push(geometry);
    return geometry;
  }

  get bounds() {
    return this.plan.bounds;
  }

  // ---------------------------------------------------------- construction

  build(data) {
    const plan = computeFloorPlan(data.rooms);
    this.plan = plan;
    const pal = PALETTES[data.kind] || PALETTES.direction;
    this.palette = pal;
    const scene = this.scene;
    const night = data.hour < 7 || data.hour >= 21;
    this.night = night;
    scene.background = new THREE.Color(pal.bg);
    scene.fog = new THREE.Fog(pal.bg, 70, 150);

    this.hemi = new THREE.HemisphereLight("#eef3ff", "#5b5146", 1.25);
    scene.add(this.hemi);
    const { minX, maxX, minZ, maxZ } = plan.bounds;
    const cx = (minX + maxX) / 2;
    const sun = new THREE.DirectionalLight("#fff6e6", 1.9);
    sun.position.set(cx + 14, 30, 18);
    sun.target.position.set(cx, 0, 0);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const half = Math.max(maxX - minX, maxZ - minZ) / 2 + 4;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 90 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    this.sun = sun;
    this.setLighting(data);

    const statics = new THREE.Group();
    scene.add(statics);
    const W = maxX - minX;
    const D = maxZ - minZ;
    const slab = new THREE.Mesh(this.own(new THREE.BoxGeometry(W + 1.2, 0.5, D + 1.2)), mat("#2b2f3a"));
    slab.position.set(cx, -0.26, (minZ + maxZ) / 2);
    slab.receiveShadow = true;
    statics.add(slab);
    const plane = (x0, x1, z0, z1, color, y = 0.002) => {
      const m = new THREE.Mesh(this.own(new THREE.BoxGeometry(x1 - x0, 0.02, z1 - z0)), mat(color, { roughness: 0.9 }));
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      m.receiveShadow = true;
      statics.add(m);
      return m;
    };
    plane(plan.corridor.x0, plan.corridor.x1, plan.corridor.z0, plan.corridor.z1, pal.corridor);
    // Bande de couleur au milieu du couloir : l'accent de l'étage.
    plane(plan.corridor.x0, plan.corridor.x1, -0.18, 0.18, pal.accent, 0.012);

    for (const room of data.rooms) {
      const r = plan.rooms[room.id];
      if (!r) continue;
      plane(r.x0 + 0.05, r.x1 - 0.05, r.z0 + 0.05, r.z1 - 0.05, room.key === "palier" ? pal.corridor : ROOM_FLOOR[room.kind] || pal.floor, 0.006);
      const group = new THREE.Group();
      group.position.set(r.cx, 0, r.cz);
      group.rotation.y = r.side === "south" ? Math.PI : r.side === "west" ? Math.PI / 2 : 0;
      const [lw, ld] = r.side === "west" ? [r.d, r.w] : [r.w, r.d];
      statics.add(group);
      const { spots, dynamics } = furnish(group, room, lw - 0.3, ld - 0.3, rngFrom(hashStr(room.id)));
      group.updateMatrixWorld(true);
      const world = spots.map((s, i) => {
        const v = new THREE.Vector3(s.x, 0, s.z).applyMatrix4(group.matrixWorld);
        return { ...s, x: v.x, z: v.z, facing: s.facing + group.rotation.y, room: room.id, key: `${room.id}#${i}`, taken: null };
      });
      this.roomSpots.set(room.id, world);
      for (const d of dynamics) {
        if (d.kind === "pulse" || d.kind === "water") d.obj.material = d.obj.material.clone();
        this.dynamics.push(d);
      }
      this.addRoomTag(room, r);
    }

    // Murs : cloisons basses (fusionnées) et enveloppe extérieure masquée côté caméra.
    const wallMat = mat(pal.wall);
    const trimMat = mat(pal.accent);
    for (const w of plan.walls) {
      const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      const h = w.outer ? WALL_OUT : WALL_IN;
      const wall = new THREE.Mesh(this.own(new THREE.BoxGeometry(len + 0.15, h, 0.15)), wallMat);
      wall.position.set((w.x0 + w.x1) / 2, h / 2, (w.z0 + w.z1) / 2);
      wall.rotation.y = -Math.atan2(w.z1 - w.z0, w.x1 - w.x0);
      wall.castShadow = true;
      wall.receiveShadow = true;
      if (!w.outer) {
        statics.add(wall);
        const trim = new THREE.Mesh(this.own(new THREE.BoxGeometry(len + 0.17, 0.06, 0.19)), trimMat);
        trim.position.copy(wall.position);
        trim.position.y = h + 0.03;
        trim.rotation.y = wall.rotation.y;
        statics.add(trim);
        continue;
      }
      const g = new THREE.Group();
      g.add(wall);
      // Fenêtres : elles s'allument la nuit (heure du Bâtiment).
      const n = Math.floor(len / 3.2);
      const winMat = night ? mat("#ffd98a", { emissive: "#ffb84d", emissiveIntensity: 0.7 }) : mat("#a9d8ff", { emissive: "#8fcfff", emissiveIntensity: 0.5 });
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const win = new THREE.Mesh(this.own(new THREE.BoxGeometry(1.6, 1.1, 0.17)), winMat);
        win.position.set(w.x0 + (w.x1 - w.x0) * t, 1.6, w.z0 + (w.z1 - w.z0) * t);
        win.rotation.y = wall.rotation.y;
        g.add(win);
      }
      scene.add(g);
      this.outerWalls.push({ group: g, point: new THREE.Vector3((w.x0 + w.x1) / 2, 0, (w.z0 + w.z1) / 2), normal: new THREE.Vector3(w.normal[0], 0, w.normal[1]) });
    }
    mergeStatic(statics);
    for (const m of statics.children) if (m.isMesh) this.own(m.geometry);

    if (data.rule) {
      const el = document.createElement("div");
      el.className = "room-tag floor-rule";
      el.textContent = `📌 ${data.rule}`;
      const label = new CSS2DObject(el);
      label.position.set((plan.corridor.x0 + plan.corridor.x1) / 2, 2.2, 0);
      scene.add(label);
    }
    if (data.access) {
      // Étage fermé ou rumeur : on voit le palier, le reste se perd dans le brouillard.
      scene.fog = new THREE.Fog(pal.bg, 8, 30);
      const el = document.createElement("div");
      el.className = "room-tag floor-closed";
      el.textContent = `🔒 ${data.access}`;
      const label = new CSS2DObject(el);
      label.position.set(plan.corridor.x0 + 4, 2, 0);
      scene.add(label);
    }

    this.ring = new THREE.Mesh(this.own(new THREE.TorusGeometry(0.5, 0.04, 8, 40)), new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.9 }));
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
    this.initSleepers();
  }

  // Dormeurs : silhouettes allongées dessinées en instances (des centaines possibles pour trois
  // appels de rendu). Dès qu'ils se lèvent, ils redeviennent des personnages complets.
  initSleepers() {
    const capacity = Math.max(1, [...this.roomSpots.values()].flat().filter((sp) => sp.kind === "bed").length);
    const make = (geometry) => {
      const m = new THREE.InstancedMesh(this.own(geometry), mat("#ffffff"), capacity);
      m.setColorAt(0, new THREE.Color("#ffffff")); // tampon de couleurs créé avant le premier rendu
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = false;
      this.scene.add(m);
      return m;
    };
    this.sleeperBody = make(new THREE.BoxGeometry(0.6, 0.2, 1.3));
    this.sleeperHead = make(new THREE.SphereGeometry(0.16, 12, 10));
    this.sleeperHair = make(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    this.sleepers = new Map(); // id -> { index, spot, data, room, head }
    this.sleeperIds = [];
    const el = document.createElement("div");
    el.className = "tag";
    el.innerHTML = `<div class="tag-pill"><span class="emo">💤</span><span class="tag-name"></span></div>`;
    this.sleeperTag = new CSS2DObject(el);
    this.sleeperTag.visible = false;
    this.scene.add(this.sleeperTag);
  }

  writeSleeper(entry) {
    const { spot, index } = entry;
    const { look } = lookFor(entry.data);
    const dir = new THREE.Vector3(Math.sin(spot.facing), 0, Math.cos(spot.facing));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.facing);
    const one = new THREE.Vector3(1, 1, 1);
    const at = (back, y) => new THREE.Vector3(spot.x - dir.x * back, y, spot.z - dir.z * back);
    const m = new THREE.Matrix4();
    this.sleeperBody.setMatrixAt(index, m.compose(at(0.62, spot.lieY - 0.04), q, one));
    this.sleeperBody.setColorAt(index, new THREE.Color(entry.blanket));
    entry.head = at(1.38, spot.lieY + 0.04);
    this.sleeperHead.setMatrixAt(index, m.compose(entry.head, q, one));
    this.sleeperHead.setColorAt(index, new THREE.Color(look.skin));
    const hairQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2).premultiply(q);
    this.sleeperHair.setMatrixAt(index, m.compose(at(1.42, spot.lieY + 0.04), hairQ, look.hairStyle === "bald" ? new THREE.Vector3(0, 0, 0) : one));
    this.sleeperHair.setColorAt(index, new THREE.Color(look.hair));
    for (const mesh of [this.sleeperBody, this.sleeperHead, this.sleeperHair]) {
      mesh.count = this.sleeperIds.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  addSleeper(p, spot) {
    const index = this.sleeperIds.length;
    this.sleeperIds.push(p.id);
    spot.taken = p.id;
    const blanket = ["#5b7fc7", "#c76b5b", "#6b9b6b", "#b08d57", "#8a6fb8"][hashStr(p.id) % 5];
    const entry = { index, spot, data: p, room: p.room, blanket, head: null };
    this.sleepers.set(p.id, entry);
    this.writeSleeper(entry);
    return entry;
  }

  removeSleeper(id) {
    const entry = this.sleepers.get(id);
    if (!entry) return null;
    if (entry.spot.taken === id) entry.spot.taken = null;
    this.sleepers.delete(id);
    const lastId = this.sleeperIds.pop();
    if (lastId !== id) {
      // La dernière instance prend la place libérée.
      const moved = this.sleepers.get(lastId);
      moved.index = entry.index;
      this.sleeperIds[entry.index] = lastId;
      this.writeSleeper(moved);
    } else {
      for (const mesh of [this.sleeperBody, this.sleeperHead, this.sleeperHair]) mesh.count = this.sleeperIds.length;
    }
    if (this.selected === id) this.sleeperTag.visible = false;
    return entry;
  }

  // Un dormeur se lève : il redevient un personnage complet, debout au pied de sa couchette.
  wake(id, data) {
    const entry = this.removeSleeper(id);
    if (!entry) return null;
    const a = this.spawn(data || entry.data);
    a.room = entry.room;
    a.person.place({ x: entry.spot.x, z: entry.spot.z, facing: entry.spot.facing, stand: true });
    return a;
  }

  // Arrivé à sa couchette pour dormir : le personnage devient une silhouette instanciée.
  toSleeper(a) {
    const spot = a.spot;
    const p = a.data;
    this.crowd.remove(a.person.root);
    a.person.dispose();
    this.avatars.delete(p.id);
    this.addSleeper(p, spot);
    this.crowd.dirty = true;
  }

  // Éclairage selon l'heure du Bâtiment, et noir presque complet pendant une panne générale.
  setLighting(data) {
    const night = data.hour < 7 || data.hour >= 21;
    const key = `${night}|${!!data.blackout}`;
    if (key === this.lightKey) return;
    this.lightKey = key;
    if (data.blackout) {
      this.hemi.color.set("#7d8cc8");
      this.hemi.intensity = 0.22;
      this.sun.color.set("#9fb3ff");
      this.sun.intensity = night ? 0.08 : 0.25;
      this.scene.fog = new THREE.Fog(this.palette.bg, 18, 60);
    } else {
      this.hemi.color.set(night ? "#b8c4ff" : "#eef3ff");
      this.hemi.intensity = night ? 0.75 : 1.25;
      this.sun.color.set(night ? "#9fb3ff" : "#fff6e6");
      this.sun.intensity = night ? 0.7 : 1.9;
      if (!data.access) this.scene.fog = new THREE.Fog(this.palette.bg, 70, 150);
    }
  }

  // Fête du Bâtiment : une boule à facettes au plafond de la pièce où l'on danse.
  syncParty(data) {
    const counts = {};
    for (const p of data.people) if (p.party) counts[p.room] = (counts[p.room] || 0) + 1;
    const room = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    if (room === this.partyRoom) return;
    this.disco?.removeFromParent();
    this.disco = null;
    this.partyRoom = room;
    const r = room && this.plan.rooms[room];
    if (!r) return;
    const ball = new THREE.Mesh(this.own(new THREE.IcosahedronGeometry(0.45, 1)), mat("#e6e9f2", { metalness: 0.9, roughness: 0.15, emissive: "#ff5fd2", emissiveIntensity: 0.6, flatShading: true }));
    ball.position.set(r.cx, 2.9, r.cz);
    this.scene.add(ball);
    this.disco = ball;
  }

  addRoomTag(room, r) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `room-tag floor-room ${room.kind}`;
    el.style.setProperty("--room", this.palette.accent);
    el.addEventListener("pointerup", (e) => {
      e.stopPropagation();
      this.onSelectRoom?.(room.id);
    });
    const label = new CSS2DObject(el);
    label.position.set(r.cx, room.key === "palier" ? 2.9 : 2.4, r.cz);
    this.scene.add(label);
    this.roomTags.set(room.id, { el, label, room });
    this.renderRoomTag(room);
  }

  renderRoomTag(room) {
    const tag = this.roomTags.get(room.id);
    if (!tag) return;
    const shown = [...this.avatars.values()].filter((a) => a.room === room.id && !a.leaving).length + [...this.animals.values()].filter((a) => a.room === room.id).length + [...(this.sleepers?.values() || [])].filter((sl) => sl.room === room.id).length;
    const extra = Math.max(0, room.total - shown);
    const lock = ["members", "staff", "owner"].includes(room.access) ? "🔒" : "";
    tag.el.replaceChildren();
    const add = (cls, text) => {
      const s = document.createElement("span");
      if (cls) s.className = cls;
      s.textContent = text;
      tag.el.append(s);
    };
    add(null, `${KIND_ICON[room.kind] || "▫️"}${lock}`);
    add("floor-room-name", room.name);
    add("count-soft", `${room.total} 👥`);
    // Le palier affiche l'humeur réelle de l'Ascenseur B.
    if (room.key === "palier") add("small muted", this.data?.strike ? "· 🛗 B EN GRÈVE" : this.data?.blackout ? "· 🛗 B à l'arrêt (panne)" : `· 🛗 B ${this.data?.elevator ?? "?"}/100`);
    if (extra) add("small muted", `+${extra} hors champ`);
    if (room.offPlan) add("small", "⚠️");
    tag.el.title = room.lastEvent ? `${room.name} — ${room.lastEvent}` : room.name;
  }

  // ---------------------------------------------------------- occupants

  freeSpot(roomId, prefs, seed) {
    const spots = this.roomSpots.get(roomId) || [];
    for (const pref of prefs) {
      const free = spots.filter((s) => !s.taken && matches(s, pref));
      if (free.length) return free[seed % free.length];
    }
    return null;
  }

  prefsFor(p) {
    const base = PREFS[p.act] || PREFS.idle;
    if (p.act !== "sleep") {
      // Le juge siège sur l'estrade ; le personnel de la pièce se tient derrière son comptoir.
      if (/\bjuge\b/i.test(p.title || "")) return ["seat:judge", ...base];
      if (p.atWork) return ["stand:staff", "seat:work", ...base];
    }
    // En pièce sociale, une moitié préfère rester debout à discuter.
    if (p.act === "social" && hashStr(p.id) % 2) return ["stand", ...base];
    return base;
  }

  // Applique un nouvel état de l'étage (première construction ou nouveau cycle).
  apply(data, { initial = false } = {}) {
    const previous = this.data;
    this.data = data;
    const incoming = new Map(data.people.filter((p) => p.kind !== "animal").map((p) => [p.id, p]));
    const palierId = data.rooms.find((r) => r.key === "palier")?.id;
    const elevatorSpot = () => (this.roomSpots.get(palierId) || []).find((sp) => sp.elevator) || (this.roomSpots.get(palierId) || [])[0];
    const cabins = (this.roomSpots.get(palierId) || []).filter((sp) => sp.elevator);
    const leave = (a) => {
      // Chacun vers une cabine (ou l'escalier, le palier restant libre), sans s'empiler au même point.
      const h = hashStr(a.data.id);
      const base = cabins.length ? cabins[h % cabins.length] : elevatorSpot();
      if (!base) return this.removeAvatar(a.data.id);
      const exit = { ...base, x: base.x + ((h >> 4) % 7 - 3) * 0.18, z: base.z + ((h >> 8) % 5 - 2) * 0.18 };
      a.leaving = true;
      a.room = palierId;
      a.person.setStatus({ emoji: "🛗" });
      a.person.walk(walkPath(this.plan, a.person.root.position, a.roomBefore || palierId, exit, palierId), { ...exit, stand: true }, () => {
        a.fadeFrom = performance.now();
      });
    };

    // Départs : ceux qui ont quitté l'étage (réveillés au besoin) rejoignent l'ascenseur.
    for (const id of [...this.sleepers.keys()]) {
      if (incoming.has(id)) continue;
      if (initial) this.removeSleeper(id);
      else {
        const a = this.wake(id);
        a.roomBefore = a.room;
        leave(a);
      }
    }
    for (const [id, a] of this.avatars) {
      if (incoming.has(id) || a.leaving) continue;
      this.release(a);
      if (initial) this.removeAvatar(id);
      else leave(a);
    }

    // Présents : déjà là (changement de pièce ou d'activité), ou arrivés par l'ascenseur.
    let arrivals = 0;
    const order = [...incoming.values()].sort((a, b) => Number(b.followed) - Number(a.followed) || Number(b.star) - Number(a.star) || b.influence - a.influence);
    for (const p of order) {
      const sleeping = this.sleepers.get(p.id);
      if (sleeping) {
        if (p.act === "sleep" && sleeping.room === p.room) {
          sleeping.data = p;
          continue;
        }
        this.wake(p.id, p); // il se lève et part faire ce qu'il fait vraiment
      }
      let a = this.avatars.get(p.id);
      if (a?.leaving) {
        this.removeAvatar(p.id);
        a = null;
      }
      const seed = hashStr(`${p.id}|${p.room}`);
      if (a) {
        const keep = a.room === p.room && a.spot && this.prefsFor(p).some((pref) => matches(a.spot, pref));
        a.data = p;
        if (keep) {
          if (!a.person.moving) this.pose(a, p);
          continue;
        }
        const from = a.room;
        this.release(a);
        const spot = this.freeSpot(p.room, this.prefsFor(p), seed);
        if (!spot) {
          this.removeAvatar(p.id);
          continue;
        }
        this.take(a, spot, p.room);
        a.person.walk(walkPath(this.plan, a.person.root.position, from, spot, p.room), spot, () => this.pose(a, a.data));
        a.person.setStatus({ emoji: "🚶" });
        continue;
      }
      const spot = this.freeSpot(p.room, this.prefsFor(p), seed);
      if (!spot) continue; // pièce pleine : compté dans l'étiquette (« hors champ »)
      const entry = elevatorSpot();
      const arriving = (this.arrivingId === p.id || (!initial && previous)) && entry && p.room !== palierId;
      if (spot.kind === "bed" && p.act === "sleep" && !arriving) {
        this.addSleeper(p, spot);
        continue;
      }
      a = this.spawn(p);
      this.take(a, spot, p.room);
      if (!arriving) {
        a.person.place(spot);
        this.pose(a, p);
      } else {
        // Arrivées par l'ascenseur : réparties entre les cabines et échelonnées (pas de téléportation en grappe).
        const h = hashStr(p.id);
        const cabin = cabins.length ? cabins[h % cabins.length] : entry;
        const door = { ...cabin, x: cabin.x + ((h >> 4) % 7 - 3) * 0.2, z: cabin.z + ((h >> 8) % 5 - 2) * 0.2, stand: true };
        a.person.place(door);
        a.person.setStatus({ emoji: "🛗" });
        a.person.root.visible = this.arrivingId === p.id;
        a.pendingWalk = { at: performance.now() + (this.arrivingId === p.id ? 0 : (arrivals++ % 40) * 180 + (h % 300)), path: walkPath(this.plan, door, palierId, spot, p.room), spot };
      }
    }

    this.arrivingId = null;
    this.syncAnimals(data);
    this.setLighting(data);
    this.syncParty(data);
    for (const room of data.rooms) this.renderRoomTag(room);
    this.crowd.dirty = true;
  }

  spawn(p) {
    const { look, accessory } = lookFor(p);
    const person = new Person({ id: p.id, look, accessory, onClick: (id) => this.onSelectPerson?.(id) });
    person.setName(p.name);
    person.root.scale.setScalar(0.92);
    this.scene.add(person.root);
    this.crowd.add(person.root);
    const a = { person, data: p, room: p.room, spot: null, leaving: false };
    this.avatars.set(p.id, a);
    return a;
  }

  take(a, spot, roomId) {
    spot.taken = a.data.id;
    a.spot = spot;
    a.roomBefore = a.room;
    a.room = roomId;
  }

  release(a) {
    if (a.pendingWalk) {
      // Pas encore sorti de l'ascenseur : il apparaît et part directement vers sa nouvelle destination.
      a.pendingWalk = null;
      a.person.root.visible = true;
    }
    if (a.spot && a.spot.taken === a.data.id) a.spot.taken = null;
    a.roomBefore = a.room;
    a.spot = null;
  }

  pose(a, p) {
    const spot = a.spot;
    if (!spot) return;
    if (spot.kind === "bed" && p.act === "sleep" && this.avatars.get(p.id) === a) {
      this.toSleeper(a);
      return;
    }
    a.person.activity = avatarActivity(p.act, spot, p);
    a.person.setStatus({ emoji: ACT_ICON[p.act] || "" });
    a.person.setBadge(p.followed ? "📌" : p.star ? "⭐" : "");
    a.person.tagEl.title = `${p.name} — ${p.title} · ${p.label}`;
  }

  removeAvatar(id) {
    const a = this.avatars.get(id);
    if (!a) return;
    this.release(a);
    this.crowd.remove(a.person.root);
    a.person.dispose();
    this.avatars.delete(id);
    if (this.selected === id) this.selected = null;
  }

  syncAnimals(data) {
    const present = new Map(data.people.filter((p) => p.kind === "animal").map((p) => [p.id, p]));
    for (const [id, a] of this.animals) {
      if (present.get(id)?.room === a.room) continue;
      a.mesh.removeFromParent();
      a.label.removeFromParent();
      if (a.spot) a.spot.taken = null;
      this.animals.delete(id);
    }
    for (const p of present.values()) {
      if (this.animals.has(p.id)) {
        this.animals.get(p.id).data = p;
        continue;
      }
      const spots = this.roomSpots.get(p.room) || [];
      const spot = spots.find((s) => !s.taken && s.animal === p.species) || spots.find((s) => !s.taken && s.kind === "stand");
      if (!spot) continue;
      spot.taken = p.id;
      const mesh = p.species === "homard" ? lobster() : p.species === "pigeon" ? pigeon() : cat(["#c96b5b", "#3a3a3a", "#e8d2b0"][hashStr(p.id) % 3]);
      mesh.position.set(spot.x, spot.y || 0, spot.z);
      mesh.rotation.y = spot.facing;
      mesh.userData.personId = p.id;
      mesh.traverse((o) => o.isMesh && this.own(o.geometry));
      this.scene.add(mesh);
      const el = document.createElement("div");
      el.className = "tag cat-tag";
      el.innerHTML = `<div class="tag-pill"><span class="emo">🐾</span><span class="tag-name"></span></div>`;
      el.querySelector(".tag-name").textContent = p.name;
      el.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        this.onSelectPerson?.(p.id);
      });
      const label = new CSS2DObject(el);
      label.position.set(spot.x, (spot.y || 0) + 0.9, spot.z);
      this.scene.add(label);
      this.animals.set(p.id, { mesh, label, spot, data: p, room: p.room, base: mesh.position.clone(), phase: Math.random() * 10 });
    }
  }

  // ---------------------------------------------------------- vie ambiante

  ambient(now) {
    // Quelques personnes debout changent de place dans leur pièce (jamais d'une pièce à l'autre :
    // ça, seul le moteur de simulation le décide).
    if (now < this.nextAmbient) return;
    this.nextAmbient = now + 2200 + Math.random() * 1800;
    const candidates = [...this.avatars.values()].filter((a) => !a.leaving && a.spot?.kind === "stand" && a.spot.wander && !a.person.moving && a.data.act !== "sleep");
    for (let i = 0; i < Math.min(2, candidates.length); i++) {
      const a = candidates[Math.floor(Math.random() * candidates.length)];
      const free = (this.roomSpots.get(a.room) || []).filter((s) => !s.taken && s.kind === "stand" && s.wander);
      if (!free.length) continue;
      const spot = free[Math.floor(Math.random() * free.length)];
      this.release(a);
      this.take(a, spot, a.room);
      a.person.walk([[spot.x, spot.z]], spot, () => this.pose(a, a.data));
    }
  }

  bubbles(now) {
    if (now < this.nextBubble) return;
    this.nextBubble = now + 3800 + Math.random() * 2500;
    const talking = [...this.avatars.values()].filter((a) => a.person.talking).length;
    if (talking >= 3) return;
    // D'abord les répliques réellement prononcées sur l'étage, par ceux qui sont là.
    for (const line of this.data.lines || []) {
      const a = this.avatars.get(line.who);
      if (!a || a.leaving || a.person.moving || a.data.act === "sleep") continue;
      const key = `${line.who}|${line.text}`;
      if (now - (this.lastSaid.get(key) || -Infinity) < 180000) continue;
      this.lastSaid.set(key, now);
      a.person.say(line.text.replace(/^[^«]{1,40}?\s:\s(?=«)/, ""), 6500, 1); // la bulle est déjà sur la bonne personne
      return;
    }
    // Sinon, ce que fait vraiment quelqu'un en ce moment (pensée, pas réplique).
    const awake = [...this.avatars.values()].filter((a) => !a.leaving && !a.person.moving && !a.person.talking);
    if (!awake.length) return;
    const a = awake[Math.floor(Math.random() * awake.length)];
    a.person.say(a.data.act === "sleep" ? "💤 zZz…" : `💭 ${a.data.label}`, 4200, 1);
  }

  // ---------------------------------------------------------- sélection

  pick(raycaster) {
    const hitboxes = [...this.avatars.values()].map((a) => a.person.hitbox);
    const hit = raycaster.intersectObjects(hitboxes, false)[0];
    if (hit) return { type: "person", id: hit.object.userData.agentId };
    const sleeperHit = this.sleeperIds.length ? raycaster.intersectObjects([this.sleeperBody, this.sleeperHead], false)[0] : null;
    if (sleeperHit && sleeperHit.instanceId !== undefined) return { type: "person", id: this.sleeperIds[sleeperHit.instanceId] };
    const animalHit = raycaster.intersectObjects([...this.animals.values()].map((a) => a.mesh), true)[0];
    if (animalHit) {
      let o = animalHit.object;
      while (o && !o.userData.personId) o = o.parent;
      if (o) return { type: "person", id: o.userData.personId };
    }
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), point)) return null;
    const room = Object.values(this.plan.rooms).find((r) => point.x >= r.x0 && point.x <= r.x1 && point.z >= r.z0 && point.z <= r.z1);
    return room ? { type: "room", id: room.id } : null;
  }

  select(id) {
    this.selected = id;
    const sl = id && this.sleepers.get(id);
    this.sleeperTag.visible = !!sl;
    if (sl) {
      this.sleeperTag.element.querySelector(".tag-name").textContent = sl.data.name;
      this.sleeperTag.position.set(sl.head.x, sl.head.y + 0.5, sl.head.z);
    }
  }

  positionOf(id) {
    const a = this.avatars.get(id) || null;
    if (a) return a.person.root.position;
    const sl = this.sleepers.get(id);
    if (sl) return sl.head;
    const animal = this.animals.get(id);
    return animal ? animal.mesh.position : null;
  }

  roomCenter(roomId) {
    const r = this.plan.rooms[roomId];
    return r ? new THREE.Vector3(r.cx, 0, r.cz) : null;
  }

  // ---------------------------------------------------------- boucle

  tick(dt, t, camera, controls) {
    const now = performance.now();
    this.ambient(now);
    this.bubbles(now);
    for (const [id, a] of this.avatars) {
      if (a.pendingWalk) {
        if (now < a.pendingWalk.at) continue;
        const { path, spot } = a.pendingWalk;
        a.pendingWalk = null;
        a.person.root.visible = true;
        a.person.walk(path, spot, () => this.pose(a, a.data));
      }
      a.person.update(dt, t);
      if (a.fadeFrom) {
        const k = Math.min(1, (now - a.fadeFrom) / 600);
        a.person.root.scale.setScalar(0.92 * (1 - k));
        if (k >= 1) this.removeAvatar(id);
      }
    }
    for (const a of this.animals.values()) {
      const m = a.mesh;
      a.phase += dt;
      if (a.data.species === "homard") {
        m.position.y = a.base.y + Math.sin(a.phase * 0.8) * 0.03;
        m.rotation.y += Math.sin(a.phase * 0.3) * 0.002;
        for (const sx of [-1, 1]) m.userData[`claw${sx}`].rotation.y = Math.sin(a.phase * 2 + sx) * 0.3;
      } else if (m.userData.head) {
        m.userData.head.position.z = (a.data.species === "pigeon" ? 0.12 : 0.2) + Math.max(0, Math.sin(a.phase * 4)) * 0.03;
      }
    }
    if (this.disco) {
      this.disco.rotation.y += dt * 1.2;
      this.disco.material.emissive.setHSL((t * 0.15) % 1, 0.9, 0.5);
    }
    for (const d of this.dynamics) {
      const o = d.obj;
      const ph = t + d.phase;
      switch (d.kind) {
        case "spin": o.rotation.y += dt * d.speed; break;
        case "roll": o.rotation.y += dt * d.speed; break;
        case "float":
          o.position.y = d.base.y + Math.sin(ph * d.speed) * d.amp;
          o.rotation.x += dt * d.spin;
          o.rotation.y += dt * d.spin * 0.7;
          break;
        case "blink": o.visible = Math.sin(ph * d.speed) > -0.2; break;
        case "pulse": o.material.emissiveIntensity = 0.7 + Math.sin(ph * d.speed * 2) * 0.45; break;
        case "water": o.material.opacity = 0.32 + Math.sin(ph * d.speed) * 0.05; break;
        case "flicker": o.material = Math.floor(ph / d.every) % 2 ? d.b : d.a; break;
        case "flicker-scale": o.scale.setScalar(0.85 + Math.abs(Math.sin(ph * d.speed) * Math.sin(ph * d.speed * 0.37)) * 0.35); break;
        default:
      }
    }
    for (const wall of this.outerWalls) wall.group.visible = camera.position.clone().sub(wall.point).dot(wall.normal) <= 0;

    // Étiquettes : noms visibles de près, sinon seulement la sélection, les suivis et ceux qui parlent.
    if (now >= this.nextLabels) {
      this.nextLabels = now + 250;
      const dist = camera.position.distanceTo(controls.target);
      const near = dist < 24;
      for (const [id, a] of this.avatars) {
        a.person.label.visible = a.person.root.visible && (near || id === this.selected || a.data.followed || a.person.talking);
        const compact = dist > 34 && id !== this.selected;
        if (compact !== a.compact) {
          a.compact = compact;
          a.person.tagEl.classList.toggle("compact", compact);
        }
      }
    }

    const sel = this.selected && this.positionOf(this.selected);
    if (sel) {
      this.ring.position.set(sel.x, 0.04, sel.z);
      this.ring.visible = true;
      this.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    } else {
      this.ring.visible = false;
    }
    this.scene.updateMatrixWorld();
    this.crowd.update();
  }

  dispose() {
    for (const id of [...this.avatars.keys()]) this.removeAvatar(id);
    const labels = [];
    this.scene.traverse((o) => {
      if (o.isCSS2DObject) labels.push(o);
    });
    for (const l of labels) l.removeFromParent(); // retire aussi leurs éléments du DOM
    for (const g of this.owned) g.dispose();
    for (const kind of this.crowd.kinds.values()) kind.mesh?.dispose();
    for (const m of [this.sleeperBody, this.sleeperHead, this.sleeperHair]) m.dispose();
    for (const d of this.dynamics) if (d.kind === "pulse" || d.kind === "water") d.obj.material.dispose();
    this.sun.shadow.map?.dispose();
  }
}
