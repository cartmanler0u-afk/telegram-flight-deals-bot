// Outils de base du monde simulé (Bâtiment 0) : hasard déterministe, identifiants, formats.
// Le hasard dépend uniquement de la graine du monde et du numéro de cycle : rejouer un cycle
// après un redémarrage produit exactement le même résultat (pas de double application).

export const HOUR = 3600000;
export const DAY = 24 * HOUR;

export function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    chance: (p) => next() < p,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (list) => (list.length ? list[Math.floor(next() * list.length)] : undefined),
    shuffle: (list) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
      if (total <= 0) return undefined;
      let r = next() * total;
      for (const [value, w] of entries) {
        r -= Math.max(0, w);
        if (r <= 0) return value;
      }
      return entries.at(-1)[0];
    },
  };
  return rng;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round = (v) => Math.round(v);
export const credits = (n) => `${Math.round(n).toLocaleString("fr-FR")} cr`;
export const clampText = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function worldId(world, prefix) {
  world.seq = (world.seq || 0) + 1;
  return `${prefix}${world.cycle.toString(36)}_${world.seq.toString(36)}`;
}

export function localParts(world, ms) {
  const d = new Date(ms + (world.tzOffset || 0) * 60000);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay(), dayKey: d.toISOString().slice(0, 10) };
}

export function fill(text, map) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (map[k] !== undefined ? map[k] : `{${k}}`));
}

// Échappement pour les messages Telegram (parse_mode HTML) et l'affichage web.
export function esc(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Article défini devant un nom de lieu (« le Hall », « l'Étage 13 », « les Dortoirs »…).
const FEMININE = new Set(["Salle", "Banque", "Terrasse", "Rédaction", "Biscuiterie"]);
export function withArticle(name) {
  const n = String(name || "");
  if (/^(Le|La|Les) /.test(n)) return n.charAt(0).toLowerCase() + n.slice(1);
  if (/^L'/.test(n)) return `l'${n.slice(2)}`;
  const first = n.split(/\s/)[0];
  if (/s$/.test(first)) return `les ${n}`;
  if (/^[AEIOUYÉÈÊaeiouyéèê]/.test(n)) return `l'${n}`;
  if (FEMININE.has(first)) return `la ${n}`;
  return `le ${n}`;
}

// « au Hall », « à l'Étage 13 », « aux Dortoirs », « à la Banque du Sous-Sol ».
export function atPlace(name) {
  const a = withArticle(name);
  if (a.startsWith("le ")) return `au ${a.slice(3)}`;
  if (a.startsWith("les ")) return `aux ${a.slice(4)}`;
  return `à ${a}`;
}
