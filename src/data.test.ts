import { describe, expect, it } from 'vitest'
import { parseRoadmaps, referencesRoadmap } from './data'

const valid = `
id: main
title: 主路线
nodes:
  - type: node
    id: start
    title: 开始
    children:
      - type: roadmap
        roadmapId: child
`

const child = `
id: child
title: 子路线
nodes:
  - type: node
    id: next
    title: 下一步
    link: https://example.com
`

describe('parseRoadmaps', () => {
  it('parses defaults and lists every roadmap on the home page', () => {
    const result = parseRoadmaps({ 'main.yaml': valid, 'child.yaml': child })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(new Set(result.catalog.roots.map(({ id }) => id))).toEqual(new Set(['main', 'child']))
    const main = result.catalog.roadmaps.get('main')!
    expect(main.nodes[0]).toMatchObject({ type: 'node', status: 'planned', tags: [] })
    expect(main.tags).toEqual([])
    expect(referencesRoadmap(main, 'child')).toBe(true)
  })

  it('parses roadmap and node tags', () => {
    const result = parseRoadmaps({
      'tags.yaml': 'id: tags\ntitle: 标签路线\ntags: [前端, Web]\nnodes:\n  - { type: node, id: css, title: CSS, tags: [样式] }',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const roadmap = result.catalog.roadmaps.get('tags')!
    expect(roadmap.tags).toEqual(['前端', 'Web'])
    expect(roadmap.nodes[0]).toMatchObject({ tags: ['样式'] })
  })

  it('reports malformed YAML with its filename', () => {
    const result = parseRoadmaps({ 'broken.yaml': 'id: [unterminated' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('broken.yaml')
  })

  it('rejects duplicate roadmap and node IDs', () => {
    const duplicateNodes = `id: same\ntitle: One\nnodes:\n  - { type: node, id: x, title: X }\n  - { type: node, id: x, title: X again }`
    const result = parseRoadmaps({ 'one.yaml': duplicateNodes, 'two.yaml': 'id: same\ntitle: Two' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join(' ')).toMatch(/重复节点 ID|路线图 ID/)
  })

  it('rejects missing and cyclic references', () => {
    const missing = parseRoadmaps({ 'main.yaml': valid })
    expect(missing.ok).toBe(false)
    const cyclic = parseRoadmaps({
      'a.yaml': 'id: a\ntitle: A\nnodes:\n  - { type: roadmap, roadmapId: b }',
      'b.yaml': 'id: b\ntitle: B\nnodes:\n  - { type: roadmap, roadmapId: a }',
    })
    expect(cyclic.ok).toBe(false)
    if (cyclic.ok) return
    expect(cyclic.errors.join(' ')).toContain('循环引用')
  })

  it('rejects unsupported statuses and URL protocols', () => {
    const result = parseRoadmaps({
      'bad.yaml': 'id: bad\ntitle: Bad\nnodes:\n  - { type: node, id: x, title: X, status: later, link: ftp://example.com }',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join(' ')).toContain('nodes.0.status')
  })
})
