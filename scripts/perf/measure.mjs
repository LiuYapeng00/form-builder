/**
 * T28 性能实测脚本（可复现）
 *
 * 度量三件事：
 * 1. 100 字段 Schema 首次渲染耗时（对比 11 字段）
 * 2. 属性面板连续输入 / 连续提交时的主线程帧耗时与长任务
 * 3. 真实鼠标拖拽重排时的帧耗时
 *
 * 用法：
 *   pnpm build
 *   pnpm preview --port 4173        # 另开一个终端
 *   node scripts/perf/measure.mjs   # 自动拉起 headless Chrome 并输出 JSON
 *
 * 说明：headless Chrome 的 rAF 不受 vsync 限制，所以这里报「帧耗时」而不是 FPS；
 * 判定标准是 60fps 的 16.7ms 预算 —— p95 与最长帧都低于预算即视为不掉帧。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.PERF_BASE ?? 'http://localhost:4173/'
const PORT = Number(process.env.PERF_CDP_PORT ?? 9222)
const ROUNDS = Number(process.env.PERF_ROUNDS ?? 5)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }

  const candidates = {
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  }

  const found = (candidates[process.platform] ?? []).find((file) => fs.existsSync(file))
  if (!found) throw new Error('找不到 Chrome，请用 CHROME_PATH 指定可执行文件路径')
  return found
}

async function waitForCdp() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return
    } catch {
      // Chrome 还没起来，继续等
    }
    await sleep(200)
  }
  throw new Error(`Chrome 调试端口 ${PORT} 未就绪`)
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.seq = 0
    this.pending = new Map()
    this.handlers = new Map()
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(JSON.stringify(message.error)))
        else resolve(message.result)
        return
      }
      for (const handler of this.handlers.get(message.method) ?? []) handler(message.params)
    })
  }

  send(method, params = {}) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, handler) {
    this.handlers.set(method, [...(this.handlers.get(method) ?? []), handler])
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? '页面脚本执行失败')
    }
    return result.result.value
  }

  async waitFor(expression, timeout = 20000) {
    const started = Date.now()
    for (;;) {
      if (await this.evaluate(expression)) return
      if (Date.now() - started > timeout) throw new Error(`等待超时：${expression}`)
      await sleep(100)
    }
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

const chromeBin = findChrome()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-perf-'))
const chrome = spawn(
  chromeBin,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,900',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const cleanup = async () => {
  chrome.kill()
  // Windows 上 Chrome 退出会短暂占用 profile 目录，删不掉就留给系统临时目录清理
  await sleep(300)
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch {
    // ignore
  }
}

try {
  await waitForCdp()

  const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()

  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, {
      method: 'PUT',
    })
  ).json()

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Network.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  // 首屏实际传输体积（encodedDataLength 是压缩后的字节数）
  const resources = new Map()
  cdp.on('Network.responseReceived', (params) => {
    resources.set(params.requestId, { type: params.type, url: params.response.url, encoded: 0 })
  })
  cdp.on('Network.loadingFinished', (params) => {
    const item = resources.get(params.requestId)
    if (item) item.encoded = params.encodedDataLength
  })

  await cdp.send('Page.navigate', { url: BASE })
  await cdp.waitFor(`!!document.querySelector('.toolbar__actions')`)
  await sleep(1200)

  const loaded = [...resources.values()]
  const sumByType = (type) =>
    loaded.filter((item) => item.type === type).reduce((sum, item) => sum + item.encoded, 0)

  // 页面内工具：store、100 字段生成、rAF 采样、长任务
  await cdp.evaluate(`(() => {
    window.__fb = {
      store() {
        const app = document.querySelector('#app').__vue_app__;
        const pinia = Reflect.ownKeys(app._context.provides)
          .map((key) => app._context.provides[key])
          .find((value) => value && value._s instanceof Map);
        return pinia._s.get('designer');
      },
      // 固定一份 11 字段基线，避免被后面的 100 字段覆盖
      smallFields: null,
      initSmall() {
        this.smallFields = JSON.parse(JSON.stringify(this.store().schema.fields));
      },
      makeFields(count) {
        return Array.from({ length: count }, (_, index) => {
          const base = {
            id: 'perf-' + index,
            name: 'field' + index,
            label: '字段 ' + (index + 1),
            rules: [{ type: 'required' }],
          };
          if (index % 5 === 0) {
            return { ...base, type: 'select', props: { options: [
              { label: '选项A', value: 'a' },
              { label: '选项B', value: 'b' },
              { label: '选项C', value: 'c' },
            ] } };
          }
          if (index % 7 === 0) return { ...base, type: 'date', props: {} };
          if (index % 4 === 0) return { ...base, type: 'textarea', props: { rows: 2 } };
          return { ...base, type: 'input', props: {} };
        });
      },
      async load(fields) {
        const store = this.store();
        const next = JSON.parse(JSON.stringify(store.schema));
        next.id = 'perf-form';
        next.name = '性能测试表单';
        next.fields = fields;
        const started = performance.now();
        store.loadSchema(next);
        // 双 rAF：等 Vue 渲染并完成一次绘制
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        return performance.now() - started;
      },
      startFrames() {
        this.frames = [];
        this.running = true;
        let last = 0;
        const tick = (now) => {
          if (last) this.frames.push(now - last);
          last = now;
          if (this.running) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        this.longTasks = [];
        this.observer?.disconnect();
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) this.longTasks.push(Math.round(entry.duration));
        });
        this.observer.observe({ entryTypes: ['longtask'] });
      },
      stopFrames() {
        this.running = false;
        this.observer?.disconnect();
        const frames = this.frames.slice(2).sort((a, b) => a - b);
        const total = frames.reduce((sum, value) => sum + value, 0);
        const avg = total / (frames.length || 1);
        return {
          frames: frames.length,
          avgFrameMs: +avg.toFixed(2),
          p95FrameMs: +(frames[Math.floor(frames.length * 0.95)] ?? 0).toFixed(2),
          maxFrameMs: +(frames[frames.length - 1] ?? 0).toFixed(2),
          longTasks: this.longTasks.slice(),
        };
      },
    };
    return true;
  })()`)
  await cdp.evaluate(`window.__fb.initSmall()`)

  // 1) 100 字段 vs 11 字段渲染耗时：交替多轮，丢掉首轮预热，取中位数
  const renderRuns = { small: [], big: [] }
  for (let round = 0; round < ROUNDS; round += 1) {
    const small = await cdp.evaluate(`window.__fb.load(window.__fb.smallFields)`)
    const big = await cdp.evaluate(`window.__fb.load(window.__fb.makeFields(100))`)
    if (round > 0) {
      renderRuns.small.push(+small.toFixed(1))
      renderRuns.big.push(+big.toFixed(1))
    }
    await sleep(300)
  }

  await cdp.evaluate(`window.__fb.load(window.__fb.makeFields(100))`)
  const cardCount = await cdp.evaluate(`document.querySelectorAll('.card').length`)

  // 2) 连续输入：30 次按键间隔 40ms，debounce 只提交一次
  await cdp.evaluate(`(() => {
    document.querySelectorAll('.card')[0].click();
    return true;
  })()`)
  await cdp.waitFor(`!!document.querySelector('.panel__tabs')`)
  await sleep(300)

  const typing = await cdp.evaluate(`(async () => {
    const items = [...document.querySelectorAll('.panel__tabs .el-form-item')];
    const titleItem = items.find(
      (item) => item.querySelector('.el-form-item__label')?.innerText.trim() === '标题',
    );
    const input = titleItem.querySelector('input');
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const historyBefore = window.__fb.store().history.past.length;
    window.__fb.startFrames();
    for (let i = 0; i < 30; i += 1) {
      setter.call(input, '字段标题' + i);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    const stats = window.__fb.stopFrames();
    stats.historyBefore = historyBefore;
    stats.historyAfter = window.__fb.store().history.past.length;
    return stats;
  })()`)

  // 2b) 离散修改：每次间隔 350ms，确保每次都真的提交（含整树快照）
  const discrete = await cdp.evaluate(`(async () => {
    const items = [...document.querySelectorAll('.panel__tabs .el-form-item')];
    const titleItem = items.find(
      (item) => item.querySelector('.el-form-item__label')?.innerText.trim() === '标题',
    );
    const input = titleItem.querySelector('input');
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const historyBefore = window.__fb.store().history.past.length;
    window.__fb.startFrames();
    for (let i = 0; i < 8; i += 1) {
      setter.call(input, '离散标题' + i);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const stats = window.__fb.stopFrames();
    stats.historyBefore = historyBefore;
    stats.historyAfter = window.__fb.store().history.past.length;
    return stats;
  })()`)

  // 3) 真实鼠标拖拽：把第 1 张卡片拖到第 6 张的位置
  const box = await cdp.evaluate(`(() => {
    const cards = document.querySelectorAll('.card');
    const from = cards[0].querySelector('.card__head').getBoundingClientRect();
    const to = cards[5].getBoundingClientRect();
    return {
      fx: from.x + from.width / 2,
      fy: from.y + from.height / 2,
      tx: to.x + to.width / 2,
      ty: to.y + to.height / 2,
    };
  })()`)

  const mouse = (type, x, y) =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      buttons: type === 'mouseReleased' ? 0 : 1,
      clickCount: 1,
    })

  await cdp.evaluate(`window.__fb.startFrames()`)
  await mouse('mousePressed', box.fx, box.fy)
  for (let step = 1; step <= 12; step += 1) {
    await mouse(
      'mouseMoved',
      box.fx + ((box.tx - box.fx) * step) / 12,
      box.fy + ((box.ty - box.fy) * step) / 12,
    )
    await sleep(35)
  }
  await mouse('mouseReleased', box.tx, box.ty)
  await sleep(500)
  const drag = await cdp.evaluate(`window.__fb.stopFrames()`)
  const dragResult = await cdp.evaluate(`(() => ({
    firstThree: window.__fb.store().schema.fields.slice(0, 3).map((field) => field.label),
  }))()`)

  const report = {
    environment: {
      base: BASE,
      viewport: '1440x900',
      chrome: version.Browser,
    },
    network: {
      jsBytes: sumByType('Script'),
      cssBytes: sumByType('Stylesheet'),
      documentBytes: sumByType('Document'),
      requests: loaded
        .filter((item) => item.type === 'Script' || item.type === 'Stylesheet')
        .map((item) => ({
          type: item.type,
          file: item.url.split('/').pop(),
          encodedBytes: item.encoded,
        })),
    },
    render: {
      smallFields: 11,
      smallRuns: renderRuns.small,
      smallMedianMs: median(renderRuns.small),
      bigFields: 100,
      bigRuns: renderRuns.big,
      bigMedianMs: median(renderRuns.big),
      cardCount,
    },
    typing,
    discrete,
    drag,
    dragResult,
  }

  console.log(JSON.stringify(report, null, 2))
  ws.close()
} finally {
  await cleanup()
}
