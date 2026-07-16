export const statuses = ['planned', 'in-progress', 'completed', 'optional'] as const

export type NodeStatus = (typeof statuses)[number]

export interface RoadmapNode {
  type: 'node'
  id: string
  title: string
  description?: string
  status: NodeStatus
  link?: string
  children: RoadmapChild[]
}

export interface RoadmapReference {
  type: 'roadmap'
  roadmapId: string
  title?: string
  description?: string
}

export type RoadmapChild = RoadmapNode | RoadmapReference

export interface Roadmap {
  id: string
  title: string
  description?: string
  nodes: RoadmapChild[]
  source: string
}

export interface RoadmapCatalog {
  roadmaps: Map<string, Roadmap>
  roots: Roadmap[]
}

export type CatalogResult =
  | { ok: true; catalog: RoadmapCatalog }
  | { ok: false; errors: string[] }
