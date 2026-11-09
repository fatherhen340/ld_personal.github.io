const KEYS = {
  settings: "inkstone.settings.v1",
  profileDraft: "inkstone.profile-draft.v1",
  docDrafts: "inkstone.doc-drafts.v1",
};

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in private mode; the UI will still work for this session.
  }
}

export function loadSettings() {
  const stored = read(KEYS.settings, {});
  return {
    owner: typeof stored?.owner === "string" ? stored.owner : "",
    repo: typeof stored?.repo === "string" ? stored.repo : "",
    branch: typeof stored?.branch === "string" && stored.branch ? stored.branch : "main",
    token: typeof stored?.token === "string" ? stored.token : "",
  };
}

export function saveSettings(settings) {
  return write(KEYS.settings, {
    owner: settings.owner || "",
    repo: settings.repo || "",
    branch: settings.branch || "main",
    token: settings.token || "",
    savedAt: new Date().toISOString(),
  });
}

export function clearSettings() {
  remove(KEYS.settings);
}

export function loadProfileDraft() {
  const draft = read(KEYS.profileDraft, null);
  return draft && typeof draft === "object" ? draft : null;
}

export function saveProfileDraft(profile) {
  return write(KEYS.profileDraft, profile);
}

export function clearProfileDraft() {
  remove(KEYS.profileDraft);
}

export function loadDocDrafts() {
  const drafts = read(KEYS.docDrafts, {});
  if (!drafts || typeof drafts !== "object" || Array.isArray(drafts)) return {};
  const clean = {};
  for (const [slug, draft] of Object.entries(drafts)) {
    if (!draft || typeof draft !== "object") continue;
    const meta = draft.meta && typeof draft.meta === "object" ? draft.meta : null;
    if (!meta || typeof draft.content !== "string") continue;
    clean[slug] = draft;
  }
  return clean;
}

export function setDocDraft(draft) {
  const drafts = loadDocDrafts();
  if (!draft?.meta?.slug) return drafts;
  drafts[draft.meta.slug] = {
    meta: draft.meta,
    content: String(draft.content || ""),
    savedAt: draft.savedAt || new Date().toISOString(),
  };
  write(KEYS.docDrafts, drafts);
  return drafts;
}

export function deleteDocDraft(slug) {
  const drafts = loadDocDrafts();
  if (slug && Object.prototype.hasOwnProperty.call(drafts, slug)) {
    delete drafts[slug];
    write(KEYS.docDrafts, drafts);
  }
  return drafts;
}
