import { useEffect, useMemo, useRef, useState } from 'react'
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

function storedNodeStatus(roadmapId: string, node: RoadmapNode) {
  const status = readProgress()[`${roadmapId}:${node.id}`]
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

function NodeCard({ node, roadmapId }: { node: RoadmapNode; roadmapId: string }) {
  const [status, setStatus] = useState<NodeStatus>(() => storedNodeStatus(roadmapId, node))
  const sequence: NodeStatus[] = node.status === 'optional'
    ? ['optional', 'completed']
    : ['planned', 'in-progress', 'completed']
  const updateStatus = () => {
    const index = sequence.indexOf(status)
    const nextStatus = sequence[(index + 1) % sequence.length] ?? sequence[0]!
    setStatus(nextStatus)
    saveNodeStatus(roadmapId, node.id, nextStatus)
  }

  return (
    <article className="node-card" id={`node-${node.id}`} tabIndex={-1}>
      <div className="node-topline">
        <button
          type="button"
          className={`status status-${status}`}
          onClick={updateStatus}
          aria-label={`${node.title} 当前状态：${statusLabels[status]}，点击切换`}
          title="点击切换并保存状态"
        >
          <i aria-hidden="true" />{statusLabels[status]}
        </button>
        <span className="node-id">{node.id}</span>
      </div>
      <h3>{node.title}</h3>
      {node.description && <p>{node.description}</p>}
      {node.link && <a className="resource-link" href={node.link} target="_blank" rel="noreferrer">查看资源 <span aria-hidden="true">↗</span></a>}
    </article>
  )
}

function TreeChildren({ children, catalog, basePath, roadmapId, depth = 0 }: { children: RoadmapChild[]; catalog: RoadmapCatalog; basePath: string; roadmapId: string; depth?: number }) {
  return (
    <ul className={`tree tree-depth-${Math.min(depth, 3)}`} role={depth === 0 ? 'tree' : 'group'}>
      {children.map((child, index) => {
        const key = child.type === 'node' ? child.id : `ref-${child.roadmapId}-${index}`
        return (
          <li key={key} role="treeitem" aria-expanded={child.type === 'node' && child.children.length ? true : undefined}>
            <div className="tree-dot" aria-hidden="true" />
            {child.type === 'node'
              ? <NodeCard node={child} roadmapId={roadmapId} />
              : <RoadmapReferenceCard reference={child} target={catalog.roadmaps.get(child.roadmapId)!} basePath={basePath} />}
            {child.type === 'node' && child.children.length > 0 && (
              <TreeChildren children={child.children} catalog={catalog} basePath={basePath} roadmapId={roadmapId} depth={depth + 1} />
            )}
          </li>
        )
      })}
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

  useEffect(() => {
    if (!location.hash) {
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
  }, [location.pathname, location.hash])

  if (!path) return <NotFound />
  const roadmap = path[path.length - 1]!
  const basePath = `/roadmaps/${path.map(({ id }) => id).join('/')}`
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
        ? <TreeChildren children={roadmap.nodes} catalog={catalog} basePath={basePath} roadmapId={roadmap.id} />
        : <div className="empty-state">这条路线图还没有节点。</div>}
      <div className="journey-end"><i />继续前进</div>
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
