import { describe, expect, it } from 'vitest'
import { convertChildType, hydrateRoadmap, moveChild, snapshot, stripEditorState, validateRoadmap } from './model'

describe('editor model', () => {
  const roadmap = () => hydrateRoadmap({
    id: 'demo', title: 'Demo', nodes: [
      { type: 'node', id: 'one', title: 'One', children: [{ type: 'node', id: 'child', title: 'Child' }] },
      { type: 'node', id: 'two', title: 'Two' },
      { type: 'roadmap', roadmapId: 'other' },
    ],
  })

  it('moves nodes before, after, and inside other nodes', () => {
    const document = roadmap()
    const [one, two, reference] = document.nodes
    expect(one && two && reference).toBeTruthy()
    const inside = moveChild(document.nodes, two!._key, one!._key, 'inside')
    expect(inside).toHaveLength(2)
    expect(inside[0]).toMatchObject({ type: 'node', children: [{ id: 'child' }, { id: 'two' }] })
    const before = moveChild(inside, reference!._key, one!._key, 'before')
    expect(before[0]).toMatchObject({ type: 'roadmap', roadmapId: 'other' })
  })

  it('does not allow moving a parent inside its descendant', () => {
    const document = roadmap()
    const parent = document.nodes[0]!
    const child = parent.type === 'node' ? parent.children[0]! : parent
    expect(moveChild(document.nodes, parent._key, child._key, 'inside')).toBe(document.nodes)
  })

  it('strips internal keys and produces stable snapshots', () => {
    const document = roadmap()
    const output = stripEditorState(document)
    expect(JSON.stringify(output)).not.toContain('_key')
    expect(snapshot(document)).toBe(JSON.stringify(output))
  })

  it('validates IDs, duplicate node IDs, and links', () => {
    const document = roadmap()
    if (document.nodes[1]?.type === 'node') {
      document.nodes[1].id = 'one'
      document.nodes[1].link = 'ftp://example.com'
    }
    const errors = validateRoadmap(document, ['demo'])
    expect(errors.join(' ')).toMatch(/已存在|重复|http/)
  })

  it('converts between knowledge nodes and roadmap references', () => {
    const document = roadmap()
    const node = document.nodes[0]!
    const reference = convertChildType(node, 'roadmap', 'java')
    expect(reference).toMatchObject({ type: 'roadmap', roadmapId: 'java', title: 'One' })
    expect(reference._key).toBe(node._key)
    const convertedBack = convertChildType(reference, 'node')
    expect(convertedBack).toMatchObject({ type: 'node', id: 'java', title: 'One', status: 'planned', children: [] })
  })
})
