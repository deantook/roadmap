import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { contentResult, referencesRoadmap } from './data'
import type { NodeStatus, Roadmap, RoadmapCatalog, RoadmapChild, RoadmapNode, RoadmapReference } from './types'

const statusLabels: Record<NodeStatus, string> = {
  planned: '待开始',
  'in-progress': '进行中',
  completed: '已完成',
  optional: '选修',
}

const progressStorageKey = 'roadmap-node-statuses:v1'

function readProgress() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')
    return value && typeof value === 'object' ? value as Record<string, NodeStatus> : {}
  } catch {
    return {}
  }
}

function resolvedNodeStatus(progress: Record<string, NodeStatus>, roadmapId: string, node: RoadmapNode) {
  const status = progress[`${roadmapId}:${node.id}`]
  return status && status in statusLabels ? status : node.status
}

function saveNodeStatus(roadmapId: string, nodeId: string, status: NodeStatus) {
  try {
    const progress = readProgress()
    progress[`${roadmapId}:${nodeId}`] = status
    localStorage.setItem(progressStorageKey, JSON.stringify(progress))
  } catch {
    // 浏览器禁止持久化时，当前页面中的状态仍可正常更新。
  }
}

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('roadmap-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function ThemeButton() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('roadmap-theme', theme)
  }, [theme])

  return (
    <button
      className="icon-button"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={`切换为${theme === 'light' ? '深色' : '浅色'}主题`}
      title={`切换为${theme === 'light' ? '深色' : '浅色'}主题`}
    >
      {theme === 'light' ? '◐' : '☀'}
    </button>
  )
}

interface SearchEntry {
  node: RoadmapNode
  roadmap: Roadmap
}

function buildSearchEntries(catalog: RoadmapCatalog) {
  const entries: SearchEntry[] = []
  const visit = (roadmap: Roadmap, children: RoadmapChild[]) => {
    for (const child of children) {
      if (child.type === 'node') {
        entries.push({ node: child, roadmap })
        visit(roadmap, child.children)
      }
    }
  }
  for (const roadmap of catalog.roadmaps.values()) visit(roadmap, roadmap.nodes)
  return entries
}

function Search({ catalog }: { catalog: RoadmapCatalog }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const entries = useMemo(() => buildSearchEntries(catalog), [catalog])
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  const results = normalized
    ? entries.filter(({ node }) => `${node.title} ${node.description ?? ''}`.toLocaleLowerCase('zh-CN').includes(normalized)).slice(0, 8)
    : []

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])

  const select = ({ roadmap, node }: SearchEntry) => {
    setOpen(false)
    setQuery('')
    navigate(`/roadmaps/${roadmap.id}#node-${node.id}`)
  }

  return (
    <div className="search" ref={containerRef}>
      <span aria-hidden="true" className="search-icon">⌕</span>
      <input
        type="search"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="搜索全部节点…"
        aria-label="搜索全部路线图节点"
        aria-expanded={open && Boolean(normalized)}
      />
      {open && normalized && (
        <div className="search-results" role="listbox" aria-label="搜索结果">
          {results.length ? results.map((entry) => (
            <button key={`${entry.roadmap.id}-${entry.node.id}`} role="option" onClick={() => select(entry)}>
              <strong>{entry.node.title}</strong>
              <span>{entry.roadmap.title}</span>
            </button>
          )) : <p>没有找到匹配节点</p>}
        </div>
      )}
    </div>
  )
}

function Shell({ catalog, children }: { catalog: RoadmapCatalog; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link to="/" className="brand" aria-label="路线图首页">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>路线图</span>
        </Link>
        <div className="header-actions">
          <Search catalog={catalog} />
          <ThemeButton />
        </div>
      </header>
      <main>{children}</main>
      <footer>内容由 YAML 驱动 · 专注清晰的学习路径</footer>
    </div>
  )
}

