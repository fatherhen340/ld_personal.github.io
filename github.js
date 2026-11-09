const API_BASE = "https://api.github.com";

export const PATHS = {
  profile: "data/profile.json",
  docsIndex: "docs/index.json",
  doc: (slug) => `docs/${slug}.md`,
};

export class GitHubError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

export function isSettingsComplete(settings) {
  return Boolean(
    settings &&
      String(settings.owner || "").trim() &&
      String(settings.repo || "").trim() &&
      String(settings.token || "").trim(),
  );
}

function encodePath(path) {
  return String(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(String(text));
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function sortDocuments(docs) {
  return [...docs].sort((a, b) => {
    const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCompare !== 0) return dateCompare;
    return String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
  });
}

function cleanMeta(doc) {
  return {
    slug: String(doc.slug || "").trim(),
    title: String(doc.title || "").trim(),
    summary: String(doc.summary || "").trim(),
    date: String(doc.date || "").trim(),
    tags: Array.isArray(doc.tags)
      ? [...new Set(doc.tags.map((tag) => String(tag).trim()).filter(Boolean))]
      : [],
    ...(Number.isFinite(doc.minutes) ? { minutes: doc.minutes } : {}),
  };
}

export class GitHubClient {
  constructor(settings) {
    this.owner = String(settings?.owner || "").trim();
    this.repo = String(settings?.repo || "").trim();
    this.branch = String(settings?.branch || "main").trim() || "main";
    this.token = String(settings?.token || "").trim();
    if (!this.owner || !this.repo || !this.token) {
      throw new GitHubError("请先填写 GitHub 用户名、仓库名和访问令牌。");
    }
  }

  async request(path, options = {}) {
    const { method = "GET", body } = options;
    let response;
    try {
      response = await fetch(
        `${API_BASE}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}${path}`,
        {
          method,
          cache: "no-store",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
    } catch {
      throw new GitHubError(
        "无法连接 GitHub API。请检查网络、代理设置，或稍后再试。",
      );
    }

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new GitHubError(this.friendlyError(response.status, data), response.status);
    }
    return data;
  }

  friendlyError(status, data) {
    const detail = data?.message ? `：${data.message}` : "";
    if (status === 401) {
      return `令牌无效或已过期，请重新创建并保存 Personal Access Token${detail}`;
    }
    if (status === 403) {
      return `GitHub 拒绝了这次操作。请确认令牌拥有该仓库的 Contents: Read and write 权限，并检查 API 速率限制${detail}`;
    }
    if (status === 404) {
      return `找不到仓库或文件。请检查用户名、仓库名和分支是否正确${detail}`;
    }
    if (status === 409) {
      return `文件版本发生冲突，请重试一次${detail}`;
    }
    if (status === 422) {
      return `GitHub 无法处理这次提交。请检查分支是否存在、令牌权限是否足够${detail}`;
    }
    if (status >= 500) {
      return `GitHub 服务暂时不可用，请稍后再试${detail}`;
    }
    return `GitHub 返回了错误（${status}）${detail}`;
  }

  async getRepo() {
    return this.request("");
  }

  async getFile(path, ref = this.branch) {
    let data;
    try {
      data = await this.request(
        `/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
      );
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) return null;
      throw error;
    }
    if (Array.isArray(data) || !data || typeof data.content !== "string") {
      throw new GitHubError(`路径 ${path} 不是可读取的文件。`);
    }
    return {
      sha: data.sha,
      content: decodeBase64Utf8(data.content),
      path: data.path,
    };
  }

  async putFile(path, content, message, sha) {
    return this.request(`/contents/${encodePath(path)}`, {
      method: "PUT",
      body: {
        message,
        content: encodeBase64Utf8(content),
        branch: this.branch,
        ...(sha ? { sha } : {}),
      },
    });
  }

  async upsertFile(path, content, message) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const existing = await this.getFile(path);
      try {
        return await this.putFile(path, content, message, existing?.sha);
      } catch (error) {
        lastError = error;
        if (!(error instanceof GitHubError) || error.status !== 409) throw error;
      }
    }
    throw lastError || new GitHubError("写入文件失败，请重试。");
  }

  async deleteFile(path, message) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const existing = await this.getFile(path);
      if (!existing) return false;
      try {
        await this.request(`/contents/${encodePath(path)}`, {
          method: "DELETE",
          body: {
            message,
            branch: this.branch,
            sha: existing.sha,
          },
        });
        return true;
      } catch (error) {
        lastError = error;
        if (!(error instanceof GitHubError) || error.status !== 409) throw error;
      }
    }
    throw lastError || new GitHubError("删除文件失败，请重试。");
  }

  async testConnection() {
    const repo = await this.getRepo();
    return {
      repo,
      canWrite: repo?.permissions?.push !== false,
    };
  }
}

async function readRemoteManifest(client) {
  const file = await client.getFile(PATHS.docsIndex);
  if (!file) {
    return {
      manifest: { updatedAt: new Date().toISOString(), docs: [] },
      exists: false,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    throw new GitHubError(
      "仓库中的 docs/index.json 不是合法的 JSON，请先在 GitHub 中修复该文件。",
    );
  }

  if (!parsed || !Array.isArray(parsed.docs)) {
    throw new GitHubError(
      "仓库中的 docs/index.json 缺少 docs 数组，请先在 GitHub 中修复该文件。",
    );
  }

  return {
    manifest: {
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      docs: parsed.docs,
    },
    exists: true,
  };
}

export async function publishProfile(client, profile) {
  await client.upsertFile(
    PATHS.profile,
    `${JSON.stringify(profile, null, 2)}\n`,
    "profile: 更新个人简介",
  );
  return profile;
}

export async function publishDocument(client, doc, content) {
  const meta = cleanMeta(doc);
  const body = String(content || "").replace(/\s+$/, "");
  if (!meta.slug || !meta.title) {
    throw new GitHubError("文档标题和 URL 标识不能为空。");
  }
  if (!body) {
    throw new GitHubError("文档正文不能为空。");
  }

  const { manifest } = await readRemoteManifest(client);
  const nextManifest = {
    updatedAt: new Date().toISOString(),
    docs: sortDocuments([
      meta,
      ...manifest.docs.filter((item) => item?.slug !== meta.slug),
    ]),
  };

  await client.upsertFile(
    PATHS.doc(meta.slug),
    `${body}\n`,
    `docs: 发布《${meta.title}》`,
  );

  try {
    await client.upsertFile(
      PATHS.docsIndex,
      `${JSON.stringify(nextManifest, null, 2)}\n`,
      `docs: 更新《${meta.title}》索引`,
    );
  } catch (error) {
    throw new GitHubError(
      `Markdown 文件已上传，但文档索引更新失败：${error.message}。请再次点击发布重试。`,
      error.status,
    );
  }

  return nextManifest;
}

export async function deletePublishedDocument(client, slug) {
  if (!slug) throw new GitHubError("缺少要下架的文档标识。");
  const { manifest } = await readRemoteManifest(client);
  const nextManifest = {
    updatedAt: new Date().toISOString(),
    docs: manifest.docs.filter((item) => item?.slug !== slug),
  };

  await client.upsertFile(
    PATHS.docsIndex,
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    `docs: 从索引中移除 ${slug}`,
  );

  let warning = null;
  try {
    await client.deleteFile(PATHS.doc(slug), `docs: 删除《${slug}》`);
  } catch (error) {
    warning = `文档已从列表下架，但 Markdown 文件删除失败：${error.message}`;
  }

  return { manifest: nextManifest, warning };
}
