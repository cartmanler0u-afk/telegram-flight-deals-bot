// Plan de l'étage (en mètres). x : ouest → est, z : nord → sud (la caméra regarde vers le nord).
// Orientation d'un personnage : angle y, 0 = regarde vers +z (sud), π = vers le nord.

export const BOUNDS = { minX: -26, maxX: 40, minZ: -17, maxZ: 17 };
export const WALL_H = 2.7;

const S = 0;
const N = Math.PI;
const E = Math.PI / 2;
const W = -Math.PI / 2;
export const FACING = { S, N, E, W };

// Zones : rectangle [x0, z0, x1, z1], point de focus caméra, point de visite (le patron s'y rend), étiquette.
export const AREAS = {
  director: { rect: [-26, -17, -17, -9], focus: [-21.5, -13], visit: [-20, -10.4], label: [-21.5, -9.6] },
  meeting: { rect: [-17, -17, -6, -9], focus: [-11.5, -13], visit: [-12, -10.4], label: [-11.5, -9.6] },
  library: { rect: [-6, -17, 3, -9], focus: [-1.5, -13], visit: [-1.5, -10.4], label: [-1.5, -9.6] },
  studio: { rect: [3, -17, 13, -9], focus: [8, -13], visit: [7, -10.4], label: [8, -9.6] },
  montage: { rect: [13, -17, 20, -9], focus: [16.5, -13], visit: [16.5, -10.2], label: [16.5, -9.6] },
  createurs: { rect: [20, -17, 26, -9], focus: [23, -13], visit: [23, -10.2], label: [23, -9.6] },
  kitchen: { rect: [-26, 9, -15, 17], focus: [-20.5, 13], visit: [-18, 10.6], label: [-20.5, 9.4] },
  annexe: { rect: [-15, 9, -8, 17], focus: [-11.5, 13], visit: [-11.5, 10.4], label: [-11.5, 9.4] },
  reception: { rect: [-8, 9, -2, 17], focus: [-5, 13], visit: [-3.3, 11.4], label: [-5, 9.4] },
  photo: { rect: [2, 9, 9, 17], focus: [5.5, 13], visit: [5, 10.4], label: [5.5, 9.4] },
  warehouse: { rect: [9, 9, 26, 17], focus: [17.5, 13], visit: [16, 10.6], label: [17.5, 9.4] },
  // Aile Est (v3)
  marketing: { rect: [26, -17, 33, -9], focus: [29.5, -13], visit: [29.5, -10.4], label: [29.5, -9.6] },
  legal: { rect: [33, -17, 40, -9], focus: [36.5, -13], visit: [36.5, -10.2], label: [36.5, -9.6] },
  lounge: { rect: [31, -7, 40, 4], focus: [35.5, -1.5], visit: [33.2, -4.8], label: [35.5, 3.4] },
  gym: { rect: [26, 9, 33, 17], focus: [29.5, 13], visit: [29, 10.4], label: [29.5, 9.4] },
  hr: { rect: [33, 9, 40, 17], focus: [36.5, 13], visit: [36, 10.6], label: [36.5, 9.4] },
  openspace: { rect: [-26, -9, 31, 9], focus: [2, 0], visit: [0, 2.2], label: null },
};