function Home({ catalog }: { catalog: RoadmapCatalog }) {
  return (
    <div className="home page-enter">
      <section className="hero">
        <p className="eyebrow">YOUR NEXT STEP, MADE CLEAR</p>
        <h1>把复杂的旅程，<br /><em>拆成清晰的下一步。</em></h1>
        <p>选择一条路线图，沿着节点逐步探索。每一条路径都来自简单、可维护的 YAML 文件。</p>
      </section>
      <section aria-labelledby="roadmaps-title">
        <div className="section-heading">
          <div>
            <p className="section-number">01</p>
            <h2 id="roadmaps-title">选择路线</h2>
          </div>
          <span>{catalog.roots.length} 条主路线</span>
        </div>
        <div className="roadmap-grid">
          {catalog.roots.map((roadmap, index) => (
            <Link className="roadmap-card" to={`/roadmaps/${roadmap.id}`} key={roadmap.id}>
              <span className="card-index">0{index + 1}</span>
              <div>
                <h3>{roadmap.title}</h3>
                {roadmap.description && <p>{roadmap.description}</p>}
              </div>
              <span className="card-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function Breadcrumbs({ path, catalog }: { path: Roadmap[]; catalog: RoadmapCatalog }) {
  return (
    <nav className="breadcrumbs" aria-label="面包屑导航">
      <Link to="/">首页</Link>
      {path.map((roadmap, index) => {
        const href = `/roadmaps/${path.slice(0, index + 1).map(({ id }) => id).join('/')}`
        return <span key={roadmap.id}><span aria-hidden="true">/</span>{index === path.length - 1 ? <b>{roadmap.title}</b> : <Link to={href}>{roadmap.title}</Link>}</span>
      })}
    </nav>
  )
}

function RoadmapReferenceCard({ reference, target, basePath }: { reference: RoadmapReference; target: Roadmap; basePath: string }) {
  return (
    <Link to={`${basePath}/${target.id}`} className="node-card reference-card">
      <span className="reference-kicker">子路线图</span>
      <h3>{reference.title ?? target.title}</h3>
      <p>{reference.description ?? target.description ?? '进入并探索这条路线图。'}</p>
      <span className="enter-label">进入路线 <span aria-hidden="true">→</span></span>
    </Link>
  )
}

function nextNodeStatus(node: RoadmapNode, status: NodeStatus) {
  const sequence: NodeStatus[] = node.status === 'optional'
    ? ['optional', 'completed']
    : ['planned', 'in-progress', 'completed']
  const index = sequence.indexOf(status)
  return sequence[(index + 1) % sequence.length] ?? sequence[0]!
}

function NodeCard({ node, onOpen }: {
  node: RoadmapNode
  onOpen: () => void
}) {
  return (
    <article className="node-card node-summary" id={`node-${node.id}`} tabIndex={-1}>
      <button
        type="button"
        className="node-open-button"
        onClick={onOpen}
        aria-label={`查看 ${node.title} 详情`}
      />
      <h3>{node.title}</h3>
    </article>
  )
}

function NodeDrawer({ node, status, onStatusChange, onClose }: {
  node: RoadmapNode
  status: NodeStatus
  onStatusChange: (status: NodeStatus) => void
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div className="drawer-layer">
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="关闭节点详情" />
      <aside className="node-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-header">
          <span className="drawer-kicker">学习节点</span>
          <button ref={closeButtonRef} type="button" className="drawer-close" onClick={onClose} aria-label="关闭详情">×</button>
        </div>
        <div className="drawer-body">
          <div className="drawer-titlebar">
            <span className="drawer-node-id">{node.id}</span>
            <button
              type="button"
              className={`status drawer-status status-${status}`}
              onClick={() => onStatusChange(nextNodeStatus(node, status))}
              aria-label={`${node.title} 当前状态：${statusLabels[status]}，点击切换`}
            >
              <i aria-hidden="true" />{statusLabels[status]}<span aria-hidden="true"> · 点击切换</span>
            </button>
          </div>
          <h2 id="drawer-title">{node.title}</h2>
          {node.description && <p className="drawer-description">{node.description}</p>}

          {node.children.length > 0 && (
            <div className="drawer-section">
              <span className="drawer-label">后续内容</span>
              <p className="drawer-meta">包含 {node.children.length} 个子节点，可在路线图中展开继续学习。</p>
            </div>
          )}
        </div>
        {node.link && (
          <div className="drawer-footer">
            <a className="drawer-resource" href={node.link} target="_blank" rel="noreferrer">
              打开学习资源 <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  )
}

function containsNode(children: RoadmapChild[], targetNodeId: string): boolean {
  return children.some((child) => child.type === 'node' && (
    child.id === targetNodeId || containsNode(child.children, targetNodeId)
  ))
}

function TreeItem({ child, index, catalog, basePath, roadmapId, depth, targetNodeId, onOpenNode }: {
  child: RoadmapChild
  index: number
  catalog: RoadmapCatalog
  basePath: string
  roadmapId: string
  depth: number
  targetNodeId?: string
  onOpenNode: (node: RoadmapNode) => void
}) {
  const hasChildren = child.type === 'node' && child.children.length > 0
  const shouldRevealTarget = hasChildren && Boolean(targetNodeId && containsNode(child.children, targetNodeId))
  const [expanded, setExpanded] = useState(shouldRevealTarget)

  useEffect(() => {
    if (shouldRevealTarget) setExpanded(true)
  }, [shouldRevealTarget])

  const key = child.type === 'node' ? child.id : `ref-${child.roadmapId}-${index}`
  return (
    <li key={key} role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      {hasChildren ? (
        <button
          type="button"
          className="tree-dot tree-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={`children-${roadmapId}-${child.id}`}
          aria-label={`${expanded ? '折叠' : '展开'} ${child.title} 的子节点`}
        />
      ) : <div className="tree-dot" aria-hidden="true" />}
      {child.type === 'node'
        ? <NodeCard node={child} onOpen={() => onOpenNode(child)} />
        : <RoadmapReferenceCard reference={child} target={catalog.roadmaps.get(child.roadmapId)!} basePath={basePath} />}
      {hasChildren && expanded && (
        <div id={`children-${roadmapId}-${child.id}`}>
          <TreeChildren children={child.children} catalog={catalog} basePath={basePath} roadmapId={roadmapId} depth={depth + 1} targetNodeId={targetNodeId} onOpenNode={onOpenNode} />
        </div>
      )}
    </li>
  )
}

function TreeChildren({ children, catalog, basePath, roadmapId, depth = 0, targetNodeId, onOpenNode }: {
  children: RoadmapChild[]
  catalog: RoadmapCatalog
  basePath: string
  roadmapId: string
  depth?: number
  targetNodeId?: string
  onOpenNode: (node: RoadmapNode) => void
}) {
  return (
    <ul className={`tree tree-depth-${Math.min(depth, 3)}`} role={depth === 0 ? 'tree' : 'group'}>
      {children.map((child, index) => (
        <TreeItem
          key={child.type === 'node' ? child.id : `ref-${child.roadmapId}-${index}`}
          child={child}
          index={index}
          catalog={catalog}
          basePath={basePath}
          roadmapId={roadmapId}
          depth={depth}
          targetNodeId={targetNodeId}
          onOpenNode={onOpenNode}
        />
      ))}
    </ul>
  )
}

function resolvePath(rawPath: string | undefined, catalog: RoadmapCatalog) {
  const ids = (rawPath ?? '').split('/').filter(Boolean)
  if (!ids.length) return null
  const path: Roadmap[] = []
  for (let index = 0; index < ids.length; index++) {
    const roadmap = catalog.roadmaps.get(ids[index]!)
    if (!roadmap) return null
    if (index > 0 && !referencesRoadmap(path[index - 1]!, roadmap.id)) return null
    path.push(roadmap)
  }
  return path
}

function RoadmapPage({ catalog }: { catalog: RoadmapCatalog }) {
  const rawPath = useParams()['*']
  const location = useLocation()
  const path = resolvePath(rawPath, catalog)
  const roadmap = path?.[path.length - 1]
  const [progress, setProgress] = useState<Record<string, NodeStatus>>(readProgress)
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null)
  const selectedTriggerRef = useRef<HTMLElement | null>(null)

  const updateStatus = (node: RoadmapNode, status: NodeStatus) => {
    if (!roadmap) return
    setProgress((current) => ({ ...current, [`${roadmap.id}:${node.id}`]: status }))
    saveNodeStatus(roadmap.id, node.id, status)
  }

  const openNode = (node: RoadmapNode) => {
    selectedTriggerRef.current = document.activeElement as HTMLElement | null
    setSelectedNode(node)
  }

  const closeNode = () => {
    setSelectedNode(null)
    requestAnimationFrame(() => selectedTriggerRef.current?.focus())
  }

  useEffect(() => {
    if (!location.hash) {
      setSelectedNode(null)
      window.scrollTo({ top: 0 })
      return
    }
    const id = decodeURIComponent(location.hash.slice(1))
    requestAnimationFrame(() => {
      const target = document.getElementById(id)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.focus({ preventScroll: true })
      target?.classList.add('node-highlight')
      window.setTimeout(() => target?.classList.remove('node-highlight'), 2200)
    })
  }, [location.pathname, location.hash, roadmap])

  if (!path) return <NotFound />
  if (!roadmap) return <NotFound />
  const basePath = `/roadmaps/${path.map(({ id }) => id).join('/')}`
  const targetNodeId = location.hash.startsWith('#node-') ? decodeURIComponent(location.hash.slice(6)) : undefined
  return (
    <div className="roadmap-page page-enter">
      <Breadcrumbs path={path} catalog={catalog} />
      <header className="roadmap-hero">
        <p className="eyebrow">ROADMAP · {String(path.length).padStart(2, '0')}</p>
        <h1>{roadmap.title}</h1>
        {roadmap.description && <p>{roadmap.description}</p>}
      </header>
      <div className="journey-label"><span>开始旅程</span><i /></div>
      {roadmap.nodes.length
        ? <TreeChildren children={roadmap.nodes} catalog={catalog} basePath={basePath} roadmapId={roadmap.id} targetNodeId={targetNodeId} onOpenNode={openNode} />
        : <div className="empty-state">这条路线图还没有节点。</div>}
      <div className="journey-end"><i />继续前进</div>
      {selectedNode && (
        <NodeDrawer
          node={selectedNode}
          status={resolvedNodeStatus(progress, roadmap.id, selectedNode)}
          onStatusChange={(status) => updateStatus(selectedNode, status)}
          onClose={closeNode}
        />
      )}
    </div>
  )
}

function NotFound() {
  return (
    <div className="message-page page-enter">
      <span className="message-code">404</span>
      <h1>这条路线不存在</h1>
      <p>链接可能已失效，或路线图之间没有这样的引用关系。</p>
      <Link className="primary-button" to="/">返回首页</Link>
    </div>
  )
}

function ErrorPage({ errors }: { errors: string[] }) {
  return (
    <main className="message-page error-page">
      <span className="message-code">YAML</span>
      <h1>路线图内容无法加载</h1>
      <p>请修复以下内容错误后重新加载页面：</p>
      <ul>{errors.map((error, index) => <li key={index}><code>{error}</code></li>)}</ul>
    </main>
  )
}

export default function App() {
  if (!contentResult.ok) return <ErrorPage errors={contentResult.errors} />
  const { catalog } = contentResult
  return (
    <Shell catalog={catalog}>
      <Routes>
        <Route path="/" element={<Home catalog={catalog} />} />
        <Route path="/roadmaps/*" element={<RoadmapPage catalog={catalog} />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Shell>
  )
}
