// Construction procédurale de l'étage : sols, murs, mobilier, écrans dynamiques.

import * as THREE from "three";
import { AREAS, WALLS, WALL_H, DESKS, MEETING_SEATS, POD_CENTERS, BOUNDS } from "./layout.js";
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

const M = {
  desk: mat("#e9e3d8"),
  deskDark: mat("#4a3426", { roughness: 0.6 }),
  metal: mat("#5d6475", { metalness: 0.5, roughness: 0.4 }),
  dark: mat("#20232e"),
  keyboard: mat("#2f3342"),
  chair: mat("#2c3142"),
  chairStudio: mat("#5b3fd6"),
  chairLeather: mat("#3a2219", { roughness: 0.5 }),
  wall: mat("#e8e6ef"),
  wallTrim: mat("#c9c6d4"),
  frame: mat("#3b4152", { metalness: 0.4, roughness: 0.45 }),
  glass: new THREE.MeshStandardMaterial({ color: "#bfe3ff", transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false }),
  window: new THREE.MeshStandardMaterial({ color: "#a9d8ff", emissive: "#8fcfff", emissiveIntensity: 0.9, roughness: 0.2 }),
  pot: mat("#c4774b"),
  leaf: mat("#3f9b5b"),
  leaf2: mat("#2f7d48"),
  wood: mat("#9c6b43"),
  woodLight: mat("#c89b6d"),
  shelf: mat("#6e4a2f"),
  fabric: mat("#3f5aa6"),
  fabricWarm: mat("#c75b4a"),
  white: mat("#f4f4f6"),
  gold: mat("#d9a93f", { metalness: 0.7, roughness: 0.3 }),
  felt: mat("#4f9e7b"),
  rack: mat("#1b1e27", { metalness: 0.3 }),
};

// Écran dont le contenu est dessiné sur un canvas (KPI, agenda, kanban…).
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
  }

  draw(fn) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fn(ctx, canvas.width, canvas.height);
    this.texture.needsUpdate = true;
  }
}

function codeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 150;
  const ctx = canvas.getContext("2d");
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
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function floorTexture(color, line, size = 512, tiles = 8) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  const step = size / tiles;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---------------------------------------------------------------------------

function chair(parent, material) {
  addBox(parent, 0.48, 0.07, 0.46, material, 0, 0.45, 0);
  addBox(parent, 0.46, 0.5, 0.06, material, 0, 0.76, -0.25);
  addCyl(parent, 0.03, 0.03, 0.38, M.metal, 0, 0.23, 0, 8);
  addCyl(parent, 0.24, 0.26, 0.04, M.metal, 0, 0.03, 0, 10);
}

function workstation(parent, nav, seat, { w = 1.6, deskMat = M.desk, chairMat = M.chair, dual = false, codeTex }) {
  const g = new THREE.Group();
  g.position.set(seat.x, 0, seat.z);
  g.rotation.y = seat.facing;
  parent.add(g);
  chair(g, chairMat);

  const desk = new THREE.Group();
  desk.position.z = 0.85;
  g.add(desk);
  addBox(desk, w, 0.05, 0.8, deskMat, 0, 0.74, 0);
  addBox(desk, 0.05, 0.72, 0.7, M.metal, -w / 2 + 0.06, 0.36, 0);
  addBox(desk, 0.05, 0.72, 0.7, M.metal, w / 2 - 0.06, 0.36, 0);
  addBox(desk, w - 0.2, 0.32, 0.03, deskMat, 0, 0.52, 0.36);

  const screens = [];
  for (const ox of dual ? [-0.36, 0.36] : [0]) {
    addBox(desk, 0.05, 0.22, 0.05, M.dark, ox, 0.88, 0.2);
    addBox(desk, 0.22, 0.02, 0.14, M.dark, ox, 0.775, 0.2);
    addBox(desk, 0.66, 0.4, 0.035, M.dark, ox, 1.12, 0.2);
    const screenMat = new THREE.MeshBasicMaterial({ map: codeTex, color: MONITOR_IDLE.clone(), toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), screenMat);
    screen.position.set(ox, 1.12, 0.18);
    screen.rotation.y = Math.PI;
    desk.add(screen);
    screens.push(screenMat);
  }
  addBox(desk, 0.44, 0.02, 0.14, M.keyboard, 0, 0.775, -0.15);
  if (Math.random() < 0.6) addCyl(desk, 0.04, 0.035, 0.1, mat(["#ef7fa6", "#f2c14e", "#4cc38a", "#ffffff"][Math.floor(Math.random() * 4)]), w / 2 - 0.25, 0.81, -0.1, 10);

  const fx = Math.sin(seat.facing);
  const fz = Math.cos(seat.facing);
  nav.blockBox(seat.x + fx * 0.85, seat.z + fz * 0.85, w, 0.8, Math.abs(fx) > 0.5);
  return { group: g, screens };
}

