# AGENTS.md — Request Hacker

> 本文件面向 AI 编程助手。阅读者应对本项目一无所知，所有信息均基于项目实际内容整理。

## 项目概览

Request Hacker 是一个基于 **Chrome Manifest V3** 的浏览器扩展，用于在前端层面拦截 `fetch` 和 `XMLHttpRequest` 请求并替换返回数据。它无需修改后端接口，主要用于本地开发、前后端联调、Mock 数据等场景。

- 扩展名称：`request-hacker`
- 版本：`1.0.0`
- 清单版本：Manifest V3
- 自然语言：项目文档、注释、UI 文本均为简体中文

## 技术栈

- 纯原生 JavaScript（无框架、无构建工具）
- Chrome Extension Manifest V3
- Chrome Storage API（`chrome.storage.local`）持久化规则
- Content Script + MAIN world 注入脚本实现请求拦截
- 原生 DOM 操作渲染配置页面和弹窗

**注意：本项目没有 `package.json`、没有构建工具链、没有测试框架、没有 CI/CD 配置。** 所有代码均为可直接在浏览器中运行的静态文件。

## 文件结构

```
request-hacker/
├── manifest.json        # 扩展清单（MV3）
├── background.js        # Service Worker：监听安装事件与 storage 变更并广播
├── content.js           # 隔离世界脚本：作为 storage 与页面脚本之间的桥接
├── injected.js          # MAIN world 注入脚本：重写 fetch / XMLHttpRequest
├── options.html         # 配置页面（规则管理）
├── options.js           # 配置页面逻辑
├── styles/
│   └── options.css      # 配置页面样式
├── popup.html           # 工具栏弹窗页面
├── popup.js             # 弹窗逻辑
├── icon16.png           # 扩展图标
├── icon48.png
└── icon128.png
```

## 运行时架构

扩展包含三个运行环境，通过消息和 storage 事件协作：

1. **Service Worker（`background.js`）**
   - 监听 `chrome.runtime.onInstalled`。
   - 监听 `chrome.storage.onChanged`，当规则变化时向所有标签页发送 `RULES_UPDATED` 消息。

2. **隔离世界 Content Script（`content.js`）**
   - 通过 `chrome.storage.local` 读取规则。
   - 通过 `window.postMessage` 将规则同步到页面的 MAIN world。
   - 初次加载时多次重试同步（最多 5 次，间隔 100ms），以解决注入脚本时序问题。
   - 监听来自 MAIN world 的 `REQUEST_RULES` 消息，重新拉取规则。

3. **MAIN world 注入脚本（`injected.js`）**
   - 在页面加载开始时以 `world: "MAIN"` 注入。
   - 保存原始 `window.fetch` 和 `window.XMLHttpRequest`。
   - 根据规则匹配 URL，命中时直接返回配置的 JSON 数据，不发送真实请求。
   - 启动时通过 `postMessage` 请求规则。

规则匹配使用通配符 `*`，内部转换为正则表达式 `.*` 进行匹配。

## 数据模型

规则存储在 `chrome.storage.local` 的键 `rh_rules` 中，结构为数组，每个规则对象：

```js
{
  name: '规则名称',
  enabled: true,
  urlPattern: '*/api/example',
  responses: [
    { id: 'resp_xxx', name: '默认', content: '{"code": 200}' }
  ],
  selectedResponseId: 'resp_xxx'
}
```

- 旧版本使用单条 `response` 字符串，`options.js` 会自动迁移为 `responses` 数组。
- 导入时按 `name` 判断：同名覆盖，不同名追加。

## 安装与运行

### 开发者模式加载

1. 打开 Chrome 扩展管理页面：`chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目根目录

### 没有构建步骤

由于项目没有构建工具，保存代码后直接在扩展管理页面点击刷新按钮即可生效。

## 代码组织

| 文件 | 职责 |
|------|------|
| `manifest.json` | 声明权限、脚本入口、页面入口、图标 |
| `background.js` | 极简 Service Worker，仅做规则变更广播 |
| `content.js` | storage 桥接，向 MAIN world 同步规则 |
| `injected.js` | 核心拦截逻辑，覆盖 `fetch` / `XMLHttpRequest` |
| `options.js` / `options.html` | 规则 CRUD、多响应配置、导入/导出、全屏编辑 |
| `popup.js` / `popup.html` | 快速开关规则、切换响应配置、打开配置页 |
| `styles/options.css` | 配置页样式 |

## 代码风格约定

- 使用原生 JavaScript，不引入框架。
- 字符串优先使用单引号。
- IIFE 包裹注入脚本，避免污染全局作用域。
- 注释使用中文，格式如 `// 内容`。
- DOM 操作直接通过 `document.getElementById` 获取元素。
- 按钮颜色语义：
  - 蓝色（`#1976d2`）：主要操作 / 启用状态
  - 绿色（`#4caf50`）：保存成功
  - 橙色（`#ff9800`）：未保存提示
  - 红色（`#e53935`）：删除 / 危险操作

## 修改代码时的注意事项

- `injected.js` 运行在页面主世界，**不要依赖 Chrome 扩展 API**，只能通过 `postMessage` 与 `content.js` 通信。
- `content.js` 运行在隔离世界，**不要直接访问页面 JavaScript 变量**，只通过 `postMessage` 通信。
- 修改 `manifest.json` 后可能需要重新加载扩展。
- 修改规则结构时，请在 `options.js` 的 `loadRules` 中保持对旧数据的兼容迁移。
- 拦截的响应目前固定返回 HTTP 200、`Content-Type: application/json`、`X-Request-Hacker: true` 头。

## 测试策略

项目目前没有自动化测试。验证方式：

1. 在 Chrome 中加载扩展。
2. 打开 `options.html` 创建规则，配置 URL 通配符和 JSON 响应。
3. 访问匹配的网站，通过浏览器开发者工具观察网络请求被拦截。
4. 在 `popup.html` 中切换规则开关和响应配置，确认页面刷新后生效。
5. 导入/导出 JSON 文件，验证增量合并逻辑。

## 安全与合规

- 扩展声明了 `host_permissions: ["<all_urls>"]`，可以匹配任意网站，但拦截行为只在本地生效。
- 规则数据仅保存在 `chrome.storage.local`，不上传服务器。
- 注入脚本在 MAIN world 中重写 `fetch` / `XMLHttpRequest`，仅用于开发调试，**不应用于生产环境作弊或绕过安全校验**。
- `content.js` 中 `postMessage` 使用 `'*'` 作为目标源，接受来自页面的消息时严格校验 `event.source === window` 和 `event.data.source === 'request-hacker-injected'`。

## 部署

无需打包部署。发布到 Chrome Web Store 时，将项目目录压缩为 ZIP 文件后上传即可。

## 许可证

MIT
