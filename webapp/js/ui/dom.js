// Petits utilitaires d'interface : création d'éléments, toasts, modales, retour haptique.

export const tg = window.Telegram?.WebApp && window.Telegram.WebApp.initData !== undefined ? window.Telegram.WebApp : null;

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "html") el.innerHTML = value;
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

export function haptic(kind = "light") {
  try {
    if (!tg?.HapticFeedback || !tg.isVersionAtLeast?.("6.1")) return;
    if (kind === "success" || kind === "error" || kind === "warning") tg.HapticFeedback.notificationOccurred(kind);
    else tg.HapticFeedback.impactOccurred(kind);
  } catch {
    // retour haptique indisponible
  }
}

export function toast(message, kind = "info", ms = 3200) {
  const root = document.getElementById("toasts");
  const el = h("div", { class: `toast ${kind}` }, message);
  root.append(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add("leave");
    setTimeout(() => el.remove(), 320);
  }, ms);
  if (kind === "error") haptic("error");
}

// Pile de modales (le bouton retour Telegram ferme la plus récente).
const modalStack = [];

export function openModal({ title, body, footer = [], full = false, onClose } = {}) {
  const root = document.getElementById("modal-root");
  const close = () => {
    const idx = modalStack.indexOf(entry);
    if (idx !== -1) modalStack.splice(idx, 1);
    backdrop.remove();
    onClose?.();
    window.dispatchEvent(new Event("qg:overlay"));
  };
  const modal = h(
    "div",
    { class: `modal${full ? " full" : ""}`, role: "dialog", "aria-modal": "true" },
    h("div", { class: "modal-head" }, h("h3", {}, title || ""), h("button", { class: "icon-btn", "aria-label": "Fermer", onClick: close }, "✕")),
    h("div", { class: `modal-body${full ? " frame" : ""}` }, body),
    footer.length ? h("div", { class: "modal-foot" }, footer) : null
  );
  const backdrop = h("div", { class: "modal-backdrop", onClick: (e) => e.target === backdrop && close() }, modal);
  root.append(backdrop);
  const entry = { close };
  modalStack.push(entry);
  window.dispatchEvent(new Event("qg:overlay"));
  return entry;
}

export function closeTopModal() {
  const top = modalStack.at(-1);
  if (top) {
    top.close();
    return true;
  }
  return false;
}

export function hasModal() {
  return modalStack.length > 0;
}

export function confirmDialog(message, { confirmLabel = "Confirmer", danger = true } = {}) {
  if (tg?.initData && tg.showConfirm && tg.isVersionAtLeast?.("6.2")) {
    return new Promise((resolve) => tg.showConfirm(message, (ok) => resolve(!!ok)));
  }
  // Confirmation intégrée à la page (window.confirm est bloqué dans certains cadres).
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      modal.close();
      resolve(value);
    };
    const modal = openModal({
      title: "Confirmation",
      body: h("p", { style: { margin: 0, lineHeight: 1.5 } }, message),
      footer: [
        h("button", { class: "btn ghost", onClick: () => finish(false) }, "Annuler"),
        h("button", { class: `btn ${danger ? "danger" : "primary"} grow`, onClick: () => finish(true) }, confirmLabel),
      ],
      onClose: () => finish(false),
    });
  });
}

// Copie dans le presse-papiers, avec repli sur une zone de texte sélectionnée.
export async function copyText(text, title = "Copier") {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = h("textarea", { class: "textarea", readonly: true, style: { minHeight: "50vh", fontFamily: "ui-monospace, monospace", fontSize: "12px" } });
    area.value = text;
    openModal({ title, body: h("div", {}, h("p", { class: "small muted" }, "Sélectionne le texte puis copie-le."), area) });
    setTimeout(() => area.select(), 60);
    return false;
  }
}

export function promptDialog({ title, label, placeholder = "", submit = "Valider", multiline = true }) {
  return new Promise((resolve) => {
    const input = multiline
      ? h("textarea", { class: "textarea", placeholder, rows: 4 })
      : h("input", { class: "input", placeholder });
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      modal.close();
      resolve(value);
    };
    const modal = openModal({
      title,
      body: h("label", { class: "field" }, h("span", {}, label), input),
      footer: [
        h("button", { class: "btn ghost", onClick: () => finish(null) }, "Annuler"),
        h("button", { class: "btn primary grow", onClick: () => finish(input.value.trim() || null) }, submit),
      ],
      onClose: () => finish(null),
    });
    setTimeout(() => input.focus(), 50);
  });
}

export function openLink(url) {
  if (tg?.initData && tg.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener");
}

// Dans Telegram, les liens externes passent par le navigateur de Telegram ;
// ailleurs, on laisse le lien <a target="_blank"> faire son travail.
export function shouldInterceptLinks() {
  return !!(tg?.initData && tg.openLink);
}

// ---------------------------------------------------------------- formats

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function timeAgo(ms, now = Date.now()) {
  const diff = (ms - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(ms) {
  return new Date(ms).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtSize(chars) {
  if (chars < 1000) return `${chars} car.`;
  return `${(chars / 1000).toFixed(chars < 10000 ? 1 : 0)} k car.`;
}

export function toLocalInput(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}
