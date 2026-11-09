# 第三方依赖

为了让站点在无法访问公共 CDN 时也能正常渲染 Markdown，以下依赖已固定版本并放在本地。
无需构建工具，直接由 `index.html` 加载。

| 文件 | 项目 | 版本 | 许可证 |
| --- | --- | --- | --- |
| `marked.min.js` | [marked](https://github.com/markedjs/marked) | 12.0.2 | MIT |
| `purify.min.js` | [DOMPurify](https://github.com/cure53/DOMPurify) | 3.1.6 | Apache-2.0 OR MPL-2.0 |
| `LICENSE-marked.md` | marked 许可证原文 | — | MIT |
| `LICENSE-dompurify` | DOMPurify 许可证原文 | — | Apache-2.0 / MPL-2.0 |

升级依赖时，请同步更新文件名、`index.html` 里的引用以及上表版本号，并在真实浏览器中复查：

1. Markdown 标题、表格、任务列表、代码块渲染；
2. 阅读页目录生成；
3. 编辑器的实时预览；
4. 恶意 HTML 是否被净化。