function plant(parent, nav, x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  parent.add(g);
  addCyl(g, 0.24, 0.18, 0.42, M.pot, 0, 0.21, 0, 14);
  const leaves = [
    [0, 0.75, 0, 0.32, M.leaf],
    [0.14, 0.95, 0.06, 0.24, M.leaf2],
    [-0.12, 1.02, -0.05, 0.22, M.leaf],
    [0.02, 1.2, 0.02, 0.18, M.leaf2],
  ];
  for (const [lx, ly, lz, r, m] of leaves) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), m);
    leaf.position.set(lx, ly, lz);
    leaf.castShadow = true;
    g.add(leaf);
  }
  nav.blockBox(x, z, 0.5 * scale, 0.5 * scale, false, 0.1);
}

function sofa(parent, nav, x, z, rotY, w, material) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  addBox(g, w, 0.42, 0.85, material, 0, 0.21, 0);
  addBox(g, w, 0.5, 0.2, material, 0, 0.6, -0.33);
  addBox(g, 0.18, 0.3, 0.85, material, -w / 2 + 0.09, 0.55, 0);
  addBox(g, 0.18, 0.3, 0.85, material, w / 2 - 0.09, 0.55, 0);
  const rotated = Math.abs(Math.sin(rotY)) > 0.5;
  nav.blockBox(x, z, w, 0.85, rotated);
}

function bookshelf(parent, nav, x, z, rotY, w = 2.6, h = 2.2, d = 0.42) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);
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
  return g;
}

function serverRack(parent, nav, x, z, rotY, leds) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  addBox(g, 0.62, 2, 0.7, M.rack, 0, 1, 0);
  for (let i = 0; i < 9; i++) {
    addBox(g, 0.54, 0.16, 0.02, M.dark, 0, 0.25 + i * 0.19, 0.36, { cast: false });
    const ledMat = new THREE.MeshBasicMaterial({ color: i % 3 ? "#4cc38a" : "#5aa9e6", toneMapped: false });
    addBox(g, 0.04, 0.03, 0.02, ledMat, 0.2, 0.25 + i * 0.19, 0.375, { cast: false });
    leds.push(ledMat);
  }
  nav.blockBox(x, z, 0.62, 0.7, Math.abs(Math.sin(rotY)) > 0.5);
}

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

function glassWall(parent, nav, wall) {
  const { horizontal, fixed, pieces, gaps } = wallPieces(wall.from, wall.to, wall.gaps);
  const place = (m, along, y) => (horizontal ? m.position.set(along, y, fixed) : m.position.set(fixed, y, along));
  for (const [p0, p1] of pieces) {
    const len = p1 - p0;
    const mid = (p0 + p1) / 2;
    const sx = horizontal ? len : 0.1;
    const sz = horizontal ? 0.1 : len;
    place(addBox(parent, sx, 0.12, sz, M.frame, 0, 0, 0), mid, 0.06);
    place(addBox(parent, sx, 0.06, sz, M.frame, 0, 0, 0, { cast: false }), mid, WALL_H - 0.03);
    const glass = new THREE.Mesh(boxGeo(horizontal ? len : 0.03, WALL_H - 0.18, horizontal ? 0.03 : len), M.glass);
    place(glass, mid, WALL_H / 2);
    glass.renderOrder = 2;
    parent.add(glass);
    const posts = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= posts; i++) {
      const along = p0 + (len * i) / posts;
      place(addBox(parent, 0.07, WALL_H, 0.07, M.frame, 0, 0, 0, { receive: false }), along, WALL_H / 2);
    }
    if (horizontal) nav.blockRect(p0, fixed - 0.05, p1, fixed + 0.05, 0.18);
    else nav.blockRect(fixed - 0.05, p0, fixed + 0.05, p1, 0.18);
  }
  // Linteaux au-dessus des portes
  for (const [g0, g1] of gaps || []) {
    const len = g1 - g0;
    place(addBox(parent, horizontal ? len : 0.1, 0.12, horizontal ? 0.1 : len, M.frame, 0, 0, 0, { cast: false }), (g0 + g1) / 2, WALL_H - 0.06);
  }
}

