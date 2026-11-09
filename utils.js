export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

export function debounce(fn, delay = 180) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function parseDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = parseDate(value);
  if (!date) return String(value || "");
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function formatDateLong(value) {
  const date = parseDate(value);
  if (!date) return String(value || "");
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function parseTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }
  return [
    ...new Set(
      String(value || "")
        .split(/[,，、]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function readingMinutes(markdown = "") {
  const cjkCount = (String(markdown).match(/[\u3400-\u9fff]/g) || []).length;
  const latinWords = (
    String(markdown)
      .replace(/[\u3400-\u9fff]/g, " ")
      .match(/[A-Za-z0-9]+/g) || []
  ).length;
  return Math.max(1, Math.ceil(cjkCount / 400 + latinWords / 220));
}

export function characterCount(value = "") {
  return String(value).replace(/\s/g, "").length;
}

export function deriveSummary(markdown = "", limit = 96) {
  const text = String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function isValidSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));
}

export function slugifyTitle(title, date = todayISO()) {
  const base = String(title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  if (base.length >= 2) return base;
  return `note-${String(date || todayISO()).replace(/-/g, "")}`;
}

export function uniqueSlug(base, docs = [], currentSlug = null) {
  const safeBase = base || `note-${todayISO().replace(/-/g, "")}`;
  const taken = new Set(
    docs.map((doc) => doc.slug).filter((slug) => slug && slug !== currentSlug),
  );
  if (!taken.has(safeBase)) return safeBase;
  let index = 2;
  while (taken.has(`${safeBase}-${index}`)) index += 1;
  return `${safeBase}-${index}`;
}

export function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function githubHandle(value) {
  if (!value) return "GitHub";
  try {
    const url = new URL(String(value));
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] ? `@${parts[0]}` : "GitHub";
  } catch {
    return "GitHub";
  }
}

export function initials(name = "") {
  const clean = String(name).trim();
  return clean ? [...clean][0] : "知";
}

export function safeJSONParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
