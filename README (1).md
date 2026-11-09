# 个人主页 · 在线 Markdown 文档站

一个为 GitHub Pages 准备的静态个人主页。无需构建工具、无需数据库，直接上传即可使用。

主页包含两块核心内容：

- **个人信息简介**：在网页里直接修改，支持 Markdown，可先保存本地草稿再发布。
- **文档**：在线新建 / 编辑 Markdown 文档，实时预览，支持标签、搜索、阅读页和独立链接。
- **一键发布**：通过 GitHub API 把修改提交到仓库，GitHub Pages 自动更新。

> 当前是初版示例，页面上的「林知远」、邮箱和示例文章都是占位内容。打开「管理」即可替换。

---

## 1. 先看一眼

**必须通过本地服务器或 GitHub Pages 打开。** 直接双击 `index.html` 时，浏览器会因 ES Module 的跨域限制而无法加载脚本，页面只会显示静态骨架。

Windows 下可以直接双击项目里的 **`preview.cmd`**，它会启动本地服务器并打开浏览器。

也可以手动启动：

```bash
# 需要 Python 3
python -m http.server 8000

# 或者使用 Node.js
npx serve .
```

然后访问 <http://127.0.0.1:8000>。

首次打开后，点击右上角的 **管理**：

| 标签 | 能做什么 |
| --- | --- |
| 个人信息 | 修改名字、身份、一句话介绍、简介、联系方式、关注方向 |
| 文档 | 新建 Markdown、实时预览、保存本地草稿、发布、下架 |
| 发布设置 | 连接你的 GitHub 仓库并测试权限 |

---

## 2. 部署到 GitHub Pages

### 方式 A：用户主页（推荐）

仓库名必须是 `你的用户名.github.io`：

1. 在 GitHub 新建公开仓库，例如 `yourname.github.io`。
2. 把 **本目录里的全部内容**（不是 `personal-site` 文件夹本身）上传到仓库根目录。
   - 一定要包含 `.nojekyll` 文件；
   - 保持 `index.html` 在根目录。
3. 打开仓库的 **Settings → Pages**。
4. **Build and deployment → Source** 选择 `Deploy from a branch`。
5. 分支选择 `main`，目录选择 `/ (root)`，保存。
6. 等待 1–2 分钟，访问 `https://yourname.github.io`。

### 方式 B：项目主页

任意仓库都可以：

1. 把文件放到仓库根目录（或 `docs/` 目录，在 Pages 设置里选择对应目录）。
2. Settings → Pages → 选择分支和目录。
3. 访问 `https://yourname.github.io/仓库名/`。

站内资源都使用相对路径，因此放在子路径下也能正常工作。

### 关于自定义域名

在 Pages 设置里绑定域名后，GitHub 会要求添加 `CNAME` 文件。按 GitHub 的提示创建即可。站点本身不需要改动。

---

## 3. 连接在线发布

静态站点没有后端，发布功能通过 GitHub REST API 完成。你需要在浏览器里保存一个有仓库写入权限的 **Fine-grained Personal Access Token**。

### 创建令牌

1. 登录 GitHub，打开 **Settings → Developer settings → Personal access tokens → Fine-grained tokens**。
2. 点击 **Generate new token**。
3. **Repository access** 选择 `Only select repositories`，只勾选这个站点仓库。
4. **Permissions → Repository permissions** 找到 **Contents**，设置为 **Read and write**。
   - Metadata 会自动获得只读权限，保持默认即可。
5. 生成并复制令牌（`github_pat_...`）。

也可以使用经典令牌（Classic token），勾选 `repo` 权限，但权限范围更大，不推荐。

### 在网页中保存

1. 打开部署后的站点，点击右上角 **管理 → 发布设置**。
2. 填写：
   - GitHub 用户名 / 组织名
   - 仓库名（例如 `yourname.github.io`）
   - 分支（通常是 `main`）
   - 刚才创建的令牌
3. 点击 **测试连接**。成功后会显示仓库名称，并自动保存设置。
4. 之后在「个人信息」或「文档」中点击发布即可。

### 发布时会改哪些文件

| 内容 | 写入的仓库文件 |
| --- | --- |
| 个人简介 | `data/profile.json` |
| 文档正文 | `docs/<slug>.md` |
| 文档索引 | `docs/index.json` |

每次发布都会生成一条 Git commit。发布文档时，会先上传 Markdown，再更新索引。若索引更新失败，正文文件可能已经存在，重新点一次发布即可。

---

## 4. 日常使用

### 修改个人信息

1. 管理 → 个人信息。
2. 修改字段。简介支持 Markdown。
3. **保存本地草稿**：只会在当前浏览器生效，用于预览。
4. **发布简介**：提交到 GitHub，等待 Pages 更新。
5. 如果改坏了，点击 **恢复线上版本** 可以丢弃本地草稿。

头像使用图片 URL 即可。建议把头像图片放进仓库的 `assets/` 目录，然后填写完整地址，例如：

```
https://yourname.github.io/assets/avatar.jpg
```

### 添加一篇文档

1. 管理 → 文档 → 点击 `+`。
2. 填写标题，URL 标识会自动生成（中文标题会生成 `note-日期`，可以手动改）。
3. 写 Markdown，右侧实时预览。
4. 点击 **保存本地草稿** 预览，或直接 **发布文档**。
5. 文档会立即出现在主页「文档」区；读者可以点击卡片进入阅读页，链接形如：

```
https://yourname.github.io/#/doc/your-slug
```

### 编辑与下架

