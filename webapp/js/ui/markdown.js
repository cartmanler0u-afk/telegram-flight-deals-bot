// Rendu Markdown minimal et sûr (tout est échappé avant mise en forme).

const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function inline(text) {
  const codes = [];
  let out = escape(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\s][^_]*)_/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

export function markdown(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let list = null; // "ul" | "ol"
  let para = [];
  let quote = [];

  const flushPara = () => {
    if (para.length) html.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) html.push(`<blockquote>${quote.map(inline).join("<br>")}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushAll();
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      html.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
      continue;
    }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flushAll();
      const level = Math.min(3, m[1].length);
      html.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushAll();
      html.push("<hr>");
    } else if ((m = /^\s*[-*+]\s+(\[( |x|X)\]\s+)?(.*)$/.exec(line))) {
      flushPara();
      flushQuote();
      if (list !== "ul") {
        flushList();
        html.push("<ul>");
        list = "ul";
      }
      const box = m[1] ? (m[2].trim() ? "☑️ " : "⬜ ") : "";
      html.push(`<li>${box}${inline(m[3])}</li>`);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      flushQuote();
      if (list !== "ol") {
        flushList();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flushPara();
      flushList();
      quote.push(m[1]);
    } else if (/^\|.*\|\s*$/.test(line)) {
      flushAll();
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (row) => row.trim().slice(1, -1).split("|").map((c) => c.trim());
      const body = rows.filter((r) => !/^\|\s*:?-{2,}/.test(r));
      html.push(
        `<table>${body
          .map((r, idx) => `<tr>${cells(r).map((c) => (idx === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`)
          .join("")}</table>`
      );
    } else if (!line.trim()) {
      flushAll();
    } else {
      flushList();
      flushQuote();
      para.push(line);
    }
  }
  flushAll();
  return html.join("\n");
}
