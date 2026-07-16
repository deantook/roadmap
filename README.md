# Roadmap

一个由 YAML 内容驱动的交互式学习路线图网站。路线内容与界面代码解耦：在 `src/content` 中维护 YAML，即可自动生成可搜索、可嵌套、可追踪进度的学习路线。

[查看源码](https://github.com/deantook/roadmap) · [添加路线图](#添加或修改路线图) · [数据格式](#yaml-数据格式)

## 功能特性

- **YAML 驱动**：每个有效的 `src/content/*.yaml` 文件都会成为首页中的一条路线图。
- **路线发现**：支持按关键词搜索、按主题标签筛选，并自动统计路线、节点与标签数量。
- **树状学习路径**：节点可无限嵌套、折叠或展开，也可以引用另一条路线图形成导航关系。
- **学习详情**：节点支持说明、标签、外部学习资源，以及描述中的 Markdown 围栏代码块。
- **进度追踪**：可在待开始、进行中、已完成之间切换；选修节点可在选修与已完成之间切换。
- **本地持久化**：学习进度和明暗主题保存在浏览器 `localStorage`，无需账号或后端服务。
- **可视化编辑器**：支持新建路线、编辑字段、拖拽排序与嵌套、引用路线、复制/删除节点及 YAML 预览。
- **内容校验**：启动时检查 YAML 结构、重复 ID、无效链接和不存在的路线引用，并在页面中显示明确错误。
- **响应式界面**：适配桌面与移动端，支持浅色和深色主题。

## 技术栈

- React 19、TypeScript、React Router
- Vite 8
- js-yaml、Zod
- Vitest、Testing Library

## 快速开始

### 环境要求

- Node.js（建议使用当前 LTS 版本）
- npm

### 安装与运行

```bash
git clone https://github.com/deantook/roadmap.git
cd roadmap
npm install
npm run dev
```

按照终端提示打开本地地址即可浏览路线图。

### 可视化编辑路线图

```bash
npm run editor
```

该命令会打开独立编辑器并读取 `src/content/*.yaml`。保存按钮或 `⌘S`（Windows/Linux 使用 `Ctrl+S`）会直接写回对应 YAML 文件。

> [!IMPORTANT]
> 编辑器具备本地文件的新增、覆盖和删除能力，使用前建议通过 Git 保存当前修改。文件读写 API 只在 `editor` 模式下启用，不会进入生产构建。

### 检查与构建

```bash
# 运行全部测试
npm test

# 监听文件变化运行测试
npm run test:watch

# 执行 TypeScript 检查并生成生产文件
npm run build

# 本地预览生产构建
npm run preview
```

构建产物输出到 `dist/`。

## 添加或修改路线图

有两种维护方式：

1. 运行 `npm run editor`，通过可视化界面编辑并保存。
2. 直接新增或修改 `src/content/*.yaml`，再运行测试和构建检查。

最小可用路线图如下：

```yaml
id: example
title: 示例路线图
nodes: []
```

一个包含普通节点、嵌套节点和路线引用的完整示例：

````yaml
id: example
title: 示例路线图
description: 从基础知识逐步进入实际应用。
tags: [示例, 入门]
nodes:
  - type: node
    id: fundamentals
    title: 掌握基础知识
    description: |
      理解核心概念并完成一个最小示例。

      ```bash
      npm run dev
      ```
    tags: [基础]
    status: in-progress
    link: https://example.com/guide
    children:
      - type: node
        id: practice
        title: 完成练习
        status: optional
  - type: roadmap
    roadmapId: frontend
    title: 继续学习前端路线
    description: 可选的引用标题和说明。
````

## YAML 数据格式

### 路线图字段

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 是 | `string` | 路线图唯一标识。推荐使用小写字母、数字和连字符，并与文件名保持一致。 |
| `title` | 是 | `string` | 路线图名称。 |
| `description` | 否 | `string` | 路线图简介。 |
| `tags` | 否 | `string[]` | 首页卡片展示和标签筛选使用；默认为空数组。 |
| `nodes` | 否 | `RoadmapChild[]` | 顶层节点或路线引用；默认为空数组。 |

### 普通节点字段

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `type` | 是 | `node` | 固定值。 |
| `id` | 是 | `string` | 当前路线图内唯一的节点标识，也用于 `#node-<id>` 锚点链接。 |
| `title` | 是 | `string` | 节点名称。 |
| `description` | 否 | `string` | 节点详情；支持普通段落和 Markdown 围栏代码块。 |
| `tags` | 否 | `string[]` | 节点卡片和详情中的标签；默认为空数组。 |
| `status` | 否 | `NodeStatus` | 默认状态；省略时为 `planned`。 |
| `link` | 否 | `string` | 学习资源地址，仅支持 `http` 或 `https`。 |
| `children` | 否 | `RoadmapChild[]` | 子节点或路线引用；默认为空数组。 |

`NodeStatus` 可选值：

| 值 | 页面显示 | 用户切换顺序 |
| --- | --- | --- |
| `planned` | 待开始 | 待开始 → 进行中 → 已完成 |
| `in-progress` | 进行中 | 待开始 → 进行中 → 已完成 |
| `completed` | 已完成 | 循环回到该节点所属序列的起点 |
| `optional` | 选修 | 选修 ↔ 已完成 |

YAML 中的 `status` 只是默认状态。当用户在页面中切换状态后，浏览器会以 `<roadmapId>:<nodeId>` 为键保存其选择，并优先使用本地记录。

### 路线引用字段

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `type` | 是 | `roadmap` | 固定值。 |
| `roadmapId` | 是 | `string` | 被引用路线图的 `id`，目标必须存在。 |
| `title` | 否 | `string` | 覆盖引用卡片上显示的标题。 |
| `description` | 否 | `string` | 覆盖引用卡片上显示的说明。 |

所有有效 YAML 都会显示在首页，即使它同时被其他路线引用。路线之间允许循环引用，但页面路径中的每一层都必须是上一条路线的直接引用关系。

## 内容校验规则

应用加载内容时会检查：

- YAML 是否能被正确解析，字段类型是否符合数据结构。
- 路线图 `id` 在所有文件中是否唯一。
- 普通节点 `id` 在所属路线图中是否唯一，包括所有嵌套层级。
- `status` 是否为支持的状态值。
- `link` 是否为合法的 HTTP(S) URL。
- `roadmapId` 指向的路线图是否存在。

校验失败时，应用会展示包含文件名和字段路径的错误页面；修正内容后再运行 `npm test` 和 `npm run build` 完成验证。

## 项目结构

```text
.
├── src/
│   ├── content/          # YAML 路线图内容
│   ├── editor/           # 可视化编辑器界面、模型和样式
│   ├── App.tsx           # 首页、路线详情、进度和主题交互
│   ├── data.ts           # YAML 加载、解析与跨文件校验
│   ├── types.ts          # 路线图数据类型
│   └── styles.css        # 主站样式
├── editor.html           # 编辑器入口
├── index.html            # 主站入口
├── vite.config.ts        # Vite、Vitest 与本地编辑器 API
└── package.json
```

## 工作原理

1. Vite 在构建时以原始文本导入 `src/content/*.yaml`。
2. `js-yaml` 解析内容，Zod 校验字段并补全默认值。
3. 应用继续检查跨文件路线引用及重复 ID。
4. React 根据内容生成首页卡片、树状节点和嵌套路由。
5. 用户主题和学习进度只保存在当前浏览器，不会修改 YAML。

## 贡献指南

1. Fork 仓库并创建功能分支。
2. 修改代码或在 `src/content` 中完善路线图。
3. 确保新增 ID 唯一、外部资源可靠，并尽量优先引用官方文档。
4. 运行 `npm test` 和 `npm run build`。
5. 提交 Pull Request，并说明修改内容和验证方式。

如果只是修正文案、补充资源或完善一条学习路径，也非常欢迎直接提交贡献。