- 文档列表里点击任意一篇即可继续编辑。
- 对已发布文档点击「保存本地草稿」，会保留一份仅自己可见的修改；再次发布即可覆盖。
- 「下架文档」会从 `docs/index.json` 移除条目，并删除仓库里的 Markdown 文件。
- 「删除草稿」只删除当前浏览器的本地草稿，不影响线上内容。

### 图片与附件

当前版本的在线编辑器用于写 Markdown 文本，不提供图片上传。需要配图时：

1. 把图片放进仓库的 `assets/images/`（或任意目录）。
2. 在 Markdown 中写：

```markdown
![图片说明](./assets/images/example.jpg)
```

图片路径相对于站点根目录。

---

## 5. 内容文件格式

### `data/profile.json`

```json
{
  "name": "你的名字",
  "latin": "YOUR NAME",
  "role": "身份 / 专业",
  "status": "开放交流与合作",
  "headline": "一句话介绍",
  "location": "城市 · 国家",
  "email": "you@example.com",
  "github": "https://github.com/you",
  "avatar": "",
  "focus": ["方向一", "方向二"],
  "now": "最近在做什么",
  "intro": "支持 Markdown 的个人简介"
}
```

### `docs/index.json`

```json
{
  "updatedAt": "2026-11-09T10:00:00+08:00",
  "docs": [
    {
      "slug": "hello-world",
      "title": "文章标题",
      "summary": "文章摘要",
      "date": "2026-11-09",
      "tags": ["随笔"],
      "minutes": 3
    }
  ]
}
```

`docs` 中的每一项由网页编辑器自动维护。手动修改时请保持 JSON 合法；每篇文档还需要有对应的 `docs/<slug>.md`。

---

## 6. 文件结构

```text
.
├── index.html                  # 主页、阅读页、内容工作室
├── 404.html                    # GitHub Pages 404 页面
├── .nojekyll                   # 告诉 GitHub Pages 不要用 Jekyll
├── preview.cmd                 # Windows 一键本地预览
├── README.md
├── data/
│   └── profile.json            # 个人简介数据
├── docs/
│   ├── index.json              # 文档索引
│   ├── hello-world.md          # 示例文档
│   ├── markdown-guide.md
│   └── research-notes.md
└── assets/
    ├── favicon.svg
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js              # 页面渲染、路由、阅读页
    │   ├── studio.js           # 内容工作室
    │   ├── github.js           # GitHub Contents API
    │   ├── markdown.js         # Markdown 渲染与净化
    │   ├── store.js            # 本地草稿 / 设置存储
    │   ├── ui.js               # 提示、忙碌状态、剪贴板
    │   ├── utils.js
    │   └── seed.js             # 内容读取失败时的兜底数据
    └── vendor/
        ├── marked.min.js       # Markdown 解析（marked 12.0.2，MIT）
        ├── purify.min.js       # HTML 净化（DOMPurify 3.1.6，Apache-2.0 / MPL-2.0）
        ├── LICENSE-marked.md
        └── LICENSE-dompurify
```

Markdown 渲染库已经固定在 `assets/vendor/`，不依赖公共 CDN，因此国内网络或离线环境也能正常使用。升级方法见 `assets/vendor/README.md`。

---

## 7. 自定义外观

样式集中在 `assets/css/style.css` 顶部的 CSS 变量里：

```css
:root {
  --paper: #f3efe6;    /* 纸张底色 */
  --ink: #19251d;      /* 主文字 */
  --forest: #1d3a2a;   /* 深绿主色 */
  --clay: #a74b2e;     /* 陶土色强调 */
  ...
}
```

修改这些颜色即可整体换肤。字体使用系统自带的中文衬线 / 无衬线字体，不依赖字体 CDN。

需要修改页面标题、SEO 描述等，请编辑 `index.html` 的 `<head>`，以及 `assets/js/app.js` 中 `document.title` 的拼接逻辑。

---

## 8. 安全与限制

- **令牌只保存在当前浏览器**的 `localStorage` 中，请求只发往 `api.github.com`。它不会进入仓库，也不会发送到其他服务器。
- 不要把令牌写在代码里、截图里或公共电脑上。如果怀疑泄露，立即到 GitHub 撤销。
- 管理界面本身没有密码：任何访客都能打开它，但没有你的令牌就无法发布。请不要把令牌交给他人。
- 本地草稿、连接设置只存在于**当前浏览器**，换设备或清理浏览器数据后不会保留；线上内容以仓库为准。
- 当前版本不支持在线上传图片，也不支持多人同时编辑。两人同时发布文档时，理论上存在索引覆盖的时间窗口；个人站点通常不受影响。
- GitHub Pages 有缓存，发布后可能需要 1–2 分钟，或强制刷新（Ctrl/Cmd + Shift + R）才能看到更新。
- 这是纯静态站点，没有服务端鉴权。如果你需要真正的登录、多人协作或私密文档，应改用带后端的方案或 GitHub 的私有仓库 + 自建服务。

---

## 9. 从示例内容开始

建议的第一次修改顺序：

1. 管理 → 个人信息：替换名字、身份、邮箱、GitHub 地址、简介。
2. 管理 → 发布设置：连接自己的仓库。
3. 管理 → 文档：删除或改写三篇示例文章。
4. 编辑 `index.html` 中的 `<title>` 和 `<meta name="description">`（以及社交分享文案）。
5. 上传到 GitHub，开启 Pages。

如果只想完全手动管理，不用网页编辑器也可以：直接编辑 `data/profile.json`、`docs/*.md` 和 `docs/index.json`，然后 `git commit && git push` 即可。
