// Petit analyseur de dates en français ("réunion client jeudi 15h30 pendant 1h").
// Sert au mode démo et de filet de sécurité quand l'IA n'est pas disponible.
// Les heures sont exprimées dans le fuseau de l'utilisateur (tzOffset = minutes à l'est d'UTC).

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const MEETING_RE = /\b(r[ée]union|meeting|point|call|visio|comit[ée]|brainstorm|s[ée]minaire|atelier)\b/i;

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Composantes "heure murale" de l'utilisateur pour un instant UTC donné.
export function localParts(ms, tzOffset = 0) {
  const d = new Date(ms + tzOffset * 60000);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes(),
    wd: d.getUTCDay(),
  };
}

export function fromLocal(y, m, d, h, min, tzOffset = 0) {
  return Date.UTC(y, m, d, h, min) - tzOffset * 60000;
}

const pad = (n) => String(n).padStart(2, "0");

export function formatLocal(ms, tzOffset = 0, { withDay = true } = {}) {
  const p = localParts(ms, tzOffset);
  const time = `${pad(p.h)}:${pad(p.min)}`;
  if (!withDay) return time;
  return `${DAYS_SHORT[p.wd]} ${p.d} ${MONTHS_SHORT[p.m]} ${time}`;
}

export function localIso(ms, tzOffset = 0) {
  const p = localParts(ms, tzOffset);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

// "2026-10-15T14:30" (heure locale de l'utilisateur) -> timestamp UTC
export function parseLocalIso(str, tzOffset = 0) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(str || ""));
  if (!m) return null;
  return fromLocal(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], tzOffset);
}

export function parseFrenchEvent(input, { now = Date.now(), tzOffset = 0 } = {}) {
  const original = String(input || "").normalize("NFC").trim();
  let text = ` ${original} `;
  const plain = () => stripAccents(text.toLowerCase());
  const today = localParts(now, tzOffset);
  let day = null; // { y, m, d }
  let hour = null;
  let minute = 0;
  let durationMin = null;
  let relativeMs = null;
  let found = false;

  const remove = (re) => {
    const flat = plain();
    const match = re.exec(flat);
    if (!match) return null;
    text = text.slice(0, match.index) + " " + text.slice(match.index + match[0].length);
    return match;
  };

  const addDays = (n) => {
    const t = new Date(Date.UTC(today.y, today.m, today.d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
  };

  // Durée : "pendant 1h30", "durée 45 min", "(2h)"
  let m = remove(/\b(?:pendant|duree(?: de)?|sur)\s+(\d{1,2})\s*h\s*(\d{2})?\b/);
  if (m) durationMin = +m[1] * 60 + (m[2] ? +m[2] : 0);
  m = remove(/\b(?:pendant|duree(?: de)?|sur)\s+(\d{1,3})\s*(?:min|minutes?)\b/);
  if (m) durationMin = +m[1];

  // Relatif : "dans 2 heures", "dans 30 min", "dans 3 jours"
  m = remove(/\bdans\s+(\d{1,3})\s*(min|minutes?|h|heures?|jours?|semaines?)\b/);
  if (m) {
    const n = +m[1];
    const unit = m[2];
    if (unit.startsWith("min")) relativeMs = n * 60000;
    else if (unit.startsWith("h")) relativeMs = n * 3600000;
    else if (unit.startsWith("sem")) day = addDays(7 * n);
    else day = addDays(n);
    found = true;
  }

  // Jour
  if (!day) {
    if ((m = remove(/\bapres[- ]demain\b/))) day = addDays(2);
    else if ((m = remove(/\bdemain\b/))) day = addDays(1);
    else if ((m = remove(/\baujourd'?hui\b|\bce (?:matin|midi|soir|aprem|apres-midi)\b/))) {
      day = addDays(0);
      if (/soir/.test(m[0]) && hour === null) hour = 19;
      if (/matin/.test(m[0]) && hour === null) hour = 9;
      if (/apre/.test(m[0]) && hour === null) hour = 14;
    }
  }
  if (!day) {
    m = remove(/\b(?:le\s+)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
    if (m) {
      let y = m[3] ? +m[3] : today.y;
      if (y < 100) y += 2000;
      day = { y, m: +m[2] - 1, d: +m[1] };
      if (!m[3] && fromLocal(y, day.m, day.d, 23, 59, tzOffset) < now) day.y += 1;
    }
  }
  if (!day) {
    const monthsRe = MONTHS.map(stripAccents).join("|");
    m = remove(new RegExp(`\\b(?:le\\s+)?(\\d{1,2})(?:er)?\\s+(${monthsRe})(?:\\s+(\\d{4}))?\\b`));
    if (m) {
      const month = MONTHS.map(stripAccents).indexOf(m[2]);
      let y = m[3] ? +m[3] : today.y;
      if (!m[3] && fromLocal(y, month, +m[1], 23, 59, tzOffset) < now) y += 1;
      day = { y, m: month, d: +m[1] };
    }
  }
  if (!day) {
    m = remove(new RegExp(`\\b(${WEEKDAYS.join("|")})(\\s+prochain)?\\b`));
    if (m) {
      const target = WEEKDAYS.indexOf(m[1]);
      let delta = (target - today.wd + 7) % 7;
      if (delta === 0 || m[2]) delta = delta === 0 ? 7 : delta;
      day = addDays(delta);
    }
  }

  // Heure : "14h", "14h30", "14:30", "à 9 h", "midi"
  m = remove(/\b(?:a|vers|des)?\s*(\d{1,2})\s*(?:h(?:eures?)?|:)\s*(\d{2})?\b/);
  if (m && +m[1] < 24) {
    hour = +m[1];
    minute = m[2] ? +m[2] : 0;
  } else if ((m = remove(/\b(?:a\s+)?midi\b/))) {
    hour = 12;
  }

  if (day || hour !== null) found = true;

  let start;
  if (relativeMs !== null) {
    start = now + relativeMs;
  } else {
    const h = hour ?? 10;
    if (!day) {
      day = addDays(0);
      if (fromLocal(day.y, day.m, day.d, h, minute, tzOffset) <= now) day = addDays(1);
    }
    start = fromLocal(day.y, day.m, day.d, h, minute, tzOffset);
  }

  // Titre : ce qui reste, sans les verbes d'amorce
  let title = text
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:ajoute|planifie|programme|cale|note|mets|organise|prevois|prévois)\s+(?:moi\s+)?(?:un|une|le|la)?\s*/i, "")
    .replace(/\s+(?:a|à|le|pour|de|du|avec)\s*$/i, "")
    .replace(/\s+[,.;:-]+\s*/g, " ")
    .trim();
  if (!title) title = original || "Rendez-vous";
  title = title.charAt(0).toUpperCase() + title.slice(1);

  const isMeeting = MEETING_RE.test(original);
  return {
    found,
    title: title.slice(0, 120),
    start,
    durationMin: durationMin || (isMeeting ? 45 : 60),
    isMeeting,
  };
}

export function dayKey(ms, tzOffset = 0) {
  const p = localParts(ms, tzOffset);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}

export function dayLabel(ms, now, tzOffset = 0) {
  const a = localParts(ms, tzOffset);
  const keyA = dayKey(ms, tzOffset);
  if (keyA === dayKey(now, tzOffset)) return "Aujourd'hui";
  if (keyA === dayKey(now + 86400000, tzOffset)) return "Demain";
  return `${WEEKDAYS[a.wd].charAt(0).toUpperCase()}${WEEKDAYS[a.wd].slice(1)} ${a.d} ${MONTHS[a.m]}`;
}
