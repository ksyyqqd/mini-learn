const http = require('http');
const fs = require('fs');
const path = require('path');
const htmlparser2 = require('htmlparser2');

/**
 * Renderer 类
 * - 提供一个简单的 HTTP 服务用于在浏览器中展示渲染结果
 * - 支持 SSE（Server-Sent Events）向浏览器推送渲染更新
 * - 内置简易的 WXML模板解析与渲染器
 */
class Renderer {
  /**
   * 构造函数
   * @param {number} port - 本地 HTTP 服务端口（默认 3000）
   */
  constructor(port = 3000) {
    // 当前通过 SSE 保持连接的客户端集合（每个元素为 response 对象）
    this.clients = new Set();
    this.port = port;
    // bridge引用，用于转发方法调用
    this.bridge = null;
    // 存储最新的渲染数据
    this.currentData = null;
    // 启动内置的 HTTP 服务器并准备静态资源与 SSE 端点
    this._startServer();
  }

  /**
   * 设置bridge实例
   * @param {Bridge} bridge - bridge实例
   */
  setBridge(bridge) {
    this.bridge = bridge;
  }

  /**
   * 启动 HTTP 服务器并处理路由：
   * - /events: SSE（浏览器订阅渲染更新）
   * - /api/callMethod: 处理前端方法调用请求
   * - /app.css: 返回 sample-app 的样式文件（如果存在）
   * - 其他: 从 public 目录返回静态资源（index.html、脚本等）
   */
  _startServer() {
    const publicPath = path.join(__dirname, '..', 'public');

    // 加载模板（类 WXML，位于 sample-app/app.axml）
    const tplPath = path.join(__dirname, '..', 'sample-app', 'app.axml');
    try {
      this.template = fs.readFileSync(tplPath, 'utf8');
      console.log('[Renderer] loaded template:', tplPath);
    } catch (e) {
      // 若没有模板，回退为简单占位
      console.warn('[Renderer] no template found at', tplPath);
      this.template = '<div>(no template)</div>';
    }

    const server = http.createServer((req, res) => {
      // SSE 端点：浏览器通过 EventSource 连接到 /events 接收渲染推送
      if (req.url === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        // 通知浏览器在断开后重连的时间
        res.write('retry: 10000\n\n');
        this.clients.add(res);
        
        // 如果已有数据，立即发送给新连接的客户端
        if (this.currentData) {
          const html = this._renderTemplate(this.template, this.currentData || {});
          const payload = JSON.stringify({ html, data: this.currentData });
          try {
            res.write(`data: ${payload}\n\n`);
          } catch (e) {
            this.clients.delete(res);
          }
        }
        
        // 当连接关闭时从集合中移除
        req.on('close', () => this.clients.delete(res));
        return;
      }

      // API端点：处理前端方法调用请求
      if (req.url === '/api/callMethod' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const requestData = JSON.parse(body);
            const { methodName, args } = requestData;
            
            // 通过bridge转发方法调用请求
            if (this.bridge && typeof this.bridge.sendToJS === 'function') {
              this.bridge.sendToJS('callMethod', { methodName, args });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Bridge not available' }));
            }
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request format' }));
          }
        });
        return;
      }

      // 提供 sample-app 的样式文件，路由为 /app.css（兼容 wxss 文件名）
      if (req.url === '/app.css') {
        const appCssPath = path.join(__dirname, '..', 'sample-app', 'app.axss');
        try {
          const css = fs.readFileSync(appCssPath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/css' });
          res.end(css);
        } catch (e) {
          res.writeHead(404);
          res.end('/* no app css */');
        }
        return;
      }

      // 其余路径作为静态资源返回（public 下的文件）
      let filePath = path.join(publicPath, req.url === '/' ? 'index.html' : req.url);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath);
        const map = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
        res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.listen(this.port, () => {
      console.log(`Renderer HTTP server running: http://localhost:${this.port}`);
    });

