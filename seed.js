/**
 * 首屏兜底数据。
 *
 * 站点在线时，内容来自 data/profile.json 与 docs/index.json。
 * 如果这些文件暂时读取失败，就回退到这里，保证示例内容仍然可见。
 * 注意：请通过本地服务器或 GitHub Pages 访问，直接双击 index.html
 * 会因浏览器对 ES Module 的跨域限制而无法运行。
 */

export const seedProfile = {
  name: "林知远",
  latin: "LIN ZHIYUAN",
  role: "计算机科学 · 硕士研究生",
  status: "开放交流与合作",
  headline: "在算法与人文之间，记录一些认真思考过的东西。",
  location: "杭州 · 中国",
  email: "hello@example.com",
  github: "https://github.com/yourname",
  avatar: "",
  focus: ["人机交互", "知识管理", "可解释 AI", "数字人文"],
  now: "正在整理个人知识库，并尝试把研究过程写成可被复用的笔记。",
  intro:
    "你好，我是知远。这里是我的个人主页，也是一个小型的公开笔记本。\n\n" +
    "我关注人与技术之间的关系，喜欢把复杂的问题拆开、慢慢弄清楚，再用文字把过程留下来。这里会放研究随笔、阅读笔记，以及一些尚未成形的想法。\n\n" +
    "我相信，写作不是为了展示已经想明白的结论，而是为了让思考有一个可以被看见的形状。如果某篇文字恰好对你有用，或者你有不同的看法，欢迎写信和我聊聊。",
};

export const seedManifest = {
  updatedAt: "2026-11-09T10:00:00+08:00",
  docs: [
    {
      slug: "hello-world",
      title: "在这里，写下第一行",
      summary:
        "关于这个小小站点的由来、它要装下什么，以及为什么我决定把思考公开地放在这里。",
      date: "2026-11-09",
      tags: ["关于本站", "随笔"],
    },
    {
      slug: "markdown-guide",
      title: "Markdown 写作速查",
      summary:
        "一份给未来自己的排版备忘：标题、强调、列表、代码、表格与引用，够用就好。",
      date: "2026-11-06",
      tags: ["指南", "Markdown"],
    },
    {
      slug: "research-notes",
      title: "研究笔记：从问题到可复用的线索",
      summary:
        "记录一次研究起步的过程，以及我如何用「问题—线索—下一步」的结构整理零散材料。",
      date: "2026-10-28",
      tags: ["研究", "方法", "阅读"],
    },
  ],
};

/**
 * 从 index.html 里的 text/plain 脚本读取示例文档原文。
 * 这样 Markdown 文件读取失败时，阅读页也不会只剩一个错误提示。
 */
export function getSeedDoc(slug) {
  if (!slug) return "";
  const node = document.querySelector(`script[data-seed-doc="${slug}"]`);
  if (!node) return "";
  return node.textContent.replace(/^\n/, "").replace(/\s+$/, "");
}