function outerWall(parent, nav, wall, windowsAt) {
  const group = new THREE.Group();
  parent.add(group);
  const { horizontal, fixed, pieces } = wallPieces(wall.from, wall.to, wall.gaps);
  const t = 0.25;
  const offset = fixed === BOUNDS.minX || fixed === BOUNDS.minZ ? -t / 2 : t / 2;
  const inward = -Math.sign(offset);
  for (const [p0, p1] of pieces) {
    const len = p1 - p0;
    const m = addBox(group, horizontal ? len : t, WALL_H, horizontal ? t : len, M.wall, 0, 0, 0);
    if (horizontal) m.position.set((p0 + p1) / 2, WALL_H / 2, fixed + offset);
    else m.position.set(fixed + offset, WALL_H / 2, (p0 + p1) / 2);
    const trim = addBox(group, horizontal ? len : t + 0.02, 0.12, horizontal ? t + 0.02 : len, M.wallTrim, 0, 0, 0, { cast: false });
    trim.position.copy(m.position);
    trim.position.y = 0.06;
  }
  for (const along of windowsAt) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.25), M.window);
    const sill = addBox(group, horizontal ? 1.95 : 0.08, 0.06, horizontal ? 0.08 : 1.95, M.wallTrim, 0, 0, 0, { cast: false });
    if (horizontal) {
      win.position.set(along, 1.55, fixed + inward * 0.012);
      win.rotation.y = inward > 0 ? 0 : Math.PI;
      sill.position.set(along, 0.9, fixed + inward * 0.04);
    } else {
      win.position.set(fixed + inward * 0.012, 1.55, along);
      win.rotation.y = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
      sill.position.set(fixed + inward * 0.04, 0.9, along);
    }
    group.add(win);
  }
  for (const [p0, p1] of pieces) {
    if (horizontal) nav.blockRect(p0, fixed - 0.1, p1, fixed + 0.1, 0.25);
    else nav.blockRect(fixed - 0.1, p0, fixed + 0.1, p1, 0.25);
  }
  const normal = horizontal ? new THREE.Vector3(0, 0, inward) : new THREE.Vector3(inward, 0, 0);
  const point = horizontal ? new THREE.Vector3(0, 0, fixed) : new THREE.Vector3(fixed, 0, 0);
  return { group, normal, point };
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

