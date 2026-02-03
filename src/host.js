const path = require('path');
const http = require('http');
const Bridge = require('./bridge');
const Runtime = require('./runtime');
const Renderer = require('./renderer');
const websocketPackage = require('./package');

class HostManager {
  constructor() {
    this.apps = new Map(); // 存储多个小程序实例
    this.currentApp = null;
    this.basePort = 3002; // 基础端口
    this.usedPorts = new Set([3000]); // 只保留API服务器端口，WebSocket端口单独处理
    this.websocketPort = 3003; // 固定WebSocket端口
    this.websocketServer = null; // WebSocket服务器实例
    this.createServer();
    this.startWebSocketServer(); // 在初始化时就启动WebSocket服务器
  }

  createServer() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(3000, () => {
      console.log('Host API server listening on port 3000');
    });
  }

  // 新增方法：启动WebSocket服务器
  startWebSocketServer() {
    try {
      console.log(`[Host] Starting WebSocket server on port ${this.websocketPort}`);
      this.websocketServer = new websocketPackage.WebSocketServer(this.websocketPort);
      
      // 注册客户端连接处理器
      this.websocketServer.registerClientConnectedHandler((ws, payload) => {
        console.log('[Host] WebSocket client connected');
        // 可以在这里处理客户端连接后的逻辑
      });
      
      console.log(`[Host] WebSocket server started successfully on port ${this.websocketPort}`);
    } catch (error) {
      console.error(`[Host] Failed to start WebSocket server on port ${this.websocketPort}:`, error);
    }
  }

  getNextAvailablePort() {
    let port = this.basePort;
    while (this.usedPorts.has(port)) {
      port++;
    }
    this.usedPorts.add(port);
    return port;
  }

  handleRequest(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        switch (pathname) {
          case '/api/apps':
            this.handleListApps(req, res);
            break;
            
          case '/api/launch-app':
            this.handleLaunchApp(req, res, body);
            break;
            
          case '/api/show-app':
            this.handleShowApp(req, res);
            break;
            
          case '/api/hide-app':
            this.handleHideApp(req, res);
            break;
            
          case '/api/refresh-app':
            this.handleRefreshApp(req, res);
            break;
            
          case '/api/current-app':
            this.handleGetCurrentApp(req, res);
            break;
            
          default:
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (error) {
        console.error('处理请求时出错:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  handleListApps(req, res) {
    const availableApps = [
      { id: 'sample-app', name: '示例小程序', path: 'sample-app/app.js' },
      { id: 'counter-app', name: '计数器小程序', path: 'counter-app/app.js' },
      { id: 'todo-app', name: '待办事项小程序', path: 'todo-app/app.js' }
    ];
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(availableApps));
  }

  async handleLaunchApp(req, res, body) {
    try {
      const { appName } = JSON.parse(body);
      
      if (!appName) {
        throw new Error('缺少appName参数');
      }

      // 如果当前有运行的小程序，先清理
      if (this.currentApp) {
        this.cleanupCurrentApp();
      }

      // 创建新的小程序实例
      const appInstance = await this.createAppInstance(appName);
      this.apps.set(appName, appInstance);
      this.currentApp = appName;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        appName: appName,
        initialData: appInstance.runtime.app.data || {},
        renderPort: appInstance.renderPort
      }));

      console.log(`[Host] 小程序 ${appName} 启动成功，渲染端口: ${appInstance.renderPort}`);
      
    } catch (error) {
      console.error('[Host] 启动小程序失败:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: error.message 
      }));
    }
  }

  handleShowApp(req, res) {
    if (!this.currentApp) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '没有运行中的小程序' }));
      return;
    }

    // 通知渲染器显示小程序
    const appInstance = this.apps.get(this.currentApp);
    if (appInstance && appInstance.renderer) {
      appInstance.renderer.render(appInstance.runtime.app.data);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  handleHideApp(req, res) {
    if (!this.currentApp) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '没有运行中的小程序' }));
      return;
    }

    // 通知渲染器隐藏小程序
    // 这里可以通过WebSocket或者其他方式通知前端
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  handleRefreshApp(req, res) {
    if (!this.currentApp) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '没有运行中的小程序' }));
      return;
    }

    const appInstance = this.apps.get(this.currentApp);
    const currentData = appInstance.runtime.app.data || {};

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true,
      data: currentData
    }));
  }

  handleGetCurrentApp(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      currentApp: this.currentApp,
      apps: Array.from(this.apps.keys())
    }));
  }

  async createAppInstance(appName) {
    const bridge = new Bridge();
    const renderPort = this.getNextAvailablePort();
    // 使用共享的WebSocket服务器，而不是为每个实例创建新的
    const renderer = new Renderer(renderPort, this.websocketPort, this.websocketServer);
    const runtime = new Runtime(bridge);

    // 设置renderer的bridge引用
    renderer.setBridge(bridge);

    // 当 runtime 调用 setData 时，bridge 转发给渲染器
    bridge.on('setData', (payload) => {
      renderer.render(payload);
      renderer.setInitialData(payload);
      if (typeof runtime.triggerLifecycle === 'function') {
        runtime.triggerLifecycle('onUpdate', { data: payload });
      }
      
      // 通过WebSocket通知插件数据更新
      this.notifyDataUpdate(payload);
    });

    // 监听来自前端的方法调用请求
    bridge.on('toJS', (payload) => {
      if (payload.cmd === 'callMethod') {
        const { methodName, args } = payload.payload;
        console.log(`[Host] Received method call: ${methodName}`, args);
        
        // 调用runtime中App对象的对应方法
        if (runtime.app && typeof runtime.app[methodName] === 'function') {
          try {
            runtime.app[methodName].call(runtime.app, args);
            console.log(`[Host] Method ${methodName} executed successfully`);
          } catch (error) {
            console.error(`[Host] Error executing method ${methodName}:`, error);
          }
        } else {
          console.warn(`[Host] Method ${methodName} not found in App object`);
        }
      }
    });

    // 将 runtime 中的 console 事件转发到 renderer
    bridge.on('console', (payload) => {
      if (renderer && typeof renderer.sendConsole === 'function') {
        renderer.sendConsole(payload);
      } else {
        console.log('[Host] console', payload);
      }
    });

    // 获取应用路径
    let appPath;
    switch (appName) {
      case 'sample-app':
        appPath = path.join(__dirname, '..', 'sample-app', 'app.js');
        break;
      case 'counter-app':
        appPath = path.join(__dirname, '..', 'counter-app', 'app.js');
        break;
      case 'todo-app':
        appPath = path.join(__dirname, '..', 'todo-app', 'app.js');
        break;
      default:
        throw new Error(`未知的小程序: ${appName}`);
    }

    console.log(`[Host] Starting miniapp: ${appName}, path: ${appPath}`);
    
    // 初始化执行
    await runtime.run(appPath);
    
    console.log(`[Host] After runtime.run, runtime.app:`, runtime.app);
    
    // 设置初始数据
    if (runtime.app && runtime.app.data) {
      renderer.setInitialData(runtime.app.data);
    } else {
      console.warn('[Host] runtime.app or runtime.app.data is undefined');
      // 设置默认初始数据
      renderer.setInitialData({ count: 0 });
    }

    return { bridge, renderer, runtime, renderPort };
  }

  cleanupCurrentApp() {
    if (this.currentApp) {
      const appInstance = this.apps.get(this.currentApp);
      if (appInstance) {
        // 清理资源
        if (appInstance.renderer) {
          appInstance.renderer.cleanup();
        }
        // 释放端口
        this.usedPorts.delete(appInstance.renderPort);
      }
      this.apps.delete(this.currentApp);
      this.currentApp = null;
    }
  }

  notifyDataUpdate(data) {
    // 这里可以实现WebSocket通知机制
    // 暂时通过console输出，后续可以集成WebSocket服务器
    console.log('[Host] 数据更新通知:', data);
  }

  shutdown() {
    this.cleanupCurrentApp();
    this.apps.clear();
    if (this.server) {
      this.server.close();
    }
  }
}

// 创建全局主机管理器
const hostManager = new HostManager();

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭主机...');
  hostManager.shutdown();
  process.exit(0);
});

module.exports = hostManager;