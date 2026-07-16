import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import {
  createKey,
  convertChildType,
  findChild,
  hydrateRoadmap,
  moveChild,
  removeChild,
  snapshot,
  stripEditorState,
  toYaml,
  updateChild,
  validateRoadmap,
  type DropPosition,
  type EditorChild,
  type EditorFile,
  type EditorNode,
  type EditorReference,
  type EditorRoadmap,
} from './model'

type IconName = 'route' | 'plus' | 'save' | 'search' | 'node' | 'reference' | 'trash' | 'copy' | 'chevron' | 'grip' | 'code' | 'close'

const paths: Record<IconName, ReactNode> = {
  route: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M8 5h5a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4H8a3 3 0 0 0-3 3v0a2 2 0 0 0 2 2h9" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  save: <><path d="M5 3h12l4 4v14H3V3h2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  node: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h5" /></>,
  reference: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /><path d="M10 11v6M14 11v6" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  grip: <><circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" /></>,
  code: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Button({ children, icon, tone = 'default', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName; tone?: 'default' | 'primary' | 'danger' }) {
  return <button {...props} className={`button button-${tone} ${props.className ?? ''}`}>{icon && <Icon name={icon} />}{children}</button>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

function NodeTypeSwitch({ value, onChange }: { value: EditorChild['type']; onChange: (type: EditorChild['type']) => void }) {
  return <div className="node-type-switch" aria-label="节点类型">
    <button type="button" className={value === 'node' ? 'active' : ''} onClick={() => onChange('node')}><Icon name="node" size={15} />知识节点</button>
    <button type="button" className={value === 'roadmap' ? 'active' : ''} onClick={() => onChange('roadmap')}><Icon name="reference" size={15} />路线图节点</button>
  </div>
}

function TagEditor({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const tags = draft.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
    if (tags.length) onChange([...new Set([...value, ...tags])])
    setDraft('')
  }
  return <div className="tag-editor">
    <div className="tag-input-row"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add() } }} placeholder="输入标签后回车" /><button type="button" onClick={add} aria-label="添加标签"><Icon name="plus" size={15} /></button></div>
    {value.length > 0 && <div className="editable-tags">{value.map((tag) => <button type="button" key={tag} onClick={() => onChange(value.filter((item) => item !== tag))}>{tag}<span>×</span></button>)}</div>}
  </div>
}

function countNodes(children: EditorChild[]): number {
  return children.reduce((count, child) => count + 1 + (child.type === 'node' ? countNodes(child.children) : 0), 0)
}

function TreeItem({ child, depth, selectedKey, collapsed, onSelect, onToggle, onDrop, onDragStart }: {
  child: EditorChild
  depth: number
  selectedKey: string | null
  collapsed: Set<string>
  onSelect: (key: string) => void
  onToggle: (key: string) => void
  onDrop: (dragged: string, target: string, position: DropPosition) => void
  onDragStart: (key: string) => void
}) {
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null)
  const hasChildren = child.type === 'node' && child.children.length > 0
  const isCollapsed = collapsed.has(child._key)
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    setDropPosition(ratio < .27 ? 'before' : ratio > .73 ? 'after' : child.type === 'node' ? 'inside' : 'after')
  }
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const dragged = event.dataTransfer.getData('text/roadmap-node')
    if (dragged && dropPosition) onDrop(dragged, child._key, dropPosition)
    setDropPosition(null)
  }
  return <div className="tree-branch">
    <div
      className={`tree-item ${selectedKey === child._key ? 'selected' : ''} ${dropPosition ? `drop-${dropPosition}` : ''}`}
      style={{ '--depth': depth } as React.CSSProperties}
      onDragOver={handleDragOver}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropPosition(null) }}
      onDrop={handleDrop}
      onClick={() => onSelect(child._key)}
    >
      <span className="tree-indent" />
      <button className={`tree-toggle ${hasChildren ? '' : 'invisible'} ${isCollapsed ? '' : 'expanded'}`} type="button" onClick={(event) => { event.stopPropagation(); onToggle(child._key) }} aria-label={isCollapsed ? '展开子节点' : '折叠子节点'}><Icon name="chevron" size={14} /></button>
      <span className={`type-icon ${child.type}`}><Icon name={child.type === 'node' ? 'node' : 'reference'} size={16} /></span>
      <div className="tree-copy">
        <strong>{child.type === 'node' ? child.title || '未命名节点' : child.title || child.roadmapId || '未选择路线'}</strong>
        <span>{child.type === 'node' ? child.id || '缺少 ID' : `引用 · ${child.roadmapId || '未设置'}`}</span>
      </div>
      {child.type === 'node' && <span className={`status-dot status-${child.status}`} title={child.status} />}
      <span
        className="drag-handle"
        draggable
        onClick={(event) => event.stopPropagation()}
        onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/roadmap-node', child._key); onDragStart(child._key) }}
        onDragEnd={() => onDragStart('')}
        title="拖拽移动"
      ><Icon name="grip" /></span>
    </div>
    {hasChildren && !isCollapsed && child.children.map((nested) => <TreeItem key={nested._key} child={nested} depth={depth + 1} selectedKey={selectedKey} collapsed={collapsed} onSelect={onSelect} onToggle={onToggle} onDrop={onDrop} onDragStart={onDragStart} />)}
  </div>
}

