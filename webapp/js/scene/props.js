// Construction procédurale de l'étage façon bureau de série télé : moquette, îlots à
// cloisons en tissu, bureau du directeur à stores, cuisine, entrepôt, studios…

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { AREAS, WALLS, WALL_H, ROOM_DESKS, MEETING_SEATS, PODS, BOUNDS, BINS, INTERN_POD, EOTM_TOTEM } from "./layout.js";
import { mat } from "./people.js";

export const MONITOR_IDLE = new THREE.Color("#2b3150");
export const MONITOR_ON = new THREE.Color("#ffffff");

const geoCache = new Map();
function boxGeo(w, h, d) {
  const key = `${w}|${h}|${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}

function addBox(parent, w, h, d, material, x, y, z, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(boxGeo(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function addCyl(parent, rTop, rBottom, h, material, x, y, z, segments = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function group(parent, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

const M = {
  desk: mat("#c8a97e", { roughness: 0.6 }),
  deskGrey: mat("#d9d4c7"),
  deskDark: mat("#4a3426", { roughness: 0.55 }),
  metal: mat("#6b7280", { metalness: 0.45, roughness: 0.45 }),
  dark: mat("#20232e"),
  keyboard: mat("#2f3342"),
  chair: mat("#2b2b2e"),
  chairLeather: mat("#3a2219", { roughness: 0.5 }),
  fabric: mat("#9fb0c0", { roughness: 1 }),
  wall: mat("#e6dccb"),
  wallTrim: mat("#c7b99f"),
  frame: mat("#4b5160", { metalness: 0.4, roughness: 0.45 }),
  glass: new THREE.MeshStandardMaterial({ color: "#cfe8ff", transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false }),
  blinds: new THREE.MeshStandardMaterial({ color: "#efe9dc", transparent: true, opacity: 0.55, roughness: 0.8, depthWrite: false }),
  window: new THREE.MeshStandardMaterial({ color: "#a9d8ff", emissive: "#8fcfff", emissiveIntensity: 0.9, roughness: 0.2 }),
  pot: mat("#c4774b"),
  leaf: mat("#3f9b5b"),
  leaf2: mat("#2f7d48"),
  wood: mat("#9c6b43"),
  woodLight: mat("#c89b6d"),
  shelf: mat("#6e4a2f"),
  sofaBlue: mat("#3f5aa6"),
  sofaRed: mat("#a8443a"),
  white: mat("#f4f4f6"),
  gold: mat("#d9a93f", { metalness: 0.7, roughness: 0.3 }),
  cardboard: mat("#b98a55"),
  cardboard2: mat("#a77945"),
  rack: mat("#1b1e27", { metalness: 0.3 }),
  steel: mat("#8d949e", { metalness: 0.6, roughness: 0.4 }),
  yellow: mat("#f2c14e"),
  green: mat("#2fbf71"),
  greenScreen: mat("#22c55e", { roughness: 1 }),
};

// Écran dont le contenu est dessiné sur un canvas (KPI, agenda, kanban, tableau blanc…).
export class CanvasScreen {
  constructor(w, h, { px = 640, transparent = false, glow = true } = {}) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = px;
    this.canvas.height = Math.round((px * h) / w);
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const material = glow
      ? new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false, transparent })
      : new THREE.MeshStandardMaterial({ map: this.texture, transparent, roughness: 0.9 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    this.mesh.userData.dynamic = true;
  }

  draw(fn) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fn(ctx, canvas.width, canvas.height);
    this.texture.needsUpdate = true;
  }
}

function canvasTexture(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function codeTexture() {
  return canvasTexture(256, 150, (ctx) => {
    ctx.fillStyle = "#121628";
    ctx.fillRect(0, 0, 256, 150);
    const colors = ["#7c6cff", "#4cc38a", "#f2c14e", "#5aa9e6", "#ef7fa6", "#c9cfe6"];
    for (let y = 10; y < 145; y += 11) {
      let x = 10 + (Math.floor(y / 11) % 4) * 12;
      while (x < 230) {
        const w = 12 + Math.random() * 40;
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, Math.min(w, 246 - x), 5);
        x += w + 6;
        if (Math.random() < 0.25) break;
      }
    }
  });
}

function floorTexture(color, line, { size = 256, tiles = 6, repeat = [1, 1], checker = null, speckle = false } = {}) {
  const tex = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    const step = size / tiles;
    if (checker) {
      ctx.fillStyle = checker;
      for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) if ((i + j) % 2) ctx.fillRect(i * step, j * step, step, step);
    }
    if (speckle) {
      // Moquette de bureau : petites fibres plus claires et plus foncées.
      for (let i = 0; i < size * 6; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
        ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
      }
    }
    if (line) {
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      for (let i = 0; i <= tiles; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step, size);
        ctx.moveTo(0, i * step);
        ctx.lineTo(size, i * step);
        ctx.stroke();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  return tex;
}

// ---------------------------------------------------------------------------
// Mobilier

function chair(parent, material) {
  addBox(parent, 0.48, 0.07, 0.46, material, 0, 0.45, 0);
  addBox(parent, 0.46, 0.5, 0.06, material, 0, 0.76, -0.25);
  addCyl(parent, 0.03, 0.03, 0.38, M.metal, 0, 0.23, 0, 8);
  addCyl(parent, 0.24, 0.26, 0.04, M.metal, 0, 0.03, 0, 10);
}

function workstation(parent, nav, seat, { deskMat = M.desk, chairMat = M.chair, extras = true }) {
  const w = seat.w || 1.6;
  const g = group(parent, seat.x, seat.z, seat.facing);
  chair(g, chairMat);
  const desk = new THREE.Group();
  desk.position.z = 0.85;
  g.add(desk);
  addBox(desk, w, 0.05, 0.8, deskMat, 0, 0.74, 0);
  addBox(desk, 0.05, 0.72, 0.7, M.metal, -w / 2 + 0.06, 0.36, 0);
  addBox(desk, 0.05, 0.72, 0.7, M.metal, w / 2 - 0.06, 0.36, 0);
  addBox(desk, w - 0.2, 0.32, 0.03, deskMat, 0, 0.52, 0.36);

  for (const ox of seat.dual ? [-0.36, 0.36] : [0]) {
    addBox(desk, 0.05, 0.22, 0.05, M.dark, ox, 0.88, 0.2);
    addBox(desk, 0.22, 0.02, 0.14, M.dark, ox, 0.775, 0.2);
    addBox(desk, 0.66, 0.4, 0.035, M.dark, ox, 1.12, 0.2);
    // Emplacement de l'écran : tous les écrans sont ensuite dessinés en un seul maillage instancié.
    const slot = new THREE.Object3D();
    slot.position.set(ox, 1.12, 0.18);
    slot.rotation.y = Math.PI;
    slot.userData.monitor = seat.id;
    desk.add(slot);
  }
  addBox(desk, 0.44, 0.02, 0.14, M.keyboard, 0, 0.775, -0.15);
  if (extras) {
    const r = Math.random();
    if (r < 0.5) addCyl(desk, 0.04, 0.035, 0.1, mat(["#ef7fa6", "#f2c14e", "#4cc38a", "#ffffff"][Math.floor(Math.random() * 4)]), w / 2 - 0.25, 0.81, -0.1, 10);
    else if (r < 0.8) addBox(desk, 0.22, 0.04, 0.3, mat("#f7f3e8"), -w / 2 + 0.3, 0.785, -0.05);
    if (Math.random() < 0.35) addBox(desk, 0.12, 0.04, 0.05, M.dark, w / 2 - 0.45, 0.785, 0.05); // agrafeuse
  }
  const fx = Math.sin(seat.facing);
  const fz = Math.cos(seat.facing);
  nav.blockBox(seat.x + fx * 0.85, seat.z + fz * 0.85, w, 0.8, Math.abs(fx) > 0.5);
  return { group: g };
}

function plant(parent, nav, x, z, scale = 1) {
  const g = group(parent, x, z);
  g.scale.setScalar(scale);
  addCyl(g, 0.24, 0.18, 0.42, M.pot, 0, 0.21, 0, 14);
  for (const [lx, ly, lz, r, m] of [[0, 0.75, 0, 0.32, M.leaf], [0.14, 0.95, 0.06, 0.24, M.leaf2], [-0.12, 1.02, -0.05, 0.22, M.leaf], [0.02, 1.2, 0.02, 0.18, M.leaf2]]) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), m);
    leaf.position.set(lx, ly, lz);
    leaf.castShadow = true;
    g.add(leaf);
  }
  nav.blockBox(x, z, 0.5 * scale, 0.5 * scale, false, 0.1);
}

function sofa(parent, nav, x, z, rotY, w, material) {
  const g = group(parent, x, z, rotY);
  addBox(g, w, 0.42, 0.85, material, 0, 0.21, 0);
  addBox(g, w, 0.5, 0.2, material, 0, 0.6, -0.33);
  addBox(g, 0.18, 0.3, 0.85, material, -w / 2 + 0.09, 0.55, 0);
  addBox(g, 0.18, 0.3, 0.85, material, w / 2 - 0.09, 0.55, 0);
  nav.blockBox(x, z, w, 0.85, Math.abs(Math.sin(rotY)) > 0.5);
}

function bookshelf(parent, nav, x, z, rotY, w = 2.6, h = 2.2, d = 0.42) {
  const g = group(parent, x, z, rotY);
  addBox(g, w, h, 0.04, M.shelf, 0, h / 2, -d / 2 + 0.02);
  addBox(g, 0.05, h, d, M.shelf, -w / 2, h / 2, 0);
  addBox(g, 0.05, h, d, M.shelf, w / 2, h / 2, 0);
  const levels = 5;
  const palette = ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad", "#16a085", "#d35400", "#ecf0f1", "#34495e"];
  const books = [];
  for (let i = 0; i <= levels; i++) {
    const y = 0.06 + (i * (h - 0.1)) / levels;
    addBox(g, w, 0.04, d, M.shelf, 0, y, 0, { cast: false });
    if (i === levels) break;
    let bx = -w / 2 + 0.08;
    while (bx < w / 2 - 0.12) {
      const bw = 0.05 + Math.random() * 0.05;
      const bh = 0.24 + Math.random() * 0.12;
      if (Math.random() < 0.08) {
        bx += 0.15;
        continue;
      }
      books.push({ x: bx + bw / 2, y: y + 0.02 + bh / 2, z: 0.02, w: bw, h: bh, d: d - 0.12, color: palette[Math.floor(Math.random() * palette.length)] });
      bx += bw + 0.008;
    }
  }
  const inst = new THREE.InstancedMesh(boxGeo(1, 1, 1), mat("#ffffff"), books.length);
  const m4 = new THREE.Matrix4();
  const color = new THREE.Color();
  books.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, color.set(b.color));
  });
  inst.castShadow = true;
  g.add(inst);
  nav.blockBox(x, z, w, d, Math.abs(Math.sin(rotY)) > 0.5);
}

// Étagère métallique chargée de cartons (entrepôt, archives).
function boxRack(parent, nav, x, z, rotY, w = 2.6, h = 2.1, d = 0.6) {
  const g = group(parent, x, z, rotY);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBox(g, 0.05, h, 0.05, M.steel, sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03));
  for (let i = 0; i < 4; i++) {
    const y = 0.1 + i * 0.66;
    addBox(g, w, 0.04, d, M.steel, 0, y, 0, { cast: false });
    if (i === 3) break;
    let bx = -w / 2 + 0.1;
    while (bx < w / 2 - 0.35) {
      const bw = 0.35 + Math.random() * 0.3;
      const bh = 0.25 + Math.random() * 0.3;
      if (Math.random() < 0.85) addBox(g, bw, bh, d - 0.1, Math.random() < 0.5 ? M.cardboard : M.cardboard2, bx + bw / 2, y + 0.02 + bh / 2, 0);
      bx += bw + 0.05;
    }
  }
  nav.blockBox(x, z, w, d, Math.abs(Math.sin(rotY)) > 0.5);
}

function serverRack(parent, nav, x, z, rotY, leds) {
  const g = group(parent, x, z, rotY);
  addBox(g, 0.62, 2, 0.7, M.rack, 0, 1, 0);
  for (let i = 0; i < 9; i++) {
    addBox(g, 0.54, 0.16, 0.02, M.dark, 0, 0.25 + i * 0.19, 0.36, { cast: false });
    const ledMat = new THREE.MeshBasicMaterial({ color: i % 3 ? "#4cc38a" : "#5aa9e6", toneMapped: false });
    const led = addBox(g, 0.04, 0.03, 0.02, ledMat, 0.2, 0.25 + i * 0.19, 0.375, { cast: false });
    led.userData.dynamic = true;
    leds.push(ledMat);
  }
  nav.blockBox(x, z, 0.62, 0.7, Math.abs(Math.sin(rotY)) > 0.5);
}

function cartons(parent, nav, x, z, count = 3) {
  const g = group(parent, x, z, Math.random() * 0.4 - 0.2);
  let y = 0;
  for (let i = 0; i < count; i++) {
    const s = 0.55 - i * 0.06;
    addBox(g, s, 0.4, s, i % 2 ? M.cardboard2 : M.cardboard, (Math.random() - 0.5) * 0.08, y + 0.2, (Math.random() - 0.5) * 0.08);
    y += 0.4;
  }
  nav.blockBox(x, z, 0.6, 0.6, false, 0.1);
}

function roundTable(parent, nav, x, z, { height = 0.74, radius = 0.6, chairs = true, material = M.white } = {}) {
  const g = group(parent, x, z);
  addCyl(g, radius, radius, 0.05, material, 0, height, 0, 24);
  addCyl(g, 0.05, 0.05, height, M.metal, 0, height / 2, 0, 8);
  addCyl(g, 0.3, 0.32, 0.04, M.metal, 0, 0.02, 0, 16);
  if (chairs) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const c = group(g, Math.sin(a) * (radius + 0.3), Math.cos(a) * (radius + 0.3), a + Math.PI);
      chair(c, M.chair);
    }
  }
  nav.blockBox(x, z, radius * 2, radius * 2, false, 0.05);
}

function pottedTree(parent, nav, x, z) {
  plant(parent, nav, x, z, 1.25);
}

// ---------------------------------------------------------------------------
// Murs

function wallPieces(from, to, gaps = []) {
  const horizontal = from[1] === to[1];
  const a = horizontal ? Math.min(from[0], to[0]) : Math.min(from[1], to[1]);
  const b = horizontal ? Math.max(from[0], to[0]) : Math.max(from[1], to[1]);
  const pieces = [];
  let cursor = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > cursor) pieces.push([cursor, g0]);
    cursor = Math.max(cursor, g1);
  }
  if (cursor < b) pieces.push([cursor, b]);
  const fixed = horizontal ? from[1] : from[0];
  return { horizontal, fixed, pieces, gaps };
}

function partition(parent, nav, wall) {
  const { horizontal, fixed, pieces, gaps } = wallPieces(wall.from, wall.to, wall.gaps);
  const place = (m, along, y) => (horizontal ? m.position.set(along, y, fixed) : m.position.set(fixed, y, along));
  if (wall.kind === "solid") {
    // Mur plein (entre l'entrepôt et la salle de sport).
    for (const [p0, p1] of pieces) {
      const len = p1 - p0;
      place(addBox(parent, horizontal ? len : 0.16, WALL_H, horizontal ? 0.16 : len, M.wall, 0, 0, 0), (p0 + p1) / 2, WALL_H / 2);
      place(addBox(parent, horizontal ? len : 0.18, 0.12, horizontal ? 0.18 : len, M.wallTrim, 0, 0, 0, { cast: false }), (p0 + p1) / 2, 0.06);
      if (horizontal) nav.blockRect(p0, fixed - 0.08, p1, fixed + 0.08, 0.18);
      else nav.blockRect(fixed - 0.08, p0, fixed + 0.08, p1, 0.18);
    }
    return;
  }
  const base = wall.kind === "half" ? 1.1 : 0.12;
  for (const [p0, p1] of pieces) {
    const len = p1 - p0;
    const mid = (p0 + p1) / 2;
    const sx = horizontal ? len : 0.12;
    const sz = horizontal ? 0.12 : len;
    place(addBox(parent, sx, base, sz, wall.kind === "half" ? M.wall : M.frame, 0, 0, 0), mid, base / 2);
    place(addBox(parent, sx, 0.06, sz, M.frame, 0, 0, 0, { cast: false }), mid, WALL_H - 0.03);
    const pane = wall.kind === "blinds" ? M.blinds : M.glass;
    const glass = new THREE.Mesh(boxGeo(horizontal ? len : 0.03, WALL_H - base - 0.06, horizontal ? 0.03 : len), pane);
    place(glass, mid, base + (WALL_H - base - 0.06) / 2);
    glass.renderOrder = 2;
    parent.add(glass);
    if (wall.kind === "blinds") {
      // Lamelles des stores (le bureau du directeur, évidemment).
      for (let y = base + 0.15; y < WALL_H - 0.1; y += 0.16) {
        place(addBox(parent, horizontal ? len - 0.05 : 0.04, 0.025, horizontal ? 0.04 : len - 0.05, M.white, 0, 0, 0, { cast: false, receive: false }), mid, y);
      }
    }
    const posts = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= posts; i++) {
      place(addBox(parent, 0.07, WALL_H, 0.07, M.frame, 0, 0, 0, { receive: false }), p0 + (len * i) / posts, WALL_H / 2);
    }
    if (horizontal) nav.blockRect(p0, fixed - 0.05, p1, fixed + 0.05, 0.18);
    else nav.blockRect(fixed - 0.05, p0, fixed + 0.05, p1, 0.18);
  }
  for (const [g0, g1] of gaps || []) {
    const len = g1 - g0;
    place(addBox(parent, horizontal ? len : 0.12, 0.12, horizontal ? 0.12 : len, M.frame, 0, 0, 0, { cast: false }), (g0 + g1) / 2, WALL_H - 0.06);
  }
}

function outerWall(parent, nav, wall, windowsAt) {
  const g = new THREE.Group();
  g.userData.noMerge = true;
  parent.add(g);
  const { horizontal, fixed, pieces } = wallPieces(wall.from, wall.to, wall.gaps);
  const t = 0.25;
  const offset = fixed === BOUNDS.minX || fixed === BOUNDS.minZ ? -t / 2 : t / 2;
  const inward = -Math.sign(offset);
  for (const [p0, p1] of pieces) {
    const len = p1 - p0;
    const m = addBox(g, horizontal ? len : t, WALL_H, horizontal ? t : len, M.wall, 0, 0, 0);
    if (horizontal) m.position.set((p0 + p1) / 2, WALL_H / 2, fixed + offset);
    else m.position.set(fixed + offset, WALL_H / 2, (p0 + p1) / 2);
    const trim = addBox(g, horizontal ? len : t + 0.02, 0.12, horizontal ? t + 0.02 : len, M.wallTrim, 0, 0, 0, { cast: false });
    trim.position.copy(m.position);
    trim.position.y = 0.06;
    if (horizontal) nav.blockRect(p0, fixed - 0.1, p1, fixed + 0.1, 0.25);
    else nav.blockRect(fixed - 0.1, p0, fixed + 0.1, p1, 0.25);
  }
  for (const along of windowsAt) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.25), M.window);
    const sill = addBox(g, horizontal ? 1.95 : 0.08, 0.06, horizontal ? 0.08 : 1.95, M.wallTrim, 0, 0, 0, { cast: false });
    if (horizontal) {
      win.position.set(along, 1.55, fixed + inward * 0.012);
      win.rotation.y = inward > 0 ? 0 : Math.PI;
      sill.position.set(along, 0.9, fixed + inward * 0.04);
    } else {
      win.position.set(fixed + inward * 0.012, 1.55, along);
      win.rotation.y = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
      sill.position.set(fixed + inward * 0.04, 0.9, along);
    }
    g.add(win);
  }
  const normal = horizontal ? new THREE.Vector3(0, 0, inward) : new THREE.Vector3(inward, 0, 0);
  const point = horizontal ? new THREE.Vector3(0, 0, fixed) : new THREE.Vector3(fixed, 0, 0);
  return { group: g, normal, point };
}

function screenOn(parent, screen, x, y, z, rotY = 0, frame = true) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  const { width, height } = screen.mesh.geometry.parameters;
  if (frame) addBox(g, width + 0.12, height + 0.12, 0.06, M.dark, 0, 0, -0.035, { cast: false });
  screen.mesh.position.z = 0.002;
  g.add(screen.mesh);
  return g;
}


// ---------------------------------------------------------------------------
// Aile Est : studio marketing, juridique, salle de repos (et ses chats), salle de sport, RH

function beanBag(parent, nav, x, z, color) {
  const g = group(parent, x, z);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(color, { roughness: 1 }));
  m.scale.set(1, 0.55, 1);
  m.position.y = 0.22;
  m.castShadow = true;
  g.add(m);
  nav.blockBox(x, z, 0.7, 0.7, false, 0.05);
}

function catBed(parent, x, z, color = "#c96b5b") {
  const g = group(parent, x, z);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 20), mat(color, { roughness: 1 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.07;
  g.add(rim);
  addCyl(g, 0.22, 0.22, 0.05, mat("#f3e9dc", { roughness: 1 }), 0, 0.03, 0, 18);
}

function catTree(parent, nav, x, z) {
  const g = group(parent, x, z);
  const sisal = mat("#d9b98c", { roughness: 1 });
  const plush = mat("#8d7a6a", { roughness: 1 });
  addBox(g, 0.8, 0.06, 0.8, plush, 0, 0.03, 0);
  addCyl(g, 0.06, 0.06, 1.6, sisal, -0.2, 0.8, -0.2, 10);
  addCyl(g, 0.06, 0.06, 1.1, sisal, 0.22, 0.55, 0.2, 10);
  addBox(g, 0.55, 0.05, 0.5, plush, 0.15, 0.62, 0.15);
  addBox(g, 0.4, 0.3, 0.4, plush, 0.15, 1.27, 0.12); // niche
  addBox(g, 0.5, 0.04, 0.5, plush, 0, 1.62, 0);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat("#ff4d6d"));
  ball.position.set(0.3, 1.42, 0.25);
  g.add(ball);
  nav.blockBox(x, z, 0.8, 0.8, false, 0.05);
}

function arcade(parent, nav, x, z, screen) {
  const g = group(parent, x, z, 0);
  addBox(g, 0.7, 1.75, 0.6, mat("#3d348b"), 0, 0.875, 0);
  addBox(g, 0.72, 0.25, 0.66, mat("#f7b801"), 0, 1.86, 0.02);
  addBox(g, 0.6, 0.06, 0.3, M.dark, 0, 1.0, 0.36);
  for (const [bx, c] of [[-0.12, "#ef476f"], [0.02, "#06d6a0"], [0.14, "#ffd166"]]) addCyl(g, 0.025, 0.025, 0.03, mat(c), bx, 1.04, 0.42, 8);
  screenOn(g, screen, 0, 1.42, 0.31, 0, false);
  nav.blockBox(x, z, 0.7, 0.6, false, 0.05);
}

function treadmill(parent, nav, x, z) {
  const g = group(parent, x, z);
  addBox(g, 0.75, 0.16, 1.6, M.dark, 0, 0.08, 0);
  addBox(g, 0.55, 0.02, 1.4, mat("#2b2b2b", { roughness: 1 }), 0, 0.17, 0.05, { cast: false });
  for (const sx of [-0.33, 0.33]) addBox(g, 0.05, 1.05, 0.05, M.steel, sx, 0.6, -0.72);
  addBox(g, 0.72, 0.28, 0.12, M.dark, 0, 1.15, -0.72);
  addBox(g, 0.4, 0.16, 0.02, new THREE.MeshBasicMaterial({ color: "#4cc9f0", toneMapped: false }), 0, 1.18, -0.65, { cast: false });
  nav.blockBox(x, z - 0.6, 0.8, 0.3, false, 0.05);
}

function balloon(parent, x, y, z, color) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mat(color, { roughness: 0.3 }));
  b.scale.set(1, 1.2, 1);
  b.position.set(x, y, z);
  parent.add(b);
  addCyl(parent, 0.004, 0.004, y - 0.8, mat("#ffffff"), x, (y + 0.8) / 2 - 0.08, z, 4);
}

function buildEastWing({ rooms, nav, screens, station }) {
  // ---- Studio Marketing : moodboard, écran de performance pub
  {
    const g = rooms.marketing;
    for (const seat of ROOM_DESKS.marketing) station(g, seat, { chairMat: mat("#ff8a5b"), deskMat: M.woodLight });
    screens.moodboard = new CanvasScreen(3.2, 1.5, { px: 640, glow: false });
    screenOn(g, screens.moodboard, 28.4, 1.65, -16.84);
    screens.ads = new CanvasScreen(2.2, 1.2, { px: 480 });
    screenOn(g, screens.ads, 31.5, 1.7, -16.84);
    // Nuancier et lampe d'architecte
    const swatch = group(g, 32.6, -9.9);
    const colors = ["#ff8a5b", "#f7c948", "#06d6a0", "#118ab2", "#ef476f", "#8338ec"];
    colors.forEach((c, i) => addBox(swatch, 0.05, 0.3, 0.08, mat(c), -0.15 + i * 0.06, 1.0, 0));
    addBox(swatch, 0.4, 0.85, 0.3, M.white, 0, 0.42, 0);
    nav.blockBox(32.6, -9.9, 0.45, 0.35, false, 0.05);
    plant(g, nav, 26.6, -9.8, 1.0);
  }

  // ---- Juridique & Admin : bibliothèque de codes, classeurs, balance de la justice
  {
    const g = rooms.legal;
    for (const seat of ROOM_DESKS.legal) station(g, seat, { deskMat: M.deskDark, chairMat: M.chairLeather });
    bookshelf(g, nav, 34.6, -16.66, 0, 2.6);
    screens.legal = new CanvasScreen(2.4, 1.2, { px: 520 });
    screenOn(g, screens.legal, 38.3, 1.7, -16.84);
    for (const z of [-10.4, -11.2]) addBox(g, 0.5, 1.3, 0.6, mat("#7d8597", { metalness: 0.3 }), 39.55, 0.65, z);
    nav.blockRect(39.25, -11.55, 39.85, -10.05, 0.1);
    // Balance sur le bureau de la juriste
    const scale = group(g, 35.55, -14.35);
    const brass = mat("#c9a227", { metalness: 0.6, roughness: 0.35 });
    addCyl(scale, 0.06, 0.08, 0.03, brass, 0, 0.79, 0, 12);
    addCyl(scale, 0.01, 0.01, 0.3, brass, 0, 0.94, 0, 6);
    addBox(scale, 0.34, 0.012, 0.012, brass, 0, 1.08, 0);
    for (const sx of [-0.16, 0.16]) addCyl(scale, 0.05, 0.04, 0.012, brass, sx, 0.98, 0, 12);
    plant(g, nav, 33.6, -9.8, 0.9);
  }

  // ---- Salle de repos : canapés, poufs, télé, borne d'arcade, arbre à chat
  {
    const g = rooms.lounge;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4), mat("#e9c46a", { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(35.5, 0.012, -3.2);
    g.add(rug);
    sofa(g, nav, 35.5, -3.65, Math.PI, 2.4, mat("#2a9d8f"));
    sofa(g, nav, 38.95, -1.5, -Math.PI / 2, 2.2, mat("#e76f51"));
    // Meuble télé + écran
    addBox(g, 2.2, 0.45, 0.45, M.wood, 35.5, 0.225, -6.6);
    addBox(g, 0.3, 0.06, 0.15, M.dark, 36.2, 0.48, -6.55);
    nav.blockBox(35.5, -6.6, 2.2, 0.45);
    screens.lounge = new CanvasScreen(1.9, 1.05, { px: 480 });
    const tv = screenOn(g, screens.lounge, 35.5, 1.15, -6.62);
    addBox(tv, 0.1, 0.45, 0.06, M.dark, 0, -0.62, -0.05);
    screens.arcade = new CanvasScreen(0.48, 0.36, { px: 160 });
    arcade(g, nav, 33.4, -6.4, screens.arcade);
    catTree(g, nav, 32.0, -6.2);
    beanBag(g, nav, 32.7, -0.6, "#8338ec");
    beanBag(g, nav, 32.9, 1.5, "#ffbe0b");
    roundTable(g, nav, 35.0, 1.3, { radius: 0.5, chairs: false });
    for (const seat of SPOTS_TABLE) chair(group(g, seat.x, seat.z, seat.facing), M.chair);
    catBed(g, 39.3, -6.3, "#c96b5b");
    catBed(g, 39.2, 3.3, "#577590");
    catBed(g, 37.2, -6.55, "#9d4edd");
    for (const [bx, c] of [[37.8, "#ef476f"], [38.25, "#118ab2"]]) {
      addCyl(g, 0.11, 0.13, 0.06, mat(c), bx, 0.03, 3.45, 14);
      addCyl(g, 0.09, 0.09, 0.02, mat("#8d5524"), bx, 0.06, 3.45, 12);
    }
    plant(g, nav, 39.4, 0.6, 1.1);
    plant(g, nav, 31.6, 3.4, 0.9);
    const yarn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat("#ff8fab"));
    yarn.position.set(36.6, 0.07, -1.6);
    g.add(yarn);
  }

  // ---- Salle de sport : tapis de course, sac de frappe, tapis de yoga, dojo de Bertrand
  {
    const g = rooms.gym;
    treadmill(g, nav, 27.6, 15.2);
    treadmill(g, nav, 29.4, 15.2);
    const dojo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), mat("#c1121f", { roughness: 1 }));
    dojo.rotation.x = -Math.PI / 2;
    dojo.position.set(28.2, 0.014, 11.8);
    g.add(dojo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.82, 32), mat("#ffffff"));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(28.2, 0.016, 11.8);
    g.add(ring);
    for (const [z, c] of [[13.6, "#8338ec"], [14.6, "#06d6a0"], [15.6, "#ff8fab"]]) {
      const yoga = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), mat(c, { roughness: 1 }));
      yoga.rotation.x = -Math.PI / 2;
      yoga.position.set(31.6, 0.016, z);
      g.add(yoga);
    }
    // Sac de frappe suspendu
    addCyl(g, 0.01, 0.01, 0.75, M.steel, 32.2, 2.3, 11.4, 6);
    addCyl(g, 0.2, 0.2, 0.95, mat("#7a1f1f"), 32.2, 1.45, 11.4, 14);
    nav.blockBox(32.2, 11.4, 0.45, 0.45, false, 0.05);
    // Râtelier d'haltères
    addBox(g, 0.4, 0.8, 1.6, M.dark, 26.35, 0.4, 13.6);
    for (let i = 0; i < 4; i++) for (const y of [0.35, 0.7]) addCyl(g, 0.07, 0.07, 0.3, mat(i % 2 ? "#e63946" : "#1d3557"), 26.45, y, 13.0 + i * 0.4, 10).rotation.x = Math.PI / 2;
    nav.blockBox(26.35, 13.6, 0.4, 1.6);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshStandardMaterial({ color: "#cfe6ff", metalness: 0.9, roughness: 0.08 }));
    mirror.position.set(26.1, 1.4, 11.2);
    mirror.rotation.y = Math.PI / 2;
    g.add(mirror);
    plant(g, nav, 32.4, 16.4);
  }

  // ---- Bureau RH : boîte à suggestions, plante triste de Gérard, ballons d'Amandine, mur des champions
  {
    const g = rooms.hr;
    for (const seat of ROOM_DESKS.hr) station(g, seat, { chairMat: mat("#f28482") });
    addCyl(g, 0.03, 0.05, 1.0, M.metal, 34.0, 0.5, 9.9, 8);
    addBox(g, 0.36, 0.16, 0.3, mat("#b08968"), 34.0, 1.08, 9.9);
    addBox(g, 0.16, 0.012, 0.02, M.dark, 34.0, 1.165, 9.9, { cast: false });
    nav.blockBox(34.0, 9.9, 0.4, 0.4, false, 0.05);
    // Plante triste (tiges tombantes)
    const sad = group(g, 34.5, 14.4);
    addCyl(sad, 0.07, 0.06, 0.12, M.pot, 0, 0.84, 0, 10);
    for (let i = 0; i < 4; i++) {
      const leaf = addBox(sad, 0.02, 0.18, 0.05, mat("#8a9a5b"), Math.cos(i * 1.6) * 0.05, 0.9, Math.sin(i * 1.6) * 0.05);
      leaf.rotation.z = (i % 2 ? 1 : -1) * 1.1;
    }
    for (const [x, c, y] of [[39.1, "#ff8fab", 1.55], [39.3, "#ffd166", 1.7], [38.9, "#4cc9f0", 1.62]]) balloon(g, x, y, 14.4, c);
    for (const z of [11.0, 11.8]) addBox(g, 0.5, 1.2, 0.6, mat("#a5a58d"), 39.55, 0.6, z);
    nav.blockRect(39.25, 10.65, 39.85, 12.15, 0.1);
    screens.hrWall = new CanvasScreen(2.4, 1.3, { px: 520 });
    screenOn(g, screens.hrWall, 33.1, 1.6, 12.8, Math.PI / 2);
    for (const x of [34.6, 38.0]) {
      chair(group(g, x, 12.6, 0), M.chair);
      nav.blockBox(x, 12.6, 0.5, 0.5, false, 0.05);
    }
  }

  // ---- Totem « Employé du mois » à l'entrée et panneau « jours sans incident »
  {
    const g = rooms.openspace;
    screens.eotm = new CanvasScreen(1.3, 1.7, { px: 360 });
    const totem = screenOn(g, screens.eotm, EOTM_TOTEM.x, 1.55, EOTM_TOTEM.z);
    addBox(totem, 0.1, 0.8, 0.1, M.gold, 0, -1.2, -0.06);
    addBox(totem, 0.6, 0.06, 0.4, M.gold, 0, -1.55, -0.06);
    nav.blockBox(EOTM_TOTEM.x, EOTM_TOTEM.z, 0.6, 0.4, false, 0.1);
    screens.incident = new CanvasScreen(1.5, 0.8, { px: 420 });
    const sign = screenOn(g, screens.incident, -10.5, 1.5, 7.9);
    addBox(sign, 0.06, 1.1, 0.06, M.frame, -0.6, -0.75, -0.05);
    addBox(sign, 0.06, 1.1, 0.06, M.frame, 0.6, -0.75, -0.05);
    nav.blockBox(-10.5, 7.9, 1.5, 0.3, false, 0.1);
    screens.interns = new CanvasScreen(1.6, 0.45, { px: 420, glow: false });
    const tag = screenOn(g, screens.interns, 28.5, 1.42, 0.53, 0, false);
    tag.scale.setScalar(0.9);
  }
}

const SPOTS_TABLE = [{ x: 35.0, z: 0.45, facing: 0 }, { x: 35.0, z: 2.15, facing: Math.PI }];

// Déco de saison : citrouilles en octobre, sapin en décembre.
function pumpkin(parent, x, y, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  parent.add(g);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), mat("#f77f00", { roughness: 0.6 }));
  body.scale.set(1.15, 0.85, 1.15);
  body.position.y = 0.13;
  g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 6), mat("#386641"));
  stem.position.y = 0.29;
  g.add(stem);
  for (const sx of [-0.05, 0.05]) {
    const eye = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.04, 3), new THREE.MeshBasicMaterial({ color: "#ffd166", toneMapped: false }));
    eye.position.set(sx, 0.17, 0.175);
    eye.rotation.x = Math.PI / 2;
    g.add(eye);
  }
}

function seasonalDecor(parent, nav, month) {
  if (month === 9) {
    for (const [x, y, z, s] of [[-1.3, 0, 15.6, 1.3], [1.3, 0, 15.6, 1.1], [-4.4, 1.165, 13.6, 0.8], [-22.4, 0.98, 16.5, 0.8], [36.6, 0.45, -6.6, 0.8], [-21.0, 0.77, -13.6, 0.6], [11.8, 0, 9.6, 1.2]]) pumpkin(parent, x, y, z, s);
  } else if (month === 11) {
    const g = group(parent, 2.6, 15.4);
    addCyl(g, 0.08, 0.08, 0.3, M.wood, 0, 0.15, 0, 8);
    [[0.75, 0.9, 0.55], [0.58, 0.75, 1.1], [0.38, 0.6, 1.55]].forEach(([r, h, y]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), mat("#2d6a4f"));
      cone.position.y = y;
      cone.castShadow = true;
      g.add(cone);
    });
    for (let i = 0; i < 12; i++) {
      const a = i * 2.1;
      const y = 0.5 + (i / 12) * 1.3;
      const r = 0.7 - (i / 12) * 0.45;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(["#e63946", "#f7c948", "#4cc9f0"][i % 3], { metalness: 0.5, roughness: 0.3 }));
      ball.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      g.add(ball);
    }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: "#ffd166", toneMapped: false }));
    star.position.y = 1.95;
    g.add(star);
    nav.blockBox(2.6, 15.4, 1.4, 1.4, false, 0.05);
  }
}

// ---------------------------------------------------------------------------
// Fusion des maillages statiques : quelques dizaines d'appels de rendu au lieu de milliers.

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const victims = [];
  root.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || obj.userData.dynamic) return;
    for (let p = obj.parent; p && p !== root; p = p.parent) if (p.userData.noMerge || p.userData.dynamic) return;
    const material = obj.material;
    if (Array.isArray(material)) return;
    const key = `${material.uuid}|${obj.castShadow}|${obj.receiveShadow}|${obj.renderOrder}`;
    if (!buckets.has(key)) buckets.set(key, { material, cast: obj.castShadow, receive: obj.receiveShadow, order: obj.renderOrder, geos: [] });
    const geo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
    geo.applyMatrix4(obj.matrixWorld);
    buckets.get(key).geos.push(geo);
    victims.push(obj);
  });
  for (const obj of victims) obj.removeFromParent();
  const inverse = root.matrixWorld.clone().invert();
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geos, false);
    if (!merged) continue;
    merged.applyMatrix4(inverse);
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.renderOrder = bucket.order;
    root.add(mesh);
    for (const g of bucket.geos) g.dispose();
  }
}

// Tous les écrans d'ordinateur en un seul maillage instancié ; allumer un écran = changer sa couleur.
function buildMonitors(root) {
  root.updateMatrixWorld(true);
  const slots = [];
  root.traverse((obj) => {
    if (obj.userData.monitor) slots.push(obj);
  });
  const material = new THREE.MeshBasicMaterial({ map: codeTexture(), toneMapped: false });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.6, 0.34), material, slots.length);
  const bySeat = new Map();
  slots.forEach((slot, i) => {
    mesh.setMatrixAt(i, slot.matrixWorld);
    mesh.setColorAt(i, MONITOR_IDLE);
    if (!bySeat.has(slot.userData.monitor)) bySeat.set(slot.userData.monitor, []);
    bySeat.get(slot.userData.monitor).push(i);
    slot.removeFromParent();
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.dynamic = true;
  root.parent.add(mesh);
  return {
    set(lit) {
      for (const [seatId, indices] of bySeat) for (const i of indices) mesh.setColorAt(i, lit.has(seatId) ? MONITOR_ON : MONITOR_IDLE);
      mesh.instanceColor.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------------

export function buildOffice(scene, nav) {
  const staticRoot = new THREE.Group();
  scene.add(staticRoot);
  const rooms = {};
  for (const id of Object.keys(AREAS)) {
    const g = new THREE.Group();
    g.name = id;
    staticRoot.add(g);
    rooms[id] = g;
  }
  const fixtures = new THREE.Group(); // murs intérieurs, entrée
  staticRoot.add(fixtures);
  const screens = {};
  const leds = [];
  const outerWalls = [];
  const station = (parent, seat, opts = {}) => workstation(parent, nav, seat, opts);

  // ---- Socle et sols
  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2;
  const cz = (BOUNDS.minZ + BOUNDS.maxZ) / 2;
  addBox(scene, BOUNDS.maxX - BOUNDS.minX + 1.2, 0.5, BOUNDS.maxZ - BOUNDS.minZ + 1.2, mat("#3a3f55"), cx, -0.262, cz, { cast: false });
  const baseTex = floorTexture("#8c9aa6", null, { size: 256, speckle: true, repeat: [18, 9] });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ), new THREE.MeshStandardMaterial({ map: baseTex, roughness: 1 }));
  base.rotation.x = -Math.PI / 2;
  base.position.set(cx, 0, cz);
  base.receiveShadow = true;
  base.userData.walk = true;
  scene.add(base);

  const floors = {
    director: { map: floorTexture("#6b4e3a", "#5d4232", { tiles: 6, repeat: [3, 3] }) },
    meeting: { map: floorTexture("#717d8c", null, { speckle: true, repeat: [4, 3] }) },
    library: { map: floorTexture("#8a5f3c", "#7a5133", { tiles: 6, repeat: [3, 3] }) },
    studio: { color: "#2c3040" },
    montage: { color: "#1e1e2a" },
    createurs: { map: floorTexture("#4a3a5e", null, { speckle: true, repeat: [2, 3] }) },
    kitchen: { map: floorTexture("#e8e2d0", null, { tiles: 8, checker: "#cfc4a8", repeat: [3, 2] }) },
    annexe: { map: floorTexture("#9aa39a", null, { speckle: true, repeat: [2, 2] }) },
    reception: { map: floorTexture("#b9b2a3", null, { speckle: true, repeat: [2, 2] }) },
    photo: { color: "#f2f2f2" },
    warehouse: { map: floorTexture("#9a9a94", "#8d8d86", { tiles: 4, repeat: [4, 2] }) },
    marketing: { map: floorTexture("#d8c3a0", "#c9b38e", { tiles: 8, repeat: [3, 3] }) },
    legal: { map: floorTexture("#2f3b52", null, { speckle: true, repeat: [3, 3] }) },
    lounge: { map: floorTexture("#b98b73", null, { speckle: true, repeat: [3, 4] }) },
    gym: { map: floorTexture("#3a3f47", null, { speckle: true, repeat: [3, 3] }) },
    hr: { map: floorTexture("#c9b8a0", null, { speckle: true, repeat: [3, 3] }) },
  };
  for (const [id, area] of Object.entries(AREAS)) {
    if (!floors[id]) continue;
    const [x0, z0, x1, z1] = area.rect;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ ...floors[id], roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((x0 + x1) / 2, 0.006, (z0 + z1) / 2);
    floor.receiveShadow = true;
    rooms[id].add(floor);
  }

  // ---- Murs
  const windows = {
    "-17": [-24.5, -19.0, -15.5, -8.5, 4.5, 7.2, 28.4, 31.4, 35.2, 38.4],
    17: [-23, -17, -11, -5, 6, 12, 18, 24, 28, 31, 35.4, 38.6],
    x: { "-26": [-6, -2, 2, 6], 40: [-14.5, -11.5, -5.2, -2, 1.6, 11.6, 15] },
  };
  for (const wall of WALLS) {
    if (wall.kind !== "outer") {
      partition(fixtures, nav, wall);
      continue;
    }
    const horizontal = wall.from[1] === wall.to[1];
    const at = horizontal ? windows[String(wall.from[1])] : windows.x[String(wall.from[0])];
    outerWalls.push(outerWall(scene, nav, wall, at || []));
  }

  // ---- Bureau du directeur (stores, bureau en bois, mug du meilleur boss)
  {
    const g = rooms.director;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.6), mat("#7a2e3a"));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-21.5, 0.012, -13.6);
    g.add(rug);
    const ws = station(g, ROOM_DESKS.director[0], { deskMat: M.deskDark, chairMat: M.chairLeather, extras: false });
    addBox(ws.group, 2.32, 0.03, 0.06, M.gold, 0, 0.765, 1.24, { cast: false });
    const mug = new CanvasScreen(0.16, 0.1, { px: 128, glow: false });
    mug.draw((ctx, W, H) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#111";
      ctx.font = "bold 15px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("MEILLEUR BOSS", W / 2, 30);
      ctx.fillText("DU MONDE", W / 2, 54);
    });
    addCyl(g, 0.05, 0.05, 0.11, M.white, -20.75, 0.84, -13.85, 14);
    screenOn(g, mug, -20.75, 0.84, -13.795, 0, false);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat("#3d7ad6"));
    globe.position.set(-22.3, 0.98, -13.8);
    g.add(globe);
    addCyl(g, 0.02, 0.06, 0.18, M.gold, -22.3, 0.85, -13.8, 8);
    for (const x of [-22.5, -20.5]) {
      chair(group(g, x, -12.3, Math.PI), M.chairLeather);
      nav.blockBox(x, -12.3, 0.5, 0.5, false, 0.05);
    }
    bookshelf(g, nav, -25.65, -13.4, Math.PI / 2, 2.6);
    sofa(g, nav, -25.3, -10.4, Math.PI / 2, 1.8, M.sofaRed);
    plant(g, nav, -17.6, -16.4, 1.1);
    screens.director = new CanvasScreen(2.6, 1.3);
    screenOn(g, screens.director, -21.5, 1.75, -16.84);
  }

  // ---- Salle de conférence
  {
    const g = rooms.meeting;
    addBox(g, 6, 0.07, 1.8, M.woodLight, -11.5, 0.74, -13);
    addBox(g, 0.3, 0.7, 1.1, M.metal, -13.5, 0.36, -13);
    addBox(g, 0.3, 0.7, 1.1, M.metal, -9.5, 0.36, -13);
    for (const x of [-13, -11, -9.4]) addCyl(g, 0.05, 0.05, 0.22, M.glass, x, 0.89, -13, 10);
    nav.blockBox(-11.5, -13, 6, 1.8);
    for (const seat of MEETING_SEATS) chair(group(g, seat.x, seat.z, seat.facing), M.chair);
    station(g, ROOM_DESKS.meeting[0]);
    plant(g, nav, -16.4, -16.4);
    screens.meeting = new CanvasScreen(3.2, 1.6);
    screenOn(g, screens.meeting, -11.5, 1.7, -16.84);
    // Gâteau des pots d'équipe (caché tant qu'il n'y a pas de fête)
    const cake = new THREE.Group();
    cake.userData.dynamic = true;
    cake.position.set(-11.5, 0.78, -13);
    const sponge = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20), mat("#f9c6d3"));
    sponge.position.y = 0.1;
    cake.add(sponge);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), mat("#ffffff"));
      candle.position.set(Math.cos(a) * 0.18, 0.25, Math.sin(a) * 0.18);
      cake.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshBasicMaterial({ color: "#ffb703", toneMapped: false }));
      flame.position.set(Math.cos(a) * 0.18, 0.31, Math.sin(a) * 0.18);
      cake.add(flame);
    }
    cake.visible = false;
    g.add(cake);
    screens.cake = cake;
  }

  // ---- Archives
  {
    const g = rooms.library;
    for (const x of [-4.4, -1.6, 1.2]) bookshelf(g, nav, x, -16.66, 0, 2.6);
    bookshelf(g, nav, -3.2, -12.79, 0, 3, 1.6);
    bookshelf(g, nav, -3.2, -13.21, Math.PI, 3, 1.6);
    station(g, ROOM_DESKS.library[0], { deskMat: M.wood });
    station(g, ROOM_DESKS.library[1], { deskMat: M.wood });
    serverRack(g, nav, -5.55, -10.6, Math.PI / 2, leds);
    serverRack(g, nav, -5.55, -11.4, Math.PI / 2, leds);
    addBox(g, 0.9, 0.5, 0.5, M.shelf, 2.4, 0.45, -10.4);
    nav.blockBox(2.4, -10.4, 0.9, 0.5, false, 0.1);
    screens.library = new CanvasScreen(1.5, 0.9, { px: 480 });
    const totem = screenOn(g, screens.library, -4.6, 1.45, -9.75);
    addBox(totem, 0.08, 1.0, 0.08, M.frame, 0, -0.95, -0.05);
    nav.blockBox(-4.6, -9.75, 0.4, 0.3, false, 0.1);
  }

  // ---- Studio Web & Tech
  {
    const g = rooms.studio;
    for (const seat of ROOM_DESKS.studio) station(g, seat, { chairMat: mat("#5b3fd6"), deskMat: mat("#3a3f52") });
    const neon = new THREE.MeshBasicMaterial({ color: "#8b6cff", toneMapped: false });
    addBox(g, 9.8, 0.04, 0.04, neon, 8, 0.08, -16.8, { cast: false });
    screens.studio = new CanvasScreen(2.6, 1.4);
    screenOn(g, screens.studio, 11.4, 1.7, -16.84);
    plant(g, nav, 12.3, -9.7);
  }

  // ---- Studio Montage (TikTok) : fond vert, anneau lumineux, caméra
  {
    const g = rooms.montage;
    for (const seat of ROOM_DESKS.montage) station(g, seat, { chairMat: mat("#ff3d7f"), deskMat: mat("#2a2a35") });
    addBox(g, 3.4, 2.4, 0.05, M.greenScreen, 16.6, 1.25, -16.85, { cast: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 40), new THREE.MeshBasicMaterial({ color: "#fff7e0", toneMapped: false }));
    ring.position.set(16.6, 1.55, -14.6);
    g.add(ring);
    addCyl(g, 0.02, 0.02, 1.5, M.dark, 16.6, 0.75, -14.6, 8);
    addCyl(g, 0.2, 0.22, 0.03, M.dark, 16.6, 0.02, -14.6, 12);
    addBox(g, 0.28, 0.16, 0.18, M.dark, 15.4, 1.4, -14.2);
    for (const a of [0, 2.1, 4.2]) {
      const leg = addCyl(g, 0.015, 0.015, 1.35, M.metal, 15.4 + Math.sin(a) * 0.2, 0.66, -14.2 + Math.cos(a) * 0.2, 6);
      leg.rotation.z = Math.sin(a) * 0.15;
      leg.rotation.x = Math.cos(a) * 0.15;
    }
    nav.blockBox(16.6, -14.6, 0.5, 0.5, false, 0.1);
    nav.blockBox(15.4, -14.2, 0.5, 0.5, false, 0.1);
    screens.montage = new CanvasScreen(1.6, 0.9, { px: 480 });
    screenOn(g, screens.montage, 14.0, 1.7, -16.84);
  }

  // ---- Pôle Créateurs (en préparation)
  {
    const g = rooms.createurs;
    for (const seat of ROOM_DESKS.createurs) station(g, seat, { chairMat: mat("#9d4edd") });
    cartons(g, nav, 24.9, -15.9, 3);
    cartons(g, nav, 20.9, -16.0, 2);
    sofa(g, nav, 23, -16.3, 0, 1.8, mat("#c77dff"));
    screens.createurs = new CanvasScreen(2.4, 1.1, { px: 560 });
    screenOn(g, screens.createurs, 23, 2.05, -16.84);
  }

  // ---- Cuisine : distributeurs, frigo, micro-ondes, tables, tableau blanc
  {
    const g = rooms.kitchen;
    addBox(g, 4, 0.92, 0.6, M.woodLight, -23.6, 0.46, 16.55);
    addBox(g, 4.1, 0.05, 0.66, M.white, -23.6, 0.95, 16.55);
    addBox(g, 0.42, 0.48, 0.36, M.dark, -25, 1.22, 16.6);
    addBox(g, 0.06, 0.06, 0.02, new THREE.MeshBasicMaterial({ color: "#ff4d4d", toneMapped: false }), -24.9, 1.35, 16.41, { cast: false });
    addBox(g, 0.55, 0.32, 0.38, M.white, -23.3, 1.14, 16.6);
    addBox(g, 0.36, 0.22, 0.02, M.dark, -23.36, 1.14, 16.4, { cast: false });
    addBox(g, 0.8, 1.9, 0.7, M.white, -20.9, 0.95, 16.5);
    nav.blockRect(-25.7, 16.2, -20.4, 16.9, 0.15);
    const snacks = canvasTexture(128, 240, (ctx, W, H) => {
      ctx.fillStyle = "#1c2541";
      ctx.fillRect(0, 0, W, H);
      const colors = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#f78c6b"];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        ctx.fillStyle = colors[(r + c) % colors.length];
        ctx.fillRect(10 + c * 36, 14 + r * 42, 28, 30);
      }
    });
    for (const z of [11.0, 12.3]) {
      const vm = group(g, -25.55, z, Math.PI / 2);
      addBox(vm, 1.0, 1.9, 0.8, mat("#c1121f"), 0, 0.95, 0);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.16), new THREE.MeshBasicMaterial({ map: snacks, toneMapped: false }));
      front.position.set(-0.12, 1.15, 0.405);
      vm.add(front);
      nav.blockBox(-25.55, z, 1.0, 0.8, true);
    }
    roundTable(g, nav, -21.6, 12.2);
    roundTable(g, nav, -17.8, 13.6);
    screens.whiteboard = new CanvasScreen(2.2, 1.3, { px: 560, glow: false });
    screenOn(g, screens.whiteboard, -25.86, 1.55, 14.6, Math.PI / 2);
    plant(g, nav, -15.6, 16.4);
  }

  // ---- Annexe : compta et local d'entretien
  {
    const g = rooms.annexe;
    for (const seat of ROOM_DESKS.annexe) station(g, seat);
    for (const z of [14.4, 15.2, 16.0]) {
      addBox(g, 0.5, 1.3, 0.75, mat("#9ca3af"), -14.65, 0.65, z);
    }
    nav.blockRect(-14.95, 14.0, -14.35, 16.4, 0.15);
    const safe = addBox(g, 0.6, 0.7, 0.6, mat("#3f4a3c", { metalness: 0.6 }), -14.6, 0.35, 9.7);
    safe.castShadow = true;
    nav.blockBox(-14.6, 9.7, 0.6, 0.6, false, 0.1);
    // Chariot de ménage
    const cart = group(g, -8.7, 16.4);
    addBox(cart, 0.8, 0.08, 0.5, M.yellow, 0, 0.35, 0);
    addBox(cart, 0.8, 0.5, 0.05, M.yellow, 0, 0.6, -0.22);
    addCyl(cart, 0.15, 0.13, 0.3, mat("#3a86ff"), 0.2, 0.55, 0.05, 10);
    addCyl(cart, 0.012, 0.012, 1.2, M.wood, -0.3, 0.9, 0.1, 6);
    nav.blockBox(-8.7, 16.4, 0.8, 0.5, false, 0.1);
  }

  // ---- Accueil (comptoir, bonbonnière, agenda mural)
  {
    const g = rooms.reception;
    for (const seat of ROOM_DESKS.reception) station(g, seat, { chairMat: mat("#b2456e") });
    addBox(g, 0.14, 1.12, 4.2, M.white, -4.35, 0.56, 12.9);
    addBox(g, 0.44, 0.05, 4.25, M.woodLight, -4.4, 1.14, 12.9);
    nav.blockRect(-4.45, 10.75, -4.25, 15.05, 0.2);
    const jar = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshStandardMaterial({ color: "#dff6ff", transparent: true, opacity: 0.5 }));
    jar.position.set(-4.4, 1.27, 11.3);
    g.add(jar);
    for (let i = 0; i < 6; i++) {
      const candy = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), mat(["#ef476f", "#ffd166", "#06d6a0"][i % 3]));
      candy.position.set(-4.4 + (Math.random() - 0.5) * 0.08, 1.21 + Math.random() * 0.05, 11.3 + (Math.random() - 0.5) * 0.08);
      g.add(candy);
    }
    screens.counter = new CanvasScreen(1.8, 0.5, { px: 480 });
    screenOn(g, screens.counter, -4.27, 0.62, 12.9, Math.PI / 2, false);
    screens.calendar = new CanvasScreen(2.6, 1.5);
    screenOn(g, screens.calendar, -7.86, 1.65, 12.6, Math.PI / 2);
    sofa(g, nav, -6.4, 16.4, Math.PI, 1.8, M.sofaBlue);
    plant(g, nav, -2.6, 9.6);
  }

  // ---- Studio photo (Vinted)
  {
    const g = rooms.photo;
    station(g, ROOM_DESKS.photo[0]);
    addBox(g, 1.4, 0.8, 0.9, M.white, 6.2, 0.4, 13.2);
    addBox(g, 1.2, 0.02, 0.7, new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), 6.2, 0.81, 13.2, { cast: false });
    nav.blockBox(6.2, 13.2, 1.4, 0.9, false, 0.1);
    for (const [x, rot] of [[4.6, 0.6], [7.8, -0.6]]) {
      const s = group(g, x, 11.8, rot);
      addCyl(s, 0.015, 0.015, 1.6, M.dark, 0, 0.8, 0, 6);
      addBox(s, 0.6, 0.6, 0.12, new THREE.MeshBasicMaterial({ color: "#fffaf0", toneMapped: false }), 0, 1.65, 0.05);
      nav.blockBox(x, 11.8, 0.4, 0.4, false, 0.05);
    }
    const rail = group(g, 8.5, 13, Math.PI / 2);
    addBox(rail, 3.2, 0.03, 0.03, M.steel, 0, 1.6, 0);
    for (const sx of [-1.55, 1.55]) addBox(rail, 0.04, 1.6, 0.04, M.steel, sx, 0.8, 0);
    const cloth = ["#e63946", "#457b9d", "#f1faee", "#2a9d8f", "#e9c46a", "#264653", "#f4a261"];
    for (let i = 0; i < 9; i++) addBox(rail, 0.08, 0.75, 0.42, mat(cloth[i % cloth.length]), -1.3 + i * 0.32, 1.18, 0);
    nav.blockBox(8.5, 13, 3.2, 0.5, true);
    cartons(g, nav, 2.6, 9.7, 2);
  }

  // ---- Entrepôt (Vinted, expéditions)
  {
    const g = rooms.warehouse;
    station(g, ROOM_DESKS.warehouse[0], { deskMat: M.deskGrey });
    for (const x of [12, 15, 18, 21, 24]) boxRack(g, nav, x, 16.5, 0);
    boxRack(g, nav, 25.55, 11.6, -Math.PI / 2);
    boxRack(g, nav, 25.55, 14.2, -Math.PI / 2, 2.2);
    addBox(g, 2.4, 0.9, 1, M.woodLight, 14.5, 0.45, 12.6);
    addBox(g, 0.5, 0.35, 0.4, M.cardboard, 14, 1.08, 12.6);
    addCyl(g, 0.08, 0.08, 0.06, mat("#8d6e63"), 15.2, 0.93, 12.5, 12);
    nav.blockBox(14.5, 12.6, 2.4, 1);
    for (const [x, z] of [[19.5, 12.6], [22.6, 12.2]]) {
      addBox(g, 1.2, 0.14, 1, M.wood, x, 0.07, z);
      cartons(g, nav, x, z, 3);
    }
    const stripe = new THREE.MeshBasicMaterial({ color: "#f2c14e" });
    addBox(g, 16.6, 0.01, 0.08, stripe, 17.5, 0.012, 10.2, { cast: false });
    screens.warehouse = new CanvasScreen(2.8, 0.7, { px: 560 });
    screenOn(g, screens.warehouse, 21.5, 2.15, 9.12, 0, true);
  }

  // ---- Plateau : îlots à cloisons, pancartes, baby-foot, coin photocopieuse
  {
    const g = rooms.openspace;
    const pods = new THREE.Group();
    pods.userData.roomId = "openspace";
    g.add(pods);
    for (const pod of PODS) {
      for (const seat of pod.seats) station(pods, seat, { deskMat: pod.index === INTERN_POD ? M.woodLight : M.desk });
      // Cloisons en tissu façon "cubicle"
      addBox(pods, 3.2, 1.15, 0.06, M.fabric, pod.x, 0.58, pod.z);
      for (const sx of [-1, 1]) addBox(pods, 0.06, 1.15, 1.7, M.fabric, pod.x + sx * 1.6, 0.58, pod.z);
      addBox(pods, 3.24, 0.04, 0.1, M.frame, pod.x, 1.17, pod.z, { cast: false });
    }
    for (const bin of BINS) {
      addCyl(pods, 0.16, 0.13, 0.36, mat("#4b5563"), bin.x, 0.18, bin.z, 12);
      nav.blockBox(bin.x, bin.z, 0.34, 0.34, false, 0.05);
    }
    screens.kanban = new CanvasScreen(3.2, 1.6);
    const board = screenOn(pods, screens.kanban, 0, 1.45, -5.4, 0);
    addBox(board, 0.06, 1.5, 0.06, M.frame, -1.5, -0.7, -0.05);
    addBox(board, 0.06, 1.5, 0.06, M.frame, 1.5, -0.7, -0.05);
    nav.blockBox(0, -5.45, 3.3, 0.3, false, 0.15);

    // Coin détente : baby-foot + canapé
    const bf = group(pods, -21, 4.5);
    addBox(bf, 1.3, 0.25, 0.75, M.wood, 0, 0.8, 0);
    addBox(bf, 1.2, 0.02, 0.65, M.green, 0, 0.93, 0, { cast: false });
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.3, 0.3]) addBox(bf, 0.06, 0.7, 0.06, M.wood, sx, 0.35, sz);
    for (let i = 0; i < 6; i++) addCyl(bf, 0.012, 0.012, 1.05, M.steel, -0.5 + i * 0.2, 0.88, 0, 6).rotation.x = Math.PI / 2;
    nav.blockBox(-21, 4.5, 1.3, 0.75);
    sofa(pods, nav, -21, 7.0, Math.PI, 2, M.sofaBlue);

    // Coin photocopieuse & fontaine à eau
    addBox(pods, 0.9, 1.0, 0.7, mat("#d1d5db"), 21.8, 0.5, 4.1);
    addBox(pods, 0.7, 0.06, 0.5, M.dark, 21.8, 1.03, 4.1, { cast: false });
    nav.blockBox(21.8, 4.1, 0.9, 0.7);
    addBox(pods, 0.4, 1.0, 0.4, M.white, 20.3, 0.5, 5.15);
    addCyl(pods, 0.15, 0.15, 0.42, new THREE.MeshStandardMaterial({ color: "#8fd3ff", transparent: true, opacity: 0.7 }), 20.3, 1.22, 5.15);
    nav.blockBox(20.3, 5.15, 0.4, 0.4);
    pottedTree(pods, nav, 23.6, 7.6);
    pottedTree(pods, nav, -25, -7.6);
    pottedTree(pods, nav, 25, -7.6);
    pottedTree(pods, nav, -3.4, 0);
    pottedTree(pods, nav, 3.4, 0);
  }

  // ---- Entrée : paillasson, logo au sol, plantes
  {
    const mat0 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), mat("#2b2f3f"));
    mat0.rotation.x = -Math.PI / 2;
    mat0.position.set(0, 0.008, 16.3);
    fixtures.add(mat0);
    screens.logo = new CanvasScreen(3.6, 3.6, { px: 512, transparent: true, glow: false });
    screens.logo.mesh.rotation.x = -Math.PI / 2;
    screens.logo.mesh.position.set(0, 0.012, 12.6);
    screens.logo.mesh.receiveShadow = true;
    scene.add(screens.logo.mesh);
    plant(fixtures, nav, -1.6, 9.6, 1.1);
    plant(fixtures, nav, 1.4, 9.6, 1.1);
  }

  buildEastWing({ rooms, nav, screens, station, fixtures });
  seasonalDecor(fixtures, nav, new Date().getMonth());

  const monitors = buildMonitors(staticRoot);
  mergeStatic(staticRoot);

  return { rooms, screens, monitors, leds, outerWalls, windowMat: M.window, base };
}