// Murs : segments avec ouvertures. kind : outer | glass | blinds (stores) | half (muret + vitre).
export const WALLS = [
  { from: [-26, -17], to: [40, -17], kind: "outer" },
  { from: [-26, -17], to: [-26, 17], kind: "outer" },
  { from: [40, -17], to: [40, 17], kind: "outer" },
  { from: [-26, 17], to: [40, 17], kind: "outer", gaps: [[-1.8, 1.8]] },
  // Rangée nord
  { from: [-26, -9], to: [-17, -9], kind: "blinds", gaps: [[-20.8, -19.2]] },
  { from: [-17, -9], to: [-6, -9], kind: "glass", gaps: [[-12.8, -11.2]] },
  { from: [-6, -9], to: [3, -9], kind: "glass", gaps: [[-2.3, -0.7]] },
  { from: [3, -9], to: [13, -9], kind: "glass", gaps: [[6.2, 7.8]] },
  { from: [13, -9], to: [20, -9], kind: "glass", gaps: [[15.7, 17.3]] },
  { from: [20, -9], to: [26, -9], kind: "glass", gaps: [[22.2, 23.8]] },
  { from: [-17, -17], to: [-17, -9], kind: "blinds" },
  { from: [-6, -17], to: [-6, -9], kind: "glass" },
  { from: [3, -17], to: [3, -9], kind: "glass" },
  { from: [13, -17], to: [13, -9], kind: "glass" },
  { from: [20, -17], to: [20, -9], kind: "glass" },
  // Rangée sud
  { from: [-26, 9], to: [-15, 9], kind: "glass", gaps: [[-18.8, -17.2]] },
  { from: [-15, 9], to: [-8, 9], kind: "glass", gaps: [[-12.3, -10.7]] },
  { from: [2, 9], to: [9, 9], kind: "glass", gaps: [[4.2, 5.8]] },
  { from: [9, 9], to: [26, 9], kind: "half", gaps: [[15.2, 16.8], [20, 23]] },
  { from: [-15, 9], to: [-15, 17], kind: "glass" },
  { from: [-8, 9], to: [-8, 17], kind: "glass" },
  { from: [2, 9], to: [2, 17], kind: "glass" },
  { from: [9, 9], to: [9, 17], kind: "half" },
  // Aile Est : marketing et juridique au nord, salle de repos, salle de sport et RH au sud
  { from: [26, -17], to: [26, -9], kind: "glass" },
  { from: [26, -9], to: [33, -9], kind: "glass", gaps: [[28.7, 30.3]] },
  { from: [33, -17], to: [33, -9], kind: "blinds" },
  { from: [33, -9], to: [40, -9], kind: "blinds", gaps: [[35.7, 37.3]] },
  { from: [31, -7], to: [40, -7], kind: "half" },
  { from: [31, -7], to: [31, 4], kind: "half", gaps: [[-5.6, -4.0]] },
  { from: [31, 4], to: [40, 4], kind: "half", gaps: [[35.2, 36.8]] },
  { from: [26, 9], to: [26, 17], kind: "solid" },
  { from: [26, 9], to: [33, 9], kind: "glass", gaps: [[28.2, 29.8]] },
  { from: [33, 9], to: [33, 17], kind: "glass" },
  { from: [33, 9], to: [40, 9], kind: "glass", gaps: [[35.2, 36.8]] },
];

// Postes de travail des pièces : position de la chaise et orientation de la personne assise.
export const ROOM_DESKS = {
  director: [{ id: "dir", x: -21.5, z: -14.6, facing: S, w: 2.3 }],
  meeting: [{ id: "scribe", x: -7.0, z: -15.4, facing: N, w: 1.3 }],
  library: [{ id: "lib1", x: 1.3, z: -12.4, facing: S, w: 1.6 }, { id: "lib2", x: 1.3, z: -15.2, facing: S, w: 1.6 }],
  studio: [
    { id: "st1", x: 5, z: -13.6, facing: N, w: 2, dual: true },
    { id: "st2", x: 8.6, z: -13.6, facing: N, w: 2, dual: true },
    { id: "st3", x: 5, z: -11.0, facing: N, w: 2, dual: true },
    { id: "st4", x: 8.6, z: -11.0, facing: N, w: 2, dual: true },
  ],
  montage: [{ id: "mt1", x: 14.8, z: -11.2, facing: N, w: 1.8, dual: true }, { id: "mt2", x: 18.4, z: -11.2, facing: N, w: 1.8, dual: true }],
  createurs: [{ id: "cr1", x: 21.6, z: -11.6, facing: N, w: 1.6 }, { id: "cr2", x: 24.4, z: -11.6, facing: N, w: 1.6 }],
  reception: [{ id: "rec1", x: -5.8, z: 12.0, facing: E, w: 1.5 }, { id: "rec2", x: -5.8, z: 13.8, facing: E, w: 1.5 }],
  annexe: [{ id: "acc1", x: -13.2, z: 13.0, facing: N, w: 1.6 }, { id: "acc2", x: -10.4, z: 13.0, facing: N, w: 1.6 }],
  photo: [{ id: "ph1", x: 3.4, z: 15.2, facing: S, w: 1.4 }],
  warehouse: [{ id: "wh1", x: 10.6, z: 13.6, facing: E, w: 1.6 }],
  marketing: [
    { id: "mk1", x: 27.8, z: -13.6, facing: N, w: 2, dual: true },
    { id: "mk2", x: 31.2, z: -13.6, facing: N, w: 2 },
    { id: "mk3", x: 27.8, z: -11.0, facing: N, w: 2 },
    { id: "mk4", x: 31.2, z: -11.0, facing: N, w: 2, dual: true },
  ],
  legal: [{ id: "lg1", x: 35.0, z: -13.4, facing: N, w: 1.6 }, { id: "lg2", x: 38.2, z: -13.4, facing: N, w: 1.6 }],
  hr: [{ id: "hr1", x: 35.0, z: 15.0, facing: N, w: 1.5 }, { id: "hr2", x: 38.4, z: 15.0, facing: N, w: 1.5 }],
};