function EmptyCanvas({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-canvas"><span><Icon name="route" size={30} /></span><h2>从第一个节点开始</h2><p>添加知识节点，然后拖拽编排一条清晰的学习路径。</p><Button icon="plus" tone="primary" onClick={onAdd}>添加节点</Button></div>
}

export default function EditorApp() {
  const [files, setFiles] = useState<EditorFile[]>([])
  const [activeFilename, setActiveFilename] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [showYaml, setShowYaml] = useState(false)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)

  const activeFile = files.find((file) => file.filename === activeFilename)
  const document = activeFile?.document
  const selected = document && selectedKey ? findChild(document.nodes, selectedKey) : undefined
  const dirty = activeFile ? snapshot(activeFile.document) !== activeFile.savedSnapshot : false
  const dirtyCount = files.filter((file) => snapshot(file.document) !== file.savedSnapshot).length

  const notify = useCallback((tone: 'success' | 'error', text: string) => {
    setNotice({ tone, text })
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200)
  }, [])

  useEffect(() => {
    fetch('/api/editor/roadmaps').then(async (response) => {
      const body = await response.json() as { files?: { filename: string; document: unknown }[]; error?: string }
      if (!response.ok || !body.files) throw new Error(body.error || '无法加载路线图。')
      const loaded = body.files.map(({ filename, document: value }) => {
        const hydrated = hydrateRoadmap(value)
        return { filename, document: hydrated, savedSnapshot: snapshot(hydrated) }
      })
      setFiles(loaded)
      setActiveFilename(loaded[0]?.filename ?? '')
    }).catch((error) => notify('error', error instanceof Error ? error.message : '无法加载路线图。')).finally(() => setLoading(false))
  }, [notify])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyCount) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirtyCount])

  const updateDocument = useCallback((update: (document: EditorRoadmap) => EditorRoadmap) => {
    setFiles((current) => current.map((file) => file.filename === activeFilename ? { ...file, document: update(file.document) } : file))
  }, [activeFilename])

  const save = useCallback(async () => {
    const file = files.find((item) => item.filename === activeFilename)
    if (!file) return
    const errors = validateRoadmap(file.document, files.filter((item) => item.filename !== activeFilename).map((item) => item.document.id))
    if (errors.length) { notify('error', errors[0]!); return }
    setSaving(true)
    try {
      const directory = file.filename.includes('/') ? file.filename.slice(0, file.filename.lastIndexOf('/') + 1) : ''
      const nextFilename = `${directory}${file.document.id}.yaml`
      const response = await fetch('/api/editor/roadmaps', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: nextFilename, document: stripEditorState(file.document) }) })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || '保存失败。')
      if (!file.isNew && nextFilename !== file.filename) await fetch('/api/editor/roadmaps', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.filename }) })
      const saved = snapshot(file.document)
      setFiles((current) => current.map((item) => item.filename === file.filename ? { ...item, filename: nextFilename, savedSnapshot: saved, isNew: false } : item))
      setActiveFilename(nextFilename)
      notify('success', `已保存到 src/content/${nextFilename}`)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '保存失败。')
    } finally { setSaving(false) }
  }, [activeFilename, files, notify])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() }
      if (event.key === 'Escape') setShowYaml(false)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [save])

  const addNode = (parentKey?: string) => {
    const node: EditorNode = { type: 'node', _key: createKey(), id: 'new-node', title: '新知识节点', tags: [], status: 'planned', children: [] }
    updateDocument((current) => ({ ...current, nodes: parentKey ? updateChild(current.nodes, parentKey, (child) => child.type === 'node' ? { ...child, children: [...child.children, node] } : child) : [...current.nodes, node] }))
    if (parentKey) setCollapsed((current) => { const next = new Set(current); next.delete(parentKey); return next })
    setSelectedKey(node._key)
  }

  const addReference = () => {
    const target = files.find((file) => file.filename !== activeFilename)
    const reference: EditorReference = { type: 'roadmap', _key: createKey(), roadmapId: target?.document.id ?? '' }
    updateDocument((current) => ({ ...current, nodes: [...current.nodes, reference] }))
    setSelectedKey(reference._key)
  }

  const duplicateSelected = () => {
    if (!selected || !document) return
    const clone = (child: EditorChild): EditorChild => child.type === 'roadmap'
      ? { ...child, _key: createKey() }
      : { ...child, _key: createKey(), id: `${child.id}-copy`, title: `${child.title}（副本）`, children: child.children.map(clone) }
    const copy = clone(selected)
    const insertCopy = (children: EditorChild[]): EditorChild[] => children.flatMap((child) => child._key === selected._key ? [child, copy] : [child.type === 'node' ? { ...child, children: insertCopy(child.children) } : child])
    updateDocument((current) => ({ ...current, nodes: insertCopy(current.nodes) }))
    setSelectedKey(copy._key)
  }

  const deleteSelected = () => {
    if (!selected || !window.confirm(`删除“${selected.type === 'node' ? selected.title : selected.title || selected.roadmapId}”？子节点也会一起删除。`)) return
    updateDocument((current) => ({ ...current, nodes: removeChild(current.nodes, selected._key).children }))
    setSelectedKey(null)
  }

  const changeSelectedType = (type: EditorChild['type']) => {
    if (!selected || selected.type === type) return
    if (selected.type === 'node' && selected.children.length > 0 && !window.confirm(`转换为路线图节点后，“${selected.title}”下的 ${countNodes(selected.children)} 个子节点将被移除。继续转换？`)) return
    updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => convertChildType(child, type)) }))
  }

  const createRoadmap = () => {
    const index = files.length + 1
    const document: EditorRoadmap = { id: `new-roadmap-${index}`, title: '新路线图', tags: [], nodes: [] }
    const filename = `other/${document.id}.yaml`
    setFiles((current) => [...current, { filename, document, savedSnapshot: '', isNew: true }])
    setActiveFilename(filename)
    setSelectedKey(null)
  }

  const deleteRoadmap = async () => {
    if (!activeFile || !window.confirm(`永久删除路线图“${activeFile.document.title}”及文件 ${activeFile.filename}？`)) return
    if (!activeFile.isNew) {
      const response = await fetch('/api/editor/roadmaps', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: activeFile.filename }) })
      if (!response.ok) { notify('error', '删除路线图失败。'); return }
    }
    const next = files.filter((file) => file.filename !== activeFile.filename)
    setFiles(next)
    setActiveFilename(next[0]?.filename ?? '')
    setSelectedKey(null)
    notify('success', '路线图已删除。')
  }

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return files.filter((file) => !normalized || `${file.document.title} ${file.document.id} ${file.document.tags.join(' ')}`.toLowerCase().includes(normalized))
  }, [files, query])

  if (loading) return <div className="loading-screen"><span className="loader" /><p>正在载入路线图…</p></div>

  return <div className="editor-shell">
    <header className="topbar">
      <div className="studio-brand"><div><strong>Roadmap</strong><small>STUDIO</small></div></div>
      <div className="topbar-context"><span className={`save-state ${dirty ? 'dirty' : ''}`} />{document ? <><strong>{document.title}</strong><span>/</span><code>{activeFile?.filename}</code></> : '未选择路线图'}</div>
      <div className="topbar-actions"><Button icon="code" className="button-icon-only" onClick={() => setShowYaml(true)} disabled={!document} aria-label="YAML" /><Button icon="save" tone="primary" onClick={() => void save()} disabled={!dirty || saving}>{saving ? '保存中…' : '保存'}<kbd>⌘S</kbd></Button></div>
    </header>

    <aside className="catalog-panel">
      <div className="panel-heading"><div><span>路线图库</span><small>{files.length} 条路线</small></div><button type="button" onClick={createRoadmap} aria-label="新建路线图"><Icon name="plus" /></button></div>
      <label className="search-box"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索路线图" /></label>
      <nav className="roadmap-list">
        {visibleFiles.map((file) => {
          const isDirty = snapshot(file.document) !== file.savedSnapshot
          return <button type="button" key={file.filename} className={file.filename === activeFilename ? 'active' : ''} onClick={() => { setActiveFilename(file.filename); setSelectedKey(null) }}>
            <span><strong>{file.document.title || '未命名路线'}</strong><small>{countNodes(file.document.nodes)} 个节点</small></span>
            {isDirty && <i title="有未保存的更改" />}
          </button>
        })}
      </nav>
      <div className="catalog-footer"><a href="/" target="_blank" rel="noreferrer">预览网站 <span>↗</span></a><span>{dirtyCount ? `${dirtyCount} 个未保存` : '全部已保存'}</span></div>
    </aside>

    <main className="canvas-panel">
      {document ? <>
        <div className="canvas-heading">
          <div><span className="eyebrow">路线结构</span><h1>{document.title}</h1><p>{document.description || '通过拖拽节点来调整路线结构与层级。'}</p></div>
          <div className="canvas-actions"><Button icon="reference" onClick={addReference}>添加引用</Button><Button icon="plus" tone="primary" onClick={() => addNode()}>添加节点</Button></div>
        </div>
        <div className={`tree-canvas ${draggingKey ? 'is-dragging' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
          if (event.target !== event.currentTarget || !draggingKey) return
          const removed = removeChild(document.nodes, draggingKey)
          if (removed.removed) updateDocument((current) => ({ ...current, nodes: [...removed.children, removed.removed!] }))
          setDraggingKey(null)
        }}>
          {document.nodes.length ? document.nodes.map((child) => <TreeItem key={child._key} child={child} depth={0} selectedKey={selectedKey} collapsed={collapsed} onSelect={setSelectedKey} onToggle={(key) => setCollapsed((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next })} onDragStart={setDraggingKey} onDrop={(dragged, target, position) => { updateDocument((current) => ({ ...current, nodes: moveChild(current.nodes, dragged, target, position) })); setDraggingKey(null) }} />) : <EmptyCanvas onAdd={() => addNode()} />}
          {document.nodes.length > 0 && <div className="root-drop-hint">拖到空白区域可移至路线末尾</div>}
        </div>
      </> : <EmptyCanvas onAdd={createRoadmap} />}
    </main>

    <aside className="inspector-panel">
      {document && !selected && <>
        <div className="inspector-heading"><div><span className="inspector-icon route"><Icon name="route" size={15} /></span><div><small>当前选择</small><strong>路线图设置</strong></div></div></div>
        <div className="inspector-form">
          <Field label="路线标题"><input value={document.title} onChange={(event) => updateDocument((current) => ({ ...current, title: event.target.value }))} /></Field>
          <Field label="路线 ID" hint="保存时同时作为 YAML 文件名"><input value={document.id} onChange={(event) => updateDocument((current) => ({ ...current, id: event.target.value.toLowerCase().replace(/\s+/g, '-') }))} spellCheck={false} /></Field>
          <Field label="路线简介"><textarea rows={5} value={document.description ?? ''} onChange={(event) => updateDocument((current) => ({ ...current, description: event.target.value || undefined }))} placeholder="这条路线适合谁，以及将学到什么？" /></Field>
          <Field label="标签"><TagEditor value={document.tags} onChange={(tags) => updateDocument((current) => ({ ...current, tags }))} /></Field>
        </div>
        <div className="danger-zone"><button type="button" onClick={() => void deleteRoadmap()}><Icon name="trash" size={16} />删除此路线图</button></div>
      </>}

      {document && selected?.type === 'node' && <>
        <div className="inspector-heading"><div><span className="inspector-icon node"><Icon name="node" size={15} /></span><div><small>知识节点</small><strong>{selected.title || '未命名节点'}</strong></div></div><div className="inspector-heading-actions"><button type="button" onClick={duplicateSelected} aria-label="复制"><Icon name="copy" size={14} /></button><button type="button" className="danger" onClick={deleteSelected} aria-label="删除"><Icon name="trash" size={14} /></button><button type="button" onClick={() => setSelectedKey(null)} aria-label="关闭"><Icon name="close" size={14} /></button></div></div>
        <div className="inspector-form">
          <Field label="节点类型"><NodeTypeSwitch value={selected.type} onChange={changeSelectedType} /></Field>
          <Field label="节点标题"><input value={selected.title} onChange={(event) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => ({ ...child, title: event.target.value })) }))} /></Field>
          <Field label="节点 ID"><input value={selected.id} onChange={(event) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => ({ ...child, id: event.target.value.toLowerCase().replace(/\s+/g, '-') })) }))} spellCheck={false} /></Field>
          <Field label="学习状态"><select value={selected.status} onChange={(event) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => child.type === 'node' ? { ...child, status: event.target.value as EditorNode['status'] } : child) }))}><option value="planned">待开始</option><option value="in-progress">进行中</option><option value="completed">已完成</option><option value="optional">选修</option></select></Field>
          <Field label="节点说明"><textarea rows={7} value={selected.description ?? ''} onChange={(event) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => ({ ...child, description: event.target.value || undefined })) }))} placeholder="描述学习目标、重点与完成标准…" /></Field>
          <Field label="学习链接"><input type="url" value={selected.link ?? ''} onChange={(event) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => ({ ...child, link: event.target.value || undefined })) }))} placeholder="https://" /></Field>
          <Field label="标签"><TagEditor value={selected.tags} onChange={(tags) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => child.type === 'node' ? { ...child, tags } : child) }))} /></Field>
          <Button icon="plus" onClick={() => addNode(selected._key)}>添加子节点</Button>
        </div>
      </>}

      {document && selected?.type === 'roadmap' && <>
        <div className="inspector-heading"><div><span className="inspector-icon reference"><Icon name="reference" size={15} /></span><div><small>路线引用</small><strong>{selected.title || selected.roadmapId || '未设置引用'}</strong></div></div><div className="inspector-heading-actions"><button type="button" onClick={duplicateSelected} aria-label="复制"><Icon name="copy" size={14} /></button><button type="button" className="danger" onClick={deleteSelected} aria-label="删除"><Icon name="trash" size={14} /></button><button type="button" onClick={() => setSelectedKey(null)} aria-label="关闭"><Icon name="close" size={14} /></button></div></div>
        <div className="inspector-form">
          <Field label="节点类型"><NodeTypeSwitch value={selected.type} onChange={changeSelectedType} /></Field>
          <Field label="引用路线"><select value={selected.roadmapId} onChange={(event) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => child.type === 'roadmap' ? { ...child, roadmapId: event.target.value } : child) }))}><option value="">选择路线图</option>{files.filter((file) => file.filename !== activeFilename).map((file) => <option value={file.document.id} key={file.filename}>{file.document.title}</option>)}</select></Field>
          <Field label="自定义标题" hint="留空则使用目标路线标题"><input value={selected.title ?? ''} onChange={(event) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => child.type === 'roadmap' ? { ...child, title: event.target.value || undefined } : child) }))} /></Field>
          <Field label="自定义说明"><textarea rows={6} value={selected.description ?? ''} onChange={(event) => updateDocument((current) => ({ ...current, nodes: updateChild(current.nodes, selected._key, (child) => ({ ...child, description: event.target.value || undefined })) }))} /></Field>
        </div>
      </>}
    </aside>

    {showYaml && document && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="YAML 预览"><button className="modal-backdrop" onClick={() => setShowYaml(false)} /><section className="yaml-modal"><header><div><span><Icon name="code" /></span><div><strong>YAML 预览</strong><small>{activeFile?.filename}</small></div></div><button onClick={() => setShowYaml(false)} aria-label="关闭"><Icon name="close" /></button></header><pre><code>{toYaml(document)}</code></pre><footer><span>预览会自动排除编辑器内部字段</span><Button icon="save" tone="primary" onClick={() => { void save(); setShowYaml(false) }}>保存文件</Button></footer></section></div>}
    {notice && <div className={`toast ${notice.tone}`} role="status"><span className="toast-icon" aria-hidden="true">{notice.tone === 'success' ? '✓' : '!'}</span><span className="toast-message">{notice.text}</span></div>}
  </div>
}