    this.server = server;
  }

  /**
   * render - 将数据渲染为 HTML 并推送到已连接的浏览器客户端（通过 SSE）
   * @param {Object} data - 渲染上下文数据（模板中可通过 {{var}} 访问）
   */
  render(data) {
    // 保存当前数据
    this.currentData = data;
    
    // 将模板与数据结合生成最终 HTML
    const html = this._renderTemplate(this.template, data || {});
    // 调试：打印渲染后的 HTML 以便本地查看
    console.log('[Renderer] rendered HTML:\n', html);
    const payload = JSON.stringify({ html, data });

    // 如果没有浏览器客户端连接，回退到控制台输出
    if (this.clients.size === 0) {
      console.log('[Renderer] no browser clients, fallback to console:\n', payload);
      return;
    }

    // 向所有已连接的 SSE 客户端推送数据（格式为 data: ...\n\n）
    for (const res of this.clients) {
      try {
        res.write(`data: ${payload}\n\n`);
      } catch (e) {
        // 若写入失败，移除该客户端
        this.clients.delete(res);
      }
    }
  }

  /**
   * sendConsole - 将来自 runtime 的 console 消息推送到所有 SSE 客户端
   * payload: { level: 'log'|'info'|'warn'|'error', args: [...] }
   */
  sendConsole(payload) {
    const message = JSON.stringify({ type: 'console', payload });
    console.log('[Renderer] sendConsole', payload);
    for (const res of this.clients) {
      try {
        res.write(`data: ${message}\n\n`);
      } catch (e) {
        this.clients.delete(res);
      }
    }
  }

  // --- 简易 WXML 风格模板解析与渲染器 ---
  /**
   * _renderTemplate
   * - 将模板字符串解析为中间 DOM（node 列表），再逐节点渲染为 HTML
   * @param {string} tpl - 模板字符串（app.axml）
   * @param {Object} data - 渲染上下文
   */
  _renderTemplate(tpl, data) {
    const dom = this._parseWithHtmlparser(tpl);
    const ctx = data;
    // 将每个根节点渲染为 HTML，最后合并
    return dom.map(n => this._renderNode(n, ctx)).join('');
  }

  /**
   * _eval
   * - 在安全性不严格的开发环境中，使用 Function 和 with 将表达式在 ctx 上下文中求值
   * - 注意：此处并未做沙箱隔离，执行任意表达式存在安全风险，仅限本地开发/演示
   */
  _eval(expr, ctx) {
    try {
      // 在表达式中以 ctx 作为上下文对象
      return Function('ctx', `with(ctx){ return (${expr}); }`)(ctx);
    } catch (e) {
      return '';
    }
  }

  /**
   * _renderNode
   * - 递归渲染单个节点（文本或元素）
   * - 支持指令：`if`、`for`、`for-item`、`for-index`
   */
  _renderNode(node, ctx) {
    // 文本节点：替换 {{expr}} 表达式
    if (node.type === 'text') {
      return node.content.replace(/{{([\s\S]+?)}}/g, (_, expr) => {
        const v = this._eval(expr, ctx);
        return v == null ? '' : v;
      });
    }

    // 元素节点
    const attrs = node.attrs || {};

    // 处理 if 指令：如果条件为假，则不渲染该节点
    if (attrs['if']) {
      const ok = this._eval(attrs['if'], ctx);
      if (!ok) return '';
    }

    // 处理 for 指令：将节点重复渲染为列表
    if (attrs['for']) {
      let list = this._eval(attrs['for'], ctx);
      // 支持数字形式: wx:for="{{3}}" -> [0,1,2]
      if (typeof list === 'number' && Number.isFinite(list) && list >= 0) {
        list = Array.from({ length: list }, (_, i) => i);
      }
      if (!Array.isArray(list)) list = list || [];
      const itemName = attrs['for-item'] || 'item';
      const idxName = attrs['for-index'] || 'index';

      // 标签映射（小程序标签 -> HTML 标签）与 HTML 转义工具
      const tagMap = { view: 'div', text: 'span' };
      const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      // 指令属性（在输出属性时需要跳过）
      const directiveKeys = new Set(['a:if','a:for','a:for-item','a:for-index']);

      // 对列表中的每一项分别在新的上下文中渲染子节点
      return list.map((it, idx) => {
        const childCtx = Object.assign({}, ctx);
        childCtx[itemName] = it;
        childCtx[idxName] = idx;
        const inner = node.children.map(c => this._renderNode(c, childCtx)).join('');
        const nodeAttrs = node.attrs || {};
        const attrPairs = [];
        for (const k of Object.keys(nodeAttrs)) {
          if (!nodeAttrs.hasOwnProperty(k)) continue;
          if (directiveKeys.has(k)) continue;
          const v = nodeAttrs[k];
          if (v == null || v === '') continue;
          const outName = k.indexOf(':') !== -1 ? k.split(':').pop() : k;
          attrPairs.push(`${outName}="${escapeHtml(v)}"`);
        }
        const attrString = attrPairs.length ? ' ' + attrPairs.join(' ') : '';
        const htmlTag = tagMap[node.tag] || node.tag;
        return `<${htmlTag}${attrString}>${inner}</${htmlTag}>`;
      }).join('');
    }

    // 普通元素渲染：先渲染子节点，再根据 tagMap 转换标签并组装属性
    const inner = node.children.map(c => this._renderNode(c, ctx)).join('');
    const tag = node.tag;
    const tagMap = { view: 'div', text: 'span' };
    const htmlTag = tagMap[tag] || tag;

    // 构建属性字符串，排除指令属性并做 HTML 转义
    const directiveKeys = new Set(['a:if','a:for','a:for-item','a:for-index']);
    const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const nodeAttrs = node.attrs || {};
    const attrPairs = [];
    for (const k of Object.keys(nodeAttrs)) {
      if (!nodeAttrs.hasOwnProperty(k)) continue;
      if (directiveKeys.has(k)) continue;
      const v = nodeAttrs[k];
      if (v == null || v === '') continue;
      const outName = k.indexOf(':') !== -1 ? k.split(':').pop() : k;
      attrPairs.push(`${outName}="${escapeHtml(v)}"`);
    }
    const attrString = attrPairs.length ? ' ' + attrPairs.join(' ') : '';
    return `<${htmlTag}${attrString}>${inner}</${htmlTag}>`;
  }

  /**
   * _parse
   * - 解析模板字符串为中间结构（节点数组），目前直接使用 htmlparser2
   */
  _parse(tpl) {
    // fallback to htmlparser2-based parser
    return this._parseWithHtmlparser(tpl);
  }

  /**
   * _parseWithHtmlparser
   * - 使用 htmlparser2 将模板解析为节点树，然后转换为本模块内部使用的 node 结构
   * - node.type: 'text' | 'element'
   * - element 包含 tag, attrs, children
   */
  _parseWithHtmlparser(tpl) {
    const doc = htmlparser2.parseDocument(tpl, { lowerCaseAttributeNames: false });
    const nodesRoot = doc && doc.children ? doc.children : [];
    const convert = (node) => {
      if (node.type === 'text') return { type: 'text', content: node.data };
      if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
        const attrs = {};
        // 保留原始属性，并把含 ':' 的属性同时拆分为局部名，方便后续按本地名访问
        for (const k in node.attribs) {
          let v = node.attribs[k];
          const m = v && v.match(/^\s*\{\{([\s\S]+)\}\}\s*$/);
          if (m) v = m[1].trim();
          attrs[k] = v;
          if (k.indexOf(':') !== -1) {
            const local = k.split(':').pop();
            attrs[local] = v;
          }
        }
        const children = (node.children || []).map(convert);
        return { type: 'element', tag: node.name, attrs, children };
      }
      return { type: 'text', content: '' };
    };
    console.log("nodesRoot",nodesRoot)
    return nodesRoot.map(convert);
  }
}

module.exports = Renderer;