// Îlots de 4 bureaux du plateau (style "bullpen").
export const PODS = [
  { x: -21, z: -4.5 }, { x: -14, z: -4.5 }, { x: -7, z: -4.5 }, { x: 7, z: -4.5 }, { x: 14, z: -4.5 }, { x: 21, z: -4.5 },
  { x: -14, z: 4.5 }, { x: -7, z: 4.5 }, { x: 7, z: 4.5 }, { x: 14, z: 4.5 },
  { x: 28.5, z: 0.5 }, // coin des stagiaires
].map((pod, index) => ({
  ...pod,
  index,
  seats: [
    { id: `p${index}a`, x: pod.x - 0.8, z: pod.z - 1.3, facing: S, w: 1.5, pod: index },
    { id: `p${index}b`, x: pod.x + 0.8, z: pod.z - 1.3, facing: S, w: 1.5, pod: index },
    { id: `p${index}c`, x: pod.x - 0.8, z: pod.z + 1.3, facing: N, w: 1.5, pod: index },
    { id: `p${index}d`, x: pod.x + 0.8, z: pod.z + 1.3, facing: N, w: 1.5, pod: index },
  ],
}));

// Îlots préférés de chaque pôle (le premier porte la pancarte du pôle).
export const INTERN_POD = 10;

export const DEPT_PODS = {
  direction: [0, 7],
  vente: [1, 2, 6],
  sourcing: [3, 8],
  social: [4, 5, 9],
  organisation: [6, 7],
  tech: [9, 8],
  createurs: [5],
};

// Pièce de travail selon le rôle (sinon : îlot du pôle).
const ROLE_ROOMS = {
  director: "director",
  scribe: "meeting",
  librarian: "library",
  webdev: "studio",
  automation: "studio",
  tiktok: "montage",
  talent: "createurs",
  secretary: "reception",
  accountant: "annexe",
  photographer: "photo",
  logistics: "warehouse",
  designer: "marketing",
  growth: "marketing",
  data: "marketing",
  lawyer: "legal",
  admin: "legal",
  hr: "hr",
  happiness: "hr",
};

const ROOM_PREF_BY_DEPT = { tech: "studio", createurs: "createurs", marketing: "marketing" };

export const MEETING_SEATS = [
  { x: -15.2, z: -13, facing: E },
  { x: -13.6, z: -14.45, facing: S }, { x: -12.1, z: -14.45, facing: S }, { x: -10.6, z: -14.45, facing: S }, { x: -9.1, z: -14.45, facing: S },
  { x: -13.6, z: -11.55, facing: N }, { x: -12.1, z: -11.55, facing: N }, { x: -10.6, z: -11.55, facing: N }, { x: -9.1, z: -11.55, facing: N },
  { x: -7.8, z: -13, facing: W },
];

// Places debout autour de la table (fêtes, réunions improvisées).
export const MEETING_STANDING = [];
for (const x of [-15.5, -14.2, -12.8, -11.4, -10, -8.6]) {
  MEETING_STANDING.push({ x, z: -15.6, facing: S, standing: true }, { x, z: -10.4, facing: N, standing: true });
}

