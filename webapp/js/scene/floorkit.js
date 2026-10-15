// Mobilier procédural des pièces du Bâtiment 0. Chaque thème de pièce pose ses meubles et
// déclare ses places : assises (bureaux, tables, bancs), lits (Hôtel), places debout.
// Repère local d'une pièce : largeur W sur x, profondeur D sur z, porte au milieu du bord +z
// (côté couloir), mur du fond en -z. Les places sont converties en coordonnées du monde.

import * as THREE from "three";
import { mat } from "./people.js";

const geoCache = new Map();
const G = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
};
const BOX = (w, h, d) => G(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const CYL = (rt, rb, h, s = 16) => G(`c${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const SPH = (r, s = 14) => G(`s${r}|${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, s - 4)));

const glow = (color, intensity = 1) => mat(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

export const KM = {
  desk: mat("#c8a97e", { roughness: 0.6 }),
  deskDark: mat("#4a3426", { roughness: 0.55 }),
  deskWhite: mat("#e9e6df"),
  metal: mat("#6b7280", { metalness: 0.45, roughness: 0.45 }),
  steel: mat("#9aa1ab", { metalness: 0.6, roughness: 0.35 }),
  dark: mat("#20232e"),
  chair: mat("#2b2b2e"),
  leather: mat("#5a2d1e", { roughness: 0.5 }),
  leatherRed: mat("#7a1f2b", { roughness: 0.55 }),
  fabricBlue: mat("#3f5aa6"),
  fabricGrey: mat("#8d96a8", { roughness: 1 }),
  fabricGreen: mat("#2f6b4f"),
  wood: mat("#9c6b43"),
  woodLight: mat("#c89b6d"),
  woodDark: mat("#5b3a24"),
  white: mat("#f4f4f6"),
  cream: mat("#efe6d2"),
  pot: mat("#c4774b"),
  leaf: mat("#3f9b5b"),
  leaf2: mat("#2f7d48"),
  cardboard: mat("#b98a55"),
  cardboard2: mat("#a77945"),
  binder: mat("#2d6cdf"),
  binder2: mat("#c0392b"),
  binder3: mat("#e0b354"),
  rack: mat("#1b1e27", { metalness: 0.3 }),
  gold: mat("#d9a93f", { metalness: 0.7, roughness: 0.3 }),
  blanket: mat("#5b7fc7"),
  blanket2: mat("#c76b5b"),
  pillow: mat("#f2efe6"),
  tile: mat("#d8dde6"),
  red: mat("#c0392b"),
  green: mat("#2fbf71"),
  paper: mat("#fffdf5"),
  paper2: mat("#ffe08a"),
  paper3: mat("#a8d8ff"),
  screen: glow("#5aa9e6", 0.9),
  screenGreen: glow("#2fbf71", 0.8),
  screenRed: glow("#ef5d6c", 0.9),
  screenPurple: glow("#9b7bff", 1),
  lamp: glow("#ffe7a3", 1.2),
  water: new THREE.MeshStandardMaterial({ color: "#5fb7e8", transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, depthWrite: false }),
  glass: new THREE.MeshStandardMaterial({ color: "#cfe8ff", transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }),
};
export const LED = glow("#4cc38a", 1.4);
export const LED2 = glow("#5aa9e6", 1.4);

// ------------------------------------------------------------------ boîte à outils

class Kit {
  constructor(root, W, D, rng) {
    this.root = root;
    this.W = W;
    this.D = D;
    this.rng = rng;
    this.spots = [];
    this.dynamics = [];
  }

  group(x, z, rot = 0, parent = this.root) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    parent.add(g);
    return g;
  }

  box(parent, w, h, d, material, x, y, z, { rot = 0, cast = true } = {}) {
    const m = new THREE.Mesh(BOX(w, h, d), material);
    m.position.set(x, y, z);
    m.rotation.y = rot;
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  cyl(parent, rt, rb, h, material, x, y, z, s = 16) {
    const m = new THREE.Mesh(CYL(rt, rb, h, s), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  sphere(parent, r, material, x, y, z) {
    const m = new THREE.Mesh(SPH(r), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // Une place, exprimée dans le repère d'un groupe (converti dans le repère de la pièce).
  spot(g, lx, lz, facing, kind, extra = {}) {
    const r = g === this.root ? 0 : g.rotation.y;
    const gx = g === this.root ? 0 : g.position.x;
    const gz = g === this.root ? 0 : g.position.z;
    const x = gx + lx * Math.cos(r) + lz * Math.sin(r);
    const z = gz - lx * Math.sin(r) + lz * Math.cos(r);
    this.spots.push({ x, z, facing: facing + r, kind, ...extra });
  }

  seat(g, lx, lz, facing, extra) {
    this.spot(g, lx, lz, facing, "seat", extra);
  }

  stand(g, lx, lz, facing = 0, extra) {
    this.spot(g, lx, lz, facing, "stand", { stand: true, ...extra });
  }

  dyn(obj, kind, data = {}) {
    obj.userData.dynamic = true;
    this.dynamics.push({ obj, kind, base: obj.position.clone(), phase: this.rng() * 10, ...data });
    return obj;
  }

  // Places debout réparties dans une zone libre du repère de la pièce.
  standArea(x0, z0, x1, z1, n, facing = null) {
    for (let i = 0; i < n; i++) {
      const x = x0 + (x1 - x0) * this.rng();
      const z = z0 + (z1 - z0) * this.rng();
      this.stand(this.root, x, z, facing ?? this.rng() * Math.PI * 2, { wander: true });
    }
  }

  // ---------------------------------------------------------- meubles

  chair(g, x, z, rot, material = KM.chair) {
    const c = this.group(x, z, rot, g);
    this.box(c, 0.46, 0.07, 0.46, material, 0, 0.45, 0);
    this.box(c, 0.46, 0.5, 0.06, material, 0, 0.72, 0.22);
    this.cyl(c, 0.03, 0.03, 0.42, KM.metal, 0, 0.22, 0, 6);
    return c;
  }

  // Bureau tourné vers le fond ; la personne s'assied côté porte.
  workstation(x, z, rot = 0, { top = KM.desk, screen = KM.screen, screens = 1 } = {}) {
    const g = this.group(x, z, rot);
    this.box(g, 1.4, 0.06, 0.7, top, 0, 0.74, 0);
    for (const sx of [-0.64, 0.64]) this.box(g, 0.05, 0.72, 0.64, KM.metal, sx, 0.36, 0, { cast: false });
    for (let i = 0; i < screens; i++) {
      const off = (i - (screens - 1) / 2) * 0.5;
      this.box(g, 0.46, 0.3, 0.04, KM.dark, off, 1.04, -0.2);
      this.box(g, 0.42, 0.26, 0.01, screen, off, 1.04, -0.177, { cast: false });
      this.box(g, 0.05, 0.18, 0.05, KM.dark, off, 0.85, -0.2, { cast: false });
    }
    this.box(g, 0.5, 0.02, 0.16, KM.dark, 0, 0.78, 0.08, { cast: false });
    this.chair(g, 0, 0.62, Math.PI);
    this.seat(g, 0, 0.62, Math.PI, { act: "work" });
    return g;
  }

  table(g, x, z, w, d, material = KM.desk, h = 0.74) {
    const t = this.group(x, z, 0, g);
    this.box(t, w, 0.06, d, material, 0, h, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(t, 0.06, h, 0.06, KM.metal, sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1), { cast: false });
    return t;
  }

  // Table de réunion entourée de chaises (places assises tournées vers la table).
  meetingTable(x, z, w, d, { material = KM.deskDark, chairMat = KM.chair } = {}) {
    const g = this.group(x, z);
    this.table(g, 0, 0, w, d, material);
    const n = Math.max(2, Math.floor((w - 0.4) / 0.8));
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + 0.5 + (i * (w - 1)) / Math.max(1, n - 1);
      this.chair(g, cx, -d / 2 - 0.45, 0, chairMat);
      this.seat(g, cx, -d / 2 - 0.45, 0, { act: "talk" });
      this.chair(g, cx, d / 2 + 0.45, Math.PI, chairMat);
      this.seat(g, cx, d / 2 + 0.45, Math.PI, { act: "talk" });
    }
    return g;
  }

  roundTable(x, z, { r = 0.55, chairs = 4, material = KM.white, act = "eat" } = {}) {
    const g = this.group(x, z);
    this.cyl(g, r, r, 0.05, material, 0, 0.74, 0, 20);
    this.cyl(g, 0.06, 0.08, 0.72, KM.metal, 0, 0.36, 0, 8);
    for (let i = 0; i < chairs; i++) {
      const a = (i / chairs) * Math.PI * 2 + 0.4;
      const cx = Math.sin(a) * (r + 0.42);
      const cz = Math.cos(a) * (r + 0.42);
      this.chair(g, cx, cz, a, KM.chair);
      this.seat(g, cx, cz, a + Math.PI, { act });
    }
    return g;
  }

  sofa(x, z, rot, w = 2, material = KM.fabricBlue, act = "relax") {
    const g = this.group(x, z, rot);
    this.box(g, w, 0.42, 0.85, material, 0, 0.21, 0);
    this.box(g, w, 0.55, 0.2, material, 0, 0.6, -0.33);
    for (const sx of [-1, 1]) this.box(g, 0.2, 0.62, 0.85, material, sx * (w / 2 - 0.1), 0.31, 0);
    const n = Math.max(1, Math.floor((w - 0.3) / 0.65));
    for (let i = 0; i < n; i++) this.seat(g, -w / 2 + 0.2 + ((i + 0.5) * (w - 0.4)) / n, 0.08, 0, { act });
    return g;
  }

  armchair(x, z, rot, material = KM.leather, act = "relax") {
    const g = this.group(x, z, rot);
    this.box(g, 0.85, 0.42, 0.85, material, 0, 0.21, 0);
    this.box(g, 0.85, 0.6, 0.18, material, 0, 0.62, -0.34);
    for (const sx of [-1, 1]) this.box(g, 0.16, 0.6, 0.85, material, sx * 0.36, 0.3, 0);
    this.seat(g, 0, 0.05, 0, { act });
    return g;
  }

  bench(x, z, rot, w = 2, material = KM.wood, act = "idle") {
    const g = this.group(x, z, rot);
    this.box(g, w, 0.07, 0.42, material, 0, 0.44, 0);
    for (const sx of [-1, 1]) this.box(g, 0.08, 0.42, 0.38, KM.metal, sx * (w / 2 - 0.15), 0.21, 0, { cast: false });
    const n = Math.max(1, Math.floor(w / 0.65));
    for (let i = 0; i < n; i++) this.seat(g, -w / 2 + ((i + 0.5) * w) / n, 0.05, 0, { act });
    return g;
  }

  bed(x, z, rot, blanket = KM.blanket) {
    const g = this.group(x, z, rot);
    this.box(g, 1.0, 0.36, 2.0, KM.woodDark, 0, 0.18, 0);
    this.box(g, 0.94, 0.14, 1.9, KM.cream, 0, 0.43, 0, { cast: false });
    this.box(g, 0.96, 0.06, 1.25, blanket, 0, 0.51, 0.32, { cast: false });
    this.box(g, 0.6, 0.12, 0.32, KM.pillow, 0, 0.55, -0.74, { cast: false });
    this.box(g, 1.0, 0.75, 0.08, KM.woodDark, 0, 0.375, -1.0);
    // Allongé : pieds vers la porte, tête sur l'oreiller.
    this.spot(g, 0, 0.92, 0, "bed", { lie: true, lieY: 0.62, act: "sleep" });
    return g;
  }

  plant(x, z, s = 1) {
    const g = this.group(x, z);
    this.cyl(g, 0.22 * s, 0.17 * s, 0.4 * s, KM.pot, 0, 0.2 * s, 0, 10);
    this.sphere(g, 0.36 * s, KM.leaf, 0, 0.75 * s, 0);
    this.sphere(g, 0.26 * s, KM.leaf2, 0.14 * s, 1.0 * s, 0.05 * s);
    return g;
  }

  shelf(x, z, rot, w = 2.4, h = 2.0, fill = "binders") {
    const g = this.group(x, z, rot);
    for (const sx of [-1, 1]) this.box(g, 0.05, h, 0.42, KM.woodDark, sx * (w / 2), h / 2, 0);
    const rows = Math.max(2, Math.floor(h / 0.45));
    for (let i = 0; i <= rows; i++) this.box(g, w, 0.04, 0.42, KM.woodDark, 0, 0.05 + (i * (h - 0.1)) / rows, 0, { cast: false });
    const mats = fill === "boxes" ? [KM.cardboard, KM.cardboard2] : fill === "odd" ? [KM.red, KM.binder3, KM.fabricBlue, KM.green] : [KM.binder, KM.binder2, KM.binder3, KM.white];
    for (let i = 0; i < rows; i++) {
      let x0 = -w / 2 + 0.12;
      while (x0 < w / 2 - 0.2) {
        const bw = fill === "boxes" ? 0.45 : 0.08 + this.rng() * 0.06;
        const bh = fill === "boxes" ? 0.32 : 0.26 + this.rng() * 0.08;
        if (this.rng() > 0.12) this.box(g, bw - 0.02, bh, 0.32, mats[Math.floor(this.rng() * mats.length)], x0 + bw / 2, 0.07 + (i * (h - 0.1)) / rows + bh / 2, 0, { cast: false });
        x0 += bw;
      }
    }
    return g;
  }

  counter(x, z, w, rot = 0, material = KM.woodLight, top = KM.cream) {
    const g = this.group(x, z, rot);
    this.box(g, w, 1.0, 0.6, material, 0, 0.5, 0);
    this.box(g, w + 0.06, 0.05, 0.7, top, 0, 1.02, 0);
    return g;
  }

  rug(x, z, w, d, material) {
    const m = this.box(this.root, w, 0.012, d, material, x, 0.012, z, { cast: false });
    m.receiveShadow = true;
    return m;
  }

  cartons(x, z, n = 3) {
    for (let i = 0; i < n; i++) {
      const s = 0.4 + this.rng() * 0.25;
      this.box(this.root, s, s * 0.8, s, i % 2 ? KM.cardboard : KM.cardboard2, x + (this.rng() - 0.5) * 0.6, (s * 0.8) / 2 + (i > 1 ? 0.45 : 0), z + (this.rng() - 0.5) * 0.6, { rot: this.rng() });
    }
  }

  wallScreen(w, h, material = KM.screen, x = 0, y = 1.6, z = null) {
    const zz = z ?? -this.D / 2 + 0.12;
    this.box(this.root, w + 0.12, h + 0.12, 0.08, KM.dark, x, y, zz - 0.02);
    return this.box(this.root, w, h, 0.02, material, x, y, zz + 0.03, { cast: false });
  }

  board(x, z, rot, w = 1.6, colors = [KM.paper, KM.paper2, KM.paper3]) {
    const g = this.group(x, z, rot);
    this.box(g, w, 1.1, 0.06, KM.woodLight, 0, 1.45, 0);
    for (let i = 0; i < 7; i++) this.box(g, 0.22, 0.28, 0.01, colors[i % colors.length], -w / 2 + 0.2 + this.rng() * (w - 0.4), 1.2 + this.rng() * 0.6, 0.04, { rot: (this.rng() - 0.5) * 0.3, cast: false });
    for (const sx of [-1, 1]) this.box(g, 0.05, 1.0, 0.05, KM.metal, sx * (w / 2 - 0.1), 0.5, 0, { cast: false });
    return g;
  }

  elevatorDoor(x, z, rot, label = null) {
    const g = this.group(x, z, rot);
    this.box(g, 1.7, 2.5, 0.18, KM.dark, 0, 1.25, 0);
    for (const sx of [-1, 1]) this.box(g, 0.68, 2.2, 0.06, KM.steel, sx * 0.35, 1.12, 0.1, { cast: false });
    this.box(g, 0.5, 0.18, 0.04, label === "B" ? KM.screenRed : KM.screen, 0, 2.38, 0.11, { cast: false });
    return g;
  }

  stairs(x, z, rot) {
    const g = this.group(x, z, rot);
    for (let i = 0; i < 7; i++) this.box(g, 1.4, 0.18 * (i + 1), 0.35, KM.tile, 0, (0.18 * (i + 1)) / 2, -i * 0.35);
    this.box(g, 0.05, 1.0, 2.6, KM.metal, 0.72, 1.2, -1.05, { cast: false });
    return g;
  }

  // Cubes et anneaux qui flottent : réservé aux pièces anormales.
  anomaly(x, z, color = "#9b7bff") {
    const g = this.group(x, z);
    g.userData.dynamic = true;
    const m = glow(color, 1.4);
    for (let i = 0; i < 4; i++) {
      const cube = this.box(g, 0.28, 0.28, 0.28, m, (this.rng() - 0.5) * 1.6, 1.0 + this.rng() * 1.2, (this.rng() - 0.5) * 1.6, { cast: false });
      this.dyn(cube, "float", { speed: 0.6 + this.rng(), amp: 0.25, spin: 0.8 + this.rng() });
    }
    const ring = new THREE.Mesh(G("ring", () => new THREE.TorusGeometry(0.7, 0.05, 8, 40)), m);
    ring.position.set(0, 1.4, 0);
    g.add(ring);
    this.dyn(ring, "spin", { speed: 0.7 });
    return g;
  }
}

// ------------------------------------------------------------------ thèmes

function rows(k, { margin = 1.2, spacingX = 2.1, spacingZ = 2.3, front = 2.2 } = {}) {
  const pts = [];
  const nx = Math.max(1, Math.floor((k.W - 2 * margin) / spacingX) + 1);
  const nz = Math.max(1, Math.floor((k.D - margin - front) / spacingZ) + 1);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = nx === 1 ? 0 : -k.W / 2 + margin + (ix * (k.W - 2 * margin)) / (nx - 1);
      const z = -k.D / 2 + margin + 0.4 + iz * spacingZ;
      if (Math.abs(x) < 0.9 && z > k.D / 2 - front) continue; // allée de la porte
      pts.push([x, z]);
    }
  }
  return pts;
}

const T = {
  office(k, opts = {}) {
    for (const [x, z] of rows(k)) k.workstation(x, z, 0, opts);
    k.plant(k.W / 2 - 0.5, k.D / 2 - 0.6);
    k.shelf(-k.W / 2 + 0.3, k.D / 2 - 1.6, Math.PI / 2, 1.6, 1.6);
    k.standArea(-k.W / 2 + 1, k.D / 2 - 1.6, k.W / 2 - 1, k.D / 2 - 0.8, 3);
  },
  boss(k, { portrait = false } = {}) {
    k.rug(0, -0.4, k.W * 0.6, k.D * 0.55, KM.leatherRed);
    const g = k.group(0, -k.D / 2 + 1.6);
    k.box(g, 2.4, 0.08, 1.0, KM.deskDark, 0, 0.76, 0);
    k.box(g, 2.3, 0.72, 0.9, KM.woodDark, 0, 0.36, 0);
    k.box(g, 0.5, 0.32, 0.04, KM.dark, 0.5, 1.0, -0.2);
    k.armchair(0, -k.D / 2 + 0.75, 0, KM.leather, "work");
    k.chair(g, -0.5, 0.95, Math.PI, KM.chair);
    k.seat(g, -0.5, 0.95, Math.PI, { act: "talk" });
    k.chair(g, 0.5, 0.95, Math.PI, KM.chair);
    k.seat(g, 0.5, 0.95, Math.PI, { act: "talk" });
    k.shelf(-k.W / 2 + 0.3, -0.5, Math.PI / 2, 2.6, 2.1);
    k.plant(k.W / 2 - 0.6, -k.D / 2 + 0.6, 1.2);
    if (portrait) k.box(k.root, 1.6, 2.0, 0.06, KM.gold, k.W / 2 - 0.12, 1.6, 0, { rot: Math.PI / 2 });
    k.standArea(-1.5, 0.8, 1.5, k.D / 2 - 1, 2);
  },
  trading(k) {
    for (const [x, z] of rows(k, { spacingX: 2.0 })) k.workstation(x, z, 0, { screens: 3, screen: k.rng() > 0.5 ? KM.screenGreen : KM.screenRed });
    const ticker = k.wallScreen(k.W - 1.2, 0.5, KM.screenGreen, 0, 2.3);
    k.dyn(ticker, "flicker", { a: KM.screenGreen, b: KM.screenRed, every: 2.5 });
    k.standArea(-k.W / 2 + 1, k.D / 2 - 1.8, k.W / 2 - 1, k.D / 2 - 0.8, 4);
  },
  bank(k) {
    k.counter(0, -k.D / 2 + 2.2, k.W - 2.4);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 2.2;
      k.chair(k.root, x, -k.D / 2 + 1.4, 0);
      k.seat(k.root, x, -k.D / 2 + 1.4, 0, { act: "work" });
    }
    const vault = k.cyl(k.root, 0.95, 0.95, 0.2, KM.steel, k.W / 2 - 1.4, 1.2, -k.D / 2 + 0.2, 28);
    vault.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) k.stand(k.root, -1.5 + i * 0.75, -k.D / 2 + 3.2 + (i % 2) * 0.3, Math.PI, { act: "idle" });
    k.plant(-k.W / 2 + 0.6, k.D / 2 - 0.6);
  },
  lab(k, { color = "#4cc38a" } = {}) {
    const flask = mat(color, { emissive: color, emissiveIntensity: 1.1, transparent: true, opacity: 0.85 });
    const n = Math.max(1, Math.floor((k.D - 2.8) / 2.4));
    for (let i = 0; i < n; i++) {
      const z = -k.D / 2 + 1.4 + i * 2.4;
      const g = k.group(0, z);
      k.box(g, k.W - 2.4, 0.9, 0.8, KM.deskWhite, 0, 0.45, 0);
      k.box(g, k.W - 2.3, 0.05, 0.86, KM.dark, 0, 0.92, 0);
      for (let j = 0; j < 6; j++) k.cyl(g, 0.06, 0.09, 0.22, flask, -k.W / 2 + 1.6 + j * ((k.W - 3.2) / 5), 1.06, -0.15, 10);
      const stools = Math.max(2, Math.floor((k.W - 2.4) / 1.3));
      for (let j = 0; j < stools; j++) {
        const sx = -k.W / 2 + 1.8 + (j * (k.W - 3.6)) / Math.max(1, stools - 1);
        k.cyl(g, 0.2, 0.2, 0.06, KM.chair, sx, 0.62, 0.75, 12);
        k.cyl(g, 0.03, 0.03, 0.6, KM.metal, sx, 0.3, 0.75, 6);
        k.seat(g, sx, 0.75, Math.PI, { act: "work", y: 0.17 });
      }
    }
    k.standArea(-k.W / 2 + 1, k.D / 2 - 1.6, k.W / 2 - 1, k.D / 2 - 0.8, 3);
  },
  prototypes(k) {
    T.lab(k, { color: "#f2a541" });
    const gear = k.cyl(k.root, 0.5, 0.5, 0.12, KM.gold, k.W / 2 - 0.9, 1.3, -k.D / 2 + 0.5, 12);
    gear.rotation.x = Math.PI / 2;
    k.dyn(gear, "roll", { speed: 1.4 });
  },
  ai(k) {
    const wall = k.wallScreen(k.W - 1.6, 1.4, KM.screenPurple, 0, 1.6);
    k.dyn(wall, "pulse", { speed: 1.2 });
    for (const [x, z] of rows(k, { front: 2.6 }).slice(0, 4)) k.workstation(x, z + 1, 0, { screen: KM.screenPurple });
    k.standArea(-k.W / 2 + 1, k.D / 2 - 1.6, k.W / 2 - 1, k.D / 2 - 0.8, 3);
  },
  greenhouse(k) {
    const n = Math.max(2, Math.floor((k.W - 1.6) / 2));
    for (let i = 0; i < n; i++) {
      const x = -k.W / 2 + 1.2 + (i * (k.W - 2.4)) / Math.max(1, n - 1);
      if (Math.abs(x) < 0.8) continue;
      const g = k.group(x, -0.6);
      k.box(g, 0.9, 0.5, k.D - 3.2, KM.woodDark, 0, 0.25, 0);
      for (let j = 0; j < 4; j++) k.sphere(g, 0.32 + k.rng() * 0.15, j % 2 ? KM.leaf : KM.leaf2, 0, 0.75, -k.D / 2 + 2.2 + j * ((k.D - 4) / 3));
      k.stand(g, 0.9, 0, -Math.PI / 2, { act: "work" });
    }
    k.standArea(-1, -k.D / 2 + 1, 1, k.D / 2 - 1, 3);
  },
  servers(k) {
    const n = Math.max(2, Math.floor((k.W - 1.6) / 1.4));
    for (let i = 0; i < n; i++) {
      const x = -k.W / 2 + 1 + (i * (k.W - 2)) / Math.max(1, n - 1);
      if (Math.abs(x) < 0.8) continue;
      const g = k.group(x, -0.8);
      k.box(g, 0.8, 2.1, k.D - 3.6, KM.rack, 0, 1.05, 0);
      for (let j = 0; j < 8; j++) k.dyn(k.box(g, 0.02, 0.05, 0.12, j % 3 ? LED : LED2, 0.41, 0.4 + (j % 4) * 0.4, -1 + Math.floor(j / 4) * 2, { cast: false }), "blink", { speed: 3 + k.rng() * 4 });
    }
    k.standArea(-1, -k.D / 2 + 1, 1, k.D / 2 - 1.2, 3);
  },
  boiler(k) {
    for (const x of [-k.W / 4, k.W / 4]) {
      k.cyl(k.root, 0.9, 0.9, 2.2, KM.steel, x, 1.1, -k.D / 2 + 1.6, 20);
      k.cyl(k.root, 0.12, 0.12, k.D - 2, KM.metal, x, 2.4, 0, 8).rotation.x = Math.PI / 2;
      const gauge = k.box(k.root, 0.25, 0.25, 0.05, KM.screenRed, x, 1.5, -k.D / 2 + 2.55, { cast: false });
      k.dyn(gauge, "blink", { speed: 1.3 });
    }
    k.standArea(-k.W / 2 + 1, -0.5, k.W / 2 - 1, k.D / 2 - 1, 3);
  },
  warehouse(k, { fill = "boxes" } = {}) {
    const n = Math.max(1, Math.floor((k.D - 3) / 2.2));
    for (let i = 0; i < n; i++) {
      const z = -k.D / 2 + 0.9 + i * 2.2;
      k.shelf(-k.W / 4 - 0.4, z, 0, k.W / 2 - 1.6, 2.2, fill);
      k.shelf(k.W / 4 + 0.4, z, 0, k.W / 2 - 1.6, 2.2, fill);
    }
    k.cartons(-k.W / 2 + 1, k.D / 2 - 1.2, 4);
    k.cartons(k.W / 2 - 1, k.D / 2 - 1.4, 3);
    k.standArea(-k.W / 2 + 1, -k.D / 2 + 1.8, k.W / 2 - 1, k.D / 2 - 1, 6);
  },
  dock(k) {
    for (let i = 0; i < 4; i++) {
      const x = -k.W / 2 + 1.5 + i * ((k.W - 3) / 3);
      k.box(k.root, 1.2, 0.15, 1.2, KM.woodLight, x, 0.08, -k.D / 2 + 1.4);
      k.cartons(x, -k.D / 2 + 1.4, 2 + (i % 2));
    }
    k.box(k.root, k.W - 1, 2.6, 0.08, KM.metal, 0, 1.3, -k.D / 2 + 0.06);
    const lift = k.group(k.W / 2 - 1.8, 0.4, -0.6);
    k.box(lift, 0.9, 0.9, 1.4, KM.binder3, 0, 0.55, 0);
    k.box(lift, 0.08, 2, 0.08, KM.dark, 0, 1, -0.75);
    k.standArea(-k.W / 2 + 1, -0.5, k.W / 2 - 2.5, k.D / 2 - 1, 5);
  },
  newsroom(k) {
    T.office(k);
    k.box(k.root, 3, 0.5, 0.05, KM.red, 0, 2.3, -k.D / 2 + 0.1, { cast: false });
    k.cartons(k.W / 2 - 0.8, -k.D / 2 + 0.8, 2);
  },
  studio(k) {
    k.box(k.root, k.W - 1.2, 2.4, 0.06, KM.fabricBlue, 0, 1.2, -k.D / 2 + 0.12, { cast: false });
    const desk = k.group(0, -k.D / 2 + 1.8);
    k.box(desk, 2.4, 0.9, 0.7, KM.white, 0, 0.45, 0);
    for (const x of [-0.6, 0.6]) {
      k.chair(desk, x, -0.7, 0);
      k.seat(desk, x, -0.7, 0, { act: "talk" });
    }
    for (const x of [-1.6, 0, 1.6]) {
      const cam = k.group(x, k.D / 2 - 2, Math.PI);
      k.box(cam, 0.35, 0.3, 0.6, KM.dark, 0, 1.4, 0);
      k.cyl(cam, 0.03, 0.03, 1.3, KM.metal, 0, 0.65, 0, 6);
      k.stand(cam, 0, 0.6, Math.PI, { act: "film" });
    }
    const onAir = k.box(k.root, 0.8, 0.25, 0.04, KM.screenRed, k.W / 2 - 0.9, 2.3, -k.D / 2 + 0.16, { cast: false });
    k.dyn(onAir, "blink", { speed: 1 });
  },
  podcast(k) {
    k.rug(0, -0.6, 3.4, 3, KM.fabricGreen);
    k.roundTable(0, -0.6, { r: 0.8, chairs: 4, material: KM.woodDark, act: "talk" });
    const light = k.sphere(k.root, 0.12, KM.screenRed, 0, 2.4, -k.D / 2 + 0.2);
    k.dyn(light, "blink", { speed: 0.8 });
    k.shelf(-k.W / 2 + 0.3, 0, Math.PI / 2, 2, 1.8, "odd");
    k.standArea(-1, k.D / 2 - 1.6, 1, k.D / 2 - 0.8, 2);
  },
  influence(k) {
    k.box(k.root, k.W - 1.2, 2.2, 0.05, mat("#f6c6d8"), 0, 1.1, -k.D / 2 + 0.12, { cast: false });
    for (const x of [-1.2, 1.2]) {
      const ring = new THREE.Mesh(G("ringlight", () => new THREE.TorusGeometry(0.45, 0.05, 8, 32)), KM.lamp);
      ring.position.set(x, 1.6, -k.D / 2 + 1.6);
      k.root.add(ring);
      k.cyl(k.root, 0.02, 0.02, 1.4, KM.metal, x, 0.7, -k.D / 2 + 1.6, 6);
    }
    k.sofa(0, -k.D / 2 + 0.9, 0, 2.2, mat("#f2a7c3"), "phone");
    k.plant(k.W / 2 - 0.7, -k.D / 2 + 0.7, 1.1);
    k.standArea(-k.W / 2 + 1, 0.4, k.W / 2 - 1, k.D / 2 - 1, 4);
  },
  meeting(k, { material = KM.deskDark } = {}) {
    const w = Math.min(k.W - 2.4, 5.2);
    k.meetingTable(0, -0.5, w, 1.3, { material });
    k.wallScreen(Math.min(2.6, k.W - 2), 1.2, KM.screen, 0, 1.6);
    k.plant(k.W / 2 - 0.6, k.D / 2 - 0.6);
    k.standArea(-k.W / 2 + 1, k.D / 2 - 1.5, k.W / 2 - 1, k.D / 2 - 0.8, 2);
  },
  smallMeeting(k) {
    k.table(k.root, 0, -0.6, 1.4, 0.9, KM.white);
    for (const [x, z, f] of [[-0.45, -1.4, 0], [0.45, -1.4, 0], [0, 0.25, Math.PI]]) {
      k.chair(k.root, x, z, f);
      k.seat(k.root, x, z, f, { act: "talk" });
    }
    k.plant(k.W / 2 - 0.6, -k.D / 2 + 0.6);
    k.standArea(-1.5, k.D / 2 - 1.5, 1.5, k.D / 2 - 0.8, 2);
  },
  hemicycle(k) {
    const cx = 0;
    const cz = -k.D / 2 + 1.4; // tribune au fond
    k.box(k.root, 2.6, 1.1, 0.9, KM.woodDark, cx, 0.55, cz);
    k.box(k.root, 0.06, 2.6, 0.06, KM.metal, cx + 1.6, 1.3, cz);
    k.box(k.root, 0.6, 0.4, 0.02, KM.fabricBlue, cx + 1.92, 2.3, cz, { cast: false });
    k.stand(k.root, cx, cz - 0.7, 0, { act: "talk", speaker: true });
    for (let ring = 0; ring < 3; ring++) {
      const radius = 2.6 + ring * 1.5;
      const steps = 6 + ring * 3;
      const step = new THREE.Mesh(G(`arc${ring}`, () => new THREE.RingGeometry(radius - 0.45, radius + 0.45, 40, 1, Math.PI * 0.08, Math.PI * 0.84)), KM.woodLight);
      step.rotation.x = -Math.PI / 2;
      step.rotation.z = Math.PI;
      step.position.set(cx, 0.02 + ring * 0.25, cz);
      step.receiveShadow = true;
      k.root.add(step);
      for (let i = 0; i < steps; i++) {
        const a = Math.PI * 0.12 + (i / (steps - 1)) * Math.PI * 0.76;
        const x = cx + Math.cos(a) * radius;
        const z = cz + Math.sin(a) * radius;
        if (z > k.D / 2 - 0.5 || Math.abs(x) > k.W / 2 - 0.5) continue;
        const face = Math.atan2(cx - x, cz - z);
        k.chair(k.root, x, z, face + Math.PI, KM.leatherRed);
        k.seat(k.root, x, z, face, { act: "talk", y: ring * 0.25 });
      }
    }
  },
  court(k) {
    const bench = k.group(0, -k.D / 2 + 1.2);
    k.box(bench, 3.4, 1.3, 0.9, KM.woodDark, 0, 0.65, 0);
    k.box(bench, 3.6, 0.3, 1.1, KM.woodDark, 0, 0.15, -0.2);
    k.chair(bench, 0, -0.55, 0, KM.leatherRed);
    k.seat(bench, 0, -0.55, 0, { act: "work", y: 0.3, judge: true });
    k.box(bench, 0.2, 0.12, 0.2, KM.gold, 0.9, 1.36, 0.1);
    for (const x of [-k.W / 4, k.W / 4]) {
      k.table(k.root, x, -0.6, 1.8, 0.7, KM.woodDark);
      for (const dx of [-0.45, 0.45]) {
        k.chair(k.root, x + dx, 0.05, Math.PI);
        k.seat(k.root, x + dx, 0.05, Math.PI, { act: "talk" });
      }
    }
    const nb = Math.max(1, Math.floor((k.D / 2 - 1.8) / 1.1));
    for (let i = 0; i < nb; i++) {
      for (const sx of [-1, 1]) k.bench(sx * (k.W / 4 + 0.3), 1.3 + i * 1.1, Math.PI, Math.min(3, k.W / 2 - 1.6), KM.wood, "idle");
    }
  },
  seminar(k) {
    k.wallScreen(Math.min(3.4, k.W - 2), 1.6, KM.screen, 0, 1.7);
    const flip = k.group(-k.W / 2 + 1.3, -k.D / 2 + 1.2, 0.4);
    k.box(flip, 0.9, 1.1, 0.04, KM.paper, 0, 1.4, 0);
    k.box(flip, 0.05, 1.6, 0.05, KM.metal, 0, 0.8, -0.2);
    k.stand(k.root, 0, -k.D / 2 + 1.3, 0, { act: "talk", speaker: true });
    const cols = Math.max(2, Math.floor((k.W - 2) / 0.8));
    for (let r = 0; r < 4; r++) {
      const z = -k.D / 2 + 2.6 + r * 1.1;
      if (z > k.D / 2 - 1.4) break;
      for (let c = 0; c < cols; c++) {
        const x = -k.W / 2 + 1 + (c * (k.W - 2)) / (cols - 1);
        if (Math.abs(x) < 0.6) continue;
        k.chair(k.root, x, z, Math.PI);
        k.seat(k.root, x, z, Math.PI, { act: "idle" });
      }
    }
  },
  canteen(k, { tables = KM.white } = {}) {
    k.counter(0, -k.D / 2 + 0.7, k.W - 2, 0, KM.steel, KM.white);
    for (let i = 0; i < 3; i++) k.stand(k.root, -1.5 + i * 1.5, -k.D / 2 + 0.15, 0, { act: "work", staff: true });
    for (const [x, z] of rows(k, { margin: 1.5, spacingX: 2.4, spacingZ: 2.3, front: 1.8 }).filter(([, z]) => z > -k.D / 2 + 2.2)) k.roundTable(x, z, { chairs: 4, material: tables });
    k.standArea(-k.W / 2 + 1, -k.D / 2 + 1.4, k.W / 2 - 1, -k.D / 2 + 1.8, 3, Math.PI);
  },
  diner(k) {
    k.rug(0, 0, k.W - 2, 3, KM.leatherRed);
    const w = k.W - 3;
    k.meetingTable(0, -0.2, w, 1.1, { material: KM.woodDark, chairMat: KM.leatherRed });
    for (let i = 0; i < 3; i++) {
      const candle = k.cyl(k.root, 0.03, 0.03, 0.25, KM.gold, -w / 3 + (i * w) / 3, 0.92, -0.2, 6);
      const flame = k.sphere(k.root, 0.04, KM.lamp, candle.position.x, 1.08, -0.2);
      k.dyn(flame, "flicker-scale", { speed: 9 });
    }
    k.standArea(-k.W / 2 + 1, k.D / 2 - 1.4, k.W / 2 - 1, k.D / 2 - 0.8, 2);
  },
  bar(k) {
    const g = k.group(0, -k.D / 2 + 1.4);
    k.box(g, k.W - 2, 1.1, 0.6, KM.woodDark, 0, 0.55, 0);
    k.box(g, k.W - 1.9, 0.05, 0.75, KM.gold, 0, 1.12, 0);
    k.shelf(0, -k.D / 2 + 0.3, 0, k.W - 2, 1.8, "odd");
    const n = Math.max(2, Math.floor((k.W - 2.4) / 0.9));
    for (let i = 0; i < n; i++) {
      const x = -(k.W - 2.4) / 2 + (i * (k.W - 2.4)) / (n - 1);
      k.cyl(g, 0.2, 0.2, 0.06, KM.leatherRed, x, 0.75, 0.75, 12);
      k.cyl(g, 0.03, 0.03, 0.72, KM.metal, x, 0.36, 0.75, 6);
      k.seat(g, x, 0.75, Math.PI, { act: "eat", y: 0.3 });
    }
    k.roundTable(-k.W / 4, k.D / 2 - 2.2, { chairs: 3, material: KM.woodDark });
    k.roundTable(k.W / 4, k.D / 2 - 2.2, { chairs: 3, material: KM.woodDark });
  },
  bakery(k) {
    k.counter(0, -k.D / 2 + 1.6, k.W - 2.6, 0, KM.woodLight, KM.glass);
    for (let i = 0; i < 6; i++) k.cyl(k.root, 0.12, 0.12, 0.06, KM.binder3, -1.5 + i * 0.6, 1.1, -k.D / 2 + 1.6, 12);
    k.box(k.root, 1.4, 1.6, 0.8, KM.steel, -k.W / 2 + 1.1, 0.8, -k.D / 2 + 0.6);
    const oven = k.box(k.root, 0.8, 0.4, 0.02, glow("#ff8a3d", 1.3), -k.W / 2 + 1.1, 0.9, -k.D / 2 + 1.01, { cast: false });
    k.dyn(oven, "pulse", { speed: 0.7 });
    k.stand(k.root, 0, -k.D / 2 + 0.9, 0, { act: "work", staff: true });
    k.roundTable(-k.W / 4, k.D / 2 - 2, { chairs: 3 });
    k.roundTable(k.W / 4, k.D / 2 - 2, { chairs: 3 });
  },
  kitchen(k) {
    k.counter(0, -k.D / 2 + 0.5, k.W - 1.4, 0, KM.white, KM.steel);
    k.box(k.root, 0.9, 2, 0.7, KM.steel, k.W / 2 - 0.8, 1, -k.D / 2 + 0.5);
    k.table(k.root, 0, 0.2, 3, 1.1, KM.woodLight);
    for (let i = 0; i < 4; i++) {
      for (const [z, f] of [[-0.55, 0], [0.95, Math.PI]]) {
        const x = -1.2 + i * 0.8;
        k.chair(k.root, x, 0.2 + z, f);
        k.seat(k.root, x, 0.2 + z, f, { act: "eat" });
      }
    }
    k.standArea(-k.W / 2 + 1, -k.D / 2 + 1.2, k.W / 2 - 1.6, -k.D / 2 + 1.6, 2, Math.PI);
  },
  lounge(k, { material = KM.fabricBlue, tv = true } = {}) {
    k.rug(0, -0.6, Math.min(5, k.W - 2), Math.min(4, k.D - 3), KM.fabricGrey);
    k.sofa(0, -k.D / 2 + 1.0, 0, Math.min(3, k.W - 3), material);
    k.sofa(-k.W / 2 + 1.0, -0.4, Math.PI / 2, 2, material);
    k.armchair(k.W / 2 - 1.1, -0.4, -Math.PI / 2, KM.leather);
    k.box(k.root, 1.2, 0.4, 0.7, KM.woodDark, 0, 0.2, -0.5);
    if (tv) {
      const screen = k.box(k.root, 1.6, 0.9, 0.05, KM.screen, k.W / 2 - 0.15, 1.5, -0.4, { rot: -Math.PI / 2, cast: false });
      k.dyn(screen, "pulse", { speed: 0.5 });
    }
    k.plant(-k.W / 2 + 0.6, k.D / 2 - 0.7, 1.1);
    k.standArea(-k.W / 2 + 1, 0.8, k.W / 2 - 1, k.D / 2 - 1, 4);
  },
  club(k, { dim = false } = {}) {
    k.rug(0, -0.3, k.W - 1.6, k.D - 2.4, KM.leatherRed);
    const pairs = [[-k.W / 4, -k.D / 4], [k.W / 4, -k.D / 4], [-k.W / 4, k.D / 6], [k.W / 4, k.D / 6]];
    for (const [x, z] of pairs) {
      k.armchair(x - 0.7, z, Math.PI / 2, KM.leather, "talk");
      k.armchair(x + 0.7, z, -Math.PI / 2, KM.leather, "talk");
      k.cyl(k.root, 0.35, 0.35, 0.5, KM.woodDark, x, 0.25, z, 16);
    }
    if (!dim) k.shelf(0, -k.D / 2 + 0.3, 0, Math.min(4, k.W - 2), 2.1);
    const lamp = k.sphere(k.root, 0.25, KM.lamp, 0, 2.4, 0);
    if (dim) k.dyn(lamp, "flicker-scale", { speed: 2 });
    k.standArea(-k.W / 2 + 1, k.D / 2 - 1.4, k.W / 2 - 1, k.D / 2 - 0.8, 2);
  },
  cellar(k) {
    for (const sx of [-1, 1]) k.shelf(sx * (k.W / 2 - 0.4), -0.4, sx * Math.PI / 2, k.D - 2, 2, "odd");
    k.cyl(k.root, 0.5, 0.5, 0.9, KM.woodDark, 0, 0.45, -0.6, 14);
    k.standArea(-1.2, -1.8, 1.2, k.D / 2 - 1, 3);
  },
  dorm(k) {
    const cols = Math.max(2, Math.floor((k.W - 1) / 1.5));
    for (const [z, rot] of [[-k.D / 2 + 1.2, 0]]) {
      for (let i = 0; i < cols; i++) {
        const x = -k.W / 2 + 0.9 + (i * (k.W - 1.8)) / (cols - 1);
        k.bed(x, z, rot, i % 2 ? KM.blanket : KM.blanket2);
      }
    }
    // Deuxième rangée, pieds vers le fond (allée centrale libre).
    const z2 = k.D / 2 - 2.2;
    for (let i = 0; i < cols; i++) {
      const x = -k.W / 2 + 0.9 + (i * (k.W - 1.8)) / (cols - 1);
      if (Math.abs(x) < 1.1) continue;
      k.bed(x, z2, Math.PI, i % 2 ? KM.blanket2 : KM.blanket);
    }
    for (let i = 0; i < cols - 1; i++) {
      const x = -k.W / 2 + 0.9 + ((i + 0.5) * (k.W - 1.8)) / (cols - 1);
      k.box(k.root, 0.4, 0.5, 0.4, KM.woodLight, x, 0.25, -k.D / 2 + 0.4);
      k.sphere(k.root, 0.09, KM.lamp, x, 0.62, -k.D / 2 + 0.4);
    }
    k.standArea(-k.W / 2 + 1, -0.3, k.W / 2 - 1, 0.5, 4);
  },
  // Hôtel des Employés : couchettes-capsules sur trois niveaux, rangées dos à dos (près de 100 places).
  capsules(k) {
    const levels = [0, 0.95, 1.9];
    const step = 1.05;
    const cols = Math.max(4, Math.floor((k.W - 0.5) / step));
    const x0 = -((cols - 1) * step) / 2;
    const frame = KM.cream;
    const rows = [
      [-k.D / 2 + 1.1, 0],
      [-0.25, Math.PI],
      [1.85, 0],
    ];
    rows.forEach(([z, rot], r) => {
      for (let c = 0; c < cols; c++) {
        const g = k.group(x0 + c * step, z, rot);
        for (const sx of [-0.5, 0.5]) k.box(g, 0.05, 2.85, 2.1, frame, sx, 1.425, 0, { cast: false });
        k.box(g, 1.0, 2.85, 0.05, frame, 0, 1.425, -1.04, { cast: false });
        levels.forEach((y, i) => {
          k.box(g, 0.98, 0.08, 2.08, frame, 0, y + 0.36, 0, { cast: false });
          k.box(g, 0.9, 0.1, 1.95, KM.cream, 0, y + 0.45, 0, { cast: false });
          k.box(g, 0.5, 0.08, 0.28, KM.pillow, 0, y + 0.54, -0.78, { cast: false });
          const lamp = (r + c + i) % 3 === 0;
          if (lamp) k.box(g, 0.12, 0.05, 0.05, KM.lamp, 0.35, y + 0.86, -0.98, { cast: false });
          k.spot(g, 0, 0.95, 0, "bed", { lie: true, lieY: y + 0.66, act: "sleep", capsule: true });
        });
      }
    });
    k.standArea(-k.W / 2 + 1, k.D / 2 - 1.6, k.W / 2 - 1, k.D / 2 - 0.8, 4);
  },
  laundry(k) {
    const n = Math.max(3, Math.floor((k.W - 1.6) / 0.85));
    for (let i = 0; i < n; i++) {
      const x = -k.W / 2 + 0.9 + i * 0.85;
      k.box(k.root, 0.7, 0.9, 0.7, KM.white, x, 0.45, -k.D / 2 + 0.5);
      const door = k.cyl(k.root, 0.22, 0.22, 0.03, KM.glass, x, 0.5, -k.D / 2 + 0.86, 18);
      door.rotation.x = Math.PI / 2;
      if (i % 2) k.dyn(door, "roll", { speed: 3 });
    }
    k.table(k.root, 0, 0.4, 2.2, 0.9, KM.white);
    k.box(k.root, 0.12, 0.05, 0.1, KM.red, -0.4, 0.8, 0.3);
    k.box(k.root, 0.12, 0.05, 0.1, KM.binder, 0.5, 0.8, 0.5);
    k.bench(0, k.D / 2 - 1.4, Math.PI, 2, KM.wood, "talk");
    k.standArea(-k.W / 2 + 1, -0.6, k.W / 2 - 1, 1.4, 4);
  },
  hall(k) {
    // L'aquarium de Gustave, le banc du pigeon, le grand tapis et le comptoir des rumeurs.
    const aq = k.group(-k.W / 2 + 2.2, -k.D / 2 + 1.6);
    k.box(aq, 2.6, 0.7, 1.3, KM.woodDark, 0, 0.35, 0);
    const water = k.box(aq, 2.4, 1.1, 1.1, KM.water, 0, 1.25, 0, { cast: false });
    water.renderOrder = 2;
    k.dyn(water, "water", { speed: 1 });
    k.spot(aq, 0, 0, 0, "aquarium", { animal: "homard", y: 0.75 });
    k.rug(0.5, 0.2, k.W * 0.5, k.D * 0.45, mat("#7a1f2b"));
    k.cyl(k.root, 0.35, 0.35, 3, KM.cream, 1.2, 1.5, -1.2, 18);
    k.bench(k.W / 2 - 2, -k.D / 2 + 0.8, 0, 2.4, KM.wood, "idle");
    k.bench(-k.W / 2 + 2, k.D / 2 - 1.6, Math.PI, 2.4, KM.wood, "idle");
    k.spot(k.root, k.W / 2 - 2.9, -k.D / 2 + 0.6, 0, "perch", { animal: "pigeon", y: 0.48 });
    const machine = k.group(k.W / 2 - 0.6, 0.6, -Math.PI / 2);
    k.box(machine, 0.7, 1.7, 0.6, KM.dark, 0, 0.85, 0);
    k.box(machine, 0.5, 0.4, 0.02, KM.screen, 0, 1.25, 0.31, { cast: false });
    k.stand(machine, 0, 0.75, Math.PI, { act: "coffee" });
    k.plant(k.W / 2 - 0.6, -k.D / 2 + 0.6, 1.3);
    k.plant(-k.W / 2 + 0.6, k.D / 2 - 0.6, 1.3);
    k.standArea(-k.W / 2 + 3.5, -0.8, k.W / 2 - 1.8, k.D / 2 - 1, 12);
  },
  reception(k) {
    const g = k.group(0, -k.D / 2 + 1.8);
    k.box(g, 3, 1.1, 0.6, KM.woodLight, 0, 0.55, 0);
    k.box(g, 3.1, 0.05, 0.75, KM.cream, 0, 1.12, 0);
    for (const x of [-0.7, 0.7]) {
      k.chair(g, x, -0.7, 0);
      k.seat(g, x, -0.7, 0, { act: "work" });
    }
    k.box(g, 0.3, 0.2, 0.2, KM.gold, 1.2, 1.25, 0);
    k.standArea(-k.W / 2 + 1, -k.D / 2 + 2.7, k.W / 2 - 1, k.D / 2 - 1, 4, Math.PI);
    k.plant(k.W / 2 - 0.6, -k.D / 2 + 0.6);
  },
  security(k) {
    const wall = k.wallScreen(k.W - 1.4, 1.3, KM.screen, 0, 1.6);
    k.dyn(wall, "flicker", { a: KM.screen, b: KM.screenGreen, every: 3 });
    T.office(k, { screens: 2 });
  },
  complaints(k) {
    k.counter(0, -k.D / 2 + 1.4, k.W - 1.6, 0, KM.fabricGrey, KM.cream);
    k.chair(k.root, 0, -k.D / 2 + 0.7, 0);
    k.seat(k.root, 0, -k.D / 2 + 0.7, 0, { act: "work" });
    const num = k.box(k.root, 0.6, 0.3, 0.04, KM.screenRed, k.W / 2 - 0.9, 2.2, -k.D / 2 + 0.15, { cast: false });
    k.dyn(num, "blink", { speed: 0.4 });
    for (let i = 0; i < 6; i++) k.stand(k.root, (i % 2 ? 0.3 : -0.3), -k.D / 2 + 2.3 + i * 0.6, Math.PI, { act: "idle", queue: true });
  },
  notices(k) {
    k.board(-k.W / 4, -k.D / 2 + 0.25, 0, 1.8);
    k.board(k.W / 4, -k.D / 2 + 0.25, 0, 1.8, [KM.paper2, KM.paper, KM.red]);
    k.standArea(-k.W / 2 + 1, -k.D / 2 + 1, k.W / 2 - 1, k.D / 2 - 1, 5, Math.PI);
  },
  waiting(k) {
    for (let r = 0; r < 3; r++) {
      const z = -k.D / 2 + 1.2 + r * 1.3;
      if (z > k.D / 2 - 1.4) break;
      for (const sx of [-1, 1]) k.bench(sx * (k.W / 4 + 0.3), z, 0, Math.min(2.6, k.W / 2 - 1.2), KM.fabricGrey, "idle");
    }
    k.box(k.root, 0.4, 1.3, 0.3, KM.red, k.W / 2 - 0.5, 0.65, k.D / 2 - 1); // distributeur de tickets
    k.plant(-k.W / 2 + 0.6, k.D / 2 - 0.6);
  },
  archives(k, { lectern = false } = {}) {
    const n = Math.max(1, Math.floor((k.D - 2.6) / 1.8));
    for (let i = 0; i < n; i++) {
      const z = -k.D / 2 + 0.6 + i * 1.8;
      k.shelf(-k.W / 4 - 0.3, z, 0, k.W / 2 - 1.4, 2.3);
      k.shelf(k.W / 4 + 0.3, z, 0, k.W / 2 - 1.4, 2.3);
    }
    if (lectern) {
      const g = k.group(0, k.D / 2 - 2.2);
      k.box(g, 0.6, 1.0, 0.5, KM.woodDark, 0, 0.5, 0);
      k.box(g, 1.1, 0.12, 0.8, KM.cream, 0, 1.08, 0, { rot: 0.1 });
      k.stand(g, 0, 0.7, Math.PI, { act: "write" });
    }
    k.table(k.root, 0, k.D / 2 - 1.4, 1.4, 0.7, KM.woodDark);
    k.chair(k.root, 0, k.D / 2 - 0.8, Math.PI);
    k.seat(k.root, 0, k.D / 2 - 0.8, Math.PI, { act: "work" });
    k.standArea(-1, -k.D / 2 + 1.2, 1, k.D / 2 - 2.4, 3);
  },
  evidence(k) {
    T.archives(k);
    k.plant(0, -0.4, 1.2); // la plante qui témoigne
  },
  investigations(k) {
    T.office(k);
    k.board(0, -k.D / 2 + 0.25, 0, 2.4, [KM.paper, KM.red, KM.paper2]);
  },
  secretRoom(k) {
    k.cartons(-k.W / 4, -k.D / 4, 5);
    k.cartons(k.W / 4, -k.D / 4, 4);
    k.cartons(0, 0.6, 3);
    const bulb = k.sphere(k.root, 0.12, KM.lamp, 0, 2.3, 0);
    k.dyn(bulb, "flicker-scale", { speed: 4 });
    k.standArea(-k.W / 2 + 1, 0.5, k.W / 2 - 1, k.D / 2 - 1, 3);
  },
  market(k) {
    for (let i = 0; i < 3; i++) {
      const x = -k.W / 2 + 1.4 + i * ((k.W - 2.8) / 2);
      const g = k.group(x, -k.D / 2 + 1.3);
      k.box(g, 1.6, 0.9, 0.7, KM.woodLight, 0, 0.45, 0);
      k.box(g, 1.7, 0.05, 0.9, KM.red, 0, 2.0, 0.1);
      for (const sx of [-0.75, 0.75]) k.box(g, 0.05, 2, 0.05, KM.metal, sx, 1, 0.45, { cast: false });
      k.cartons(x, -k.D / 2 + 0.5, 2);
      k.stand(g, 0, -0.7, 0, { act: "talk", staff: true });
    }
    k.standArea(-k.W / 2 + 1, -0.6, k.W / 2 - 1, k.D / 2 - 1, 5, Math.PI);
  },
  palier(k, { cabins = 2 } = {}) {
    // Repère tourné : le fond (-z) est le mur ouest, avec l'Ascenseur B et ses collègues.
    for (let i = 0; i < cabins; i++) {
      const x = (i - (cabins - 1) / 2) * 2.4;
      k.elevatorDoor(x, -k.D / 2 + 0.15, 0, i === 0 ? "B" : null);
      k.stand(k.root, x, -k.D / 2 + 1.3, Math.PI, { act: "phone", elevator: true });
    }
    k.stairs(k.W / 2 - 1.2, -k.D / 2 + 2.6, 0);
    k.plant(-k.W / 2 + 0.7, -k.D / 2 + 0.7, 1.1);
    k.bench(-k.W / 2 + 1.6, 0.6, Math.PI / 2, 1.8, KM.fabricGrey, "idle");
    k.standArea(-1.5, -k.D / 2 + 1.8, 1.5, k.D / 2 - 1.5, 6);
  },
  elevators(k) {
    T.palier(k, { cabins: Math.min(4, Math.floor(k.W / 2.2)) });
  },
  owner(k) {
    k.rug(0, -0.3, k.W - 2, k.D - 2.4, mat("#1c1f2e"));
    const g = k.group(0, -k.D / 2 + 1.8);
    k.box(g, 3.4, 0.1, 1.3, KM.deskDark, 0, 0.8, 0);
    k.box(g, 3.2, 0.76, 1.1, KM.gold, 0, 0.38, 0);
    const button = k.cyl(g, 0.11, 0.13, 0.08, KM.screenRed, 1.2, 0.89, 0.2, 18);
    k.dyn(button, "pulse", { speed: 1.5 });
    k.armchair(0, -k.D / 2 + 0.8, 0, KM.leatherRed, "work");
    k.box(k.root, k.W - 1, 1.8, 0.04, mat("#8fcfff", { emissive: "#3a5f8f", emissiveIntensity: 0.6 }), 0, 1.6, -k.D / 2 + 0.06, { cast: false });
    k.plant(k.W / 2 - 0.7, k.D / 2 - 0.8, 1.3);
    k.standArea(-1.5, 0.4, 1.5, k.D / 2 - 1.2, 2);
  },
  screens(k) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const s = k.box(k.root, (k.W - 2) / 6 - 0.1, 0.55, 0.03, [KM.screen, KM.screenGreen, KM.screenPurple][(r + c) % 3], -k.W / 2 + 1 + ((c + 0.5) * (k.W - 2)) / 6, 0.9 + r * 0.65, -k.D / 2 + 0.12, { cast: false });
      if ((r + c) % 4 === 0) k.dyn(s, "flicker", { a: KM.screen, b: KM.screenRed, every: 1.7 + c });
    }
    k.counter(0, -k.D / 2 + 2.2, k.W - 3, 0, KM.dark, KM.dark);
    k.armchair(0, -k.D / 2 + 3.1, Math.PI, KM.leather, "work");
    k.standArea(-1.5, 0.6, 1.5, k.D / 2 - 1, 2);
  },
  anomalies(k) {
    k.anomaly(-k.W / 4, -k.D / 4, "#9b7bff");
    k.anomaly(k.W / 4, k.D / 8, "#4cc38a");
    k.shelf(0, -k.D / 2 + 0.3, 0, k.W - 2, 2, "odd");
    k.standArea(-k.W / 2 + 1, 0.4, k.W / 2 - 1, k.D / 2 - 1, 4);
  },
  unknown(k) {
    // La pièce 2-? : une table, des chaises, un planning complet et aucune fonction connue.
    k.meetingTable(0, -0.8, Math.min(3, k.W - 2), 1, { material: KM.white });
    k.anomaly(0, k.D / 2 - 2, "#f2a541");
    k.board(-k.W / 2 + 0.3, 0, Math.PI / 2, 1.6);
  },
  prophecies(k) {
    T.boss(k);
    const ball = k.sphere(k.root, 0.22, KM.screenPurple, 0.7, 1.05, -k.D / 2 + 1.6);
    k.dyn(ball, "pulse", { speed: 0.9 });
  },
  ghostCorridor(k) {
    for (let i = 0; i < 5; i++) {
      const z = -k.D / 2 + 1 + i * ((k.D - 2) / 4);
      const arch = new THREE.Mesh(G("arch", () => new THREE.TorusGeometry(1.6, 0.08, 6, 30, Math.PI)), KM.screenPurple);
      arch.position.set(-0.5 + i * 0.25, 0, z);
      k.root.add(arch);
    }
    k.anomaly(0, 0, "#9b7bff");
    k.standArea(-1.5, -k.D / 2 + 1, 1.5, k.D / 2 - 1, 3);
  },
  ghostOffice(k) {
    k.workstation(0, -k.D / 2 + 1.6, 0);
    k.cyl(k.root, 0.05, 0.04, 0.1, KM.white, 0.45, 0.82, -k.D / 2 + 1.5, 10); // le café encore chaud
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.chair(k.root, Math.cos(a) * 2.3, Math.sin(a) * 1.6 + 0.6, a + Math.PI / 2);
    }
    k.anomaly(k.W / 2 - 1.2, k.D / 2 - 1.5, "#9b7bff");
  },
  ghostChairs(k) {
    // « Vide mais pleine » : quarante chaises tournées vers la porte.
    const cols = 8;
    for (let r = 0; r < 5; r++) for (let c = 0; c < cols; c++) {
      const x = -k.W / 2 + 0.8 + (c * (k.W - 1.6)) / (cols - 1);
      const z = -k.D / 2 + 0.8 + r * ((k.D - 2.8) / 4);
      k.chair(k.root, x, z, Math.PI);
    }
  },
  ghostElevators(k) {
    T.palier(k, { cabins: 3 });
    k.table(k.root, 0, 0.4, 1.2, 1.2, KM.fabricGreen);
  },
};

