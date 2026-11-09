import {
  $,
  $$,
  characterCount,
  debounce,
  deriveSummary,
  escapeHTML,
  formatDate,
  isValidSlug,
  parseTags,
  readingMinutes,
  slugifyTitle,
  todayISO,
  uniqueSlug,
} from "./utils.js";
import {
  clearProfileDraft,
  clearSettings,
  deleteDocDraft,
  saveProfileDraft,
  saveSettings,
  setDocDraft,
} from "./store.js";
import {
  GitHubClient,
  deletePublishedDocument,
  isSettingsComplete,
  publishDocument,
  publishProfile,
} from "./github.js";
import { renderMarkdown } from "./markdown.js";
import { setBusy, showToast } from "./ui.js";

export function initStudio({ state, refreshSite, getDocs, loadDocContent }) {
  const els = {
    studio: $("#studio"),
    panel: $(".studio__panel"),
    closeButtons: $$("[data-close-studio]"),
    tabs: $$("[data-studio-tab]"),
    panels: $$("[data-studio-panel]"),
    sync: $("#studio-sync-state"),

    profileForm: $("#profile-form"),
    profileName: $("#profile-name"),
    profileLatin: $("#profile-latin"),
    profileRole: $("#profile-role"),
    profileStatus: $("#profile-status"),
    profileLocation: $("#profile-location"),
    profileEmail: $("#profile-email"),
    profileGithub: $("#profile-github"),
    profileAvatar: $("#profile-avatar"),
    profileHeadline: $("#profile-headline"),
    profileFocus: $("#profile-focus"),
    profileNow: $("#profile-now"),
    profileIntro: $("#profile-intro-input"),
    profileStatusText: $("#profile-status-text"),
    profileDraftIndicator: $("#profile-draft-indicator"),
    profileReset: $("#profile-reset"),
    profileSave: $("#profile-save-draft"),
    profilePublish: $("#profile-publish"),

    docForm: $("#doc-form"),
    docList: $("#studio-doc-list"),
    docNew: $("#doc-new"),
    docEditor: $("#doc-editor"),
    docEditorMode: $("#doc-editor-mode"),
    docEditorTitle: $("#doc-editor-title"),
    docDraftIndicator: $("#doc-draft-indicator"),
    docPublishedIndicator: $("#doc-published-indicator"),
    docTitle: $("#doc-title"),
    docSlug: $("#doc-slug"),
    docDate: $("#doc-date"),
    docTags: $("#doc-tags"),
    docSummary: $("#doc-summary"),
    docContent: $("#doc-content"),
    docPreview: $("#doc-preview"),
    docCount: $("#doc-count"),
    docStatusText: $("#doc-status-text"),
    docSave: $("#doc-save"),
    docPublish: $("#doc-publish"),
    docDelete: $("#doc-delete"),
    docUnpublish: $("#doc-unpublish"),
    markdownTools: $$("[data-md]"),

    settingsForm: $("#settings-form"),
    settingsOwner: $("#settings-owner"),
    settingsRepo: $("#settings-repo"),
    settingsBranch: $("#settings-branch"),
    settingsToken: $("#settings-token"),
    tokenToggle: $("#token-toggle"),
    settingsTest: $("#settings-test"),
    settingsSave: $("#settings-save"),
    settingsClear: $("#settings-clear"),
    settingsStatus: $("#settings-status"),
  };

  let studioOpen = false;
  let currentTab = "profile";
  let lastFocused = null;
  let profileDirty = false;
  let editorDirty = false;
  let currentSlug = null;
  let currentPublished = false;
  let docsReady = false;
  let slugTouched = false;
  let editorReady = true;
  let suppressDirty = false;
  let loadSequence = 0;

  const previewNow = () => {
    const content = els.docContent.value;
    if (!content.trim()) {
      els.docPreview.innerHTML =
        '<p class="editor-placeholder">实时预览会出现在这里。</p>';
    } else {
      els.docPreview.innerHTML = renderMarkdown(content).html;
    }
    els.docCount.textContent = `${characterCount(content)} 字 · 约 ${readingMinutes(
      content,
    )} 分钟`;
  };
  const previewLater = debounce(previewNow, 150);

  /* ------------------------------------------------------------------ */
  /* Utilities                                                           */
  /* ------------------------------------------------------------------ */

  function errorMessage(error) {
    return error instanceof Error && error.message
      ? error.message
      : "操作失败，请稍后重试。";
  }

  function setSettingsStatus(text, type = "") {
    els.settingsStatus.textContent = text;
    els.settingsStatus.classList.toggle("is-error", type === "error");
    els.settingsStatus.classList.toggle("is-ok", type === "ok");
  }

  function syncConnectionState() {
    if (!els.sync) return;
    const connected = isSettingsComplete(state.settings);
    els.sync.classList.toggle("is-connected", connected);
    els.sync.innerHTML = `<span class="sync-dot"></span><span>${
      connected
        ? `GitHub · ${escapeHTML(state.settings.owner)}/${escapeHTML(state.settings.repo)}`
        : "尚未连接 GitHub"
    }</span>`;
  }

  function getClient() {
    if (!isSettingsComplete(state.settings)) {
      showToast("请先在「发布设置」中连接 GitHub，再发布内容。", "error");
      selectTab("settings");
      return null;
    }
    try {
      return new GitHubClient(state.settings);
    } catch (error) {
      showToast(errorMessage(error), "error");
      return null;
    }
  }

  function selectTab(tab) {
    currentTab = tab;
    els.tabs.forEach((button) => {
      const active = button.dataset.studioTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    els.panels.forEach((panel) => {
      const active = panel.dataset.studioPanel === tab;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    if (tab === "docs" && !docsReady) newDoc();
    if (tab === "settings") syncConnectionState();
  }

  /* ------------------------------------------------------------------ */
  /* Profile                                                             */
  /* ------------------------------------------------------------------ */

  function fillProfileForm(profile) {
    els.profileName.value = profile.name || "";
    els.profileLatin.value = profile.latin || "";
    els.profileRole.value = profile.role || "";
    els.profileStatus.value = profile.status || "";
    els.profileLocation.value = profile.location || "";
    els.profileEmail.value = profile.email || "";
    els.profileGithub.value = profile.github || "";
    els.profileAvatar.value = profile.avatar || "";
    els.profileHeadline.value = profile.headline || "";
    els.profileFocus.value = (profile.focus || []).join(", ");
    els.profileNow.value = profile.now || "";
    els.profileIntro.value = profile.intro || "";
    profileDirty = false;
    updateProfileIndicators();
  }

  function collectProfileForm() {
    return {
      name: els.profileName.value.trim(),
      latin: els.profileLatin.value.trim(),
      role: els.profileRole.value.trim(),
      status: els.profileStatus.value.trim(),
      location: els.profileLocation.value.trim(),
      email: els.profileEmail.value.trim(),
      github: els.profileGithub.value.trim(),
      avatar: els.profileAvatar.value.trim(),
      headline: els.profileHeadline.value.trim(),
      focus: parseTags(els.profileFocus.value),
      now: els.profileNow.value.trim(),
      intro: els.profileIntro.value.replace(/\s+$/, ""),
    };
  }

  function validateProfileForm() {
    if (!els.profileForm.checkValidity()) {
      els.profileForm.reportValidity();
      return false;
    }
    if (!els.profileName.value.trim()) {
      showToast("请填写名字。", "error");
      els.profileName.focus();
      return false;
    }
    return true;
  }

  function updateProfileIndicators() {
    const draft = state.profileIsDraft;
    if (els.profileDraftIndicator) els.profileDraftIndicator.hidden = !draft;
    if (els.profileStatusText) {
      els.profileStatusText.textContent = draft
        ? "当前正在预览本地草稿"
        : "当前显示已发布的简介";
    }
  }

  function markProfileDirty() {
    if (suppressDirty) return;
    profileDirty = true;
    els.profileStatusText.textContent = "有未保存的修改（尚未生效）";
  }

  function saveProfileDraftLocally() {
    if (!validateProfileForm()) return;
    const profile = collectProfileForm();
    const stored = saveProfileDraft(profile);
    state.profile = profile;
    state.profileIsDraft = true;
    profileDirty = false;
    refreshSite();
    updateProfileIndicators();
    els.profileStatusText.textContent = stored
      ? "本地草稿已保存，仅当前浏览器可见"
      : "已应用到当前页面，但浏览器存储不可用";
    showToast(
      stored
        ? "已保存本地草稿。确认无误后，点击「发布简介」上线。"
        : "浏览器存储不可用，刷新后草稿会丢失。",
      stored ? "info" : "error",
    );
  }

  async function publishProfileOnline() {
    if (!validateProfileForm()) return;
    const client = getClient();
    if (!client) return;
    const profile = collectProfileForm();

    setBusy("正在发布个人简介…", true);
    try {
      await publishProfile(client, profile);
      state.publishedProfile = profile;
      state.profile = profile;
      state.profileIsDraft = false;
      profileDirty = false;
      clearProfileDraft();
      refreshSite();
      updateProfileIndicators();
      els.profileStatusText.textContent = "已发布 · GitHub Pages 通常会在 1–2 分钟内更新";
      showToast("个人简介已发布到 GitHub。");
    } catch (error) {
      showToast(errorMessage(error), "error");
      els.profileStatusText.textContent = "发布失败，请检查连接设置后重试";
    } finally {
      setBusy("", false);
    }
  }

  function resetProfile() {
    if (state.profileIsDraft && !window.confirm("将丢弃本地草稿并恢复线上版本，继续吗？")) {
      return;
    }
    clearProfileDraft();
    state.profileIsDraft = false;
    state.profile = { ...state.publishedProfile };
    fillProfileForm(state.profile);
    refreshSite();
    showToast("已恢复为线上版本。");
  }

  /* ------------------------------------------------------------------ */
  /* Documents                                                           */
  /* ------------------------------------------------------------------ */

  function renderDocList() {
    const docs = getDocs();
    if (!docs.length) {
      els.docList.innerHTML =
        '<p class="studio-doc-empty">还没有文档。<br>点击右上角的 + 开始写第一篇。</p>';
      return;
    }

    els.docList.innerHTML = docs
      .map(
        (doc) => `
          <button type="button" class="studio-doc-item ${
            doc.slug === currentSlug ? "is-active" : ""
          }" data-doc-slug="${escapeHTML(doc.slug)}">
            <span class="studio-doc-item__title">${escapeHTML(doc.title)}</span>
            <span class="studio-doc-item__meta">
              ${
                doc.isDraft
                  ? '<span class="mini-draft-dot" title="本地草稿"></span>'
                  : ""
              }
              <span>${escapeHTML(formatDate(doc.date) || "未标日期")}</span>
              <span>·</span>
              <span>${doc.isDraft ? "草稿" : "已发布"}</span>
            </span>
          </button>`,
      )
      .join("");

    requestAnimationFrame(() => {
      els.docList
        .querySelector(".studio-doc-item.is-active")
        ?.scrollIntoView({ block: "nearest" });
    });
  }

  function updateDocIndicators() {
    const hasDraft = Boolean(currentSlug && state.docDrafts[currentSlug]);
    const published = Boolean(
      currentSlug &&
        (state.publishedManifest.docs || []).some((doc) => doc?.slug === currentSlug),
    );
    currentPublished = published;

    els.docDraftIndicator.hidden = !hasDraft;
    els.docPublishedIndicator.hidden = !published;
    els.docDelete.hidden = !hasDraft;
    els.docUnpublish.hidden = !published;
    els.docSlug.readOnly = published;
    els.docEditorMode.textContent = currentSlug
      ? published
        ? "PUBLISHED DOCUMENT"
        : "LOCAL DRAFT"
      : "NEW DOCUMENT";
    els.docEditorTitle.textContent = currentSlug
      ? published
        ? "编辑已发布文档"
        : "编辑本地草稿"
      : "新建文档";
  }

  function setDocStatus(text) {
    els.docStatusText.textContent = text;
  }

  function setEditorLoading(loading) {
    editorReady = !loading;
    els.docSave.disabled = loading;
    els.docPublish.disabled = loading;
    if (loading) {
      els.docContent.disabled = true;
      setDocStatus("正在读取文档…");
    } else {
      els.docContent.disabled = false;
    }
  }

  function markEditorDirty() {
    if (suppressDirty) return;
    editorDirty = true;
    setDocStatus("有未保存的修改");
  }

  function fillDocForm(meta, content, { published, hasDraft }) {
    suppressDirty = true;
    els.docTitle.value = meta.title || "";
    els.docSlug.value = meta.slug || "";
    els.docDate.value = meta.date || todayISO();
    els.docTags.value = (meta.tags || []).join(", ");
    els.docSummary.value = meta.summary || "";
    els.docContent.value = content || "";
    els.docSlug.readOnly = Boolean(published);
    slugTouched = true;
    suppressDirty = false;

    previewNow();
    updateDocIndicators();
    els.docDraftIndicator.hidden = !hasDraft;
    els.docPublishedIndicator.hidden = !published;
    editorDirty = false;
    editorReady = true;

    if (hasDraft && !published) {
      setDocStatus("本地草稿 · 尚未发布");
    } else if (published && hasDraft) {
      setDocStatus("已发布 · 本地有未发布的修改草稿");
    } else if (published) {
      setDocStatus("已发布到网站");
    } else {
      setDocStatus("尚未保存");
    }
  }

  function newDoc() {
    loadSequence += 1;
    currentSlug = null;
    currentPublished = false;
    docsReady = true;
    slugTouched = false;
    editorDirty = false;
    editorReady = true;
    suppressDirty = true;
    els.docTitle.value = "";
    els.docSlug.value = "";
    els.docSlug.readOnly = false;
    els.docDate.value = todayISO();
    els.docTags.value = "";
    els.docSummary.value = "";
    els.docContent.value = "";
    els.docContent.disabled = false;
    els.docSave.disabled = false;
    els.docPublish.disabled = false;
    suppressDirty = false;

    els.docPreview.innerHTML =
      '<p class="editor-placeholder">实时预览会出现在这里。</p>';
    els.docCount.textContent = "0 字";
    els.docEditorMode.textContent = "NEW DOCUMENT";
    els.docEditorTitle.textContent = "新建文档";
    els.docDraftIndicator.hidden = true;
    els.docPublishedIndicator.hidden = true;
    els.docDelete.hidden = true;
    els.docUnpublish.hidden = true;
    setDocStatus("新建文档 · 尚未保存");
    renderDocList();
    if (studioOpen && currentTab === "docs") {
      window.setTimeout(() => els.docTitle.focus(), 30);
    }
  }

  async function openDoc(slug, { force = false } = {}) {
    if (editorDirty && !force) {
      if (!window.confirm("当前文档有未保存的修改，仍要切换吗？")) return;
    }

    const meta = getDocs().find((doc) => doc.slug === slug);
    if (!meta) {
      showToast("文档不存在，可能已被删除。", "error");
      return;
    }

    const sequence = ++loadSequence;
    docsReady = true;
    currentSlug = slug;
    const published = (state.publishedManifest.docs || []).some(
      (doc) => doc?.slug === slug,
    );
    currentPublished = published;

    suppressDirty = true;
    els.docTitle.value = meta.title || "";
    els.docSlug.value = meta.slug || "";
    els.docSlug.readOnly = published;
    els.docDate.value = meta.date || todayISO();
    els.docTags.value = (meta.tags || []).join(", ");
    els.docSummary.value = meta.summary || "";
    els.docContent.value = "";
    suppressDirty = false;

    setEditorLoading(true);
    renderDocList();
    updateDocIndicators();
    els.docEditorMode.textContent = published ? "PUBLISHED DOCUMENT" : "LOCAL DRAFT";
    els.docEditorTitle.textContent = published ? "编辑已发布文档" : "编辑本地草稿";

    try {
      const content = await loadDocContent(meta);
      if (sequence !== loadSequence) return;
      setEditorLoading(false);
      fillDocForm(meta, content, {
        published,
        hasDraft: Boolean(state.docDrafts[slug]),
      });
      renderDocList();
    } catch (error) {
      if (sequence !== loadSequence) return;
      setEditorLoading(false);
      editorReady = false;
      els.docSave.disabled = true;
      els.docPublish.disabled = true;
      els.docPreview.innerHTML = `<p class="editor-placeholder">${escapeHTML(
        errorMessage(error),
      )}</p>`;
      setDocStatus("读取失败，暂时不能编辑此文档");
      showToast(errorMessage(error), "error");
    }
  }

  function readDocForm() {
    const content = els.docContent.value;
    return {
      meta: {
        title: els.docTitle.value.trim(),
        slug: els.docSlug.value.trim(),
        date: els.docDate.value || todayISO(),
        tags: parseTags(els.docTags.value),
        summary:
          els.docSummary.value.trim() || deriveSummary(content, 96),
        minutes: readingMinutes(content),
      },
      content,
    };
  }

  function validateDocForm() {
    if (!els.docForm.checkValidity()) {
      els.docForm.reportValidity();
      return false;
    }
    if (!editorReady) {
      showToast("文档内容尚未读取成功，请重新打开后再试。", "error");
      return false;
    }

    const { meta, content } = readDocForm();
    if (!meta.title) {
      showToast("请填写文档标题。", "error");
      els.docTitle.focus();
      return false;
    }
    if (!isValidSlug(meta.slug)) {
      showToast("URL 标识只能使用小写字母、数字和连字符，例如 my-first-note。", "error");
      els.docSlug.focus();
      return false;
    }
    if (currentSlug && currentPublished && meta.slug !== currentSlug) {
      showToast("已发布文档的 URL 标识不能直接修改。", "error");
      return false;
    }
    if (!content.trim()) {
      showToast("文档正文不能为空。", "error");
      els.docContent.focus();
      return false;
    }
    const duplicate = getDocs().some(
      (doc) => doc.slug === meta.slug && doc.slug !== currentSlug,
    );
    if (duplicate) {
      showToast("这个 URL 标识已经被另一篇文档使用，请换一个。", "error");
      els.docSlug.focus();
      return false;
    }
    return true;
  }

  function saveDocLocally() {
    if (!validateDocForm()) return;
    const { meta, content } = readDocForm();
    const previousSlug = currentSlug;

    if (previousSlug && previousSlug !== meta.slug) {
      state.docDrafts = deleteDocDraft(previousSlug);
    }
    state.docDrafts = setDocDraft({
      meta,
      content,
      savedAt: new Date().toISOString(),
    });
    state.contentCache.delete(meta.slug);
    currentSlug = meta.slug;
    slugTouched = true;
    editorDirty = false;
    editorReady = true;

    refreshSite();
    updateDocIndicators();
    renderDocList();
    setDocStatus("本地草稿已保存 · 仅当前浏览器可见");
    showToast("已保存本地草稿。发布后其他人才能在主页看到。");
  }

  async function publishDocOnline() {
    if (!validateDocForm()) return;
    const client = getClient();
    if (!client) return;
    const { meta, content } = readDocForm();
    const previousSlug = currentSlug;

    setBusy("正在把文档发布到 GitHub…", true);
    try {
      const manifest = await publishDocument(client, meta, content);
      state.publishedManifest = {
        updatedAt: manifest.updatedAt,
        docs: manifest.docs,
      };

      if (previousSlug) state.docDrafts = deleteDocDraft(previousSlug);
      if (meta.slug !== previousSlug) state.docDrafts = deleteDocDraft(meta.slug);
      state.contentCache.delete(meta.slug);

      currentSlug = meta.slug;
      currentPublished = true;
      slugTouched = true;
      editorDirty = false;
      editorReady = true;
      els.docSlug.readOnly = true;

      refreshSite();
      updateDocIndicators();
      renderDocList();
      setDocStatus("已发布 · GitHub Pages 通常会在 1–2 分钟内更新");
      showToast("文档已发布。若页面没有立刻更新，请稍后刷新。");
    } catch (error) {
      showToast(errorMessage(error), "error");
      setDocStatus("发布失败 · 本地编辑内容仍然保留");
    } finally {
      setBusy("", false);
    }
  }

  function deleteDraft() {
    if (!currentSlug || !state.docDrafts[currentSlug]) return;
    if (!window.confirm("删除这篇文档的本地草稿？此操作无法撤销，但不会影响已发布版本。")) {
      return;
    }

    const wasPublished = currentPublished;
    state.docDrafts = deleteDocDraft(currentSlug);
    state.contentCache.delete(currentSlug);
    editorDirty = false;

    if (wasPublished) {
      refreshSite();
      openDoc(currentSlug, { force: true });
      showToast("本地草稿已删除，已重新载入线上版本。");
    } else {
      refreshSite();
      newDoc();
      showToast("本地草稿已删除。");
    }
  }

  async function unpublishDoc() {
    if (!currentSlug) return;
    const client = getClient();
    if (!client) return;
    if (
      !window.confirm(
        "确定将这篇文档从网站下架吗？Markdown 文件会从仓库删除；如果存在本地草稿，会保留在编辑器中。",
      )
    ) {
      return;
    }

    setBusy("正在从 GitHub 下架文档…", true);
    try {
      const { manifest, warning } = await deletePublishedDocument(client, currentSlug);
      state.publishedManifest = {
        updatedAt: manifest.updatedAt,
        docs: manifest.docs,
      };
      currentPublished = false;
      state.contentCache.delete(currentSlug);
      refreshSite();
      updateDocIndicators();
      renderDocList();
      setDocStatus("已下架 · 当前内容可保存为本地草稿");
      showToast(warning || "文档已从网站下架。", warning ? "error" : "info");
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusy("", false);
    }
  }

  function insertMarkdown(kind) {
    const textarea = els.docContent;
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);

    const replace = (text, selectionStart, selectionEnd) => {
      textarea.setRangeText(text, start, end, "end");
      if (typeof selectionStart === "number") {
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };

    if (kind === "bold") {
      const text = `**${selected || "重点文字"}**`;
      replace(text, start + 2, start + 2 + (selected || "重点文字").length);
    } else if (kind === "italic") {
      const text = `*${selected || "需要强调的文字"}*`;
      replace(text, start + 1, start + 1 + (selected || "需要强调的文字").length);
    } else if (kind === "h2") {
      const addition = `${start > 0 && !value.slice(0, start).endsWith("\n") ? "\n\n" : ""}## ${
        selected || "小标题"
      }\n\n`;
      replace(addition, start + addition.length - 2, start + addition.length - 2);
    } else if (kind === "quote") {
      const addition = selected
        ? selected
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n")
        : "> 一段值得被强调的引用。";
      replace(addition);
    } else if (kind === "list") {
      const addition = selected
        ? selected
            .split("\n")
            .map((line) => `- ${line}`)
            .join("\n")
        : "- 第一项\n- 第二项\n- 第三项";
      replace(addition);
    } else if (kind === "code") {
      const addition =
        selected && selected.includes("\n")
          ? `\n\`\`\`\n${selected}\n\`\`\`\n`
          : `\`${selected || "code"}\``;
      replace(addition);
    } else if (kind === "link") {
      const label = selected || "链接文字";
      const addition = `[${label}](https://)`;
      replace(addition, start + label.length + 3, start + addition.length - 1);
    } else if (kind === "divider") {
      const addition = `${start > 0 && !value.slice(0, start).endsWith("\n") ? "\n\n" : ""}---\n\n`;
      replace(addition, start + addition.length, start + addition.length);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  function fillSettingsForm(settings) {
    els.settingsOwner.value = settings.owner || "";
    els.settingsRepo.value = settings.repo || "";
    els.settingsBranch.value = settings.branch || "main";
    els.settingsToken.value = settings.token || "";
    els.settingsToken.type = "password";
    els.tokenToggle.textContent = "显示";
    syncConnectionState();
    if (isSettingsComplete(settings)) {
      setSettingsStatus(
        `已保存连接：${settings.owner}/${settings.repo}（${settings.branch}）。可点击「测试连接」验证权限。`,
      );
    } else {
      setSettingsStatus("尚未连接。填写后建议先测试连接，再保存。");
    }
  }

  function readSettingsForm() {
    return {
      owner: els.settingsOwner.value.trim(),
      repo: els.settingsRepo.value.trim(),
      branch: els.settingsBranch.value.trim() || "main",
      token: els.settingsToken.value.trim(),
    };
  }

  function validateSettings(settings) {
    if (!settings.owner || !settings.repo) {
      showToast("请填写 GitHub 用户名和仓库名。", "error");
      els.settingsOwner.focus();
      return false;
    }
    if (!settings.token) {
      showToast("请填写 Personal Access Token。", "error");
      els.settingsToken.focus();
      return false;
    }
    return true;
  }

  function saveSettingsForm() {
    const settings = readSettingsForm();
    if (!validateSettings(settings)) return;
    const stored = saveSettings(settings);
    state.settings = settings;
    syncConnectionState();
    setSettingsStatus(
      stored
        ? `设置已保存：${settings.owner}/${settings.repo}（${settings.branch}）`
        : "设置已应用，但浏览器存储不可用，刷新后会丢失。",
      stored ? "ok" : "error",
    );
    showToast(stored ? "GitHub 连接设置已保存。" : "浏览器存储不可用，设置未持久化。");
  }

  async function testSettings() {
    const settings = readSettingsForm();
    if (!validateSettings(settings)) return;

    els.settingsTest.disabled = true;
    setSettingsStatus("正在连接 GitHub…");
    try {
      const client = new GitHubClient(settings);
      const { repo, canWrite } = await client.testConnection();
      if (canWrite === false) {
        setSettingsStatus(
          `已连接 ${repo.full_name}，但令牌可能没有写入权限。请确认 Contents 权限为 Read and write。`,
          "error",
        );
      } else {
        state.settings = settings;
        saveSettings(settings);
        syncConnectionState();
        setSettingsStatus(
          `连接成功：${repo.full_name}（${
            repo.private ? "私有仓库" : "公开仓库"
          }）· 设置已保存`,
          "ok",
        );
        showToast("GitHub 连接测试成功，设置已保存。");
      }
    } catch (error) {
      setSettingsStatus(errorMessage(error), "error");
      showToast(errorMessage(error), "error");
    } finally {
      els.settingsTest.disabled = false;
    }
  }

  function clearConnection() {
    if (!window.confirm("清除当前浏览器中保存的 GitHub 连接设置？")) return;
    clearSettings();
    state.settings = { owner: "", repo: "", branch: "main", token: "" };
    fillSettingsForm(state.settings);
    setSettingsStatus("连接设置已清除。");
    showToast("已清除 GitHub 连接设置。");
  }

  /* ------------------------------------------------------------------ */
  /* Studio lifecycle                                                    */
  /* ------------------------------------------------------------------ */

  async function open(tab = "profile", options = {}) {
    if (!studioOpen) {
      lastFocused = document.activeElement;
      fillProfileForm(state.profile);
      fillSettingsForm(state.settings);
      renderDocList();
      studioOpen = true;
      profileDirty = false;
      editorDirty = false;
      els.studio.hidden = false;
      document.body.classList.add("studio-open");
      syncConnectionState();
      window.setTimeout(() => {
        if (currentTab === "profile") els.profileName.focus();
        else if (currentTab === "docs") els.docTitle.focus();
        else els.settingsOwner.focus();
      }, 100);
    }

    selectTab(tab);
    if (tab === "docs") {
      if (options.slug) await openDoc(options.slug, { force: true });
      else if (!docsReady) newDoc();
    }
  }

  function close() {
    if (!studioOpen) return;
    if (
      (profileDirty || editorDirty) &&
      !window.confirm("有尚未保存的修改，确定关闭内容工作室吗？")
    ) {
      return;
    }
    studioOpen = false;
    els.studio.hidden = true;
    document.body.classList.remove("studio-open");
    profileDirty = false;
    editorDirty = false;
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function trapFocus(event) {
    if (event.key !== "Tab") return;
    const focusable = $$(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      els.panel,
    ).filter((node) => !node.hidden && node.offsetParent !== null);

    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  els.closeButtons.forEach((button) => button.addEventListener("click", close));

  els.tabs.forEach((button) => {
    button.addEventListener("click", () => selectTab(button.dataset.studioTab));
  });

  els.profileForm.addEventListener("input", markProfileDirty);
  els.profileSave.addEventListener("click", saveProfileDraftLocally);
  els.profilePublish.addEventListener("click", publishProfileOnline);
  els.profileReset.addEventListener("click", resetProfile);

  els.docNew.addEventListener("click", () => {
    if (editorDirty && !window.confirm("当前文档有未保存的修改，仍要新建文档吗？")) {
      return;
    }
    newDoc();
  });

  els.docList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-doc-slug]");
    if (!item) return;
    const slug = item.dataset.docSlug;
    if (slug === currentSlug && !editorDirty) return;
    if (editorDirty && !window.confirm("当前文档有未保存的修改，仍要切换吗？")) return;
    openDoc(slug, { force: true });
  });

  els.docForm.addEventListener("input", (event) => {
    if (event.target === els.docContent) {
      previewLater();
    }
    markEditorDirty();
  });

  els.docTitle.addEventListener("input", () => {
    if (!slugTouched && !currentPublished) {
      const title = els.docTitle.value.trim();
      if (!title) {
        els.docSlug.value = "";
        return;
      }
      const base = slugifyTitle(title, els.docDate.value || todayISO());
      els.docSlug.value = uniqueSlug(base, getDocs(), currentSlug);
    }
  });

  els.docDate.addEventListener("change", () => {
    if (!slugTouched && !currentPublished) {
      const title = els.docTitle.value.trim();
      if (title) {
        els.docSlug.value = uniqueSlug(
          slugifyTitle(title, els.docDate.value || todayISO()),
          getDocs(),
          currentSlug,
        );
      }
    }
  });

  els.docSlug.addEventListener("input", () => {
    slugTouched = true;
  });

  els.docContent.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    const start = els.docContent.selectionStart;
    els.docContent.setRangeText("  ", start, els.docContent.selectionEnd, "end");
    els.docContent.dispatchEvent(new Event("input", { bubbles: true }));
  });

  els.markdownTools.forEach((button) => {
    button.addEventListener("click", () => insertMarkdown(button.dataset.md));
  });

  els.docSave.addEventListener("click", saveDocLocally);
  els.docPublish.addEventListener("click", publishDocOnline);
  els.docDelete.addEventListener("click", deleteDraft);
  els.docUnpublish.addEventListener("click", unpublishDoc);

  els.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettingsForm();
  });
  els.settingsTest.addEventListener("click", testSettings);
  els.settingsClear.addEventListener("click", clearConnection);

  els.tokenToggle.addEventListener("click", () => {
    const showing = els.settingsToken.type === "text";
    els.settingsToken.type = showing ? "password" : "text";
    els.tokenToggle.textContent = showing ? "显示" : "隐藏";
  });

  document.addEventListener("keydown", (event) => {
    if (!studioOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else {
      trapFocus(event);
    }
  });

  syncConnectionState();

  return { open, close };
}
