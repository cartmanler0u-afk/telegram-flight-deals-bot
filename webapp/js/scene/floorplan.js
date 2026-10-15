// Plan d'un étage du Bâtiment 0, calculé à partir de la liste réelle de ses pièces.
// Déterministe et sans three.js (testable sous Node) : un palier à l'ouest (ascenseurs,
// escalier), un couloir central, les pièces de part et d'autre, chacune avec sa porte.

export const CORRIDOR = 3.2;
export const PALIER_W = 7;
export const DOOR_W = 1.7;

const SIZES = { S: [6, 6.5], M: [7.5, 7.5], L: [10, 8.5], XL: [13, 9.5] };
const SIZE_BY_ID = {
  "f0.hall": "XL", "f0.cafeteria": "XL", "f8.salon": "XL", "f6.hemicycle": "XL", "f8.aileA": "XL", "f8.aileB": "XL", "f8.aileC": "XL",
  "fm1.entrepot": "L", "fm1.quai": "L", "f9.audience": "L", "f3.corbeille": "L", "f12.serres": "L", "f1.seminaire": "L",
  "f7.salon": "L", "f5.labo": "L", "f4.redaction": "L", "f4.tv": "M", "f2.reunionA": "M", "ph.bureau": "L", "ph.ecrans": "M",
  "f0.ascenseurs": "S", "f0.affichage": "S", "f0.plaintes": "S", "f0.securite": "S", "f9.scelles": "S", "f5.reserve": "S",
  "f7.cave": "S", "fm2.inconnue": "S", "f10.couloir": "L",
};
const SIZE_BY_KIND = { work: "M", meeting: "M", food: "L", social: "M", rest: "L", transit: "S", special: "S", secret: "S", owner: "M" };
const MIN_LENGTH = 12;

export function roomSize(room) {
  return SIZES[SIZE_BY_ID[room.id] || SIZE_BY_KIND[room.kind] || "M"];
}

// rooms : [{ id, key, kind }] dans l'ordre du Plan. Retourne des rectangles en mètres, centrés.
export function computeFloorPlan(rooms) {
  const palierRoom = rooms.find((r) => r.key === "palier") || null;
  const others = rooms.filter((r) => r !== palierRoom);
  const sides = { north: [], south: [] };
  const used = { north: 0, south: 0 };
  for (const r of others) {
    const [w, d] = roomSize(r);
    const side = used.north <= used.south ? "north" : "south";
    sides[side].push({ room: r, w, d });
    used[side] += w;
  }
  const length = Math.max(MIN_LENGTH, used.north, used.south);
  const depth = {
    north: Math.max(6.5, ...sides.north.map((x) => x.d)),
    south: Math.max(6.5, ...sides.south.map((x) => x.d)),
  };
  const half = CORRIDOR / 2;
  const total = PALIER_W + length;
  const ox = -total / 2; // le plan est centré sur l'origine
  const out = {};
  for (const side of ["north", "south"]) {
    const list = sides[side];
    const sum = list.reduce((s, x) => s + x.w, 0);
    const stretch = list.length ? length / sum : 1; // le côté le plus court s'étire jusqu'au bout du couloir
    let x = ox + PALIER_W;
    for (const item of list) {
      const w = item.w * stretch;
      const [z0, z1] = side === "north" ? [-half - depth.north, -half] : [half, half + depth.south];
      out[item.room.id] = rect(item.room, x, x + w, z0, z1, side);
      x += w;
    }
  }
  const palier = { x0: ox, x1: ox + PALIER_W, z0: -half - depth.north, z1: half + depth.south };
  if (palierRoom) out[palierRoom.id] = { ...rect(palierRoom, palier.x0, palier.x1, palier.z0, palier.z1, "west"), door: null };
  const corridor = { x0: ox + PALIER_W, x1: ox + total, z0: -half, z1: half };
  const bounds = { minX: ox, maxX: ox + total, minZ: palier.z0, maxZ: palier.z1 };
  return { rooms: out, corridor, palier, bounds, walls: buildWalls(out, corridor, palier, bounds, sides), length, total };
}

function rect(room, x0, x1, z0, z1, side) {
  const half = CORRIDOR / 2;
  const cx = (x0 + x1) / 2;
  const door = side === "north" ? { x: cx, z: -half } : side === "south" ? { x: cx, z: half } : null;
  return { id: room.id, kind: room.kind, key: room.key, x0, x1, z0, z1, cx, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, side, door };
}

// Murs : enveloppe extérieure (pleine hauteur, masquée côté caméra) et cloisons basses avec portes.
function buildWalls(rooms, corridor, palier, bounds, sides) {
  const walls = [];
  const { minX, maxX, minZ, maxZ } = bounds;
  walls.push({ x0: minX, z0: minZ, x1: maxX, z1: minZ, outer: true, normal: [0, -1] });
  walls.push({ x0: minX, z0: maxZ, x1: maxX, z1: maxZ, outer: true, normal: [0, 1] });
  walls.push({ x0: minX, z0: minZ, x1: minX, z1: maxZ, outer: true, normal: [-1, 0] });
  walls.push({ x0: maxX, z0: minZ, x1: maxX, z1: maxZ, outer: true, normal: [1, 0] });
  for (const [side, z] of [["north", corridor.z0], ["south", corridor.z1]]) {
    const gaps = sides[side].map((x) => rooms[x.room.id].door).filter(Boolean).map((d) => [d.x - DOOR_W / 2, d.x + DOOR_W / 2]);
    for (const seg of splitWithGaps(corridor.x0, corridor.x1, gaps)) walls.push({ x0: seg[0], z0: z, x1: seg[1], z1: z, outer: false });
    // Cloisons entre pièces voisines, et entre le palier et la première pièce.
    const [zIn, zOut] = side === "north" ? [corridor.z0, minZ] : [corridor.z1, maxZ];
    const xs = new Set([palier.x1]);
    for (const x of sides[side]) xs.add(rooms[x.room.id].x1);
    xs.delete(maxX);
    for (const x of xs) walls.push({ x0: x, z0: Math.min(zIn, zOut), x1: x, z1: Math.max(zIn, zOut), outer: false });
  }
  return walls;
}

function splitWithGaps(a, b, gaps) {
  const segs = [];
  let x = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > x) segs.push([x, Math.min(g0, b)]);
    x = Math.max(x, g1);
  }
  if (x < b) segs.push([x, b]);
  return segs.filter(([p, q]) => q - p > 0.05);
}

// Chemin à pied entre deux points de l'étage : on sort par la porte, on suit le couloir, on entre.
export function walkPath(plan, from, fromRoomId, to, toRoomId) {
  const path = [];
  const exitOf = (roomId) => {
    const r = plan.rooms[roomId];
    if (!r || !r.door) return null;
    const step = r.side === "north" ? -0.9 : 0.9;
    return [[r.door.x, r.door.z + step], [r.door.x, r.door.z - step * 1.2]];
  };
  if (fromRoomId !== toRoomId) {
    const out = exitOf(fromRoomId);
    if (out) path.push(...out);
    const into = exitOf(toRoomId);
    if (into) path.push([into[1][0], into[1][1]], into[0]);
    else if (plan.rooms[toRoomId]) path.push([plan.palier.x1 - 1, 0]);
  }
  path.push([to.x, to.z]);
  return path;
}
