import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  localStorage.clear()
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('App', () => {
  it('renders root roadmaps on the home page', () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '选择路线' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Web 开发路线图/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /前端开发路线图/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /后端开发路线图/ })).toBeInTheDocument()
  })

  it('renders a vertical roadmap and nested node statuses', () => {
    render(<MemoryRouter initialEntries={['/roadmaps/web-development']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Web 开发路线图' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '互联网基础' })).toBeInTheDocument()
    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /进入前端路线图/ })).toBeInTheDocument()
  })

  it('navigates into a referenced roadmap with breadcrumbs', async () => {
    render(<MemoryRouter initialEntries={['/roadmaps/web-development']}><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('link', { name: /进入前端路线图/ }))
    expect(await screen.findByRole('heading', { level: 1, name: '前端开发路线图' })).toBeInTheDocument()
    const breadcrumb = screen.getByRole('navigation', { name: '面包屑导航' })
    expect(breadcrumb).toHaveTextContent('Web 开发路线图')
  })

  it('searches globally and navigates to a result', async () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: '身份认证' } })
    fireEvent.click(await screen.findByRole('option', { name: /身份认证与授权/ }))
    expect(await screen.findByRole('heading', { level: 1, name: '后端开发路线图' })).toBeInTheDocument()
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled())
  })

  it('persists theme changes', () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '切换为深色主题' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('roadmap-theme')).toBe('dark')
  })

  it('stores node status changes in the browser and restores them', () => {
    const view = render(<MemoryRouter initialEntries={['/roadmaps/frontend']}><App /></MemoryRouter>)
    const status = screen.getByRole('button', { name: '语义化 HTML 当前状态：已完成，点击切换' })
    fireEvent.click(status)
    expect(screen.getByRole('button', { name: '语义化 HTML 当前状态：待开始，点击切换' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('roadmap-node-statuses:v1') ?? '{}')).toMatchObject({ 'frontend:semantic-html': 'planned' })

    view.unmount()
    render(<MemoryRouter initialEntries={['/roadmaps/frontend']}><App /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '语义化 HTML 当前状态：待开始，点击切换' })).toBeInTheDocument()
  })

  it('shows a not-found page for an invalid relationship path', () => {
    render(<MemoryRouter initialEntries={['/roadmaps/frontend/backend']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '这条路线不存在' })).toBeInTheDocument()
  })
})
