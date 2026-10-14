// Navigation des personnages : grille d'occupation + A* + lissage par ligne de vue.

import { BOUNDS } from "./layout.js";

const CELL = 0.3;
const COLS = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / CELL);
const ROWS = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / CELL);
const SQRT2 = Math.SQRT2;

export class NavGrid {
  constructor() {
    this.blocked = new Uint8Array(COLS * ROWS);
    // Bords de l'étage
    for (let c = 0; c < COLS; c++) {
      this.blocked[c] = 1;
      this.blocked[(ROWS - 1) * COLS + c] = 1;
    }
    for (let r = 0; r < ROWS; r++) {
      this.blocked[r * COLS] = 1;
      this.blocked[r * COLS + COLS - 1] = 1;
    }
  }

  toCell(x, z) {
    return [
      Math.max(0, Math.min(COLS - 1, Math.floor((x - BOUNDS.minX) / CELL))),
      Math.max(0, Math.min(ROWS - 1, Math.floor((z - BOUNDS.minZ) / CELL))),
    ];
  }

  toWorld(c, r) {
    return [BOUNDS.minX + (c + 0.5) * CELL, BOUNDS.minZ + (r + 0.5) * CELL];
  }

  // Bloque un rectangle (coordonnées monde), élargi d'une marge pour que les personnages ne frôlent pas.
  blockRect(x0, z0, x1, z1, margin = 0.22) {
    const [c0, r0] = this.toCell(Math.min(x0, x1) - margin, Math.min(z0, z1) - margin);
    const [c1, r1] = this.toCell(Math.max(x0, x1) + margin, Math.max(z0, z1) + margin);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.blocked[r * COLS + c] = 1;
  }

  // Rectangle centré, éventuellement tourné de 90°.
  blockBox(cx, cz, w, d, rotated = false, margin) {
    const hw = (rotated ? d : w) / 2;
    const hd = (rotated ? w : d) / 2;
    this.blockRect(cx - hw, cz - hd, cx + hw, cz + hd, margin);
  }

  isFree(c, r) {
    return c >= 0 && r >= 0 && c < COLS && r < ROWS && !this.blocked[r * COLS + c];
  }

  nearestFree(c, r) {
    if (this.isFree(c, r)) return [c, r];
    for (let radius = 1; radius < 12; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          if (this.isFree(c + dc, r + dr)) return [c + dc, r + dr];
        }
      }
    }
    return [c, r];
  }

  lineOfSight(a, b) {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const steps = Math.ceil(Math.hypot(dx, dz) / (CELL * 0.5));
    for (let i = 1; i < steps; i++) {
      const [c, r] = this.toCell(a[0] + (dx * i) / steps, a[1] + (dz * i) / steps);
      if (!this.isFree(c, r)) return false;
    }
    return true;
  }

  findPath(from, to) {
    const [sc, sr] = this.nearestFree(...this.toCell(from[0], from[1]));
    const [gc, gr] = this.nearestFree(...this.toCell(to[0], to[1]));
    const start = sr * COLS + sc;
    const goal = gr * COLS + gc;

    const g = new Float32Array(COLS * ROWS).fill(Infinity);
    const parent = new Int32Array(COLS * ROWS).fill(-1);
    const closed = new Uint8Array(COLS * ROWS);
    const heap = new MinHeap();
    const h = (i) => {
      const dc = Math.abs((i % COLS) - gc);
      const dr = Math.abs(Math.floor(i / COLS) - gr);
      return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr);
    };
    g[start] = 0;
    heap.push(start, h(start));

    let found = false;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const c = cur % COLS;
      const r = Math.floor(cur / COLS);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (!this.isFree(nc, nr)) continue;
          // Pas de coupe en diagonale à travers un coin de mur.
          if (dc && dr && (!this.isFree(c + dc, r) || !this.isFree(c, r + dr))) continue;
          const ni = nr * COLS + nc;
          if (closed[ni]) continue;
          const cost = g[cur] + (dc && dr ? SQRT2 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            parent[ni] = cur;
            heap.push(ni, cost + h(ni));
          }
        }
      }
    }

    if (!found) return [to];

    const cells = [];
    for (let i = goal; i !== -1; i = parent[i]) cells.push(this.toWorld(i % COLS, Math.floor(i / COLS)));
    cells.reverse();

    // Lissage : on saute les points intermédiaires visibles en ligne droite.
    const smooth = [];
    let anchor = [from[0], from[1]];
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.lineOfSight(anchor, cells[j])) j--;
      smooth.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    smooth.push([to[0], to[1]]);
    return smooth;
  }
}

class MinHeap {
  constructor() {
    this.items = [];
    this.prio = [];
  }

  get size() {
    return this.items.length;
  }

  push(item, priority) {
    const items = this.items;
    const prio = this.prio;
    let i = items.length;
    items.push(item);
    prio.push(priority);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (prio[p] <= prio[i]) break;
      [items[p], items[i]] = [items[i], items[p]];
      [prio[p], prio[i]] = [prio[i], prio[p]];
      i = p;
    }
  }

  pop() {
    const items = this.items;
    const prio = this.prio;
    const top = items[0];
    const lastItem = items.pop();
    const lastPrio = prio.pop();
    if (items.length) {
      items[0] = lastItem;
      prio[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && prio[l] < prio[m]) m = l;
        if (r < items.length && prio[r] < prio[m]) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        [prio[m], prio[i]] = [prio[i], prio[m]];
        i = m;
      }
    }
    return top;
  }
}
