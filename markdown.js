import { escapeHTML } from "./utils.js";

function rawFallback(source) {
  return `<div class="markdown-fallback"><p>Markdown 渲染组件未能加载，以下为文档原文：</p><pre>${escapeHTML(
    source,
  )}</pre></div>`;
}

function headingSlug(text, used) {
  let base = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) base = "section";
  let slug = base;
  let index = 2;
  while (used.has(slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  used.add(slug);
  return slug;
}

/**
 * Render Markdown to sanitized HTML and collect heading metadata for the TOC.
 * If the CDN libraries failed to load, we deliberately fall back to escaped
 * plain text rather than injecting unsanitized HTML.
 */
export function renderMarkdown(source, options = {}) {
  let markdown = String(source || "");
  if (options.stripLeadingH1) {
    markdown = markdown.replace(/^\s*#\s+[^\n]*(?:\n+|$)/, "");
  }

  const marked = window.marked;
  const purify = window.DOMPurify;
  if (!marked || typeof marked.parse !== "function" || !purify) {
    return { html: rawFallback(markdown), headings: [] };
  }

  let rendered;
  try {
    rendered = marked.parse(markdown, {
      gfm: true,
      breaks: false,
    });
  } catch {
    return { html: rawFallback(markdown), headings: [] };
  }

  let sanitized;
  try {
    sanitized = purify.sanitize(rendered, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target", "rel", "loading"],
      FORBID_ATTR: ["style"],
      FORBID_TAGS: ["form", "textarea", "select", "option"],
    });
  } catch {
    return { html: rawFallback(markdown), headings: [] };
  }

  const template = document.createElement("template");
  template.innerHTML = sanitized;

  const usedIds = new Set();
  const headings = [];

  template.content.querySelectorAll("h1, h2, h3, h4").forEach((heading) => {
    const text = heading.textContent.trim();
    if (!text) return;
    const id = headingSlug(text, usedIds);
    heading.id = id;
    if (heading.tagName === "H2" || heading.tagName === "H3") {
      headings.push({
        id,
        text,
        level: Number(heading.tagName.slice(1)),
      });
    }
  });

  template.content.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } else if (/^\s*javascript:/i.test(href)) {
      link.removeAttribute("href");
    }
  });

  template.content.querySelectorAll("img").forEach((image) => {
    image.setAttribute("loading", "lazy");
    const alt = image.getAttribute("alt");
    if (alt === null) image.setAttribute("alt", "");
  });

  return {
    html: template.innerHTML,
    headings,
  };
}
