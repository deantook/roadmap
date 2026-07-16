# YAML 路线图

一个由仓库内 YAML 文件驱动的响应式路线图网站。普通节点以纵向树状结构展示，路线图引用可进入独立页面。
每个有效的 YAML 文件都会作为一条主路线图显示在首页，即使它同时被其他路线图引用。

## 开始使用

```bash
npm install
npm run dev
```

生产检查：

```bash
npm test
npm run build
```

## 添加路线图

在 `src/content` 中新增 `.yaml` 文件。每条路线图必须有唯一的 `id` 和 `title`：

```yaml
id: example
title: 示例路线图
description: 可选说明
tags: [前端, 入门]
nodes:
  - type: node
    id: first-step
    title: 第一步
    description: 可选说明
    tags: [HTML, 基础]
    status: planned
    link: https://example.com
    children:
      - type: roadmap
        roadmapId: another-roadmap
        title: 进入另一条路线图
```

路线图与普通节点都可以配置 `tags` 字符串数组。路线图标签会用于首页卡片和标签筛选；节点标签会显示在路线卡片与详情抽屉中，也会被全局搜索索引。未配置时默认为空数组。

节点状态可选值为 `planned`、`in-progress`、`completed`、`optional`，省略时为 `planned`。路线图引用必须指向另一个 YAML 中存在的 `id`；允许路线之间循环引用，例如 Dart 与 Flutter 可以互相提供跳转入口。

页面中的状态标签可以点击切换。用户选择会以路线图 ID 和节点 ID 为键保存在浏览器 `localStorage` 中；YAML 中的 `status` 是尚未保存用户状态时的默认值。普通节点依次在 `planned`、`in-progress`、`completed` 之间切换，选修节点在 `optional` 与 `completed` 之间切换。
