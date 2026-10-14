// Plan de l'étage (en mètres). x : ouest → est, z : nord → sud (la caméra regarde vers le nord).
// Orientation d'un personnage : angle y, 0 = regarde vers +z (sud), π = vers le nord.

export const BOUNDS = { minX: -18, maxX: 18, minZ: -13, maxZ: 13 };
export const WALL_H = 2.7;

const S = 0; // regarde vers le sud (+z)
const N = Math.PI; // vers le nord (-z)
const E = Math.PI / 2; // vers l'est (+x)
const W = -Math.PI / 2; // vers l'ouest (-x)
export const FACING = { S, N, E, W };

export const AREAS = {
  director: { rect: [-18, -13, -8, -6], floor: "#6b4e3a", focus: [-13, -9.5], visit: [-11, -7.4], label: [-13, -6.6] },
  meeting: { rect: [-8, -13, 6, -6], floor: "#46546a", focus: [-1, -9.5], visit: [-1, -7.4], label: [-1, -6.6] },
  library: { rect: [6, -13, 18, -6], floor: "#8a5f3c", focus: [12, -9.5], visit: [9.2, -7.4], label: [12, -6.6] },
  reception: { rect: [-18, 6, -9, 13], floor: "#ece3ea", focus: [-13.5, 9.5], visit: [-11.4, 9], label: [-13.5, 6.4] },
  lounge: { rect: [-8.5, 7, -2.5, 13], floor: "#b98b5e", focus: [-5.5, 10], visit: [-5.2, 8.4], label: [-5.5, 7.4] },
  studio: { rect: [7, 6, 18, 13], floor: "#2c3040", focus: [12.5, 9.5], visit: [9, 7.2], label: [12.5, 6.4] },
  openspace: { rect: [-18, -6, 18, 6], floor: "#cfd3db", focus: [0, 0], visit: [0, 3.4], label: [0, 4.4] },
};

// Murs : segments avec ouvertures (portes) exprimées sur l'axe du segment.
export const WALLS = [
  { from: [-18, -13], to: [18, -13], kind: "outer" },
  { from: [-18, -13], to: [-18, 13], kind: "outer" },
  { from: [18, -13], to: [18, 13], kind: "outer" },
  { from: [-18, 13], to: [18, 13], kind: "outer", gaps: [[-2, 2]] },
  { from: [-18, -6], to: [-8, -6], kind: "glass", gaps: [[-11.8, -10.2]] },
  { from: [-8, -13], to: [-8, -6], kind: "glass" },
  { from: [-8, -6], to: [6, -6], kind: "glass", gaps: [[-1.8, -0.2]] },
  { from: [6, -13], to: [6, -6], kind: "glass" },
  { from: [6, -6], to: [18, -6], kind: "glass", gaps: [[8.2, 10.2]] },
  { from: [7, 6], to: [18, 6], kind: "glass", gaps: [[8.2, 9.8]] },
  { from: [7, 6], to: [7, 13], kind: "glass" },
];

// Postes de travail : pièce, position de la chaise et orientation de la personne assise.
export const DESKS = {
  director: [{ id: "dir", x: -13, z: -11.5, facing: S }],
  meeting: [{ id: "scribe", x: 4.4, z: -11.4, facing: N }],
  library: [
    { id: "lib1", x: 10, z: -10.7, facing: S },
    { id: "lib2", x: 14, z: -8.3, facing: S },
  ],
  reception: [
    { id: "rec1", x: -13.7, z: 8.4, facing: E },
    { id: "rec2", x: -13.7, z: 10.2, facing: E },
  ],
  studio: [
    { id: "st1", x: 10.2, z: 9.2, facing: N },
    { id: "st2", x: 14.2, z: 9.2, facing: N },
    { id: "st3", x: 10.2, z: 11.9, facing: N },
    { id: "st4", x: 14.2, z: 11.9, facing: N },
  ],
  managers: [
    { id: "mg1", x: 0, z: -1.3, facing: S },
    { id: "mg2", x: 0, z: 1.3, facing: N },
  ],
  pods: [],
};

export const POD_CENTERS = [-13, -7.6, 7.6, 13];
for (const cx of POD_CENTERS) {
  DESKS.pods.push(
    { id: `p${cx}a`, x: cx - 0.8, z: -1.3, facing: S },
    { id: `p${cx}b`, x: cx + 0.8, z: -1.3, facing: S },
    { id: `p${cx}c`, x: cx - 0.8, z: 1.3, facing: N },
    { id: `p${cx}d`, x: cx + 0.8, z: 1.3, facing: N },
  );
}

export const MEETING_SEATS = [
  { x: -4.4, z: -9.5, facing: E },
  { x: -3, z: -10.9, facing: S },
  { x: -1, z: -10.9, facing: S },
  { x: 1, z: -10.9, facing: S },
  { x: -3, z: -8.1, facing: N },
  { x: -1, z: -8.1, facing: N },
  { x: 1, z: -8.1, facing: N },
  { x: 2.4, z: -9.5, facing: W },
];

export const SPOTS = {
  coffee: [
    { x: -7.2, z: 11.4, facing: S },
    { x: -6, z: 11.4, facing: S },
    { x: -5.75, z: 9.6, facing: E },
    { x: -4.25, z: 9.6, facing: W },
  ],
  libraryDrop: { x: 10, z: -9.1, facing: N },
  directorVisit: { x: -13, z: -9.5, facing: N },
  entrance: { x: 0, z: 11.6, facing: N },
};

// Quel type de poste pour quel rôle (par ordre de préférence).
export const ROLE_DESKS = {
  director: ["director"],
  manager: ["managers", "pods"],
  webdev: ["studio", "pods"],
  librarian: ["library", "pods"],
  secretary: ["reception", "pods"],
  scribe: ["meeting", "pods"],
  writer: ["pods"],
  analyst: ["pods"],
};

export function assignDesks(agents) {
  const used = new Set();
  const homes = new Map();
  for (const agent of agents) {
    const groups = ROLE_DESKS[agent.role] || ["pods"];
    let seat = null;
    for (const group of groups) {
      seat = DESKS[group].find((d) => !used.has(d.id));
      if (seat) break;
    }
    if (!seat) seat = { id: `stand-${agent.id}`, x: -16 + homes.size * 0.9, z: 4.5, facing: N, standing: true };
    used.add(seat.id);
    homes.set(agent.id, seat);
  }
  return homes;
}
