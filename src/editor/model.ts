import { dump } from 'js-yaml'
import type { NodeStatus } from '../types'

export type EditorNode = {
  type: 'node'
  _key: string
  id: string
  title: string
  description?: string
  tags: string[]
  status: NodeStatus
  link?: string
  children: EditorChild[]
}

export type EditorReference = {
  type: 'roadmap'
  _key: string
  roadmapId: string
  title?: string
  description?: string
}

export type EditorChild = EditorNode | EditorReference

export type EditorRoadmap = {
  id: string
  title: string
  description?: string
  tags: string[]
  nodes: EditorChild[]
}

export type EditorFile = {
  filename: string
  document: EditorRoadmap
  savedSnapshot: string
  isNew?: boolean
}

let keySequence = 0
export const createKey = () => `editor-${Date.now().toString(36)}-${(keySequence++).toString(36)}`

export function hydrateChild(value: Record<string, unknown>): EditorChild {
  if (value.type === 'roadmap') {
    return {
      type: 'roadmap',
      _key: createKey(),
      roadmapId: typeof value.roadmapId === 'string' ? value.roadmapId : '',
      ...(typeof value.title === 'string' && value.title ? { title: value.title } : {}),
      ...(typeof value.description === 'string' && value.description ? { description: value.description } : {}),
    }
  }
  return {
    type: 'node',
    _key: createKey(),
    id: typeof value.id === 'string' ? value.id : '',
    title: typeof value.title === 'string' ? value.title : '',
    ...(typeof value.description === 'string' && value.description ? { description: value.description } : {}),
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    status: ['planned', 'in-progress', 'completed', 'optional'].includes(String(value.status)) ? value.status as NodeStatus : 'planned',
    ...(typeof value.link === 'string' && value.link ? { link: value.link } : {}),
    children: Array.isArray(value.children) ? value.children.map((child) => hydrateChild(child as Record<string, unknown>)) : [],
  }
}

export function hydrateRoadmap(value: unknown): EditorRoadmap {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    id: typeof data.id === 'string' ? data.id : '',
    title: typeof data.title === 'string' ? data.title : '',
    ...(typeof data.description === 'string' && data.description ? { description: data.description } : {}),
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    nodes: Array.isArray(data.nodes) ? data.nodes.map((child) => hydrateChild(child as Record<string, unknown>)) : [],
  }
}

export function stripEditorState(document: EditorRoadmap): Record<string, unknown> {
  const stripChild = (child: EditorChild): Record<string, unknown> => child.type === 'roadmap'
    ? {
        type: 'roadmap',
        roadmapId: child.roadmapId,
        ...(child.title?.trim() ? { title: child.title.trim() } : {}),
        ...(child.description?.trim() ? { description: child.description.trim() } : {}),
      }
    : {
        type: 'node',
        id: child.id,
        title: child.title,
        ...(child.description?.trim() ? { description: child.description.trim() } : {}),
        ...(child.tags.length ? { tags: child.tags } : {}),
        ...(child.status !== 'planned' ? { status: child.status } : {}),
        ...(child.link?.trim() ? { link: child.link.trim() } : {}),
        ...(child.children.length ? { children: child.children.map(stripChild) } : {}),
      }

  return {
    id: document.id,
    title: document.title,
    ...(document.description?.trim() ? { description: document.description.trim() } : {}),
    ...(document.tags.length ? { tags: document.tags } : {}),
    ...(document.nodes.length ? { nodes: document.nodes.map(stripChild) } : { nodes: [] }),
  }
}

export function snapshot(document: EditorRoadmap) {
  return JSON.stringify(stripEditorState(document))
}

export function toYaml(document: EditorRoadmap) {
  return dump(stripEditorState(document), { noRefs: true, lineWidth: 100 })
}

export function findChild(children: EditorChild[], key: string): EditorChild | undefined {
  for (const child of children) {
    if (child._key === key) return child
    if (child.type === 'node') {
      const nested = findChild(child.children, key)
      if (nested) return nested
    }
  }
}

export function updateChild(children: EditorChild[], key: string, update: (child: EditorChild) => EditorChild): EditorChild[] {
  return children.map((child) => {
    if (child._key === key) return update(child)
    if (child.type === 'node') return { ...child, children: updateChild(child.children, key, update) }
    return child
  })
}