// Thème de chaque pièce (identifiant précis, sinon type de pièce).
const BY_ID = {
  "f0.hall": "hall", "f0.reception": "reception", "f0.securite": "security", "f0.cafeteria": "canteen", "f0.ascenseurs": "elevators", "f0.affichage": "notices", "f0.plaintes": "complaints",
  "fm1.quai": "dock", "fm1.entrepot": "warehouse", "fm1.objets": ["warehouse", { fill: "odd" }], "fm1.livreurs": "lounge", "fm1.marche": "market", "fm1.secrete": "secretRoom",
  "fm2.labo": ["lab", { color: "#9b7bff" }], "fm2.archives": "archives", "fm2.anomalies": "anomalies", "fm2.inconnue": "unknown", "fm2.propheties": "prophecies",
  "f1.entretiens": "smallMeeting", "f1.drh": "boss", "f1.seminaire": "seminar", "f1.accueil": "reception",
  "f2.pdg": ["boss", { portrait: true }], "f2.registre": ["archives", { lectern: true }], "f2.couloir": "waiting",
  "f3.corbeille": "trading", "f3.banque": "bank", "f3.biscuiterie": "bakery",
  "f4.redaction": "newsroom", "f4.tv": "studio", "f4.podcast": "podcast", "f4.influence": "influence",
  "f5.labo": "lab", "f5.prototypes": "prototypes", "f5.ia": "ai", "f5.reserve": "secretRoom",
  "f6.hemicycle": "hemicycle", "f6.buvette": "bar", "f6.lobby": ["club", {}],
  "f7.salon": "club", "f7.diner": "diner", "f7.fumoir": ["club", { dim: true }], "f7.cave": "cellar",
  "f8.aileA": "capsules", "f8.aileB": "capsules", "f8.aileC": "capsules", "f8.salon": "lounge", "f8.cuisine": "kitchen", "f8.buanderie": "laundry",
  "f9.audience": "court", "f9.greffe": "office", "f9.enquetes": "investigations", "f9.scelles": "evidence", "f9.attente": "waiting",
  "f10.couloir": "ghostCorridor", "f10.bureau100": "ghostOffice", "f10.lendemain": "archives", "f10.ascenseurs": "ghostElevators", "f10.pleine": "ghostChairs",
  "f12.serres": "greenhouse", "f12.serveurs": "servers", "f12.chaufferie": "boiler",
  "ph.bureau": "owner", "ph.ecrans": "screens", "ph.archives": "archives",
};
const BY_KIND = { work: "office", meeting: "meeting", food: "canteen", social: "lounge", rest: "dorm", transit: "palier", special: "anomalies", secret: "secretRoom", owner: "owner" };

