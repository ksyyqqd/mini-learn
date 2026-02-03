class BackgroundManager {
  constructor() {
    this.activeConnections = new Map();
    this.nodeServerUrl = 'http://localhost:3000';
    this.websocket = null;
    this.miniAppWindows = new Map(); // 存储小程序窗口
    this.initializeListeners();
  }

  initializeListeners() {
    // 监听来自popup的消息
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'popup') {
        this.handlePopupConnection(port);
      }
    });

    // 监听标签页更新，但排除浏览器内置页面
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // 检查是否为普通网页（排除chrome://, edge://, about:等特殊页面）
      if (changeInfo.status === 'complete' && this.isRegularWebPage(tab.url)) {
        this.injectContentScript(tabId);
      }
    });

    // 监听窗口创建事件
    chrome.windows.onCreated.addListener((window) => {
      console.log('[Background] Window created:', window.id);
    });

    // 监听窗口关闭事件
    chrome.windows.onRemoved.addListener((windowId) => {
      if (this.miniAppWindows.has(windowId)) {
        console.log('[Background] MiniApp window closed:', windowId);
        this.miniAppWindows.delete(windowId);
      }
    });
  }

  // 检查是否为普通网页URL
  isRegularWebPage(url) {
    if (!url) return false;
    
    const excludedProtocols = ['chrome://', 'edge://', 'about:', 'file://'];
    return !excludedProtocols.some(protocol => url.startsWith(protocol));
  }

  handlePopupConnection(port) {
    const connectionId = Date.now().toString();
    this.activeConnections.set(connectionId, port);

    port.onMessage.addListener((message) => {
      this.handlePopupMessage(message, port, connectionId);
    });

    port.onDisconnect.addListener(() => {
      this.activeConnections.delete(connectionId);
      if (this.activeConnections.size === 0) {
        this.disconnectFromNode();
      }
    });

    // 发送连接确认消息
    port.postMessage({
      type: 'CONNECTED',
      payload: { connectionId }
    });
  }

  async handlePopupMessage(message, port, connectionId) {
    try {
      switch (message.type) {
        case 'LAUNCH_APP':
          await this.launchApp(message.payload.appName, port);
          break;
          
        case 'SHOW_APP':
          await this.showApp(port);
          break;
          
        case 'SHOW_APP_WINDOW':
          await this.showAppWindow(port);
          break;
          
        case 'HIDE_APP':
          await this.hideApp(port);
          break;
          
        case 'REFRESH_APP':
          await this.refreshApp(port);
          break;
          
        default:
          port.postMessage({
            type: 'ERROR',
            payload: { message: `未知消息类型: ${message.type}` }
          });
      }
    } catch (error) {
      console.error('处理消息时出错:', error);
      port.postMessage({
        type: 'ERROR',
        payload: { message: error.message }
      });
    }
  }

  async launchApp(appName, port) {
    try {
      // 连接到Node.js服务
      await this.connectToNode();

      // 请求启动指定小程序
      const response = await fetch(`${this.nodeServerUrl}/api/launch-app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ appName })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      port.postMessage({
        type: 'APP_LAUNCHED',
        payload: {
          appName: result.appName,
          data: result.initialData
        }
      });

      // 设置当前应用
      this.currentApp = appName;

    } catch (error) {
      throw new Error(`启动小程序失败: ${error.message}`);
    }
  }

  async showApp(port) {
    try {
      const response = await fetch(`${this.nodeServerUrl}/api/show-app`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      port.postMessage({
        type: 'APP_SHOWN'
      });

    } catch (error) {
      throw new Error(`显示小程序失败: ${error.message}`);
    }
  }

  async showAppWindow(port) {
    try {
      // 先确保小程序已启动
      if (!this.currentApp) {
        throw new Error('请先启动小程序');
      }

      // 创建独立窗口显示小程序
      const window = await chrome.windows.create({
        url: chrome.runtime.getURL('enhanced-miniapp-window.html'),
        type: 'popup',
        width: 400,
        height: 600,
        focused: true
      });

      if (window && window.id) {
        this.miniAppWindows.set(window.id, {
          appId: this.currentApp,
          windowId: window.id,
          createdAt: Date.now()
        });

        console.log('[Background] Created MiniApp window:', window.id);
        
        port.postMessage({
          type: 'APP_WINDOW_SHOWN',
          payload: { windowId: window.id }
        });
      } else {
        throw new Error('创建窗口失败');
      }

    } catch (error) {
      console.error('[Background] Show app window error:', error);
      throw new Error(`显示小程序窗口失败: ${error.message}`);
    }
  }

  async hideApp(port) {
    try {
      const response = await fetch(`${this.nodeServerUrl}/api/hide-app`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      port.postMessage({
        type: 'APP_HIDDEN'
      });

    } catch (error) {
      throw new Error(`隐藏小程序失败: ${error.message}`);
    }
  }

  async refreshApp(port) {
    try {
      const response = await fetch(`${this.nodeServerUrl}/api/refresh-app`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      port.postMessage({
        type: 'APP_DATA_UPDATE',
        payload: { data: result.data }
      });

    } catch (error) {
      throw new Error(`刷新小程序失败: ${error.message}`);
    }
  }

  async connectToNode() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket('ws://localhost:3003');

      this.websocket.onopen = () => {
        console.log('[Background] 已连接到Node.js WebSocket服务器');
        resolve();
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.broadcastToPopups(message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('[Background] WebSocket连接错误:', error);
        reject(new Error('无法连接到Node.js服务'));
      };

      this.websocket.onclose = () => {
        console.log('[Background] WebSocket连接已关闭');
        this.websocket = null;
      };

      // 设置连接超时
      setTimeout(() => {
        if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
          reject(new Error('连接Node.js服务超时'));
        }
      }, 5000);
    });
  }

  disconnectFromNode() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  broadcastToPopups(message) {
    for (const [connectionId, port] of this.activeConnections) {
      try {
        port.postMessage(message);
      } catch (error) {
        console.error(`向popup ${connectionId} 发送消息失败:`, error);
        this.activeConnections.delete(connectionId);
      }
    }
  }

  injectContentScript(tabId) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    }).catch(error => {
      // 只记录错误，不中断流程
      console.warn('注入content script失败:', error.message);
    });
  }
}

// 初始化后台管理器
new BackgroundManager();