export function removeChild(children: EditorChild[], key: string): { children: EditorChild[]; removed?: EditorChild } {
  let removed: EditorChild | undefined
  const next: EditorChild[] = []
  for (const child of children) {
    if (child._key === key) {
      removed = child
      continue
    }
    if (child.type === 'node') {
      const nested = removeChild(child.children, key)
      if (nested.removed) {
        removed = nested.removed
        next.push({ ...child, children: nested.children })
        continue
      }
    }
    next.push(child)
  }
  return { children: next, removed }
}

export function containsKey(child: EditorChild, key: string): boolean {
  return child._key === key || (child.type === 'node' && child.children.some((nested) => containsKey(nested, key)))
}

export type DropPosition = 'before' | 'inside' | 'after'

function slugify(value: string) {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-|-$/g, '')
  return slug || 'new-node'
}

export function convertChildType(child: EditorChild, type: EditorChild['type'], defaultRoadmapId = ''): EditorChild {
  if (child.type === type) return child
  if (child.type === 'node' && type === 'roadmap') {
    return {
      type: 'roadmap',
      _key: child._key,
      roadmapId: defaultRoadmapId,
      ...(child.title.trim() ? { title: child.title } : {}),
      ...(child.description?.trim() ? { description: child.description } : {}),
    }
  }
  if (child.type === 'roadmap' && type === 'node') {
    const title = child.title?.trim() || child.roadmapId || '新知识节点'
    return {
      type: 'node',
      _key: child._key,
      id: slugify(child.roadmapId || title),
      title,
      ...(child.description?.trim() ? { description: child.description } : {}),
      tags: [],
      status: 'planned',
      children: [],
    }
  }
  return child
}

export function moveChild(children: EditorChild[], draggedKey: string, targetKey: string, position: DropPosition): EditorChild[] {
  if (draggedKey === targetKey) return children
  const dragged = findChild(children, draggedKey)
  const target = findChild(children, targetKey)
  if (!dragged || !target || containsKey(dragged, targetKey) || (position === 'inside' && target.type !== 'node')) return children
  const removed = removeChild(children, draggedKey)
  if (!removed.removed) return children

  if (position === 'inside') {
    return updateChild(removed.children, targetKey, (child) => child.type === 'node'
      ? { ...child, children: [...child.children, removed.removed!] }
      : child)
  }

  const insertBeside = (items: EditorChild[]): EditorChild[] => {
    const result: EditorChild[] = []
    for (const item of items) {
      if (item._key === targetKey && position === 'before') result.push(removed.removed!)
      if (item.type === 'node') result.push({ ...item, children: insertBeside(item.children) })
      else result.push(item)
      if (item._key === targetKey && position === 'after') result.push(removed.removed!)
    }
    return result
  }
  return insertBeside(removed.children)
}

export function validateRoadmap(document: EditorRoadmap, otherIds: string[]) {
  const errors: string[] = []
  if (!/^[a-z0-9][a-z0-9-]*$/.test(document.id)) errors.push('路线 ID 只能包含小写字母、数字和连字符。')
  if (!document.title.trim()) errors.push('路线标题不能为空。')
  if (otherIds.includes(document.id)) errors.push(`路线 ID “${document.id}” 已存在。`)
  const ids = new Set<string>()
  const visit = (children: EditorChild[]) => children.forEach((child) => {
    if (child.type === 'roadmap') {
      if (!child.roadmapId.trim()) errors.push('路线引用不能为空。')
      return
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(child.id)) errors.push(`节点 “${child.title || '未命名'}” 的 ID 格式无效。`)
    if (ids.has(child.id)) errors.push(`节点 ID “${child.id}” 重复。`)
    ids.add(child.id)
    if (!child.title.trim()) errors.push(`节点 “${child.id || '未命名'}” 缺少标题。`)
    if (child.link && !/^https?:\/\//.test(child.link)) errors.push(`节点 “${child.title || child.id}” 的链接必须使用 http 或 https。`)
    visit(child.children)
  })
  visit(document.nodes)
  return [...new Set(errors)]
}
