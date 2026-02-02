const http = require('http');
const fs = require('fs');
const path = require('path');
const htmlparser2 = require('htmlparser2');
const websocketPackage = require('./package');
const Runtime = require('./runtime');

/**
 * Renderer 类
 * - 提供一个简单的 HTTP 服务用于在浏览器中展示渲染结果
 * - 支持 SSE（Server-Sent Events）向浏览器推送渲染更新
 * - 内置简易的 WXML模板解析与渲染器
 */
class Renderer {
  /**
   * 构造函数
   * @param {number} port - HTTP 服务端口（默认 3002）
   * @param {number} wsPort - WebSocket 服务端口（默认 3003）
   */
  constructor(port = 3002, wsPort = 3003) {
    this.port = port;
    this.wsPort = wsPort;
    // bridge引用，用于转发方法调用
    this.bridge = null;
    // 存储最新的渲染数据
    this.currentData = null;
    // WebSocket服务器实例
    this.websocketServer = null;
    // 初始数据（用于WebSocket连接成功后的首次渲染）
    this.initialData = null;
    // 启动服务器
    this._startServers();
  }

  /**
   * 设置bridge实例
   * @param {Bridge} bridge - bridge实例
   */
  setBridge(bridge) {
    this.bridge = bridge;
  }

  /**
   * 启动 HTTP 服务器和 WebSocket 服务器
   * HTTP服务器用于提供静态资源
   * WebSocket服务器用于实时双向通信
   */
  /**
   * 设置初始数据，等待WebSocket连接成功后渲染
   * @param {Object} data - 初始渲染数据
   */
  setInitialData(data) {
    this.initialData = data;
    // 如果已经有客户端连接，立即渲染
    if (this.websocketServer && this.websocketServer.getClientCount() > 0) {
      this.render(Runtime.app.data);
    }
  }

  _startServers() {
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

    // 启动 HTTP 服务器（用于静态资源）
    const httpServer = http.createServer((req, res) => {
      // 提供 websocket-client.js 文件
      if (req.url === '/websocket-client.js') {
        const wsClientPath = path.join(__dirname, '..', 'public', 'websocket-client.js');
        try {
          const js = fs.readFileSync(wsClientPath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/javascript' });
          res.end(js);
        } catch (e) {
          res.writeHead(404);
          res.end('/* websocket-client.js not found */');
        }
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

    httpServer.listen(this.port, () => {
      console.log(`Renderer HTTP server running: http://localhost:${this.port}`);
    });

    // 启动 WebSocket 服务器
    this.websocketServer = new websocketPackage.WebSocketServer(this.wsPort);
    
    // 注册客户端连接事件处理器
    this.websocketServer.registerClientConnectedHandler((ws, payload) => {
      console.log('[Renderer] WebSocket client connected, checking for initial data');
      if (this.initialData) {
        console.log('[Renderer] Rendering initial data after WebSocket connection');
        this.render(this.initialData);
      }
    });
    
    // 注册消息处理器
    this._registerMessageHandlers();
    
    this.httpServer = httpServer;
  }

  /**
   * 注册WebSocket消息处理器
   */
  _registerMessageHandlers() {
    // 注册方法调用处理器
    this.websocketServer.registerHandler(
      websocketPackage.WebSocketProtocol.MESSAGE_TYPES.CALL_METHOD,
      (ws, payload) => {
        const { methodName, args } = payload;
        console.log(`[Renderer] Received method call: ${methodName}`, args);
        
        // 通过bridge转发方法调用请求
        if (this.bridge && typeof this.bridge.sendToJS === 'function') {
          this.bridge.sendToJS('callMethod', { methodName, args });
          // 发送确认响应
          const response = websocketPackage.WebSocketProtocol.buildMethodCallResponse(
            true, 
            methodName
          );
          ws.send(JSON.stringify(response));
        } else {
          const response = websocketPackage.WebSocketProtocol.buildMethodCallResponse(
            false, 
            methodName, 
            null, 
            'Bridge not available'
          );
          ws.send(JSON.stringify(response));
        }
      }
    );
  }

  /**
   * render - 将数据渲染为 HTML 并推送到已连接的浏览器客户端（通过 SSE）
   * @param {Object} data - 渲染上下文数据（模板中可通过 {{var}} 访问）
   */
  /**
   * render - 将数据渲染为 HTML 并推送到已连接的浏览器客户端（通过 WebSocket）
   * @param {Object} data - 渲染上下文数据（模板中可通过 {{var}} 访问）
   */
  render(data) {
    // 保存当前数据
    this.currentData = data;
    
    // 将模板与数据结合生成最终 HTML
    const html = this._renderTemplate(this.template, data || {});
    // 调试：打印渲染后的 HTML 以便本地查看
    console.log('[Renderer] rendered HTML:\n', html);
    
    // 构建渲染消息
    const message = websocketPackage.WebSocketProtocol.buildRenderMessage(html, data);

    // 如果没有浏览器客户端连接，回退到控制台输出
    if (this.websocketServer.getClientCount() === 0) {
      console.log('[Renderer] no browser clients, fallback to console:\n', JSON.stringify(message));
      return;
    }

    // 向所有已连接的 WebSocket 客户端推送数据
    this.websocketServer.broadcast(message);
  }

  /**
   * sendConsole - 将来自 runtime 的 console 消息推送到所有 WebSocket 客户端
   * @param {Object} payload - 控制台消息 { level, args }
   */
  sendConsole(payload) {
    const message = websocketPackage.WebSocketProtocol.buildConsoleMessage(
      payload.level, 
      payload.args
    );
    console.log('[Renderer] sendConsole', payload);
    this.websocketServer.broadcast(message);
  }

  /**
   * 处理客户端发送的消息
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} data - 消息数据
   */

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