export function buildOffice(scene, nav) {
  const rooms = {};
  for (const id of Object.keys(AREAS)) {
    const g = new THREE.Group();
    g.userData.roomId = id === "openspace" ? null : id;
    g.name = id;
    scene.add(g);
    rooms[id] = g;
  }
  const codeTex = codeTexture();
  const screens = {};
  const monitors = new Map();
  const leds = [];
  const outerWalls = [];

  // Socle et sols
  const slab = addBox(scene, BOUNDS.maxX - BOUNDS.minX + 1.2, 0.5, BOUNDS.maxZ - BOUNDS.minZ + 1.2, mat("#3a3f55"), 0, -0.262, 0, { cast: false });
  slab.receiveShadow = true;
  const baseTex = floorTexture("#c6cad3", "#b7bcc7", 512, 8);
  baseTex.repeat.set(9, 6.5);
  const base = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ), new THREE.MeshStandardMaterial({ map: baseTex, roughness: 0.9 }));
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = true;
  base.userData.walk = true;
  scene.add(base);

  const floorMats = {
    director: new THREE.MeshStandardMaterial({ map: floorTexture("#6b4e3a", "#5d4232", 256, 6), roughness: 0.7 }),
    meeting: new THREE.MeshStandardMaterial({ color: AREAS.meeting.floor, roughness: 1 }),
    library: new THREE.MeshStandardMaterial({ map: floorTexture("#8a5f3c", "#7a5133", 256, 6), roughness: 0.75 }),
    reception: new THREE.MeshStandardMaterial({ color: AREAS.reception.floor, roughness: 0.4 }),
    lounge: new THREE.MeshStandardMaterial({ map: floorTexture("#b98b5e", "#a87b50", 256, 5), roughness: 0.8 }),
    studio: new THREE.MeshStandardMaterial({ color: AREAS.studio.floor, roughness: 0.6 }),
    openspace: new THREE.MeshStandardMaterial({ color: "#c3c8d6", roughness: 1 }),
  };
  for (const [id, area] of Object.entries(AREAS)) {
    const [x0, z0, x1, z1] = area.rect;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), floorMats[id]);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((x0 + x1) / 2, id === "openspace" ? 0.003 : 0.006, (z0 + z1) / 2);
    floor.receiveShadow = true;
    if (id === "openspace") floor.userData.walk = true;
    rooms[id].add(floor);
  }

  // Murs
  const windows = {
    "-13": [-16.5, -9.6, -5.5, 2.6],
    x: { "-18": [-6.9, -3.5, 0, 3.5, 12], 18: [-3.5, 0, 3.5] },
    13: [-15, -11, -6, 5, 10, 15],
  };
  for (const wall of WALLS) {
    if (wall.kind === "glass") {
      glassWall(scene, nav, wall);
      continue;
    }
    const horizontal = wall.from[1] === wall.to[1];
    const at = horizontal ? windows[String(wall.from[1])] : windows.x[String(wall.from[0])];
    outerWalls.push(outerWall(scene, nav, wall, at || []));
  }

  // ---- Bureau du directeur ----
  {
    const g = rooms.director;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.4), mat("#7a2e3a"));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-13, 0.012, -10.2);
    rug.receiveShadow = true;
    g.add(rug);
    const ws = workstation(g, nav, DESKS.director[0], { w: 2.3, deskMat: M.deskDark, chairMat: M.chairLeather, codeTex });
    monitors.set("dir", ws.screens);
    addBox(ws.group, 2.32, 0.03, 0.06, M.gold, 0, 0.765, 1.24, { cast: false });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat("#3d7ad6"));
    globe.position.set(-14, 0.98, -10.5);
    g.add(globe);
    addCyl(g, 0.02, 0.06, 0.18, M.gold, -14, 0.85, -10.5, 8);
    for (const x of [-14, -12]) {
      const c = new THREE.Group();
      c.position.set(x, 0, -9.6);
      c.rotation.y = Math.PI;
      g.add(c);
      chair(c, M.chairLeather);
      nav.blockBox(x, -9.6, 0.5, 0.5, false, 0.05);
    }
    bookshelf(g, nav, -17.65, -10.3, Math.PI / 2, 2.6);
    sofa(g, nav, -17.25, -7.3, Math.PI / 2, 1.8, M.fabricWarm);
    plant(g, nav, -9, -12.4, 1.1);
    plant(g, nav, -17.3, -12.4);
    screens.director = new CanvasScreen(2.6, 1.3);
    screenOn(g, screens.director, -13, 1.75, -12.84);
  }

  // ---- Salle de réunion ----
  {
    const g = rooms.meeting;
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4), mat("#56657e"));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(-1, 0.012, -9.5);
    carpet.receiveShadow = true;
    g.add(carpet);
    addBox(g, 5.4, 0.07, 1.7, M.woodLight, -1, 0.74, -9.5);
    addBox(g, 0.3, 0.7, 1.1, M.metal, -3, 0.36, -9.5);
    addBox(g, 0.3, 0.7, 1.1, M.metal, 1, 0.36, -9.5);
    for (const x of [-2.5, -0.5, 1.2]) addCyl(g, 0.05, 0.05, 0.22, M.glass, x, 0.89, -9.5, 10);
    nav.blockBox(-1, -9.5, 5.4, 1.7);
    for (const seat of MEETING_SEATS) {
      const c = new THREE.Group();
      c.position.set(seat.x, 0, seat.z);
      c.rotation.y = seat.facing;
      g.add(c);
      chair(c, M.fabric);
    }
    const ws = workstation(g, nav, DESKS.meeting[0], { w: 1.3, codeTex });
    monitors.set("scribe", ws.screens);
    plant(g, nav, -7.4, -12.4);
    plant(g, nav, 5.4, -6.7, 0.9);
    screens.meeting = new CanvasScreen(3.2, 1.6);
    screenOn(g, screens.meeting, -1, 1.7, -12.84);
  }

  // ---- Bibliothèque ----
  {
    const g = rooms.library;
    for (const x of [7.6, 10.4, 13.2, 16]) bookshelf(g, nav, x, -12.66, 0, 2.6);
    bookshelf(g, nav, 17.66, -11, -Math.PI / 2, 2.4);
    bookshelf(g, nav, 17.66, -8.45, -Math.PI / 2, 2.4);
    bookshelf(g, nav, 13.2, -10.19, 0, 3, 1.6);
    bookshelf(g, nav, 13.2, -10.61, Math.PI, 3, 1.6);
    const ws1 = workstation(g, nav, DESKS.library[0], { w: 1.6, deskMat: M.wood, codeTex });
    const ws2 = workstation(g, nav, DESKS.library[1], { w: 1.6, deskMat: M.wood, codeTex });
    monitors.set("lib1", ws1.screens);
    monitors.set("lib2", ws2.screens);
    serverRack(g, nav, 6.5, -8.3, Math.PI / 2, leds);
    serverRack(g, nav, 6.5, -9.1, Math.PI / 2, leds);
    // Chariot de retour des livres (point de dépôt des livrables)
    addBox(g, 0.9, 0.5, 0.5, M.shelf, 11.3, 0.45, -9.3);
    nav.blockBox(11.3, -9.3, 0.9, 0.5, false, 0.1);
    screens.library = new CanvasScreen(1.5, 0.9, { px: 480 });
    const totem = screenOn(g, screens.library, 7.2, 1.45, -6.75);
    addBox(totem, 0.08, 1.0, 0.08, M.frame, 0, -0.95, -0.05);
    nav.blockBox(7.2, -6.75, 0.4, 0.3, false, 0.1);
  }

  // ---- Secrétariat ----
  {
    const g = rooms.reception;
    const ws1 = workstation(g, nav, DESKS.reception[0], { w: 1.5, codeTex, chairMat: mat("#b2456e") });
    const ws2 = workstation(g, nav, DESKS.reception[1], { w: 1.5, codeTex, chairMat: mat("#b2456e") });
    monitors.set("rec1", ws1.screens);
    monitors.set("rec2", ws2.screens);
    addBox(g, 0.14, 1.12, 3.9, M.white, -12.25, 0.56, 9.3);
    addBox(g, 0.42, 0.05, 3.95, M.woodLight, -12.3, 1.14, 9.3);
    nav.blockRect(-12.35, 7.35, -12.15, 11.25, 0.2);
    screens.counter = new CanvasScreen(1.8, 0.5, { px: 480 });
    screenOn(g, screens.counter, -12.17, 0.6, 9.3, Math.PI / 2, false);
    screens.calendar = new CanvasScreen(3, 1.6);
    screenOn(g, screens.calendar, -17.84, 1.65, 9.3, Math.PI / 2);
    sofa(g, nav, -16.2, 12.45, Math.PI, 2.2, M.fabric);
    plant(g, nav, -17.3, 6.6);
    plant(g, nav, -9.6, 12.4);
  }

  // ---- Cafétéria ----
  {
    const g = rooms.lounge;
    addBox(g, 3.2, 0.95, 0.6, M.woodLight, -6.6, 0.475, 12.6);
    addBox(g, 3.3, 0.05, 0.66, M.white, -6.6, 0.97, 12.6);
    addBox(g, 0.42, 0.48, 0.36, M.dark, -7.4, 1.24, 12.62);
    addBox(g, 0.06, 0.06, 0.02, new THREE.MeshBasicMaterial({ color: "#ff4d4d", toneMapped: false }), -7.3, 1.36, 12.43, { cast: false });
    for (const x of [-6.8, -6.6, -6.4]) addCyl(g, 0.045, 0.04, 0.1, M.white, x, 1.05, 12.5, 10);
    addBox(g, 0.8, 1.9, 0.7, M.white, -4.4, 0.95, 12.55);
    nav.blockRect(-8.25, 12.2, -4.0, 12.9, 0.15);
    addCyl(g, 0.55, 0.55, 0.05, M.woodLight, -5, 1.05, 9.6, 24);
    addCyl(g, 0.05, 0.05, 1.02, M.metal, -5, 0.52, 9.6, 8);
    addCyl(g, 0.3, 0.32, 0.04, M.metal, -5, 0.02, 9.6, 16);
    nav.blockBox(-5, 9.6, 1.1, 1.1, false, 0.05);
    for (const [x, z, c] of [[-3.3, 8.2, "#f2c14e"], [-3.3, 11.6, "#ef7fa6"]]) {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mat(c));
      bag.scale.y = 0.6;
      bag.position.set(x, 0.27, z);
      bag.castShadow = true;
      g.add(bag);
      nav.blockBox(x, z, 0.9, 0.9, false, 0.05);
    }
    plant(g, nav, -8.1, 7.5);
  }

  // ---- Studio Web ----
  {
    const g = rooms.studio;
    DESKS.studio.forEach((seat) => {
      const ws = workstation(g, nav, seat, { w: 2.0, dual: true, codeTex, chairMat: M.chairStudio, deskMat: mat("#3a3f52") });
      monitors.set(seat.id, ws.screens);
    });
    const neon = new THREE.MeshBasicMaterial({ color: "#8b6cff", toneMapped: false });
    addBox(g, 0.04, 0.04, 6.8, neon, 17.8, 0.08, 9.5, { cast: false });
    addBox(g, 10.8, 0.04, 0.04, neon, 12.4, 0.08, 12.8, { cast: false });
    screens.studio = new CanvasScreen(3.4, 1.8);
    screenOn(g, screens.studio, 17.84, 1.7, 9.5, -Math.PI / 2);
    plant(g, nav, 7.6, 12.4);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mat("#4cc38a"));
    bag.scale.y = 0.6;
    bag.position.set(16.9, 0.27, 7.1);
    g.add(bag);
    nav.blockBox(16.9, 7.1, 0.9, 0.9, false, 0.05);
  }

  // ---- Open space : îlot des managers, pods, tableau kanban ----
  {
    const g = rooms.openspace;
    const pods = new THREE.Group();
    pods.userData.roomId = "openspace";
    g.add(pods);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 4), mat("#3d5a9e"));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.009, 0);
    rug.receiveShadow = true;
    pods.add(rug);
    DESKS.managers.forEach((seat) => {
      const ws = workstation(pods, nav, seat, { w: 2.0, codeTex, deskMat: mat("#d9d2c3"), chairMat: mat("#2f6f5a") });
      monitors.set(seat.id, ws.screens);
    });
    DESKS.pods.forEach((seat) => {
      const ws = workstation(pods, nav, seat, { w: 1.5, codeTex });
      monitors.set(seat.id, ws.screens);
    });
    for (const cx of POD_CENTERS) addBox(pods, 3.1, 0.36, 0.04, M.felt, cx, 0.95, 0, { cast: false });
    for (const x of [-15.6, -3.9, 3.9, 15.6]) plant(pods, nav, x, 0, 0.9);

    screens.kanban = new CanvasScreen(3.2, 1.6);
    const board = screenOn(pods, screens.kanban, 0, 1.45, -3.4, 0);
    addBox(board, 0.06, 1.5, 0.06, M.frame, -1.5, -0.7, -0.05);
    addBox(board, 0.06, 1.5, 0.06, M.frame, 1.5, -0.7, -0.05);
    nav.blockBox(0, -3.45, 3.3, 0.3, false, 0.15);

    addBox(pods, 0.5, 1.1, 0.5, M.white, 17.4, 0.55, 4.6);
    addCyl(pods, 0.16, 0.16, 0.4, new THREE.MeshStandardMaterial({ color: "#8fd3ff", transparent: true, opacity: 0.7 }), 17.4, 1.3, 4.6);
    nav.blockBox(17.4, 4.6, 0.5, 0.5);
    addBox(pods, 0.8, 0.9, 0.6, M.dark, -17.35, 0.45, -4.6);
    nav.blockBox(-17.35, -4.6, 0.8, 0.6);
  }

  // ---- Entrée : logo au sol ----
  {
    const mat0 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.1), mat("#2b2f3f"));
    mat0.rotation.x = -Math.PI / 2;
    mat0.position.set(0, 0.008, 12.4);
    scene.add(mat0);
    screens.logo = new CanvasScreen(4.2, 4.2, { px: 512, transparent: true, glow: false });
    screens.logo.mesh.rotation.x = -Math.PI / 2;
    screens.logo.mesh.position.set(2.2, 0.01, 9.3);
    screens.logo.mesh.receiveShadow = true;
    scene.add(screens.logo.mesh);
    plant(scene, nav, -2.7, 12.3, 1.1);
    plant(scene, nav, 2.7, 12.3, 1.1);
  }

  return { rooms, screens, monitors, leds, outerWalls, windowMat: M.window, base };
}
