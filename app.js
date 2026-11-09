import {
  $,
  $$,
  debounce,
  escapeHTML,
  formatDate,
  formatDateLong,
  githubHandle,
  initials,
  isHttpUrl,
  parseTags,
  readingMinutes,
} from "./utils.js";
import { seedManifest, seedProfile, getSeedDoc } from "./seed.js";
import { loadDocDrafts, loadProfileDraft, loadSettings } from "./store.js";
import { renderMarkdown } from "./markdown.js";
import { copyText, showToast } from "./ui.js";
import { initStudio } from "./studio.js";

const state = {
  publishedProfile: null,
  profile: null,
  profileIsDraft: false,
  publishedManifest: { docs: [] },
  manifest: { docs: [] },
  docDrafts: {},
  settings: loadSettings(),
  query: "",
  activeTag: "all",
  contentCache: new Map(),
  currentSlug: null,
  currentDoc: null,
  siteScrollY: 0,
  readerToken: 0,
  studio: null,
};

let tocFrame = 0;

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

async function fetchJSON(path) {
  const response = await fetch(path, {
    cache: "no-cache",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function normalizeProfile(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    name: String(source.name || seedProfile.name).trim() || seedProfile.name,
    latin: String(source.latin ?? seedProfile.latin).trim(),
    role: String(source.role ?? seedProfile.role).trim(),
    status: String(source.status ?? seedProfile.status).trim(),
    headline: String(source.headline ?? seedProfile.headline).trim(),
    location: String(source.location ?? seedProfile.location).trim(),
    email: String(source.email ?? seedProfile.email).trim(),
    github: String(source.github ?? seedProfile.github).trim(),
    avatar: String(source.avatar ?? "").trim(),
    focus: parseTags(source.focus ?? seedProfile.focus),
    now: String(source.now ?? seedProfile.now).trim(),
    intro: String(source.intro ?? seedProfile.intro),
  };
}

function normalizeDoc(raw) {
  if (!raw || typeof raw !== "object" || !raw.slug || !raw.title) return null;
  return {
    slug: String(raw.slug).trim(),
    title: String(raw.title).trim(),
    summary: String(raw.summary || "").trim(),
    date: String(raw.date || "").trim(),
    tags: parseTags(raw.tags),
    ...(Number.isFinite(raw.minutes) ? { minutes: raw.minutes } : {}),
  };
}

function normalizeManifest(raw) {
  if (!raw || !Array.isArray(raw.docs)) return { ...seedManifest, docs: [...seedManifest.docs] };
  const seen = new Set();
  const docs = [];
  raw.docs.forEach((item) => {
    const doc = normalizeDoc(item);
    if (!doc || seen.has(doc.slug)) return;
    seen.add(doc.slug);
    docs.push(doc);
  });
  return {
    updatedAt: raw.updatedAt || new Date().toISOString(),
    docs,
  };
}

function getMergedDocs() {
  const map = new Map();

  for (const raw of state.publishedManifest.docs || []) {
    const doc = normalizeDoc(raw);
    if (!doc) continue;
    map.set(doc.slug, { ...doc, isDraft: false, isPublished: true });
  }

  for (const draft of Object.values(state.docDrafts)) {
    const meta = normalizeDoc(draft?.meta);
    if (!meta || typeof draft.content !== "string") continue;
    const existing = map.get(meta.slug);
    map.set(meta.slug, {
      ...(existing || {}),
      ...meta,
      isDraft: true,
      isPublished: Boolean(existing),
    });
  }

  return [...map.values()].sort((a, b) => {
    const byDate = String(b.date || "").localeCompare(String(a.date || ""));
    if (byDate !== 0) return byDate;
    return String(a.title).localeCompare(String(b.title), "zh-CN");
  });
}

async function loadDocContent(metaOrSlug) {
  const slug = typeof metaOrSlug === "string" ? metaOrSlug : metaOrSlug?.slug;
  if (!slug) throw new Error("缺少文档标识。");

  const draft = state.docDrafts[slug];
  if (draft && typeof draft.content === "string") return draft.content;

  if (state.contentCache.has(slug)) return state.contentCache.get(slug);

  try {
    const response = await fetch(`./docs/${encodeURIComponent(slug)}.md`, {
      cache: "no-cache",
      headers: { Accept: "text/markdown, text/plain;q=0.9, */*;q=0.8" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    state.contentCache.set(slug, text);
    return text;
  } catch {
    const seeded = getSeedDoc(slug);
    if (seeded) {
      state.contentCache.set(slug, seeded);
      return seeded;
    }
    throw new Error(
      "文档内容加载失败。如果你是在本地直接打开 index.html，请改用本地服务器预览（例如 python -m http.server）。",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Public rendering                                                    */
/* ------------------------------------------------------------------ */

function applyMetaDescription(text) {
  const meta = document.querySelector('meta[name="description"]');
  if (meta && text) meta.setAttribute("content", text);
}

function renderProfile() {
  const profile = state.profile;
  if (!profile) return;

  $$("[data-profile]").forEach((node) => {
    const key = node.dataset.profile;
    const value = profile[key];
    if (value !== undefined && value !== null) node.textContent = value;
  });

  const focusText = profile.focus.slice(0, 2).join(" / ") || "持续学习与记录";
  $("#hero-focus-text").textContent = focusText;
  $("#hero-now").textContent = profile.now || "正在整理下一个想法。";
  $("#about-now").textContent = profile.now || "正在整理下一个想法。";

  const mailto = profile.email ? `mailto:${profile.email}` : "#";
  for (const id of ["#hero-email", "#about-email"]) {
    const link = $(id);
    if (!link) continue;
    link.textContent = profile.email || "写信给我";
    link.href = mailto;
  }
  const contactLink = $("#contact-email-link");
  if (contactLink) contactLink.href = mailto;
  $("#contact-email").textContent = profile.email || "写信给我";

  const githubLink = $("#about-github");
  if (githubLink) {
    const valid = isHttpUrl(profile.github);
    githubLink.href = valid ? profile.github : "#";
    githubLink.textContent = valid ? githubHandle(profile.github) : "GitHub";
    githubLink.hidden = !valid;
    githubLink.target = "_blank";
    githubLink.rel = "noopener noreferrer";
  }

  const avatar = $("#avatar-img");
  const monogram = $("#avatar-monogram");
  if (avatar && monogram) {
    if (isHttpUrl(profile.avatar)) {
      avatar.src = profile.avatar;
      avatar.alt = `${profile.name}的头像`;
      avatar.hidden = false;
      monogram.hidden = true;
      avatar.onerror = () => {
        avatar.hidden = true;
        monogram.hidden = false;
      };
    } else {
      avatar.hidden = true;
      avatar.removeAttribute("src");
      monogram.hidden = false;
      monogram.textContent = initials(profile.name);
    }
  }

  const focusHTML = profile.focus
    .slice(0, 4)
    .map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`)
    .join("");
  if ($("#hero-focus")) $("#hero-focus").innerHTML = focusHTML;
  if ($("#about-focus")) $("#about-focus").innerHTML = focusHTML;

  const intro = renderMarkdown(profile.intro || "").html;
  if ($("#profile-intro")) $("#profile-intro").innerHTML = intro;

  const docCount = state.manifest.docs.length;
  $("#stat-docs").textContent = String(docCount).padStart(2, "0");
  $("#stat-focus").textContent = String(profile.focus.length).padStart(2, "0");
  $("#nav-doc-count").textContent = String(docCount).padStart(2, "0");
  $("#portrait-year").textContent = String(new Date().getFullYear());

  const draftBadge = $("#profile-draft-badge");
  if (draftBadge) {
    draftBadge.hidden = !state.profileIsDraft;
    draftBadge.textContent = "本地草稿";
  }

  document.title = `${profile.name} · 个人主页`;
  applyMetaDescription(profile.headline || seedProfile.headline);
  document
    .querySelector('meta[property="og:title"]')
    ?.setAttribute("content", `${profile.name} · 个人主页`);
  document
    .querySelector('meta[property="og:description"]')
    ?.setAttribute("content", profile.headline || seedProfile.headline);
  document.querySelector('meta[name="author"]')?.setAttribute("content", profile.name);
}

function renderTagFilters(docs) {
  const counts = new Map();
  docs.forEach((doc) => {
    doc.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });

  if (state.activeTag !== "all" && !counts.has(state.activeTag)) {
    state.activeTag = "all";
  }

  const tags = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "zh-CN");
  });

  const filter = $("#tag-filter");
  if (!filter) return;
  filter.innerHTML = [
    `<button class="filter-pill ${
      state.activeTag === "all" ? "is-active" : ""
    }" type="button" data-tag="all">全部 ${docs.length}</button>`,
    ...tags.map(
      ([tag, count]) =>
        `<button class="filter-pill ${
          state.activeTag === tag ? "is-active" : ""
        }" type="button" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)} ${count}</button>`,
    ),
  ].join("");
}

function docCardHTML(doc, index, featured) {
  const tags = doc.tags
    .slice(0, 4)
    .map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`)
    .join("");
  const summary = doc.summary || "一篇尚未写下摘要的文档，点击阅读全文。";
  return `
    <a class="doc-card${featured ? " doc-card--featured" : ""}" href="#/doc/${encodeURIComponent(
      doc.slug,
    )}">
      ${doc.isDraft ? '<span class="doc-card__draft">LOCAL DRAFT</span>' : ""}
      <div class="doc-card__top">
        <span class="doc-card__index">NO. ${String(index + 1).padStart(2, "0")}</span>
        <span class="doc-card__date">${escapeHTML(formatDate(doc.date) || "未标日期")}</span>
      </div>
      <div class="doc-card__body">
        <h3 class="doc-card__title">${escapeHTML(doc.title)}</h3>
        <p class="doc-card__summary">${escapeHTML(summary)}</p>
      </div>
      <div class="doc-card__foot">
        <div class="doc-card__tags">${tags}</div>
        <span class="doc-card__arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 19 19 5M9 5h10v10"/></svg>
        </span>
      </div>
    </a>`;
}

function renderDocs() {
  const docs = state.manifest.docs;
  renderTagFilters(docs);

  const query = state.query.trim().toLowerCase();
  const visible = docs.filter((doc) => {
    const matchesTag = state.activeTag === "all" || doc.tags.includes(state.activeTag);
    if (!matchesTag) return false;
    if (!query) return true;
    const haystack = [doc.title, doc.summary, ...doc.tags].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  const grid = $("#docs-grid");
  grid.innerHTML = visible
    .map((doc, index) => docCardHTML(doc, index, index === 0))
    .join("");

  $("#docs-empty").hidden = visible.length > 0;
  const count = String(docs.length).padStart(2, "0");
  $("#stat-docs").textContent = count;
  $("#nav-doc-count").textContent = count;
}

function refreshSite() {
  state.manifest = { docs: getMergedDocs() };
  renderProfile();
  renderDocs();
}

/* ------------------------------------------------------------------ */
/* Reader                                                              */
/* ------------------------------------------------------------------ */

function getDocSlugFromHash() {
  const hash = window.location.hash || "";
  if (!hash.startsWith("#/doc/")) return null;
  try {
    return decodeURIComponent(hash.slice("#/doc/".length));
  } catch {
    return null;
  }
}

function setReaderContent(html) {
  const content = $("#reader-content");
  if (content) content.innerHTML = html;
}

function renderReaderError(message) {
  setReaderContent(`
    <div class="reader-error">
      <p class="micro-label">READING INTERRUPTED</p>
      <h2>这篇文档暂时打不开</h2>
      <p>${escapeHTML(message)}</p>
      <button class="btn btn--ghost btn--small" type="button" id="reader-retry">重新加载</button>
    </div>
  `);
  const retry = $("#reader-retry");
  if (retry) {
    retry.addEventListener("click", () => {
      if (state.currentSlug) openReader(state.currentSlug);
    });
  }
  buildToc([]);
}

function buildToc(headings) {
  const toc = $("#reader-toc");
  if (!toc) return;
  if (!headings.length) {
    toc.innerHTML = '<span class="toc-empty">这篇文章没有小标题</span>';
    return;
  }
  toc.innerHTML = headings
    .map(
      (heading) =>
        `<a href="#${escapeHTML(heading.id)}" class="${
          heading.level === 3 ? "toc-h3" : ""
        }" data-toc-id="${escapeHTML(heading.id)}">${escapeHTML(heading.text)}</a>`,
    )
    .join("");
}

async function openReader(slug) {
  const doc = state.manifest.docs.find((item) => item.slug === slug);
  if (!doc) {
    showToast("没有找到这篇文档，可能已经被移动或删除。", "error");
    if (window.location.hash.startsWith("#/doc/")) {
      window.history.replaceState(null, "", "#/");
    }
    if (!$("#reader").hidden) closeReader(false);
    return;
  }

  if ($("#reader").hidden) state.siteScrollY = window.scrollY;
  state.currentSlug = slug;
  state.currentDoc = doc;
  const token = ++state.readerToken;

  $("#site").hidden = true;
  $("#reader").hidden = false;
  document.body.classList.add("reader-open");
  window.scrollTo(0, 0);
  $("#reader-title").focus({ preventScroll: true });

  document.title = `${doc.title} · ${state.profile.name}`;
  applyMetaDescription(doc.summary || doc.title);

  $("#reader-title").textContent = doc.title;
  $("#reader-summary").textContent = doc.summary || "";
  $("#reader-date").textContent = formatDate(doc.date) || "未标日期";
  $("#reader-date-foot").textContent = formatDateLong(doc.date) || "某个时刻";
  $("#reader-time").textContent = doc.minutes ? `约 ${doc.minutes} 分钟` : "正在读取";
  $("#reader-draft-badge").hidden = !doc.isDraft;
  $("#reader-tags").innerHTML = doc.tags
    .map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`)
    .join("");

  setReaderContent('<p class="reader-loading">正在展开文档…</p>');
  buildToc([]);
  updateReadingProgress();

  try {
    const markdown = await loadDocContent(doc);
    if (token !== state.readerToken) return;
    const rendered = renderMarkdown(markdown, { stripLeadingH1: true });
    setReaderContent(rendered.html);
    buildToc(rendered.headings);
    $("#reader-time").textContent = `约 ${readingMinutes(markdown)} 分钟`;
    updateReadingProgress();
  } catch (error) {
    if (token !== state.readerToken) return;
    renderReaderError(error.message);
  }
}

function closeReader(updateHash = true) {
  const reader = $("#reader");
  if (!reader || reader.hidden) return;
  reader.hidden = true;
  $("#site").hidden = false;
  document.body.classList.remove("reader-open");
  state.currentSlug = null;
  state.currentDoc = null;
  state.readerToken += 1;
  document.title = `${state.profile.name} · 个人主页`;
  applyMetaDescription(state.profile.headline);
  updateReadingProgress();

  if (updateHash && window.location.hash.startsWith("#/doc/")) {
    window.history.replaceState(null, "", "#/");
  }

  requestAnimationFrame(() => {
    window.scrollTo(0, state.siteScrollY);
  });
}

function updateReadingProgress() {
  const bar = $("#reading-bar");
  if (!bar) return;
  const readerVisible = !$("#reader").hidden;
  if (!readerVisible) {
    bar.style.width = "0%";
    return;
  }
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0;
  bar.style.width = `${progress}%`;
}

function updateTocActive() {
  if ($("#reader").hidden) return;
  const links = $$("#reader-toc a");
  if (!links.length) return;
  const headings = $$("#reader-content h2, #reader-content h3");
  let current = headings[0]?.id || null;
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= 140) current = heading.id;
    else break;
  }
  links.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.tocId === current);
  });
}

function onReaderScroll() {
  updateReadingProgress();
  if (tocFrame) return;
  tocFrame = requestAnimationFrame(() => {
    tocFrame = 0;
    updateTocActive();
  });
}

/* ------------------------------------------------------------------ */
/* Site interactions                                                   */
/* ------------------------------------------------------------------ */

function closeMobileNav() {
  const nav = $("#site-nav");
  const toggle = $("#nav-toggle");
  nav?.classList.remove("is-open");
  toggle?.setAttribute("aria-expanded", "false");
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

  if (!$("#reader").hidden) {
    closeReader(false);
    window.setTimeout(() => target.scrollIntoView({ behavior, block: "start" }), 30);
  } else {
    target.scrollIntoView({ behavior, block: "start" });
  }
}

function handleInPageLink(event) {
  const link = event.target.closest("[data-scroll]");
  if (!link) return;
  event.preventDefault();
  closeMobileNav();
  scrollToSection(link.dataset.scroll);
}

function handleContentLink(event) {
  const link = event.target.closest("a");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (!href.startsWith("#") || href.startsWith("#/doc/") || href === "#") return;

  event.preventDefault();
  let id = href.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    return;
  }

  const reader = $("#reader");
  const target = document.getElementById(id);
  if (target && reader.contains(target)) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  closeReader();
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

async function copyPageLink() {
  const ok = await copyText(window.location.href);
  showToast(ok ? "链接已复制到剪贴板。" : "复制失败，请手动复制地址栏链接。", ok ? "info" : "error");
}

async function shareCurrentDoc() {
  const doc = state.currentDoc;
  if (!doc) return;
  if (navigator.share) {
    try {
      await navigator.share({
        title: doc.title,
        text: doc.summary || `${state.profile.name}的文档`,
        url: window.location.href,
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyPageLink();
}

function bindEvents() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  window.addEventListener(
    "scroll",
    () => {
      $("#site-header")?.classList.toggle("is-scrolled", window.scrollY > 16);
      if (!$("#reader").hidden) onReaderScroll();
    },
    { passive: true },
  );

  $("#nav-toggle")?.addEventListener("click", () => {
    const nav = $("#site-nav");
    const toggle = $("#nav-toggle");
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#site-header")) closeMobileNav();
    handleInPageLink(event);

    if (event.target.closest("[data-open-studio]")) {
      event.preventDefault();
      state.studio?.open("profile");
    }
  });

  $("#studio-open")?.addEventListener("click", () => state.studio?.open("profile"));
  $("#profile-draft-badge")?.addEventListener("click", () => state.studio?.open("profile"));

  const search = $("#doc-search");
  const clearSearch = $("#search-clear");
  search?.addEventListener(
    "input",
    debounce(() => {
      state.query = search.value;
      if (clearSearch) clearSearch.hidden = !search.value;
      renderDocs();
    }, 90),
  );
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      search.value = "";
      state.query = "";
      if (clearSearch) clearSearch.hidden = true;
      renderDocs();
    }
  });
  clearSearch?.addEventListener("click", () => {
    if (!search) return;
    search.value = "";
    state.query = "";
    clearSearch.hidden = true;
    renderDocs();
    search.focus();
  });

  $("#tag-filter")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    if (!button) return;
    state.activeTag = button.dataset.tag || "all";
    renderDocs();
  });

  $("#docs-reset")?.addEventListener("click", () => {
    state.activeTag = "all";
    state.query = "";
    if (search) search.value = "";
    if (clearSearch) clearSearch.hidden = true;
    renderDocs();
  });

  $("#copy-email")?.addEventListener("click", async () => {
    const email = state.profile?.email;
    if (!email) return;
    const ok = await copyText(email);
    showToast(ok ? `已复制邮箱：${email}` : "复制失败，请手动选择邮箱地址。", ok ? "info" : "error");
  });

  $("#reader-copy")?.addEventListener("click", copyPageLink);
  $("#reader-share")?.addEventListener("click", shareCurrentDoc);

  $("#reader-edit")?.addEventListener("click", () => {
    if (!state.currentSlug) return;
    state.studio?.open("docs", { slug: state.currentSlug });
  });

  $("#reader-home")?.addEventListener("click", (event) => {
    event.preventDefault();
    closeReader();
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 30);
  });

  $("#reader-back-bottom")?.addEventListener("click", (event) => {
    event.preventDefault();
    closeReader();
    window.setTimeout(() => scrollToSection("documents"), 30);
  });

  $("#reader-content")?.addEventListener("click", handleContentLink);

  $("#reader-toc")?.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-toc-id]");
    if (!link) return;
    event.preventDefault();
    const target = document.getElementById(link.dataset.tocId);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  window.addEventListener("hashchange", () => {
    const slug = getDocSlugFromHash();
    if (slug) {
      openReader(slug);
    } else if (!$("#reader").hidden) {
      closeReader(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileNav();
  });

  if (reduceMotion.matches) {
    $$("[data-reveal]").forEach((node) => node.classList.add("is-visible"));
  }
}

function initReveal() {
  const nodes = $$("[data-reveal]");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
  );

  nodes.forEach((node) => observer.observe(node));
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  $("#year").textContent = String(new Date().getFullYear());
  bindEvents();

  const [profileResult, manifestResult] = await Promise.allSettled([
    fetchJSON("./data/profile.json"),
    fetchJSON("./docs/index.json"),
  ]);

  state.publishedProfile = normalizeProfile(
    profileResult.status === "fulfilled" ? profileResult.value : seedProfile,
  );
  state.publishedManifest = normalizeManifest(
    manifestResult.status === "fulfilled" ? manifestResult.value : seedManifest,
  );
  state.docDrafts = loadDocDrafts();

  const profileDraft = loadProfileDraft();
  if (profileDraft) {
    state.profile = normalizeProfile({ ...state.publishedProfile, ...profileDraft });
    state.profileIsDraft = true;
  } else {
    state.profile = state.publishedProfile;
    state.profileIsDraft = false;
  }

  state.manifest = { docs: getMergedDocs() };

  state.studio = initStudio({
    state,
    refreshSite,
    getDocs: getMergedDocs,
    loadDocContent,
  });

  renderProfile();
  renderDocs();
  initReveal();

  const initialSlug = getDocSlugFromHash();
  if (initialSlug) {
    await openReader(initialSlug);
  } else if (window.location.hash && !window.location.hash.startsWith("#/")) {
    const id = window.location.hash.slice(1);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView(), 60);
  }
}

init().catch((error) => {
  console.error(error);
  showToast("页面初始化失败，请刷新后重试。", "error");
});