export const SPOTS = {
  entrance: { x: 0, z: 15.8, facing: N, standing: true },
  entranceOut: { x: 0, z: 16.6, facing: N, standing: true },
  libraryDrop: { x: 1.3, z: -10.6, facing: N, standing: true },
  directorVisit: { x: -21.5, z: -12.6, facing: N, standing: true },
  pickup: { x: -3.5, z: 12.6, facing: W, standing: true },
  courier: { x: -3.3, z: 14.2, facing: W, standing: true },
  closet: { x: -9.6, z: 15.8, facing: S, standing: true },
  whiteboard: { x: -25.0, z: 14.6, facing: W, standing: true },
  microwave: { x: -23.2, z: 15.75, facing: S, standing: true },
  fridge: { x: -20.9, z: 15.6, facing: S, standing: true },
  vending: { x: -24.6, z: 11.6, facing: W, standing: true },
  copier: { x: 21.8, z: 3.35, facing: S, standing: true },
  coffee: [
    { x: -25.0, z: 15.75, facing: S, standing: true },
    { x: -24.2, z: 15.75, facing: S, standing: true },
    { x: 19.5, z: 5.1, facing: E, standing: true },
    { x: 20.3, z: 4.3, facing: S, standing: true },
  ],
  eat: [
    { x: -22.5, z: 12.2, facing: E }, { x: -20.7, z: 12.2, facing: W }, { x: -21.6, z: 11.3, facing: S }, { x: -21.6, z: 13.1, facing: N },
    { x: -18.7, z: 13.6, facing: E }, { x: -16.9, z: 13.6, facing: W }, { x: -17.8, z: 12.7, facing: S }, { x: -17.8, z: 14.5, facing: N },
  ],
  babyfoot: [{ x: -21.95, z: 4.5, facing: E, standing: true }, { x: -20.05, z: 4.5, facing: W, standing: true }],
  sofa: { x: -21, z: 6.75, facing: N },
  // Salle de repos (chats), salle de sport, RH
  lounge: {
    sofa: [{ x: 34.8, z: -3.85, facing: N }, { x: 35.5, z: -3.85, facing: N }, { x: 36.2, z: -3.85, facing: N }, { x: 38.75, z: -2.0, facing: W }, { x: 38.75, z: -1.0, facing: W }],
    beanbag: [{ x: 32.7, z: -0.6, facing: E }, { x: 32.9, z: 1.5, facing: E }],
    tv: { x: 35.5, z: -5.3, facing: N, standing: true },
    arcade: { x: 33.4, z: -5.7, facing: N, standing: true },
    bowls: { x: 38.0, z: 2.5, facing: S, standing: true },
    table: [{ x: 35.0, z: 0.45, facing: S }, { x: 35.0, z: 2.15, facing: N }],
  },
  gym: {
    treadmill: [{ x: 27.6, z: 15.0, facing: N, standing: true, y: 0.2 }, { x: 29.4, z: 15.0, facing: N, standing: true, y: 0.2 }],
    bag: { x: 32.2, z: 12.0, facing: N, standing: true },
    yoga: [{ x: 31.4, z: 13.6, facing: W, standing: true }, { x: 31.4, z: 14.6, facing: W, standing: true }, { x: 31.4, z: 15.6, facing: W, standing: true }],
    dojo: { x: 28.2, z: 11.8, facing: S, standing: true },
    weights: { x: 26.9, z: 13.6, facing: W, standing: true },
  },
  suggestionBox: { x: 34.1, z: 10.6, facing: N, standing: true },
  hrVisit: { x: 35.0, z: 12.8, facing: S, standing: true },
  eotm: { x: 3.0, z: 6.1, facing: N, standing: true },
};

// Totem « Employé du mois » (tourné vers le sud, place dégagée devant pour la cérémonie).
export const EOTM_TOTEM = { x: 3.0, z: 5.2 };

// Points de rassemblement (exercice incendie) : hall d'entrée puis couloir sud.
export const GATHER = [];
for (const z of [11.2, 12.2, 13.2, 14.2, 15.2]) for (const x of [-1.2, -0.4, 0.4, 1.2]) GATHER.push({ x, z, facing: S, standing: true });
for (let x = -4; x <= 4; x += 0.8) GATHER.push({ x, z: 7.6, facing: S, standing: true });

// Poubelles du plateau (accessoire des blagues).
export const BINS = PODS.map((pod) => ({ x: pod.x + 1.95, z: pod.z + 0.2 }));

const deskOf = (pods) => pods.flatMap((i) => PODS[i].seats);
const REGULAR_PODS = PODS.filter((p) => p.index !== INTERN_POD).map((p) => p.index);

export function assignDesks(agents) {
  const used = new Set();
  const homes = new Map();
  const take = (list) => list.find((d) => !used.has(d.id)) || null;
  for (const agent of agents) {
    if (agent.role === "cleaner") {
      homes.set(agent.id, { ...SPOTS.closet, id: `closet-${agent.id}` });
      continue;
    }
    const room = ROLE_ROOMS[agent.role] || (agent.role === "manager" ? ROOM_PREF_BY_DEPT[agent.dept] : null);
    let seat = room ? take(ROOM_DESKS[room]) : null;
    if (!seat && agent.role === "intern") seat = take(PODS[INTERN_POD].seats);
    if (!seat) seat = take(deskOf(DEPT_PODS[agent.dept] || []));
    if (!seat) seat = take(deskOf(REGULAR_PODS));
    if (!seat) seat = take(PODS[INTERN_POD].seats);
    if (!seat) seat = { id: `stand-${agent.id}`, x: -4 + homes.size * 0.5, z: 7.4, facing: N, standing: true };
    used.add(seat.id);
    homes.set(agent.id, seat);
  }
  return homes;
}

// Centre de l'îlot principal de chaque pôle (pancartes et focus caméra).
export function deptAnchor(dept) {
  const pod = PODS[DEPT_PODS[dept]?.[0]];
  return pod ? { x: pod.x, z: pod.z } : null;
}

export function deskTop(seat) {
  const fx = Math.sin(seat.facing);
  const fz = Math.cos(seat.facing);
  return { x: seat.x + fx * 0.85, z: seat.z + fz * 0.85, fx, fz };
}
