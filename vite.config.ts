import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { dump, load } from 'js-yaml'
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'

const contentDirectory = path.resolve(process.cwd(), 'src/content')

function sendJson(response: import('node:http').ServerResponse, status: number, value: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(value))
}

async function readBody(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

function safeContentPath(value: unknown) {
  if (typeof value !== 'string' || !/^(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9-]*\.yaml$/.test(value)) return null
  return value
}

async function listYamlFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) return listYamlFiles(path.join(directory, entry.name), relativePath)
    return entry.isFile() && entry.name.endsWith('.yaml') ? [relativePath] : []
  }))
  return files.flat().sort()
}

function editorApi(): Plugin {
  return {
    name: 'roadmap-editor-api',
    configureServer(server) {
      server.middlewares.use('/api/editor/roadmaps', async (request, response) => {
        try {
          if (request.method === 'GET') {
            const filenames = await listYamlFiles(contentDirectory)
            const files = await Promise.all(filenames.map(async (filename) => ({
              filename,
              document: load(await readFile(path.join(contentDirectory, filename), 'utf8')),
            })))
            sendJson(response, 200, { files })
            return
          }

          const body = await readBody(request)
          const filename = safeContentPath(body.filename)
          if (!filename) {
            sendJson(response, 400, { error: '文件路径的目录和文件名只能包含小写字母、数字和连字符，并以 .yaml 结尾。' })
            return
          }
          const target = path.join(contentDirectory, filename)

          if (request.method === 'PUT') {
            if (!body.document || typeof body.document !== 'object' || Array.isArray(body.document)) {
              sendJson(response, 400, { error: '路线图数据无效。' })
              return
            }
            await mkdir(path.dirname(target), { recursive: true })
            const yaml = dump(body.document, { noRefs: true, lineWidth: 120 })
            const temporary = `${target}.tmp`
            await writeFile(temporary, yaml, 'utf8')
            await rename(temporary, target)
            sendJson(response, 200, { ok: true })
            return
          }

          if (request.method === 'DELETE') {
            await unlink(target)
            sendJson(response, 200, { ok: true })
            return
          }

          sendJson(response, 405, { error: '不支持的请求方法。' })
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : '编辑器服务发生未知错误。' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'editor' ? [editorApi()] : [])],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
}))