export function themeOf(room) {
  const entry = BY_ID[room.id] || (room.key === "palier" ? "palier" : BY_KIND[room.kind] || "office");
  return Array.isArray(entry) ? entry : [entry, {}];
}

// Meuble une pièce. `root` est déjà placé et tourné (porte en +z local).
export function furnish(root, room, W, D, rng) {
  const kit = new Kit(root, W, D, rng);
  const [name, opts] = themeOf(room);
  (T[name] || T.office)(kit, opts);
  // Toujours quelques places debout près de la porte : personne n'est jamais « sans place ».
  kit.standArea(-W / 2 + 0.8, D / 2 - 1.4, W / 2 - 0.8, D / 2 - 0.7, 3);

  // Emprise des meubles (repère de la pièce) : les places debout ne tombent jamais dessus.
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const boxes = [];
  for (const child of root.children) {
    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty() || box.max.y < 0.1) continue; // tapis
    box.applyMatrix4(inverse).expandByScalar(0.3);
    boxes.push(box);
  }
  const blocked = (x, z) => boxes.some((b) => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z);
  kit.spots = kit.spots.filter((sp) => !(sp.wander && blocked(sp.x, sp.z)));
  // Places de foule : une grille entre les meubles, utilisée seulement quand la pièce se remplit.
  let crowd = 0;
  for (let x = -W / 2 + 0.6; x <= W / 2 - 0.6 && crowd < 140; x += 0.8) {
    for (let z = -D / 2 + 0.6; z <= D / 2 - 0.6 && crowd < 140; z += 0.8) {
      const jx = x + (rng() - 0.5) * 0.3;
      const jz = z + (rng() - 0.5) * 0.3;
      if (blocked(jx, jz)) continue;
      kit.stand(root, jx, jz, rng() * Math.PI * 2, { overflow: true, wander: true });
      crowd += 1;
    }
  }
  return { spots: kit.spots, dynamics: kit.dynamics, theme: name };
}
