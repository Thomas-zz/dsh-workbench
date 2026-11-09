// dsh-workbench host 半片：/workbench/* 接口、agent 工具、系统提示、事件收集与每日晨报。
import { Store } from './store.js'
import { applyOps } from './ops.js'
import { registerTools } from './tools.js'
import { registerPrompts } from './prompts.js'
import { installCollectors } from './collect.js'
import { startBriefing } from './briefing.js'

const MAX_JSON = 2_000_000

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_JSON) throw Object.assign(new Error('请求体太大'), { status: 413 })
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('请求不是有效的 JSON'), { status: 400 })
  }
}

/**
 * Web 服务不会替插件路由鉴权，所以每个请求都要自己走一遍 Host/Origin 和登录凭证检查。
 * 拿不到鉴权服务时一律拒绝。
 */
function requestRejection(ctx, req) {
  const connection = ctx.get('connection')
  if (typeof connection?.requestRejection !== 'function') return 403
  return connection.requestRejection({ headers: req.headers })
}

async function route(ctx, store, req, res) {
  const url = new URL(req.url || '/', 'http://local')
  const path = url.pathname.replace(/^\/wb\/?/, '')
  const method = req.method || 'GET'

  if (method === 'GET') {
    if (path === 'state') {
      const state = await store.read()
      return json(res, 200, { state, canUndo: store.canUndo() })
    }
    return json(res, 404, { error: '接口不存在' })
  }
  if (method !== 'POST') return json(res, 405, { error: '不支持的方法' })

  // 所有写操作都拒绝跨站请求
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return json(res, 403, { error: '拒绝跨站请求' })

  const body = await readJson(req)
  switch (path) {
    case 'ops': {
      const label = typeof body.label === 'string' && body.label ? body.label : '操作'
      const result = await store.mutate(label, (draft) => {
        const applied = applyOps(draft, Array.isArray(body.ops) ? body.ops : [])
        return { ...applied, state: draft }
      }, { undoable: body.undoable !== false })
      return json(res, 200, { ...result, state: result.state, canUndo: store.canUndo() })
    }
    case 'undo': {
      const label = await store.undoLast()
      return json(res, 200, { label, state: await store.read(), canUndo: store.canUndo() })
    }
    default:
      return json(res, 404, { error: '接口不存在' })
  }
}

export const name = 'workbench'
export const inject = ['tools', 'systemPrompt']

export function apply(ctx, config = {}) {
  const store = new Store()
  ctx.effect(() => {
    const disposeTools = registerTools(ctx, store)
    const disposePrompts = registerPrompts(ctx, store)
    const disposeCollectors = installCollectors(ctx, store, config)
    const disposeBriefing = startBriefing(ctx, store, config)

    // 路由注册要等 webServer 就绪（宿主重启时本插件可能先激活），ctx.inject 负责「服务可用时挂上、卸载时摘掉」
    const disposeRoute = ctx.inject(['webServer'], (injected) => injected.webServer.register({
      kind: 'prefix',
      path: '/wb',
      handler: async (req, res) => {
        try {
          const rejection = requestRejection(ctx, req)
          if (rejection) {
            json(res, rejection, { error: '未授权' })
            return
          }
          await route(ctx, store, req, res)
        } catch (err) {
          if (res.headersSent) {
            res.end()
            return
          }
          json(res, err.status || 500, { error: err.message })
        }
      },
    }))

    return () => {
      disposeRoute()
      disposeBriefing()
      disposeCollectors()
      disposePrompts()
      disposeTools()
    }
  }, 'workbench: apply')
}
