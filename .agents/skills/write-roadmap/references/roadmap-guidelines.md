# 路线图格式与质量标准

## YAML 结构

每个 `src/content/*.yaml` 文件定义一条路线图：

```yaml
id: database-engineering
title: 数据库工程路线图
description: 从数据建模到可靠地运行关系型数据库系统。
tags: [数据库, 后端]
nodes:
  - type: node
    id: relational-foundations
    title: 建立关系模型基础
    description: 使用表、键、约束与范式表达业务数据及其关系。
    tags: [关系模型, SQL]
    status: planned
    link: https://example.com/official-learning-page
    children:
      - type: node
        id: schema-design-practice
        title: 完成一次模式设计实践
        description: 从业务规则推导实体、关系、约束与索引，并评审设计取舍。
        tags: [实践]
        status: planned
      - type: roadmap
        roadmapId: backend
        title: 衔接后端开发
        description: 将数据库能力应用到服务端系统中。
```

### 路线图字段

- `id`：必填；在所有文件中唯一，使用 kebab-case。
- `title`：必填；使用清晰的中文主题名称。
- `description`：可选但推荐；一句话定义起点、终点或范围。
- `tags`：字符串数组；用于首页筛选。选择 2–5 个稳定、可复用的标签。
- `nodes`：节点或路线图引用数组。

### 普通节点

- `type: node`、`id`、`title` 必填。
- 同一路线图内所有层级的节点 `id` 必须唯一。
- `description`、`tags`、`status`、`link`、`children` 可选；解析器会为空数组和 `planned` 提供默认值，但新内容应显式写出 `status`。
- `status` 只能是 `planned`、`in-progress`、`completed`、`optional`。
- `link` 必须是合法的 `http` 或 `https` URL。
- `children` 可递归包含普通节点或路线图引用。

### 路线图引用

```yaml
- type: roadmap
  roadmapId: javascript
  title: 深入 JavaScript
  description: 可选的上下文说明。
```

- `roadmapId` 必须对应仓库中已存在的路线图 `id`。
- `title` 和 `description` 可选。标题应说明在当前路径中的作用，而非机械重复被引用路线图的标题。
- 引用可以出现在顶层或普通节点的 `children` 中，也允许循环引用；仅在学习语义合理时使用循环。
- 引用是跨路线图导航，不代表把被引用路线图的所有节点自动嵌入当前学习顺序。

## 路径设计检查表

完成前逐项检查：

- 目标：读者能从标题和描述判断学完后可以做什么。
- 起点：第一阶段没有依赖尚未引入的概念。
- 顺序：父子关系表达真实的阶段/从属关系，不只是视觉分组。
- 覆盖：概念、工具使用、实践、调试和质量保障形成闭环。
- 粒度：相邻节点大小相近；没有一个节点吞下半个领域，也没有微小语法点泛滥。
- 可验证：关键阶段包含能观察成果的练习、项目或验收目标。
- 分支：框架、平台和高级专题等非必需分支标为 `optional`。
- 复用：已有语言或领域路线图通过引用衔接，内容不重复维护。
- 时效：易变化的推荐已通过当前官方资料核实，措辞避免无依据的版本锁定。
- 链接：每个链接主题匹配、可访问、来源可靠；一个节点通常最多保留一个主链接。
- 文案：描述具体、平行、简洁，无“等等”“相关内容”“全面掌握”等不可验证表述。

## 研究与取舍

先列出该主题的稳定知识核心，再识别生态中会变化或存在争议的部分。稳定核心进入主线；具体框架、供应商或专业方向通常进入选修分支。若用户指定岗位、考试、版本或技术栈，则以该目标为边界，并在路线图描述或交付说明中写明。

资料冲突时，优先级依次为：正式标准或规范、官方维护方文档、官方教程、权威教育资料。社区资料只用于发现缺口或补充实践视角，不以热度代替准确性。

