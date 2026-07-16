import { load } from 'js-yaml'
import { z } from 'zod'
import { statuses, type CatalogResult, type Roadmap, type RoadmapCatalog, type RoadmapChild, type RoadmapNode, type RoadmapReference } from './types'

const httpUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === 'http:' || protocol === 'https:'
}, '链接仅支持 http 或 https')

const referenceSchema = z.object({
  type: z.literal('roadmap'),
  roadmapId: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
})

const childSchema = z.lazy(() => z.discriminatedUnion('type', [nodeSchema, referenceSchema])) as z.ZodType<RoadmapChild>

const nodeSchema = z.object({
  type: z.literal('node'),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  status: z.enum(statuses).default('planned'),
  link: httpUrl.optional(),
  children: z.array(childSchema).default([]),
})

const roadmapSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  nodes: z.array(childSchema).default([]),
})

function printablePath(path: PropertyKey[]) {
  return path.length ? path.map(String).join('.') : '根节点'
}

function collectReferences(children: RoadmapChild[], result = new Set<string>()) {
  for (const child of children) {
    if (child.type === 'roadmap') result.add(child.roadmapId)
    else collectReferences(child.children, result)
  }
  return result
}

function validateNodeIds(roadmap: Roadmap, errors: string[]) {
  const seen = new Set<string>()
  const visit = (children: RoadmapChild[]) => {
    for (const child of children) {
      if (child.type === 'node') {
        if (seen.has(child.id)) errors.push(`${roadmap.source}: 路线图 “${roadmap.id}” 中存在重复节点 ID “${child.id}”`)
        seen.add(child.id)
        visit(child.children)
      }
    }
  }
  visit(roadmap.nodes)
}

function validateGraph(roadmaps: Map<string, Roadmap>, errors: string[]) {
  for (const roadmap of roadmaps.values()) {
    const refs = collectReferences(roadmap.nodes)
    for (const id of refs) {
      if (!roadmaps.has(id)) errors.push(`${roadmap.source}: 引用了不存在的路线图 “${id}”`)
    }
  }
}

export function parseRoadmaps(files: Record<string, string>): CatalogResult {
  const errors: string[] = []
  const roadmaps = new Map<string, Roadmap>()

  for (const [source, raw] of Object.entries(files)) {
    try {
      const parsed = roadmapSchema.safeParse(load(raw))
      if (!parsed.success) {
        for (const issue of parsed.error.issues) errors.push(`${source} · ${printablePath(issue.path)}: ${issue.message}`)
        continue
      }
      if (roadmaps.has(parsed.data.id)) {
        errors.push(`${source}: 路线图 ID “${parsed.data.id}” 与 ${roadmaps.get(parsed.data.id)?.source} 重复`)
        continue
      }
      roadmaps.set(parsed.data.id, { ...parsed.data, source })
    } catch (error) {
      errors.push(`${source}: ${error instanceof Error ? error.message : '无法解析 YAML'}`)
    }
  }

  for (const roadmap of roadmaps.values()) validateNodeIds(roadmap, errors)
  validateGraph(roadmaps, errors)
  if (errors.length) return { ok: false, errors }

  const roots = [...roadmaps.values()]
  roots.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  return { ok: true, catalog: { roadmaps, roots } satisfies RoadmapCatalog }
}

export function referencesRoadmap(roadmap: Roadmap, targetId: string) {
  return collectReferences(roadmap.nodes).has(targetId)
}

const yamlFiles = import.meta.glob('./content/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const contentResult = parseRoadmaps(yamlFiles)
